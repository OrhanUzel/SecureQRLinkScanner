import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { rewardedUnitId, interstitialUnitId, rewardedInterstitialUnitId } from '../config/adUnitIds';
import { getAdRequestOptions } from '../utils/adRequestOptions';

let MobileAds;
let RewardedAd, RewardedInterstitialAd, InterstitialAd, AdEventType, RewardedAdEventType;

try {
  if (Platform.OS !== 'web') {
    MobileAds = require('react-native-google-mobile-ads');
    RewardedAd = MobileAds.RewardedAd;
    RewardedInterstitialAd = MobileAds.RewardedInterstitialAd;
    InterstitialAd = MobileAds.InterstitialAd;
    AdEventType = MobileAds.AdEventType;
    RewardedAdEventType = MobileAds.RewardedAdEventType;
  }
} catch (e) {
  console.log('Ads not available');
}

export function useAdManager() {
  const isWeb = Platform.OS === 'web';
  const loadedAdRef = useRef(null);
  const loadingPromiseRef = useRef(null);
  const [adLoaded, setAdLoaded] = useState(false);

  const preloadAd = useCallback(async () => {
    if (isWeb || !MobileAds) return false;
    if (loadedAdRef.current) return true;
    if (loadingPromiseRef.current) return loadingPromiseRef.current;

    const task = (async () => {
      try {
        const requestOptions = await getAdRequestOptions();

        const loadAdPromise = (AdClass, unitId, type) => {
          return new Promise((resolve, reject) => {
            if (!unitId) return reject(new Error('missing_unit'));
            const ad = AdClass.createForAdRequest(unitId, requestOptions);
            
            let eventSubs = [];
            const clearEvents = () => eventSubs.forEach(u => { try { u(); } catch {} });

            const onLoad = () => {
              clearEvents();
              loadedAdRef.current = { ad, type };
              setAdLoaded(true);
              resolve(true);
            };

            const onError = (e) => {
              clearEvents();
              reject(e);
            };

            const loadEvent = type === 'interstitial' ? AdEventType.LOADED : RewardedAdEventType.LOADED;
            
            eventSubs.push(ad.addAdEventListener(loadEvent, onLoad));
            eventSubs.push(ad.addAdEventListener(AdEventType.ERROR, onError));
            
            ad.load();
          });
        };

        // Waterfall: Rewarded -> RewardedInterstitial -> Interstitial
        try {
          await loadAdPromise(RewardedAd, rewardedUnitId, 'rewarded');
          console.log('Loaded Rewarded Ad');
          return true;
        } catch (e1) {
          console.log('Rewarded failed, trying RewardedInterstitial', e1);
          try {
            await loadAdPromise(RewardedInterstitialAd, rewardedInterstitialUnitId, 'rewarded_interstitial');
            console.log('Loaded RewardedInterstitial Ad');
            return true;
          } catch (e2) {
            console.log('RewardedInterstitial failed, trying Interstitial', e2);
            try {
              await loadAdPromise(InterstitialAd, interstitialUnitId, 'interstitial');
               console.log('Loaded Interstitial Ad');
               return true;
            } catch (e3) {
              console.log('All ads failed to load', e3);
              return false;
            }
          }
        }
      } catch (err) {
        console.log('Ad setup error', err);
        return false;
      } finally {
        loadingPromiseRef.current = null;
      }
    })();

    loadingPromiseRef.current = task;
    return task;
  }, [isWeb]);

  useEffect(() => {
    preloadAd();
    return () => {
      if (loadedAdRef.current?.ad) {
        loadedAdRef.current = null;
      }
    };
  }, [preloadAd]);

  const showAd = useCallback(async () => {
    if (!loadedAdRef.current) {
      const success = await preloadAd();
      if (!success) return { ok: false, error: 'not_ready' };
    }

    return new Promise((resolve) => {
      if (!loadedAdRef.current) {
        resolve({ ok: false, error: 'not_ready' });
        return;
      }

      const { ad, type } = loadedAdRef.current;
      let earned = false;
      let eventSubs = [];
      
      const cleanup = () => {
        eventSubs.forEach(u => { try { u(); } catch {} });
        loadedAdRef.current = null;
        setAdLoaded(false);
        preloadAd(); // Load next
      };

      if (type !== 'interstitial') {
        eventSubs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          earned = true;
        }));
      }

      eventSubs.push(ad.addAdEventListener(AdEventType.CLOSED, () => {
        cleanup();
        if (type === 'interstitial') {
           // Interstitial always "earns" the unlock in this context (fallback)
           resolve({ ok: true });
        } else {
           resolve({ ok: earned });
        }
      }));

      eventSubs.push(ad.addAdEventListener(AdEventType.ERROR, (e) => {
        cleanup();
        resolve({ ok: false, error: e });
      }));

      try {
        ad.show();
      } catch (e) {
        cleanup();
        resolve({ ok: false, error: e });
      }
    });
  }, [preloadAd]);

  return { adLoaded, showAd, preloadAd };
}
