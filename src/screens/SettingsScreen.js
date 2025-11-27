import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../theme/ThemeContext';
import { getConsentInfo } from '../components/ConsentModal';
import AdvancedAdCard from '../components/AdvancedAdCard';
import AdBanner from '../components/AdBanner';
import Toast from '../components/Toast';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { dark, theme, setTheme } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 360 || height < 640;
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [consentInfo, setConsentInfo] = useState(null);
  const [premium, setPremium] = useState(false);
  const [iap, setIap] = useState(null);
  const [products, setProducts] = useState([]);
  const [sub, setSub] = useState(null);
  const [offers, setOffers] = useState([]);
  const [processing, setProcessing] = useState(false);
  const SKU_SUBSCRIPTION = 'secure_qr_link_scanner';
  const SKU_LIFETIME = 'premium_lifetime';
  const purchaseUpdateRef = useRef(null);
  const purchaseErrorRef = useRef(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('react-native-iap');
        if (!mounted) return;
        setIap(mod);
        try { await mod.initConnection(); } catch {}
        try { await mod.flushFailedPurchasesCachedAsPendingAndroid?.(); } catch {}
        let items = [];
        try { items = await mod.fetchProducts({ skus: [SKU_SUBSCRIPTION], type: 'subs' }); } catch {}
        if (items && items.length) {
          setSub(items[0]);
          const subOffers = items[0]?.subscriptionOfferDetailsAndroid || [];
          setOffers(subOffers);
        }
        let oneTime = [];
        try { oneTime = await mod.fetchProducts({ skus: [SKU_LIFETIME], type: 'in-app' }); } catch {}
        if (oneTime && oneTime.length) setProducts(oneTime);

        purchaseUpdateRef.current = mod.purchaseUpdatedListener(async (purchase) => {
          try {
            setProcessing(false);
            try { await mod.finishTransaction({ purchase }); } catch {}
            await AsyncStorage.setItem('premium', 'true');
            setPremium(true);
          } catch {}
        });
        purchaseErrorRef.current = mod.purchaseErrorListener(() => {
          setProcessing(false);
        });
      } catch {}
    })();
    return () => {
      try { purchaseUpdateRef.current?.remove(); } catch {}
      try { purchaseErrorRef.current?.remove(); } catch {}
      try { iap?.endConnection?.(); } catch {}
      mounted = false;
    };
  }, []);

  const loadSettings = async () => {
    try {
      const [savedLang, savedTheme, consent, premiumFlag] = await Promise.all([
        AsyncStorage.getItem('language'),
        AsyncStorage.getItem('theme'),
        getConsentInfo(),
        AsyncStorage.getItem('premium')
      ]);
      
      if (savedLang) setLanguage(savedLang);
      if (savedTheme) setTheme(savedTheme);
      if (consent) setConsentInfo(consent);
      if (premiumFlag === 'true') setPremium(true);
    } catch (error) {
      console.error('Settings yüklenirken hata:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onLang = async (lng) => {
    try {
      await AsyncStorage.setItem('language', lng);
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

  const pickOfferToken = (basePlanId) => {
    const found = offers?.find(o => o.basePlanId === basePlanId);
    const token = found?.offerToken || found?.offerIdToken || found?.offerTokenCode;
    if (token) return token;
    const first = offers?.[0]?.offerToken || sub?.subscriptionOfferDetailsAndroid?.[0]?.offerToken;
    return first || null;
  };

  const formatOfferPrice = (basePlanId) => {
    const found = offers?.find(o => o.basePlanId === basePlanId);
    const phase = found?.pricingPhases?.pricingPhaseList?.[0];
    return phase?.formattedPrice || phase?.priceFormatted || null;
  };

  const buyMonthly = async () => {
    try {
      setProcessing(true);
      const offerToken = pickOfferToken('monthly');
      if (iap && offerToken) {
        try {
          await iap.requestPurchase({
            request: { android: { skus: [SKU_SUBSCRIPTION], subscriptionOffers: [{ sku: SKU_SUBSCRIPTION, offerToken }] } },
            type: 'subs'
          });
          return;
        } catch {}
      }
      setProcessing(false);
    } catch { setProcessing(false); }
  };

  const buyYearly = async () => {
    try {
      setProcessing(true);
      const offerToken = pickOfferToken('yearly');
      if (iap && offerToken) {
        try {
          await iap.requestPurchase({
            request: { android: { skus: [SKU_SUBSCRIPTION], subscriptionOffers: [{ sku: SKU_SUBSCRIPTION, offerToken }] } },
            type: 'subs'
          });
          return;
        } catch {}
      }
      setProcessing(false);
    } catch { setProcessing(false); }
  };

  const buyLifetime = async () => {
    try {
      setProcessing(true);
      if (iap) {
        try {
          await iap.requestPurchase({ request: { android: { skus: [SKU_LIFETIME] } }, type: 'in-app' });
          return;
        } catch {}
        setProcessing(false);
        return;
      }
      await AsyncStorage.setItem('premium', 'true');
      setPremium(true);
      setProcessing(false);
    } catch { setProcessing(false); }
  };

  const restorePurchases = async () => {
    try {
      if (!iap) return;
      setProcessing(true);
      let purchases = [];
      try { purchases = await iap.getAvailablePurchases(); } catch {}
      const hasPremium = purchases?.some(p => p.productId === SKU_LIFETIME || p.productId === SKU_SUBSCRIPTION);
      if (hasPremium) {
        await AsyncStorage.setItem('premium', 'true');
        setPremium(true);
        setToastType('success');
        setToastMessage(t('settings.premiumActive'));
        setToastVisible(true);
      } else {
        setToastType('error');
        setToastMessage(t('settings.restoreNone'));
        setToastVisible(true);
      }
      setProcessing(false);
    } catch { setProcessing(false); }
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
      <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: dark ? '#e6edf3' : '#0b1220' }}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}
      contentContainerStyle={[styles.contentContainer, compact ? { padding: 12, paddingBottom: 24 } : null]}
      showsVerticalScrollIndicator={false}
    >
      <AdBanner placement="settings_top" />
      
 
      {/* Premium */}
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
          {!premium ? (
            <TouchableOpacity 
              style={[styles.disclaimerBtn, { backgroundColor: dark ? '#7c3aed' : '#7c3aed', marginTop: 12 }]} 
              onPress={() => navigation.navigate('Premium')}
              activeOpacity={0.8}
            >
              <Text style={styles.disclaimerIcon}>🚀</Text>
              <Text style={styles.disclaimerText}>{t('settings.removeAds')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: dark ? '#7ee787' : '#2da44e', fontWeight: '700' }}>{t('settings.premiumActive')}</Text>
            </View>
          )}
        </View>
      </View>

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

      <AdvancedAdCard placement="settings" />
      <View style={{ borderTopWidth: 1, borderTopColor: dark ? '#30363d' : '#e1e4e8', padding: 8 }}>
        <AdBanner placement="global_footer" />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: dark ? '#6e7681' : '#8c959f' }]}>
          {t('settings.version')} 1.0.0
        </Text>
      </View>
      <Toast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} dark={dark} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: '500'
  }
});