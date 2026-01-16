import { getUsomInfo } from '../utils/usomHelper';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Share, ScrollView, useWindowDimensions, Animated, Modal, ActivityIndicator, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import BarcodeScanning from '@react-native-ml-kit/barcode-scanning';
import { Ionicons } from '@expo/vector-icons';
import { classifyInput } from '../utils/classifier';
import { checkRisk } from '../utils/riskcheck';
import { openVirusTotalForResult, openExternalUrl } from '../utils/linkActions';
import { detectGs1Country } from '../utils/countryHelper';
import { useAppTheme } from '../theme/ThemeContext';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import ConfirmOpenLinkModal from '../components/ConfirmOpenLinkModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from '../components/Toast';
import * as FileSystem from 'expo-file-system/legacy';
import ActionButtonsGrid from '../components/ActionButtonsGrid';
import { useFeedbackSystem } from '../hooks/useFeedbackSystem';
import FeedbackModal from '../components/FeedbackModal';
import OfflineNotice from '../components/OfflineNotice';
import * as ImageManipulator from 'expo-image-manipulator';
import ImageInverter from '../components/ImageInverter';

export default function ImageScanScreen() {
  const { t, i18n } = useTranslation();
  const { feedbackVisible, closeFeedback, registerLinkOpen, markFeedbackGiven } = useFeedbackSystem();
  const { dark } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 360 || height < 640;
  const route = useRoute();
  const navigation = useNavigation();
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoPickTriggered, setAutoPickTriggered] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [consentVisible, setConsentVisible] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [gs1Country, setGs1Country] = useState(null);
  const [pickerDismissed, setPickerDismissed] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [offlineNoticeHeight, setOfflineNoticeHeight] = useState(0);
  const [inversionTask, setInversionTask] = useState(null);
  const hasHandledSharedImage = useRef(false);
  const lastHandledSharedImageUri = useRef(null);

  // Cleanup helper to delete temporary files
  const cleanupTempFiles = async () => {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      
      const deletions = files
        .filter(f => f.startsWith('ImageManipulator') || f.startsWith('image_scan_tmp'))
        .map(f => FileSystem.deleteAsync(cacheDir + f, { idempotent: true }));
      
      await Promise.all(deletions);
      if (__DEV__) console.log('[ImageScanScreen] Cleaned up temp files:', deletions.length);
    } catch (e) {
      console.log('[ImageScanScreen] Cleanup failed', e);
    }
  };

  // Run cleanup when component unmounts
  useEffect(() => {
    return () => {
      cleanupTempFiles();
    };
  }, []);

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

  const getImageSizeAsync = (uri) =>
    new Promise((resolve) => {
      if (!uri) return resolve(null);
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        () => resolve(null)
      );
    });

  const scanImageForCodes = async (uri) => {
    setPreparing(true);
    setLoading(false);
    const prepareBaseForScan = async (rawUri) => {
      const maxDim = Platform.OS === 'ios' ? 1600 : 2200;
      const size = await getImageSizeAsync(rawUri);
      const resizeAction =
        size?.width && size?.height
          ? size.width >= size.height
            ? { width: Math.min(maxDim, size.width) }
            : { height: Math.min(maxDim, size.height) }
          : { width: maxDim };

      try {
        const base = await ImageManipulator.manipulateAsync(
          rawUri,
          [{ resize: resizeAction }],
          {
            compress: Platform.OS === 'ios' ? 0.9 : 1,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );
        if (base?.uri) {
          return { uri: base.uri, width: base.width, height: base.height };
        }
      } catch (e) {
        console.log('[ImageScanScreen Native] Base prepare failed', e?.message || e);
      }

      if (Platform.OS === 'ios') return null;
      return { uri: rawUri, width: size?.width || null, height: size?.height || null };
    };

    const prepareDeepVariantsForScan = async (base) => {
      const variants = [];
      if (!base?.uri) return variants;

      if (base?.width && base?.height) {
        const minDim = Math.min(base.width, base.height);
        const cropScales = [0.92, 0.86];
        for (const scale of cropScales) {
          const cropSize = Math.floor(minDim * scale);
          const originX = Math.max(0, Math.floor((base.width - cropSize) / 2));
          const originY = Math.max(0, Math.floor((base.height - cropSize) / 2));
          try {
            const crop = await ImageManipulator.manipulateAsync(
              base.uri,
              [{ crop: { originX, originY, width: cropSize, height: cropSize } }],
              { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
            );
            if (crop?.uri) variants.push(crop.uri);
          } catch (e) {
            console.log('[ImageScanScreen Native] Crop failed', scale, e?.message || e);
          }
        }
      }

      try {
        const resizedForInvert = await ImageManipulator.manipulateAsync(
          base.uri,
          [{ resize: { width: 900 } }],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );

        if (resizedForInvert?.uri) {
          const invertedUri = await new Promise((resolve) => {
            setInversionTask({
              uri: resizedForInvert.uri,
              width: resizedForInvert.width || 900,
              height: resizedForInvert.height || 900,
              resolve,
            });
          });
          if (invertedUri) variants.push(invertedUri);
        }
      } catch (e) {
        console.log('[ImageScanScreen Native] Inversion failed', e);
      }

      return variants;
    };

    try {
      if (Platform.OS === 'web') {
        setResult(null);
        setError(t('scan.notSupportedWeb') || 'Web sürümünde tarama desteklenmiyor.');
      } else {
        let localUri = uri;
        try {
          const info = await FileSystem.getInfoAsync(uri);
          // Strict check: if file doesn't exist, stop immediately to avoid native crash
          if (!info?.exists) {
            console.log('[ImageScanScreen] File does not exist:', uri);
            setResult(null);
            setError(t('errors.imagePickFailed') || 'Görüntü dosyası bulunamadı.');
            setPreparing(false);
            return;
          }

          if (!String(uri).startsWith('file://')) {
            const ext = '.jpg';
            const tmp = FileSystem.cacheDirectory + 'image_scan_tmp' + ext;
            await FileSystem.copyAsync({ from: uri, to: tmp });
            localUri = tmp;
          }

        } catch (e) {
           console.log('[ImageScanScreen] File preparation failed', e);
           setResult(null);
           setError(t('errors.imagePickFailed'));
           setPreparing(false);
           return;
        }

        const base = await prepareBaseForScan(localUri);
        if (!base?.uri) {
          cleanupTempFiles();
          setPreparing(false);
          setResult(null);
          setError(t('errors.imagePickFailed') || (t('scan.noCodeFound') || 'Bu görselde kod bulunamadı'));
          return;
        }

        let variants = [];
        let quickFound = false;
        try {
          const quickAttempt = await BarcodeScanning.scan(base.uri);
          if (quickAttempt && quickAttempt.length > 0) {
            variants = [base.uri];
            quickFound = true;
          }
        } catch (e) {
           console.log('[ImageScanScreen Native] Quick scan failed, proceeding to deep scan', e);
        }

        if (!quickFound) {
          const deep = await prepareDeepVariantsForScan(base);
          variants = [base.uri, ...deep];
          if (Platform.OS !== 'ios' && localUri !== base.uri) {
            variants.push(localUri);
          }
        }

        let first = null;
        for (const candidate of variants) {
          try {
            const info = await FileSystem.getInfoAsync(candidate);
            if (!info?.exists) continue;
            const attempt = await BarcodeScanning.scan(candidate);
            if (attempt && attempt.length > 0) {
              first = attempt[0];
              break;
            }
          } catch (scanErr) {
            console.log('[ImageScanScreen Native] Variant scan failed', scanErr?.message || scanErr);
          }
        }

        // Cleanup temp files after scan is complete (whether successful or not)
        cleanupTempFiles();

        if (first) {
          const data = first?.value || first?.rawValue || first?.displayValue;
          if (data) {
            setPreparing(false);
            // Get format exactly like CodeScanScreen: simple and direct
            const rawType = first?.type || '';
            const rawFormat = first?.format || '';
            let scannedType = (rawType || rawFormat || '').toString().toLowerCase().trim();
            
            // Debug: Log original format info
            console.log('[ImageScanScreen Native] Raw type:', rawType, 'Raw format:', rawFormat, 'Data:', data.substring(0, 20) + '...');
            
            // Check if scannedType is a numeric format ID (like 32) - if so, ignore it and detect from data length
            const isNumericFormatId = /^\d+$/.test(scannedType);
            
            if (isNumericFormatId) {
              // Format ID detected, ignore it and detect from data length
              scannedType = '';
            } else {
              // Normalize format: handle all variations (EAN_13, EAN13, ean_13, ean13, EAN, etc.)
              if (scannedType.includes('ean') && (scannedType.includes('13') || scannedType === 'ean')) {
                scannedType = 'ean13';
              } else if (scannedType.includes('ean') && scannedType.includes('8')) {
                scannedType = 'ean8';
              } else if (scannedType.includes('upc') && (scannedType.includes('a') || scannedType === 'upc')) {
                scannedType = 'upc_a';
              } else if (scannedType.includes('upc') && scannedType.includes('e')) {
                scannedType = 'upc_e';
              }
            }
            
            // If format is still unknown or empty (or was a numeric ID), detect from data length
            if (!scannedType || scannedType === '' || scannedType.trim() === '') {
              const digitsOnly = String(data).replace(/[^0-9]/g, '');
              if (digitsOnly.length === 13) {
                scannedType = 'ean13';
              } else if (digitsOnly.length === 8) {
                scannedType = 'ean8';
              } else if (digitsOnly.length === 12) {
                scannedType = 'upc_a';
              }
            }
            
            // Debug: Log normalized scannedType
            console.log('[ImageScanScreen Native] Normalized scannedType:', scannedType);
            
            const res = classifyInput(data, scannedType);
            
            // Debug: Log classification result
            console.log('[ImageScanScreen Native] Classification result type:', res.type, 'isUrl:', res.isUrl);
            let updated = res;
            try {
              if (res.isUrl) {
                setLoading(true);
                const remote = await checkRisk(res.normalized);
                if (remote?.error) { setOffline(true); } else { setOffline(false); }
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
                setLoading(false);
              }
            } catch {
              setOffline(true);
              setLoading(false);
            }
            setResult(updated);
            const eligibleNative = ['ean13', 'ean8', 'upc_a'];
            let country = null;
            if (eligibleNative.includes(scannedType)) {
              try {
                country = detectGs1Country(data, t);
              } catch (e) {
                console.log('Country detection error:', e);
              }
            }
            setGs1Country(country);
            setError(null);
            saveHistory({ 
              content: updated.normalized, 
              level: updated.level,
              type: scannedType,
              contentType: updated.type,
              wifi: updated.type === 'wifi' ? (updated.wifi || null) : null,
              country: country
            });
          } else {
            setResult(null);
            setError(t('scan.noCodeFound') || 'Bu görselde kod bulunamadı');
          }
        } else {
          setPreparing(false);
          setResult(null);
          setError(t('scan.noCodeFound') || 'Bu görselde kod bulunamadı');
        }
      }
    } catch (e) {
      setResult(null);
      setError(t('errors.imagePickFailed') || (t('scan.noCodeFound') || 'Bu görselde kod bulunamadı'));
    } finally {
      setPreparing(false);
    }
  };

  const retryRemoteCheck = async () => {
    if (!result?.normalized || !result.isUrl) return;
    try {
      setLoading(true);
      const base = classifyInput(result.normalized.trim());
      let updated = base;
      if (base.isUrl) {
        try {
          const remote = await checkRisk(base.normalized);
          if (remote?.error) {
            setOffline(true);
          } else {
            setOffline(false);
          }
          if (remote?.isRisky) {
            const domainInfo = t('remoteRisk.checkedDomainLabel') + ' ' + (remote?.checkedDomain || base.normalized);
            const sources = t('remoteRisk.sourcesLabel') + ' ' + ((remote?.foundInFiles || []).join(', ') || '-');
            const files = remote?.foundInFiles || [];
            const reasons = [ ...(base.reasons || []), 'remoteRisk.defaultMessage', domainInfo, sources ];
            if (files.includes('usom')) {
              reasons.push({ type: 'usom', data: remote?.usomDetails || {} });
            } else if (files.includes('aa') || files.includes('ab') || files.includes('ac')) {
              reasons.push({ type: 'github', repo: 'romainmarcoux/malicious-domains', url: 'https://github.com/romainmarcoux/malicious-domains/tree/main' });
            }
            updated = { ...base, level: 'unsafe', reasons };
          }
        } catch {
          setOffline(true);
        }
      }
      setResult(updated);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const startImageSelection = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (res.canceled) {
      setPickerDismissed(true);
      return;
    }
    setPickerDismissed(false);
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    setImage(uri);
    await scanImageForCodes(uri);
  };

  const pickImage = async () => {
    try {
      // Android 13+ (API 33) uses Photo Picker which doesn't need explicit permission
      const androidVer = Platform.OS === 'android' ? Platform.Version : null;
      const isAndroid13OrHigher = Platform.OS === 'android' && typeof androidVer === 'number' && androidVer >= 33;
      
      // iOS 14+ uses PHPicker which doesn't need explicit permission for picking
      const isIOS = Platform.OS === 'ios';

      if (isAndroid13OrHigher || isIOS) {
        await startImageSelection();
        return;
      }

      const current = await ImagePicker.getMediaLibraryPermissionsAsync();
      let granted = current?.granted;
      if (!granted) {
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
        granted = req?.granted;
        if (!granted) {
          setError(t('permission_required_media') || 'Medya izni gerekli');
          if (req && req.canAskAgain === false) { try { await Linking.openSettings(); } catch {} }
          return;
        }
      }
      await startImageSelection();
    } catch (e) {
      setError(t('errors.imagePickFailed') || 'Görüntü seçerken bir sorun oluştu.');
    }
  };

  useEffect(() => {
    (async () => { try { const v = await AsyncStorage.getItem('media_consent'); setHasConsent(v === 'true'); } catch {} })();
    if (!autoPickTriggered && route?.params?.autoPick) {
      setAutoPickTriggered(true);
      setTimeout(() => {
        pickImage();
      }, 0);
    }
  }, [route, autoPickTriggered]);

  const extractSharedImageUri = (url) => {
    if (!url) return null;
    if (url.includes('imagescan/')) {
      const parts = url.split('imagescan/');
      if (parts.length > 1) {
        return decodeURIComponent(parts[1]);
      }
    }
    if (url.startsWith('secureqrlinkscanner://')) {
      const rest = url.replace('secureqrlinkscanner://', '');
      if (rest.startsWith('file://') || rest.startsWith('content://')) {
        return rest;
      }
    }
    return null;
  };

  const handleSharedImageUri = (sharedUri) => {
    if (!sharedUri) return false;
    if (sharedUri === lastHandledSharedImageUri.current) return false;
    hasHandledSharedImage.current = true;
    lastHandledSharedImageUri.current = sharedUri;
    setPickerDismissed(false);
    setImage(sharedUri);
    setResult(null);
    setError(null);
    setTimeout(() => {
      scanImageForCodes(sharedUri);
    }, 200);
    return true;
  };

  // Sadece route params üzerinden gelen görselleri işle
  useEffect(() => {
    if (route.params?.imageUri) {
      const fromParams = route.params.imageUri;
      if (fromParams && fromParams !== lastHandledSharedImageUri.current) {
        handleSharedImageUri(fromParams);
      }
    }
  }, [route.params]);

 

  const resetScan = async () => {
    setImage(null);
    setResult(null);
    setError(null);
    await pickImage();
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

  const goToHome = () => {
    if (navigation) {
      navigation.navigate('Home');
    }
  };

  const renderLoadingStates = () => {
    const state = loading ? 'security' : (preparing ? 'prepare' : null);
    if (!state) return null;
    const isSecurity = state === 'security';
    return (
      <View style={[styles.loadingOverlay, { backgroundColor: dark ? 'rgba(10,14,20,0.8)' : 'rgba(255,255,255,0.9)' }]}>
        <View style={[styles.loadingCard, { backgroundColor: dark ? '#0f172a' : '#ffffff', borderColor: dark ? '#1d2a3f' : '#e2e8f0' }]}>
          <View style={[styles.loadingIconWrap, { backgroundColor: isSecurity ? (dark ? 'rgba(14,116,144,0.15)' : 'rgba(14,165,233,0.12)') : (dark ? 'rgba(79,70,229,0.15)' : 'rgba(99,102,241,0.12)') }]}>
            <ActivityIndicator size="small" color={isSecurity ? (dark ? '#67e8f9' : '#0284c7') : (dark ? '#c4d4ff' : '#4f46e5')} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.loadingTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
              {isSecurity ? (t('loading.securityChecks') || 'Güvenlik kontrolü yapılıyor...') : (t('loading.preparingImage') || 'Görsel hazırlanıyor...')}
            </Text>
            <Text style={[styles.loadingSubtitle, { color: dark ? '#94a3b8' : '#475569' }]}>
              {isSecurity ? (t('loading.securityChecksDesc') || 'Bağlantı güvenliği ve risk analizi yapılıyor') : (t('loading.preparingImageDesc') || 'Görüntü optimize ediliyor ve taramaya hazırlanıyor')}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const isBarcode = result && result.type !== 'wifi' && !result.isUrl && (
    (result.type && ['ean13', 'ean8', 'upc_a', 'code39', 'code128', 'codabar', 'itf'].includes(result.type.toLowerCase())) ||
    (result.normalized && /^\d+$/.test(result.normalized) && [8, 12, 13].includes(result.normalized.length))
  );

  let riskIconName = 'shield-checkmark';
  let riskColor = '#2f9e44';
  let riskBgColor = dark ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.08)';
  if (result?.level === 'suspicious') {
    riskIconName = 'warning';
    riskColor = '#ffb703';
    riskBgColor = dark ? 'rgba(234,179,8,0.22)' : 'rgba(234,179,8,0.08)';
  } else if (result?.level === 'unsafe') {
    riskIconName = 'shield';
    riskColor = '#d00000';
    riskBgColor = dark ? 'rgba(220,38,38,0.24)' : 'rgba(239,68,68,0.08)';
  }

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#0b0f14' : '#e9edf3' }}>
    <OfflineNotice
      visible={offline}
      dark={dark}
      message={t('alerts.remoteRiskUnavailable')}
      onHeightChange={setOfflineNoticeHeight}
      onRetry={result?.isUrl ? retryRemoteCheck : undefined}
    />
    <ScrollView 
      style={[styles.container, { padding: compact ? 12 : 20 }]}
      contentContainerStyle={{ gap: 12, paddingBottom: compact ? 48 : 72, paddingTop: offline ? offlineNoticeHeight + 8 : 0 }}
      showsVerticalScrollIndicator={false}
    > 
      {!offline && <View style={{ height: 0 }} />}

      {/* Empty state - show when no image selected */}
      {!image && !result && !error && !loading && pickerDismissed && (
        <View style={styles.emptyStateContainer}>
          <View style={[styles.emptyStateCard, { backgroundColor: dark ? '#161b22' : '#ffffff', borderColor: dark ? '#30363d' : '#e1e4e8' }]}>
            <View style={[styles.emptyStateIconWrap, { backgroundColor: dark ? '#1f2937' : '#f3f4f6' }]}>
              <Ionicons name="images-outline" size={48} color={dark ? '#9ecaff' : '#6366f1'} />
            </View>
            <Text style={[styles.emptyStateTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
              {t('scan.noImageSelected') || 'Görsel Seçilmedi'}
            </Text>
            <Text style={[styles.emptyStateDesc, { color: dark ? '#8b949e' : '#6b7280' }]}>
              {t('scan.selectImageDesc') || 'QR kod veya barkod içeren bir görsel seçin'}
            </Text>
            <TouchableOpacity
              style={[styles.emptyStateButton, { backgroundColor: dark ? '#238636' : '#2da44e' }]}
              onPress={pickImage}
              activeOpacity={0.85}
            >
              <Ionicons name="image-outline" size={22} color="#fff" />
              <Text style={styles.emptyStateButtonText}>{t('scan.selectImage') || 'Görsel Seç'}</Text>
            </TouchableOpacity>
            {navigation && (
              <TouchableOpacity
                style={[styles.emptyStateSecondaryBtn, { backgroundColor: dark ? '#21262d' : '#f3f4f6', borderColor: dark ? '#30363d' : '#d1d5db' }]}
                onPress={goToHome}
                activeOpacity={0.85}
              >
                <Ionicons name="home-outline" size={20} color={dark ? '#e6edf3' : '#374151'} />
                <Text style={[styles.emptyStateSecondaryText, { color: dark ? '#e6edf3' : '#374151' }]}>{t('actions.mainMenu') || 'Ana Menü'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      
      {image && (
        <>
          <Image source={{ uri: image }} style={styles.preview} />
          
        </>
      )}
      {error && (
        <Text style={{ color: dark ? '#ffb3b3' : '#b00020' }}>{error}</Text>
      )}
      {error && !result && (
        <View style={[styles.bottomActions, compact ? { marginTop: 12 } : null]}>
          <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]} onPress={resetScan}>
            <Ionicons name="scan-outline" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
            <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('actions.rescan') || 'Yeniden Tara'}</Text>
          </TouchableOpacity>
          {navigation && (
            <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]} onPress={goToHome}>
              <Ionicons name="home-outline" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
              <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('actions.mainMenu') || 'Ana Menü'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {result && (
        <>
          <View style={[styles.card, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea', alignItems: 'center' }]}> 
            
            {!(isBarcode || gs1Country) || result.type === 'wifi' ? (
              <View style={[styles.badgeRow, { borderColor: riskColor, backgroundColor: riskBgColor }]}>
                <Ionicons 
                  name={riskIconName} 
                  size={compact ? 38 : 44} 
                  color={riskColor} 
                />
                <RiskBadge level={result.level} />
              </View>
            ) : null}
            {result.isUrl && offline && (
              <Text style={{ marginTop: 8, marginBottom: 4, fontSize: 13, color: dark ? '#9ca3af' : '#4b5563', textAlign: 'center' }}>
                {t('result.localAnalysisOnly')}
              </Text>
            )}
<View style={{
              backgroundColor: dark ? 'rgba(56, 139, 253, 0.1)' : '#f0f9ff',
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderRadius: 20,
              marginBottom: 4,
              borderWidth: 1,
              borderColor: dark ? 'rgba(56, 139, 253, 0.3)' : '#bae6ff',
            }}>
              <Text style={[styles.sectionLabel, { color: dark ? '#58a6ff' : '#0969da', marginBottom: 0, fontSize: 14, fontWeight: '700' }]}>
                {result.isUrl ? (t('label.url') || 'URL') : (
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
            </View>
            <View style={{
              borderWidth: 1,
              borderColor: dark ? '#30363d' : '#d0d7de',
              borderRadius: 8,
              padding: 12,
              backgroundColor: dark ? '#161b22' : '#f6f8fa',
              width: '100%',
              marginTop: 8,
              marginBottom: 8
            }}>
              <Text style={[styles.linkText, { color: dark ? '#9ecaff' : '#0b1220', textAlign: 'center' }]} selectable>{result.normalized}</Text>
            </View>
            {/* Show Barcode UI if isBarcode is true OR if gs1Country is present */ }
            {(isBarcode || gs1Country) && result.type !== 'wifi' && (
              <View style={{alignItems: 'center', gap: 4, marginTop: 8}}>
                <View style={[styles.badge, { backgroundColor: dark ? '#1f6feb' : '#0969da' }]}> 
                  <Ionicons name="scan-outline" size={16} color="#fff" />
                  <Text style={styles.badgeText}>{t('scan.barcodeDetected') || 'Barkod Tespit Edildi'}</Text>
                </View>
                <Text style={{ fontSize: 12, color: dark ? '#8b98a5' : '#5c6a7a', textAlign: 'center', maxWidth: 250 }}>
                  {t('scan.barcodeSafeDesc') || 'Barkodlar herhangi bir bağlantı içermediği için güvenlidir.'}
                </Text>
              </View>
            )}
            {(isBarcode || gs1Country) && result.type !== 'wifi' && (
              <View style={[styles.resultSection, styles.countrySection, { alignItems: 'center', width: '100%' }]}>
                {gs1Country ? (
                  gs1Country.key === 'country.israel' ? (
                  <View style={[styles.countryBadge, { 
                    backgroundColor: dark ? 'rgba(207,34,46,0.15)' : '#fff5f5', 
                    borderColor: dark ? 'rgba(207,34,46,0.4)' : '#cf222e',
                    borderWidth: 1,
                    flexDirection: 'column',
                    alignItems: 'center',
                    paddingVertical: 12,
                    alignSelf: 'center'
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
            {result.reasons?.length && result.isUrl ? (
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
                      <TouchableOpacity onPress={() => openExternalUrl('https://www.usom.gov.tr/adres')} style={{marginTop: 8}}>
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
                       <TouchableOpacity onPress={() => openExternalUrl(r.url)} style={{marginTop: 4}}>
                          <Text style={{color: dark ? '#58a6ff' : '#0969da', textDecorationLine: 'underline'}}>{t('remoteRisk.viewSource')}</Text>
                       </TouchableOpacity>
                     </View>
                   );
                 }
                return <Text key={idx} style={{ color: dark ? '#8b98a5' : '#3b4654' }}>• {t(r)}</Text>;
              })}
            </View>
          ) : null}

            {result.type === 'wifi' && (
              <View style={[styles.resultSection, { width: '100%' }]}> 
                <Text style={[styles.sectionLabel, { color: dark ? '#8b98a5' : '#5c6a7a' }]}>{t('label.wifiDetails') || 'Wi‑Fi Detayları'}</Text>
                <View style={{ gap: 6 }}>
                  <Text style={[styles.detailText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('wifi.ssid') || 'SSID'}: {result?.wifi?.ssid || '-'}</Text>
                  <Text style={[styles.detailText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('wifi.security') || 'Güvenlik'}: {result?.wifi?.security || '-'}</Text>
                  {result?.wifi?.security !== 'nopass' && (
                    <Text style={[styles.detailText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('wifi.password') || 'Şifre'}: {result?.wifi?.password || '-'}</Text>
                  )}
                  <Text style={[styles.detailText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>{t('wifi.hidden') || 'Gizli'}: {result?.wifi?.hidden ? (t('confirm.yes') || 'Evet') : (t('confirm.no') || 'Hayır')}</Text>
                </View>
              </View>
            )}

            <ActionButtonsGrid
              compact={compact}
              style={{ marginTop: 12 }}
              buttons={[
                (isBarcode || gs1Country) && result.type !== 'wifi' && {
                  key: 'google',
                  label: t('actions.searchGoogle') || 'Google\'da Ara',
                  icon: 'logo-google',
                  onPress: () => { const url = 'https://www.google.com/search?q=' + encodeURIComponent(result.normalized); openExternalUrl(url); },
                  color: '#4285f4',
                  fullWidth: true
                },
                result.isUrl && {
                  key: 'open',
                  label: t('actions.openLink') || 'Linki Aç',
                  icon: 'open-outline',
                  onPress: async () => { 
                    const raw = result.normalized.startsWith('http') ? result.normalized : 'https://' + result.normalized; 
                    setPendingUrl(raw);
                    const triggered = await registerLinkOpen(); 
                    if (!triggered) { 
                      setConfirmVisible(true); 
                    } 
                  },
                  color: '#2da44e',
                },
                result.type !== 'wifi' && {
                  key: 'copy',
                  label: t('actions.copy') || 'Kopyala',
                  icon: 'copy-outline',
                  onPress: async () => { try { await Clipboard.setStringAsync(result.normalized); setToastMsg(t('toast.copied')); setToastVisible(true); } catch {} },
                  color: '#4089eeff',
                },
                result?.type === 'wifi' && result?.wifi?.password && result?.wifi?.security !== 'nopass' && {
                  key: 'copy_wifi',
                  label: t('actions.copyWifiPassword') || 'Wi‑Fi Şifresini Kopyala',
                  icon: 'key-outline',
                  onPress: async () => { try { await Clipboard.setStringAsync(result.wifi.password); setToastMsg(t('toast.copied')); setToastVisible(true); } catch {} },
                  color: '#0f766e',
                },
                result?.type === 'wifi' && result?.wifi?.password && result?.wifi?.security !== 'nopass' && {
                  key: 'share_wifi',
                  label: t('actions.share') || 'Paylaş',
                  icon: 'share-outline',
                  onPress: async () => { try { await Share.share({ message: result.wifi.password }); } catch {} },
                  color: '#6c5ce7',
                },
                result.type !== 'wifi' && {
                  key: 'share',
                  label: t('actions.share') || 'Paylaş',
                  icon: 'share-outline',
                  onPress: async () => { try { await Share.share({ message: result.normalized }); } catch {} },
                  color: '#e75cceff',
                },
                result.isUrl && {
                  key: 'vt',
                  label: t('actions.analyzeVirusTotal') || 'VirusTotal',
                  icon: 'search-outline',
                  onPress: () => openVirusTotalForResult(result),
                  color: '#8250df',
                },
                result.type === 'tel' && {
                  key: 'tel',
                  label: t('actions.call') || 'Ara',
                  icon: 'call-outline',
                  onPress: () => { const num = result?.tel?.number || ''; if (!num) return; Linking.openURL(`tel:${num}`).catch(() => {}); },
                  color: '#2da44e',
                },
                result.type === 'email' && {
                  key: 'email',
                  label: t('actions.composeEmail') || 'E‑posta Oluştur',
                  icon: 'mail-outline',
                  onPress: () => { openExternalUrl(result.normalized); },
                  color: '#2da44e',
                },
                result.type === 'sms' && {
                  key: 'sms',
                  label: t('actions.composeSms') || 'SMS Oluştur',
                  icon: 'chatbubble-outline',
                  onPress: () => { openExternalUrl(result.normalized); },
                  color: '#2da44e',
                },
                result.type === 'geo' && {
                  key: 'geo',
                  label: t('actions.openMap') || 'Haritada Aç',
                  icon: 'map-outline',
                  onPress: () => { const lat = result?.geo?.lat; const lon = result?.geo?.lon; if (typeof lat === 'number' && typeof lon === 'number') { const url = `https://maps.google.com/?q=${lat},${lon}`; openExternalUrl(url); } },
                  color: '#2da44e',
                },
                result.type === 'vcard' && {
                  key: 'vcard',
                  label: t('actions.shareVcf') || 'VCF Paylaş',
                  icon: 'person-add-outline',
                  onPress: () => { const content = result?.normalized || ''; if (!content) return; shareContentAsFile('contact.vcf', 'text/vcard', content); },
                  color: '#2da44e',
                },
                result.type === 'event' && {
                  key: 'event',
                  label: t('actions.shareIcs') || 'ICS Paylaş',
                  icon: 'calendar-outline',
                  onPress: () => { const content = result?.normalized || ''; if (!content) return; shareContentAsFile('event.ics', 'text/calendar', content); },
                  color: '#2da44e',
                },
              ]}
            />
          </View>
          <View style={[styles.bottomActions, compact ? { marginTop: 12 } : null]}>
            <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]} onPress={resetScan}>
              <Ionicons name="scan-outline" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
            <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('actions.rescan') || 'Yeniden Tara'}</Text>
            </TouchableOpacity>
            {navigation && (
              <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]} onPress={goToHome}>
                <Ionicons name="home-outline" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
              <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('actions.mainMenu') || 'Ana Menü'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
      
      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => { 
          closeFeedback(); 
          if (pendingUrl) { 
            setTimeout(() => { setConfirmVisible(true); }, 300); 
          } 
        }}
        onFeedbackGiven={markFeedbackGiven}
      />
      
      <ConfirmOpenLinkModal
        visible={confirmVisible}
        url={pendingUrl}
        onConfirm={async () => { setConfirmVisible(false); if (pendingUrl) { try { await openExternalUrl(pendingUrl); } catch {} } setPendingUrl(null); }}
        onCancel={() => { setConfirmVisible(false); setPendingUrl(null); }}
      />
    </ScrollView>

    <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} dark={dark} style={{ position: 'absolute', bottom: 80, left: 20, right: 20 }} />
    {renderLoadingStates()}
    {inversionTask && (
      <ImageInverter 
          uri={inversionTask.uri}
          width={inversionTask.width}
          height={inversionTask.height}
          onProcessed={(result) => {
              if (inversionTask.resolve) inversionTask.resolve(result);
              setInversionTask(null);
          }}
      />
    )}
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
  container: { flex: 1 },
  button: { backgroundColor: '#0066cc', borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  preview: { width: '70%', maxWidth: 420, aspectRatio: 1, borderRadius: 12, alignSelf: 'center' },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  linkText: { fontSize: 14, fontWeight: '600' },
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  badgeRow: { 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 4,
    gap: 10,
    alignSelf: 'stretch'
  },
  badge: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  badgeGradient: { },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resultSection: {
    gap: 8,
  },
  countrySection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 152, 165, 0.2)',
  },
  countryBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(158,202,255,0.1)', borderRadius: 8, alignSelf: 'flex-start' },
  countryText: { fontSize: 14, fontWeight: '600' },
  reasonList: { gap: 4 },
  usomBlock: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 4,
    gap: 4
  },
  usomTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5
  },
  usomText: {
    fontSize: 13,
    lineHeight: 18
  },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }
  ,tile: { width: '48%', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }
  ,tileLabel: { color: '#fff', fontWeight: '700', textAlign: 'center', flexShrink: 1, lineHeight: 18 }
  ,consentOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 }
  ,consentCard: { width: '100%', borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 }
  ,consentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }
  ,consentTitle: { fontSize: 18, fontWeight: '700' }
  ,consentText: { fontSize: 13 }
  ,consentBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' }
  ,consentBtnText: { fontWeight: '700' }
  ,bottomActions: { flexDirection: 'row', gap: 12, marginTop: 12 }
  ,bottomBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 }
  ,bottomBtnText: { fontSize: 14, fontWeight: '700' }
  ,inlineLoading: { marginTop: 8, alignItems: 'center', gap: 6 }
  ,loadingText: { fontSize: 13, fontWeight: '600' }
  ,loadingStack: { gap: 8, marginTop: 8 }
  ,loadingChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 }
  ,loadingChipText: { fontSize: 13, fontWeight: '700' }
  ,loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }
  ,loadingCard: { width: '100%', maxWidth: 360, borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 }
  ,loadingIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }
  ,loadingTitle: { fontSize: 15, fontWeight: '800' }
  ,loadingSubtitle: { fontSize: 12, lineHeight: 16, fontWeight: '600' }
  ,emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400 }
  ,emptyStateCard: { alignItems: 'center', padding: 32, borderRadius: 20, borderWidth: 1, width: '100%', maxWidth: 340, gap: 16 }
  ,emptyStateIconWrap: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }
  ,emptyStateTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' }
  ,emptyStateDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 }
  ,emptyStateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, marginTop: 8, width: '100%' }
  ,emptyStateButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' }
  ,emptyStateSecondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, width: '100%' }
  ,emptyStateSecondaryText: { fontSize: 14, fontWeight: '600' }
});
