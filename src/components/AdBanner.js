import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeContext'; // Yolu kendi projene göre ayarla
import { bannerUnitId } from '../config/adUnitIds'; // Yolu kendi projene göre ayarla

export default function AdBanner({ placement, variant, isFooter = false }) {
  const { dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth = 0 } = useWindowDimensions();
  
  const [premium, setPremium] = useState(false);
  const [isAdLoaded, setIsAdLoaded] = useState(false); // Reklam yüklendi mi kontrolü

  // Premium Kontrolü
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const v = await AsyncStorage.getItem('premium');
        if (isMounted) setPremium(v === 'true');
      } catch (e) {
        console.log('Premium check failed:', e);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Premium ise hiçbir şey render etme (Boşluk da bırakma)
  if (premium) return null;

  let BannerAd = null;
  let BannerAdSize = null;
  try {
    const mod = require('react-native-google-mobile-ads');
    BannerAd = mod?.BannerAd;
    BannerAdSize = mod?.BannerAdSize;
  } catch {
    return null;
  }

  const useMrec = variant === 'mrec';
  const adaptiveFactory = BannerAdSize?.ANCHORED_ADAPTIVE_BANNER;
  const adaptiveSize = !useMrec && adaptiveFactory
    ? (typeof adaptiveFactory === 'function' ? adaptiveFactory(Math.round(windowWidth)) : adaptiveFactory)
    : null;
    
  const bannerSize = useMrec
    ? BannerAdSize?.MEDIUM_RECTANGLE
    : (adaptiveSize || BannerAdSize?.BANNER);

  const bottomPadding = isFooter ? Math.max(insets.bottom, 8) : 0;

  if (!BannerAd || !bannerSize || !bannerUnitId) return null;

  return (
    <View 
      style={[
        useMrec ? styles.mrecWrap : styles.adWrap, 
        isFooter && { paddingBottom: bottomPadding },
        // EĞER REKLAM YÜKLENMEDİYSE YER KAPLAMASIN (Yükseklik 0)
        !isAdLoaded && { height: 0, opacity: 0, marginTop: 0, paddingBottom: 0 } 
      ]}
    >
      <View style={useMrec ? styles.mrecContainer : styles.adContainer}>
        <BannerAd
          unitId={bannerUnitId}
          size={bannerSize}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => {
            console.log('[ads][banner] Loaded');
            setIsAdLoaded(true); // Reklam geldi, alanı görünür yap
          }}
          onAdFailedToLoad={(err) => {
            console.log('[ads][banner] Failed', err);
            // Hata olsa bile isAdLoaded'i false YAPMIYORUZ.
            // Eğer daha önce yüklendiyse (refresh hatasıysa) eski reklam ekranda kalsın.
            // Eğer hiç yüklenmediyse zaten height:0 olarak gizli kalacak.
            
            // Buraya setFailed gibi bir şey koyup COMPONENTİ RETURN NULL'a DÜŞÜRME!
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  adWrap: {
    marginTop: 2,  
    width: '100%',
    alignItems: 'center', // Ortalamayı garantiye al
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
    justifyContent: 'center'
  }
});