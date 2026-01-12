import { Platform } from 'react-native';
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
};

const extra = Constants.expoConfig?.extra || {};
const adUnits = extra.adUnits || {};
// Fallback to test IDs if in DEV mode or explicitly enabled in config
const useTestFallback = __DEV__ || !!extra.adsFallbackToTestIds;

const getUnitId = (testId, iosKey, androidKey) => {
  if (useTestFallback) {
    return testId;
  }

  const productionId = Platform.select({
    ios: adUnits[iosKey],
    android: adUnits[androidKey],
  });

  // If production ID is missing, you might want to return null or testId.
  // Returning testId ensures ad components don't crash but might show test ads in prod if config is missing.
  // Returning null might be safer for production to avoid policy violations.
  return productionId || null;
};

// Banner
export const bannerUnitId = getUnitId(TestIds.BANNER, 'iosBanner', 'androidBanner');

// Interstitial
export const interstitialUnitId = getUnitId(TestIds.INTERSTITIAL, 'iosInterstitial', 'androidInterstitial');

// Rewarded
export const rewardedUnitId = getUnitId(TestIds.REWARDED, 'iosRewarded', 'androidRewarded');

// Rewarded Interstitial
export const rewardedInterstitialUnitId = getUnitId(TestIds.REWARDED_INTERSTITIAL, 'iosRewardedInterstitial', 'androidRewardedInterstitial');

// Native
export const nativeUnitId = getUnitId(TestIds.NATIVE, 'iosNative', 'androidNative');
