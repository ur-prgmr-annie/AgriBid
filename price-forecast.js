import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

export default function PriceMonitoringScreen() {
  const [marketData, setMarketData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availableCrops, setAvailableCrops] = useState([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [activeChart, setActiveChart] = useState('trends');
  const [historicalData, setHistoricalData] = useState(null);
  const [marketStats, setMarketStats] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('All Regions');
  const [regions, setRegions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegionFilter, setShowRegionFilter] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  // ✅ Your Flask backend serving the trained model
  const API_BASE_URL = 'http://127.0.0.1:5000';

  // dynamic crops from backend
  const [crops, setCrops] = useState([]);

  // Color Palette - Shades of Green
  const colors = {
    primary: '#1a331a',       // Dark Green
    secondary: '#2d4d2d',     // Medium Dark Green
    accent: '#4caf50',        // Bright Green
    light: '#81c784',         // Light Green
    lighter: '#e8f5e9',       // Very Light Green
    background: '#f8fff8',    // Off-White Green
    textDark: '#1a331a',      // Dark Text
    textLight: '#ffffff',     // White Text
    textMuted: '#2e7d32',     // Muted Green Text
    success: '#4caf50',       // Success Green
    warning: '#ffc107',       // Warning Yellow
    error: '#8e130a',         // Error Red
    cardGradient: ['#1a331a', '#2d4d2d'],
    headerGradient: ['#1a331a', '#2d4d2d'],
    trendUp: ['#4caf50', '#2e7d32'],
    trendDown: ['#f44336', '#c62828'],
    trendStable: ['#ffc107', '#ff8f00'],
    tableHeader: '#2d4d2d',
    tableRowEven: '#f8fff8',
    tableRowOdd: '#e8f5e9',
  };

  // ─────────────────────────────
  // Helper Functions
  // ─────────────────────────────
  const formatPrice = (val) => {
    if (val === null || val === undefined) return 'N/A';
    if (typeof val === 'number') return `₱${val.toFixed(2)}`;
    if (typeof val === 'string') {
      if (val.includes('₱')) return val;
      const num = parseFloat(val);
      if (isNaN(num)) return val;
      return `₱${num.toFixed(2)}`;
    }
    return String(val);
  };

  const toNumber = (val) => {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      return parseFloat(val.replace(/[^\d.-]/g, ''));
    }
    return NaN;
  };

  const calculatePriceChange = (currentPrice, previousPrice) => {
    const current = toNumber(currentPrice);
    const previous = toNumber(previousPrice);

    if (isNaN(current) || isNaN(previous) || previous <= 0) {
      return { change: 0, percentage: 0, trend: 'stable' };
    }

    const change = current - previous;
    const percentage = ((change / previous) * 100);
    
    let trend = 'stable';
    if (percentage > 2) trend = 'up';
    if (percentage < -2) trend = 'down';

    return { change, percentage, trend };
  };

  const getTrendStyle = (trend) => {
    switch (trend) {
      case 'up':
        return { 
          backgroundColor: 'rgba(76, 175, 80, 0.3)', 
          icon: '📈',
          color: colors.success,
          gradient: colors.trendUp,
          textColor: colors.textLight,
          arrow: '📈'
        };
      case 'down':
        return { 
          backgroundColor: 'rgba(244, 67, 54, 0.3)', 
          icon: '📉',
          color: colors.error,
          gradient: colors.trendDown,
          textColor: colors.textLight,
          arrow: '📉'
        };
      case 'stable':
        return { 
          backgroundColor: 'rgba(255, 193, 7, 0.3)', 
          icon: '➡️',
          color: colors.warning,
          gradient: colors.trendStable,
          textColor: colors.textDark,
          arrow: '➡️'
        };
      default:
        return { 
          backgroundColor: 'rgba(76, 175, 80, 0.3)', 
          icon: '📈',
          color: colors.success,
          gradient: colors.trendUp,
          textColor: colors.textLight,
          arrow: '📈'
        };
    }
  };

  const prettyCropName = (key) => {
    return key
      .replace(/[_\-]+/g, ' ')
      .split(' ')
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
      .join(' ');
  };

  const formatChange = (change, percentage) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}₱${Math.abs(change).toFixed(2)} (${sign}${Math.abs(percentage).toFixed(1)}%)`;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'grains': '🌾',
      'vegetables': '🥬',
      'fruits': '🍎',
      'root_crops': '🥔',
      'legumes': '🫘',
      'commercial': '💰'
    };
    return icons[category] || '🌱';
  };

  // ─────────────────────────────
  // Filtered Data
  // ─────────────────────────────
  const getFilteredCrops = () => {
    let filtered = crops;

    // Filter by region
    if (selectedRegion !== 'All Regions') {
      filtered = filtered.filter(crop => crop.region === selectedRegion);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(crop => 
        crop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        crop.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        crop.region.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredCrops = getFilteredCrops();

  // Get unique locations for the table view
  const getUniqueLocations = () => {
    const locations = {};
    filteredCrops.forEach(crop => {
      if (!locations[crop.region]) {
        locations[crop.region] = [];
      }
      locations[crop.region].push(crop);
    });
    return locations;
  };

  // ─────────────────────────────
  // Chart Data from Your Model
  // ─────────────────────────────
  const getPriceTrendChartData = () => {
    if (filteredCrops.length > 0) {
      const riceCrop = filteredCrops.find(c => c.key === 'rice');
      if (riceCrop) {
        const basePrice = toNumber(riceCrop.currentPrice);
        return {
          labels: ['6d', '5d', '4d', '3d', '2d', '1d', 'Today'],
          datasets: [{
            data: [
              basePrice * 0.95, 
              basePrice * 0.97, 
              basePrice * 0.99, 
              basePrice * 1.02, 
              basePrice * 1.01, 
              basePrice * 1.00, 
              basePrice
            ],
            color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
            strokeWidth: 3
          }]
        };
      }
    }
    
    return {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'],
      datasets: [{
        data: [45.2, 44.8, 45.5, 46.1, 45.8, 45.5, 45.5],
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
        strokeWidth: 3
      }]
    };
  };

  const getPerformanceChartData = () => {
    const rising = filteredCrops.filter(c => c.trend === 'up').length;
    const falling = filteredCrops.filter(c => c.trend === 'down').length;
    const stable = filteredCrops.filter(c => c.trend === 'stable').length;

    return {
      labels: ['Rising', 'Falling', 'Stable'],
      datasets: [{
        data: [rising, falling, stable],
        colors: [
          (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
          (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
          (opacity = 1) => `rgba(255, 193, 7, ${opacity})`
        ]
      }]
    };
  };

  const getCategoryDistributionData = () => {
    const grouped = groupCropsByCategory(filteredCrops);
    const categories = Object.keys(grouped);
    const data = categories.map(cat => grouped[cat].length);
    
    const categoryColors = {
      'grains': colors.success,
      'vegetables': colors.light,
      'fruits': colors.warning,
      'root_crops': '#9c27b0',
      'legumes': colors.error,
      'commercial': '#607d8b'
    };

    return {
      labels: categories.map(cat => cat.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')),
      datasets: [{
        data,
        colors: categories.map(cat => (opacity = 1) => {
          const color = categoryColors[cat] || colors.success;
          return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
        })
      }]
    };
  };

  const getPriceRangeChartData = () => {
    if (filteredCrops.length === 0) return null;

    const prices = filteredCrops.map(crop => toNumber(crop.currentPrice)).filter(price => !isNaN(price));
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    return {
      labels: ['Min', 'Avg', 'Max'],
      datasets: [{
        data: [minPrice, avgPrice, maxPrice],
        colors: [
          (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
          (opacity = 1) => `rgba(255, 193, 7, ${opacity})`,
          (opacity = 1) => `rgba(76, 175, 80, ${opacity})`
        ]
      }]
    };
  };

  const chartConfig = {
    backgroundColor: colors.primary,
    backgroundGradientFrom: colors.primary,
    backgroundGradientTo: colors.secondary,
    decimalPlaces: 2,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: colors.accent
    }
  };

  // ─────────────────────────────
  // Fetch Real Data from Your Model
  // ─────────────────────────────
  const fetchMarketData = async () => {
    try {
      console.log('🔄 Fetching current market prices from AI model...');

      const response = await fetch(`${API_BASE_URL}/market-prices`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status from /market-prices:', response.status);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const results = await response.json();
      console.log('✅ Market data received from AI model:', results);

      if (results.status === 'success') {
        setMarketData(results.market_data || {});
        setLastUpdated(results.timestamp || null);

        const currentPricesObj = results.current_prices || {};
        const previousPricesObj = results.previous_prices || {};
        const marketTrendsObj = results.market_trends || {};
        const regionsObj = results.regions || {};
        const supplyLevelsObj = results.supply_levels || {};
        const categoriesObj = results.categories || {};

        // Build crops array dynamically from current prices
        const cropKeys = Object.keys(currentPricesObj);

        const dynamicCrops = cropKeys.map((key) => {
          const currentRaw = currentPricesObj[key];
          const previousRaw = previousPricesObj[key] || currentRaw;
          
          const { change, percentage, trend } = calculatePriceChange(currentRaw, previousRaw);
          const marketTrend = marketTrendsObj[key] || trend;

          return {
            key,
            name: prettyCropName(key),
            currentPrice: formatPrice(currentRaw),
            previousPrice: formatPrice(previousRaw),
            rawCurrentPrice: currentRaw,
            rawPreviousPrice: previousRaw,
            priceChange: formatChange(change, percentage),
            trend: marketTrend,
            region: regionsObj[key] || 'National Average',
            supplyLevel: supplyLevelsObj[key] || 'Stable',
            category: categoriesObj[key] || 'vegetables',
            lastUpdated: results.timestamp || new Date().toISOString(),
          };
        });

        // Sort crops by category and name
        const sortedCrops = dynamicCrops.sort((a, b) => {
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
          }
          return a.name.localeCompare(b.name);
        });

        setCrops(sortedCrops);
        setAvailableCrops(cropKeys);

        // Extract unique regions
        const uniqueRegions = [...new Set(sortedCrops.map(crop => crop.region))];
        setRegions(['All Regions', ...uniqueRegions]);

        // Calculate market statistics
        const stats = {
          totalCrops: sortedCrops.length,
          risingCrops: sortedCrops.filter(c => c.trend === 'up').length,
          fallingCrops: sortedCrops.filter(c => c.trend === 'down').length,
          stableCrops: sortedCrops.filter(c => c.trend === 'stable').length,
          categories: Object.keys(groupCropsByCategory(sortedCrops)).length,
          regions: uniqueRegions.length,
          avgPriceChange: sortedCrops.reduce((sum, crop) => {
            const change = calculatePriceChange(crop.rawCurrentPrice, crop.rawPreviousPrice);
            return sum + change.percentage;
          }, 0) / sortedCrops.length
        };
        setMarketStats(stats);
      }
    } catch (error) {
      console.error('Market data fetch error:', error);
      setCrops([]);
      setMarketStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/historical-prices`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHistoricalData(data);
      }
    } catch (error) {
      console.error('Historical data fetch error:', error);
    }
  };

  // Group crops by category
  const groupCropsByCategory = (cropsList = filteredCrops) => {
    const grouped = {};
    cropsList.forEach(crop => {
      if (!grouped[crop.category]) {
        grouped[crop.category] = [];
      }
      grouped[crop.category].push(crop);
    });
    return grouped;
  };

  // ─────────────────────────────
  // Effects
  // ─────────────────────────────
  useEffect(() => {
    fetchMarketData();
    fetchHistoricalData();
    const interval = setInterval(fetchMarketData, 300000); // 5 minute updates
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMarketData();
    fetchHistoricalData();
  };

  // ─────────────────────────────
  // UI Components
  // ─────────────────────────────
  const TimeRangeSelector = () => (
    <View style={styles.timeRangeContainer}>
      {['7d', '30d', '90d', '1y'].map((range) => (
        <TouchableOpacity
          key={range}
          style={[
            styles.timeRangeButton,
            selectedTimeRange === range && styles.timeRangeButtonActive
          ]}
          onPress={() => setSelectedTimeRange(range)}
        >
          <Text style={[
            styles.timeRangeText,
            selectedTimeRange === range && styles.timeRangeTextActive
          ]}>
            {range}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const ChartSelector = () => (
    <View style={styles.chartSelector}>
      {[
        { key: 'trends', label: 'Price Trends', icon: '📈' },
        { key: 'performance', label: 'Performance', icon: '📊' },
        { key: 'distribution', label: 'Categories', icon: '🥬' },
        { key: 'range', label: 'Price Range', icon: '💰' }
      ].map((chart) => (
        <TouchableOpacity
          key={chart.key}
          style={[
            styles.chartButton,
            activeChart === chart.key && styles.chartButtonActive
          ]}
          onPress={() => setActiveChart(chart.key)}
        >
          <Text style={styles.chartButtonIcon}>{chart.icon}</Text>
          <Text style={[
            styles.chartButtonText,
            activeChart === chart.key && styles.chartButtonTextActive
          ]}>
            {chart.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const ViewModeSelector = () => (
    <View style={styles.viewModeContainer}>
      <TouchableOpacity
        style={[
          styles.viewModeButton,
          viewMode === 'cards' && styles.viewModeButtonActive
        ]}
        onPress={() => setViewMode('cards')}
      >
        <Ionicons 
          name="grid" 
          size={16} 
          color={viewMode === 'cards' ? colors.textLight : colors.textMuted} 
        />
        <Text style={[
          styles.viewModeText,
          viewMode === 'cards' && styles.viewModeTextActive
        ]}>
          Cards
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.viewModeButton,
          viewMode === 'table' && styles.viewModeButtonActive
        ]}
        onPress={() => setViewMode('table')}
      >
        <Ionicons 
          name="list" 
          size={16} 
          color={viewMode === 'table' ? colors.textLight : colors.textMuted} 
        />
        <Text style={[
          styles.viewModeText,
          viewMode === 'table' && styles.viewModeTextActive
        ]}>
          Table
        </Text>
      </TouchableOpacity>
    </View>
  );

  const RegionFilterModal = () => (
    <Modal
      visible={showRegionFilter}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowRegionFilter(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Region</Text>
            <TouchableOpacity onPress={() => setShowRegionFilter(false)}>
              <Ionicons name="close" size={24} color={colors.textDark} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.regionList}>
            {regions.map((region) => (
              <TouchableOpacity
                key={region}
                style={[
                  styles.regionItem,
                  selectedRegion === region && styles.regionItemActive
                ]}
                onPress={() => {
                  setSelectedRegion(region);
                  setShowRegionFilter(false);
                }}
              >
                <Text style={[
                  styles.regionText,
                  selectedRegion === region && styles.regionTextActive
                ]}>
                  {region}
                </Text>
                {selectedRegion === region && (
                  <Ionicons name="checkmark" size={20} color={colors.success} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const SearchBar = () => (
    <Modal
      visible={showSearch}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowSearch(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Crops</Text>
            <TouchableOpacity onPress={() => setShowSearch(false)}>
              <Ionicons name="close" size={24} color={colors.textDark} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by crop name, category, or region..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.searchResults}>
            {filteredCrops.length} crops found
          </Text>
        </View>
      </View>
    </Modal>
  );

  const renderChart = () => {
    if (filteredCrops.length === 0) {
      return (
        <View style={styles.noChartData}>
          <Text style={styles.noChartDataText}>📊</Text>
          <Text style={styles.noChartDataText}>No Market Data</Text>
          <Text style={styles.noChartDataSubtext}>
            {selectedRegion !== 'All Regions' ? `No data for ${selectedRegion}` : 'Connect to AI model to view charts'}
          </Text>
        </View>
      );
    }

    switch (activeChart) {
      case 'trends':
        return (
          <LineChart
            data={getPriceTrendChartData()}
            width={screenWidth - 48}
            height={240}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withVerticalLines={false}
            withHorizontalLines={false}
          />
        );
      case 'performance':
        return (
          <BarChart
            data={getPerformanceChartData()}
            width={screenWidth - 48}
            height={240}
            chartConfig={chartConfig}
            style={styles.chart}
            showValuesOnTopOfBars
            withHorizontalLabels={true}
          />
        );
      case 'distribution':
        const distributionData = getCategoryDistributionData();
        return (
          <PieChart
            data={distributionData.datasets[0].data.map((value, index) => ({
              name: distributionData.labels[index],
              population: value,
              color: distributionData.datasets[0].colors[index](1),
              legendFontColor: colors.textMuted,
              legendFontSize: 12
            }))}
            width={screenWidth - 48}
            height={240}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        );
      case 'range':
        const rangeData = getPriceRangeChartData();
        return rangeData ? (
          <BarChart
            data={rangeData}
            width={screenWidth - 48}
            height={240}
            chartConfig={chartConfig}
            style={styles.chart}
            showValuesOnTopOfBars
            withHorizontalLabels={true}
          />
        ) : (
          <View style={styles.noChartData}>
            <Text style={styles.noChartDataText}>No price data available</Text>
          </View>
        );
      default:
        return null;
    }
  };

  const StatCard = ({ title, value, subtitle, icon, color = colors.success }) => (
    <LinearGradient
      colors={colors.cardGradient}
      style={styles.statCard}
    >
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </LinearGradient>
  );

  // ─────────────────────────────
  // Table View Component
  // ─────────────────────────────
  const TableView = () => {
    const uniqueLocations = getUniqueLocations();
    const locationNames = Object.keys(uniqueLocations);

    const TableRow = ({ crop, index }) => {
      const trendStyle = getTrendStyle(crop.trend);
      
      return (
        <View style={[
          styles.tableRow,
          { backgroundColor: index % 2 === 0 ? colors.tableRowEven : colors.tableRowOdd }
        ]}>
          <View style={styles.tableCell}>
            <Text style={styles.tableCropName}>{crop.name}</Text>
            <Text style={styles.tableCategory}>{crop.category}</Text>
          </View>
          <View style={styles.tableCell}>
            <Text style={styles.tableRegion}>{crop.region}</Text>
          </View>
          <View style={styles.tableCell}>
            <Text style={styles.tablePrice}>{crop.currentPrice}</Text>
          </View>
          <View style={styles.tableCell}>
            <View style={[styles.trendIndicator, { backgroundColor: trendStyle.backgroundColor }]}>
              <Text style={[styles.trendText, { color: trendStyle.textColor }]}>
                {trendStyle.arrow}
              </Text>
            </View>
          </View>
          <View style={styles.tableCell}>
            <Text style={[
              styles.changeText,
              { color: crop.trend === 'up' ? colors.success : crop.trend === 'down' ? colors.error : colors.warning }
            ]}>
              {crop.priceChange}
            </Text>
          </View>
        </View>
      );
    };

    const LocationSection = ({ location, crops }) => (
      <View style={styles.locationSection}>
        <LinearGradient
          colors={colors.cardGradient}
          style={styles.locationHeader}
        >
          <Ionicons name="location" size={16} color={colors.textLight} />
          <Text style={styles.locationTitle}>{location}</Text>
          <Text style={styles.locationCount}>{crops.length} crops</Text>
        </LinearGradient>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderText}>Crop</Text>
          <Text style={styles.tableHeaderText}>Region</Text>
          <Text style={styles.tableHeaderText}>Price</Text>
          <Text style={styles.tableHeaderText}>Trend</Text>
          <Text style={styles.tableHeaderText}>Change</Text>
        </View>
        {crops.map((crop, index) => (
          <TableRow key={`${crop.key}-${crop.region}`} crop={crop} index={index} />
        ))}
      </View>
    );

    return (
      <View style={styles.tableView}>
        <View style={styles.tableSummary}>
          <Text style={styles.tableSummaryText}>
            📊 Showing {filteredCrops.length} crops across {locationNames.length} regions
          </Text>
        </View>
        
        {locationNames.map(location => (
          <LocationSection
            key={location}
            location={location}
            crops={uniqueLocations[location]}
          />
        ))}
      </View>
    );
  };

  // ─────────────────────────────
  // Card View Component
  // ─────────────────────────────
  const CardView = () => {
    const groupedCrops = groupCropsByCategory();
    const categoryNames = {
      'grains': 'Grains & Cereals',
      'vegetables': 'Vegetables',
      'fruits': 'Fruits',
      'root_crops': 'Root Crops',
      'legumes': 'Legumes',
      'commercial': 'Commercial Crops'
    };

    return (
      <View style={styles.cardView}>
        {Object.keys(groupedCrops).map(category => (
          <View key={category} style={styles.categorySection}>
            <LinearGradient
              colors={colors.cardGradient}
              style={styles.categoryHeader}
            >
              <Text style={styles.categoryIcon}>{getCategoryIcon(category)}</Text>
              <View style={styles.categoryTitleContainer}>
                <Text style={styles.categoryTitle}>
                  {categoryNames[category] || category}
                </Text>
                <Text style={styles.categoryCount}>
                  {groupedCrops[category].length} commodities • {selectedRegion}
                </Text>
              </View>
              <View style={styles.categoryTrend}>
                <Text style={styles.categoryTrendText}>
                  {groupedCrops[category].filter(c => c.trend === 'up').length}📈
                </Text>
              </View>
            </LinearGradient>
            
            {groupedCrops[category].map((crop) => {
              const trendStyle = getTrendStyle(crop.trend);

              return (
                <View key={crop.key} style={styles.cropCard}>
                  <LinearGradient
                    colors={trendStyle.gradient}
                    style={styles.cropGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.cropHeader}>
                      <View style={styles.cropTitle}>
                        <Text style={styles.cropName}>{crop.name}</Text>
                        <Text style={styles.cropRegion}>{crop.region}</Text>
                      </View>
                      <View
                        style={[
                          styles.trendBadge,
                          { backgroundColor: 'rgba(255,255,255,0.3)' },
                        ]}
                      >
                        <Text style={styles.trendText}>{trendStyle.icon}</Text>
                      </View>
                    </View>

                    <View style={styles.priceRow}>
                      <View style={styles.priceColumn}>
                        <Text style={styles.priceLabel}>Current Price</Text>
                        <Text style={styles.currentPrice}>
                          {crop.currentPrice}
                        </Text>
                      </View>
                      <View style={styles.priceColumn}>
                        <Text style={styles.priceLabel}>Daily Change</Text>
                        <Text
                          style={[
                            styles.priceChange,
                            { color: trendStyle.textColor, fontWeight: 'bold' }
                          ]}
                        >
                          {crop.priceChange}
                        </Text>
                      </View>
                      <View style={styles.priceColumn}>
                        <Text style={styles.priceLabel}>Supply Level</Text>
                        <Text style={styles.supplyLevel}>
                          {crop.supplyLevel}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.marketInfo}>
                      <View style={styles.marketInfoRow}>
                        <Text style={styles.marketInfoLabel}>Previous Price:</Text>
                        <Text style={styles.marketInfoValue}>{crop.previousPrice}</Text>
                      </View>
                      <View style={styles.marketInfoRow}>
                        <Text style={styles.marketInfoLabel}>Market Trend:</Text>
                        <Text style={[styles.marketInfoValue, { color: trendStyle.textColor }]}>
                          {crop.trend.toUpperCase()} TREND
                        </Text>
                      </View>
                    </View>

                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>
                        🤖 AI Model • {new Date(crop.lastUpdated).toLocaleTimeString()}
                      </Text>
                    </View>
                  </LinearGradient>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  // ─────────────────────────────
  // UI
  // ─────────────────────────────
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const filteredStats = {
    totalCrops: filteredCrops.length,
    risingCrops: filteredCrops.filter(c => c.trend === 'up').length,
    fallingCrops: filteredCrops.filter(c => c.trend === 'down').length,
    stableCrops: filteredCrops.filter(c => c.trend === 'stable').length,
    categories: Object.keys(groupCropsByCategory()).length,
    regions: selectedRegion === 'All Regions' ? marketStats?.regions || 0 : 1,
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Section */}
        <LinearGradient
          colors={colors.headerGradient}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>🌾 Crop Price Intelligence</Text>
              <Text style={styles.headerSubtitle}>
                AI-Powered Market Predictions • {formattedDate}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => setShowSearch(true)}
              >
                <Ionicons name="search" size={20} color={colors.textLight} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => setShowRegionFilter(true)}
              >
                <Ionicons name="filter" size={20} color={colors.textLight} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Region Filter Bar */}
          <View style={styles.regionBar}>
            <TouchableOpacity 
              style={styles.regionSelector}
              onPress={() => setShowRegionFilter(true)}
            >
              <Ionicons name="location" size={16} color={colors.accent} />
              <Text style={styles.regionSelectorText} numberOfLines={1}>
                {selectedRegion}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.accent} />
            </TouchableOpacity>
            
            {searchQuery ? (
              <TouchableOpacity 
                style={styles.searchTag}
                onPress={() => setShowSearch(true)}
              >
                <Text style={styles.searchTagText}>Search: {searchQuery}</Text>
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close" size={14} color={colors.textLight} />
                </TouchableOpacity>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatNumber}>{filteredStats.totalCrops}</Text>
              <Text style={styles.headerStatLabel}>Active Crops</Text>
            </View>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatNumber}>{filteredStats.categories}</Text>
              <Text style={styles.headerStatLabel}>Categories</Text>
            </View>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatNumber}>{filteredStats.regions}</Text>
              <Text style={styles.headerStatLabel}>Regions</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Market Overview Stats */}
        {marketStats && filteredCrops.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
            <StatCard
              title="Rising Prices"
              value={filteredStats.risingCrops}
              subtitle="Positive trends"
              icon="📈"
            />
            <StatCard
              title="Stable Markets"
              value={filteredStats.stableCrops}
              subtitle="No significant change"
              icon="➡️"
            />
            <StatCard
              title="Falling Prices"
              value={filteredStats.fallingCrops}
              subtitle="Negative trends"
              icon="📉"
            />
            <StatCard
              title="Market Health"
              value={`${((filteredStats.risingCrops / filteredStats.totalCrops) * 100).toFixed(0)}%`}
              subtitle="Positive momentum"
              icon="📊"
            />
          </ScrollView>
        )}

        {/* Interactive Charts Section */}
        <View style={styles.chartsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📈 Market Analytics</Text>
            <Text style={styles.sectionSubtitle}>
              {selectedRegion !== 'All Regions' ? `${selectedRegion} • ` : ''}
              Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Loading...'}
            </Text>
          </View>
          
          <ChartSelector />
          <TimeRangeSelector />
          
          <View style={styles.chartContainer}>
            {renderChart()}
            <View style={styles.chartLegend}>
              <Text style={styles.chartLegendText}>
                {activeChart === 'trends' && `Rice Price Trend (${selectedRegion})`}
                {activeChart === 'performance' && 'Market Performance Overview'}
                {activeChart === 'distribution' && 'Crop Category Distribution'}
                {activeChart === 'range' && 'Price Range Analysis (₱/kg)'}
              </Text>
            </View>
          </View>
        </View>

        {/* Current Prices Section */}
        <View style={styles.predictionsSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>🔄 Live Market Prices</Text>
              <Text style={styles.sectionSubtitle}>
                {selectedRegion !== 'All Regions' ? `${selectedRegion} • ` : ''}
                {formattedDate}
              </Text>
            </View>
            <View style={styles.resultsCount}>
              <Text style={styles.resultsCountText}>
                {filteredCrops.length} crops
              </Text>
            </View>
          </View>

          {/* View Mode Selector */}
          <ViewModeSelector />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Connecting to AI Model...</Text>
              <Text style={styles.loadingSubtext}>Fetching latest market predictions</Text>
            </View>
          ) : filteredCrops.length === 0 ? (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataIcon}>🤖</Text>
              <Text style={styles.noDataText}>
                {searchQuery ? 'No crops found' : 'No Market Data Available'}
              </Text>
              <Text style={styles.noDataSubtext}>
                {searchQuery 
                  ? `No crops match "${searchQuery}" in ${selectedRegion}`
                  : `Please check your connection to the AI model at ${API_BASE_URL}`
                }
              </Text>
              {(searchQuery || selectedRegion !== 'All Regions') && (
                <TouchableOpacity 
                  style={styles.clearFiltersButton}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedRegion('All Regions');
                  }}
                >
                  <Text style={styles.clearFiltersText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : viewMode === 'table' ? (
            <TableView />
          ) : (
            <CardView />
          )}
        </View>

        {/* Market Summary */}
        {marketStats && filteredCrops.length > 0 && (
          <View style={styles.summaryBox}>
            <LinearGradient
              colors={colors.cardGradient}
              style={styles.summaryGradient}
            >
              <Text style={styles.summaryTitle}>📊 Market Summary</Text>
              <Text style={styles.summaryDate}>
                {selectedRegion !== 'All Regions' ? `${selectedRegion} • ` : ''}
                {formattedDate}
              </Text>
              
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{filteredStats.risingCrops}</Text>
                  <Text style={styles.summaryLabel}>Rising</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{filteredStats.fallingCrops}</Text>
                  <Text style={styles.summaryLabel}>Falling</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{filteredStats.stableCrops}</Text>
                  <Text style={styles.summaryLabel}>Stable</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{filteredStats.totalCrops}</Text>
                  <Text style={styles.summaryLabel}>Total</Text>
                </View>
              </View>

              {lastUpdated && (
                <Text style={styles.summaryTimestamp}>
                  🤖 AI Model • Updated {new Date(lastUpdated).toLocaleString()}
                </Text>
              )}
            </LinearGradient>
          </View>
        )}

        {/* Footer info */}
        <View style={styles.infoFooter}>
          <Text style={styles.infoFooterText}>
            🔄 Pull down to refresh • Real-time AI predictions
          </Text>
          <Text style={styles.infoFooterText}>
            {selectedRegion !== 'All Regions' ? `📍 Viewing: ${selectedRegion} • ` : ''}
            {searchQuery ? `🔍 Search: ${searchQuery} • ` : ''}
            {filteredCrops.length} crops displayed • {viewMode === 'table' ? '📋 Table View' : '🃏 Card View'}
          </Text>
          <Text style={styles.infoFooterText}>
            📅 Data as of {formattedDate} • Philippine Pesos (₱/kg)
          </Text>
        </View>
      </ScrollView>

      {/* Modals */}
      <RegionFilterModal />
      <SearchBar />
    </View>
  );
}

// ─────────────────────────────
// Styles
// ─────────────────────────────
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
  error: '#f44336',
  cardGradient: ['#1a331a', '#2d4d2d'],
  headerGradient: ['#1a331a', '#2d4d2d'],
  trendUp: ['#4caf50', '#2e7d32'],
  trendDown: ['#f44336', '#c62828'],
  trendStable: ['#ffc107', '#ff8f00'],
  tableHeader: '#2d4d2d',
  tableRowEven: '#f8fff8',
  tableRowOdd: '#e8f5e9',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.lighter,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  regionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  regionSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
  },
  regionSelectorText: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  searchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  searchTagText: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: '600',
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerStat: {
    alignItems: 'center',
  },
  headerStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  headerStatLabel: {
    fontSize: 12,
    color: colors.lighter,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  statsContainer: {
    padding: 16,
    paddingTop: 8,
  },
  statCard: {
    width: 150,
    height: 120,
    borderRadius: 16,
    marginRight: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
    color: colors.textLight,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: colors.textLight,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  statSubtitle: {
    fontSize: 10,
    color: colors.lighter,
    textAlign: 'center',
  },
  chartsSection: {
    padding: 16,
    backgroundColor: colors.background,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  resultsCount: {
    backgroundColor: colors.lighter,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  resultsCountText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chartSelector: {
    flexDirection: 'row',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  chartButton: {
    padding: 12,
    alignItems: 'center',
    backgroundColor: colors.lighter,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 12,
    minWidth: 100,
    borderWidth: 1,
    borderColor: colors.light,
  },
  chartButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chartButtonIcon: {
    fontSize: 20,
    marginBottom: 4,
    color: colors.textMuted,
  },
  chartButtonText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  chartButtonTextActive: {
    color: colors.textLight,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.lighter,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.light,
  },
  timeRangeButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  timeRangeText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  timeRangeTextActive: {
    color: colors.textLight,
  },
  chartContainer: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 16,
    marginBottom: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  chart: {
    borderRadius: 16,
    marginVertical: 8,
  },
  chartLegend: {
    marginTop: 12,
  },
  chartLegendText: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '600',
    textAlign: 'center',
  },
  noChartData: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noChartDataText: {
    fontSize: 16,
    color: colors.textLight,
    marginBottom: 8,
    textAlign: 'center',
  },
  noChartDataSubtext: {
    fontSize: 12,
    color: colors.light,
    textAlign: 'center',
  },
  predictionsSection: {
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 16,
    marginBottom: 4,
  },
  loadingSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: colors.background,
    borderRadius: 16,
    margin: 16,
    borderWidth: 2,
    borderColor: colors.lighter,
    borderStyle: 'dashed',
  },
  noDataIcon: {
    fontSize: 48,
    marginBottom: 16,
    color: colors.textMuted,
  },
  noDataText: {
    fontSize: 18,
    color: colors.textDark,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  noDataSubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  clearFiltersButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearFiltersText: {
    color: colors.textLight,
    fontWeight: '600',
  },

  // View Mode Selector
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: colors.lighter,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  viewModeButtonActive: {
    backgroundColor: colors.accent,
  },
  viewModeText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  viewModeTextActive: {
    color: colors.textLight,
  },

  // Table View Styles
  tableView: {
    marginBottom: 16,
  },
  tableSummary: {
    backgroundColor: colors.lighter,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  tableSummaryText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  locationSection: {
    marginBottom: 24,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textLight,
    flex: 1,
  },
  locationCount: {
    fontSize: 12,
    color: colors.light,
    fontWeight: '600',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.tableHeader,
    padding: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textLight,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter,
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableCropName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textDark,
    textAlign: 'center',
  },
  tableCategory: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  tableRegion: {
    fontSize: 12,
    color: colors.textDark,
    textAlign: 'center',
    fontWeight: '500',
  },
  tablePrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.success,
    textAlign: 'center',
  },
  trendIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 40,
  },
  changeText: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Card View Styles (existing category styles)
  cardView: {
    marginBottom: 16,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
    color: colors.textLight,
  },
  categoryTitleContainer: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 12,
    color: colors.lighter,
  },
  categoryTrend: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryTrendText: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '600',
  },
  cropCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  cropGradient: {
    padding: 16,
    borderRadius: 16,
  },
  cropHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cropTitle: {
    flex: 1,
  },
  cropName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  cropRegion: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 12,
    color: colors.textLight,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceColumn: {
    alignItems: 'center',
    flex: 1,
  },
  priceLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  currentPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textLight,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  priceChange: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  supplyLevel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  marketInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  marketInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  marketInfoLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  marketInfoValue: {
    fontSize: 11,
    color: colors.textLight,
    fontWeight: 'bold',
  },
  statusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 9,
    color: colors.textLight,
    fontWeight: 'bold',
  },
  summaryBox: {
    borderRadius: 20,
    overflow: 'hidden',
    margin: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  summaryGradient: {
    padding: 20,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  summaryDate: {
    fontSize: 12,
    color: colors.light,
    textAlign: 'center',
    marginBottom: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.lighter,
    textAlign: 'center',
  },
  summaryTimestamp: {
    fontSize: 10,
    color: colors.light,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  infoFooter: {
    padding: 20,
    backgroundColor: colors.lighter,
    borderTopWidth: 1,
    borderTopColor: colors.light,
  },
  infoFooterText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 16,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  regionList: {
    maxHeight: 400,
  },
  regionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter,
  },
  regionItemActive: {
    backgroundColor: colors.lighter,
  },
  regionText: {
    fontSize: 16,
    color: colors.textDark,
    flex: 1,
  },
  regionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
  },
  searchResults: {
    padding: 16,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 14,
  },
});