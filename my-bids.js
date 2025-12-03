// app/buyer/my-bids.js

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth } from 'firebase/auth';
import { firestore } from '../../config/firebase';
import {
  collection,
  where,
  query,
  orderBy,
  getDocs,
  limit,
} from 'firebase/firestore';

export default function MyBidsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bids, setBids] = useState([]);
  const [hasUser, setHasUser] = useState(true);

  useEffect(() => {
    const fetchMyBids = async () => {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        setHasUser(false);
        setLoading(false);
        return;
      }

      try {
        const listingsRef = collection(firestore, 'listings');
        const listingsSnap = await getDocs(listingsRef);

        const results = [];

        for (const listingDoc of listingsSnap.docs) {
          const listingData = listingDoc.data();
          const listingId = listingDoc.id;

          const listingBidsRef = collection(
            firestore,
            'listings',
            listingId,
            'bids'
          );

          // All bids for this listing from this buyer
          const myBidQ = query(
            listingBidsRef,
            where('bidderUid', '==', user.uid)
          );
          const myBidSnap = await getDocs(myBidQ);

          if (myBidSnap.empty) continue;

          // Find buyer’s highest bid in JS (no composite index)
          let userBid = null;
          myBidSnap.forEach((d) => {
            const data = d.data();
            if (
              !userBid ||
              Number(data.bidAmount) > Number(userBid.bidAmount)
            ) {
              userBid = data;
            }
          });
          if (!userBid) continue;

          // Highest bid overall for this listing
          const topQ = query(
            listingBidsRef,
            orderBy('bidAmount', 'desc'),
            limit(1)
          );
          const topSnap = await getDocs(topQ);

          let highestBidAmount = null;
          let highestBidderUid = null;
          if (!topSnap.empty) {
            const top = topSnap.docs[0].data();
            highestBidAmount = Number(top.bidAmount) || 0;
            highestBidderUid = top.bidderUid;
          }

          const isHighest = highestBidderUid === user.uid;
          const statusField = listingData.status || 'open';

          let status = 'active';
          if (statusField === 'closed') {
            status = isHighest ? 'won' : 'outbid';
          }

          const endsText = listingData.endsAt
            ? `Ends: ${new Date(
                listingData.endsAt.toDate
                  ? listingData.endsAt.toDate()
                  : listingData.endsAt
              ).toLocaleDateString()}`
            : 'Ends: —';

          results.push({
            id: listingId,
            cropType: listingData.cropType || 'Crop',
            variety: listingData.variety || '',
            quantity: listingData.quantity || '—',
            farmerName: listingData.farmerName || 'Unknown farmer',
            yourBid: Number(userBid.bidAmount) || 0,
            highestBid: highestBidAmount,
            status,
            isHighest,
            endsText,
          });
        }

        setBids(results);
      } catch (err) {
        console.error('Error loading buyer bids:', err);
        setBids([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMyBids();
  }, []);

  const getStatusStyles = (status) => {
    if (status === 'won') {
      return {
        badge: styles.wonBadge,
        text: styles.wonStatusText,
        label: 'WON',
      };
    }
    if (status === 'outbid') {
      return {
        badge: styles.outbidBadge,
        text: styles.outbidStatusText,
        label: 'OUTBID',
      };
    }
    // active
    return {
      badge: styles.activeBadge,
      text: styles.activeStatusText,
      label: 'ACTIVE',
    };
  };

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

  if (!hasUser) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: 'center', alignItems: 'center', padding: 16 },
        ]}
      >
        <Text style={{ fontSize: 16, color: '#1a331a', textAlign: 'center' }}>
          Please sign in to see your bids.
        </Text>
      </View>
    );
  }

  const hasBids = bids.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* SAME STRUCTURE AS FARMER /listings */}
        <Text style={styles.title}>My Bids</Text>
        <Text style={styles.subtitle}>
          Manage your bids and review results
        </Text>

        {hasBids ? (
          bids.map((bid) => {
            const statusStyles = getStatusStyles(bid.status);
            const isActive = bid.status === 'active';

            const secondaryLine = `100 – Your bid: ₱${bid.yourBid.toLocaleString()}`.replace(
              '100',
              String(bid.quantity)
            );

            let statusDescription = '';
            if (bid.status === 'won') statusDescription = '✓ You won this listing';
            else if (bid.status === 'outbid')
              statusDescription = '✓ You were outbid';
            else if (bid.isHighest)
              statusDescription = '✓ You are currently the highest bidder';
            else statusDescription = '✓ You are not the highest bid yet';

            return (
              <View key={bid.id} style={styles.listingCard}>
                <LinearGradient
                  colors={['#1a331a', '#2d4d2d']}
                  style={styles.listingGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {/* Header: crop & status badge (same layout) */}
                  <View style={styles.listingHeader}>
                    <Text style={styles.cropName}>
                      {bid.cropType} – {bid.variety}
                    </Text>
                    <View style={[styles.statusBadge, statusStyles.badge]}>
                      <Text style={[styles.statusText, statusStyles.text]}>
                        {statusStyles.label}
                      </Text>
                    </View>
                  </View>

                  {/* Second line like farmer: quantity + minimum, but for buyer */}
                  <Text style={styles.quantity}>{secondaryLine}</Text>

                  {/* Lines with ticks, similar to farmer layout */}
                  <Text style={styles.infoLine}>
                    ✓ Current Highest: ₱
                    {bid.highestBid != null
                      ? bid.highestBid.toLocaleString()
                      : '0'}
                  </Text>
                  <Text style={styles.infoLine}>{statusDescription}</Text>

                  {/* Footer row: Ends + button (same layout idea) */}
                  <View style={styles.listingFooter}>
                    <Text style={styles.endDate}>✓ {bid.endsText}</Text>

                    <TouchableOpacity
                      style={styles.viewBidsButton}
                      onPress={() =>
                        router.push(`/buyer/listing-detail/${bid.id}`)
                      }
                    >
                      <Text style={styles.viewBidsText}>
                        {isActive
                          ? 'Increase Bid'
                          : bid.status === 'won'
                          ? 'View Listing'
                          : 'Bid Again'}
                      </Text>
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
            <Text style={styles.emptyTitle}>No bids yet</Text>
            <Text style={styles.emptyText}>
              Browse listings and place your first bid. Your bids will be listed
              here with their status.
            </Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => router.push('/buyer/browse-listings')}
            >
              <LinearGradient
                colors={['#4caf50', '#2e7d32']}
                style={styles.browseButtonGradient}
              >
                <Text style={styles.browseButtonText}>Browse Listings</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { flex: 1, padding: 16 },

  // same top text layout as farmer/listings
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a331a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#4caf50',
    marginBottom: 24,
  },

  // cards (copied style from farmer/listings)
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
  wonBadge: { backgroundColor: 'rgba(33,150,243,0.2)' },
  outbidBadge: { backgroundColor: 'rgba(244,67,54,0.2)' },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  activeStatusText: { color: '#4caf50' },
  wonStatusText: { color: '#2196f3' },
  outbidStatusText: { color: '#f44336' },

  quantity: { fontSize: 14, color: '#a5d6a7', marginBottom: 8 },
  infoLine: {
    fontSize: 14,
    color: '#81c784',
    marginBottom: 4,
  },

  listingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
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

  // empty state – same style as farmer/listings emptyState
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
    marginBottom: 16,
  },
  browseButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  browseButtonGradient: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  browseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
