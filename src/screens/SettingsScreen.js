import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, Modal, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { setLanguage, LANGUAGE_KEY } from '../i18n';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../theme/ThemeContext';
import { getConsentInfo } from '../components/ConsentModal';
import Toast from '../components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { dark, theme, setTheme } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 360 || height < 640;
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [consentInfo, setConsentInfo] = useState(null);
  const [premium, setPremium] = useState(false);
  const [premiumInfo, setPremiumInfo] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [infoModal, setInfoModal] = useState({ visible: false, title: '', message: '' });
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadSettings();
    const unsubscribe = navigation.addListener('focus', () => {
      loadSettings();
    });
    return unsubscribe;
  }, [navigation]);

  const loadSettings = async () => {
    try {
      const [savedLang, savedTheme, consent, premiumFlag, savedInfo] = await Promise.all([
        AsyncStorage.getItem(LANGUAGE_KEY),
        AsyncStorage.getItem('theme'),
        getConsentInfo(),
        AsyncStorage.getItem('premium'),
        AsyncStorage.getItem('premium_info')
      ]);
      
      if (savedLang) setLanguage(savedLang);
      if (savedTheme) setTheme(savedTheme);
      if (consent) setConsentInfo(consent);
      if (premiumFlag === 'true') {
        setPremium(true);
        if (savedInfo) {
          try {
            setPremiumInfo(JSON.parse(savedInfo));
          } catch {}
        }
      }
    } catch (error) {
      console.error('Settings yüklenirken hata:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onLang = async (lng) => {
    try {
      setLanguage(lng);
    } catch (error) {
      console.error('Dil kaydedilirken hata:', error);
    }
  };

  const onTheme = async (th) => {
    try {
      await AsyncStorage.setItem('theme', th);
      setTheme(th);
    } catch (error) {
      console.error('Tema kaydedilirken hata:', error);
    }
  };

  const openDisclaimer = () => {
    navigation.navigate('Disclaimer');
  };

  const languages = [
   
    { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
    { code: 'ar', label: 'العربية', flag: '🇵🇸' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    
     { code: 'en', label: 'English', flag: '🇬🇧' }
  ];

  const themes = [
    { value: 'light', icon: '☀️' },
    { value: 'dark', icon: '🌙' },
    { value: 'system', icon: '⚙️' }
  ];

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#e9edf3', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: dark ? '#e6edf3' : '#0b1220' }}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: dark ? '#0b0f14' : '#e9edf3' }]}>
      <ScrollView 
        style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#e9edf3' }]}
        contentContainerStyle={[styles.contentContainer, compact ? { padding: 12, paddingBottom: 24 } : null]}
        showsVerticalScrollIndicator={false}
      >
 
      {/* Premium Active Banner */}
      {premium && (
        <View style={styles.section}>
          <LinearGradient
            colors={dark ? ['#b45309', '#78350f'] : ['#fbbf24', '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumBanner}
          >
            <View style={styles.premiumBannerContent}>
              <View style={styles.premiumIconWrap}>
                <Text style={styles.premiumIcon}>👑</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.premiumBannerTitle}>
                  {t('settings.premium_active_title') || 'Premium Üyesiniz'}
                </Text>
                <Text style={styles.premiumBannerSubtitle}>
                  {premiumInfo?.type === 'lifetime' 
                    ? (t('settings.plan_lifetime') || 'Lifetime Access')
                    : (premiumInfo?.type === 'monthly' ? (t('settings.plan_monthly') || 'Monthly Subscription') : (premiumInfo?.type === 'yearly' ? (t('settings.plan_yearly') || 'Yearly Subscription') : (t('settings.plan_premium') || 'Premium Subscription')))}
                </Text>
                
                {premiumInfo?.expiryDate && premiumInfo?.type !== 'lifetime' && (
                  <Text style={[styles.premiumBannerSubtitle, { fontSize: 12, opacity: 0.9, marginTop: 2 }]}>
                    {t('settings.expires_on', { date: new Date(premiumInfo.expiryDate).toLocaleDateString() }) || `Expires: ${new Date(premiumInfo.expiryDate).toLocaleDateString()}`}
                  </Text>
                )}

                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumBadgeText}>
                    {premiumInfo?.type === 'lifetime'
                      ? (t('settings.unlimited_access') || 'Unlimited Access')
                      : (t('settings.premium_active_label') || 'Subscription Active')}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Premium Upsell (Only if NOT premium) */}
      {!premium && Platform.OS !== 'ios' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionIcon, { fontSize: 20 }]}>🌟</Text>
            <Text style={[styles.sectionTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('settings.premiumTitle')}</Text>
          </View>
          <View style={{
            padding: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: dark ? '#30363d' : '#e1e4e8',
            backgroundColor: dark ? '#161b22' : '#ffffff'
          }}>
            <Text style={{ color: dark ? '#8b949e' : '#57606a', fontSize: 13 }}>
              {t('settings.premiumDesc')}
            </Text>
            <TouchableOpacity 
              style={[styles.disclaimerBtn, { backgroundColor: dark ? '#7c3aed' : '#7c3aed', marginTop: 12 }]} 
              onPress={() => navigation.navigate('Paywall')}
              activeOpacity={0.8}
            >
              <Text style={styles.disclaimerIcon}>🚀</Text>
              <Text style={styles.disclaimerText}>{t('settings.removeAds')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Tema Seçimi */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionIcon, { fontSize: 20 }]}>🎨</Text>
          <Text style={[styles.sectionTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
            {t('settings.theme')}
          </Text>
        </View>
        <View style={[styles.themeContainer, compact ? { gap: 8 } : null]}>
          {themes.map(th => (
            <TouchableOpacity 
              key={th.value} 
              style={[
                styles.themeCard, 
                compact ? { padding: 14, minWidth: 120 } : null,
                { 
                  backgroundColor: theme === th.value 
                    ? (dark ? '#1a4d2e' : '#e8f5e9')
                    : (dark ? '#161b22' : '#ffffff'),
                  borderColor: theme === th.value 
                    ? (dark ? '#4caf50' : '#4caf50')
                    : (dark ? '#30363d' : '#e1e4e8'),
                  borderWidth: theme === th.value ? 2 : 1
                }
              ]} 
              onPress={() => onTheme(th.value)}
              activeOpacity={0.7}
            >
              <Text style={styles.themeIcon}>{th.icon}</Text>
              <Text style={[
                styles.themeName, 
                { 
                  color: theme === th.value 
                    ? (dark ? '#7ee787' : '#2da44e')
                    : (dark ? '#c9d1d9' : '#24292f')
                }
              ]}>
                {t(`settings.${th.value}`)}
              </Text>
              {theme === th.value && (
                <View style={[styles.checkmark, { backgroundColor: dark ? '#7ee787' : '#2da44e' }]}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

     

       {/* Dil Seçimi */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionIcon, { fontSize: 20 }]}>🌍</Text>
          <Text style={[styles.sectionTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
            {t('language.select')}
          </Text>
        </View>
        <View style={[styles.optionsContainer, compact ? { gap: 8 } : null]}>
          {languages.map(lng => (
            <TouchableOpacity 
              key={lng.code} 
              style={[
                styles.languageCard, 
                compact ? { width: '100%', padding: 12 } : null,
                { 
                  backgroundColor: i18n.language === lng.code 
                    ? (dark ? '#1a4d8f' : '#e3f2fd')
                    : (dark ? '#161b22' : '#ffffff'),
                  borderColor: i18n.language === lng.code 
                    ? (dark ? '#2196f3' : '#2196f3')
                    : (dark ? '#30363d' : '#e1e4e8'),
                  borderWidth: i18n.language === lng.code ? 2 : 1
                }
              ]} 
              onPress={() => onLang(lng.code)}
              activeOpacity={0.7}
            >
              <Text style={styles.flagIcon}>{lng.flag}</Text>
              <Text style={[
                styles.languageCode, 
                { 
                  color: i18n.language === lng.code 
                    ? (dark ? '#58a6ff' : '#0366d6')
                    : (dark ? '#c9d1d9' : '#24292f')
                }
              ]}>
                {lng.code.toUpperCase()}
              </Text>
              <Text style={[
                styles.languageLabel, 
                { 
                  color: i18n.language === lng.code 
                    ? (dark ? '#8b949e' : '#57606a')
                    : (dark ? '#8b949e' : '#57606a')
                }
              ]}>
                {lng.label}
              </Text>
              {i18n.language === lng.code && (
                <View style={[styles.checkmark, { backgroundColor: dark ? '#58a6ff' : '#0366d6' }]}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

     

      {/* Disclaimer Butonu */}
      <TouchableOpacity 
        style={[styles.disclaimerBtn, { backgroundColor: dark ? '#8b5cf6' : '#7c3aed' }]} 
        onPress={openDisclaimer}
        activeOpacity={0.8}
      >
        <Text style={styles.disclaimerIcon}>📋</Text>
        <Text style={styles.disclaimerText}>{t('settings.disclaimer')}</Text>
      </TouchableOpacity>

      {/* Onboarding Button */}
      <TouchableOpacity 
        style={[styles.disclaimerBtn, { backgroundColor: dark ? '#2da44e' : '#2f9e44', marginTop: 12 }]} 
        onPress={() => navigation.navigate('Onboarding')}
        activeOpacity={0.8}
      >
        <Text style={styles.disclaimerIcon}>🎓</Text>
        <Text style={styles.disclaimerText}>{t('settings.onboarding')}</Text>
      </TouchableOpacity>

      {/* Consent Info */}
      {consentInfo && (
        <View style={[styles.section, { marginTop: 20 }]}> 
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionIcon, { fontSize: 20 }]}>✅</Text>
            <Text style={[styles.sectionTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
              {t('settings.consent.info')}
            </Text>
          </View>
          <View style={{
            padding: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: dark ? '#30363d' : '#e1e4e8',
            backgroundColor: dark ? '#161b22' : '#ffffff'
          }}>
            <Text style={{ color: dark ? '#c9d1d9' : '#24292f', fontSize: 14, marginBottom: 6 }}>
              {t('settings.consent.date')}: {new Date(consentInfo.timestamp).toLocaleString()}
            </Text>
            <Text style={{ color: dark ? '#8b949e' : '#57606a', fontSize: 13 }}>
              {t('settings.consent.version')}: {consentInfo.appVersion}
            </Text>
          </View>
        </View>
      )}

      

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: dark ? '#6e7681' : '#8c959f' }]}>
          {t('settings.version')}: {Constants?.expoConfig?.version ?? '—'}
        </Text>
      </View>
      <Toast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} dark={dark} />
      <Modal
        visible={infoModal.visible}
        animationType="fade"
        transparent
        onRequestClose={() => setInfoModal((p) => ({ ...p, visible: false }))}
      >
        <View style={styles.infoOverlay}>
          <View style={[styles.infoCard, { backgroundColor: dark ? '#0b1120' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoIcon}>⚠️</Text>
              <Text style={[styles.infoTitle, { color: dark ? '#e6edf3' : '#0f172a' }]}>{infoModal.title}</Text>
            </View>
            <Text style={[styles.infoMessage, { color: dark ? '#94a3b8' : '#475569' }]}>{infoModal.message}</Text>
            <TouchableOpacity
              style={[styles.infoCta, { backgroundColor: '#2563eb' }]}
              onPress={() => setInfoModal((p) => ({ ...p, visible: false }))}
              activeOpacity={0.9}
            >
              <Text style={styles.infoCtaText}>{t('actions.ok') || 'Tamam'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </ScrollView>


    </View>  
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1
  },
  container: { 
    flex: 1 
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40
  },
  header: {
    marginBottom: 24
  },
  title: { 
    fontSize: 28, 
    fontWeight: '700',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400'
  },
  section: {
    marginBottom: 28
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8
  },
  sectionIcon: {
    fontSize: 20
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '600'
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  languageCard: {
    width: '48%',
    minWidth: 150,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  flagIcon: {
    fontSize: 32,
    marginBottom: 4
  },
  languageCode: {
    fontSize: 16,
    fontWeight: '700'
  },
  languageLabel: {
    fontSize: 13,
    fontWeight: '500'
  },
  themeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  themeCard: {
    flex: 1,
    minWidth: 100,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  themeIcon: {
    fontSize: 32
  },
  themeName: {
    fontSize: 15,
    fontWeight: '600'
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkmarkText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  disclaimerBtn: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    padding: 16, 
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4
  },
  disclaimerIcon: {
    fontSize: 20
  },
  disclaimerText: { 
    color: '#ffffff', 
    fontWeight: '700', 
    fontSize: 16
  },
  footer: {
    marginTop: 24,
    alignItems: 'center'
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600'
  },
  premiumBanner: {
    borderRadius: 20,
    padding: 2,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8
  },
  premiumBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 18,
    // Slightly lighter/transparent inner if needed, or just let gradient show
  },
  premiumIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)'
  },
  premiumIcon: {
    fontSize: 28
  },
  premiumBannerTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  premiumBannerSubtitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    fontWeight: '600'
  },
  premiumBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginTop: 4
  },
  premiumBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  infoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  infoCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  infoIcon: {
    fontSize: 24
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  infoMessage: {
    fontSize: 14,
    lineHeight: 20
  },
  infoCta: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  infoCtaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15
  }
});
