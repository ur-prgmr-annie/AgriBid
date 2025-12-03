import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import { firestore, storage } from '../../config/firebase';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function FarmerProfileScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({
    fullName: '',
    phoneNumber: '',
    location: '',
    photoURL: '',
  });

  const [hasUser, setHasUser] = useState(true);

  // ─────────────────────────────
  // Load auth user + profile
  // ─────────────────────────────
  useEffect(() => {
    const auth = getAuth();
    const current = auth.currentUser;

    if (!current) {
      setHasUser(false);
      setLoading(false);
      return;
    }

    setUser(current);

    const loadProfile = async () => {
      try {
        const profileRef = doc(firestore, 'profiles', current.uid);
        const snap = await getDoc(profileRef);

        if (snap.exists()) {
          const data = snap.data();
          setProfile((prev) => ({
            ...prev,
            fullName: data.fullName || data.name || '',
            phoneNumber: data.phoneNumber || '',
            location: data.location || '',
            photoURL: data.photoURL || '',
          }));
        } else {
          setProfile((prev) => ({
            ...prev,
            fullName: current.displayName || '',
          }));
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        Alert.alert('Error', 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // ─────────────────────────────
  // WEB image upload
  // ─────────────────────────────
  const uploadImageWeb = async (file) => {
    if (!user) return;

    try {
      setSaving(true);

      const imageRef = ref(storage, `profile_pictures/${user.uid}.jpg`);
      await uploadBytes(imageRef, file);
      const downloadURL = await getDownloadURL(imageRef);

      const profileRef = doc(firestore, 'profiles', user.uid);

      await setDoc(
        profileRef,
        {
          photoURL: downloadURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setProfile((prev) => ({ ...prev, photoURL: downloadURL }));
      Alert.alert('Success', 'Profile picture updated!');
    } catch (err) {
      console.error('Error uploading image (web):', err);
      Alert.alert('Error', 'Failed to upload image.');
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    if (!user) return;

    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          uploadImageWeb(file);
        }
      };

      input.click();
    } else {
      Alert.alert(
        'Not implemented yet',
        'Image picking on device will be added later. For now, use the web version to upload a profile photo.'
      );
    }
  };

  // ─────────────────────────────
  // Save text fields to Firestore
  // ─────────────────────────────
  const handleSaveProfile = async () => {
    if (!user) return;

    if (!profile.fullName.trim()) {
      Alert.alert('Validation', 'Full name is required.');
      return;
    }

    try {
      setSaving(true);

      const profileRef = doc(firestore, 'profiles', user.uid);
      await setDoc(
        profileRef,
        {
          fullName: profile.fullName.trim(),
          phoneNumber: profile.phoneNumber.trim(),
          location: profile.location.trim(),
          email: user.email || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      Alert.alert('Success', 'Profile saved successfully.');
    } catch (err) {
      console.error('Error saving profile:', err);
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────
  // Logout handling (fixed for web + native)
  // ─────────────────────────────
  const actuallyLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      // 🔁 Make sure this path matches your login screen (e.g. /login or /auth/login)
      router.replace('/login');
    } catch (err) {
      console.error('Error logging out:', err);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const handleConfirmLogout = () => {
    if (Platform.OS === 'web') {
      // On web, Alert buttons don't work, so use window.confirm
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        actuallyLogout();
      }
    } else {
      // Native Alert with buttons
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes, logout',
          style: 'destructive',
          onPress: () => {
            actuallyLogout();
          },
        },
      ]);
    }
  };

  // ─────────────────────────────
  // Render states
  // ─────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (!hasUser) {
    return (
      <View style={[styles.container, styles.center, { padding: 16 }]}>
        <Text style={{ fontSize: 16, color: '#1a331a', textAlign: 'center' }}>
          Please sign in to edit your profile.
        </Text>
      </View>
    );
  }

  // ─────────────────────────────
  // Main UI
  // ─────────────────────────────
  const initials =
    profile.fullName && profile.fullName.trim().length > 0
      ? profile.fullName
          .split(' ')
          .map((p) => p[0])
          .join('')
          .toUpperCase()
      : 'F';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <LinearGradient
          colors={['#1a331a', '#2d4d2d']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.headerTitle}>Farmer Profile</Text>
          <Text style={styles.headerSubtitle}>
            Update your information and profile photo
          </Text>
        </LinearGradient>

        {/* CARD */}
        <View style={styles.card}>
          {/* Avatar */}
          <View style={styles.avatarRow}>
            <View style={styles.avatarContainer}>
              {profile.photoURL ? (
                <Image
                  source={{ uri: profile.photoURL }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
            </View>
            <View style={styles.avatarInfo}>
              <Text style={styles.nameText}>
                {profile.fullName || 'Your Name'}
              </Text>
              <Text style={styles.emailText}>{user?.email}</Text>

              <TouchableOpacity
                style={styles.changePhotoButton}
                onPress={handlePickImage}
                disabled={saving}
              >
                <Text style={styles.changePhotoText}>
                  {saving ? 'Uploading...' : 'Change Photo'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* FORM FIELDS */}
          <View style={styles.formSection}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              value={profile.fullName}
              onChangeText={(text) =>
                setProfile((prev) => ({ ...prev, fullName: text }))
              }
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 09XXXXXXXXX"
              keyboardType="phone-pad"
              value={profile.phoneNumber}
              onChangeText={(text) =>
                setProfile((prev) => ({ ...prev, phoneNumber: text }))
              }
            />

            <Text style={styles.label}>Location / Address</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Barangay, Municipality, Province"
              multiline
              value={profile.location}
              onChangeText={(text) =>
                setProfile((prev) => ({ ...prev, location: text }))
              }
            />
          </View>

          {/* SAVE BUTTON */}
          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.7 }]}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            <LinearGradient
              colors={['#4caf50', '#2e7d32']}
              style={styles.saveButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Profile'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* LOGOUT BUTTON */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleConfirmLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#e8f5e9',
  },
  card: {
    backgroundColor: '#f8fff8',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8f5e9',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  avatarRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#c8e6c9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a331a',
  },
  avatarInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a331a',
  },
  emailText: {
    fontSize: 13,
    color: '#4caf50',
    marginTop: 2,
    marginBottom: 8,
  },
  changePhotoButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4caf50',
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
  },
  changePhotoText: {
    color: '#2e7d32',
    fontSize: 12,
    fontWeight: '600',
  },
  formSection: {
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    color: '#1a331a',
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#c8e6c9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  saveButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e53935',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  logoutButtonText: {
    color: '#e53935',
    fontSize: 15,
    fontWeight: '700',
  },
});
