// app/buyer/listing-detail/[id].js

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { firestore } from '../../../config/firebase';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export default function ListingDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const listingId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [listing, setListing] = useState(null);
  const [highestBid, setHighestBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [placingBid, setPlacingBid] = useState(false);

  // Load listing + current highest bid
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!listingId) {
          setLoadError('Listing ID missing');
          setLoading(false);
          return;
        }

        // 1) Get listing document
        const listingRef = doc(firestore, 'listings', String(listingId));
        const listingSnap = await getDoc(listingRef);

        if (!listingSnap.exists()) {
          setLoadError('Listing not found');
          setLoading(false);
          return;
        }

        let listingData = { id: listingSnap.id, ...listingSnap.data() };

        // 2) Ensure we have farmerName (load from profiles if missing)
        if (!listingData.farmerName && listingData.farmerUid) {
          try {
            const profileRef = doc(firestore, 'profiles', listingData.farmerUid);
            const profileSnap = await getDoc(profileRef);
            if (profileSnap.exists()) {
              const p = profileSnap.data();
              listingData.farmerName = p.fullName || p.name || 'Farmer';
            }
          } catch (e) {
            console.warn('Error fetching farmer profile:', e);
          }
        }

        setListing(listingData);

        // 3) Get highest bid for this listing
        const bidsRef = collection(
          firestore,
          'listings',
          String(listingId),
          'bids'
        );
        const bidsQuery = query(bidsRef, orderBy('bidAmount', 'desc'), limit(1));
        const bidsSnap = await getDocs(bidsQuery);

        if (!bidsSnap.empty) {
          const topBid = bidsSnap.docs[0].data();
          setHighestBid(Number(topBid.bidAmount) || null);
        } else {
          setHighestBid(null);
        }
      } catch (err) {
        console.error('Error fetching listing detail:', err);
        setLoadError('Could not load listing. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [listingId]);

  const handlePlaceBid = async () => {
    if (!listing) return;

    if (!bidAmount) {
      Alert.alert('Error', 'Please enter your bid amount');
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Error', 'You must be signed in to place a bid');
      return;
    }

    // Prevent farmer from bidding on their own listing
    if (user.uid === listing.farmerUid) {
      Alert.alert('Error', 'You cannot bid on your own listing');
      return;
    }

    const bidValue = Number(bidAmount);
    if (!Number.isFinite(bidValue)) {
      Alert.alert('Error', 'Please enter a valid number');
      return;
    }

    const minPrice = Number(listing.minimumPrice) || 0;
    const currentHighest = Number(highestBid) || 0;

    // ✅ Only require higher than minimum price
    if (bidValue <= minPrice) {
      Alert.alert(
        'Error',
        `Bid must be greater than the minimum price (₱${minPrice}).`
      );
      return;
    }

    // Optional warning if lower than current highest
    if (currentHighest > 0 && bidValue < currentHighest) {
      console.log('You are bidding below the current highest bid.');
    }

    setPlacingBid(true);

    try {
      // ========== GET BUYER NAME ==========
      let bidderNameFromProfile = '';

      // 1) subukan sa profiles collection
      try {
        const buyerProfileRef = doc(firestore, 'profiles', user.uid);
        const buyerProfileSnap = await getDoc(buyerProfileRef);
        if (buyerProfileSnap.exists()) {
          const p = buyerProfileSnap.data();
          bidderNameFromProfile = p.fullName || p.name || '';
        }
      } catch (profileErr) {
        console.warn('Failed to fetch buyer profile for bid:', profileErr);
      }

      // 2) derive name from email kung walang profile/displayName
      const email = user.email || '';
      let nameFromEmail = '';
      if (email) {
        const local = email.split('@')[0]; // "buyer" from "buyer@gmail.com"
        if (local) {
          nameFromEmail = local
            .split(/[._-]+/)
            .filter(Boolean)
            .map(
              (part) =>
                part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            )
            .join(' ');
        }
      }

      // 3) final bidderName priority:
      //    profile fullName > displayName > nameFromEmail > full email > "Buyer"
      const bidderName =
        bidderNameFromProfile ||
        user.displayName ||
        nameFromEmail ||
        email ||
        'Buyer';
      // ====================================

      // 1) Save bid in /listings/{listingId}/bids
      await addDoc(
        collection(firestore, 'listings', String(listingId), 'bids'),
        {
          bidderUid: user.uid,
          bidderName,
          bidAmount: bidValue, // number
          createdAt: serverTimestamp(),
        }
      );

      // 2) Create notification for the farmer
      if (listing.farmerUid) {
        const listingTitle = `${listing.cropType} / ${listing.variety}`;

        try {
          await addDoc(collection(firestore, 'notifications'), {
            userUid: listing.farmerUid, // sino ang makakakita
            fromUid: user.uid, // sino ang gumawa
            type: 'new_bid',
            category: 'bid',
            title: 'New bid on your listing',
            // 👉 message na ngayon ay NAME, hindi gmail
            message: `${bidderName} placed a bid of ₱${bidValue.toLocaleString()} on ${listingTitle}`,
            buyerName: bidderName,
            listingTitle,
            bidAmount: bidValue,
            listingId: listing.id,
            createdAt: serverTimestamp(),
            read: false,
            unread: true,
          });
        } catch (notifErr) {
          console.warn('Failed to create notification:', notifErr);
        }
      }

      // update local highest if needed
      if (!highestBid || bidValue > highestBid) {
        setHighestBid(bidValue);
      }
      setBidAmount('');
      Alert.alert('Success', 'Your bid has been placed!');
    } catch (err) {
      console.error('Error placing bid:', err);
      Alert.alert(
        'Error',
        err.message || 'Failed to place bid. Check console for details.'
      );
    } finally {
      setPlacingBid(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  // Error / not found state
  if (loadError || !listing) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: 'center', alignItems: 'center', padding: 16 },
        ]}
      >
        <Text style={{ fontSize: 16, color: '#1a331a', marginBottom: 16 }}>
          {loadError || 'Listing not available.'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: '#4caf50',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Normal UI
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient
          colors={['#1a331a', '#2d4d2d']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.title}>
            {listing.cropType} / {listing.variety}
          </Text>
          <Text style={styles.subtitle}>
            Farmer: {listing.farmerName || 'Unknown farmer'}
          </Text>
        </LinearGradient>

        <View style={styles.details}>
          <Text style={styles.label}>Quantity:</Text>
          <Text style={styles.value}>{listing.quantity}</Text>

          <Text style={styles.label}>Minimum Price:</Text>
          <Text style={styles.value}>₱{listing.minimumPrice}</Text>

          {listing.suggestedPrice != null && (
            <>
              <Text style={styles.label}>Suggested Price:</Text>
              <Text style={styles.value}>₱{listing.suggestedPrice}</Text>
            </>
          )}

          {highestBid != null && (
            <>
              <Text style={styles.label}>Current Highest Bid:</Text>
              <Text style={styles.value}>₱{highestBid}</Text>
            </>
          )}

          {listing.description && (
            <>
              <Text style={styles.label}>Description:</Text>
              <Text style={styles.value}>{listing.description}</Text>
            </>
          )}

          {/* Bid Input */}
          <Text style={styles.label}>Your Bid (₱):</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your bid"
            keyboardType="numeric"
            value={bidAmount}
            onChangeText={setBidAmount}
          />

          <TouchableOpacity
            style={styles.bidButton}
            onPress={handlePlaceBid}
            disabled={placingBid}
          >
            <LinearGradient
              colors={['#4caf50', '#2e7d32']}
              style={styles.bidButtonGradient}
            >
              <Text style={styles.bidButtonText}>
                {placingBid ? 'Placing Bid...' : 'Place Bid'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16 },
  header: { paddingHorizontal: 24, paddingVertical: 20, borderRadius: 16 },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: { fontSize: 16, color: '#a5d6a7' },
  details: {
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(76,175,80,0.1)',
    borderRadius: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a331a',
    marginBottom: 4,
  },
  value: { fontSize: 16, color: '#1a331a', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#4caf50',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    marginBottom: 16,
  },
  bidButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  bidButtonGradient: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bidButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});
