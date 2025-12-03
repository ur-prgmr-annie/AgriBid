// app/farmer/listings.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, firestore } from '../../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function ListingsScreen() {
  const router = useRouter();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setLoading(true);

        if (!user) {
          setListings([]);
          return;
        }

        const uid = user.uid;

        const listingsRef = collection(firestore, 'listings');
        const q = query(listingsRef, where('farmerUid', '==', uid));
        const snapshot = await getDocs(q);

        const data = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const listingData = docSnap.data();
            const listingId = docSnap.id;

            const bidsRef = collection(
              firestore,
              'listings',
              listingId,
              'bids'
            );
            const bidsSnap = await getDocs(bidsRef);
            const bids = bidsSnap.docs.map((bidDoc) => ({
              id: bidDoc.id,
              ...bidDoc.data(),
            }));

            return {
              id: listingId,
              ...listingData,
              bids,
              bidCount: bids.length,
              highestBid:
                bids.length > 0
                  ? Math.max(...bids.map((b) => Number(b.bidAmount) || 0))
                  : null,
            };
          })
        );

        setListings(data);
      } catch (err) {
        console.error('Error fetching farmer listings:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

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

  const hasListings = listings.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>My Listings</Text>
        <Text style={styles.subtitle}>
          Manage your crop listings and review bids
        </Text>

        {hasListings ? (
          listings.map((listing) => {
            const isActive =
              listing.status === 'active' ||
              listing.status === 'open' ||
              !listing.status;

            return (
              <View key={listing.id} style={styles.listingCard}>
                <LinearGradient
                  colors={['#1a331a', '#2d4d2d']}
                  style={styles.listingGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {/* Listing image */}
                  {listing.imageUrl && (
                    <View style={styles.imageWrapper}>
                      <Image
                        source={{ uri: listing.imageUrl }}
                        style={styles.listingImage}
                        resizeMode="cover"
                      />
                    </View>
                  )}

                  <View style={styles.listingHeader}>
                    <Text style={styles.cropName}>
                      {listing.cropType} – {listing.variety}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isActive ? styles.activeBadge : styles.closedBadge,
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {isActive ? 'ACTIVE' : 'CLOSED'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.quantity}>
                    {listing.quantity} – Minimum: ₱{listing.minimumPrice}
                  </Text>

                  {listing.highestBid != null && (
                    <View style={styles.bidInfo}>
                      <Text style={styles.highestBid}>
                        ✓ Highest Bid: ₱{listing.highestBid}
                      </Text>
                      <Text style={styles.bidCount}>
                        ✓ {listing.bidCount} bids
                      </Text>
                    </View>
                  )}

                  <View style={styles.listingFooter}>
                    <Text style={styles.endDate}>
                      ✓ Ends: {listing.endDate || '—'}
                    </Text>

                    <TouchableOpacity
                      style={styles.viewBidsButton}
                      onPress={() =>
                        router.push(`/farmer/view-bids/${listing.id}`)
                      }
                    >
                      <Text style={styles.viewBidsText}>View Bids</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            );
          })
        ) : (
          <LinearGradient
            colors={['#1a331a', '#2d4d2d']}
            style={styles.emptyState}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.emptyTitle}>No listings yet</Text>
            <Text style={styles.emptyText}>
              Post your first crop listing so buyers can start placing bids.
            </Text>
          </LinearGradient>
        )}

        <TouchableOpacity
          style={styles.createListingButton}
          onPress={() => router.push('/farmer/create-listings')}
        >
          <LinearGradient
            colors={['#4caf50', '#2e7d32']}
            style={styles.createListingGradient}
          >
            <Text style={styles.createListingText}>+ Post New Listing</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a331a', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#4caf50', marginBottom: 24 },

  listingCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  listingGradient: { padding: 20, borderRadius: 16 },

  imageWrapper: {
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  listingImage: {
    width: '100%',
    height: '100%',
  },

  listingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cropName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  activeBadge: { backgroundColor: 'rgba(76,175,80,0.2)' },
  closedBadge: { backgroundColor: 'rgba(244,67,54,0.2)' },
  statusText: { fontSize: 10, fontWeight: 'bold', color: '#4caf50' },

  quantity: { fontSize: 14, color: '#a5d6a7', marginBottom: 8 },
  bidInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  highestBid: { fontSize: 14, color: '#4caf50', fontWeight: '500' },
  bidCount: { fontSize: 14, color: '#81c784' },

  listingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  endDate: { fontSize: 14, color: '#a5d6a7' },
  viewBidsButton: {
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.3)',
  },
  viewBidsText: { color: '#4caf50', fontSize: 12, fontWeight: '600' },

  createListingButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createListingGradient: { padding: 16, borderRadius: 12, alignItems: 'center' },
  createListingText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  emptyState: {
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#a5d6a7',
  },
});
