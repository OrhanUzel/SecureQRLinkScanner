import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Platform, AppState, NativeModules } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import i18n, { setLanguage } from './src/i18n';
import { useTranslation } from 'react-i18next';
import ScanSelectScreen from './src/screens/ScanSelectScreen';
import LinkScanScreen from './src/screens/LinkScanScreen';
import CodeScanScreen from './src/screens/CodeScanScreen';
import ImageScanScreen from './src/screens/ImageScanScreen';
import CreateQrScreen from './src/screens/CreateQrScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PremiumScreen from './src/screens/PremiumScreen';
import DisclaimerScreen from './src/screens/DisclaimerScreen';
import ConsentModal, { hasConsent, setConsent } from './src/components/ConsentModal';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { loadBlacklist } from './src/utils/classifier';
import { rewardedUnitId, interstitialUnitId, rewardedInterstitialUnitId } from './src/config/adUnitIds';

import OnboardingScreen, { checkOnboarding } from './src/screens/OnboardingScreen';
import { appEvents } from './src/utils/events';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { dark } = useAppTheme();
  const { t } = useTranslation();
  const [initialRoute, setInitialRoute] = useState(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const mod = await import('react-native-google-mobile-ads');
        console.log('[ads][init][root] requesting initialize (default())');
        const result = await mod.default().initialize();
        console.log('[ads][init][root] initialized', { adapterStatuses: result?.adapterStatuses ? Object.keys(result.adapterStatuses) : undefined });
      } catch (e) {
        console.log('[ads][init][root][error]', e?.message || e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const seen = await checkOnboarding();
      setInitialRoute(seen ? 'Home' : 'Onboarding');
    })();
  }, []);

  if (!initialRoute) return null; // or a loading spinner

  const ADS = {
    REWARDED_INTERSTITIAL: rewardedInterstitialUnitId,
    REWARDED: rewardedUnitId,
    INTERSTITIAL: interstitialUnitId,
  };

  const runHistoryGate = async () => {
    if (Platform.OS === 'web') return true;
    let mod = null;
    try { mod = await import('react-native-google-mobile-ads'); } catch {}
    if (!mod) return true;
    const { RewardedInterstitialAd, RewardedAd, InterstitialAd, AdEventType, RewardedAdEventType } = mod;
    const tryRewardedInterstitial = async () => {
      if (typeof ADS.REWARDED_INTERSTITIAL !== 'string' || !ADS.REWARDED_INTERSTITIAL) throw new Error('missing_unit');
      const ad = RewardedInterstitialAd.createForAdRequest(ADS.REWARDED_INTERSTITIAL, { requestNonPersonalizedAdsOnly: true });
      await new Promise((resolve, reject) => {
        let earned = false;
        const ul = ad.addAdEventListener(AdEventType.LOADED, () => { ad.show(); });
        const ue = ad.addAdEventListener(AdEventType.ERROR, () => { cleanup(); reject(new Error('ad_error')); });
        const uc = ad.addAdEventListener(AdEventType.CLOSED, () => { cleanup(); if (earned) resolve(true); else reject(new Error('closed')); });
        const ur = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
        const cleanup = () => { ul(); ue(); uc(); ur(); };
        ad.load();
      });
    };
    const tryRewarded = async () => {
      if (typeof ADS.REWARDED !== 'string' || !ADS.REWARDED) throw new Error('missing_unit');
      const ad = RewardedAd.createForAdRequest(ADS.REWARDED, { requestNonPersonalizedAdsOnly: true });
      await new Promise((resolve, reject) => {
        let earned = false;
        const ul = ad.addAdEventListener(AdEventType.LOADED, () => { ad.show(); });
        const ue = ad.addAdEventListener(AdEventType.ERROR, () => { cleanup(); reject(new Error('ad_error')); });
        const uc = ad.addAdEventListener(AdEventType.CLOSED, () => { cleanup(); if (earned) resolve(true); else reject(new Error('closed')); });
        const ur = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
        const cleanup = () => { ul(); ue(); uc(); ur(); };
        ad.load();
      });
    };
    const tryInterstitial = async () => {
      if (typeof ADS.INTERSTITIAL !== 'string' || !ADS.INTERSTITIAL) throw new Error('missing_unit');
      const ad = InterstitialAd.createForAdRequest(ADS.INTERSTITIAL, { requestNonPersonalizedAdsOnly: true });
      await new Promise((resolve, reject) => {
        const ul = ad.addAdEventListener(AdEventType.LOADED, () => { ad.show(); });
        const ue = ad.addAdEventListener(AdEventType.ERROR, () => { cleanup(); reject(new Error('ad_error')); });
        const uc = ad.addAdEventListener(AdEventType.CLOSED, () => { cleanup(); resolve(true); });
        const cleanup = () => { ul(); ue(); uc(); };
        ad.load();
      });
    };
    try { await tryRewardedInterstitial(); return true; } catch {}
    try { await tryRewarded(); return true; } catch {}
    try { await tryInterstitial(); return true; } catch {}
    return true;
  };

  const linking = {
    prefixes: ['app:///', 'secureqrlinkscanner://', 'https://', 'http://'],
    config: { 
      screens: { 
        Disclaimer: 'disclaimer',
        LinkScan: {
          path: 'linkscan/:url?',
          parse: {
            url: (url) => url ? decodeURIComponent(url) : undefined
          }
        },
        ImageScan: {
          path: 'imagescan/:imageUri?',
          parse: {
            imageUri: (value) => value ? decodeURIComponent(value) : undefined
          }
        }
      } 
    },
    async getInitialURL() {
      // Check if app was opened from a deep link
      const url = await Linking.getInitialURL();
      if (url != null) {
        return url;
      }
      // Handle Android share intent
      if (Platform.OS === 'android') {
        // expo-linking should handle this, but we can add custom logic here if needed
        return url;
      }
      return url;
    },
    subscribe(listener) {
      // Handle deep links while app is running
      const onReceiveURL = ({ url }) => {
        listener(url);
      };
      // Listen to incoming links from deep linking
      const subscription = Linking.addEventListener('url', onReceiveURL);
      return () => {
        subscription?.remove();
      };
    }
  };

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' },
          headerTitleStyle: { color: dark ? '#e6edf3' : '#0b1220', fontWeight: '700' },
          headerTintColor: dark ? '#e6edf3' : '#0b1220',
          headerShadowVisible: true,
          contentStyle: { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' },
          headerBackTitle: t('actions.mainMenu'),
          headerBackAccessibilityLabel: t('actions.mainMenu')
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
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: dark ? '#243044' : '#dbe2ea',
                  backgroundColor: dark ? '#172031' : '#eef3f9'
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={dark ? '#9ecaff' : '#0066cc'}
                />
              </TouchableOpacity>
            ),
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('Settings')}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: dark ? '#3b2c52' : '#e3def8',
                  backgroundColor: dark ? '#1f1630' : '#f4f1fb'
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="settings-outline"
                  size={20}
                  color={dark ? '#c1b6ff' : '#6c5ce7'}
                />
              </TouchableOpacity>
            )
          })}
        />
        <Stack.Screen name="LinkScan" component={LinkScanScreen} options={{ title: t('scan.link') }} />
        <Stack.Screen name="CodeScan" component={CodeScanScreen} options={{ title: t('scan.code') }} />
        <Stack.Screen name="ImageScan" component={ImageScanScreen} options={{ title: t('scan.image') }} />
        <Stack.Screen name="CreateQR" component={CreateQrScreen} options={{ title: t('scan.create') }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: t('history.title') }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('settings.title') }} />
        <Stack.Screen name="Premium" component={PremiumScreen} options={{ title: t('settings.premiumTitle') }} />
        <Stack.Screen name="Disclaimer" component={DisclaimerScreen} options={{ title: t('disclaimer.title'), presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [consented, setConsented] = useState(null);
  const [onboardingSeen, setOnboardingSeen] = useState(null);

  useEffect(() => {
    (async () => {
      const ok = await hasConsent();
      setConsented(ok);
      // Blacklist ön yükleme devre dışı (isteğe bağlı):
      // try { await loadBlacklist(); } catch {}
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

  useEffect(() => {
    (async () => {
      try {
        const mod = await import('react-native-google-mobile-ads');
        console.log('[ads][init][shell] requesting initialize (mobileAds())');
        try { 
          const result = await mod?.mobileAds()?.initialize(); 
          console.log('[ads][init][shell] initialized', { adapterStatuses: result?.adapterStatuses ? Object.keys(result.adapterStatuses) : undefined });
        } catch (err) { 
          console.log('[ads][init][shell][error]', err?.message || err); 
        }
      } catch (e) {
        console.log('[ads][init][shell][import_error]', e?.message || e);
      }
    })();
  }, []);



  useEffect(() => {
    const refreshPremium = async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        let hasPremium = false;
        try {
          const iap = await import('react-native-iap');
          let purchases = [];
          try { purchases = await iap.getAvailablePurchases(); } catch {}
          hasPremium = purchases?.some(p => p.productId === 'premium_lifetime' || p.productId === 'secure_qr_link_scanner');
        } catch {}
        try { await AsyncStorage.setItem('premium', hasPremium ? 'true' : 'false'); } catch {}//await AsyncStorage.setItem('premium', 'false');
      } catch {}
    };
    refreshPremium();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshPremium(); });
    return () => { try { sub?.remove?.(); } catch {} };
  }, []);

  return (
    <ThemeProvider>
      <RootNavigator />
      <StatusBar style={consented === true ? 'auto' : 'light'} />
      <ConsentModal visible={consented === false && onboardingSeen === true} onAccept={async () => { await setConsent(); setConsented(true); }} />
    </ThemeProvider>
  );
}
