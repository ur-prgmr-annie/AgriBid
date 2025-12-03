// app/buyer/browse-listings.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '../../config/firebase';
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
} from 'firebase/firestore';

export default function BrowseListings() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const categories = [
    { id: 'all', name: 'All Crops' },
    { id: 'ending', name: 'Ending Soon' },
    { id: 'rice', name: 'Rice' },
    { id: 'corn', name: 'Corn' },
    { id: 'fruits', name: 'Fruits' },
    { id: 'vegetables', name: 'Vegetables' },
  ];

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const listingsRef = collection(firestore, 'listings');

        // all listings from all farmers
        const q = query(listingsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        const fetched = querySnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // collect unique farmer UIDs
        const farmerUids = [
          ...new Set(
            fetched
              .map((l) => l.farmerUid)
              .filter((uid) => typeof uid === 'string' && uid.length > 0)
          ),
        ];

        const farmerMap = {};
        // resolve farmer names from profiles/{uid}
        await Promise.all(
          farmerUids.map(async (uid) => {
            try {
              const userRef = doc(firestore, 'profiles', uid); // change to 'users' if needed
              const snap = await getDoc(userRef);
              if (snap.exists()) {
                const data = snap.data();
                farmerMap[uid] = data.fullName || data.name || 'Farmer';
              }
            } catch (e) {
              console.warn('Error fetching farmer profile for', uid, e);
            }
          })
        );

        const enriched = fetched.map((l) => ({
          ...l,
          farmerName:
            l.farmerName || farmerMap[l.farmerUid] || 'Unknown farmer',
        }));

        setListings(enriched);
      } catch (err) {
        console.error('Error fetching listings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, []);

  // combined category + search filter
  const filteredListings = listings.filter((listing) => {
    const status = listing.status || 'open';

    // 1) category filter
    let matchesCategory = true;
    if (activeTab === 'ending') {
      // very simple "ending soon" example:
      // if you have an endDate (timestamp), you can compute here.
      if (listing.endDate?.toDate) {
        const end = listing.endDate.toDate();
        const now = new Date();
        const diffHours = (end.getTime() - now.getTime()) / (1000 * 60 * 60);
        matchesCategory = diffHours > 0 && diffHours <= 24 * 2; // next 2 days
      } else {
        matchesCategory = true; // fallback: include
      }
    } else if (activeTab !== 'all') {
      matchesCategory =
        listing.cropType?.toLowerCase() === activeTab.toLowerCase();
    }

    if (!matchesCategory) return false;

    // 2) search filter
    if (!searchQuery) return true;

    const q = searchQuery.toLowerCase();
    return (
      listing.cropType?.toLowerCase().includes(q) ||
      listing.variety?.toLowerCase().includes(q) ||
      listing.farmerName?.toLowerCase().includes(q)
    );
  });

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

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#1a331a', '#2d4d2d']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.headerTitle}>Browse Crop Listings</Text>
          <Text style={styles.headerSubtitle}>
            Find and bid on available agricultural products
          </Text>

          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#81c784"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search crops, variety or farmers..."
              placeholderTextColor="#81c784"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#81c784" />
              </TouchableOpacity>
            ) : null}
          </View>
        </LinearGradient>

        {/* Categories / filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryButton,
                activeTab === cat.id && styles.categoryButtonActive,
              ]}
              onPress={() => setActiveTab(cat.id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  activeTab === cat.id && styles.categoryTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Count */}
        <View style={styles.listingsCount}>
          <Text style={styles.listingsCountText}>
            {filteredListings.length}{' '}
            {filteredListings.length === 1 ? 'listing' : 'listings'} available
          </Text>
        </View>

        {/* Listing cards – ALL crops from ALL farmers (after filters) */}
        <View style={styles.listingsContainer}>
          {filteredListings.map((listing) => {
            const status = listing.status || 'open';
            const isActive =
              status === 'open' || status === 'active' || status === 'pending';

            return (
              <TouchableOpacity
                key={listing.id}
                style={styles.listingCard}
                onPress={() =>
                  router.push(`/buyer/listing-detail/${listing.id}`)
                }
              >
                <LinearGradient
                  colors={['#1a331a', '#2d4d2d']}
                  style={styles.listingGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cropName}>
                      {listing.cropType} / {listing.variety}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isActive
                          ? styles.activeBadge
                          : styles.closedBadge,
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {isActive ? 'OPEN' : 'CLOSED'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.farmerName}>
                    Farmer: {listing.farmerName || 'Unknown farmer'}
                  </Text>

                  <Text style={styles.detailVal}>
                    Qty: {listing.quantity}
                  </Text>
                  <Text style={styles.detailVal}>
                    Minimum Price: ₱{listing.minimumPrice}
                  </Text>
                  {listing.suggestedPrice != null && (
                    <Text style={styles.detailVal}>
                      Suggested: ₱{listing.suggestedPrice}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>

        {filteredListings.length === 0 && (
          <Text style={{ textAlign: 'center', marginVertical: 40 }}>
            No listings found.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { flex: 1, padding: 16 },

  header: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: { fontSize: 14, color: '#e8f5e9', marginBottom: 16 },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4caf50',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
  },

  categoriesContainer: { marginBottom: 16 },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8fff8',
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#e8f5e9',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryButtonActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  categoryText: { color: '#2e7d32', fontSize: 14, fontWeight: '600' },
  categoryTextActive: { color: '#ffffff', fontWeight: 'bold' },

  listingsCount: { marginBottom: 16 },
  listingsCountText: { color: '#1a331a', fontSize: 16, fontWeight: '600' },

  listingsContainer: { marginBottom: 16 },
  listingCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  listingGradient: { padding: 20, borderRadius: 16 },

  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cropName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  activeBadge: {
    backgroundColor: 'rgba(76,175,80,0.2)',
  },
  closedBadge: {
    backgroundColor: 'rgba(244,67,54,0.2)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#e8f5e9',
  },

  farmerName: { fontSize: 16, color: '#a5d6a7', marginBottom: 8, marginTop: 2 },
  detailVal: { fontSize: 14, color: '#ffffff', marginBottom: 2 },
});
