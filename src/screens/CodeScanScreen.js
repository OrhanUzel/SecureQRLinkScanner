import { getUsomInfo } from '../utils/usomHelper';
import { detectGs1Country } from '../utils/countryHelper';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Animated, ActivityIndicator, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { classifyInput } from '../utils/classifier';
import { checkRisk } from '../utils/riskcheck';
import { openVirusTotalForResult, openExternalUrl } from '../utils/linkActions';
import { useAppTheme } from '../theme/ThemeContext';

import ActionButtonsGrid from '../components/ActionButtonsGrid';
import ConfirmOpenLinkModal from '../components/ConfirmOpenLinkModal';
import Toast from '../components/Toast';
import { useFeedbackSystem } from '../hooks/useFeedbackSystem';
import FeedbackModal from '../components/FeedbackModal';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import OfflineNotice from '../components/OfflineNotice';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CodeScanScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { dark } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const { feedbackVisible, closeFeedback, registerLinkOpen, markFeedbackGiven } = useFeedbackSystem();
  const compact = width < 360 || height < 640;
  const isFocused = useIsFocused();
  const cameraRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const isScanning = useRef(false);
  const lastScannedValue = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facing, setFacing] = useState('back');
  const [gs1Country, setGs1Country] = useState(null);
  const [showCamera, setShowCamera] = useState(true);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [offlineNoticeHeight, setOfflineNoticeHeight] = useState(0);
  const insets = useSafeAreaInsets();

  // Her girişte (ekran odaklandığında) izni tekrar iste.
  // Android OS izin ekranını otomatik tetikler (canAskAgain=true ise).
  useEffect(() => {
    if (isFocused && !permission?.granted && permission?.canAskAgain !== false) {
      (async () => { try { await requestPermission(); } catch {} })();
    }
  }, [isFocused, permission]);

  useEffect(() => {
    if (!showCamera && result) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showCamera, result]);

  const saveHistory = async (item) => {
    try {
      const raw = await AsyncStorage.getItem('scan_history');
      const arr = raw ? JSON.parse(raw) : [];
      
      // Prevent consecutive duplicates
      if (arr.length > 0 && arr[0].content === item.content) {
        return;
      }

      arr.unshift({ ...item, timestamp: Date.now() });
      await AsyncStorage.setItem('scan_history', JSON.stringify(arr.slice(0, 50)));
    } catch {}
  };

  const onBarcodeScanned = async (ev) => {
    if (isScanning.current) return;

    if (__DEV__) {
      console.log('[CodeScanScreen] Barcode event keys:', Object.keys(ev || {}));
      console.log('[CodeScanScreen] Barcode event:', JSON.stringify(ev, null, 2));
    }
    
    // Try multiple properties from different expo-camera versions
    const barcode = Array.isArray(ev?.barcodes) ? ev.barcodes[0] : ev;
    
    // Check all possible data properties
    const possibleData = [
      barcode?.rawValue,
      barcode?.data, 
      barcode?.raw,
      barcode?.value,
      ev?.data,
      ev?.rawValue,
      ev?.raw,
      ev?.value
    ].find(d => d && typeof d === 'string' && d.length > 0);
    
    let data = typeof possibleData === 'string' ? possibleData.trim() : String(possibleData ?? '').trim();
    
    // Try URL decoding if data looks URL-encoded (contains %XX patterns)
    if (data.includes('%')) {
      try {
        const decoded = decodeURIComponent(data);
        if (__DEV__) console.log('[CodeScanScreen] URL decoded data:', decoded);
        data = decoded;
      } catch (e) {
        if (__DEV__) console.log('[CodeScanScreen] URL decode failed, using original');
      }
    }
    
    if (__DEV__) {
      console.log('[CodeScanScreen] All barcode props:', barcode ? Object.keys(barcode) : 'no barcode');
      console.log('[CodeScanScreen] Extracted data:', data);
      console.log('[CodeScanScreen] Data char codes (first 20):', data.substring(0, 20).split('').map(c => c.charCodeAt(0)));
    }
    
    if (!data) return;
    if (data === lastScannedValue.current) return;

    isScanning.current = true;
    lastScannedValue.current = data;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    let usomBad = false;
    try {
      usomBad = await isUsomUnsafe(data) || await isUsomHostUnsafe(data);
    } catch {}

    try {
      setLoading(true);
      let scannedType = (ev?.barcodes?.[0]?.type || ev?.type || '').toString().toLowerCase();
      
      // Fallback: detect from length if type is missing
      if (!scannedType || scannedType === '' || scannedType === '0') {
         const digits = data.replace(/[^0-9]/g, '');
         if (digits.length === 13) scannedType = 'ean13';
         else if (digits.length === 8) scannedType = 'ean8';
         else if (digits.length === 12) scannedType = 'upc_a';
      }

      if (__DEV__) console.log('[CodeScanScreen] Calling classifyInput with data:', data, 'scannedType:', scannedType);
      const res = classifyInput(data, scannedType);
      if (__DEV__) console.log('[CodeScanScreen] Classification result:', res.type, 'isUrl:', res.isUrl, 'normalized:', res.normalized);
      let updated = { ...res };

      // Uzaktan risk kontrolü (yalnızca URL ise)
      if (res.isUrl) {
        const remote = await checkRisk(res.normalized);
        if (remote?.error) {
          setOffline(true);
        } else {
          setOffline(false);
        }
        if (remote?.isRisky) {
          const domainInfo = t('remoteRisk.checkedDomainLabel') + ' ' + (remote?.checkedDomain || res.normalized);
          const sources = t('remoteRisk.sourcesLabel') + ' ' + ((remote?.foundInFiles || []).join(', ') || '-');
          const files = remote?.foundInFiles || [];
          const reasons = [ ...(res.reasons || []), 'remoteRisk.defaultMessage', domainInfo, sources ];
          if (files.includes('usom')) {
            reasons.push({ type: 'usom', data: remote?.usomDetails || {} });
          } else if (files.includes('aa') || files.includes('ab') || files.includes('ac')) {
            reasons.push({ type: 'github', repo: 'romainmarcoux/malicious-domains', url: 'https://github.com/romainmarcoux/malicious-domains/tree/main' });
          }
          updated = { ...res, level: 'unsafe', reasons };
        }
      }
      if (usomBad) {
        const reasons = [ ...(updated.reasons || []), 'classifier.usomWarning' ];
        updated = { ...updated, level: 'unsafe', reasons };
      }

      setResult(updated);
      setShowCamera(false);
      
      const eligible = ['ean13', 'ean8', 'upc_a'];
      const country = eligible.includes(scannedType) ? detectGs1Country(data, t) : null;
      setGs1Country(country);
      
      saveHistory({ 
        content: updated.normalized, 
        level: updated.level,
        type: scannedType,
        contentType: updated.type,
        wifi: updated.type === 'wifi' ? (updated.wifi || null) : null,
        country: country
      });
    } catch {
      setOffline(true);
      isScanning.current = false;
    } finally {
      setLoading(false);
    }
  };

  const openLink = async () => {
    if (!result?.normalized) return;
    const raw = result.normalized.startsWith('http') ? result.normalized : 'https://' + result.normalized;
    setPendingUrl(raw);

    const triggered = await registerLinkOpen();
    if (!triggered) {
      setConfirmVisible(true);
    }
  };

  const handleFeedbackClose = () => {
    closeFeedback();
    if (pendingUrl) {
      setTimeout(() => {
        setConfirmVisible(true);
      }, 300);
    }
  };

  const openVirusTotal = async () => {
    await openVirusTotalForResult(result);
  };

  const shareText = async () => {
    if (!result?.normalized) return;
    try { await Share.share({ message: result.normalized }); } catch {}
  };

  const shareContentAsFile = async (filename, mime, content) => {
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
      const uri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: mime });
      } else {
        await Share.share({ message: content });
      }
    } catch {}
  };

  const resetScan = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    setResult(null);
    setGs1Country(null);
    setShowCamera(true);
    isScanning.current = false;
    lastScannedValue.current = null;
  };

  const goToHome = () => {
    if (navigation) {
      navigation.navigate('Home');
    }
  };

  // If permission not granted, show localized prompt and re-request button
  if (!permission?.granted) {
    const canAskAgain = permission?.canAskAgain !== false;
    return (
      <View style={[styles.center, { backgroundColor: dark ? '#0b0f14' : '#e9edf3' }]}>
        <Ionicons name="camera-outline" size={64} color={dark ? '#3b4654' : '#8b98a5'} />
        <Text style={[styles.permissionText, { color: dark ? '#e6edf3' : '#0b1220' }]}>
          {t('camera.permission.message')}
        </Text>
        {canAskAgain && (
          <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.grantBtnText}>{t('camera.permission.allow')}</Text>
          </TouchableOpacity>
        )}
        {!canAskAgain && (
          <TouchableOpacity style={[styles.grantBtn, { backgroundColor: '#374151', marginTop: 10 }]} onPress={() => Linking.openSettings()}>
            <Ionicons name="settings-outline" size={20} color="#fff" />
            <Text style={styles.grantBtnText}>{t('camera.permission.openSettings')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Determine if result is a barcode for UI display
  const isBarcode = result && result.type !== 'wifi' && !result.isUrl && (
    (result.type && ['ean13', 'ean8', 'upc_a', 'code39', 'code128', 'codabar', 'itf'].includes(result.type.toLowerCase())) ||
    (result.normalized && /^\d+$/.test(result.normalized) && [8, 12, 13].includes(result.normalized.length))
  );

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#e9edf3' }]}>
      <OfflineNotice
        visible={offline}
        dark={dark}
        message={t('alerts.offline')}
        onHeightChange={setOfflineNoticeHeight}
      />
      <View style={{ flex: 1, paddingTop: offline ? offlineNoticeHeight + 8 : 0 }}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={'#9ecaff'} />
          <Text style={[styles.loadingText, { color: '#fff' }]}>{t('loading.securityChecks')}</Text>
        </View>
      )}
      {showCamera && (
        <>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            enableTorch={torchOn}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'code39', 'code128'] }}
            onBarcodeScanned={onBarcodeScanned}
          />

          <View style={styles.overlay} />

          <View style={styles.topBar}>
            <TouchableOpacity 
              style={[styles.iconBtn, { backgroundColor: torchOn ? '#ffb703' : 'rgba(16, 21, 28, 0.8)', borderColor: 'rgba(255, 255, 255, 0.15)' }]} 
              onPress={() => setTorchOn(v => !v)}
            >
              <Ionicons name={torchOn ? "flashlight" : "flashlight-outline"} size={20} color={torchOn ? '#000' : '#fff'} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconBtn, { backgroundColor: 'rgba(16, 21, 28, 0.8)', borderColor: 'rgba(255, 255, 255, 0.15)' }]} 
              onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
            >
              <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View pointerEvents="none" style={styles.guideWrap}>
            <View style={styles.scannerFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={styles.guideText}>
              {t('scan.guide.align')}
            </Text>
          </View>
        </>
      )}

      {result && !showCamera && (
        <Animated.View 
          style={[
            styles.resultContainer, 
            { 
              backgroundColor: dark ? '#0b0f14' : '#e9edf3',
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[{ paddingBottom: 24 }, compact ? { paddingHorizontal: 12 } : { paddingHorizontal: 20 }]}>
          <View style={[styles.resultHeader, compact ? { marginBottom: 16, gap: 12 } : null]}>
            {(isBarcode || gs1Country) && result.type !== 'wifi' ? (
              <>
                <Ionicons 
                  name="barcode-outline" 
                  size={compact ? 40 : 48} 
                  color={dark ? '#e6edf3' : '#0b1220'} 
                />
                <View style={{alignItems: 'center', gap: 4}}>
                  <View style={[styles.badge, { backgroundColor: dark ? '#1f6feb' : '#0969da' }]}> 
                    <Ionicons name="scan-outline" size={16} color="#fff" />
                    <Text style={styles.badgeText}>{t('scan.barcodeDetected') || 'Barkod Tespit Edildi'}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: dark ? '#8b98a5' : '#5c6a7a', textAlign: 'center', maxWidth: 250 }}>
                    {t('scan.barcodeSafeDesc') || 'Barkodlar herhangi bir bağlantı içermediği için güvenlidir.'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons 
                  name={result.level === 'secure' ? 'shield-checkmark' : result.level === 'suspicious' ? 'warning' : 'shield'} 
                  size={compact ? 40 : 48} 
                  color={result.level === 'secure' ? '#2f9e44' : result.level === 'suspicious' ? '#ffb703' : '#d00000'} 
                />
                <RiskBadge level={result.level} />
              </>
            )}
          </View>

          <View style={[styles.resultCard, compact ? { padding: 14, gap: 14 } : null, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#e5e9f0' }]}> 
            <View style={[styles.resultSection, { alignItems: 'center' }]}>
              <Text style={[styles.sectionLabel, { color: dark ? '#8b98a5' : '#5c6a7a' }]}
              >
                {result.isUrl ? (t('label.url') || 'URL') : (
                  (isBarcode || gs1Country) ? (t('scan.barcodeDetected') || 'Barkod') :
                  result.type === 'wifi' ? (t('label.wifi') || 'Wi‑Fi') :
                  result.type === 'tel' ? (t('label.phone') || 'Telefon') :
                  result.type === 'email' ? (t('label.email') || 'E‑posta') :
                  result.type === 'sms' ? (t('label.sms') || 'SMS') :
                  result.type === 'geo' ? (t('label.location') || 'Konum') :
                  result.type === 'vcard' ? (t('label.contact') || 'Kişi') :
                  result.type === 'event' ? (t('label.event') || 'Etkinlik') :
                  (t('label.content') || 'İçerik')
                )}
              </Text>
              <Text style={[styles.linkText, compact ? { fontSize: 14, lineHeight: 22 } : null, { color: dark ? '#9ecaff' : '#0066cc', textAlign: 'center' }]} numberOfLines={3} selectable>
                {result.normalized}
              </Text>
            </View>

            {(isBarcode || gs1Country) && result.type !== 'wifi' && (
              <View style={[styles.resultSection, styles.countrySection, { alignItems: 'center' }]}>
                {gs1Country ? (
                  gs1Country.key === 'country.israel' ? (
                  <View style={[styles.countryBadge, { 
                    backgroundColor: dark ? 'rgba(207,34,46,0.15)' : '#fff5f5', 
                    borderColor: dark ? 'rgba(207,34,46,0.4)' : '#cf222e',
                    borderWidth: 1,
                    flexDirection: 'column',
                    alignItems: 'center',
                    paddingVertical: 12
                  }]}>
                     <View style={{ flexDirection: 'row', gap: 12, marginBottom: 4 }}>
                      <Text style={{ fontSize: 32 }}>{gs1Country.flag}</Text>
                    </View>
                    <Text style={[styles.countryText, { color: dark ? '#ff7b72' : '#cf222e', fontWeight: '700', fontSize: 16 }]}>
                       {gs1Country.name}
                    </Text>
                     <Text style={[styles.countryText, { color: dark ? '#ff7b72' : '#cf222e', fontSize: 13, marginTop: 4, textAlign: 'center' }]}>
                      {t('scan.israelProduct') || 'Bu ürün İsrail\'de üretilmiştir.'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <Text style={[styles.countryText, { color: dark ? '#ff7b72' : '#cf222e', fontSize: 12, fontWeight: '700' }]}>
                        #FreePalestine
                      </Text>
                      <Text style={[styles.countryText, { color: dark ? '#ff7b72' : '#cf222e', fontSize: 12, fontWeight: '700' }]}>
                        #BoycottIsrael
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.countryBadge, { alignSelf: 'center' }]}>
                    <Text style={{ fontSize: 24 }}>{gs1Country.flag}</Text>
                    <Text style={[styles.countryText, { color: dark ? '#e6edf3' : '#0b1220' }]}>
                      {!['country.issn', 'country.isbn', 'country.refund_receipt', 'country.coupon_common', 'country.coupon'].includes(gs1Country.key) && (t('scan.producedIn') || 'Üretim Yeri: ')} {gs1Country.name}
                    </Text>
                  </View>
                )
                ) : (
                  <View style={[styles.countryBadge, { alignSelf: 'center', backgroundColor: dark ? '#1b2330' : '#f3f4f6', padding: 12, borderRadius: 12 }]}>
                    <Text style={[styles.countryText, { color: dark ? '#e6edf3' : '#0b1220' }]}>
                      {t('scan.barcodeSafeDesc') || 'Barkodlar herhangi bir bağlantı içermediği için güvenlidir.'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {result.reasons?.length > 0 && result.isUrl && (
              <View style={styles.resultSection}>
                <Text style={[styles.sectionLabel, { color: dark ? '#8b98a5' : '#5c6a7a' }]}>
                  {t('result.detectedRisks') || 'Tespit Edilen Riskler'}
                </Text>
                <View style={styles.reasonList}>
                  {result.reasons.map((r, idx) => {
                    if (typeof r === 'object' && r.type === 'usom') {
                      const d = r.data;
                      const usomInfo = getUsomInfo(d.threatType, i18n.language, d.description);
                      return (
                     <View key={idx} style={[styles.usomBlock, { backgroundColor: dark ? 'rgba(207,34,46,0.1)' : '#fff5f5', borderColor: dark ? 'rgba(207,34,46,0.3)' : '#ffcccc' }]}>
                       <Text style={[styles.usomTitle, { color: dark ? '#ff7b72' : '#cf222e' }]}>{t('remoteRisk.usomTitle')}</Text>
                       {usomInfo.title && <Text style={[styles.usomText, { color: dark ? '#e6edf3' : '#24292f' }]}><Text style={{fontWeight:'700'}}>{t('remoteRisk.usomTypeLabel')}</Text> {usomInfo.title}</Text>}
                       {(usomInfo.desc || d.description) && <Text style={[styles.usomText, { color: dark ? '#e6edf3' : '#24292f' }]}><Text style={{fontWeight:'700'}}>{t('remoteRisk.usomDescLabel')}</Text> {usomInfo.desc || d.description}</Text>}
                        {d.detectedDate && <Text style={[styles.usomText, { color: dark ? '#e6edf3' : '#24292f' }]}><Text style={{fontWeight:'700'}}>{t('remoteRisk.usomDateLabel')}</Text> {(() => {
                          try {
                            return new Date(d.detectedDate).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                          } catch (e) {
                            return d.detectedDate;
                          }
                        })()}</Text>}
                        {d.url && <Text style={[styles.usomText, { color: dark ? '#e6edf3' : '#24292f' }]}><Text style={{fontWeight:'700'}}>{t('remoteRisk.usomUrlLabel')}</Text> {d.url}</Text>}
                       {(d.ipAddress || d.ip) && <Text style={[styles.usomText, { color: dark ? '#e6edf3' : '#24292f' }]}><Text style={{fontWeight:'700'}}>{t('remoteRisk.usomIpLabel')}</Text> {d.ipAddress || d.ip}</Text>}
                        <TouchableOpacity onPress={() => Linking.openURL('https://www.usom.gov.tr/adres')} style={{marginTop: 8}}>
                          <Text style={{color: dark ? '#58a6ff' : '#0969da', textDecorationLine: 'underline', fontWeight: '500'}}>{t('remoteRisk.usomReference')}</Text>
                        </TouchableOpacity>
                      </View>
                   );
                 }
                 if (typeof r === 'object' && r.type === 'github') {
                   return (
                     <View key={idx} style={[styles.usomBlock, { backgroundColor: dark ? 'rgba(210,153,34,0.1)' : '#fff8c5', borderColor: dark ? 'rgba(210,153,34,0.3)' : '#e3b341' }]}>
                       <Text style={[styles.usomTitle, { color: dark ? '#d29922' : '#9a6700' }]}>{t('remoteRisk.githubTitle')}</Text>
                       <Text style={[styles.usomText, { color: dark ? '#e6edf3' : '#24292f' }]}>
                         {t('remoteRisk.githubFoundText', { repo: r.repo })}
                       </Text>
                       <TouchableOpacity onPress={() => Linking.openURL(r.url)} style={{marginTop: 4}}>
                          <Text style={{color: dark ? '#58a6ff' : '#0969da', textDecorationLine: 'underline'}}>{t('remoteRisk.viewSource')}</Text>
                       </TouchableOpacity>
                     </View>
                   );
                 }
                    return (
                      <View key={idx} style={styles.reasonItem}>
                        <View style={[styles.reasonDot, { backgroundColor: result.level === 'unsafe' ? '#d00000' : '#ffb703' }]} />
                        <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>
                          {t(r)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {result.type === 'wifi' && (
              <View style={styles.resultSection}>
                <Text style={[styles.sectionLabel, { color: dark ? '#8b98a5' : '#5c6a7a' }]}>{t('label.wifiDetails') || 'Wi‑Fi Detayları'}</Text>
                <View style={{ gap: 6 }}>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('wifi.ssid') || 'SSID'}: {result?.wifi?.ssid || '-'}</Text>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('wifi.security') || 'Güvenlik'}: {result?.wifi?.security || '-'}</Text>
                  {result?.wifi?.security !== 'nopass' && (
                    <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('wifi.password') || 'Şifre'}: {result?.wifi?.password || '-'}</Text>
                  )}
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('wifi.hidden') || 'Gizli'}: {result?.wifi?.hidden ? (t('confirm.yes') || 'Evet') : (t('confirm.no') || 'Hayır')}</Text>
                </View>
              </View>
            )}

            {result.type === 'tel' && (
              <View style={styles.resultSection}>
                <Text style={[styles.sectionLabel, { color: dark ? '#8b98a5' : '#5c6a7a' }]}>{t('label.phone') || 'Telefon'}</Text>
                <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{result?.tel?.number || '-'}</Text>
              </View>
            )}

            {result.type === 'email' && (
              <View style={styles.resultSection}>
                <Text style={[styles.sectionLabel, { color: dark ? '#8b98a5' : '#5c6a7a' }]}>{t('label.email') || 'E‑posta'}</Text>
                <View style={{ gap: 6 }}>
                <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('email.to') || 'Alıcı'}: {result?.email?.to || '-'}</Text>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('email.subject') || 'Konu'}: {result?.email?.subject || '-'}</Text>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('email.body') || 'İçerik'}: {result?.email?.body || '-'}</Text>
                </View>
              </View>
            )}

            {result.type === 'sms' && (
              <View style={styles.resultSection}>
                <Text style={[styles.sectionLabel, { color: dark ? '#8b98a5' : '#5c6a7a' }]}>{t('label.sms') || 'SMS'}</Text>
                <View style={{ gap: 6 }}>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('sms.number') || 'Numara'}: {result?.sms?.number || '-'}</Text>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('sms.body') || 'Mesaj'}: {result?.sms?.body || '-'}</Text>
                </View>
              </View>
            )}

            {result.type === 'vcard' && (
              <View style={styles.resultSection}>
                <Text style={[styles.sectionLabel, { color: dark ? '#8b98a5' : '#5c6a7a' }]}>{t('label.contact') || 'Kişi'}</Text>
                <View style={{ gap: 6 }}>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('contact.name') || 'Ad'}: {result?.vcard?.fn || '-'}</Text>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('contact.tel') || 'Tel'}: {result?.vcard?.tel || '-'}</Text>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('contact.email') || 'E‑posta'}: {result?.vcard?.email || '-'}</Text>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('contact.org') || 'Kurum'}: {result?.vcard?.org || '-'}</Text>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('contact.title') || 'Ünvan'}: {result?.vcard?.title || '-'}</Text>
                </View>
              </View>
            )}

            {result.type === 'event' && (
              <View style={styles.resultSection}>
                <Text style={[styles.sectionLabel, { color: dark ? '#8b98a5' : '#5c6a7a' }]}>{t('label.event') || 'Etkinlik'}</Text>
                <View style={{ gap: 6 }}>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('event.summary') || 'Başlık'}: {result?.event?.summary || '-'}</Text>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('event.location') || 'Konum'}: {result?.event?.location || '-'}</Text>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('event.dtstart') || 'Başlangıç'}: {result?.event?.dtstart || '-'}</Text>
                  <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('event.dtend') || 'Bitiş'}: {result?.event?.dtend || '-'}</Text>
                </View>
              </View>
            )}
          </View>

          <ActionButtonsGrid
            compact={compact}
            style={{ marginTop: 15 }}
            buttons={
              result.type === 'wifi'
                ? [
                    {
                      key: 'copy_wifi',
                      label: t('actions.copyWifiPassword') || 'Wi‑Fi Şifresini Kopyala',
                      icon: 'key-outline',
                      onPress: async () => {
                        const pwd = result?.wifi?.password || '';
                        if (!pwd) return;
                        try { await Clipboard.setStringAsync(pwd); setToastMsg(t('toast.copied')); setToastVisible(true); } catch {}
                      },
                      color: '#0f766e',
                    },
                    {
                      key: 'share_wifi',
                      label: t('actions.share') || 'Şifreyi Paylaş',
                      icon: 'share-outline',
                      onPress: async () => {
                        const pwd = result?.wifi?.password || '';
                        if (!pwd) return;
                        try { await Share.share({ message: pwd }); } catch {}
                      },
                      color: '#6c5ce7',
                    },
                  ]
                : [
                    result.isUrl && {
                      key: 'open',
                      label: t('actions.openLink') || 'Linki Aç',
                      icon: 'open-outline',
                      onPress: openLink,
                      color: '#2f9e44',
                    },
                    result?.normalized && {
                      key: 'copy',
                      label: t('actions.copy') || 'Kopyala',
                      icon: 'copy',
                      onPress: async () => {
                        try { await Clipboard.setStringAsync(result.normalized); setToastMsg(t('toast.copied')); setToastVisible(true); } catch {}
                      },
                      color: '#0969da',
                    },
                    (isBarcode || gs1Country) && {
                      key: 'google',
                      label: t('actions.searchGoogle') || 'Google\'da Ara',
                      icon: 'logo-google',
                      onPress: () => {
                        const url = 'https://www.google.com/search?q=' + encodeURIComponent(result.normalized);
                        openExternalUrl(url);
                      },
                      color: '#4285f4',
                    },
                    {
                      key: 'share',
                      label: t('actions.share') || 'Paylaş',
                      icon: 'share-outline',
                      onPress: shareText,
                      color: '#6c5ce7',
                    },
                    result.isUrl && {
                      key: 'vt',
                      label: t('actions.analyzeVirusTotal') || 'VirusTotal',
                      icon: 'search-outline',
                      onPress: openVirusTotal,
                      color: '#8250df',
                    },
                    result.type === 'tel' && {
                      key: 'tel',
                      label: t('actions.call') || 'Ara',
                      icon: 'call-outline',
                      onPress: () => {
                        const num = result?.tel?.number || '';
                        if (!num) return;
                        Linking.openURL(`tel:${num}`).catch(() => {});
                      },
                      color: '#2f9e44',
                    },
                    result.type === 'email' && {
                      key: 'email',
                      label: t('actions.composeEmail') || 'E‑posta Oluştur',
                      icon: 'mail-outline',
                      onPress: () => openExternalUrl(result.normalized),
                      color: '#2f9e44',
                    },
                    result.type === 'sms' && {
                      key: 'sms',
                      label: t('actions.composeSms') || 'SMS Oluştur',
                      icon: 'chatbubble-outline',
                      onPress: () => openExternalUrl(result.normalized),
                      color: '#2f9e44',
                    },
                    result.type === 'geo' && {
                      key: 'geo',
                      label: t('actions.openMap') || 'Haritada Aç',
                      icon: 'map-outline',
                      onPress: () => {
                        const lat = result?.geo?.lat;
                        const lon = result?.geo?.lon;
                        if (typeof lat === 'number' && typeof lon === 'number') {
                          const url = `https://maps.google.com/?q=${lat},${lon}`;
                          openExternalUrl(url);
                        }
                      },
                      color: '#2f9e44',
                    },
                    result.type === 'vcard' && {
                      key: 'vcard',
                      label: t('actions.shareVcf') || 'VCF Paylaş',
                      icon: 'person-add-outline',
                      onPress: () => {
                        const content = result?.normalized || '';
                        if (!content) return;
                        shareContentAsFile('contact.vcf', 'text/vcard', content);
                      },
                      color: '#2f9e44',
                    },
                    result.type === 'event' && {
                      key: 'event',
                      label: t('actions.shareIcs') || 'ICS Paylaş',
                      icon: 'calendar-outline',
                      onPress: () => {
                        const content = result?.normalized || '';
                        if (!content) return;
                        shareContentAsFile('event.ics', 'text/calendar', content);
                      },
                      color: '#2f9e44',
                    },
                  ]
            }
          />

          <View style={[styles.bottomActions, compact ? { marginTop: 12 } : null]}>
            <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]} onPress={resetScan}>
              <Ionicons name="scan-outline" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
              <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>
                {t('actions.rescan') || 'Yeniden Tara'}
              </Text>
            </TouchableOpacity>
            
            {navigation && (
              <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]} onPress={goToHome}>
                <Ionicons name="home-outline" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
                <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>
                  {t('actions.mainMenu') || 'Ana Menü'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          </ScrollView>
        </Animated.View>
      )}

      <ConfirmOpenLinkModal
        visible={confirmVisible}
        url={pendingUrl}
        onConfirm={async () => {
          setConfirmVisible(false);
          if (pendingUrl) { 
            try { 
              await openExternalUrl(pendingUrl); 
            } catch {} 
          }
          setPendingUrl(null);
        }}
        onCancel={() => { setConfirmVisible(false); setPendingUrl(null); }}
      />
      <Toast
        visible={toastVisible}
        message={toastMsg}
        onHide={() => setToastVisible(false)}
        dark={dark}
        style={{ position: 'absolute', bottom: Math.max(insets.bottom + 72, 72), left: 20, right: 20 }}
      />
      <FeedbackModal
        visible={feedbackVisible}
        onClose={handleFeedbackClose}
        onFeedbackGiven={markFeedbackGiven}
      />
      </View>
    </View>
  );
}

function RiskBadge({ level }) {
  const { t } = useTranslation();
  const scale = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.06, duration: 800, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [scale]);

  let color = '#2f9e44', text = t('result.secure'), icon = 'shield-checkmark';
  if (level === 'suspicious') { color = '#ffb703'; text = t('result.suspicious'); icon = 'warning'; }
  if (level === 'unsafe') { color = '#d00000'; text = t('result.unsafe'); icon = 'alert-circle'; }
  
  return (
    <Animated.View style={[styles.badge, { backgroundColor: color, alignSelf: 'center', transform: [{ scale }] }]}> 
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={styles.badgeText}>{text}</Text>
    </Animated.View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 50,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600'
  },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  topBar: { 
    position: 'absolute', 
    top: 50, 
    right: 20, 
    flexDirection: 'row', 
    gap: 12,
    zIndex: 10,
  },
  iconBtn: { 
    paddingVertical: 12, 
    paddingHorizontal: 12, 
    borderRadius: 12, 
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  guideWrap: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    top: 0, 
    bottom: 0, 
    alignItems: 'center', 
    justifyContent: 'center',
    zIndex: 5,
  },
  scannerFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
    borderWidth: 4,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  guideText: { 
    marginTop: 32, 
    fontWeight: '600', 
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  resultContainer: { 
    flex: 1, 
    padding: 2,
    justifyContent: 'center',
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 8,
    gap: 16,
  },
  resultCard: { 
    padding: 15, 
    gap: 20, 
    borderWidth: 1, 
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  resultSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linkText: { 
    fontSize: 16, 
    fontWeight: '600',
    lineHeight: 24,
  },
  countrySection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 152, 165, 0.2)',
  },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(158, 202, 255, 0.1)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  countryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  badge: { 
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    borderRadius: 999, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 15,
  },
  reasonList: { 
    gap: 10,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reasonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  usomBlock: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 0,
    gap: 4,
  },
  usomTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  usomText: {
    fontSize: 13,
    lineHeight: 18,
  },
  buttonGroup: { 
    gap: 12,
    marginTop: 15,
  },
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    paddingVertical: 16, 
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryBtn: {
    backgroundColor: '#2f9e44',
  },
  copyBtn: {
    backgroundColor: '#0969da',
  },
  secondaryBtn: {
    backgroundColor: '#6c5ce7',
  },
  googleBtn: {
    backgroundColor: '#0bd920e4',//#ff6b6b'
  },
  vtBtn: {
    backgroundColor: '#8250df',
  },
  actionBtnText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 16,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  bottomBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  center: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 20, 
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 24,
  },
  grantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
  },
  grantBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
