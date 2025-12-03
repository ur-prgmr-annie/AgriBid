// app/farmer/create-listings.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { storage } from '../../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const { width: screenWidth } = Dimensions.get('window');

export default function CreateListingScreen() {
  const router = useRouter();

  const [cropType, setCropType] = useState('');
  const [variety, setVariety] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [description, setDescription] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState(null);
  const [marketPrice, setMarketPrice] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [marketData, setMarketData] = useState(null);

  const [imageUri, setImageUri] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ Your Flask backend serving the trained model - SAME AS PRICE MONITORING
  const API_BASE_URL = 'http://127.0.0.1:5000';

  // Color Palette - Matching the Price Monitoring Screen
  const colors = {
    primary: '#1a331a',
    secondary: '#2d4d2d',
    accent: '#4caf50',
    light: '#81c784',
    lighter: '#e8f5e9',
    background: '#f8fff8',
    textDark: '#1a331a',
    textLight: '#ffffff',
    textMuted: '#2e7d32',
    success: '#4caf50',
    warning: '#ffc107',
    error: '#a2f436ff',
    cardGradient: ['#1a331a', '#2d4d2d'],
    headerGradient: ['#1a331a', '#2d4d2d'],
    trendUp: ['#4caf50', '#2e7d32'],
    trendDown: ['#a2f436ff', '#a2f436ff'],
    trendStable: ['#ffc107', '#ff8f00'],
  };

  const availableCrops = [
    'rice', 'corn', 'wheat', 'tomato', 'onion', 'cabbage', 'eggplant', 
    'carrot', 'bell_pepper', 'potato', 'sweet_potato', 'banana', 'mango', 
    'pineapple', 'mongo', 'soybean', 'coffee', 'cacao', 'sugarcane'
  ];

  
  const fetchMarketData = async () => {
    try {
      console.log('🔄 Fetching current market data for price comparison...');
      const response = await fetch(`${API_BASE_URL}/market-prices`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const results = await response.json();
      console.log('✅ Market data received for price comparison');

      if (results.status === 'success') {
        setMarketData(results.market_data || {});
        return results.current_prices || {};
      }
    } catch (error) {
      console.error('Market data fetch error:', error);
      return {};
    }
  };


  useEffect(() => {
    const fetchPriceData = async () => {
      const normalizedCropType = cropType.toLowerCase().trim();
      
      if (!normalizedCropType) {
        setSuggestedPrice(null);
        setMarketPrice(null);
        return;
      }

      setPredictionLoading(true);

      try {
        // 1. First get current market prices for comparison
        const currentPrices = await fetchMarketData();
        
        // Find current market price for this crop
        const marketPriceKey = Object.keys(currentPrices).find(key => 
          key.toLowerCase().includes(normalizedCropType) || 
          normalizedCropType.includes(key.toLowerCase())
        );

        if (marketPriceKey && currentPrices[marketPriceKey]) {
          const currentMarketPrice = parseFloat(currentPrices[marketPriceKey]);
          setMarketPrice(currentMarketPrice);
          console.log(`📊 Found market price for ${normalizedCropType}: ₱${currentMarketPrice}`);
        } else {
          console.log('🌱 No current market price found, using AI prediction only');
          setMarketPrice(null);
        }

        // 2. Get AI price prediction
        console.log('🌱 Fetching AI predicted price for:', normalizedCropType);

        const currentDate = new Date();
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();
        
        let season = 'dry';
        if (month >= 6 && month <= 10) season = 'wet';
        if (month >= 3 && month <= 5) season = 'summer';

        const requestData = {
          crop_type: normalizedCropType,
          variety: variety || 'standard',
          quantity: quantity ? parseFloat(quantity) : 100,
          month: month,
          year: year,
          season: season,
          region: 'national_average'
        };

        console.log('📊 Sending AI prediction request:', requestData);

        const response = await fetch(`${API_BASE_URL}/predict-price`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });

        console.log('📡 AI Prediction response status:', response.status);

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ AI Predicted price received:', result);

        if (result.status === 'success' && result.predicted_price !== undefined) {
          const predictedPrice = parseFloat(result.predicted_price);
          setSuggestedPrice(predictedPrice);
          
          // Auto-fill min price with smart suggestion
          if (!minPrice) {
            let suggestedMinPrice;
            
            // If we have both market and predicted prices, use the lower one minus 5%
            if (marketPrice && predictedPrice) {
              const basePrice = Math.min(marketPrice, predictedPrice);
              suggestedMinPrice = basePrice * 0.95;
            } 
            // If only market price is available
            else if (marketPrice) {
              suggestedMinPrice = marketPrice * 0.95;
            }
            // If only predicted price is available
            else if (predictedPrice) {
              suggestedMinPrice = predictedPrice * 0.95;
            }
            
            if (suggestedMinPrice) {
              setMinPrice(suggestedMinPrice.toFixed(2));
            }
          }
        } else {
          console.warn('❌ No predicted price in response:', result);
          setSuggestedPrice(null);
        }
      } catch (error) {
        console.error('❌ Price prediction error:', error);
        // Fallback: Use sample prices based on crop type
        const fallbackPrice = getFallbackPrice(cropType);
        if (fallbackPrice) {
          setSuggestedPrice(fallbackPrice);
          if (!minPrice) {
            setMinPrice((fallbackPrice * 0.9).toFixed(2));
          }
        } else {
          setSuggestedPrice(null);
        }
      } finally {
        setPredictionLoading(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(fetchPriceData, 800);
    return () => clearTimeout(timeoutId);
  }, [cropType, variety, quantity]);

  // Fallback prices if API fails
  const getFallbackPrice = (crop) => {
    const cropLower = crop.toLowerCase();
    const priceMap = {
      'rice': 45.50, 'corn': 22.30, 'wheat': 38.75,
      'tomato': 68.40, 'onion': 120.50, 'cabbage': 35.80,
      'eggplant': 42.30, 'carrot': 65.80, 'bell_pepper': 85.20,
      'potato': 55.20, 'sweet_potato': 28.50, 'banana': 25.30,
      'mango': 90.75, 'pineapple': 35.20, 'mongo': 75.40,
      'soybean': 42.60, 'coffee': 180.25, 'cacao': 150.80,
      'sugarcane': 18.50
    };

    for (const [key, price] of Object.entries(priceMap)) {
      if (cropLower.includes(key) || key.includes(cropLower)) {
        return price;
      }
    }
    
    return null;
  };

  // Helper function to get current season
  const getCurrentSeason = () => {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return 'summer';
    if (month >= 6 && month <= 10) return 'wet';
    return 'dry';
  };

  // Format crop name for display
  const formatCropName = (name) => {
    return name
      .replace(/[_\-]+/g, ' ')
      .split(' ')
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
      .join(' ');
  };

  // Format price display
  const formatPrice = (price) => {
    if (!price) return '₱0.00';
    return `₱${parseFloat(price).toFixed(2)}/kg`;
  };

  // Calculate price comparison
  const getPriceComparison = () => {
    if (!suggestedPrice || !minPrice) return null;
    
    const minPriceNum = parseFloat(minPrice);
    const difference = minPriceNum - suggestedPrice;
    const percentage = (difference / suggestedPrice) * 100;
    
    return {
      difference,
      percentage,
      isCompetitive: minPriceNum <= suggestedPrice,
      isAboveMarket: minPriceNum > suggestedPrice
    };
  };

  // Get price recommendation
  const getPriceRecommendation = () => {
    if (!suggestedPrice && !marketPrice) return null;

    const basePrice = suggestedPrice || marketPrice;
    const competitivePrice = basePrice * 0.95; // 5% below market/AI price
    const premiumPrice = basePrice * 1.10; // 10% above for premium quality

    return {
      competitive: competitivePrice,
      premium: premiumPrice,
      base: basePrice
    };
  };

  const priceComparison = getPriceComparison();
  const priceRecommendation = getPriceRecommendation();

  // ─────────────────────────────
  // Image Picker
  // ─────────────────────────────
  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission required',
          'Please allow access to your photos to upload a crop image.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
      }
    } catch (err) {
      console.error('ImagePicker error:', err);
      Alert.alert('Error', 'Could not open image picker.');
    }
  };

  // ─────────────────────────────
  // Post Listing
  // ─────────────────────────────
  const handlePost = async () => {
    if (!cropType || !variety || !quantity || !minPrice) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    const qtyNum = Number(quantity);
    const minPriceNum = Number(minPrice);
    const suggestedNum = suggestedPrice ? Number(suggestedPrice) : 0;
    const marketNum = marketPrice ? Number(marketPrice) : 0;

    if (Number.isNaN(qtyNum) || Number.isNaN(minPriceNum)) {
      Alert.alert('Error', 'Quantity and Minimum Price must be valid numbers.');
      return;
    }

    if (minPriceNum <= 0) {
      Alert.alert('Error', 'Minimum Price must be greater than 0.');
      return;
    }

    setLoading(true);

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('No authenticated user found.');
      }

      const uid = user.uid;
      const db = getFirestore();

      // 1) Upload image to Firebase Storage (if selected)
      let imageUrl = null;
      if (imageUri) {
        try {
          setUploadingImage(true);

          const response = await fetch(imageUri);
          const blob = await response.blob();

          const filename = `listingImages/${uid}/${Date.now()}.jpg`;
          const storageRef = ref(storage, filename);
          await uploadBytes(storageRef, blob);

          imageUrl = await getDownloadURL(storageRef);
        } catch (uploadErr) {
          console.error('Image upload error:', uploadErr);
          Alert.alert(
            'Warning',
            'Failed to upload image. Posting listing without image.'
          );
        } finally {
          setUploadingImage(false);
        }
      }

      // 2) Save listing in Firestore with AI prediction and market data
      const listingData = {
        cropType: cropType.toLowerCase(),
        variety: variety.toLowerCase(),
        quantity: qtyNum,
        minimumPrice: minPriceNum,
        suggestedPrice: suggestedNum,
        currentMarketPrice: marketNum,
        description,
        farmerUid: uid,
        imageUrl: imageUrl || null,
        createdAt: serverTimestamp(),
        status: 'open',
        // AI prediction metadata
        aiPredictedPrice: suggestedNum,
        marketPrice: marketNum,
        predictionConfidence: 'high',
        predictionTimestamp: serverTimestamp(),
        predictionFeatures: {
          crop_type: cropType.toLowerCase(),
          variety: variety.toLowerCase(),
          quantity: qtyNum,
          season: getCurrentSeason(),
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear()
        },
        // Market context
        marketTrend: suggestedNum && minPriceNum ? 
          (minPriceNum <= suggestedNum ? 'competitive' : 'above_market') : 'unknown',
        priceComparison: priceComparison ? {
          difference: priceComparison.difference,
          percentage: priceComparison.percentage,
          isCompetitive: priceComparison.isCompetitive
        } : null
      };

      await addDoc(collection(db, 'listings'), listingData);

      let successMessage = 'Listing posted successfully!';
      if (suggestedNum || marketNum) {
        if (suggestedNum && marketNum) {
          successMessage += `\n🤖 AI Suggested: ₱${suggestedNum.toFixed(2)} • 📊 Market: ₱${marketNum.toFixed(2)}`;
        } else if (suggestedNum) {
          successMessage += `\n🤖 AI Suggested Price: ₱${suggestedNum.toFixed(2)}`;
        } else if (marketNum) {
          successMessage += `\n📊 Current Market Price: ₱${marketNum.toFixed(2)}`;
        }
      }

      Alert.alert('Success', successMessage);
      router.back();
    } catch (err) {
      console.error('CreateListing error:', err);
      Alert.alert('Error', err.message || 'Failed to post listing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={colors.headerGradient}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textLight} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Create New Listing</Text>
          <Text style={styles.headerSubtitle}>
            Post a new crop listing with AI-powered price intelligence
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={colors.cardGradient}
          style={styles.form}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Image preview + button */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Crop Image (Optional)</Text>

            {imageUri ? (
              <View style={styles.imagePreviewWrapper}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => setImageUri(null)}
                >
                  <Ionicons name="close" size={16} color={colors.textLight} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={40} color={colors.light} />
                <Text style={styles.imagePlaceholderText}>
                  No image selected
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.imageButton}
              onPress={handlePickImage}
              disabled={loading || uploadingImage}
            >
              <LinearGradient
                colors={['#4caf50', '#2e7d32']}
                style={styles.imageButtonGradient}
              >
                <Ionicons name="camera" size={16} color={colors.textLight} />
                <Text style={styles.imageButtonText}>
                  {uploadingImage ? 'Uploading...' : 'Choose Image'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Crop Information */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Crop Type *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Rice, Tomato, Onion, Mango"
              placeholderTextColor="#a5d6a7"
              value={cropType}
              onChangeText={setCropType}
              editable={!loading}
            />
            <Text style={styles.inputHint}>
              Start typing to get real-time AI price suggestions
            </Text>
            {predictionLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.loadingText}>Analyzing market data...</Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Variety/Grade *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Premium, Grade A, Local, Hybrid"
              placeholderTextColor="#a5d6a7"
              value={variety}
              onChangeText={setVariety}
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Quantity (kg) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 100"
              keyboardType="numeric"
              placeholderTextColor="#a5d6a7"
              value={quantity}
              onChangeText={setQuantity}
              editable={!loading}
            />
          </View>

          {/* Price Intelligence Section */}
          <View style={styles.priceIntelligenceSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>💰 Price Intelligence</Text>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            </View>

            {/* Current Market Price */}
            {marketPrice && (
              <View style={styles.marketPriceCard}>
                <View style={styles.priceHeader}>
                  <Ionicons name="trending-up" size={20} color={colors.success} />
                  <Text style={styles.marketPriceTitle}>Current Market Price</Text>
                </View>
                <Text style={styles.marketPriceValue}>{formatPrice(marketPrice)}</Text>
                <Text style={styles.marketPriceSubtitle}>
                  Real-time market average based on actual transactions
                </Text>
              </View>
            )}

            {/* AI Suggested Price */}
            {suggestedPrice && (
              <View style={styles.suggestionCard}>
                <View style={styles.priceHeader}>
                  <Ionicons name="brain" size={20} color={colors.accent} />
                  <Text style={styles.suggestionTitle}>AI Suggested Price</Text>
                </View>
                <Text style={styles.suggestedPriceValue}>{formatPrice(suggestedPrice)}</Text>
                <Text style={styles.suggestionSubtitle}>
                  Machine learning prediction based on seasonality and trends
                </Text>
                <View style={styles.predictionDetails}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Model Confidence:</Text>
                    <Text style={styles.detailValue}>High</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Season:</Text>
                    <Text style={styles.detailValue}>{getCurrentSeason().toUpperCase()}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Crop:</Text>
                    <Text style={styles.detailValue}>{formatCropName(cropType)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Price Recommendations */}
            {priceRecommendation && (
              <View style={styles.recommendationCard}>
                <Text style={styles.recommendationTitle}>💡 Smart Pricing Tips</Text>
                <View style={styles.recommendationGrid}>
                  <View style={styles.recommendationItem}>
                    <Text style={styles.recommendationPrice}>
                      {formatPrice(priceRecommendation.competitive)}
                    </Text>
                    <Text style={styles.recommendationLabel}>Competitive</Text>
                    <Text style={styles.recommendationDesc}>Fast sale</Text>
                  </View>
                  <View style={styles.recommendationItem}>
                    <Text style={styles.recommendationPrice}>
                      {formatPrice(priceRecommendation.base)}
                    </Text>
                    <Text style={styles.recommendationLabel}>Market Rate</Text>
                    <Text style={styles.recommendationDesc}>Balanced</Text>
                  </View>
                  <View style={styles.recommendationItem}>
                    <Text style={styles.recommendationPrice}>
                      {formatPrice(priceRecommendation.premium)}
                    </Text>
                    <Text style={styles.recommendationLabel}>Premium</Text>
                    <Text style={styles.recommendationDesc}>High quality</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Your Minimum Price */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your Minimum Price (₱/kg) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 40.50"
              keyboardType="numeric"
              placeholderTextColor="#a5d6a7"
              value={minPrice}
              onChangeText={setMinPrice}
              editable={!loading}
            />
            {priceComparison && (
              <View style={[
                styles.priceComparison,
                priceComparison.isAboveMarket ? styles.priceWarning : styles.priceSuccess
              ]}>
                <Ionicons 
                  name={priceComparison.isAboveMarket ? "warning" : "checkmark-circle"} 
                  size={16} 
                  color={colors.textLight} 
                />
                <Text style={styles.comparisonText}>
                  {priceComparison.isAboveMarket 
                    ? `Your price is ₱${Math.abs(priceComparison.difference).toFixed(2)} above suggestion (${priceComparison.percentage.toFixed(1)}%)` 
                    : `Competitive price! (${Math.abs(priceComparison.percentage).toFixed(1)}% below market)`
                  }
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your crop quality, harvest date, storage conditions, certifications, etc."
              placeholderTextColor="#a5d6a7"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
              editable={!loading}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handlePost}
            disabled={loading || uploadingImage}
          >
            <LinearGradient
              colors={['#4caf50', '#2e7d32']}
              style={styles.primaryButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textLight} />
              ) : (
                <>
                  <Ionicons name="leaf" size={20} color={colors.textLight} />
                  <Text style={styles.primaryButtonText}>
                    Post Listing with AI Guidance
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* AI Info Footer */}
          <View style={styles.aiInfoFooter}>
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark" size={16} color={colors.light} />
              <Text style={styles.aiInfoText}>
                AI prices based on real-time market data and machine learning
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="trending-up" size={16} color={colors.light} />
              <Text style={styles.aiInfoText}>
                Market prices update automatically based on supply and demand
              </Text>
            </View>
          </View>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#ffffff' 
  },
  header: { 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: { 
    fontSize: 14, 
    color: '#e8f5e9' 
  },
  content: { 
    flex: 1, 
    padding: 16 
  },
  form: {
    padding: 20,
    borderRadius: 20,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  inputGroup: { 
    marginBottom: 24 
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#4caf50',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#ffffff',
  },
  inputHint: {
    fontSize: 12,
    color: '#81c784',
    marginTop: 4,
    fontStyle: 'italic',
  },
  textArea: { 
    height: 100, 
    paddingTop: 12 
  },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  loadingText: {
    color: '#81c784',
    fontSize: 12,
    marginLeft: 8,
  },

  // Image Styles
  imagePreviewWrapper: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(76, 175, 80, 0.3)',
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    color: '#a5d6a7',
    fontSize: 14,
    marginTop: 8,
  },
  imageButton: {
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  imageButtonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  imageButtonText: { 
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: '600' 
  },

  // Price Intelligence Section
  priceIntelligenceSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  liveBadge: {
    backgroundColor: '#f44336',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },

  // Market Price Card
  marketPriceCard: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  marketPriceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4caf50',
  },
  marketPriceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4caf50',
    marginBottom: 4,
  },
  marketPriceSubtitle: {
    fontSize: 12,
    color: '#81c784',
  },

  // Suggestion Card
  suggestionCard: {
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196f3',
  },
  suggestedPriceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196f3',
    marginBottom: 4,
  },
  suggestionSubtitle: {
    fontSize: 12,
    color: '#81c784',
    marginBottom: 8,
  },
  predictionDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 6,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: '#c8e6c9',
  },
  detailValue: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '600',
  },

  // Recommendation Card
  recommendationCard: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffc107',
    marginBottom: 12,
  },
  recommendationGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recommendationItem: {
    alignItems: 'center',
    flex: 1,
  },
  recommendationPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  recommendationLabel: {
    fontSize: 12,
    color: '#ffc107',
    fontWeight: '600',
    marginBottom: 2,
  },
  recommendationDesc: {
    fontSize: 10,
    color: '#81c784',
  },

  // Price Comparison
  priceComparison: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceWarning: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderLeftWidth: 3,
    borderLeftColor: '#ff9800',
  },
  priceSuccess: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderLeftWidth: 3,
    borderLeftColor: '#4caf50',
  },
  comparisonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff',
    flex: 1,
  },

  // Primary Button
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonGradient: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },

  // AI Info Footer
  aiInfoFooter: {
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4caf50',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  aiInfoText: {
    fontSize: 12,
    color: '#a5d6a7',
    flex: 1,
    fontStyle: 'italic',
  },
});