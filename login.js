import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform,
  Image, StyleSheet, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      if (!user || !user.uid) {
        throw new Error('Unexpected login result: missing user ID');
      }

      // OPTIONAL: if backend requires auth token
      const idToken = await user.getIdToken();

      // Fetch user role from backend
      const response = await fetch(`http://localhost:5000/api/user/role?uid=${user.uid}`, 
 {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,  // include if your backend expects token
        }
      });

      const data = await response.json();
      console.log('Role data:', data);  // <-- ADDED LOG

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve user role');
      }

      const role = data.role || data.userType;
      if (role === 'farmer') {
        router.replace('/farmer/dashboard');
      } else if (role === 'buyer') {
        router.replace('/buyer/overview');
      } else {
        Alert.alert('Error', 'User role is invalid. Please contact support.');
      }

    } catch (error) {
      console.log('Login error code:', error.code);
      console.log('Login error message:', error.message);
      let message = error.message;
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with that email.';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Incorrect password. Please try again.';
      }
      Alert.alert('Login Failed', message);
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
          <Text style={styles.headerTitle}>Welcome Back</Text>
          <Text style={styles.headerSubtitle}>Sign in to your account</Text>
        </LinearGradient>

        <LinearGradient
          colors={['#1a331a', '#2d4d2d']}
          style={styles.form}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#81c784"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#81c784"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity style={styles.forgotPassword} disabled={loading}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <LinearGradient
              colors={['#4caf50', '#2e7d32']}
              style={styles.primaryButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Signing In...' : 'Sign In'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/register')} disabled={loading}>
              <Text style={styles.registerLink}>Sign Up</Text>
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent:'center', alignItems:'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    shadowColor:'#4caf50', shadowOffset:{width:0,height:0},
    shadowOpacity:0.6, shadowRadius:20, elevation:15, overflow:'hidden'
  },
  logoImage: { width:'100%', height:'100%' },
  headerTitle: { fontSize:28, fontWeight:'bold', color:'#ffffff', marginBottom:8, textAlign:'center' },
  headerSubtitle: { fontSize:16, color:'#a5d6a7', textAlign:'center' },
  form: {
    margin:16, padding:24, borderRadius:16,
    shadowColor:'#000', shadowOffset:{width:0,height:4},
    shadowOpacity:0.3, shadowRadius:12, elevation:8
  },
  inputGroup: { marginBottom:20 },
  label: { fontSize:16, fontWeight:'600', color:'#ffffff', marginBottom:8 },
  input: {
    borderWidth:1, borderColor:'#4caf50', borderRadius:8,
    paddingHorizontal:16, paddingVertical:14, fontSize:16,
    backgroundColor:'rgba(76,175,80,0.1)', color:'#ffffff'
  },
  forgotPassword: { alignSelf:'flex-end', marginBottom:24 },
  forgotPasswordText: { color:'#4caf50', fontSize:14, fontWeight:'500' },
  primaryButton: { borderRadius:12, overflow:'hidden', marginBottom:16,
    shadowColor:'#000', shadowOffset:{width:0,height:4},
    shadowOpacity:0.3, shadowRadius:8, elevation:6 },
  buttonDisabled: { opacity:0.6 },
  primaryButtonGradient: { padding:16, borderRadius:12, alignItems:'center' },
  primaryButtonText: { color:'white', fontSize:16, fontWeight:'bold' },
  divider: { flexDirection:'row', alignItems:'center', marginBottom:24 },
  dividerLine: { flex:1, height:1, backgroundColor:'#4caf50', opacity:0.3 },
  dividerText: { color:'#a5d6a7', paddingHorizontal:16, fontSize:14 },
  registerContainer: { flexDirection:'row', justifyContent:'center', alignItems:'center' },
  registerText: { color:'#a5d6a7', fontSize:14 },
  registerLink: { color:'#4caf50', fontSize:14, fontWeight:'bold' },
});
