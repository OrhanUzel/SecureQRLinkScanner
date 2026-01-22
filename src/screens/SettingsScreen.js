import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, Modal, Platform, Share, ActivityIndicator, Alert } from 'react-native';
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
import NetInfo from '@react-native-community/netinfo';
import StatusModal from '../components/StatusModal';
import { getHistory, clearHistory } from '../utils/classifier';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useFeedbackSystem } from '../hooks/useFeedbackSystem';
import FeedbackModal from '../components/FeedbackModal';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Purchases from 'react-native-purchases';
import { appEvents } from '../utils/events';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { markFeedbackGiven } = useFeedbackSystem();
  const { dark, theme, setTheme } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 360 || height < 640;
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [consentInfo, setConsentInfo] = useState(null);
  const [premium, setPremium] = useState(false);
  const [premiumInfo, setPremiumInfo] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [infoModal, setInfoModal] = useState({ visible: false, title: '', message: '' });
  const [statusModal, setStatusModal] = useState({ visible: false, title: '', message: '', type: 'error' });
  const [alwaysConfirmLink, setAlwaysConfirmLink] = useState(true);
  const [scanHapticsEnabled, setScanHapticsEnabled] = useState(true);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [clearHistoryModalVisible, setClearHistoryModalVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [premiumLockModalVisible, setPremiumLockModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const ALWAYS_CONFIRM_LINK_KEY = 'always_confirm_link';
  const SCAN_HAPTICS_ENABLED_KEY = 'scan_haptics_enabled';

  const handlePremiumFeature = (callback) => {
    if (premium) {
      callback();
    } else {
      setPremiumLockModalVisible(true);
    }
  };

  useEffect(() => {
    loadSettings();
    const unsubscribe = navigation.addListener('focus', () => {
      loadSettings();
    });
    return unsubscribe;
  }, [navigation]);

  const handlePremiumNavigation = async () => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      setStatusModal({
        visible: true,
        title: t('alerts.connectionErrorTitle'),
        message: t('alerts.connectionErrorMessage'),
        type: 'error'
      });
      return;
    }
    navigation.navigate('Paywall');
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const activeEntitlements = customerInfo?.entitlements?.active || {};
      const activeKeys = Object.keys(activeEntitlements);

      if (activeKeys.length > 0) {
        const entitlement = activeEntitlements[activeKeys[0]];
        await AsyncStorage.setItem('premium', 'true');
        
        const pid = entitlement.productIdentifier.toLowerCase();
        let type = 'subscription';
        if (pid.includes('lifetime')) type = 'lifetime';
        else if (pid.includes('year') || pid.includes('annual')) type = 'yearly';
        else if (pid.includes('month')) type = 'monthly';
        else if (pid.includes('week')) type = 'weekly';

        const info = {
          type,
          planName: t('paywall.premiumAccess'),
          purchaseDate: entitlement.latestPurchaseDate,
          expiryDate: entitlement.expirationDate
        };
        
        await AsyncStorage.setItem('premium_info', JSON.stringify(info));
        setPremium(true);
        setPremiumInfo(info);
        appEvents.emit('premiumChanged', true);

        setStatusModal({
          visible: true,
          title: t('paywall.restoreSuccessTitle'),
          message: t('paywall.restoreSuccessMessage'),
          type: 'success'
        });
      } else {
        setStatusModal({
          visible: true,
          title: t('paywall.restoreEmptyTitle'),
          message: t('paywall.restoreEmptyMessage'),
          type: 'info'
        });
      }
    } catch (e) {
      let message = t('paywall.restoreError');
      const errStr = e.message || '';
      
      if (e.userCancelled) {
        return;
      }
      
      if (errStr.includes('pending') || errStr.includes('Pending')) {
        message = t('paywall.paymentPendingError') || t('paywall.restoreError');
      }

      setStatusModal({
        visible: true,
        title: t('alerts.errorTitle'),
        message: message,
        type: 'error'
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const loadSettings = async () => {
    try {
      const [savedLang, savedTheme, consent, premiumFlag, savedInfo, confirmPref, scanHapticsPref] = await Promise.all([
        AsyncStorage.getItem(LANGUAGE_KEY),
        AsyncStorage.getItem('theme'),
        getConsentInfo(),
        AsyncStorage.getItem('premium'),
        AsyncStorage.getItem('premium_info'),
        AsyncStorage.getItem(ALWAYS_CONFIRM_LINK_KEY),
        AsyncStorage.getItem(SCAN_HAPTICS_ENABLED_KEY)
      ]);
      
      if (savedLang) setLanguage(savedLang);
      if (savedTheme) setTheme(savedTheme);
      if (consent) setConsentInfo(consent);
      setAlwaysConfirmLink(confirmPref === null ? true : confirmPref === 'true');
      setScanHapticsEnabled(scanHapticsPref === null ? true : scanHapticsPref === 'true');
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

  const shareContentAsFile = async (filename, mime, content) => {
    try {
      if (Platform.OS === 'web') {
        try {
          const blob = new Blob([content], { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return true;
        } catch {
          setToastType('error');
          setToastMessage(t('web_download_unavailable'));
          setToastVisible(true);
          return false;
        }
      }
      const uri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: mime });
      } else {
        await Share.share({ message: content });
      }
      return true;
    } catch {
      setToastType('error');
      setToastMessage(t('share_unavailable'));
      setToastVisible(true);
      return false;
    }
  };

  const downloadContentAsFile = async (filename, mime, content) => {
    try {
      if (Platform.OS === 'web') {
        try {
          const blob = new Blob([content], { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return true;
        } catch {
          setToastType('error');
          setToastMessage(t('web_download_unavailable'));
          setToastVisible(true);
          return false;
        }
      }
      if (Platform.OS === 'android' && FileSystem?.StorageAccessFramework?.requestDirectoryPermissionsAsync) {
        const perms = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!perms?.granted || !perms?.directoryUri) return false;
        const uri = await FileSystem.StorageAccessFramework.createFileAsync(perms.directoryUri, filename, mime);
        await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
        return true;
      }
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      const uri = baseDir + filename;
      await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
      return true;
    } catch {
      setToastType('error');
      setToastMessage(t('share_unavailable'));
      setToastVisible(true);
      return false;
    }
  };

  const exportHistory = async (format) => {
    try {
      const items = await getHistory();
      if (!items?.length) {
        setStatusModal({
          visible: true,
          title: t('settings.exportHistoryEmptyTitle'),
          message: t('settings.exportHistoryEmptyMessage'),
          type: 'info'
        });
        return;
      }

      const date = new Date();
      const y = String(date.getFullYear());
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const stamp = `${y}-${m}-${d}`;

      if (format === 'json') {
        const enriched = (items || []).map((it) => {
          const ts = it?.timestamp;
          const hasTs = typeof ts === 'number' && Number.isFinite(ts);
          return {
            ...it,
            timestamp_iso: hasTs ? new Date(ts).toISOString() : null,
            timestamp_local: hasTs ? new Date(ts).toLocaleString() : null
          };
        });
        const content = JSON.stringify(enriched, null, 2);
        const ok = await shareContentAsFile(`scan_history_${stamp}.json`, 'application/json', content);
        if (ok) {
          setToastType('success');
          setToastMessage(t('settings.exportHistorySuccess'));
          setToastVisible(true);
        }
        return;
      }

      const delimiter = ',';
      const header = ['timestamp', 'timestamp_iso', 'content', 'level', 'type', 'contentType', 'country', 'wifi_ssid', 'wifi_security', 'wifi_password', 'wifi_hidden'];
      const csvEscape = (v) => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = items.map((it) => {
        const wifi = it?.wifi || null;
        const ts = it?.timestamp ?? '';
        const iso = typeof ts === 'number' && Number.isFinite(ts) ? new Date(ts).toISOString() : '';
        return [
          ts,
          iso,
          it?.content ?? it?.normalized ?? '',
          it?.level ?? '',
          it?.type ?? '',
          it?.contentType ?? it?.kind ?? '',
          typeof it?.country === 'string' ? it.country : (it?.country?.label || it?.country?.name || ''),
          wifi?.ssid ?? '',
          wifi?.security ?? '',
          wifi?.password ?? '',
          wifi?.hidden ? 'true' : 'false',
        ].map(csvEscape).join(delimiter);
      });
      const content = `\ufeffsep=${delimiter}\r\n${[header.join(delimiter), ...rows].join('\r\n')}`;
      const ok = await shareContentAsFile(`scan_history_${stamp}.csv`, 'text/csv', content);
      if (ok) {
        setToastType('success');
        setToastMessage(t('settings.exportHistorySuccess'));
        setToastVisible(true);
      }
    } catch {
      setToastType('error');
      setToastMessage(t('share_unavailable'));
      setToastVisible(true);
    }
  };

  const downloadHistory = async (format) => {
    try {
      const items = await getHistory();
      if (!items?.length) {
        setStatusModal({
          visible: true,
          title: t('settings.exportHistoryEmptyTitle'),
          message: t('settings.exportHistoryEmptyMessage'),
          type: 'info'
        });
        return;
      }

      const date = new Date();
      const y = String(date.getFullYear());
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const stamp = `${y}-${m}-${d}`;

      if (format === 'json') {
        const enriched = (items || []).map((it) => {
          const ts = it?.timestamp;
          const hasTs = typeof ts === 'number' && Number.isFinite(ts);
          return {
            ...it,
            timestamp_iso: hasTs ? new Date(ts).toISOString() : null,
            timestamp_local: hasTs ? new Date(ts).toLocaleString() : null
          };
        });
        const content = JSON.stringify(enriched, null, 2);
        const ok = await downloadContentAsFile(`scan_history_${stamp}.json`, 'application/json', content);
        if (ok) {
          setToastType('success');
          setToastMessage(t('settings.downloadHistorySuccess'));
          setToastVisible(true);
        }
        return;
      }

      const delimiter = ',';
      const header = ['timestamp', 'timestamp_iso', 'content', 'level', 'type', 'contentType', 'country', 'wifi_ssid', 'wifi_security', 'wifi_password', 'wifi_hidden'];
      const csvEscape = (v) => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = items.map((it) => {
        const wifi = it?.wifi || null;
        const ts = it?.timestamp ?? '';
        const iso = typeof ts === 'number' && Number.isFinite(ts) ? new Date(ts).toISOString() : '';
        return [
          ts,
          iso,
          it?.content ?? it?.normalized ?? '',
          it?.level ?? '',
          it?.type ?? '',
          it?.contentType ?? it?.kind ?? '',
          typeof it?.country === 'string' ? it.country : (it?.country?.label || it?.country?.name || ''),
          wifi?.ssid ?? '',
          wifi?.security ?? '',
          wifi?.password ?? '',
          wifi?.hidden ? 'true' : 'false',
        ].map(csvEscape).join(delimiter);
      });
      const content = `\ufeffsep=${delimiter}\r\n${[header.join(delimiter), ...rows].join('\r\n')}`;
      const ok = await downloadContentAsFile(`scan_history_${stamp}.csv`, 'text/csv', content);
      if (ok) {
        setToastType('success');
        setToastMessage(t('settings.downloadHistorySuccess'));
        setToastVisible(true);
      }
    } catch {
      setToastType('error');
      setToastMessage(t('share_unavailable'));
      setToastVisible(true);
    }
  };

  const toggleAlwaysConfirmLink = async () => {
    handlePremiumFeature(async () => {
      const next = !alwaysConfirmLink;
      setAlwaysConfirmLink(next);
      try {
        await AsyncStorage.setItem(ALWAYS_CONFIRM_LINK_KEY, next ? 'true' : 'false');
      } catch {}
    });
  };

  const toggleScanHaptics = async () => {
    handlePremiumFeature(async () => {
      const next = !scanHapticsEnabled;
      setScanHapticsEnabled(next);
      try {
        await AsyncStorage.setItem(SCAN_HAPTICS_ENABLED_KEY, next ? 'true' : 'false');
      } catch {}
    });
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
        <ActivityIndicator size="large" color={dark ? '#67e8f9' : '#0284c7'} />
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
            colors={dark ? ['#881337', '#4c0519'] : ['#fff1f2', '#ffe4e6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 20,
              padding: 0,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: dark ? '#fb7185' : '#fda4af',
              position: 'relative'
            }}
          >
            {/* Decorative Background Elements */}
            <View style={{ position: 'absolute', top: -20, right: -20, opacity: dark ? 0.15 : 0.1 }}>
              <Ionicons name="trophy" size={140} color={dark ? '#f43f5e' : '#fb7185'} />
            </View>
            
            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ 
                  width: 44, height: 44, borderRadius: 22, 
                  backgroundColor: dark ? '#e11d48' : '#f43f5e',
                  justifyContent: 'center', alignItems: 'center',
                  marginRight: 12,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 3
                }}>
                  <Ionicons name="diamond" size={24} color="#fff" />
                </View>
                <View>
                  <Text style={{ 
                    fontSize: 18, 
                    fontWeight: '800', 
                    color: dark ? '#fff1f2' : '#881337',
                    letterSpacing: 0.5
                  }}>
                    {t('settings.premium_active_title') || 'PREMIUM ÜYE'}
                  </Text>
                  <Text style={{ 
                    fontSize: 13, 
                    color: dark ? '#fda4af' : '#e11d48',
                    fontWeight: '600'
                  }}>
                    {t('settings.premium_active_subtitle') || 'Tüm özellikler aktif'}
                  </Text>
                </View>
              </View>

              <View style={{ 
                backgroundColor: dark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <View>
                  <Text style={{ 
                    fontSize: 12, 
                    color: dark ? '#fecdd3' : '#9f1239',
                    marginBottom: 4,
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    {t('settings.current_plan') || 'MEVCUT PLAN'}
                  </Text>
                  <Text style={{ 
                    fontSize: 20, 
                    fontWeight: '800', 
                    color: dark ? '#fff' : '#881337' 
                  }}>
                    {premiumInfo?.type === 'lifetime' 
                      ? (t('settings.plan_lifetime') || 'Ömür Boyu')
                      : (premiumInfo?.type === 'monthly' 
                          ? (t('settings.plan_monthly') || 'Aylık Plan') 
                          : (premiumInfo?.type === 'yearly' 
                              ? (t('settings.plan_yearly') || 'Yıllık Plan') 
                              : (premiumInfo?.type === 'weekly' 
                                  ? (t('settings.plan_weekly') || 'Haftalık Plan')
                                  : (t('settings.plan_premium') || 'Premium Abonelik'))))}
                  </Text>
                </View>
                
                {premiumInfo?.type !== 'lifetime' && (
                  <View style={{ alignItems: 'flex-end' }}>
                     <Text style={{ 
                      fontSize: 12, 
                      color: dark ? '#fecdd3' : '#9f1239',
                      marginBottom: 4,
                      fontWeight: '600'
                    }}>
                      {t('settings.renews_on') || 'Yenilenme'}
                    </Text>
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '700', 
                      color: dark ? '#fff' : '#881337' 
                    }}>
                       {premiumInfo?.expiryDate ? new Date(premiumInfo.expiryDate).toLocaleDateString() : '-'}
                    </Text>
                  </View>
                )}
                 {premiumInfo?.type === 'lifetime' && (
                  <View style={{ 
                    paddingHorizontal: 10, paddingVertical: 4, 
                    backgroundColor: dark ? '#f43f5e' : '#e11d48', 
                    borderRadius: 8 
                  }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>∞ {t('settings.infinite') || 'SONSUZ'}</Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Premium Upsell (Only if NOT premium) */}
      {!premium && (
        <View style={styles.section}>
          <LinearGradient
            colors={dark ? ['#4c1d95', '#2e1065'] : ['#7c3aed', '#5b21b6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 24,
              padding: 24,
              position: 'relative',
              overflow: 'hidden',
              shadowColor: "#7c3aed",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
              marginBottom: 8
            }}
          >
            {/* Background Decor */}
            <View style={{ position: 'absolute', top: -30, right: -30, opacity: 0.15, transform: [{ rotate: '15deg' }] }}>
               <Ionicons name="diamond" size={160} color="white" />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 }}>
               <View style={{ 
                 width: 48, height: 48, borderRadius: 14, 
                 backgroundColor: 'rgba(255,255,255,0.2)', 
                 justifyContent: 'center', alignItems: 'center', marginRight: 16 
               }}>
                 <Text style={{ fontSize: 26 }}>👑</Text>
               </View>
               <View style={{ flex: 1 }}>
                 <Text style={{ fontSize: 20, fontWeight: '800', color: 'white', marginBottom: 6 }}>
                   {t('settings.premiumTitle')}
                 </Text>
                 <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 20 }}>
                   {t('settings.premiumDesc') || 'Gelişmiş özelliklerin kilidini açın.'}
                 </Text>
               </View>
            </View>

            <TouchableOpacity 
              style={{
                backgroundColor: 'white',
                borderRadius: 16,
                paddingVertical: 16,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4
              }} 
              onPress={handlePremiumNavigation}
              activeOpacity={0.9}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: dark ? '#4c1d95' : '#6d28d9', marginRight: 8 }}>
                 {t('settings.unlockFeatures') || 'Premium\'a Geç'}
              </Text>
              <Ionicons name="arrow-forward-circle" size={20} color={dark ? '#4c1d95' : '#6d28d9'} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ marginTop: 16, alignItems: 'center', padding: 4 }}
              onPress={handleRestore}
              activeOpacity={0.7}
            >
              <Text style={{ 
                color: 'rgba(255,255,255,0.7)', 
                fontSize: 13, 
                fontWeight: '600'
              }}>
                {t('settings.restorePurchases') || 'Satın Almaları Geri Yükle'}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
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

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionIcon, { fontSize: 20 }]}>💬</Text>
          <Text style={[styles.sectionTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
            {t('settings.support')}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.preferenceRow,
            { backgroundColor: dark ? '#161b22' : '#ffffff', borderColor: dark ? '#30363d' : '#e1e4e8' }
          ]}
          onPress={() => setFeedbackVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.preferenceEmoji}>✉️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.preferenceTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('settings.sendFeedback')}</Text>
            <Text style={[styles.preferenceDesc, { color: dark ? '#8b949e' : '#57606a' }]}>{t('settings.sendFeedbackSubtitle')}</Text>
          </View>
        </TouchableOpacity>
      </View>


      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionIcon, { fontSize: 20 }]}>🔗</Text>
          <Text style={[styles.sectionTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
            {t('settings.linkPrefs')}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.preferenceRow,
            { backgroundColor: dark ? '#161b22' : '#ffffff', borderColor: dark ? '#30363d' : '#e1e4e8' }
          ]}
          onPress={toggleAlwaysConfirmLink}
          activeOpacity={0.85}
        >
          <Text style={styles.preferenceEmoji}>❓</Text>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.preferenceTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('settings.alwaysConfirmLink')}</Text>
            <Text style={[styles.preferenceDesc, { color: dark ? '#8b949e' : '#57606a' }]}>{t('settings.alwaysConfirmLinkSubtitle')}</Text>
          </View>
          <View style={[styles.toggleTrack, { backgroundColor: alwaysConfirmLink ? '#22c55e' : (dark ? '#30363d' : '#cbd5e1') }]}>
            <View style={[styles.toggleKnob, { transform: [{ translateX: alwaysConfirmLink ? 18 : 0 }] }]} />
          </View>
        </TouchableOpacity>
      </View>

       <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionIcon, { fontSize: 20 }]}>📷</Text>
          <Text style={[styles.sectionTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
            {t('settings.scanPrefs')}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.preferenceRow,
            { backgroundColor: dark ? '#161b22' : '#ffffff', borderColor: dark ? '#30363d' : '#e1e4e8' }
          ]}
          onPress={toggleScanHaptics}
          activeOpacity={0.85}
        >
          <Text style={styles.preferenceEmoji}>📳</Text>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.preferenceTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('settings.scanHaptics')}</Text>
            <Text style={[styles.preferenceDesc, { color: dark ? '#8b949e' : '#57606a' }]}>{t('settings.scanHapticsSubtitle')}</Text>
          </View>
          <View style={[styles.toggleTrack, { backgroundColor: scanHapticsEnabled ? '#22c55e' : (dark ? '#30363d' : '#cbd5e1') }]}>
            <View style={[styles.toggleKnob, { transform: [{ translateX: scanHapticsEnabled ? 18 : 0 }] }]} />
          </View>
        </TouchableOpacity>
      </View>

     
 

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionIcon, { fontSize: 20 }]}>🕘</Text>
          <Text style={[styles.sectionTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
            {t('settings.historyTools')}
          </Text>
        </View>
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            style={[
              styles.preferenceRow,
              { backgroundColor: dark ? '#161b22' : '#ffffff', borderColor: dark ? '#30363d' : '#e1e4e8' }
            ]}
            onPress={() => {
              handlePremiumFeature(() => {
                setExportModalVisible(true);
              });
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.preferenceEmoji}>📤</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.preferenceTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('settings.exportHistory')}</Text>
              <Text style={[styles.preferenceDesc, { color: dark ? '#8b949e' : '#57606a' }]}>{t('settings.exportHistorySubtitle')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.preferenceRow,
              { backgroundColor: dark ? '#161b22' : '#ffffff', borderColor: dark ? '#30363d' : '#e1e4e8' }
            ]}
            onPress={() => setClearHistoryModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.preferenceEmoji}>🗑️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.preferenceTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('settings.clearHistoryShortcut')}</Text>
              <Text style={[styles.preferenceDesc, { color: dark ? '#8b949e' : '#57606a' }]}>{t('settings.clearHistorySubtitle')}</Text>
            </View>
          </TouchableOpacity>
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
      <Modal
        visible={exportModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setExportModalVisible(false)}
      >
        <View style={styles.infoOverlay}>
          <View style={[styles.infoCard, { backgroundColor: dark ? '#0b1120' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoIcon}>📤</Text>
              <Text style={[styles.infoTitle, { color: dark ? '#e6edf3' : '#0f172a' }]}>{t('settings.exportHistory')}</Text>
            </View>
            <Text style={[styles.infoMessage, { color: dark ? '#94a3b8' : '#475569' }]}>{t('settings.exportHistoryChoose')}</Text>
            <TouchableOpacity
              style={[styles.infoCta, { backgroundColor: '#2563eb' }]}
              onPress={async () => {
                setExportModalVisible(false);
                await exportHistory('json');
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.infoCtaText}>{t('settings.exportHistoryJson')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.infoCta, { backgroundColor: '#0ea5e9' }]}
              onPress={async () => {
                setExportModalVisible(false);
                await exportHistory('csv');
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.infoCtaText}>{t('settings.exportHistoryCsv')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.infoCta, { backgroundColor: '#16a34a' }]}
              onPress={async () => {
                setExportModalVisible(false);
                await downloadHistory('json');
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.infoCtaText}>{t('settings.downloadHistoryJson')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.infoCta, { backgroundColor: '#22c55e' }]}
              onPress={async () => {
                setExportModalVisible(false);
                await downloadHistory('csv');
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.infoCtaText}>{t('settings.downloadHistoryCsv')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.infoCta, { backgroundColor: dark ? '#334155' : '#64748b' }]}
              onPress={() => setExportModalVisible(false)}
              activeOpacity={0.9}
            >
              <Text style={styles.infoCtaText}>{t('actions.cancel') || 'Vazgeç'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={clearHistoryModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={60}
            tint={dark ? 'dark' : 'light'}
            style={[
              styles.modalCard,
              { backgroundColor: dark ? 'rgba(22,27,34,0.85)' : 'rgba(255,255,255,0.9)', borderColor: dark ? '#30363d' : '#e1e4e8' }
            ]}
          >
            <View style={styles.modalHeader}>
              <Ionicons name="trash-outline" size={22} color={dark ? '#ff6b6b' : '#d00000'} />
              <Text style={[styles.modalTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('history.clearConfirmTitle')}</Text>
            </View>
            <Text style={[styles.modalMessage, { color: dark ? '#8b98a5' : '#3b4654' }]}>{t('history.clearConfirmMessage')}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtnOutline, { borderColor: dark ? '#8b98a5' : '#7a8699' }]}
                onPress={() => setClearHistoryModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalBtnOutlineText, { color: dark ? '#c9d1d9' : '#24292f' }]}>{t('actions.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: dark ? '#d00000' : '#d00000' }]}
                onPress={async () => {
                  setClearHistoryModalVisible(false);
                  const ok = await clearHistory();
                  if (ok) {
                    setToastType('success');
                    setToastMessage(t('settings.historyCleared'));
                    setToastVisible(true);
                  } else {
                    setToastType('error');
                    setToastMessage(t('share_unavailable'));
                    setToastVisible(true);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnText}>{t('actions.delete')}</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
      </ScrollView>

      <Toast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} dark={dark} style={{ bottom: Math.max(insets.bottom + 72, 72) }} />

      <StatusModal
        visible={statusModal.visible}
        title={statusModal.title}
        message={statusModal.message}
        type={statusModal.type}
        onClose={() => setStatusModal(prev => ({ ...prev, visible: false }))}
      />

      <Modal
        transparent={true}
        visible={isRestoring}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: dark ? '#1e293b' : '#ffffff', padding: 24, borderRadius: 16, alignItems: 'center', gap: 12, minWidth: 160 }}>
            <ActivityIndicator size="large" color={dark ? '#67e8f9' : '#0284c7'} />
            <Text style={{ color: dark ? '#e2e8f0' : '#1e293b', fontWeight: '600' }}>
              {t('settings.processing')}
            </Text>
          </View>
        </View>
      </Modal>

      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        onFeedbackGiven={markFeedbackGiven}
      />

      <Modal
        visible={premiumLockModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPremiumLockModalVisible(false)}
      >
        <View style={styles.infoOverlay}>
          <View style={[styles.infoCard, { backgroundColor: dark ? '#0b1120' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoIcon}>👑</Text>
              <Text style={[styles.infoTitle, { color: dark ? '#e6edf3' : '#0f172a' }]}>
                {t('settings.premium_required_title') || 'Premium Özellik'}
              </Text>
            </View>
            <Text style={[styles.infoMessage, { color: dark ? '#94a3b8' : '#475569' }]}>
              {t('settings.premium_required_message') || 'Bu özelliği kullanmak için Premium üyeliğe geçin.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.infoCta, { backgroundColor: dark ? '#334155' : '#e2e8f0', flex: 1 }]}
                onPress={() => setPremiumLockModalVisible(false)}
                activeOpacity={0.9}
              >
                <Text style={[styles.infoCtaText, { color: dark ? '#e6edf3' : '#0f172a' }]}>{t('actions.cancel') || 'Vazgeç'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.infoCta, { backgroundColor: '#2563eb', flex: 1 }]}
                onPress={() => {
                  setPremiumLockModalVisible(false);
                  navigation.navigate('Paywall');
                }}
                activeOpacity={0.9}
              >
                <Text style={styles.infoCtaText}>{t('settings.unlockFeatures') || 'Premium\'a Geç'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1
  },
  preferenceEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center'
  },
  preferenceTitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  preferenceDesc: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 4
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24
  },
  modalCard: {
    width: '92%',
    maxWidth: 480,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  modalMessage: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    flexWrap: 'wrap'
  },
  modalBtnOutline: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 120,
    alignItems: 'center'
  },
  modalBtnOutlineText: {
    fontWeight: '700',
    fontSize: 14
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center'
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14
  }
});
