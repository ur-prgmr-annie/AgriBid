import { View, Text, Dimensions, Animated, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { useEffect, useRef } from 'react';

const { width, height } = Dimensions.get('window');

export default function LoadingScreen() {
  const router = useRouter();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Main entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: false,
      })
    ]).start();

    // Redirect to login after 3 seconds
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const floatInterpolate = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -15]
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <LinearGradient
      colors={['#0d1f0d', '#1a331a', '#2d4d2d']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Animated Background Elements */}
      <Animated.View 
        style={[
          styles.orb1,
          {
            transform: [{ translateY: floatInterpolate }],
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.15]
            })
          }
        ]} 
      />
      
      <Animated.View 
        style={[
          styles.orb2,
          {
            transform: [{ translateY: floatInterpolate.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 10]
            }) }],
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.1]
            })
          }
        ]} 
      />

      <View style={styles.content}>
        {/* Logo with Glow Effect */}
        <Animated.View 
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideUpAnim },
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          <View style={styles.logoGlow} />
          <View style={styles.logoPlaceholder}>
            {/* Using your actual logo */}
            <Image 
              source={require('../assets/logo.png')} // Correct path to your logo
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Main Content */}
        <Animated.View 
          style={[
            styles.mainContent,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideUpAnim.interpolate({
                  inputRange: [0, 40],
                  outputRange: [0, 20]
                }) }
              ]
            }
          ]}
        >
          <Text style={styles.title}>AGRIBID</Text>
          <View style={styles.titleLine} />
          <Text style={styles.subtitle}>
            SMART AGRICULTURAL TRADING
          </Text>
          <Text style={styles.description}>
            Connecting farmers and buyers through intelligent trading
          </Text>
        </Animated.View>

        {/* Loading Progress Bar */}
        <Animated.View 
          style={[
            styles.loadingContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideUpAnim.interpolate({
                  inputRange: [0, 40],
                  outputRange: [0, 30]
                }) }
              ]
            }
          ]}
        >
          <View style={styles.progressBackground}>
            <Animated.View 
              style={[
                styles.progressFill,
                { width: progressWidth }
              ]} 
            />
          </View>
          <Text style={styles.loadingText}>Initializing platform...</Text>
        </Animated.View>

        {/* Features Badge */}
        <Animated.View 
          style={[
            styles.techBadge,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideUpAnim.interpolate({
                  inputRange: [0, 40],
                  outputRange: [0, 10]
                }) }
              ]
            }
          ]}
        >
          <Text style={styles.techText}>SECURE • REAL-TIME • AI-POWERED</Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 120,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  orb1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#4caf50',
    top: -200,
    right: -100,
    opacity: 0.15,
  },
  orb2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#81c784',
    bottom: -150,
    left: -100,
    opacity: 0.1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#4caf50',
    opacity: 0.3,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#4caf50',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  mainContent: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 52,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: 2,
    textShadowColor: 'rgba(76, 175, 80, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  titleLine: {
    width: 100,
    height: 4,
    backgroundColor: '#4caf50',
    borderRadius: 2,
    marginBottom: 20,
    shadowColor: '#4caf50',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#a5d6a7',
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 14,
    color: '#e8f5e8',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    opacity: 0.9,
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  progressBackground: {
    width: '80%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4caf50',
    borderRadius: 3,
  },
  loadingText: {
    fontSize: 14,
    color: '#a5d6a7',
    textAlign: 'center',
  },
  techBadge: {
    alignItems: 'center',
  },
  techText: {
    fontSize: 10,
    color: '#81c784',
    letterSpacing: 1,
    textAlign: 'center',
    opacity: 0.7,
  },
});