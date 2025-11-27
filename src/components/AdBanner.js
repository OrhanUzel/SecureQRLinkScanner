import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../theme/ThemeContext';
import { adUnits } from '../config/adUnits';

export default function AdBanner({ placement, variant }) {
  const { dark } = useAppTheme();
  const navigation = useNavigation();
  const [premium, setPremium] = useState(false);
  const [admod, setAdmod] = useState(null);
  const { width } = useWindowDimensions();
  const [online, setOnline] = useState(true);

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
        const mod = await import('react-native-google-mobile-ads');
        if (mounted) setAdmod(mod);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const ping = async () => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 2500);
        const res = await fetch('https://clients3.google.com/generate_204', { signal: ctl.signal });
        clearTimeout(t);
        if (active) setOnline(res?.status === 204 || (res?.ok === true));
      } catch {
        if (active) setOnline(false);
      }
    };
    ping();
    const id = setInterval(ping, 15000);
    return () => { active = false; clearInterval(id); };
  }, []);

  if (premium || !online) return null;

  const unitId = adUnits.BANNER;

  const useMrec = variant === 'mrec';
  const useBanner = variant === 'banner';
  const bannerSize = useMrec
    ? admod?.BannerAdSize?.MEDIUM_RECTANGLE
    : (useBanner ? admod?.BannerAdSize?.BANNER : admod?.BannerAdSize?.ANCHORED_ADAPTIVE_BANNER);

  return (
    <View style={admod ? [useMrec ? styles.mrecWrap : styles.adWrap, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }] : [styles.wrap, { backgroundColor: dark ? '#161b22' : '#ffffff', borderColor: dark ? '#30363d' : '#e1e4e8' }] }>
      {admod && unitId ? (
        <View style={useMrec ? styles.mrecContainer : styles.adContainer}>
          <admod.BannerAd
            unitId={unitId}
            size={bannerSize}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          />
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={[styles.label, { color: dark ? '#8b949e' : '#57606a' }]}>Sponsorlu alan</Text>
          <TouchableOpacity 
            style={[styles.cta, { backgroundColor: dark ? '#7c3aed' : '#7c3aed' }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Premium')}
          >
            <Text style={styles.ctaText}>Reklamları kaldır</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  adWrap: {
    marginTop: 12,
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  label: {
    fontSize: 12,
    fontWeight: '600'
  },
  cta: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999
  },
  ctaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12
  }
});
