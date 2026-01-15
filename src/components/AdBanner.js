import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { bannerUnitId } from '../config/adUnitIds';
import { appEvents } from '../utils/events';

function AdBanner({ placement, variant, isFooter = false }) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth = 0 } = useWindowDimensions();
  
  const [premium, setPremium] = useState(false);
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const checkPremium = async () => {
      try {
        const v = await AsyncStorage.getItem('premium');
        if (isMounted) setPremium(v === 'true');
      } catch (e) {
        if (__DEV__) console.log('Premium check failed:', e);
      }
    };
    checkPremium();

    const removeListener = appEvents.on('premiumChanged', (status) => {
      if (isMounted) setPremium(status === true);
    });

    return () => { 
      isMounted = false; 
      if (removeListener) removeListener();
    };
  }, []);

  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      if (state.isConnected && !isAdLoaded) {
        if (__DEV__) console.log('[ads][banner] Network connected, retrying...', placement);
        retryAttemptRef.current = 0;
        clearRetry();
        setRequestKey(k => k + 1);
      }
    });
    return unsubscribe;
  }, [isAdLoaded, placement, clearRetry]);

  let BannerAd = null;
  let BannerAdSize = null;
  try {
    const mod = require('react-native-google-mobile-ads');
    BannerAd = mod?.BannerAd;
    BannerAdSize = mod?.BannerAdSize;
  } catch {
    BannerAd = null;
    BannerAdSize = null;
  }

  const useMrec = variant === 'mrec';

  const bannerSize = useMemo(() => {
    if (!BannerAdSize) return null;
    if (useMrec) return BannerAdSize.MEDIUM_RECTANGLE;
    return BannerAdSize.ANCHORED_ADAPTIVE_BANNER || BannerAdSize.BANNER;
  }, [BannerAdSize, useMrec]);

  const placeholderHeight = useMemo(() => {
    if (useMrec) return 250;
    const w = Math.round(windowWidth || 0);
    if (w >= 728) return 90;
    if (w >= 468) return 60;
    return 50;
  }, [useMrec, windowWidth]);

  const bottomPadding = useMemo(() => (isFooter ? Math.max(insets.bottom, 8) : 0), [insets.bottom, isFooter]);

  const retryTimeoutRef = useRef(null);
  const retryAttemptRef = useRef(0);

  const clearRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const scheduleRetry = useCallback(() => {
    if (isAdLoaded) return;
    if (retryTimeoutRef.current) return;
    const delays = [5000, 15000, 30000, 60000];
    const attempt = retryAttemptRef.current;
    if (attempt >= delays.length) return;
    const delay = delays[attempt];
    retryAttemptRef.current = attempt + 1;
    retryTimeoutRef.current = setTimeout(() => {
      retryTimeoutRef.current = null;
      setRequestKey((k) => k + 1);
    }, delay);
  }, [isAdLoaded]);

  useEffect(() => {
    return () => { clearRetry(); };
  }, [clearRetry]);

  useEffect(() => {
    if (premium) clearRetry();
  }, [premium, clearRetry]);

  const onAdLoaded = useCallback(() => {
    if (__DEV__) console.log('[ads][banner] Loaded', placement || '');
    retryAttemptRef.current = 0;
    clearRetry();
    setIsAdLoaded(true);
  }, [clearRetry, placement]);

  const onAdFailedToLoad = useCallback((err) => {
    if (__DEV__) console.log('[ads][banner] Failed', placement || '', err);
    scheduleRetry();
  }, [placement, scheduleRetry]);

  const wrapStyle = useMemo(() => {
    // Sadece internet yoksa alanı gizle (height: 0)
    // Reklam yüklenemese bile internet varsa alan kaplasın (gelir kaybını önlemek için)
    if (isConnected === false) {
      return { height: 0, overflow: 'hidden' };
    }

    const base = useMrec ? styles.mrecWrap : styles.adWrap;
    const footer = isFooter ? { paddingBottom: bottomPadding } : null;
    const reserve = { minHeight: placeholderHeight };
    
    return [base, footer, reserve];
  }, [bottomPadding, isConnected, isFooter, placeholderHeight, useMrec]);

  if (premium || !BannerAd || !bannerSize || !bannerUnitId) return null;

  return (
    <View style={wrapStyle}>
      <View style={useMrec ? styles.mrecContainer : styles.adContainer}>
        <BannerAd
          key={`${requestKey}:${bannerSize}`}
          unitId={bannerUnitId}
          size={bannerSize}
          onAdLoaded={onAdLoaded}
          onAdFailedToLoad={onAdFailedToLoad}
        />
      </View>
    </View>
  );
}

export default React.memo(AdBanner);

const styles = StyleSheet.create({
  adWrap: {
    marginTop: 2,  
    width: '100%',
    alignItems: 'center',
  },
  adContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  mrecWrap: {
    marginTop: 12,
    width: '100%',
    alignItems: 'center'
  },
  mrecContainer: {
    width: 300,
    height: 250,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12
  }
});
