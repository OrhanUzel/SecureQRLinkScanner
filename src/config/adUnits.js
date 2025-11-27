import Constants from 'expo-constants';

const extra = Constants?.expoConfig?.extra?.admob || {};

export const adUnits = {
  REWARDED_INTERSTITIAL: extra.rewardedInterstitial || null,
  REWARDED: extra.rewarded || null,
  INTERSTITIAL: extra.interstitial || null,
  NATIVE: extra.native || null,
  BANNER: extra.banner || null,
};