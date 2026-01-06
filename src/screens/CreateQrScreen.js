import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, ScrollView, ActivityIndicator, Alert, useWindowDimensions, Keyboard, Image, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import ViewShot, { captureRef } from 'react-native-view-shot';
import Toast from '../components/Toast';
import AdBanner from '../components/AdBanner';
import { useNavigation } from '@react-navigation/native';
import { rewardedUnitId, interstitialUnitId, rewardedInterstitialUnitId } from '../config/adUnitIds';
import { QRCodeWriter, BarcodeFormat, EncodeHintType } from '@zxing/library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FRAME_SWATCHES = ['#0f172a', '#2563eb', '#1d4ed8', '#0f766e', '#22c55e', '#f97316', '#dc2626', '#9333ea', '#111827', '#ffffff'];

const CUSTOM_MODES = [
  { key: 'none', icon: 'qr-code-outline', labelKey: 'custom_qr_mode.none', defaultLabel: 'Klasik' },
  { key: 'logo', icon: 'image-outline', labelKey: 'custom_qr_mode.logo', defaultLabel: 'Logo Ortası' },
  { key: 'logo_frame', icon: 'albums-outline', labelKey: 'custom_qr_mode.logo_frame', defaultLabel: 'Logo + Çerçeve' },
  { key: 'frame_text', icon: 'chatbox-ellipses-outline', labelKey: 'custom_qr_mode.frame_text', defaultLabel: 'Çerçeve + Yazı' },
];
const FRAME_TEXT_MAX = 42;//18



export default function CreateQrScreen() {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 360 || height < 640;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [input, setInput] = useState('');
  const [matrix, setMatrix] = useState(null);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const isWeb = Platform.OS === 'web';
  const qrRef = useRef(null);
  const [inputHeight, setInputHeight] = useState(44);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [premium, setPremium] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);

  const [qrType, setQrType] = useState('url');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiSec, setWifiSec] = useState('WPA');
  const [wifiHidden, setWifiHidden] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddr, setEmailAddr] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsNumber, setSmsNumber] = useState('');
  const [smsBody, setSmsBody] = useState('');

  const [customMode, setCustomMode] = useState('none');
  const [customLogo, setCustomLogo] = useState(null);
  const [customFrameText, setCustomFrameText] = useState('');
  const [pendingCustomMode, setPendingCustomMode] = useState(null);
  const [customGateVisible, setCustomGateVisible] = useState(false);
  const [customGateLoading, setCustomGateLoading] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [unlockedModes, setUnlockedModes] = useState({});
  const lastGeneratedRef = useRef('');
  const [pendingQrType, setPendingQrType] = useState(null);
  const [missingInfoType, setMissingInfoType] = useState(null);
  const [rewardUnlocked, setRewardUnlocked] = useState(false);
  const [unlockModalVisible, setUnlockModalVisible] = useState(false);
  const missingInfoMessage = useMemo(() => {
    if (!missingInfoType) return '';
    if (missingInfoType === 'wifi') return t('missing_info.wifi') || 'Please enter SSID and password if needed.';
    if (missingInfoType === 'tel') return t('missing_info.tel') || 'Please enter a phone number.';
    if (missingInfoType === 'email') return t('missing_info.email') || 'Please enter an email address.';
    if (missingInfoType === 'sms') return t('missing_info.sms') || 'Please enter a number or message.';
    return t('missing_info.url_text') || 'Please enter some text or URL.';
  }, [missingInfoType, t]);
  const gateTitle = useMemo(() => {
    if (pendingQrType) return t('qr_type_unlock_title') || 'Bu QR tipini açın';
    return t('custom_qr_unlock_title') || 'Özel stilleri açın';
  }, [pendingQrType, t]);
  const gateDesc = useMemo(() => {
    if (pendingQrType) return t('qr_type_unlock_desc') || 'Bu QR tipini kullanmak için Premium olun ya da ödüllü reklam izleyin.';
    return t('custom_qr_unlock_desc') || 'Logo ve çerçeve eklemek için Premium olun ya da ödüllü reklam izleyin.';
  }, [pendingQrType, t]);

  const qrRows = useMemo(() => {
    if (!matrix) return null;
    return matrix.rows.map((row, y) => (
      <View key={y} style={{ flexDirection: 'row' }}>
        {row.map((on, x) => (
          <View
            key={x}
            style={{
              width: cellSize,
              height: cellSize,
              backgroundColor: on ? '#000' : '#fff'
            }}
          />
        ))}
      </View>
    ));
  }, [matrix, cellSize]);

  const isModeUnlocked = useCallback((modeKey) => {
    if (modeKey === 'none') return true;
    if (premium) return true;
    return !!unlockedModes[modeKey];
  }, [premium, unlockedModes]);

  const ensureCustomAccess = useCallback((modeKey) => {
    if (modeKey === 'none') return true;
    if (isModeUnlocked(modeKey)) return true;
    setPendingCustomMode(modeKey);
    setCustomGateVisible(true);
    return false;
  }, [isModeUnlocked]);

  const handleCustomModePress = useCallback((modeKey) => {
    if (modeKey === 'none') {
      setCustomMode('none');
      return;
    }
    if (premium || isModeUnlocked(modeKey)) {
      setCustomMode(modeKey);
      return;
    }
    setPendingCustomMode(modeKey);
    setCustomGateVisible(true);
  }, [premium, isModeUnlocked]);

  const ensureTypeAccess = useCallback((typeKey) => {
    const needsUnlock = typeKey === 'wifi' || typeKey === 'tel' || typeKey === 'email' || typeKey === 'sms';
    if (!needsUnlock) return true;
    if (premium || unlockedModes[typeKey]) return true;
    setPendingQrType(typeKey);
    setCustomGateVisible(true);
    return false;
  }, [premium, unlockedModes]);

  const handleQrTypePress = useCallback((typeKey) => {
    if (!ensureTypeAccess(typeKey)) return;
    setQrType(typeKey);
    setPendingQrType(null);
  }, [ensureTypeAccess]);

  const runCustomRewardFlow = useCallback(async () => {
    if (Platform.OS === 'web') return true;
    let adsMod = null;
    try {
      adsMod = await import('react-native-google-mobile-ads');
    } catch {
      console.log('[ads][reward] import failed');
      return false;
    }
    const { RewardedInterstitialAd, RewardedAd, InterstitialAd, AdEventType, RewardedAdEventType } = adsMod;
    console.log('[ads][reward] start', {
      platform: Platform.OS,
      rewardedInterstitialUnitId,
      rewardedUnitId,
      interstitialUnitId,
    });

    const tryRewardedInterstitial = async () => {
      if (!rewardedInterstitialUnitId) throw new Error('missing_unit');
      const ad = RewardedInterstitialAd.createForAdRequest(rewardedInterstitialUnitId, { requestNonPersonalizedAdsOnly: true });
      await new Promise((resolve, reject) => {
        let earned = false;
        const subscriptions = [];
        const startedAt = Date.now();
        const cleanup = (error, cb) => {
          subscriptions.forEach((unsubscribe) => { try { unsubscribe(); } catch {} });
          if (error) cb(error); else cb(true);
        };
        subscriptions.push(
          ad.addAdEventListener(AdEventType.LOADED, () => { console.log('[ads][rewarded_interstitial] LOADED', { unitId: rewardedInterstitialUnitId, ms: Date.now() - startedAt }); ad.show(); }),
          ad.addAdEventListener(AdEventType.ERROR, (e) => { console.log('[ads][rewarded_interstitial] ERROR', { unitId: rewardedInterstitialUnitId, ms: Date.now() - startedAt, code: e?.code, message: e?.message, domain: e?.domain, cause: e }); cleanup(new Error('ad_error'), reject); }),
          ad.addAdEventListener(AdEventType.CLOSED, () => { console.log('[ads][rewarded_interstitial] CLOSED', { earned, ms: Date.now() - startedAt }); cleanup(earned ? null : new Error('closed'), earned ? resolve : reject); }),
          ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; console.log('[ads][rewarded_interstitial] EARNED', { unitId: rewardedInterstitialUnitId }); })
        );
        console.log('[ads][rewarded_interstitial] load()', { unitId: rewardedInterstitialUnitId });
        ad.load();
      });
    };

    const tryRewarded = async () => {
      if (!rewardedUnitId) throw new Error('missing_unit');
      const ad = RewardedAd.createForAdRequest(rewardedUnitId, { requestNonPersonalizedAdsOnly: true });
      await new Promise((resolve, reject) => {
        let earned = false;
        const subscriptions = [];
        const startedAt = Date.now();
        const cleanup = (error, cb) => {
          subscriptions.forEach((unsubscribe) => { try { unsubscribe(); } catch {} });
          if (error) cb(error); else cb(true);
        };
        subscriptions.push(
          ad.addAdEventListener(AdEventType.LOADED, () => { console.log('[ads][rewarded] LOADED', { unitId: rewardedUnitId, ms: Date.now() - startedAt }); ad.show(); }),
          ad.addAdEventListener(AdEventType.ERROR, (e) => { console.log('[ads][rewarded] ERROR', { unitId: rewardedUnitId, ms: Date.now() - startedAt, code: e?.code, message: e?.message, domain: e?.domain, cause: e }); cleanup(new Error('ad_error'), reject); }),
          ad.addAdEventListener(AdEventType.CLOSED, () => { console.log('[ads][rewarded] CLOSED', { earned, ms: Date.now() - startedAt }); cleanup(earned ? null : new Error('closed'), earned ? resolve : reject); }),
          ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; console.log('[ads][rewarded] EARNED', { unitId: rewardedUnitId }); })
        );
        console.log('[ads][rewarded] load()', { unitId: rewardedUnitId });
        ad.load();
      });
    };

    const tryInterstitial = async () => {
      if (!interstitialUnitId) throw new Error('missing_unit');
      const ad = InterstitialAd.createForAdRequest(interstitialUnitId, { requestNonPersonalizedAdsOnly: true });
      await new Promise((resolve, reject) => {
        const subscriptions = [];
        const startedAt = Date.now();
        const cleanup = (error, cb) => {
          subscriptions.forEach((unsubscribe) => { try { unsubscribe(); } catch {} });
          if (error) cb(error); else cb(true);
        };
        subscriptions.push(
          ad.addAdEventListener(AdEventType.LOADED, () => { console.log('[ads][interstitial] LOADED', { unitId: interstitialUnitId, ms: Date.now() - startedAt }); ad.show(); }),
          ad.addAdEventListener(AdEventType.ERROR, (e) => { console.log('[ads][interstitial] ERROR', { unitId: interstitialUnitId, ms: Date.now() - startedAt, code: e?.code, message: e?.message, domain: e?.domain, cause: e }); cleanup(new Error('ad_error'), reject); }),
          ad.addAdEventListener(AdEventType.CLOSED, () => { console.log('[ads][interstitial] CLOSED', { ms: Date.now() - startedAt }); cleanup(null, resolve); })
        );
        console.log('[ads][interstitial] load()', { unitId: interstitialUnitId });
        ad.load();
      });
    };

    try { await tryRewardedInterstitial(); return true; } catch (e) { console.log('[ads] rewarded_interstitial failed', e?.message || e); }
    try { await tryRewarded(); return true; } catch (e) { console.log('[ads] rewarded failed', e?.message || e); }
    try { await tryInterstitial(); return true; } catch (e) { console.log('[ads] interstitial failed', e?.message || e); }
    console.log('[ads] all attempts failed -> ads_not_ready');
    return false;
  }, [rewardedUnitId, interstitialUnitId, rewardedInterstitialUnitId]);

  const closeCustomGate = useCallback(() => {
    setCustomGateVisible(false);
    setPendingCustomMode(null);
    setPendingQrType(null);
    setRewardUnlocked(false);
    setUnlockModalVisible(false);
  }, []);

  const closeMissingInfo = useCallback(() => {
    setMissingInfoType(null);
  }, []);

  const closeUnlockModal = useCallback(() => {
    setUnlockModalVisible(false);
    setRewardUnlocked(false);
  }, []);

  const handleWatchAdUnlock = useCallback(async () => {
    if (customGateLoading) return;
    setCustomGateLoading(true);
    try {
      const ok = await runCustomRewardFlow();
      if (ok) {
        setUnlockedModes((prev) => {
          const next = { ...prev };
          if (pendingCustomMode && pendingCustomMode !== 'none') next[pendingCustomMode] = true;
          if (pendingQrType) next[pendingQrType] = true;
          return next;
        });
        if (pendingCustomMode) setCustomMode(pendingCustomMode);
        if (pendingQrType) setQrType(pendingQrType);
        closeCustomGate();
        setToast({ visible: true, type: 'success', message: t('custom_qr_unlocked') || 'Bu seçenek açıldı!' });
      } else {
        setToast({ visible: true, type: 'error', message: t('ads_not_ready') || 'Reklam şu anda yüklenemedi.' });
      }
    } catch {
      setToast({ visible: true, type: 'error', message: t('ads_not_ready') || 'Reklam şu anda yüklenemedi.' });
    } finally {
      setCustomGateLoading(false);
    }
  }, [customGateLoading, runCustomRewardFlow, pendingCustomMode, pendingQrType, closeCustomGate, t]);

  const pickCustomLogo = useCallback(async () => {
    if (logoBusy) return;
    if (!ensureCustomAccess(customMode === 'none' ? 'logo' : customMode)) return;
    const launchPicker = async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result?.canceled) return null;
      return result?.assets?.[0]?.uri || null;
    };
    try {
      setLogoBusy(true);
      const androidVer = Platform.OS === 'android' ? Platform.Version : null;
      const usePhotoPicker = Platform.OS === 'android' && typeof androidVer === 'number' && androidVer >= 33;
      if (!usePhotoPicker) {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync();
        let granted = current?.granted;
        if (!granted) {
          const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
          granted = req?.granted;
          if (!granted) {
            Alert.alert(t('permission_required_media') || 'Medya izni gerekli');
            return;
          }
        }
      }
      const uri = await launchPicker();
      if (uri) {
        setCustomLogo(uri);
        if (customMode === 'none') {
          setCustomMode('logo');
        }
      }
    } catch (e) {
      setToast({ visible: true, type: 'error', message: t('errors.imagePickFailed') || 'Görsel seçilemedi. Lütfen tekrar deneyin.' });
    } finally {
      setLogoBusy(false);
    }
  }, [logoBusy, ensureCustomAccess, customMode, t]);

  const clearCustomLogo = useCallback(() => {
    setCustomLogo(null);
  }, []);

  const showLogoControls = useMemo(() => customMode === 'logo' || customMode === 'logo_frame', [customMode]);
  const showFrameControls = useMemo(() => customMode === 'logo_frame' || customMode === 'frame_text', [customMode]);
  const [frameThemeColor, setFrameThemeColor] = useState('#0f172a');
  const [tempFrameColor, setTempFrameColor] = useState('#0f172a');
  const frameLabelBorder = useMemo(() => {
    const c = (frameThemeColor || '').toLowerCase();
    if (c === '#fff' || c === '#ffffff') return 'rgba(0,0,0,0.45)';
    return 'rgba(255,255,255,0.9)';
  }, [frameThemeColor]);
  const frameLabelTextColor = useMemo(() => {
    const c = (frameThemeColor || '').toLowerCase();
    if (c === '#fff' || c === '#ffffff') return '#0b1220';
    return '#fff';
  }, [frameThemeColor]);
  const colorButtonTextColor = useMemo(() => {
    const c = (frameThemeColor || '').toLowerCase();
    if (c === '#fff' || c === '#ffffff') return '#0b1220';
    return '#fff';
  }, [frameThemeColor]);
  const frameLabelText = useMemo(() => {
    const trimmed = (customFrameText || '').trim();
    return trimmed || t('custom_qr_default_label') || 'SCAN ME';
  }, [customFrameText, t]);
  const handleFrameTextChange = useCallback((text) => {
    setCustomFrameText((text || '').slice(0, FRAME_TEXT_MAX));
  }, []);
  const logoScale = useMemo(() => {
    const modules = matrix?.size || 0;
    if (modules >= 45) return 0.30; // dense payload: shrink logo
    if (modules >= 37) return 0.36; // medium
    return 0.48; // short URLs / low version
  }, [matrix]);
  const logoOverlaySize = useMemo(() => {
    const base = qrSize || 0;
    const scale = logoScale;
    const maxPx = scale >= 0.48 ? 150 : 120;
    return Math.max(56, Math.min(base * scale, maxPx));
  }, [qrSize, logoScale]);
  const customUnlockBadge = useMemo(() => {
    if (premium) {
      return { text: t('custom_qr_premium_active') || 'Premium aktif', color: '#22c55e' };
    }
    const currentUnlocked = customMode !== 'none' && unlockedModes[customMode];
    if (currentUnlocked) {
      return { text: t('unlocked') || 'Açık', color: '#22c55e' };
    }
    return { text: t('locked') || 'Kilitli', color: '#f97316' };
  }, [premium, unlockedModes, customMode, t]);

  const generateMatrix = useCallback(async (text) => {
    try {
      if (!text || !text.trim()) {
        setMatrix(null);
        setError(null);
        return;
      }

      setPreparing(true);
      setIsGenerating(true);
      setError(null);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const writer = new QRCodeWriter();
      const hints = new Map();
      // Larger quiet zone to help framed/long payloads scan better
      const quietZone = showFrameControls ? 6 : 4;
      hints.set(EncodeHintType.MARGIN, quietZone);
      // Use highest error correction to tolerate logo overlay; 'H' is accepted by zxing
      hints.set(EncodeHintType.ERROR_CORRECTION, 'H');
      // Render-friendly size: avoid creating too many views which can crash RN
      const targetSize = showFrameControls ? 58 : 54; // modules
      const bitMatrix = writer.encode(text, BarcodeFormat.QR_CODE, targetSize, targetSize, hints);
      const width = bitMatrix.getWidth();
      const height = bitMatrix.getHeight();
      const rows = [];
      
      for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
          row.push(bitMatrix.get(x, y));
        }
        rows.push(row);
      }
      
      setMatrix({ rows, size: width });
      setError(null);
    } catch (e) {
      console.error('QR generation error:', e);
      setMatrix(null);
      setError(t('qr_generation_error') || 'QR kod oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setPreparing(false);
      setIsGenerating(false);
    }
  }, [t]);

  const buildPayload = useCallback(() => {
    if (qrType === 'url') {
      const v = (input || '').trim();
      return v;
    }
    if (qrType === 'text') {
      return (input || '').trim();
    }
    if (qrType === 'wifi') {
      const esc = (s) => (s || '').replace(/([\\;,:])/g, '\\$1');
      const t = wifiSec === 'nopass' ? 'nopass' : (wifiSec === 'WEP' ? 'WEP' : 'WPA');
      const parts = [
        `T:${t}`,
        `S:${esc(wifiSsid)}`
      ];
      if (t !== 'nopass') parts.push(`P:${esc(wifiPassword)}`);
      if (wifiHidden) parts.push('H:true');
      return 'WIFI:' + parts.join(';') + ';';
    }
    if (qrType === 'tel') {
      const n = (phoneNumber || '').trim();
      return n ? `tel:${n}` : '';
    }
    if (qrType === 'email') {
      const to = (emailAddr || '').trim();
      const q = [];
      if (emailSubject) q.push(`subject=${encodeURIComponent(emailSubject)}`);
      if (emailBody) q.push(`body=${encodeURIComponent(emailBody)}`);
      const query = q.length ? `?${q.join('&')}` : '';
      return to ? `mailto:${to}${query}` : '';
    }
    if (qrType === 'sms') {
      const n = (smsNumber || '').trim();
      const b = (smsBody || '').trim();
      if (!n && !b) return '';
      return b ? `SMSTO:${n}:${b}` : `SMSTO:${n}`;
    }
    return (input || '').trim();
  }, [wifiSsid, wifiSec, wifiPassword, wifiHidden, phoneNumber, emailAddr, emailSubject, emailBody, smsNumber, smsBody, qrType, input]);

  const payloadLength = useMemo(() => {
    const p = buildPayload();
    return (p || '').length;
  }, [buildPayload]);

  const canGenerate = () => {
    if (qrType === 'wifi') {
      if (!wifiSsid.trim()) return false;
      if (wifiSec !== 'nopass' && !wifiPassword.trim()) return false;
      return true;
    }
    if (qrType === 'tel') return !!phoneNumber.trim();
    if (qrType === 'email') return !!emailAddr.trim();
    if (qrType === 'sms') return !!smsNumber.trim() || !!smsBody.trim();
    return !!(input || '').trim();
  };

  const onGenerate = async () => {
    if (!canGenerate()) {
      setMissingInfoType(qrType);
      return;
    }
    const payload = buildPayload();
    if (!payload) { setMatrix(null); setError(null); return; }
    if (payload === lastGeneratedRef.current && matrix) {
      return;
    }
    lastGeneratedRef.current = payload;
    Keyboard.dismiss();
    await generateMatrix(payload);
  };

  const renderLoadingStates = () => {
    const active = isGenerating || preparing;
    if (!active) return null;
    return (
      <View style={[styles.loadingOverlay, { backgroundColor: dark ? 'rgba(10,14,20,0.8)' : 'rgba(255,255,255,0.9)' }]}>
        <View style={[styles.loadingCard, { backgroundColor: dark ? '#0f172a' : '#ffffff', borderColor: dark ? '#1d2a3f' : '#e2e8f0' }]}>
          <View style={[styles.loadingIconWrap, { backgroundColor: dark ? 'rgba(79,70,229,0.15)' : 'rgba(99,102,241,0.12)' }]}>
            <ActivityIndicator size="small" color={dark ? '#c4d4ff' : '#4f46e5'} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.loadingTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
              {t('loading.generatingCode') || 'Kodunuz oluşturuluyor...'}
            </Text>
            <Text style={[styles.loadingSubtitle, { color: dark ? '#94a3b8' : '#475569' }]}>
              {t('loading.generatingCodeDesc') || 'QR kod hazırlanıyor ve özelleştirmeler uygulanıyor'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem('premium');
        setPremium(v === 'true');
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      try {
        const v = await AsyncStorage.getItem('premium');
        setPremium(v === 'true');
      } catch {}
    });
    return unsubscribe;
  }, [navigation]);



  const clearInput = () => {
    setInput('');
    setMatrix(null);
    setError(null);
    setInputHeight(44);
  };

  // Keep per-module pixel size reasonable to avoid excessive child views
  const cellSize = useMemo(() => {
    if (!matrix) return 6;
    const targetPx = 320; // cap preview to avoid huge renders on long URLs
    const computed = Math.floor(targetPx / matrix.size);
    return Math.max(3, Math.min(6, computed));
  }, [matrix]);
  const qrSize = matrix ? matrix.size * cellSize : 0;

  const buildCanvasDataUrl = () => {
    if (!matrix || !isWeb) return null;
    const size = matrix.size * cellSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    for (let y = 0; y < matrix.size; y++) {
      for (let x = 0; x < matrix.size; x++) {
        if (matrix.rows[y][x]) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
    return canvas.toDataURL('image/png');
  };

  const performDownload = async () => {
    try {
      if (!matrix) return;
      
      // Generate app-specific filename with timestamp
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const filename = `Secure QR & Link Scanner QR Code${year}.${month}.${day} ${hours}:${minutes}.png`;
      
      if (isWeb) {
        const url = buildCanvasDataUrl();
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
      } else {
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t('permission_required_media') || 'Medya izni gerekli');
          return false;
        }
        const uri = await captureRef(qrRef, { format: 'png', quality: 1, result: 'tmpfile' });
        if (!uri) throw new Error('capture_failed');
        await MediaLibrary.saveToLibraryAsync(uri);
        return true;
      }
    } catch (e) {
      Alert.alert(t('qr_generation_error') || 'QR kod oluşturulamadı. Lütfen tekrar deneyin.');
      return false;
    }
  };

  const performShare = async () => {
    try {
      // Generate app-specific filename with timestamp
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const filename = `SecureQR_${year}${month}${day}_${hours}${minutes}${seconds}.png`;
      
      if (isWeb) {
        const canvasUrl = buildCanvasDataUrl();
        if (!canvasUrl) return;
        const res = await fetch(canvasUrl);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'QR Code', text: input || '' });
        } else {
          const win = window.open(canvasUrl, '_blank');
          if (!win) Alert.alert(t('share_unavailable') || 'Paylaşım desteklenmiyor');
        }
      } else {
        const uri = await captureRef(qrRef, { format: 'png', quality: 1, result: 'tmpfile' });
        if (!uri) throw new Error('capture_failed');
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('share') || 'Paylaş' });
        } else {
          const { Share } = await import('react-native');
          await Share.share({ message: input || '', url: uri });
        }
      }
    } catch (e) {
      setToast({ visible: true, message: t('share_unavailable') || 'Paylaşım şu anda kullanılamıyor', type: 'error' });
    }
  };

  const onDownload = async () => {
    if (!matrix) return;
    const ok = await performDownload();
    if (ok) {
      setToast({ visible: true, message: t('saved_to_gallery') || 'Galeriye kaydedildi', type: 'success' });
    }
  };

  const onShare = async () => {
    await performShare();
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView 
      style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#e9edf3' }]}
      contentContainerStyle={[styles.contentContainer, compact ? { padding: 12, paddingBottom: 24 } : null]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: dark ? '#0d1523' : '#ffffff',
            borderColor: dark ? '#1f2937' : '#dbe2ea',
            shadowColor: dark ? '#0b1220' : '#4a9eff',
          }
        ]}
      >
        <View style={[
          styles.heroIconWrap,
          { backgroundColor: dark ? 'rgba(74,158,255,0.08)' : 'rgba(0,102,204,0.08)', borderColor: dark ? '#243044' : '#dbe2ea' }
        ]}>
          <Ionicons
            name="qr-code"
            size={compact ? 30 : 34}
            color={dark ? '#4a9eff' : '#0066cc'}
          />
        </View>
        <Text style={[
          styles.heroTitle,
          compact ? { fontSize: 22 } : null,
          { color: dark ? '#e6edf3' : '#0b1220' }
        ]}>
          {t('qr_generator_title') || 'QR Kod Oluşturucu'}
        </Text>
        <Text style={[
          styles.heroSubtitle,
          { color: dark ? '#94a3b8' : '#4b5563' }
        ]}>
          {t('qr_generator_subtitle') || 'Bağlantı, Wi‑Fi, metin ve daha fazlası için zahmetsiz QR kodları oluşturun.'}
        </Text>
        <View style={[
          styles.heroBadge,
          { backgroundColor: dark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.08)', borderColor: dark ? 'rgba(37,99,235,0.35)' : 'rgba(37,99,235,0.45)' }
        ]}>
          <Ionicons name="sparkles" size={14} color={dark ? '#93c5fd' : '#2563eb'} />
          <Text style={[styles.heroBadgeText, { color: dark ? '#cbd5f5' : '#1d4ed8' }]}>
            {t('qr_generator_badge') || 'Modern & hızlı'}
          </Text>
        </View>
      </View>

      {/* Input Section */}
      <View style={styles.inputSection}>
        <View
          style={[
            styles.typeCard,
            {
              backgroundColor: dark ? '#0d1523' : '#ffffff',
              borderColor: dark ? '#1f2937' : '#dbe2ea',
              shadowColor: dark ? '#0b1220' : '#4a9eff',
            }
          ]}
        >
        <View style={{ marginBottom: 8 }}>
          <Text style={[styles.customTitle, { color: dark ? '#b1bac4' : '#4a5568', fontSize: 16 }]}>
            {t('input_label') || 'İçerik Türü'}
          </Text>
        </View>
        <View style={styles.typeRow}>
          {[
            { k: 'url', label: t('label.url') || 'URL', icon: 'link-outline' },
            { k: 'text', label: t('label.content') || 'Metin', icon: 'document-text-outline' },
            { k: 'wifi', label: t('label.wifi') || 'Wi‑Fi', icon: 'wifi-outline' },
            { k: 'tel', label: t('label.phone') || 'Telefon', icon: 'call-outline' },
            { k: 'email', label: t('label.email') || 'E‑posta', icon: 'mail-outline' },
            { k: 'sms', label: t('label.sms') || 'SMS', icon: 'chatbubbles-outline' }
          ].map((opt) => {
            const active = qrType === opt.k;
            const baseColor = active ? '#fff' : (dark ? '#8b98a5' : '#0b1220');
            return (
              <TouchableOpacity
                key={opt.k}
                onPress={() => handleQrTypePress(opt.k)}
                style={[
                  styles.typeChip,
                  { backgroundColor: dark ? '#0f172a' : '#f7f9fb', borderColor: dark ? '#243044' : '#dbe2ea' },
                  active ? styles.typeChipActive : null
                ]}
                activeOpacity={0.9}
              >
                <View style={[
                  styles.typeIconWrap,
                  { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderColor: dark ? '#243044' : '#e5eaf1' },
                  active ? styles.typeIconWrapActive : null
                ]}>
                  <Ionicons name={opt.icon} size={18} color={active ? '#fff' : (dark ? '#c3dafe' : '#2563eb')} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Text style={[
                    styles.typeChipText,
                    { color: baseColor },
                  ]}>{opt.label}</Text>
                  {['wifi', 'tel', 'email', 'sms'].includes(opt.k) && !premium && !unlockedModes[opt.k] && (
                    <Ionicons name="lock-closed" size={14} color={active ? '#fff' : '#f97316'} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        </View>
        
        <View style={{ height: 10 }} />

        {qrType === 'url' || qrType === 'text' ? (
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: dark ? '#0d1523' : '#ffffff',
                  color: dark ? '#e6edf3' : '#0b1220',
                  borderColor: error
                    ? (dark ? '#ff6b6b' : '#dc2626')
                    : (dark ? '#1b2330' : '#dde3ea')
                , height: inputHeight
                }
              ]}
              placeholder={t('input_placeholder') || (qrType === 'url' ? 'URL girin...' : 'Metin girin...')}
              placeholderTextColor={dark ? '#8b98a5' : '#7a8699'}
              value={input}
              onChangeText={setInput}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              numberOfLines={1}
              textAlignVertical="top"
              scrollEnabled={false}
              onContentSizeChange={(e) => {
                const h = Math.max(44, Math.min(e.nativeEvent.contentSize.height, 160));
                setInputHeight(h);
              }}
            />
            {((input || '').length > 0) && (
              <TouchableOpacity
                style={[
                  styles.clearButton,
                  { backgroundColor: dark ? '#172031' : '#f0f4f8', borderColor: dark ? '#243044' : '#dbe2ea' }
                ]}
                onPress={clearInput}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color={dark ? '#8b98a5' : '#7a8699'} />
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {qrType === 'wifi' ? (
          <View style={{ gap: 10 }}>
            <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('wifi.ssid') || 'SSID'}</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]}
              value={wifiSsid}
              onChangeText={setWifiSsid}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('wifi.security') || 'Güvenlik'}</Text>
            <View style={styles.segmented}>
              {[
                { k: 'WPA', label: t('wifi.security.wpa') || 'WPA/WPA2' },
                { k: 'WEP', label: t('wifi.security.wep') || 'WEP' },
                { k: 'nopass', label: t('wifi.security.nopass') || 'Yok' }
              ].map(opt => (
                <TouchableOpacity key={opt.k} onPress={() => setWifiSec(opt.k)} style={[styles.segBtn, { borderColor: dark ? '#243044' : '#dbe2ea', backgroundColor: dark ? '#172031' : '#f0f4f8' }, wifiSec === opt.k ? styles.segBtnActive : null]}>
                  <Text style={[styles.segText, { color: dark ? '#8b98a5' : '#0b1220' }, wifiSec === opt.k ? { color: '#fff' } : null]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {wifiSec !== 'nopass' ? (
              <>
                <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('wifi.password') || 'Şifre'}</Text>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]}
                  value={wifiPassword}
                  onChangeText={setWifiPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </>
            ) : null}
            <View style={styles.toggleRow}>
              <TouchableOpacity onPress={() => setWifiHidden(h => !h)} style={[styles.typeChip, { backgroundColor: dark ? '#172031' : '#f0f4f8', borderColor: dark ? '#243044' : '#dbe2ea' }, wifiHidden ? styles.typeChipActive : null]}>
                <Text style={[styles.typeChipText, { color: dark ? '#8b98a5' : '#0b1220' }, wifiHidden ? { color: '#fff' } : null]}>{t('wifi.hiddenNetwork') || 'Gizli Ağ'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {qrType === 'tel' ? (
          <View style={{ gap: 10 }}>
            <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('tel.number') || 'Telefon Numarası'}</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : null}

        {qrType === 'email' ? (
          <View style={{ gap: 10 }}>
            <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('email.address') || 'E‑posta Adresi'}</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]}
              value={emailAddr}
              onChangeText={setEmailAddr}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('email.subject') || 'Konu'}</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]}
              value={emailSubject}
              onChangeText={setEmailSubject}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('email.body') || 'İçerik'}</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea', minHeight: 80, paddingVertical: 10 }]}
              value={emailBody}
              onChangeText={setEmailBody}
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : null}

        {qrType === 'sms' ? (
          <View style={{ gap: 10 }}>
            <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('sms.number') || 'Telefon Numarası'}</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]}
              value={smsNumber}
              onChangeText={setSmsNumber}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('sms.body') || 'Mesaj'}</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea', minHeight: 80, paddingVertical: 10 }]}
              value={smsBody}
              onChangeText={setSmsBody}
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : null}

        {/* Customization Section */}
        <View style={[styles.customSection, { backgroundColor: dark ? '#0d1523' : '#ffffff', borderColor: dark ? '#1f2937' : '#dbe2ea' }]}>
          <View style={styles.customHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.customTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
                {t('custom_qr_title') || 'Özel QR Stilleri'}
              </Text>
              <Text style={[styles.customSubtitle, { color: dark ? '#8b98a5' : '#64748b' }]}>
                {t('custom_qr_subtitle') || 'Logo, çerçeve ve yazı ekleyerek öne çıkın'}
              </Text>
            </View>
            {customMode !== 'none' && (
            <View style={[
              styles.customBadge,
              {
                borderColor: customUnlockBadge.color,
                backgroundColor: customUnlockBadge.color === '#f97316' ? 'rgba(249,115,22,0.15)' : 'rgba(34,197,94,0.18)'
              }
            ]}>
              <Ionicons name={(premium || isModeUnlocked(customMode)) ? 'shield-checkmark' : 'lock-closed'} size={16} color={customUnlockBadge.color} />
              <Text style={[styles.customBadgeText, { color: customUnlockBadge.color }]}>
                {customUnlockBadge.text}
              </Text>
            </View>
          )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.customModesRow}>
            {CUSTOM_MODES.map((mode) => {
              const active = customMode === mode.key;
              const locked = mode.key !== 'none' && !isModeUnlocked(mode.key);
              return (
                <TouchableOpacity
                  key={mode.key}
                  onPress={() => handleCustomModePress(mode.key)}
                  activeOpacity={0.85}
                  style={[
                    styles.customModeChip,
                    { backgroundColor: dark ? '#111827' : '#f8fafc', borderColor: dark ? '#1f2937' : '#e2e8f0' },
                    active ? styles.customModeChipActive : null,
                    locked ? { opacity: 0.65 } : null
                  ]}
                >
                  <Ionicons name={mode.icon} size={18} color={active ? '#fff' : (dark ? '#94a3b8' : '#475569')} />
                  <Text style={[
                    styles.customModeText,
                    { color: active ? '#fff' : (dark ? '#cbd5f5' : '#0f172a') }
                  ]}>
                    {t(mode.labelKey) || mode.defaultLabel}
                  </Text>
                  {locked && (
                    <Ionicons name="lock-closed" size={14} color={active ? '#fff' : '#f97316'} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {showLogoControls && (
            <View style={[styles.logoCard, { borderColor: dark ? '#1f2937' : '#dbe2ea', backgroundColor: dark ? '#0d1523' : '#ffffff' }]}>
              <View style={styles.logoPreview}>
                {customLogo ? (
                  <Image source={{ uri: customLogo }} style={styles.logoImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.logoPlaceholder, { borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
                    <Ionicons name="image-outline" size={26} color={dark ? '#94a3b8' : '#94a3b8'} />
                    <Text style={{ color: dark ? '#94a3b8' : '#475569', fontSize: 12, marginTop: 4 }}>
                      {t('custom_qr_logo_hint') || 'Galeriden logo seçin'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <TouchableOpacity
                  style={[styles.logoActionBtn, { backgroundColor: '#2563eb' }]}
                  onPress={pickCustomLogo}
                  disabled={logoBusy}
                >
                  {logoBusy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                      <Text style={styles.logoActionText}>
                        {customLogo ? (t('custom_qr_change_logo') || 'Logoyu değiştir') : (t('custom_qr_add_logo') || 'Logo ekle')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                {customLogo && (
                  <TouchableOpacity style={[styles.logoActionBtnSecondary, { borderColor: dark ? '#374151' : '#cbd5f5' }]} onPress={clearCustomLogo}>
                    <Ionicons name="trash-outline" size={18} color={dark ? '#f87171' : '#dc2626'} />
                    <Text style={[styles.logoActionTextSecondary, { color: dark ? '#f87171' : '#dc2626' }]}>
                      {t('custom_qr_remove_logo') || 'Logoyu kaldır'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {showFrameControls && (
            <View style={[styles.frameCard, { borderColor: dark ? '#1f2937' : '#dbe2ea', backgroundColor: dark ? '#0d1523' : '#ffffff' }]}>
              <Text style={[styles.frameLabelTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
                {t('custom_qr_frame_text') || 'Çerçeve Yazısı'}
              </Text>
              <TextInput
                style={[
                  styles.frameInput,
                  { 
                    backgroundColor: dark ? '#0b1220' : '#fff',
                    borderColor: dark ? '#1f2937' : '#d1d5db',
                    color: dark ? '#e6edf3' : '#0b1220'
                  }
                ]}
                placeholder={t('custom_qr_frame_placeholder') || 'SCAN ME'}
                placeholderTextColor={dark ? '#4b5563' : '#94a3b8'}
                value={customFrameText}
                onChangeText={handleFrameTextChange}
                maxLength={FRAME_TEXT_MAX}
              />
              <Text style={[styles.frameCounter, { color: dark ? '#8b98a5' : '#475569' }]}>
                {(customFrameText || '').length}/{FRAME_TEXT_MAX}
              </Text>
              <TouchableOpacity
                style={[styles.colorButton, { backgroundColor: frameThemeColor }]}
                onPress={() => { setTempFrameColor(frameThemeColor); setColorPickerVisible(true); }}
                activeOpacity={0.9}
              >
                <Ionicons name="color-palette" size={18} color="#fff" />
                <Text style={[styles.colorButtonText, { color: colorButtonTextColor }]}>{t('custom_qr_color_pick') || 'Tema rengi seç'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {!premium && customMode !== 'none' && !isModeUnlocked(customMode) && (
            <Text style={[styles.customHint, { color: dark ? '#94a3b8' : '#475569' }]}>
              {t('custom_qr_locked_hint') || 'Premium üye olun ya da bu seçenek için ödüllü reklam izleyin.'}
            </Text>
          )}
        </View>

        {/* Character Count */}
          <Text style={[styles.charCount, compact ? { fontSize: 11 } : null, { color: dark ? '#8b98a5' : '#7a8699' }]}>
            {payloadLength} {t('characters') || 'karakter'}
          </Text>
          <View style={[styles.generateRow, compact ? { marginTop: 8 } : null]}>
            <TouchableOpacity 
              style={[styles.generateBtn, !canGenerate() ? { opacity: 0.7 } : null]}
              onPress={onGenerate}
              disabled={isGenerating}
              activeOpacity={0.85}
            >
              <Ionicons name="flash-outline" size={20} color="#fff" />
              <Text style={styles.generateText}>{t('actions.generate') || 'QR Oluştur'}</Text>
            </TouchableOpacity>
          </View>
      </View>

      {/* Error Message */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: dark ? '#2d1515' : '#fee' }]}>
          <Ionicons name="alert-circle" size={20} color={dark ? '#ff6b6b' : '#dc2626'} />
          <Text style={[styles.errorText, { color: dark ? '#ff6b6b' : '#dc2626' }]}>
            {error}
          </Text>
        </View>
      )}

      {/* Loading Indicator */}
      {isGenerating && (
        <View style={[styles.loadingContainer, compact ? { paddingVertical: 24 } : null]}>
          <ActivityIndicator size="large" color={dark ? '#4a9eff' : '#0066cc'} />
          <Text style={[styles.loadingText, { color: dark ? '#b1bac4' : '#4a5568' }]}>
            {t('generating') || 'Oluşturuluyor...'}
          </Text>
        </View>
      )}

      {/* QR Code Display */}
      {matrix && !isGenerating && (
        <View style={[styles.qrSection, compact ? { gap: 12, marginVertical: 12 } : null]}>
          <ViewShot ref={qrRef} options={{ format: 'png', quality: 1 }}>
            <View style={[ styles.qrContainer, { backgroundColor: showFrameControls ? frameThemeColor : (dark ? '#1b2330' : '#fff') } ]}>
              <View style={[
                styles.qrPreview,
                showFrameControls ? styles.qrPreviewFramed : null
              ]}>
                <View style={[
                  styles.qrWrap,
                  { width: qrSize, height: qrSize },
                  showFrameControls ? styles.qrWrapElevated : null
                ]}>
                  {matrix.rows.map((row, y) => (
                    <View key={y} style={{ flexDirection: 'row' }}>
                      {row.map((on, x) => (
                        <View 
                          key={x} 
                          style={{ 
                            width: cellSize, 
                            height: cellSize, 
                            backgroundColor: on ? '#000' : '#fff' 
                          }} 
                        />
                      ))}
                    </View>
                  ))}
                  {showLogoControls && customLogo ? (
                    <View style={[
                      styles.logoOverlay,
                      {
                        width: logoOverlaySize,
                        height: logoOverlaySize,
                        marginLeft: -(logoOverlaySize / 2),
                        marginTop: -(logoOverlaySize / 2)
                      }
                    ]}>
                      <Image source={{ uri: customLogo }} style={styles.logoOverlayImage} />
                    </View>
                  ) : null}
                </View>
                {showFrameControls && (
                  <View style={[
                    styles.frameLabelBlock,
                    { backgroundColor: frameThemeColor, borderColor: frameLabelBorder }
                  ]}>
                    <Text style={[styles.frameLabelText, { color: frameLabelTextColor }]}>{frameLabelText}</Text>
                  </View>
                )}
              </View>
            </View>
          </ViewShot>

          {/* Action Buttons */}
          <View style={[styles.actionButtons, compact ? { gap: 8 } : null]}>
            <TouchableOpacity 
              style={[styles.actionButton, compact ? { paddingVertical: 10 } : null, { backgroundColor: dark ? '#1b2330' : '#fff' }]}
              onPress={onDownload}
            >
              <Ionicons name="download-outline" size={20} color={dark ? '#4a9eff' : '#0066cc'} />
              <Text style={[styles.actionButtonText, compact ? { fontSize: 14 } : null, { color: dark ? '#4a9eff' : '#0066cc' }]}>
                {t('download') || 'İndir'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, compact ? { paddingVertical: 10 } : null, { backgroundColor: dark ? '#1b2330' : '#fff' }]}
              onPress={onShare}
            >
              <Ionicons name="share-outline" size={20} color={dark ? '#4a9eff' : '#0066cc'} />
              <Text style={[styles.actionButtonText, compact ? { fontSize: 14 } : null, { color: dark ? '#4a9eff' : '#0066cc' }]}>
                {t('share') || 'Paylaş'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Placeholder */}
      {!matrix && !isGenerating && !error && (
        <View style={[
          {backgroundColor: dark ? '#0d1523' : '#ffffff', borderColor: dark ? '#1f2937' : '#dbe2ea', borderWidth: 1},
          styles.placeholder, compact ? { padding: 24 } : null, { borderColor: dark ? '#1b2330' : '#dde3ea' }]}>
          <View style={[styles.placeholderIcon, { backgroundColor: dark ? '#1b2330' : '#f0f4f8' }]}>
            <Ionicons name="qr-code-outline" size={compact ? 52 : 64} color={dark ? '#4a5568' : '#94a3b8'} />
          </View>
          <Text style={[styles.placeholderTitle, compact ? { fontSize: 16 } : null, { color: dark ? '#e6edf3' : '#0b1220' }]}>
            {t('placeholder_title') || 'QR Kod Oluşturun'}
          </Text>
          <Text style={[styles.placeholderText, { color: dark ? '#8b98a5' : '#7a8699' }]}>
            {t('placeholder_text') || 'Yukarıdaki alana metin veya URL girin, QR kodunuz otomatik olarak oluşturulacak'}
          </Text>
        </View>
      )}

      {/* Info Section */}
      <View style={[
        styles.infoSection,
        { backgroundColor: dark ? '#0d1523' : '#ffffff', borderColor: dark ? '#1f2937' : '#dbe2ea', borderWidth: 1 }
      ]}>
        <Text style={[styles.infoTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
          <Ionicons name="information-circle" size={16} /> {t('info_title') || 'Bilgi'}
        </Text>
        <Text style={[styles.infoText, { color: dark ? '#8b98a5' : '#7a8699' }]}>
          {t('info_text') || 'QR kodları URL, metin, telefon numarası, e-posta adresi ve daha fazlasını içerebilir. Maksimum 2.953 karakter desteklenir.'}
        </Text>
      </View>

    </ScrollView>
    <View style={{ padding:0 }}>
      <AdBanner placement="global_footer" isFooter />
    </View>
    <Toast 
      visible={toast.visible} 
      message={toast.message}
      type={toast.type}
      dark={dark}
      onHide={() => setToast(prev => ({ ...prev, visible: false }))}
      style={{ bottom: Math.max(insets.bottom + 32, 32) }}
    />
    <Modal
      visible={colorPickerVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setColorPickerVisible(false)}
    >
      <View style={styles.colorModalOverlay}>
        <View style={[styles.colorModalCard, { backgroundColor: dark ? '#0b1120' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
          <Text style={[styles.colorModalTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
            {t('custom_qr_color_pick') || 'Tema rengi seç'}
          </Text>
          <View style={styles.colorSwatchGrid}>
            {FRAME_SWATCHES.map((c) => {
              const active = tempFrameColor === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c, borderColor: active ? '#2563eb' : dark ? '#1f2937' : '#e5e7eb' },
                    active ? styles.colorSwatchActive : null
                  ]}
                  onPress={() => setTempFrameColor(c)}
                  activeOpacity={0.85}
                >
                  {active && <Ionicons name="checkmark" size={18} color={c === '#ffffff' ? '#111827' : '#fff'} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.colorModalActions}>
            <TouchableOpacity
              style={[styles.colorBtn, { backgroundColor: dark ? '#1f2937' : '#e5e7eb' }]}
              onPress={() => setColorPickerVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.colorBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('close') || 'Kapat'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.colorBtn, { backgroundColor: '#2563eb' }]}
              onPress={() => { setFrameThemeColor(tempFrameColor); setColorPickerVisible(false); }}
              activeOpacity={0.9}
            >
              <Text style={[styles.colorBtnText, { color: '#fff' }]}>{t('actions.ok') || 'Tamam'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    <Modal
      visible={unlockModalVisible}
      animationType="fade"
      transparent
      onRequestClose={closeUnlockModal}
    >
      <View style={styles.rewardOverlay}>
        <View style={[
          styles.rewardCard,
          { backgroundColor: dark ? '#0b1120' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }
        ]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Ionicons name="checkmark-circle" size={22} color={dark ? '#22c55e' : '#15803d'} />
            <Text style={[styles.rewardTitle, { color: dark ? '#e6edf3' : '#0f172a' }]}>
              {t('reward.unlocked_title') || 'Kilit açıldı'}
            </Text>
          </View>
          <Text style={[styles.rewardSubtitle, { color: dark ? '#94a3b8' : '#475569', marginBottom: 14 }]}>
            {t('reward.unlocked_desc') || 'Özel stiller artık kullanılabilir.'}
          </Text>
          <TouchableOpacity
            style={[
              styles.rewardCta,
              {
                backgroundColor: dark ? '#22c55e' : '#22c55e',
                shadowColor: 'transparent',
                borderRadius: 12
              }
            ]}
            onPress={closeUnlockModal}
            activeOpacity={0.9}
          >
            <Text style={styles.rewardCtaText}>{t('actions.ok') || 'Tamam'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    <Modal
      visible={!!missingInfoType}
      animationType="fade"
      transparent
      onRequestClose={closeMissingInfo}
    >
      <View style={styles.rewardOverlay}>
        <View style={[
          styles.rewardCard,
          { backgroundColor: dark ? '#0b1120' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }
        ]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Ionicons name="alert-circle" size={22} color={dark ? '#facc15' : '#d97706'} />
            <Text style={[styles.rewardTitle, { color: dark ? '#e6edf3' : '#0f172a' }]}>
              {t('missing_info.title') || 'Eksik bilgi'}
            </Text>
          </View>
          <Text style={[styles.rewardSubtitle, { color: dark ? '#94a3b8' : '#475569' }]}>
            {missingInfoMessage}
          </Text>
          <TouchableOpacity
            style={[styles.rewardCta, { backgroundColor: '#2563eb', marginTop: 14 }]}
            onPress={closeMissingInfo}
            activeOpacity={0.9}
          >
            <Text style={styles.rewardCtaText}>
              {t('actions.ok') || 'Tamam'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    <Modal
      visible={customGateVisible}
      animationType="fade"
      transparent
      onRequestClose={closeCustomGate}
    >
      <View style={styles.rewardOverlay}>
        <View style={[
          styles.rewardCard,
          { backgroundColor: dark ? '#0b1120' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }
        ]}>
          <TouchableOpacity
            onPress={closeCustomGate}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            style={{ position: 'absolute', top: 10, right: 10, padding: 4 }}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle" size={22} color={dark ? '#94a3b8' : '#94a3b8'} />
          </TouchableOpacity>
          <View style={styles.rewardHeader}>
            <Ionicons name="sparkles" size={22} color={dark ? '#facc15' : '#f59e0b'} />
            <Text style={[styles.rewardTitle, { color: dark ? '#e6edf3' : '#0f172a' }]}>
              {gateTitle}
            </Text>
          </View>
          <Text style={[styles.rewardSubtitle, { color: dark ? '#94a3b8' : '#475569' }]}>
            {gateDesc}
          </Text>
          <TouchableOpacity
            style={[
              styles.premiumBtn,
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: 'rgba(236,72,153,0.7)',
                backgroundColor: 'rgba(236,72,153,0.26)',
                shadowColor: 'transparent',
                shadowOpacity: 0,
                shadowRadius: 0,
                shadowOffset: { width: 0, height: 0 },
                elevation: 0,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginBottom: 2
              }
            ]}
            onPress={() => {
              closeCustomGate();
              navigation.navigate('Premium');
            }}
            activeOpacity={0.9}
          >
            <Ionicons name="diamond" size={18} color={dark ? '#fce7f3' : '#be185d'} style={{ marginRight: 8 }} />
            <Text style={[styles.premiumText, { color: dark ? '#fce7f3' : '#9d174d', fontWeight: '800' }]}>
              {t('custom_qr_go_premium') || 'Premium planlarını gör'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.rewardCta,
              {
                backgroundColor: dark ? '#166534' : '#16a34a',
                borderColor: dark ? '#22c55e' : '#16a34a',
                borderWidth: 1,
                shadowColor: 'transparent',
                shadowOpacity: 0,
                shadowRadius: 0,
                shadowOffset: { width: 0, height: 0 },
                elevation: 0
              }
            ]}
            onPress={handleWatchAdUnlock}
            disabled={customGateLoading}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {customGateLoading ? (
                <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
              ) : (
                <Ionicons
                  name={rewardUnlocked ? 'checkmark-circle' : 'play-circle-outline'}
                  size={20}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
              )}
              <Text style={styles.rewardCtaText}>
                {customGateLoading
                  ? (t('reward.loading') || 'Ödüllü reklam yükleniyor...')
                  : rewardUnlocked
                    ? (t('reward.unlocked') || 'Kilit açıldı!')
                    : (t('custom_qr_watch_ad') || 'Ödüllü reklam izle')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
    marginBottom: 2,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 6,
  },
  heroIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    alignSelf: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  heroBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  inputSection: {
    marginBottom: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2
  },
  typeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    width: '100%',
    alignSelf: 'center',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 5,
  },
  typeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: '48%',
  },
  typeChipActive: {
    backgroundColor: '#2f9e44',
    borderColor: '#2f9e44'
  },
  typeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  typeIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.45)',
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600'
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 44,
    fontSize: 16,
    minHeight: 44,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600'
  },
  fieldInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16
  },
  segmented: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 6
  },
  segBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1
  },
  segBtnActive: {
    backgroundColor: '#2f9e44',
    borderColor: '#2f9e44'
  },
  segText: {
    fontSize: 13,
    fontWeight: '600'
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charCount: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  generateRow: {
    marginTop: 10,
    alignItems: 'stretch'
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2f9e44',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  generateText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700'
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  qrSection: {
    alignItems: 'center',
    gap: 20,
    marginVertical: 20,
  },
  qrContainer: {
    padding: 12,
    width: '90%',
    maxWidth: 380,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrWrap: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#4a9eff',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 40,
    gap: 16,
    marginVertical: 20,
  },
  placeholderIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoSection: {
    padding: 16,
    borderRadius: 12,
    marginTop: 2,
    gap: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  customSection: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    gap: 18,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  customSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  customBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 20,
    gap: 6,
  },
  customBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  loadingCard: { width: '100%', maxWidth: 360, borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  loadingIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  loadingTitle: { fontSize: 15, fontWeight: '800' },
  loadingSubtitle: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  customModesRow: {
    flexGrow: 1,
    gap: 12,
    paddingVertical: 2,
  },
  customModeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  customModeChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOpacity: 0.27,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 6,
  },
  customModeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  logoCard: {
    flexDirection: 'row',
    gap: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  logoPreview: {
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
  },
  logoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  logoActionText: {
    color: '#fff',
    fontWeight: '700',
  },
  logoActionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  logoActionTextSecondary: {
    fontWeight: '600',
  },
  frameCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  frameLabelTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  frameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  frameCounter: {
    textAlign: 'right',
    fontSize: 12,
  },
  customHint: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  qrPreview: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 6,
  },
  qrPreviewFramed: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  qrWrapElevated: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    backgroundColor: '#fff',
  },
  frameLabelBlock: {
    width: '90%',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  frameLabelText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 1.1,
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  logoOverlay: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    top: '50%',
    left: '50%',
    marginLeft: -34,
    marginTop: -34,
    elevation: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  logoOverlayImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  colorButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  colorButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  colorModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  colorModalCard: { width: '100%', maxWidth: 380, borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  colorModalTitle: { fontSize: 16, fontWeight: '800' },
  colorSwatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  colorSwatch: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  colorSwatchActive: { shadowColor: '#2563eb', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  colorModalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  colorBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  colorBtnText: { fontSize: 14, fontWeight: '700' },
  rewardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  rewardCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12
  },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  rewardTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  rewardSubtitle: {
    fontSize: 13
  },
  rewardCta: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rewardCtaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15
  },
  premiumBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center'
  },
  premiumText: {
    fontWeight: '700'
  },
});
