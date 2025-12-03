import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { auth, firestore } from '../../config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  collection as fsCollection,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const screenWidth = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalSales: 0,
    successRate: 0,
    avgSalePrice: 0,
    cropDistribution: [], // { cropType, percentage, value }
    monthlyRevenueSeries: [], // [{ label, value }]
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setLoading(true);

        if (!user) {
          setStats({
            totalRevenue: 0,
            totalSales: 0,
            successRate: 0,
            avgSalePrice: 0,
            cropDistribution: [],
            monthlyRevenueSeries: [],
          });
          return;
        }

        const uid = user.uid;

        // 1) Get all listings of this farmer
        const listingsRef = collection(firestore, 'listings');
        const qListings = query(listingsRef, where('farmerUid', '==', uid));
        const listingsSnap = await getDocs(qListings);

        const listings = await Promise.all(
          listingsSnap.docs.map(async (docSnap) => {
            const listingData = docSnap.data();
            const listingId = docSnap.id;

            // 2) Get all bids for this listing
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

            return {
              id: listingId,
              ...listingData,
              bids,
            };
          })
        );

        // ---- Compute Stats ----
        let totalRevenue = 0;
        let totalSales = 0;
        let listingsWithBids = 0;
        const cropTotals = {}; // revenue per cropType
        const monthlyRevenueMap = {}; // key: 'YYYY-MM' => revenue

        listings.forEach((listing) => {
          const bidsCount = listing.bids.length;
          if (bidsCount > 0) {
            listingsWithBids += 1;
          }

          const winningAmount = Number(listing.winningBidAmount || 0);
          const isClosedWithWinner =
            listing.status === 'closed' && winningAmount > 0;

          if (isClosedWithWinner) {
            totalRevenue += winningAmount;
            totalSales += 1;

            const crop = listing.cropType || 'Other';
            if (!cropTotals[crop]) cropTotals[crop] = 0;
            cropTotals[crop] += winningAmount;

            // Determine "sale date" for monthly revenue
            let winningDate = null;

            if (listing.winningAt?.toDate) {
              winningDate = listing.winningAt.toDate();
            } else if (listing.bids && listing.bids.length > 0) {
              // fallback: last bid date
              listing.bids.forEach((bid) => {
                if (bid.createdAt?.toDate) {
                  const d = bid.createdAt.toDate();
                  if (!winningDate || d > winningDate) winningDate = d;
                }
              });
            }

            if (!winningDate) {
              winningDate = new Date(); // fallback if no date at all
            }

            const ymKey = `${winningDate.getFullYear()}-${String(
              winningDate.getMonth() + 1
            ).padStart(2, '0')}`;

            if (!monthlyRevenueMap[ymKey]) monthlyRevenueMap[ymKey] = 0;
            monthlyRevenueMap[ymKey] += winningAmount;
          }
        });

        const successRate =
          listingsWithBids > 0
            ? Math.round((totalSales / listingsWithBids) * 100)
            : 0;

        const avgSalePrice =
          totalSales > 0 ? totalRevenue / totalSales : 0;

        const totalCropRevenue = Object.values(cropTotals).reduce(
          (sum, val) => sum + val,
          0
        );

        const cropDistribution = Object.entries(cropTotals)
          .map(([cropType, value]) => ({
            cropType,
            value,
            percentage:
              totalCropRevenue > 0
                ? Math.round((value / totalCropRevenue) * 100)
                : 0,
          }))
          .sort((a, b) => b.value - a.value);

        // Build last 6 months series (including current)
        const now = new Date();
        const monthlyRevenueSeries = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const ymKey = `${d.getFullYear()}-${String(
            d.getMonth() + 1
          ).padStart(2, '0')}`;

          monthlyRevenueSeries.push({
            label: d.toLocaleString('default', { month: 'short' }), // Jan, Feb...
            value: monthlyRevenueMap[ymKey] || 0,
          });
        }

        setStats({
          totalRevenue,
          totalSales,
          successRate,
          avgSalePrice,
          cropDistribution,
          monthlyRevenueSeries,
        });
      } catch (err) {
        console.error('Error loading analytics:', err);
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

  const {
    totalRevenue,
    totalSales,
    successRate,
    avgSalePrice,
    cropDistribution,
    monthlyRevenueSeries,
  } = stats;

  const hasRevenueData =
    monthlyRevenueSeries.length > 0 &&
    monthlyRevenueSeries.some((p) => p.value > 0);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Analytics Dashboard</Text>
        <Text style={styles.subtitle}>
          Track your performance and market insights
        </Text>

        {/* Stats Overview (dynamic) */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              ₱{totalRevenue.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
            <Text style={styles.statChange}>
              from all closed listings
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalSales}</Text>
            <Text style={styles.statLabel}>Total Sales</Text>
            <Text style={styles.statChange}>
              Closed listings with a winner
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{successRate}%</Text>
            <Text style={styles.statLabel}>Success Rate</Text>
            <Text style={styles.statChange}>
              {totalSales} of listings with bids
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              ₱{avgSalePrice.toFixed(0)}
            </Text>
            <Text style={styles.statLabel}>Avg. Sale Price</Text>
            <Text style={styles.statChange}>
              Per closed listing with winner
            </Text>
          </View>
        </View>

        {/* Revenue Line Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Revenue Trend</Text>
          <Text style={styles.chartSubtitle}>
            Revenue from closed sales (last 6 months)
          </Text>

          {hasRevenueData ? (
            <View style={styles.chartWrapper}>
              <LineChart
                data={{
                  labels: monthlyRevenueSeries.map((p) => p.label),
                  datasets: [
                    {
                      data: monthlyRevenueSeries.map((p) => p.value),
                    },
                  ],
                }}
                width={screenWidth - 32} // padding 16 left/right
                height={220}
                yAxisLabel="₱"
                yAxisSuffix=""
                decimalPlaces={0}
                chartConfig={{
                  backgroundColor: '#1a331a',
                  backgroundGradientFrom: '#1a331a',
                  backgroundGradientTo: '#2d4d2d',
                  decimalPlaces: 0,
                  color: (opacity = 1) =>
                    `rgba(255, 255, 255, ${opacity})`,
                  labelColor: (opacity = 1) =>
                    `rgba(255, 255, 255, ${opacity})`,
                  propsForDots: {
                    r: '4',
                    strokeWidth: '2',
                    stroke: '#4caf50',
                  },
                  propsForBackgroundLines: {
                    strokeDasharray: '3 6',
                  },
                }}
                bezier
                style={styles.chart}
              />
            </View>
          ) : (
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartPlaceholderText}>
                No revenue yet. Close a listing with a winning bid to see
                revenue over time.
              </Text>
            </View>
          )}
        </View>

        {/* Crop Distribution (dynamic) */}
        <View style={styles.distributionSection}>
          <Text style={styles.sectionTitle}>Crop Distribution</Text>
          <Text style={styles.chartSubtitle}>
            Revenue distribution by crop type
          </Text>

          {cropDistribution.length === 0 ? (
            <Text style={styles.noDataText}>
              No closed sales yet. Close a listing with a winning bid to see
              distribution.
            </Text>
          ) : (
            <View style={styles.distributionList}>
              {cropDistribution.map((item, idx) => (
                <View key={item.cropType} style={styles.distributionItem}>
                  <View style={styles.distributionInfo}>
                    <View
                      style={[
                        styles.colorDot,
                        {
                          backgroundColor: [
                            '#4caf50',
                            '#66bb6a',
                            '#81c784',
                            '#a5d6a7',
                          ][idx % 4],
                        },
                      ]}
                    />
                    <Text style={styles.distributionLabel}>
                      {item.cropType}
                    </Text>
                  </View>
                  <Text style={styles.distributionPercentage}>
                    {item.percentage}%
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a331a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#2e7d32',
    marginBottom: 24,
  },
  statsGrid: {
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#f8fff8',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8f5e9',
    shadowColor: '#2e7d32',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#1a331a',
    marginBottom: 4,
    fontWeight: '600',
  },
  statChange: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '500',
  },
  chartSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a331a',
    marginBottom: 8,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#2e7d32',
    marginBottom: 16,
  },
  chartWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a331a',
    borderWidth: 1,
    borderColor: '#e8f5e9',
  },
  chart: {
    borderRadius: 16,
  },
  chartPlaceholder: {
    backgroundColor: '#f8fff8',
    minHeight: 160,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8f5e9',
    paddingHorizontal: 16,
  },
  chartPlaceholderText: {
    color: '#4caf50',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  distributionSection: {
    marginBottom: 24,
  },
  distributionList: {
    backgroundColor: '#f8fff8',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8f5e9',
    shadowColor: '#2e7d32',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  distributionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8f5e9',
  },
  distributionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  distributionLabel: {
    color: '#1a331a',
    fontSize: 16,
    fontWeight: '500',
  },
  distributionPercentage: {
    color: '#2e7d32',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noDataText: {
    marginTop: 12,
    color: '#a5d6a7',
    fontSize: 14,
  },
});
