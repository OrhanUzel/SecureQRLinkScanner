import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../theme/ThemeContext';
import AdBanner from './AdBanner';

export default function AdvancedAdCard({ placement }) {
  const { dark } = useAppTheme();
  const [premium, setPremium] = useState(false);
  const [nativeMod, setNativeMod] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem('premium');
        setPremium(v === 'true');
      } catch {}
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('react-native-admob-native-ads');
        if (mounted) setNativeMod(mod);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  if (premium) return null;

  if (!nativeMod) {
    return <AdBanner placement={placement} variant="mrec" />;
  }

  const NativeAdView = nativeMod?.NativeAdView;
  const MediaView = nativeMod?.MediaView;
  const HeadlineView = nativeMod?.HeadlineView;
  const TaglineView = nativeMod?.TaglineView;
  const CallToActionView = nativeMod?.CallToActionView;
  const IconView = nativeMod?.IconView;
  const AdvertiserView = nativeMod?.AdvertiserView;
  const AdBadge = nativeMod?.AdBadge;
  const StarRatingView = nativeMod?.StarRatingView;

  if (!NativeAdView || !MediaView || !HeadlineView || !CallToActionView) {
    return <AdBanner placement={placement} variant="mrec" />;
  }

  const testUnit = nativeMod?.TestIds?.NATIVE_ADVANCED || 'ca-app-pub-3940256099942544/2247696110';

  return (
    <NativeAdView
      adUnitID={testUnit}
      style={[styles.card, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea' }]}
    >
      <View style={styles.rowTop}>
        <IconView style={styles.icon} />
        <View style={{ flex: 1 }}>
          <HeadlineView style={[styles.headline, { color: dark ? '#e6edf3' : '#0b1220' }]} />
          <AdvertiserView style={[styles.advertiser, { color: dark ? '#8b98a5' : '#57606a' }]} />
        </View>
        <AdBadge style={styles.badge} />
      </View>

      <MediaView style={styles.media} />

      <TaglineView style={[styles.tagline, { color: dark ? '#8b98a5' : '#57606a' }]} />

      <View style={styles.rowBottom}>
        <StarRatingView style={styles.stars} />
        <CallToActionView style={styles.cta} textStyle={styles.ctaText} />
      </View>
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#eee'
  },
  headline: {
    fontSize: 16,
    fontWeight: '700'
  },
  advertiser: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600'
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e5e9f0'
  },
  media: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#eef2f7'
  },
  tagline: {
    fontSize: 13,
    lineHeight: 18
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  stars: {
    height: 20
  },
  cta: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#7c3aed'
  },
  ctaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14
  }
});