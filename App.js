import React, { useEffect, useState, useRef } from 'react';
import { TouchableOpacity, Platform, AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import * as QuickActions from 'expo-quick-actions';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Purchases from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';



// Ekranlar
import ScanSelectScreen from './src/screens/ScanSelectScreen';
import LinkScanScreen from './src/screens/LinkScanScreen';
import CodeScanScreen from './src/screens/CodeScanScreen';
import ImageScanScreen from './src/screens/ImageScanScreen';
import CreateQrScreen from './src/screens/CreateQrScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import DisclaimerScreen from './src/screens/DisclaimerScreen';
import OnboardingScreen, { checkOnboarding } from './src/screens/OnboardingScreen';
import WebViewScreen from './src/screens/WebViewScreen';

// Bileşenler ve Utils
import ConsentModal, { hasConsent, setConsent } from './src/components/ConsentModal';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { appEvents } from './src/utils/events';
import AdBanner from './src/components/AdBanner'; // Senin AdBanner bileşenin

const Stack = createNativeStackNavigator();

// Reklamın GÖRÜNMEMESİ gereken ekranlar
const HIDDEN_AD_SCREENS = [
  // 'Onboarding',
  
];

function RootNavigator() {
  const { dark } = useAppTheme();
  const { t } = useTranslation();
  const [initialRoute, setInitialRoute] = useState(null);
  
  // Navigasyon referansı ve mevcut rota takibi
  const navigationRef = useNavigationContainerRef();
  const [currentRouteName, setCurrentRouteName] = useState(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    QuickActions.setItems([
      {
        title: t('scan.code') || "Güvenli Kod Tarama",
        subtitle: t('app.title') || "Secure QR Link Scanner",
        icon: Platform.select({ ios: "symbol:qrcode.viewfinder", android: "ic_launcher" }), 
        id: "scan",
        params: { href: "secureqrlinkscanner://scan" },
      },
    ]);

    let isMounted = true;

    const initialize = async () => {
      // 1. Initialize Tracking (iOS ATT)
      // We do this first to ensure subsequent ad requests respect the user's choice
      try {
        if (Platform.OS === 'ios') {
          // Wait a bit to ensure app is fully active (sometimes needed for prompt)
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { status } = await requestTrackingPermissionsAsync();
          console.log('[App] Tracking permission status:', status);
        }
      } catch (e) {
        console.log('Tracking permission failed:', e?.message || e);
      }

      // 2. Initialize Mobile Ads SDK
      // The SDK initialization itself doesn't show ads, but prepares the environment.
      // Actual ad requests (in components/hooks) will now check the ATT status we just requested.
      try {
        if (!isMounted) return;
        const mod = await import('react-native-google-mobile-ads');
        await mod.mobileAds().initialize();
        console.log('[App] MobileAds initialized');
      } catch (e) {
        console.log('MobileAds init failed:', e?.message || e);
      }
    };

    initialize();

    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    (async () => {
      const seen = await checkOnboarding();
      const route = seen ? 'Home' : 'Onboarding';
      setInitialRoute(route);
      setCurrentRouteName(route); // İlk açılış rotasını set et
    })();
  }, []);

  if (!initialRoute) return null;

  // Deep Linking Config
  const linking = {
    prefixes: ['app:///', 'secureqrlinkscanner://', 'https://', 'http://'],
    config: { 
      screens: { 
        Disclaimer: 'disclaimer',
        WebView: { path: 'webview/:url?', parse: { url: (url) => url ? decodeURIComponent(url) : undefined } },
        LinkScan: { path: 'linkscan/:url?', parse: { url: (url) => url ? decodeURIComponent(url) : undefined } },
        CodeScan: 'scan',
        ImageScan: { path: 'imagescan/:imageUri?', parse: { imageUri: (value) => value ? decodeURIComponent(value) : undefined } }
      } 
    },
    async getInitialURL() {
      const url = await Linking.getInitialURL();
      if (url) return url;
      const action = QuickActions.initial;
      if (action?.params?.href) return action.params.href;
      return null;
    },
    subscribe(listener) {
      const onReceiveURL = ({ url }) => listener(url);
      const subscription = Linking.addEventListener('url', onReceiveURL);
      
      const subscriptionQuickActions = QuickActions.addListener((action) => {
        if (action?.params?.href) {
          listener(action.params.href);
        }
      });

      return () => {
        subscription?.remove();
        subscriptionQuickActions?.remove();
      };
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }}>
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        onStateChange={() => {
          // Sayfa her değiştiğinde yeni sayfanın ismini alıyoruz
          const route = navigationRef.getCurrentRoute();
          setCurrentRouteName(route?.name);
        }}
      >
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerStyle: { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' },
            headerTitleStyle: { color: dark ? '#e6edf3' : '#0b1220', fontWeight: '700' },
            headerTintColor: dark ? '#e6edf3' : '#0b1220',
            headerShadowVisible: true,
            contentStyle: { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' },
          }}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
          
          <Stack.Screen
            name="Home"
            component={ScanSelectScreen}
            options={({ navigation }) => ({
              title: t('app.title'),
              headerTitleAlign: 'center',
              headerLeft: () => (
                <TouchableOpacity
                  onPress={() => { navigation.navigate('History'); }}
                  activeOpacity={0.7}
                  style={Platform.OS === 'ios' ? { paddingHorizontal: 10 } : { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: dark ? '#243044' : '#dbe2ea', backgroundColor: dark ? '#172031' : '#eef3f9' }}
                >
                  <Ionicons name="time-outline" size={24} color={dark ? '#9ecaff' : '#0066cc'} />
                </TouchableOpacity>
              ),
              headerRight: () => (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Settings')}
                  activeOpacity={0.7}
                  style={Platform.OS === 'ios' ? { paddingHorizontal: 10 } : { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: dark ? '#3b2c52' : '#e3def8', backgroundColor: dark ? '#1f1630' : '#f4f1fb' }}
                >
                  <Ionicons name="settings-outline" size={24} color={dark ? '#c1b6ff' : '#6c5ce7'} />
                </TouchableOpacity>
              )
            })}
          />
          
          <Stack.Screen name="LinkScan" component={LinkScanScreen} options={{ title: t('scan.link') }} />
          <Stack.Screen name="CodeScan" component={CodeScanScreen} options={{ title: t('scan.code') }} />
          <Stack.Screen name="ImageScan" component={ImageScanScreen} options={{ title: t('scan.image') }} />
          <Stack.Screen name="WebView" component={WebViewScreen} options={{ title: t('scan.link') }} />
          <Stack.Screen name="CreateQR" component={CreateQrScreen} options={{ title: t('scan.create') }} />
          <Stack.Screen name="History" component={HistoryScreen} options={{ title: t('history.title') }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('settings.title') }} />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{
              headerShown: false,
              presentation: 'modal',
              animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            }}
          />
          <Stack.Screen name="Disclaimer" component={DisclaimerScreen} options={{ title: t('disclaimer.title'), presentation: 'modal' }} />
        </Stack.Navigator>

      </NavigationContainer>

      {/* GLOBAL BANNER REKLAM 
          1. Navigasyonun DIŞINDA (böylece sayfa değişse de sabit kalır)
          2. Yasaklı ekranlarda GİZLİ
          3. isFooter={true} ile Safe Area padding otomatik eklenir
      */}
      {/* 
      {currentRouteName && !HIDDEN_AD_SCREENS.includes(currentRouteName) && (
        <AdBanner isFooter={true} placement="global_footer" />
      )}
      */}
      
    </View>
  );
}

export default function App() {
  const [consented, setConsented] = useState(null);
  const [onboardingSeen, setOnboardingSeen] = useState(null);

  useEffect(() => {
    (async () => {
      const ok = await hasConsent();
      setConsented(ok);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const seen = await checkOnboarding();
        setOnboardingSeen(seen);
      } catch { setOnboardingSeen(true); }
    })();
    const off = appEvents.on?.('onboardingFinished', () => { setOnboardingSeen(true); });
    return () => { try { appEvents.off?.('onboardingFinished', off); } catch {} };
  }, []);

  
  // RevenueCat Setup & Premium Check
  useEffect(() => {
    const setupRevenueCat = async () => {
      try {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);

        if (Platform.OS === 'android') {
          await Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_FOR_GOOGLE_PLAY });
        } else if (Platform.OS === 'ios') {
          await Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_FOR_APPLE });
        }

        const updatePremiumStatus = async (customerInfo) => {
          try {
            // Check for ANY active entitlement, not just 'pro'
            // This is more robust if the user used a different identifier in RevenueCat
            const activeEntitlements = customerInfo?.entitlements?.active || {};
            const activeKeys = Object.keys(activeEntitlements);
            const isPro = activeKeys.length > 0;
            
            await AsyncStorage.setItem('premium', isPro ? 'true' : 'false');
            
            if (isPro) {
              // Get the first active entitlement to determine plan details
              const entitlement = activeEntitlements[activeKeys[0]];
              const pid = entitlement.productIdentifier.toLowerCase();
              
              let type = 'subscription';
              if (pid.includes('lifetime')) type = 'lifetime';
              else if (pid.includes('year') || pid.includes('annual')) type = 'yearly';
              else if (pid.includes('month')) type = 'monthly';
              else if (pid.includes('week')) type = 'weekly';
              
              const info = {
                type,
                planName: 'Premium', 
                purchaseDate: entitlement.latestPurchaseDate,
                expiryDate: entitlement.expirationDate,
                identifier: entitlement.productIdentifier
              };
              
              await AsyncStorage.setItem('premium_info', JSON.stringify(info));
            } else {
              await AsyncStorage.removeItem('premium_info');
            }

            appEvents.emit('premiumChanged', isPro);
          } catch (e) {
            console.log('Error updating premium status:', e);
          }
        };

        // Initial check
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          await updatePremiumStatus(customerInfo);
        } catch {}

        // Listener for real-time updates
        Purchases.addCustomerInfoUpdateListener(updatePremiumStatus);
        
        // Load offerings
        await Purchases.getOfferings();
      } catch (e) {
        console.log('RevenueCat setup failed:', e);
      }
    };

    setupRevenueCat();

    // AppState listener to refresh status on resume
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        Purchases.getCustomerInfo().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);




  
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <RootNavigator />
          <StatusBar style={consented === true ? 'auto' : 'light'} />
          <ConsentModal
            visible={consented === false && onboardingSeen === true}
            onAccept={async () => {
              await setConsent();
              setConsented(true);
            }}
          />
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
