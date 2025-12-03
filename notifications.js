// app/farmer/notifications.js

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth } from 'firebase/auth';
import { firestore } from '../../config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from 'firebase/firestore';

export default function FarmerNotifications() {
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasUser, setHasUser] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        setHasUser(false);
        setNotifications([]);
        setLoading(false);
        return;
      }

      try {
        const notifRef = collection(firestore, 'notifications');
        const qNotif = query(notifRef, where('userUid', '==', user.uid));
        const snap = await getDocs(qNotif);

        const data = snap.docs.map((d) => {
          const n = d.data();
          const createdAt = n.createdAt?.toDate
            ? n.createdAt.toDate()
            : new Date(0);
          return {
            id: d.id,
            ...n,
            createdAt,
          };
        });

        // newest first
        data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setNotifications(data);
      } catch (err) {
        console.error('Error loading farmer notifications:', err);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const totalUnread = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications]
  );

  const categories = useMemo(() => {
    const base = [
      { id: 'all', name: 'All' },
      { id: 'bid', name: 'Bids' },
      { id: 'price', name: 'Price Alert' },
      { id: 'bidding', name: 'Bidding' },
      { id: 'transaction', name: 'Transaction' },
    ];

    return base.map((cat) => ({
      ...cat,
      count:
        cat.id === 'all'
          ? notifications.length
          : notifications.filter((n) => n.category === cat.id).length,
    }));
  }, [notifications]);

  const filteredNotifications =
    activeTab === 'all'
      ? notifications
      : notifications.filter((notif) => notif.category === activeTab);

  const getNotificationIcon = (type, category) => {
    const byType = {
      bid: '💰',
      new_bid: '💰',
      alert: '⚠️',
      reminder: '⏰',
      transaction: '✅',
      welcome: '👋',
    };
    if (byType[type]) return byType[type];

    const byCat = {
      bid: '💰',
      price: '📈',
      bidding: '⏰',
      transaction: '✅',
    };
    return byCat[category] || '🔔';
  };

  // --- format message so name (not email) is shown for bid notifications ---
  const getNotificationMessage = (notification) => {
    if (
      notification.type === 'bid' ||
      notification.type === 'new_bid' ||
      notification.category === 'bid' ||
      notification.category === 'bidding'
    ) {
      const bidderName =
        notification.buyerName ||
        notification.buyerFullName ||
        notification.buyerDisplayName ||
        notification.senderName ||
        notification.senderFullName ||
        notification.farmerName;

      const listingTitle =
        notification.listingTitle ||
        notification.productName ||
        notification.cropName;

      const amount = notification.bidAmount ?? notification.amount;

      if (bidderName && listingTitle && amount !== undefined) {
        const formattedAmount =
          typeof amount === 'number'
            ? `₱${amount.toLocaleString()}`
            : amount.toString();
        return `${bidderName} placed a bid of ${formattedAmount} on ${listingTitle}`;
      }
    }

    return notification.message;
  };
  // -----------------------------------------------------------------------

  const handleNotificationPress = async (notification) => {
    if (notification.unread) {
      try {
        const notifDocRef = doc(firestore, 'notifications', notification.id);
        await updateDoc(notifDocRef, { unread: false });

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, unread: false } : n
          )
        );
      } catch (err) {
        console.error('Error marking farmer notif as read:', err);
      }
    }
    // optional: navigate based on notification.type / listingId / transactionId
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
          Please sign in to see your notifications.
        </Text>
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
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>
            Stay updated with your trading activity
          </Text>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{notifications.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalUnread}</Text>
            <Text style={styles.statLabel}>Unread</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                activeTab === category.id && styles.categoryButtonActive,
              ]}
              onPress={() => setActiveTab(category.id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  activeTab === category.id && styles.categoryTextActive,
                ]}
              >
                {category.name} ({category.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.notificationsList}>
          {filteredNotifications.length === 0 ? (
            <Text style={{ color: '#666', fontSize: 13 }}>
              No notifications in this category.
            </Text>
          ) : (
            filteredNotifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={styles.notificationCard}
                onPress={() => handleNotificationPress(notification)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#1a331a', '#2d4d2d']}
                  style={styles.notificationGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.notificationHeader}>
                    <View style={styles.notificationTitleContainer}>
                      <Text style={styles.notificationIcon}>
                        {getNotificationIcon(
                          notification.type,
                          notification.category
                        )}
                      </Text>
                      <View style={styles.notificationText}>
                        <Text style={styles.notificationTitle}>
                          {notification.title || 'Notification'}
                        </Text>
                        <Text style={styles.notificationMessage}>
                          {getNotificationMessage(notification)}
                        </Text>
                      </View>
                    </View>
                    {notification.unread && <View style={styles.unreadBadge} />}
                  </View>
                  <Text style={styles.notificationTime}>
                    {notification.createdAt.toLocaleString()}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))
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
  header: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#2e7d32',
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
  headerSubtitle: {
    fontSize: 14,
    color: '#e8f5e9',
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8fff8',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8f5e9',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#1a331a',
    fontWeight: '600',
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8fff8',
    marginRight: 8,
    borderWidth: 1.5,
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
  categoryButtonActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  categoryText: {
    color: '#2e7d32',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  notificationsList: {
    marginBottom: 16,
  },
  notificationCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#2e7d32',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  notificationGradient: {
    padding: 16,
    borderRadius: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationTitleContainer: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 12,
  },
  notificationIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#a5d6a7',
    lineHeight: 18,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4caf50',
  },
  notificationTime: {
    fontSize: 12,
    color: '#81c784',
    marginTop: 4,
  },
});
