import { Platform } from 'react-native';
import Config from 'react-native-config';
import Constants from 'expo-constants';

// Hardcoded test ad unit IDs from Google AdMob documentation
const TestIds = {
  BANNER: Platform.select({
    ios: 'ca-app-pub-3940256099942544/2934735716',
    android: 'ca-app-pub-3940256099942544/6300978111',
    default: 'ca-app-pub-3940256099942544/6300978111',
  }),
  INTERSTITIAL: Platform.select({
    ios: 'ca-app-pub-3940256099942544/4411468910',
    android: 'ca-app-pub-3940256099942544/1033173712',
    default: 'ca-app-pub-3940256099942544/1033173712',
  }),
  REWARDED: Platform.select({
    ios: 'ca-app-pub-3940256099942544/1712485313',
    android: 'ca-app-pub-3940256099942544/5224354917',
    default: 'ca-app-pub-3940256099942544/5224354917',
  }),
  REWARDED_INTERSTITIAL: Platform.select({
    ios: 'ca-app-pub-3940256099942544/6978759866',
    android: 'ca-app-pub-3940256099942544/5354046379',
    default: 'ca-app-pub-3940256099942544/5354046379',
  }),
  NATIVE: 'ca-app-pub-3940256099942544/2247696110',
  NATIVE_VIDEO: 'ca-app-pub-3940256099942544/1044960115',
  ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/9214589741',
  APP_OPEN: 'ca-app-pub-3940256099942544/9257395921',
};

const expoExtra = Constants?.expoConfig?.extra || {};
const adUnitsExtra = expoExtra?.adUnits || {};
const useTestFallback = !!expoExtra?.adsFallbackToTestIds;

const toCamel = (str) => str.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const extraKeyFromEnvKey = (envKey) => {
  if (!envKey) return null;
  // IOS_BANNER_ID -> iosBanner, ANDROID_REWARDED_INTERSTITIAL_ID -> androidRewardedInterstitial
  return toCamel(envKey.replace(/^IOS_/, 'ios_').replace(/^ANDROID_/, 'android_').replace(/_id$/i, ''));
};

const getId = (testId, iosKey, androidKey) => {
  if (__DEV__) return testId;
  if (useTestFallback) return testId;
  const iosExtraKey = extraKeyFromEnvKey(iosKey);
  const androidExtraKey = extraKeyFromEnvKey(androidKey);
  const cfg = Platform.select({
    ios: Config[iosKey] || adUnitsExtra[iosExtraKey],
    android: Config[androidKey] || adUnitsExtra[androidExtraKey],
  });
  if (typeof cfg === 'string' && cfg.length > 0) return cfg;
  return null;
};

// Banner
export const bannerUnitId = getId(TestIds.BANNER, 'IOS_BANNER_ID', 'ANDROID_BANNER_ID');

// Interstitial (example)
export const interstitialUnitId = getId(TestIds.INTERSTITIAL, 'IOS_INTERSTITIAL_ID', 'ANDROID_INTERSTITIAL_ID');

// Rewarded
export const rewardedUnitId = getId(TestIds.REWARDED, 'IOS_REWARDED_ID', 'ANDROID_REWARDED_ID');

// Rewarded interstitial
export const rewardedInterstitialUnitId = getId(TestIds.REWARDED_INTERSTITIAL, 'IOS_REWARDED_INTERSTITIAL_ID', 'ANDROID_REWARDED_INTERSTITIAL_ID');

// Native
export const nativeUnitId = getId(TestIds.BANNER, 'IOS_NATIVE_ID', 'ANDROID_NATIVE_ID'); // No native test id; fallback banner prevents crash.
