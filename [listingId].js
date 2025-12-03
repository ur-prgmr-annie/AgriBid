// app/farmer/view-bids/[listingId].js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { firestore } from '../../../config/firebase';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export default function ViewBidsScreen() {
  const { listingId } = useLocalSearchParams();
  const [listing, setListing] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [savingBidId, setSavingBidId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!listingId) {
          throw new Error('Listing ID missing');
        }

        const listingRef = doc(firestore, 'listings', String(listingId));
        const listingSnap = await getDoc(listingRef);
        if (!listingSnap.exists()) {
          throw new Error('Listing not found');
        }
        const listingData = { id: listingSnap.id, ...listingSnap.data() };
        setListing(listingData);

        const bidsRef = collection(
          firestore,
          'listings',
          String(listingId),
          'bids'
        );
        const qBids = query(bidsRef, orderBy('bidAmount', 'desc'));
        const bidsSnap = await getDocs(qBids);

        const bidsData = await Promise.all(
          bidsSnap.docs.map(async (d) => {
            const data = d.data();
            const bidderUid = data.bidderUid;
            let bidderName = data.bidderName || 'Unknown bidder';

            try {
              const profileRef = doc(firestore, 'profiles', bidderUid);
              const profileSnap = await getDoc(profileRef);
              if (profileSnap.exists()) {
                const p = profileSnap.data();
                bidderName = p.fullName || p.name || bidderName;
              }
            } catch (e) {
              console.warn('Error loading bidder profile for', bidderUid, e);
            }

            return {
              id: d.id,
              ...data,
              bidderName,
            };
          })
        );

        setBids(bidsData);
      } catch (err) {
        console.error('Error fetching bids:', err);
        setErrorText(err.message || 'Failed to load bids.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [listingId]);

  const handleAcceptBid = async (bid) => {
    if (!listing) return;

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Error', 'You must be signed in.');
      return;
    }

    if (user.uid !== listing.farmerUid) {
      Alert.alert('Error', 'Only the owner of this listing can accept a bid.');
      return;
    }

    if (listing.status === 'closed') {
      Alert.alert('Info', 'This listing is already closed.');
      return;
    }

    setSavingBidId(bid.id);

    try {
      const listingRef = doc(firestore, 'listings', listing.id);
      const nowTs = serverTimestamp();

      await updateDoc(listingRef, {
        status: 'closed',
        winningBidId: bid.id,
        winningBidAmount: bid.bidAmount,
        winningBidderUid: bid.bidderUid,
        closedAt: nowTs,
      });

      setListing((prev) =>
        prev
          ? {
              ...prev,
              status: 'closed',
              winningBidId: bid.id,
              winningBidAmount: bid.bidAmount,
              winningBidderUid: bid.bidderUid,
            }
          : prev
      );

      const listingTitle = listing.cropType || 'Crop';
      const listingVariety = listing.variety || '';
      const fullTitle = listingVariety
        ? `${listingTitle} / ${listingVariety}`
        : listingTitle;

      const txRef = await addDoc(collection(firestore, 'transactions'), {
        listingId: listing.id,
        listingTitle: fullTitle,
        farmerUid: listing.farmerUid,
        farmerName:
          listing.farmerName || user.displayName || user.email || 'Farmer',
        buyerUid: bid.bidderUid,
        buyerName: bid.bidderName || 'Buyer',
        status: 'open',
        createdAt: nowTs,
        updatedAt: nowTs,
      });

      await addDoc(collection(firestore, 'notifications'), {
        userUid: bid.bidderUid,
        fromUid: listing.farmerUid,
        type: 'transaction',
        category: 'transaction',
        title: 'You won the bid!',
        message: `Your bid of ₱${Number(
          bid.bidAmount
        ).toLocaleString()} on ${fullTitle} was accepted.`,
        transactionId: txRef.id,
        listingId: listing.id,
        unread: true,
        createdAt: nowTs,
      });

      await addDoc(collection(firestore, 'notifications'), {
        userUid: listing.farmerUid,
        fromUid: listing.farmerUid,
        type: 'transaction',
        category: 'transaction',
        title: 'Transaction created',
        message: `You selected a winning bid of ₱${Number(
          bid.bidAmount
        ).toLocaleString()} for ${fullTitle}.`,
        transactionId: txRef.id,
        listingId: listing.id,
        unread: true,
        createdAt: nowTs,
      });

      Alert.alert(
        'Success',
        'Winning bid has been selected. A transaction and notifications have been created.'
      );
    } catch (err) {
      console.error('Error accepting bid:', err);
      Alert.alert('Error', err.message || 'Failed to accept bid.');
    } finally {
      setSavingBidId(null);
    }
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

  if (errorText) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: 'center', alignItems: 'center', padding: 16 },
        ]}
      >
        <Text>{errorText}</Text>
      </View>
    );
  }

  const isClosed = listing?.status === 'closed';
  const winnerBidId = listing?.winningBidId;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Listing summary */}
        <LinearGradient
          colors={['#1a331a', '#2d4d2d']}
          style={styles.headerCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* listing image */}
          {listing?.imageUrl && (
            <View style={styles.headerImageWrapper}>
              <Image
                source={{ uri: listing.imageUrl }}
                style={styles.headerImage}
                resizeMode="cover"
              />
            </View>
          )}

          <View style={styles.headerTopRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.title}>
                {listing?.cropType} / {listing?.variety}
              </Text>
              <Text style={styles.subtitle}>
                Minimum Price: ₱{listing?.minimumPrice}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                isClosed ? styles.statusClosed : styles.statusOpen,
              ]}
            >
              <Text style={styles.statusPillText}>
                {isClosed ? 'CLOSED' : 'OPEN'}
              </Text>
            </View>
          </View>

          {isClosed && listing?.winningBidAmount != null && (
            <View style={styles.winnerInfo}>
              <Text style={styles.winnerLabel}>Winning Bid</Text>
              <Text style={styles.winnerAmount}>
                ₱{listing.winningBidAmount}
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Bids list */}
        {bids.length === 0 ? (
          <Text style={styles.noBidsText}>No bids yet.</Text>
        ) : (
          bids.map((bid) => {
            const isWinner = winnerBidId === bid.id;
            const isSaving = savingBidId === bid.id;

            return (
              <View key={bid.id} style={styles.bidCardWrapper}>
                <LinearGradient
                  colors={
                    isWinner ? ['#2e7d32', '#1b5e20'] : ['#1a331a', '#2d4d2d']
                  }
                  style={styles.bidCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.bidHeader}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.bidderName}>{bid.bidderName}</Text>
                      <Text style={styles.bidderUid}>
                        ID: {bid.bidderUid}
                      </Text>
                    </View>
                    <Text style={styles.bidAmount}>
                      ₱{Number(bid.bidAmount).toLocaleString()}
                    </Text>
                  </View>

                  <Text style={styles.bidTime}>
                    {bid.createdAt?.toDate
                      ? bid.createdAt.toDate().toLocaleString()
                      : ''}
                  </Text>

                  <View style={styles.bidFooter}>
                    {isWinner && (
                      <View style={styles.winnerBadge}>
                        <Text style={styles.winnerBadgeText}>WINNER</Text>
                      </View>
                    )}

                    {!isClosed && !isWinner && (
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleAcceptBid(bid)}
                        disabled={isSaving}
                      >
                        <Text style={styles.acceptButtonText}>
                          {isSaving ? 'Saving...' : 'Accept as Winner'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </LinearGradient>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16 },

  headerCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  headerImageWrapper: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: { fontSize: 14, color: '#e8f5e9' },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusOpen: { backgroundColor: 'rgba(76,175,80,0.2)' },
  statusClosed: { backgroundColor: 'rgba(244,67,54,0.2)' },
  statusPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  winnerInfo: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 8,
  },
  winnerLabel: { fontSize: 12, color: '#c8e6c9' },
  winnerAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  noBidsText: {
    fontSize: 16,
    color: '#a5d6a7',
    textAlign: 'center',
    marginTop: 32,
  },

  bidCardWrapper: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  bidCard: {
    padding: 16,
    borderRadius: 16,
  },

  bidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bidderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  bidderUid: {
    fontSize: 12,
    color: '#c8e6c9',
  },
  bidAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  bidTime: {
    fontSize: 12,
    color: '#c8e6c9',
    marginBottom: 8,
  },

  bidFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  winnerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  winnerBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  acceptButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(76,175,80,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.4)',
  },
  acceptButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c8e6c9',
  },
});
