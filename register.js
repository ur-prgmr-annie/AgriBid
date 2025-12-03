import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform,
  Image, StyleSheet, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';  // your centralized Firebase auth

export default function RegisterScreen() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    userType: 'farmer'
  });
  const [loading, setLoading] = useState(false);

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRegister = async () => {
    const { fullName, email, phone, password, confirmPassword, userType } = formData;

    if (!fullName || !email || !phone || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // You may or may not need a token if your backend expects it
      const idToken = await user.getIdToken();

      const response = await fetch('http://localhost:5000/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ fullName, phone, userType })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server error while saving profile');
      }

      // Success: do *not* log the user in automatically
      Alert.alert('Success', 'Account has been created! Please sign in.');

      // Redirect to login screen
      router.replace('/login');

    } catch (error) {
      let message = error.message;
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email address is already in use. Please login instead.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'The email address is invalid.';
      } else if (error.code === 'auth/weak-password') {
        message = 'The password is too weak. Please choose a stronger password.';
      }
      Alert.alert('Registration Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#1a331a', '#2d4d2d']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.logoContainer}>
            <View style={styles.logoPlaceholder}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSubtitle}>Join our farming community</Text>
        </LinearGradient>

        <LinearGradient
          colors={['#1a331a', '#2d4d2d']}
          style={styles.form}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#81c784"
              value={formData.fullName}
              onChangeText={text => updateFormData('fullName', text)}
              editable={!loading}
            />
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#81c784"
              value={formData.email}
              onChangeText={text => updateFormData('email', text)}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          {/* Phone Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your phone number"
              placeholderTextColor="#81c784"
              value={formData.phone}
              onChangeText={text => updateFormData('phone', text)}
              keyboardType="phone-pad"
              editable={!loading}
            />
          </View>

          {/* User Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>I am a</Text>
            <View style={styles.userTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.userTypeButton,
                  formData.userType === 'farmer' && styles.userTypeButtonActive
                ]}
                onPress={() => updateFormData('userType', 'farmer')}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.userTypeText,
                    formData.userType === 'farmer' && styles.userTypeTextActive
                  ]}
                >
                  Farmer
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.userTypeButton,
                  formData.userType === 'buyer' && styles.userTypeButtonActive
                ]}
                onPress={() => updateFormData('userType', 'buyer')}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.userTypeText,
                    formData.userType === 'buyer' && styles.userTypeTextActive
                  ]}
                >
                  Buyer
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              placeholderTextColor="#81c784"
              value={formData.password}
              onChangeText={text => updateFormData('password', text)}
              secureTextEntry
              editable={!loading}
            />
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm your password"
              placeholderTextColor="#81c784"
              value={formData.confirmPassword}
              onChangeText={text => updateFormData('confirmPassword', text)}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <LinearGradient
              colors={['#4caf50', '#2e7d32']}
              style={styles.primaryButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/login')} disabled={loading}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

        </LinearGradient>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1f0d' },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: { paddingHorizontal: 24, paddingVertical: 40, paddingTop: 80, alignItems: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  logoPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#4caf50', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 20, elevation: 15, overflow: 'hidden'
  },
  logoImage: { width: '100%', height: '100%' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#ffffff', marginBottom: 8, textAlign: 'center' },
  headerSubtitle: { fontSize: 16, color: '#a5d6a7', textAlign: 'center' },
  form: {
    margin: 16, padding: 24, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8
  },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#4caf50', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    backgroundColor: 'rgba(76, 175, 80, 0.1)', color: '#ffffff'
  },
  userTypeContainer: { flexDirection: 'row', backgroundColor: 'rgba(76, 175, 80, 0.1)', borderRadius: 8, padding: 4 },
  userTypeButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 6 },
  userTypeButtonActive: { backgroundColor: '#4caf50' },
  userTypeText: { color: '#a5d6a7', fontWeight: '500' },
  userTypeTextActive: { color: '#ffffff', fontWeight: 'bold' },
  primaryButton: {
    borderRadius: 12, overflow: 'hidden', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonGradient: { padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#4caf50', opacity: 0.3 },
  dividerText: { color: '#a5d6a7', paddingHorizontal: 16, fontSize: 14 },
  loginContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { color: '#a5d6a7', fontSize: 14 },
  loginLink: { color: '#4caf50', fontSize: 14, fontWeight: 'bold' },
});
