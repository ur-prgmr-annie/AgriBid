// app/buyer/overview.js  (BuyerOverview)

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { auth, firestore } from '../../config/firebase';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function BuyerOverview() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 768;

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Buyer');
  const [stats, setStats] = useState({
    activeBids: 0,
    wonBids: 0,
    totalSpent: 0,
    pendingDelivery: 0,
    totalBids: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0); // NEW: unread notifications

  const trendingCrops = [
    { name: 'Premium Rice', status: 'High demand', change: '+15%' },
    { name: 'Yellow Corn', status: 'Price rising', change: '+8%' },
    { name: 'Vegetables', status: 'Best value', change: '+5%' },
  ];

  // Responsive font sizes
  const responsiveFonts = {
    headerTitle: isSmallScreen ? 24 : isLargeScreen ? 32 : 28,
    userName: isSmallScreen ? 22 : isLargeScreen ? 30 : 28,
    sectionTitle: isSmallScreen ? 18 : isLargeScreen ? 22 : 20,
    statValue: isSmallScreen ? 20 : isLargeScreen ? 26 : 24,
    welcomeText: isSmallScreen ? 14 : 16,
    quickStatValue: isSmallScreen ? 16 : 18,
  };

  // Responsive spacing
  const responsiveSpacing = {
    containerPadding: isSmallScreen ? 12 : isLargeScreen ? 24 : 16,
    sectionMargin: isSmallScreen ? 12 : isLargeScreen ? 24 : 20,
    cardPadding: isSmallScreen ? 16 : isLargeScreen ? 24 : 20,
    itemPadding: isSmallScreen ? 12 : 16,
  };

  const styles = createStyles(
    responsiveFonts,
    responsiveSpacing,
    width,
    isSmallScreen,
    isLargeScreen
  );

  // ====== LOAD BUYER NAME + ACTIVITY FROM FIRESTORE ======
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        setLoading(true);

        if (!user) {
          setUserName('Buyer');
          setStats({
            activeBids: 0,
            wonBids: 0,
            totalSpent: 0,
            pendingDelivery: 0,
            totalBids: 0,
          });
          setRecentActivity([]);
          setUnreadCount(0);
          return;
        }

        const uid = user.uid;

        // ---- Get name from profile in Firestore ----
        let resolvedName =
          user.displayName ||
          (user.email ? user.email.split('@')[0] : 'Buyer');

        try {
          const profileRef = doc(firestore, 'profiles', uid);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const data = profileSnap.data();
            resolvedName = data.fullName || data.name || resolvedName;
          }
        } catch (e) {
          console.warn('Error fetching buyer profile name:', e);
        }
        setUserName(resolvedName);
        // ---------------------------------------------

        // ---- Unread notifications count ----
        try {
          const notifRef = collection(firestore, 'notifications');
          const notifQ = query(
            notifRef,
            where('userUid', '==', uid),
            where('unread', '==', true)
          );
          const notifSnap = await getDocs(notifQ);
          setUnreadCount(notifSnap.size);
        } catch (e) {
          console.warn('Error fetching unread notifications:', e);
          setUnreadCount(0);
        }

        // ===== NO collectionGroup, per-listing queries =====
        const listingsRef = collection(firestore, 'listings');
        const listingsSnap = await getDocs(listingsRef);

        let activeBids = 0;
        let wonBids = 0;
        let totalSpent = 0;
        let pendingDelivery = 0;
        let totalBids = 0;

        const events = [];
        const now = new Date();

        for (const listingDoc of listingsSnap.docs) {
          const listingData = listingDoc.data();
          const listingId = listingDoc.id;

          // bids subcollection for this listing, only this buyer
          const listingBidsRef = collection(
            firestore,
            'listings',
            listingId,
            'bids'
          );
          const myBidQ = query(
            listingBidsRef,
            where('bidderUid', '==', uid)
          );
          const myBidSnap = await getDocs(myBidQ);

          if (myBidSnap.empty) continue; // buyer never bid here

          const bids = myBidSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          const status = listingData.status || 'open';
          const cropTitle = listingData.cropType || 'Crop';
          const variety = listingData.variety || '';

          const winningBidAmount = Number(
            listingData.winningBidAmount || 0
          );
          const winningBidderUid = listingData.winningBidderUid;
          const winningBidId = listingData.winningBidId;

          // every bid the buyer placed on this listing
          bids.forEach((bid) => {
            totalBids += 1;

            let createdAt = now;
            if (bid.createdAt?.toDate) {
              createdAt = bid.createdAt.toDate();
            }
            const amount = Number(bid.bidAmount || 0);

            if (status !== 'closed') {
              activeBids += 1;
            }

            events.push({
              type: 'bid',
              title: cropTitle,
              subtitle: variety,
              amount,
              createdAt,
            });
          });

          // did the buyer win this listing?
          const buyerWon =
            (winningBidderUid && winningBidderUid === uid) ||
            (winningBidId && bids.some((b) => b.id === winningBidId));

          if (status === 'closed' && buyerWon && winningBidAmount > 0) {
            wonBids += 1;
            totalSpent += winningBidAmount;

            const deliveryStatus = listingData.deliveryStatus || 'pending';
            if (
              deliveryStatus === 'pending' ||
              deliveryStatus === 'processing' ||
              deliveryStatus === 'in_transit'
            ) {
              pendingDelivery += 1;
            }

            let winningDate = now;
            if (listingData.winningAt?.toDate) {
              winningDate = listingData.winningAt.toDate();
            }

            events.push({
              type: 'won',
              title: cropTitle,
              subtitle: variety,
              amount: winningBidAmount,
              createdAt: winningDate,
            });
          }
        }

        // Sort events by newest first and keep latest 5
        events.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        const latestEvents = events.slice(0, 5);

        setStats({
          activeBids,
          wonBids,
          totalSpent,
          pendingDelivery,
          totalBids,
        });
        setRecentActivity(latestEvents);
      } catch (err) {
        console.error('Error loading buyer dashboard:', err);
        setStats({
          activeBids: 0,
          wonBids: 0,
          totalSpent: 0,
          pendingDelivery: 0,
          totalBids: 0,
        });
        setRecentActivity([]);
        setUnreadCount(0);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // Derived numbers for header quick stats
  const successRate = stats.totalBids
    ? Math.min(
        100,
        Math.round((stats.wonBids / Math.max(stats.totalBids, 1)) * 100)
      )
    : 0;

  const avgWonBid = stats.wonBids
    ? Math.round(stats.totalSpent / stats.wonBids)
    : 0;

  const statsCards = [
    { label: 'Active Bids', value: String(stats.activeBids), trend: '' },
    { label: 'Won Bids', value: String(stats.wonBids), trend: '' },
    {
      label: 'Total Spent',
      value: `₱${stats.totalSpent.toLocaleString()}`,
      trend: '',
    },
    {
      label: 'Pending Delivery',
      value: String(stats.pendingDelivery),
      trend: '',
    },
  ];

  return (
    <View style={styles.container}>
      {loading ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#ffffff',
          }}
        >
          <ActivityIndicator size="large" color="#4caf50" />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header with Logo */}
          <LinearGradient
            colors={['#1a331a', '#2d4d2d']}
            style={styles.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerTop}>
              <View style={styles.logoContainer}>
                <View style={styles.logoPlaceholder}>
                  <Image
                    source={require('../../assets/logo.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
              </View>

              {/* Notification bell + badge */}
              <TouchableOpacity
                style={styles.notificationIconWrapper}
                onPress={() => router.push('/buyer/notifications')}
                activeOpacity={0.8}
              >
                <Text style={styles.notificationEmoji}>🔔</Text>
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationText}>
                      {unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.headerSubtitle}>
                Discover and bid on agricultural products
              </Text>
            </View>

            {/* Quick Stats */}
            <View style={styles.quickStats}>
              <View style={styles.quickStat}>
                <Text style={styles.quickStatValue}>{successRate}%</Text>
                <Text style={styles.quickStatLabel}>Success Rate</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStat}>
                <Text style={styles.quickStatValue}>
                  ₱{avgWonBid.toLocaleString()}
                </Text>
                <Text style={styles.quickStatLabel}>Avg. Won Bid</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {statsCards.map((stat) => (
              <LinearGradient
                key={stat.label}
                colors={['#1a331a', '#2d4d2d']}
                style={styles.statCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.statHeader}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  {stat.trend ? (
                    <View style={styles.trendBadge}>
                      <Text style={styles.trendText}>{stat.trend}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
              </LinearGradient>
            ))}
          </View>

          {/* Quick Actions */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <View className="actionsGrid" style={styles.actionsGrid}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/buyer/browse-listings')}
              >
                <View style={[styles.actionIcon, styles.primaryIcon]}>
                  <Text style={styles.actionEmoji}>🔍</Text>
                </View>
                <Text style={styles.actionText}>Browse Listings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/buyer/my-bids')}
              >
                <View style={[styles.actionIcon, styles.secondaryIcon]}>
                  <Text style={styles.actionEmoji}>🏷️</Text>
                </View>
                <Text style={styles.actionText}>My Bids</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/buyer/analytics')}
              >
                <View style={[styles.actionIcon, styles.tertiaryIcon]}>
                  <Text style={styles.actionEmoji}>📊</Text>
                </View>
                <Text style={styles.actionText}>Analytics</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/buyer/notifications')}
              >
                <View style={[styles.actionIcon, styles.quaternaryIcon]}>
                  <Text style={styles.actionEmoji}>🔔</Text>
                </View>
                <Text style={styles.actionText}>Alerts</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recent Activity */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              
            </View>

            {recentActivity.length === 0 ? (
              <Text style={{ color: '#777', fontSize: 13 }}>
                No activity yet. Start bidding on crops to see your history
                here.
              </Text>
            ) : (
              recentActivity.map((act, index) => {
                const isWon = act.type === 'won';
                const icon = isWon ? '✅' : '📦';
                const typeLabel = isWon ? 'Bid won' : 'Bid placed';
                const timeText = act.createdAt.toLocaleString();
                const cropLabel = `${act.title}${
                  act.subtitle ? ' – ' + act.subtitle : ''
                }`;

                return (
                  <View key={index} style={styles.activityItem}>
                    <View style={styles.activityIcon}>
                      <Text style={styles.activityEmoji}>{icon}</Text>
                    </View>
                    <View style={styles.activityContent}>
                      <View style={styles.activityHeader}>
                        <Text style={styles.activityType}>{typeLabel}</Text>
                        <Text style={styles.activityAmount}>
                          ₱{act.amount.toLocaleString()}
                        </Text>
                      </View>
                      <Text style={styles.activityCrop}>{cropLabel}</Text>
                      <Text style={styles.activityTime}>{timeText}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Trending Crops (static) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Trending Crops</Text>
              
            </View>
            {trendingCrops.map((crop, index) => (
              <View key={index} style={styles.trendingItem}>
                <View style={styles.trendingContent}>
                  <View style={styles.trendingInfo}>
                    <Text style={styles.trendingName}>{crop.name}</Text>
                    <View style={styles.trendingStats}>
                      <Text style={styles.trendingStatus}>{crop.status}</Text>
                      <Text style={styles.trendingChange}>{crop.change}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.viewButton}>
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${70 - index * 20}%` },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (
  fonts,
  spacing,
  screenWidth,
  isSmallScreen,
  isLargeScreen
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#ffffff',
    },
    content: {
      flex: 1,
    },
    header: {
      padding: spacing.cardPadding,
      paddingTop: isSmallScreen ? 40 : isLargeScreen ? 60 : 50,
      borderBottomLeftRadius: isLargeScreen ? 40 : 30,
      borderBottomRightRadius: isLargeScreen ? 40 : 30,
      marginBottom: spacing.sectionMargin,
      shadowColor: '#2e7d32',
      shadowOffset: {
        width: 0,
        height: isSmallScreen ? 4 : 10,
      },
      shadowOpacity: 0.3,
      shadowRadius: isSmallScreen ? 8 : 20,
      elevation: isSmallScreen ? 6 : 15,
    },

    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isSmallScreen ? 16 : 20,
    },
    logoContainer: {
      alignItems: 'center',
    },
    logoPlaceholder: {
      width: isSmallScreen ? 50 : isLargeScreen ? 70 : 60,
      height: isSmallScreen ? 50 : isLargeScreen ? 70 : 60,
      borderRadius: isSmallScreen ? 15 : 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      shadowColor: '#4caf50',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.6,
      shadowRadius: 15,
      elevation: 8,
      overflow: 'hidden',
    },
    logoImage: {
      width: '100%',
      height: '100%',
    },

    // NEW notification styles
    notificationIconWrapper: {
      width: isSmallScreen ? 34 : 38,
      height: isSmallScreen ? 34 : 38,
      borderRadius: isSmallScreen ? 17 : 19,
      backgroundColor: 'rgba(0,0,0,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    notificationEmoji: {
      fontSize: isSmallScreen ? 18 : 20,
    },
    notificationBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: '#e74c3c',
      minWidth: isSmallScreen ? 16 : 18,
      height: isSmallScreen ? 16 : 18,
      borderRadius: isSmallScreen ? 8 : 9,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 3,
    },
    notificationText: {
      color: '#ffffff',
      fontSize: isSmallScreen ? 9 : 10,
      fontWeight: 'bold',
    },

    welcomeSection: {
      alignItems: 'center',
      marginBottom: isSmallScreen ? 16 : 20,
    },
    welcomeText: {
      fontSize: fonts.welcomeText,
      color: '#a5d6a7',
      marginBottom: 4,
      fontWeight: '500',
    },
    userName: {
      fontSize: fonts.userName,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: isSmallScreen ? 6 : 8,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: isSmallScreen ? 12 : 14,
      color: '#e8f5e9',
      textAlign: 'center',
      lineHeight: isSmallScreen ? 16 : 20,
    },
    quickStats: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: isSmallScreen ? 15 : 20,
      padding: isSmallScreen ? 12 : 16,
    },
    quickStat: {
      alignItems: 'center',
      flex: 1,
    },
    quickStatDivider: {
      width: 1,
      height: isSmallScreen ? 25 : 30,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    quickStatValue: {
      fontSize: fonts.quickStatValue,
      fontWeight: 'bold',
      color: '#4caf50',
      marginBottom: 4,
    },
    quickStatLabel: {
      fontSize: isSmallScreen ? 10 : 12,
      color: '#e8f5e9',
      fontWeight: '500',
      textAlign: 'center',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.containerPadding,
      marginBottom: spacing.sectionMargin,
    },
    statCard: {
      width: isSmallScreen
        ? (screenWidth - 48) / 2
        : isLargeScreen
        ? (screenWidth - 80) / 2
        : (screenWidth - 60) / 2,
      padding: isSmallScreen ? 12 : 16,
      borderRadius: isSmallScreen ? 15 : 20,
      marginBottom: isSmallScreen ? 10 : 15,
      shadowColor: '#2e7d32',
      shadowOffset: {
        width: 0,
        height: isSmallScreen ? 3 : 6,
      },
      shadowOpacity: 0.3,
      shadowRadius: isSmallScreen ? 8 : 15,
      elevation: isSmallScreen ? 4 : 8,
    },
    statHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isSmallScreen ? 6 : 10,
    },
    statLabel: {
      fontSize: isSmallScreen ? 10 : 12,
      color: '#e8f5e9',
      fontWeight: '600',
      textAlign: 'left',
      flex: 1,
    },
    trendBadge: {
      backgroundColor: 'rgba(76, 175, 80, 0.3)',
      paddingHorizontal: isSmallScreen ? 6 : 8,
      paddingVertical: isSmallScreen ? 2 : 4,
      borderRadius: isSmallScreen ? 10 : 12,
    },
    trendText: {
      color: '#4caf50',
      fontSize: isSmallScreen ? 8 : 10,
      fontWeight: 'bold',
    },
    statValue: {
      fontSize: fonts.statValue,
      fontWeight: 'bold',
      color: '#ffffff',
    },
    sectionCard: {
      backgroundColor: '#ffffff',
      marginHorizontal: spacing.containerPadding,
      padding: spacing.cardPadding,
      borderRadius: isSmallScreen ? 15 : 20,
      marginBottom: spacing.sectionMargin,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: isSmallScreen ? 2 : 4,
      },
      shadowOpacity: 0.1,
      shadowRadius: isSmallScreen ? 6 : 12,
      elevation: isSmallScreen ? 3 : 6,
      borderWidth: 1,
      borderColor: '#f0f0f0',
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isSmallScreen ? 16 : 20,
    },
    sectionTitle: {
      fontSize: fonts.sectionTitle,
      fontWeight: 'bold',
      color: '#1a331a',
    },
    seeAllText: {
      fontSize: isSmallScreen ? 12 : 14,
      color: '#4caf50',
      fontWeight: '600',
    },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: isSmallScreen ? 10 : 15,
    },
    actionButton: {
      width: isSmallScreen
        ? (screenWidth - 80) / 2
        : isLargeScreen
        ? (screenWidth - 120) / 2
        : (screenWidth - 100) / 2,
      alignItems: 'center',
      padding: isSmallScreen ? 12 : 15,
    },
    actionIcon: {
      width: isSmallScreen ? 50 : isLargeScreen ? 70 : 60,
      height: isSmallScreen ? 50 : isLargeScreen ? 70 : 60,
      borderRadius: isSmallScreen ? 15 : 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: isSmallScreen ? 8 : 10,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: isSmallScreen ? 2 : 4,
      },
      shadowOpacity: 0.1,
      shadowRadius: isSmallScreen ? 4 : 8,
      elevation: isSmallScreen ? 2 : 4,
    },
    primaryIcon: {
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      borderWidth: 2,
      borderColor: 'rgba(76, 175, 80, 0.3)',
    },
    secondaryIcon: {
      backgroundColor: 'rgba(33, 150, 243, 0.1)',
      borderWidth: 2,
      borderColor: 'rgba(33, 150, 243, 0.3)',
    },
    tertiaryIcon: {
      backgroundColor: 'rgba(156, 39, 176, 0.1)',
      borderWidth: 2,
      borderColor: 'rgba(156, 39, 176, 0.3)',
    },
    quaternaryIcon: {
      backgroundColor: 'rgba(255, 152, 0, 0.1)',
      borderWidth: 2,
      borderColor: 'rgba(255, 152, 0, 0.3)',
    },
    actionEmoji: {
      fontSize: isSmallScreen ? 20 : 24,
    },
    actionText: {
      fontSize: isSmallScreen ? 11 : 13,
      color: '#1a331a',
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: isSmallScreen ? 14 : 16,
    },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: spacing.itemPadding,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    activityIcon: {
      width: isSmallScreen ? 35 : 40,
      height: isSmallScreen ? 35 : 40,
      borderRadius: isSmallScreen ? 10 : 12,
      backgroundColor: '#f8f9fa',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: isSmallScreen ? 12 : 15,
    },
    activityEmoji: {
      fontSize: isSmallScreen ? 16 : 18,
    },
    activityContent: {
      flex: 1,
    },
    activityHeader: {
      flexDirection: isSmallScreen ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: isSmallScreen ? 'flex-start' : 'flex-start',
      marginBottom: 4,
    },
    activityType: {
      fontSize: isSmallScreen ? 12 : 14,
      color: '#4caf50',
      fontWeight: '600',
      marginBottom: isSmallScreen ? 2 : 0,
    },
    activityAmount: {
      fontSize: isSmallScreen ? 14 : 16,
      color: '#2e7d32',
      fontWeight: 'bold',
    },
    activityCrop: {
      fontSize: isSmallScreen ? 14 : 16,
      color: '#1a331a',
      fontWeight: '500',
      marginBottom: 4,
      lineHeight: isSmallScreen ? 18 : 20,
    },
    activityTime: {
      fontSize: isSmallScreen ? 10 : 12,
      color: '#666',
      fontWeight: '500',
    },
    trendingItem: {
      paddingVertical: spacing.itemPadding,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    trendingContent: {
      flexDirection: isSmallScreen ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: isSmallScreen ? 'flex-start' : 'center',
      marginBottom: 10,
      gap: isSmallScreen ? 8 : 0,
    },
    trendingInfo: {
      flex: 1,
      marginRight: isSmallScreen ? 0 : 12,
      marginBottom: isSmallScreen ? 8 : 0,
    },
    trendingName: {
      fontSize: isSmallScreen ? 14 : 16,
      color: '#1a331a',
      fontWeight: '600',
      marginBottom: 4,
    },
    trendingStats: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    trendingStatus: {
      fontSize: isSmallScreen ? 12 : 14,
      color: '#666',
      fontWeight: '500',
      marginRight: 8,
    },
    trendingChange: {
      fontSize: isSmallScreen ? 10 : 12,
      color: '#4caf50',
      fontWeight: 'bold',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    viewButton: {
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      paddingHorizontal: isSmallScreen ? 12 : 16,
      paddingVertical: isSmallScreen ? 6 : 8,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: '#4caf50',
      alignSelf: isSmallScreen ? 'flex-start' : 'auto',
    },
    viewButtonText: {
      color: '#4caf50',
      fontSize: isSmallScreen ? 10 : 12,
      fontWeight: 'bold',
    },
    progressBar: {
      height: 4,
      backgroundColor: '#f0f0f0',
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#4caf50',
      borderRadius: 2,
    },
    bottomSpacing: {
      height: isSmallScreen ? 20 : 30,
    },
  });
