import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import i18n from './src/i18n';
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
import { adUnits } from './src/config/adUnits';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { dark } = useAppTheme();

  const ADS = {
    REWARDED_INTERSTITIAL: adUnits.REWARDED_INTERSTITIAL,
    REWARDED: adUnits.REWARDED,
    INTERSTITIAL: adUnits.INTERSTITIAL,
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
    prefixes: ['app:///'],
    config: { screens: { Disclaimer: 'disclaimer' } }
  };

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' },
          headerTitleStyle: { color: dark ? '#e6edf3' : '#0b1220', fontWeight: '700' },
          headerTintColor: dark ? '#e6edf3' : '#0b1220',
          headerShadowVisible: true,
          contentStyle: { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }
        }}
      >
        <Stack.Screen
          name="Home"
          component={ScanSelectScreen}
          options={({ navigation }) => ({
            title: i18n.t('app.title'),
            headerTitleAlign: 'center',

            headerLeft: () => (
              <TouchableOpacity
                onPress={async () => { try { await runHistoryGate(); } catch {} navigation.navigate('History'); }}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: dark ? '#243044' : '#dbe2ea',
                  backgroundColor: dark ? '#172031' : '#eef3f9'
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
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
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: dark ? '#3b2c52' : '#e3def8',
                  backgroundColor: dark ? '#1f1630' : '#f4f1fb'
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="settings-outline"
                  size={18}
                  color={dark ? '#c1b6ff' : '#6c5ce7'}
                />
              </TouchableOpacity>
            )
          })}
        />
        <Stack.Screen name="LinkScan" component={LinkScanScreen} options={{ title: i18n.t('scan.link') }} />
        <Stack.Screen name="CodeScan" component={CodeScanScreen} options={{ title: i18n.t('scan.code') }} />
        <Stack.Screen name="ImageScan" component={ImageScanScreen} options={{ title: i18n.t('scan.image') }} />
        <Stack.Screen name="CreateQR" component={CreateQrScreen} options={{ title: i18n.t('scan.create') }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: i18n.t('history.title') }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: i18n.t('settings.title') }} />
        <Stack.Screen name="Premium" component={PremiumScreen} options={{ title: i18n.t('settings.premiumTitle') }} />
        <Stack.Screen name="Disclaimer" component={DisclaimerScreen} options={{ title: i18n.t('disclaimer.title'), presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [consented, setConsented] = useState(null);

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
        const mod = await import('react-native-google-mobile-ads');
        try { await mod?.mobileAds()?.initialize(); } catch {}
      } catch {}
    })();
  }, []);

  return (
    <ThemeProvider>
      <RootNavigator />
      <StatusBar style={consented === true ? 'auto' : 'light'} />
      <ConsentModal visible={consented === false} onAccept={async () => { await setConsent(); setConsented(true); }} />
    </ThemeProvider>
  );
}
