import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeContext';
import { bannerUnitId } from '../config/adUnitIds';

export default function AdBanner({ placement, variant, isFooter = false }) {
  const { dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  
  // 1. İYİLEŞTİRME: Yükleniyor durumu eklendi
  const [loading, setLoading] = useState(true);
  const [premium, setPremium] = useState(false);
  const [admod, setAdmod] = useState(null);
  const [failed, setFailed] = useState(false);

  // Premium Kontrolü
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem('premium');
        setPremium(v === 'true');
      } catch (e) {
        console.log('Premium check failed:', e);
      } finally {
        // 2. İYİLEŞTİRME: İşlem bitince (başarılı veya hatalı) yüklemeyi durdur
        setLoading(false);
      }
    })();
  }, []);

  // AdMob Kütüphanesini Dinamik Yükleme
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('react-native-google-mobile-ads');
        if (mounted) setAdmod(mod);
      } catch (e) {
        console.log('AdMob import failed:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // 3. İYİLEŞTİRME: Henüz kontrol bitmediyse veya kullanıcı premium ise gösterme
  if (loading || premium) return null;

  const useMrec = variant === 'mrec';
  // Admod yüklenmemişse hata vermemesi için opsiyonel zincirleme (?.) kullanımı
  const bannerSize = useMrec 
    ? admod?.BannerAdSize?.MEDIUM_RECTANGLE 
    : admod?.BannerAdSize?.ANCHORED_ADAPTIVE_BANNER;

  // Reklam kütüphanesi hazır değilse, ID yoksa veya yükleme hatası aldıysa gösterme
  if (!admod || !bannerUnitId || failed) return null;

  // Footer ise alt güvenli alanı hesaba kat
  const bottomPadding = isFooter ? Math.max(insets.bottom, 8) : 0;

  return (
    <View 
      style={[
        useMrec ? styles.mrecWrap : styles.adWrap, 
        isFooter && { paddingBottom: bottomPadding }
      ]}
    >
      <View style={useMrec ? styles.mrecContainer : styles.adContainer}>
        <admod.BannerAd
          unitId={bannerUnitId}
          size={bannerSize}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={(err) => {
            console.log('AdBanner failed to load:', err);
            setFailed(true); // Hata alınca alanı tamamen gizle
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({

  adWrap: {
    marginTop: 2,  
    width: '100%'
  },

  adContainer: {
    width: '100%',
    alignItems: 'center',
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