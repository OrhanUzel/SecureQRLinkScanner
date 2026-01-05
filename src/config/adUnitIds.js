import { Platform } from 'react-native';
import Config from 'react-native-config';
import { TestIds } from 'react-native-google-mobile-ads';

// Banner
export const bannerUnitId = __DEV__
  ? TestIds.BANNER
  : Platform.select({
      ios: Config.IOS_BANNER_ID,
      android: Config.ANDROID_BANNER_ID,
    });

// Interstitial (example)
export const interstitialUnitId = __DEV__
  ? TestIds.INTERSTITIAL
  : Platform.select({
      ios: Config.IOS_INTERSTITIAL_ID,
      android: Config.ANDROID_INTERSTITIAL_ID,
    });

// Rewarded
export const rewardedUnitId = __DEV__
  ? TestIds.REWARDED
  : Platform.select({
      ios: Config.IOS_REWARDED_ID,
      android: Config.ANDROID_REWARDED_ID,
    });

// Rewarded interstitial
export const rewardedInterstitialUnitId = __DEV__
  ? TestIds.REWARDED_INTERSTITIAL
  : Platform.select({
      ios: Config.IOS_REWARDED_INTERSTITIAL_ID,
      android: Config.ANDROID_REWARDED_INTERSTITIAL_ID,
    });

// Native
export const nativeUnitId = __DEV__
  ? TestIds.BANNER // There is no native test id; fallback banner prevents crash.
  : Platform.select({
      ios: Config.IOS_NATIVE_ID,
      android: Config.ANDROID_NATIVE_ID,
    });
