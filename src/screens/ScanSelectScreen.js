import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, FlatList, Platform, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../theme/ThemeContext';
import AdBanner from '../components/AdBanner';
import AdvancedAdCard from '../components/AdvancedAdCard';
import { adUnits } from '../config/adUnits';

export default function ScanSelectScreen({ navigation }) {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 360 || height < 640;

  const scanOptions = [
    {
      id: 'link',
      route: 'LinkScan',
      icon: 'link',
      colors: dark ? ['#1a4d8f', '#2563eb'] : ['#3b82f6', '#60a5fa'],
      iconColor: dark ? '#9ecaff' : '#ffffff',
      title: t('scan.link'),
      description: t('scan.link.description'),
      emoji: '🔗'
    },
    {
      id: 'code',
      route: 'CodeScan',
      icon: 'qr-code',
      colors: dark ? ['#1a4d2e', '#22c55e'] : ['#10b981', '#34d399'],
      iconColor: dark ? '#b9f3b6' : '#ffffff',
      title: t('scan.code'),
      description: t('scan.code.description'),
      emoji: '📱'
    },
    {
      id: 'image',
      route: 'ImageScan',
      icon: 'images',
      colors: dark ? ['#4d1a8f', '#8b5cf6'] : ['#8b5cf6', '#a78bfa'],
      iconColor: dark ? '#c6e0ff' : '#ffffff',
      title: t('scan.image'),
      description: t('scan.image.description'),
      emoji: '🖼️'
    },
    {
      id: 'create',
      route: 'CreateQR',
      iconFamily: 'MaterialCommunityIcons',
      icon: 'qrcode-plus',
      colors: dark ? ['#3a1c32', '#d946ef'] : ['#ec4899', '#f472b6'],
      iconColor: dark ? '#ffd6e7' : '#ffffff',
      title: t('scan.create'),
      description: t('scan.create.description'),
      emoji: '🖨️'
    },

  ];

  // Append History and Settings to the grid per request
  scanOptions.push(
    {
      id: 'history',
      route: 'History',
      icon: 'time-outline',
      colors: dark ? ['#243044', '#0ea5e9'] : ['#38bdf8', '#60a5fa'],
      iconColor: dark ? '#9ecaff' : '#ffffff',
      title: t('history.title'),
      description: t('history.description'),
      emoji: '🕘'
    },
    {
      id: 'settings',
      route: 'Settings',
      icon: 'settings-outline',
      colors: dark ? ['#3b2c52', '#7c3aed'] : ['#a78bfa', '#c4b5fd'],
      iconColor: dark ? '#c1b6ff' : '#ffffff',
      title: t('settings.title'),
      description: t('settings.description'),
      emoji: '⚙️'
    }
  );

  const ADS = {
    REWARDED_INTERSTITIAL: adUnits.REWARDED_INTERSTITIAL,
    REWARDED: adUnits.REWARDED,
    INTERSTITIAL: adUnits.INTERSTITIAL,
  };

  const runHistoryGate = async () => {
    if (Platform.OS === 'web') {
      return true;
    }
    let mod = null;
    try { mod = await import('react-native-google-mobile-ads'); } catch {}
    if (!mod) return true;
    const { RewardedInterstitialAd, RewardedAd, InterstitialAd, AdEventType, RewardedAdEventType } = mod;
    const tryRewardedInterstitial = async () => {
      if (!ADS.REWARDED_INTERSTITIAL) throw new Error('missing_unit');
      const ad = RewardedInterstitialAd.createForAdRequest(ADS.REWARDED_INTERSTITIAL, { requestNonPersonalizedAdsOnly: true });
      await new Promise((resolve, reject) => {
        let earned = false;
        const ul = ad.addAdEventListener(AdEventType.LOADED, () => { ad.show(); });
        const ue = ad.addAdEventListener(AdEventType.ERROR, () => { cleanup(); reject(new Error('ad_error')); });
        const uc = ad.addAdEventListener(AdEventType.CLOSED, () => { cleanup(); if (earned) resolve(true); else reject(new Error('closed')); });
        const ur = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
        const cleanup = () => { ul(); ue(); uc(); ur(); };
        ad.load();
      });
    };
    const tryRewarded = async () => {
      if (!ADS.REWARDED) throw new Error('missing_unit');
      const ad = RewardedAd.createForAdRequest(ADS.REWARDED, { requestNonPersonalizedAdsOnly: true });
      await new Promise((resolve, reject) => {
        let earned = false;
        const ul = ad.addAdEventListener(AdEventType.LOADED, () => { ad.show(); });
        const ue = ad.addAdEventListener(AdEventType.ERROR, () => { cleanup(); reject(new Error('ad_error')); });
        const uc = ad.addAdEventListener(AdEventType.CLOSED, () => { cleanup(); if (earned) resolve(true); else reject(new Error('closed')); });
        const ur = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
        const cleanup = () => { ul(); ue(); uc(); ur(); };
        ad.load();
      });
    };
    const tryInterstitial = async () => {
      if (!ADS.INTERSTITIAL) throw new Error('missing_unit');
      const ad = InterstitialAd.createForAdRequest(ADS.INTERSTITIAL, { requestNonPersonalizedAdsOnly: true });
      await new Promise((resolve, reject) => {
        const ul = ad.addAdEventListener(AdEventType.LOADED, () => { ad.show(); });
        const ue = ad.addAdEventListener(AdEventType.ERROR, () => { cleanup(); reject(new Error('ad_error')); });
        const uc = ad.addAdEventListener(AdEventType.CLOSED, () => { cleanup(); resolve(true); });
        const cleanup = () => { ul(); ue(); uc(); };
        ad.load();
      });
    };
    try { await tryRewardedInterstitial(); return true; } catch {}
    try { await tryRewarded(); return true; } catch {}
    try { await tryInterstitial(); return true; } catch {}
    return true;
  };

  return (
    <View 
      style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}
    >


      
      
      {/* Header removed per request */}

      {/* Scan Options Grid */}
      <View style={[styles.grid, compact ? { paddingHorizontal: 8 } : null]}>
        <FlatList
          data={scanOptions}
          keyExtractor={(item) => item.id}
          numColumns={compact ? 1 : 2}
          scrollEnabled={true}
          style={styles.gridList}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item, index }) => (
            <ScanCard
              option={item}
              dark={dark}
              compact={compact}
              onPress={async () => {
                if (item.id === 'history') {
                  try { await runHistoryGate(); } catch {}
                }
                navigation.navigate(
                  item.route,
                  item.id === 'image' ? { autoPick: true } : undefined
                );
              }}
              index={index}
            />
          )}
        />
      </View>

      {/* Quick Stats removed per request */}

      {/* Footer */}
      <AdvancedAdCard placement="home" />
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: dark ? '#6e7681' : '#8c959f' }]}>
          {t('scan.footer.text')}
        </Text>
      </View>
    </View>
  );
}

function ScanCard({ option, dark, onPress, index, compact }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[styles.cardWrapper, compact ? { width: '100%' } : { width: '48%' }, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.touch}
        focusable={false}
      >
        <View style={[styles.cardShadow]}>
          <LinearGradient
            colors={option.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.cardContent}>
              
              <View style={styles.iconContainer}>
                <Text style={[styles.iconEmoji, compact ? { fontSize: 44 } : null]}>{option.emoji}</Text>
              </View>
              
              <View style={styles.cardTextContainer}>
                <Text style={[styles.cardTitle, compact ? { fontSize: 17 } : null]} numberOfLines={2}>{option.title}</Text>
                {/* <Text style={[styles.cardDescription, compact ? { fontSize: 12, lineHeight: 18 } : null]} numberOfLines={2} ellipsizeMode="tail">{option.description}</Text> */}
              </View>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function StatCard({ icon, value, label, color, dark }) {
  return (
    <View style={[styles.statCard, { 
      backgroundColor: dark ? '#161b22' : '#ffffff',
      borderColor: dark ? '#30363d' : '#e1e4e8'
    }]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.statValue, { color: dark ? '#e6edf3' : '#0b1220' }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: dark ? '#8b949e' : '#57606a' }]}>
        {label}
      </Text>
    </View>
  );
}

function RiskBadge({ level }) {
  let color = '#2f9e44', text = 'result.secure', icon = 'shield-checkmark';
  if (level === 'suspicious') { 
    color = '#ffb703'; 
    text = 'result.suspicious'; 
    icon = 'warning'; 
  }
  if (level === 'unsafe') { 
    color = '#d00000'; 
    text = 'result.unsafe'; 
    icon = 'shield'; 
  }
  const { t } = useTranslation();
  
  return (
    <View style={[styles.badge, { backgroundColor: color }]}> 
      <Ionicons name={icon} size={16} color="#fff" />
      <Text style={styles.badgeText}>{t(text)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    padding: 20,
    paddingBottom: 20
  },
  header: {
    marginBottom: 24,
    alignItems: 'center'
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8
  },
  headerEmoji: {
    fontSize: 32
  },
  title: { 
    fontSize: 28, 
    fontWeight: '700'
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22
  },
  infoCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20
  },
  grid: { 
    flex: 1,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  gridList: {
    flex: 1
  },
  gridContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 16
  },
  cardWrapper: {},
  touch: {
    borderRadius: 20,
  },
  cardShadow: {
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    height: 190
  },
  card: { 
    borderRadius: 20,
    overflow: 'hidden',
    height: '100%'
  },
  cardContent: {
    padding: 18,
    paddingBottom: 18
  },
  
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'center'
  },
  iconEmoji: {
    fontSize: 52
  },
  cardTextContainer: {
    gap: 4,
    alignItems: 'center'
  },
  cardTitle: { 
    fontSize: 19, 
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
    textAlign: 'center'
  },
  cardDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    textAlign: 'center'
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700'
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center'
  },
  footer: {
    alignItems: 'center',
    paddingTop: 8
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18
  },
  badge: { 
    paddingVertical: 6, 
    paddingHorizontal: 10, 
    borderRadius: 999, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    alignSelf: 'flex-start' 
  },
  badgeText: { 
    color: '#fff', 
    fontWeight: '700' 
  }
});