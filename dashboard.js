// app/farmer/dashboard.js
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, firestore } from '../../config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  collection as fsCollection,
  doc,
  getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function FarmerDashboard() {
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Farmer');
  const [photoURL, setPhotoURL] = useState('');
  const [stats, setStats] = useState({
    activeListings: 0,
    totalBids: 0,
    completedSales: 0,
    monthlyRevenue: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const floatInterpolate = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        setLoading(true);

        if (!user) {
          setUserName('Farmer');
          setPhotoURL('');
          setStats({
            activeListings: 0,
            totalBids: 0,
            completedSales: 0,
            monthlyRevenue: 0,
          });
          setRecentActivity([]);
          setUnreadCount(0);
          return;
        }

        const uid = user.uid;

        // profile info
        let resolvedName = user.displayName || 'Farmer';
        let resolvedPhoto = '';
        try {
          const profileRef = doc(firestore, 'profiles', uid);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const data = profileSnap.data();
            resolvedName = data.fullName || data.name || resolvedName;
            resolvedPhoto = data.photoURL || '';
          }
        } catch (e) {
          console.warn('Error fetching profile name/photo:', e);
        }
        setUserName(resolvedName);
        setPhotoURL(resolvedPhoto);

        // unread notifs
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
          console.warn('Error fetching farmer unread notifications:', e);
          setUnreadCount(0);
        }

        const listingsRef = collection(firestore, 'listings');
        const qListings = query(listingsRef, where('farmerUid', '==', uid));
        const listingsSnap = await getDocs(qListings);

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let activeListings = 0;
        let totalBids = 0;
        let completedSales = 0;
        let monthlyRevenue = 0;

        const activityEvents = [];

        await Promise.all(
          listingsSnap.docs.map(async (docSnap) => {
            const listingData = docSnap.data();
            const listingId = docSnap.id;
            const imageUrl = listingData.imageUrl || '';

            const bidsRef = fsCollection(
              firestore,
              'listings',
              listingId,
              'bids'
            );
            const bidsSnap = await getDocs(bidsRef);
            const bids = bidsSnap.docs.map((b) => ({
              id: b.id,
              ...b.data(),
            }));

            const status = listingData.status || 'open';
            const winningAmount = Number(listingData.winningBidAmount || 0);

            if (status === 'open' || status === 'active') {
              activeListings += 1;
            }

            totalBids += bids.length;

            const hasWinner = status === 'closed' && winningAmount > 0;
            if (hasWinner) {
              completedSales += 1;

              let winningDate = null;
              if (listingData.winningAt?.toDate) {
                winningDate = listingData.winningAt.toDate();
              } else if (listingData.winningBidId) {
                const winBid = bids.find(
                  (b) => b.id === listingData.winningBidId
                );
                if (winBid?.createdAt?.toDate) {
                  winningDate = winBid.createdAt.toDate();
                }
              } else if (bids.length > 0) {
                bids.forEach((b) => {
                  if (b.createdAt?.toDate) {
                    const d = b.createdAt.toDate();
                    if (!winningDate || d > winningDate) winningDate = d;
                  }
                });
              }

              if (
                winningDate &&
                winningDate.getMonth() === currentMonth &&
                winningDate.getFullYear() === currentYear
              ) {
                monthlyRevenue += winningAmount;
              } else if (!winningDate) {
                monthlyRevenue += winningAmount;
              }

              activityEvents.push({
                type: 'sale',
                listingId,
                title: listingData.cropType || 'Crop',
                subtitle: listingData.variety || '',
                amount: winningAmount,
                createdAt: winningDate || now,
                imageUrl,
              });
            }

            bids.forEach((bid) => {
              let createdAt = new Date();
              if (bid.createdAt?.toDate) {
                createdAt = bid.createdAt.toDate();
              }
              activityEvents.push({
                type: 'bid',
                listingId,
                title: listingData.cropType || 'Crop',
                subtitle: listingData.variety || '',
                amount: Number(bid.bidAmount || 0),
                createdAt,
                imageUrl,
              });
            });
          })
        );

        activityEvents.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        const latestActivities = activityEvents.slice(0, 5);

        setStats({
          activeListings,
          totalBids,
          completedSales,
          monthlyRevenue,
        });
        setRecentActivity(latestActivities);
      } catch (err) {
        console.error('Error loading farmer dashboard:', err);
        setStats({
          activeListings: 0,
          totalBids: 0,
          completedSales: 0,
          monthlyRevenue: 0,
        });
        setRecentActivity([]);
        setUnreadCount(0);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const statsData = [
    {
      label: 'ACTIVE LISTINGS',
      value: String(stats.activeListings),
      change: 'Live auctions',
      icon: '📦',
      color: '#2e7d32',
    },
    {
      label: 'TOTAL BIDS',
      value: String(stats.totalBids),
      change: 'Across all crops',
      icon: '🏷️',
      color: '#388e3c',
    },
    {
      label: 'COMPLETED SALES',
      value: String(stats.completedSales),
      change: 'Closed deals',
      icon: '💰',
      color: '#43a047',
    },
    {
      label: 'MONTHLY REVENUE',
      value: `₱${stats.monthlyRevenue.toLocaleString()}`,
      change: 'This month',
      icon: '📈',
      color: '#4caf50',
    },
  ];

  const quickActions = [
    { title: 'NEW LISTING', icon: '➕', route: '/farmer/create-listings' },
    { title: 'MY LISTINGS', icon: '📋', route: '/farmer/listings' },
    { title: 'ANALYTICS', icon: '📊', route: '/farmer/analytics' },
    { title: 'PRICE FORECAST', icon: '🤖', route: '/farmer/price-forecast' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingFull}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <LinearGradient
        colors={['#1a331a', '#2d4d2d']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.View
          style={[
            styles.headerContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.logoContainer}
              activeOpacity={0.85}
              onPress={() => router.push('/farmer/profile')}
            >
              <View style={styles.logoPlaceholder}>
                {photoURL ? (
                  <Image
                    source={{ uri: photoURL }}
                    style={styles.profileImage}
                  />
                ) : (
                  <Image
                    source={require('../../assets/logo.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>FARMER DASHBOARD</Text>
              <Text style={styles.headerSubtitle}>
                AI-OPTIMIZED TRADING PLATFORM
              </Text>
            </View>

            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => router.push('/farmer/notifications')}
              activeOpacity={0.8}
            >
              <View style={styles.notificationIconContainer}>
                <Text style={styles.notificationBell}>🔔</Text>
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          <View className="welcomeSection">
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{userName} 👋</Text>
            <View style={styles.statusIndicator}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Premium Member</Text>
            </View>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* MAIN CONTENT */}
      <View style={styles.content}>
        {/* STATS GRID */}
        <Animated.View
          style={[
            styles.statsGrid,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {statsData.map((stat, index) => (
            <Animated.View
              key={stat.label}
              style={[
                styles.statCard,
                {
                  transform: [{ translateY: floatInterpolate }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.statTouchable}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#1a331a', '#2d4d2d']}
                  style={styles.statGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.statHeader}>
                    <View
                      style={[
                        styles.statIcon,
                        { backgroundColor: `${stat.color}30` },
                      ]}
                    >
                      <Text style={styles.statIconText}>{stat.icon}</Text>
                    </View>
                    <View
                      style={[
                        styles.statChangeBadge,
                        { backgroundColor: `${stat.color}20` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statChangeText,
                          { color: '#e8f5e9' },
                        ]}
                      >
                        {stat.change}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>

                  <View style={styles.statProgress}>
                    <View
                      style={[
                        styles.statProgressBar,
                        {
                          width: `${60 + index * 10}%`,
                          backgroundColor: '#e8f5e9',
                        },
                      ]}
                    />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </Animated.View>

        {/* QUICK ACTIONS */}
        <Animated.View
          style={[
            styles.actionsSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
            <View style={styles.sectionLine} />
          </View>

          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <View key={action.title} style={styles.actionCardWrapper}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.actionCard}
                  onPress={() => router.push(action.route)}
                >
                  <LinearGradient
                    colors={['#1a331a', '#2d4d2d']}
                    style={styles.actionGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.actionIconContainer}>
                      <View style={styles.actionIconBackground}>
                        <Text style={styles.actionIcon}>{action.icon}</Text>
                      </View>
                    </View>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <View style={styles.actionArrow}>
                      <Text style={styles.arrow}>›</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* RECENT ACTIVITY */}
        <Animated.View
          style={[
            styles.activitySection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
            <View style={styles.sectionLine} />
          </View>

          <View style={styles.activityList}>
            {recentActivity.length === 0 ? (
              <View
                style={[
                  styles.activityItem,
                  { justifyContent: 'center' },
                ]}
              >
                <Text style={{ color: '#a5d6a7', fontSize: 13 }}>
                  No recent activity yet. Once bids and sales happen,
                  they’ll appear here.
                </Text>
              </View>
            ) : (
              recentActivity.map((act) => {
                const isSale = act.type === 'sale';
                const icon = isSale ? '✅' : '💰';
                const title = isSale
                  ? 'Sale completed'
                  : 'New bid received';
                const subtitle = `${act.title}${
                  act.subtitle ? ' – ' + act.subtitle : ''
                }`;
                const amountLabel = isSale
                  ? `₱${act.amount.toLocaleString()}`
                  : `Bid: ₱${act.amount.toLocaleString()}`;

                const timeText = act.createdAt.toLocaleString();

                return (
                  <View
                    key={`${act.type}-${act.listingId}-${act.createdAt.getTime()}`}
                    style={styles.activityItem}
                  >
                    <View
                      style={[
                        styles.activityIcon,
                        {
                          backgroundColor: act.imageUrl
                            ? 'transparent'
                            : 'rgba(76, 175, 80, 0.08)',
                        },
                      ]}
                    >
                      {act.imageUrl ? (
                        <Image
                          source={{ uri: act.imageUrl }}
                          style={styles.activityImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.activityIconText}>{icon}</Text>
                      )}
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityTitle}>{title}</Text>
                      <Text style={styles.activitySubtitle}>{subtitle}</Text>
                      <Text style={styles.activityPrice}>{amountLabel}</Text>
                    </View>
                    <View style={styles.activityTimeContainer}>
                      <Text style={styles.activityTime}>{timeText}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </Animated.View>

        {/* PERFORMANCE METRICS (if you still use them) */}
        <Animated.View
          style={[
            styles.metricsSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PERFORMANCE METRICS</Text>
            <View style={styles.sectionLine} />
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>
                {stats.completedSales}
              </Text>
              <Text style={styles.metricLabel}>TOTAL SALES</Text>
              <Text style={styles.metricSubtext}>
                Closed auctions where a winning bid was selected.
              </Text>
              <View style={styles.metricProgress}>
                <View
                  style={[styles.metricProgressFill, { width: '70%' }]}
                />
              </View>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>
                {stats.totalBids || 0}
              </Text>
              <Text style={styles.metricLabel}>TOTAL BIDS</Text>
              <Text style={styles.metricSubtext}>
                All bids placed on your listings.
              </Text>
              <View style={styles.metricProgress}>
                <View
                  style={[styles.metricProgressFill, { width: '55%' }]}
                />
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────
// Styles
// ─────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    paddingBottom: 32,
    backgroundColor: '#ffffff',
  },
  loadingFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },

  header: {
    padding: 24,
    paddingTop: 60,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    backgroundColor: 'rgba(26, 51, 26, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 175, 80, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 25,
  },
  headerContent: {
    flex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    marginRight: 16,
  },
  logoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#4caf50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 10,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  headerText: {
    flex: 1,
  },
  notificationButton: {
    marginLeft: 8,
  },
  notificationIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  notificationBell: {
    fontSize: 18,
    color: '#ffffff',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#a5d6a7',
    letterSpacing: 2.5,
    marginTop: 4,
    fontWeight: '600',
  },
  welcomeText: {
    fontSize: 14,
    color: '#a5d6a7',
    marginBottom: 4,
    fontWeight: '500',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4caf50',
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#a5d6a7',
    fontWeight: '600',
  },

  content: {
    padding: 20,
    backgroundColor: '#ffffff',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  statTouchable: {
    flex: 1,
  },
  statGradient: {
    padding: 18,
    borderRadius: 20,
    height: 140,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statIconText: {
    fontSize: 16,
    color: '#ffffff',
  },
  statChangeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statChangeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#e8f5e9',
    marginBottom: 12,
    letterSpacing: 1,
    fontWeight: '600',
  },
  statProgress: {
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statProgressBar: {
    height: '100%',
    borderRadius: 3,
    shadowColor: '#4caf50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },

  actionsSection: {
    marginBottom: 32,
  },
  activitySection: {
    marginBottom: 32,
  },
  metricsSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a331a',
    letterSpacing: 1,
    marginRight: 16,
  },
  sectionLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(76, 175, 80, 0.4)',
    borderRadius: 1,
  },

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCardWrapper: {
    width: '48%',
    marginBottom: 16,
  },
  actionCard: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  actionGradient: {
    padding: 20,
    borderRadius: 18,
    alignItems: 'center',
    minHeight: 130,
    justifyContent: 'center',
  },
  actionIconContainer: {
    marginBottom: 12,
  },
  actionIconBackground: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionIcon: {
    fontSize: 18,
    color: '#ffffff',
  },
  actionTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 10,
  },
  actionArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  arrow: {
    color: '#4caf50',
    fontSize: 12,
    fontWeight: 'bold',
  },

  activityList: {
    backgroundColor: '#f8fff8',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#e8f5e9',
    overflow: 'hidden',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e8f5e9',
    backgroundColor: '#ffffff',
  },
  activityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  activityIconText: {
    fontSize: 16,
  },
  activityImage: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    color: '#1a331a',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  activitySubtitle: {
    color: '#2e7d32',
    fontSize: 12,
    marginBottom: 2,
  },
  activityPrice: {
    color: '#4caf50',
    fontSize: 12,
    fontWeight: '600',
  },
  activityTimeContainer: {
    alignItems: 'flex-end',
  },
  activityTime: {
    color: '#81c784',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'right',
  },

  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#f8fff8',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e8f5e9',
    alignItems: 'center',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2e7d32',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#1a331a',
    fontWeight: '600',
    marginBottom: 8,
  },
  metricSubtext: {
    fontSize: 10,
    color: '#4caf50',
    fontWeight: '500',
    textAlign: 'center',
  },
  metricProgress: {
    width: '100%',
    height: 6,
    backgroundColor: '#e8f5e9',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  metricProgressFill: {
    height: '100%',
    backgroundColor: '#4caf50',
    borderRadius: 3,
  },
});
