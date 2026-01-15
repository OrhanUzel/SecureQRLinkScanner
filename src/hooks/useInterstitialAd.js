import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { interstitialUnitId } from '../config/adUnitIds';
import { hasConsent } from '../components/ConsentModal';

let InterstitialAd, AdEventType;

try {
  if (Platform.OS !== 'web') {
    const MobileAds = require('react-native-google-mobile-ads');
    InterstitialAd = MobileAds.InterstitialAd;
    AdEventType = MobileAds.AdEventType;
  }
} catch (e) {
  console.log('Ads not available');
}

export function useInterstitialAd(enabled = true) {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || !InterstitialAd || !enabled) return;
    if (loadedRef.current) return;

    let ad = null;
    let unsubscribeLoaded = null;
    let unsubscribeError = null;
    let isMounted = true;

    const loadAndShow = async () => {
      try {
        const userConsented = await hasConsent();
        if (!isMounted) return;
        
        const requestOptions = { requestNonPersonalizedAdsOnly: !userConsented };
        ad = InterstitialAd.createForAdRequest(interstitialUnitId, requestOptions);

        unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
          if (isMounted && enabled) {
            try {
              ad.show();
              loadedRef.current = true;
            } catch (e) {}
          }
        });

        unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {});

        ad.load();
      } catch (e) {}
    };

    loadAndShow();

    return () => {
      isMounted = false;
      if (unsubscribeLoaded) unsubscribeLoaded();
      if (unsubscribeError) unsubscribeError();
    };
  }, [enabled]);
}
