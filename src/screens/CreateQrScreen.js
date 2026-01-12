import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, ScrollView, ActivityIndicator, Alert, useWindowDimensions, Keyboard, Image, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { styles } from './CreateQrScreen.styles';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import ViewShot, { captureRef } from 'react-native-view-shot';
import Toast from '../components/Toast';
import { useNavigation } from '@react-navigation/native';
import { QRCodeWriter, BarcodeFormat, EncodeHintType } from '@zxing/library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useAdManager } from '../hooks/useAdManager';
import ColorPicker, { Panel1, Swatches, Preview, HueSlider } from 'reanimated-color-picker';
import { runOnJS } from 'react-native-reanimated';

const FRAME_SWATCHES = ['#0f172a', '#2563eb', '#1d4ed8', '#0f766e', '#22c55e', '#f97316', '#dc2626', '#9333ea', '#111827', '#ffffff'];

const CUSTOM_MODES = [
  { key: 'none', icon: 'qr-code-outline', labelKey: 'custom_qr_mode.none', defaultLabel: 'Klasik' },
  { key: 'logo', icon: 'image-outline', labelKey: 'custom_qr_mode.logo', defaultLabel: 'Logo Ortası' },
  { key: 'logo_frame', icon: 'albums-outline', labelKey: 'custom_qr_mode.logo_frame', defaultLabel: 'Logo + Çerçeve' },
  { key: 'frame_text', icon: 'chatbox-ellipses-outline', labelKey: 'custom_qr_mode.frame_text', defaultLabel: 'Çerçeve + Yazı' },
];
const FRAME_TEXT_MAX = 42;

export default function CreateQrScreen() {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 360 || height < 640;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isWeb = Platform.OS === 'web';
  const qrRef = useRef(null);
  const lastGeneratedRef = useRef('');

  // --- State Groups ---
  const [uiState, setUiState] = useState({
    input: '',
    matrix: null,
    error: null,
    generating: false,
    inputHeight: 44,
    toast: { visible: false, message: '', type: 'success' },
    adInfoModal: { visible: false, title: '', message: '' },
    premium: false,
    colorPickerVisible: false,
    colorPickerTarget: 'frame',
    unlockModalVisible: false,
    rewardUnlocked: false,
    customGateVisible: false,
    customGateLoading: false,
    logoBusy: false,
    missingInfoType: null,
  });

  const [wifiConfig, setWifiConfig] = useState({
    ssid: '',
    password: '',
    security: 'WPA',
    hidden: false,
  });

  const [contactInfo, setContactInfo] = useState({
    phone: '',
    email: '',
    subject: '',
    body: '',
    smsNumber: '',
    smsBody: '',
  });

  const [qrSettings, setQrSettings] = useState({
    type: 'url',
    customMode: 'none',
    customLogo: null,
    customFrameText: '',
    frameThemeColor: '#0f172a',
    tempFrameColor: '#0f172a',
    qrColor: '#000000',
    tempQrColor: '#000000',
  });

  const [unlockState, setUnlockState] = useState({
    unlockedModes: {},
    pendingCustomMode: null,
    pendingQrType: null,
  });

  // --- Helpers for State Updates ---
  const updateUi = (updates) => setUiState(prev => ({ ...prev, ...updates }));
  const updateWifi = (updates) => setWifiConfig(prev => ({ ...prev, ...updates }));
  const updateContact = (updates) => setContactInfo(prev => ({ ...prev, ...updates }));
  const updateQr = (updates) => setQrSettings(prev => ({ ...prev, ...updates }));
  const updateUnlock = (updates) => setUnlockState(prev => ({ ...prev, ...updates }));

  // --- Ad Logic (Hook) ---
  const { adLoaded, showAd, preloadAd } = useAdManager();


  // --- Derived State & Logic ---

  const missingInfoMessage = useMemo(() => {
    if (!uiState.missingInfoType) return '';
    const type = uiState.missingInfoType;
    if (type === 'wifi') return t('missing_info.wifi') || 'Please enter SSID and password if needed.';
    if (type === 'tel') return t('missing_info.tel') || 'Please enter a phone number.';
    if (type === 'email') return t('missing_info.email') || 'Please enter an email address.';
    if (type === 'sms') return t('missing_info.sms') || 'Please enter a number or message.';
    return t('missing_info.url_text') || 'Please enter some text or URL.';
  }, [uiState.missingInfoType, t]);

  const gateTitle = useMemo(() => {
    if (unlockState.pendingQrType) return t('qr_type_unlock_title') || 'Bu QR tipini açın';
    return t('custom_qr_unlock_title') || 'Özel stilleri açın';
  }, [unlockState.pendingQrType, t]);

  const gateDesc = useMemo(() => {
    if (unlockState.pendingQrType) return t('qr_type_unlock_desc') || 'Bu QR tipini kullanmak için Premium olun ya da ödüllü reklam izleyin.';
    return t('custom_qr_unlock_desc') || 'Logo ve çerçeve eklemek için Premium olun ya da ödüllü reklam izleyin.';
  }, [unlockState.pendingQrType, t]);

  const cellSize = useMemo(() => {
    if (!uiState.matrix) return 6;
    const targetPx = 320;
    const computed = Math.floor(targetPx / uiState.matrix.size);
    return Math.max(3, Math.min(6, computed));
  }, [uiState.matrix]);
  
  const qrSize = uiState.matrix ? uiState.matrix.size * cellSize : 0;

  const logoScale = useMemo(() => {
    const modules = uiState.matrix?.size || 0;
    // Reduced scales for better readability
    if (modules >= 45) return 0.20; // Was 0.30
    if (modules >= 37) return 0.24; // Was 0.36
    return 0.28; // Was 0.48
  }, [uiState.matrix]);

  const logoOverlaySize = useMemo(() => {
    const base = qrSize || 0;
    const scale = logoScale;
    // Cap max size to avoid overwhelming large QRs, allow smaller sizes
    const maxPx = 100; 
    return Math.max(24, Math.min(base * scale, maxPx));
  }, [qrSize, logoScale]);

  const showLogoControls = useMemo(() => qrSettings.customMode === 'logo' || qrSettings.customMode === 'logo_frame', [qrSettings.customMode]);
  const showFrameControls = useMemo(() => qrSettings.customMode === 'logo_frame' || qrSettings.customMode === 'frame_text', [qrSettings.customMode]);

  const frameLabelText = useMemo(() => {
    return qrSettings.customFrameText.trim() || t('custom_qr_default_label') || 'SCAN ME';
  }, [qrSettings.customFrameText, t]);

  const isModeUnlocked = useCallback((modeKey) => {
    if (modeKey === 'none') return true;
    if (uiState.premium) return true;
    return !!unlockState.unlockedModes[modeKey];
  }, [uiState.premium, unlockState.unlockedModes]);

  const customUnlockBadge = useMemo(() => {
    if (uiState.premium) {
      return { text: t('custom_qr_premium_active') || 'Premium aktif', color: '#22c55e' };
    }
    if (isModeUnlocked(qrSettings.customMode) && qrSettings.customMode !== 'none') {
      return { text: t('unlocked') || 'Açık', color: '#22c55e' };
    }
    return { text: t('locked') || 'Kilitli', color: '#f97316' };
  }, [uiState.premium, qrSettings.customMode, isModeUnlocked, t]);

  // --- Callbacks ---

  useEffect(() => {
    const checkPremium = async () => {
      try {
        const v = await AsyncStorage.getItem('premium');
        updateUi({ premium: v === 'true' });
      } catch {}
    };
    checkPremium();
    const unsubscribe = navigation.addListener('focus', checkPremium);
    return unsubscribe;
  }, [navigation]);

  const ensureCustomAccess = useCallback((modeKey) => {
    if (modeKey === 'none') return true;
    if (isModeUnlocked(modeKey)) return true;
    updateUnlock({ pendingCustomMode: modeKey });
    updateUi({ customGateVisible: true });
    return false;
  }, [isModeUnlocked]);

  const handleCustomModePress = useCallback((modeKey) => {
    if (modeKey === 'none') {
      updateQr({ customMode: 'none' });
      return;
    }
    if (uiState.premium || isModeUnlocked(modeKey)) {
      updateQr({ customMode: modeKey });
      return;
    }
    updateUnlock({ pendingCustomMode: modeKey });
    updateUi({ customGateVisible: true });
  }, [uiState.premium, isModeUnlocked]);

  const ensureTypeAccess = useCallback((typeKey) => {
    const needsUnlock = ['wifi', 'tel', 'email', 'sms'].includes(typeKey);
    if (!needsUnlock) return true;
    if (uiState.premium || unlockState.unlockedModes[typeKey]) return true;
    updateUnlock({ pendingQrType: typeKey });
    updateUi({ customGateVisible: true });
    return false;
  }, [uiState.premium, unlockState.unlockedModes]);

  const handleQrTypePress = useCallback((typeKey) => {
    if (!ensureTypeAccess(typeKey)) return;
    updateQr({ type: typeKey });
    updateUnlock({ pendingQrType: null });
  }, [ensureTypeAccess]);

  const closeCustomGate = useCallback(() => {
    updateUi({ customGateVisible: false, rewardUnlocked: false, unlockModalVisible: false });
    updateUnlock({ pendingCustomMode: null, pendingQrType: null });
  }, []);

  const handleWatchAdUnlock = useCallback(async () => {
    if (uiState.customGateLoading) return;
    
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      updateUi({
        adInfoModal: {
          visible: true,
          title: t('ads.modal.title') || 'Reklam',
          message: t('ads.modal.offline') || 'İnternet bağlantısı yok. Reklamı yüklemek için internete bağlanın.'
        }
      });
      return;
    }

    updateUi({ customGateLoading: true });
    
    // Use preloaded ad
    const res = await showAd();
    
    updateUi({ customGateLoading: false });

    if (res.ok) {
      setUnlockState((prev) => {
        const next = { ...prev.unlockedModes };
        if (prev.pendingCustomMode && prev.pendingCustomMode !== 'none') next[prev.pendingCustomMode] = true;
        if (prev.pendingQrType) next[prev.pendingQrType] = true;
        return { ...prev, unlockedModes: next };
      });

      if (unlockState.pendingCustomMode && unlockState.pendingCustomMode !== 'qr_color') updateQr({ customMode: unlockState.pendingCustomMode });
      if (unlockState.pendingQrType) updateQr({ type: unlockState.pendingQrType });
      
      closeCustomGate();
      updateUi({ toast: { visible: true, type: 'success', message: t('custom_qr_unlocked') || 'Bu seçenek açıldı!' } });
    } else {
        // Error handling
        const error = res.error;
        const isNotReady = error === 'not_ready';
        const title = t('ads.modal.title') || 'Reklam';
        const message = isNotReady
           ? (t('ads.modal.notReady') || 'Reklam şu anda hazır değil. Lütfen biraz bekleyin ve tekrar deneyin.')
           : (t('ads.modal.generic') || 'Bir sorun oluştu. Lütfen tekrar deneyin.');
        
        updateUi({ adInfoModal: { visible: true, title, message } });
    }
  }, [uiState.customGateLoading, unlockState.pendingCustomMode, unlockState.pendingQrType, closeCustomGate, t, showAd]);

  const onColorChange = useCallback((hex) => {
    if (uiState.colorPickerTarget === 'qr') {
      updateQr({ tempQrColor: hex });
    } else {
      updateQr({ tempFrameColor: hex });
    }
  }, [uiState.colorPickerTarget]);

  const pickCustomLogo = useCallback(async () => {
    if (uiState.logoBusy) return;
    if (!ensureCustomAccess(qrSettings.customMode === 'none' ? 'logo' : qrSettings.customMode)) return;

    updateUi({ logoBusy: true });
    try {
      if (Platform.OS === 'android' && Platform.Version < 33) {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
           Alert.alert(t('permission_required_media') || 'Medya izni gerekli');
           return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        updateQr({ customLogo: result.assets[0].uri });
        if (qrSettings.customMode === 'none') updateQr({ customMode: 'logo' });
      }
    } catch (e) {
      updateUi({ toast: { visible: true, type: 'error', message: t('errors.imagePickFailed') || 'Görsel seçilemedi.' } });
    } finally {
      updateUi({ logoBusy: false });
    }
  }, [uiState.logoBusy, ensureCustomAccess, qrSettings.customMode, t]);

  const generateMatrix = useCallback(async (text) => {
    try {
      if (!text || !text.trim()) {
        updateUi({ matrix: null, error: null });
        return;
      }
      updateUi({ generating: true, error: null });
      await new Promise(r => setTimeout(r, 0));

      const writer = new QRCodeWriter();
      const hints = new Map();
      const quietZone = showFrameControls ? 6 : 4;
      hints.set(EncodeHintType.MARGIN, quietZone);
      hints.set(EncodeHintType.ERROR_CORRECTION, 'H');
      
      const targetSize = showFrameControls ? 58 : 54;
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
      updateUi({ matrix: { rows, size: width }, error: null });
    } catch (e) {
      updateUi({ matrix: null, error: t('qr_generation_error') || 'QR kod oluşturulamadı.' });
    } finally {
      updateUi({ generating: false });
    }
  }, [t, showFrameControls]);

  const buildPayload = useCallback(() => {
    const type = qrSettings.type;
    if (type === 'url' || type === 'text') return (uiState.input || '').trim();
    
    if (type === 'wifi') {
      const esc = (s) => (s || '').replace(/([\\;,:])/g, '\\$1');
      const t = wifiConfig.security === 'nopass' ? 'nopass' : (wifiConfig.security === 'WEP' ? 'WEP' : 'WPA');
      const parts = [`T:${t}`, `S:${esc(wifiConfig.ssid)}`];
      if (t !== 'nopass') parts.push(`P:${esc(wifiConfig.password)}`);
      if (wifiConfig.hidden) parts.push('H:true');
      return 'WIFI:' + parts.join(';') + ';';
    }
    
    if (type === 'tel') {
      const n = (contactInfo.phone || '').trim();
      return n ? `tel:${n}` : '';
    }
    
    if (type === 'email') {
      const to = (contactInfo.email || '').trim();
      const q = [];
      if (contactInfo.subject) q.push(`subject=${encodeURIComponent(contactInfo.subject)}`);
      if (contactInfo.body) q.push(`body=${encodeURIComponent(contactInfo.body)}`);
      const query = q.length ? `?${q.join('&')}` : '';
      return to ? `mailto:${to}${query}` : '';
    }
    
    if (type === 'sms') {
      const n = (contactInfo.smsNumber || '').trim();
      const b = (contactInfo.smsBody || '').trim();
      if (!n && !b) return '';
      return b ? `SMSTO:${n}:${b}` : `SMSTO:${n}`;
    }
    
    return '';
  }, [qrSettings.type, uiState.input, wifiConfig, contactInfo]);

  const payloadLength = useMemo(() => (buildPayload() || '').length, [buildPayload]);

  const canGenerate = () => {
    const type = qrSettings.type;
    if (type === 'wifi') {
      if (!wifiConfig.ssid.trim()) return false;
      if (wifiConfig.security !== 'nopass' && !wifiConfig.password.trim()) return false;
      return true;
    }
    if (type === 'tel') return !!contactInfo.phone.trim();
    if (type === 'email') return !!contactInfo.email.trim();
    if (type === 'sms') return !!contactInfo.smsNumber.trim() || !!contactInfo.smsBody.trim();
    return !!(uiState.input || '').trim();
  };

  const onGenerate = async () => {
    if (!canGenerate()) {
      updateUi({ missingInfoType: qrSettings.type });
      return;
    }
    const payload = buildPayload();
    if (!payload) { updateUi({ matrix: null, error: null }); return; }
    if (payload === lastGeneratedRef.current && uiState.matrix) return;
    
    lastGeneratedRef.current = payload;
    Keyboard.dismiss();
    await generateMatrix(payload);
  };

  const getFilename = () => {
    const now = new Date();
    const ts = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    return `Secure_QR_${ts}.png`;
  };

  const buildCanvasDataUrl = () => {
    if (!uiState.matrix || !isWeb) return null;
    const size = uiState.matrix.size * cellSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = qrSettings.qrColor;
    for (let y = 0; y < uiState.matrix.size; y++) {
      for (let x = 0; x < uiState.matrix.size; x++) {
        if (uiState.matrix.rows[y][x]) ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
    return canvas.toDataURL('image/png');
  };

  const onDownload = async () => {
    if (!uiState.matrix) return;
    try {
      const filename = getFilename();
      if (isWeb) {
        const url = buildCanvasDataUrl();
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        updateUi({ toast: { visible: true, message: t('saved_to_gallery'), type: 'success' } });
      } else {
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t('permission_required_media') || 'Medya izni gerekli');
          return;
        }
        const uri = await captureRef(qrRef, { format: 'png', quality: 1, result: 'tmpfile' });
        if (!uri) throw new Error('capture_failed');
        await MediaLibrary.saveToLibraryAsync(uri);
        updateUi({ toast: { visible: true, message: t('saved_to_gallery'), type: 'success' } });
      }
    } catch (e) {
      Alert.alert(t('qr_generation_error') || 'Hata');
    }
  };

  const onShare = async () => {
    try {
      const filename = getFilename();
      if (isWeb) {
        const url = buildCanvasDataUrl();
        if (!url) return;
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'QR Code', text: buildPayload() });
        } else {
          window.open(url, '_blank');
        }
      } else {
        const uri = await captureRef(qrRef, { format: 'png', quality: 1, result: 'tmpfile' });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('share') });
        } else {
          Alert.alert(t('share_unavailable') || 'Paylaşım desteklenmiyor');
        }
      }
    } catch (e) {
      updateUi({ toast: { visible: true, message: t('share_unavailable'), type: 'error' } });
    }
  };

  // --- Dynamic Styles ---
  const containerStyle = [styles.container, { backgroundColor: dark ? '#0b0f14' : '#e9edf3' }];
  const contentStyle = [styles.contentContainer, compact ? { padding: 12, paddingBottom: 24 } : null];
  const heroCardStyle = [styles.heroCard, {
    backgroundColor: dark ? '#0d1523' : '#ffffff',
    borderColor: dark ? '#1f2937' : '#dbe2ea',
    shadowColor: dark ? '#0b1220' : '#4a9eff',
  }];
  const inputStyle = [styles.input, {
    backgroundColor: dark ? '#0d1523' : '#ffffff',
    color: dark ? '#e6edf3' : '#0b1220',
    borderColor: uiState.error ? (dark ? '#ff6b6b' : '#dc2626') : (dark ? '#1b2330' : '#dde3ea'),
    height: uiState.inputHeight
  }];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={containerStyle} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={heroCardStyle}>
          <View style={[styles.heroIconWrap, { backgroundColor: dark ? 'rgba(74,158,255,0.08)' : 'rgba(0,102,204,0.08)', borderColor: dark ? '#243044' : '#dbe2ea' }]}>
            <Ionicons name="qr-code" size={compact ? 30 : 34} color={dark ? '#4a9eff' : '#0066cc'} />
          </View>
          <Text style={[styles.heroTitle, compact ? { fontSize: 22 } : null, { color: dark ? '#e6edf3' : '#0b1220' }]}>
            {t('qr_generator_title') || 'QR Kod Oluşturucu'}
          </Text>
          <Text style={[styles.heroSubtitle, { color: dark ? '#94a3b8' : '#4b5563' }]}>
            {t('qr_generator_subtitle') || 'Bağlantı, Wi‑Fi, metin ve daha fazlası için zahmetsiz QR kodları oluşturun.'}
          </Text>
          <View style={[styles.heroBadge, { backgroundColor: dark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.08)', borderColor: dark ? 'rgba(37,99,235,0.35)' : 'rgba(37,99,235,0.45)' }]}>
            <Ionicons name="sparkles" size={14} color={dark ? '#93c5fd' : '#2563eb'} />
            <Text style={[styles.heroBadgeText, { color: dark ? '#cbd5f5' : '#1d4ed8' }]}>{t('qr_generator_badge') || 'Modern & hızlı'}</Text>
          </View>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <View style={[styles.typeCard, { backgroundColor: dark ? '#0d1523' : '#ffffff', borderColor: dark ? '#1f2937' : '#dbe2ea', shadowColor: dark ? '#0b1220' : '#4a9eff' }]}>
            <View style={{ marginBottom: 8 }}>
              <Text style={[styles.customTitle, { color: dark ? '#b1bac4' : '#4a5568', fontSize: 16 }]}>{t('input_label') || 'İçerik Türü'}</Text>
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
                const active = qrSettings.type === opt.k;
                return (
                  <TouchableOpacity
                    key={opt.k}
                    onPress={() => handleQrTypePress(opt.k)}
                    style={[styles.typeChip, { backgroundColor: dark ? '#0f172a' : '#f7f9fb', borderColor: dark ? '#243044' : '#dbe2ea' }, active ? styles.typeChipActive : null]}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.typeIconWrap, { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderColor: dark ? '#243044' : '#e5eaf1' }, active ? styles.typeIconWrapActive : null]}>
                      <Ionicons name={opt.icon} size={18} color={active ? '#fff' : (dark ? '#c3dafe' : '#2563eb')} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Text style={[styles.typeChipText, { color: active ? '#fff' : (dark ? '#8b98a5' : '#0b1220') }]}>{opt.label}</Text>
                      {['wifi', 'tel', 'email', 'sms'].includes(opt.k) && !uiState.premium && !unlockState.unlockedModes[opt.k] && (
                        <Ionicons name="lock-closed" size={14} color={active ? '#fff' : '#f97316'} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={{ height: 10 }} />

          {/* Inputs based on type */}
          {(qrSettings.type === 'url' || qrSettings.type === 'text') && (
            <View style={styles.inputWrapper}>
              <TextInput
                style={inputStyle}
                placeholder={t('input_placeholder') || (qrSettings.type === 'url' ? 'URL girin...' : 'Metin girin...')}
                placeholderTextColor={dark ? '#8b98a5' : '#7a8699'}
                value={uiState.input}
                onChangeText={(t) => updateUi({ input: t })}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                numberOfLines={1}
                textAlignVertical="top"
                scrollEnabled={false}
                onContentSizeChange={(e) => updateUi({ inputHeight: Math.max(44, Math.min(e.nativeEvent.contentSize.height, 160)) })}
              />
              {uiState.input.length > 0 && (
                <TouchableOpacity
                  style={[styles.clearButton, { backgroundColor: dark ? '#172031' : '#f0f4f8', borderColor: dark ? '#243044' : '#dbe2ea' }]}
                  onPress={() => updateUi({ input: '', matrix: null, error: null, inputHeight: 44 })}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={18} color={dark ? '#8b98a5' : '#7a8699'} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {qrSettings.type === 'wifi' && (
            <View style={{ gap: 10 }}>
              <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('wifi.ssid') || 'SSID'}</Text>
              <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]} value={wifiConfig.ssid} onChangeText={(t) => updateWifi({ ssid: t })} autoCapitalize="none" autoCorrect={false} />
              <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('wifi.security') || 'Güvenlik'}</Text>
              <View style={styles.segmented}>
                {[{ k: 'WPA', label: 'WPA/WPA2' }, { k: 'WEP', label: 'WEP' }, { k: 'nopass', label: 'Yok' }].map(opt => (
                  <TouchableOpacity key={opt.k} onPress={() => updateWifi({ security: opt.k })} style={[styles.segBtn, { borderColor: dark ? '#243044' : '#dbe2ea', backgroundColor: dark ? '#172031' : '#f0f4f8' }, wifiConfig.security === opt.k ? styles.segBtnActive : null]}>
                    <Text style={[styles.segText, { color: dark ? '#8b98a5' : '#0b1220' }, wifiConfig.security === opt.k ? { color: '#fff' } : null]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {wifiConfig.security !== 'nopass' && (
                <>
                  <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('wifi.password') || 'Şifre'}</Text>
                  <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]} value={wifiConfig.password} onChangeText={(t) => updateWifi({ password: t })} autoCapitalize="none" autoCorrect={false} secureTextEntry />
                </>
              )}
              <View style={styles.toggleRow}>
                <TouchableOpacity onPress={() => updateWifi({ hidden: !wifiConfig.hidden })} style={[styles.typeChip, { backgroundColor: dark ? '#172031' : '#f0f4f8', borderColor: dark ? '#243044' : '#dbe2ea' }, wifiConfig.hidden ? styles.typeChipActive : null]}>
                  <Text style={[styles.typeChipText, { color: dark ? '#8b98a5' : '#0b1220' }, wifiConfig.hidden ? { color: '#fff' } : null]}>{t('wifi.hiddenNetwork') || 'Gizli Ağ'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {qrSettings.type === 'tel' && (
            <View style={{ gap: 10 }}>
              <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('tel.number') || 'Telefon Numarası'}</Text>
              <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]} value={contactInfo.phone} onChangeText={(t) => updateContact({ phone: t })} keyboardType="phone-pad" />
            </View>
          )}

          {qrSettings.type === 'email' && (
             <View style={{ gap: 10 }}>
               <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('email.address') || 'E‑posta Adresi'}</Text>
               <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]} value={contactInfo.email} onChangeText={(t) => updateContact({ email: t })} keyboardType="email-address" autoCapitalize="none" />
               <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('email.subject') || 'Konu'}</Text>
               <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]} value={contactInfo.subject} onChangeText={(t) => updateContact({ subject: t })} />
               <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('email.body') || 'İçerik'}</Text>
               <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea', minHeight: 80, paddingVertical: 10 }]} value={contactInfo.body} onChangeText={(t) => updateContact({ body: t })} multiline numberOfLines={3} />
             </View>
          )}

          {qrSettings.type === 'sms' && (
             <View style={{ gap: 10 }}>
               <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('sms.number') || 'Telefon Numarası'}</Text>
               <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]} value={contactInfo.smsNumber} onChangeText={(t) => updateContact({ smsNumber: t })} keyboardType="phone-pad" />
               <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('sms.body') || 'Mesaj'}</Text>
               <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#0d1523' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea', minHeight: 80, paddingVertical: 10 }]} value={contactInfo.smsBody} onChangeText={(t) => updateContact({ smsBody: t })} multiline numberOfLines={3} />
             </View>
          )}

          {/* Customization */}
          <View style={[styles.customSection, { backgroundColor: dark ? '#0d1523' : '#ffffff', borderColor: dark ? '#1f2937' : '#dbe2ea' }]}>
            <View style={styles.customHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.customTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('custom_qr_title') || 'Özel QR Stilleri'}</Text>
                <Text style={[styles.customSubtitle, { color: dark ? '#8b98a5' : '#64748b' }]}>{t('custom_qr_subtitle') || 'Logo, çerçeve ve yazı ekleyerek öne çıkın'}</Text>
              </View>
              {qrSettings.customMode !== 'none' && (
                <View style={[styles.customBadge, { borderColor: customUnlockBadge.color, backgroundColor: customUnlockBadge.color === '#f97316' ? 'rgba(249,115,22,0.15)' : 'rgba(34,197,94,0.18)' }]}>
                  <Ionicons name={(uiState.premium || isModeUnlocked(qrSettings.customMode)) ? 'shield-checkmark' : 'lock-closed'} size={16} color={customUnlockBadge.color} />
                  <Text style={[styles.customBadgeText, { color: customUnlockBadge.color }]}>{customUnlockBadge.text}</Text>
                </View>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.customModesRow}>
              {CUSTOM_MODES.map((mode, index) => {
                const active = qrSettings.customMode === mode.key;
                const locked = mode.key !== 'none' && !isModeUnlocked(mode.key);
                return (
                  <TouchableOpacity
                    key={mode.key}
                    onPress={() => handleCustomModePress(mode.key)}
                    activeOpacity={0.85}
                    style={[styles.customModeChip, { backgroundColor: dark ? '#111827' : '#f8fafc', borderColor: dark ? '#1f2937' : '#e2e8f0' }, active ? styles.customModeChipActive : null, locked ? { opacity: 0.65 } : null]}
                  >
                    <Ionicons name={mode.icon} size={18} color={active ? '#fff' : (dark ? '#94a3b8' : '#475569')} />
                    <Text style={[styles.customModeText, { color: active ? '#fff' : (dark ? '#cbd5f5' : '#0f172a') }]}>{t(mode.labelKey) || mode.defaultLabel}</Text>
                    {locked && <Ionicons name="lock-closed" size={14} color={active ? '#fff' : '#f97316'} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 0, paddingHorizontal: 4 }}>
              <TouchableOpacity
                onPress={() => {
                  if (!isModeUnlocked('qr_color')) {
                    updateUnlock({ pendingCustomMode: 'qr_color' });
                    updateUi({ customGateVisible: true });
                    return;
                  }
                  updateQr({ tempQrColor: qrSettings.qrColor });
                  updateUi({ colorPickerVisible: true, colorPickerTarget: 'qr' });
                }}
                activeOpacity={0.85}
                style={[styles.customModeChip, { backgroundColor: dark ? '#111827' : '#f8fafc', borderColor: dark ? '#1f2937' : '#e2e8f0', flex: 1, justifyContent: 'center' }, !isModeUnlocked('qr_color') ? { opacity: 0.65 } : null]}
              >
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: qrSettings.qrColor, borderWidth: 1, borderColor: dark ? '#374151' : '#cbd5f5' }} />
                <Text style={[styles.customModeText, { color: dark ? '#cbd5f5' : '#0f172a' }]}>{t('custom_qr_dot_color') || 'Nokta Rengi'}</Text>
                {!isModeUnlocked('qr_color') && <Ionicons name="lock-closed" size={14} color="#f97316" />}
              </TouchableOpacity>

              {showFrameControls && (
                <TouchableOpacity
                  onPress={() => {
                    updateQr({ tempFrameColor: qrSettings.frameThemeColor });
                    updateUi({ colorPickerVisible: true, colorPickerTarget: 'frame' });
                  }}
                  activeOpacity={0.85}
                  style={[styles.customModeChip, { backgroundColor: dark ? '#111827' : '#f8fafc', borderColor: dark ? '#1f2937' : '#e2e8f0', flex: 1, justifyContent: 'center' }]}
                >
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: qrSettings.frameThemeColor, borderWidth: 1, borderColor: dark ? '#374151' : '#cbd5f5' }} />
                  <Text style={[styles.customModeText, { color: dark ? '#cbd5f5' : '#0f172a' }]}>{t('custom_qr_frame_color') || 'Çerçeve Rengi'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {showLogoControls && (
              <View style={[styles.logoCard, { borderColor: dark ? '#1f2937' : '#dbe2ea', backgroundColor: dark ? '#0d1523' : '#ffffff' }]}>
                <View style={styles.logoPreview}>
                  {qrSettings.customLogo ? (
                    <Image source={{ uri: qrSettings.customLogo }} style={styles.logoImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.logoPlaceholder, { borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
                      <Ionicons name="image-outline" size={26} color={dark ? '#94a3b8' : '#94a3b8'} />
                      <Text style={{ color: dark ? '#94a3b8' : '#475569', fontSize: 12, marginTop: 4 }}>{t('custom_qr_logo_hint') || 'Galeriden logo seçin'}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <TouchableOpacity style={[styles.logoActionBtn, { backgroundColor: '#2563eb' }]} onPress={pickCustomLogo} disabled={uiState.logoBusy}>
                    {uiState.logoBusy ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="cloud-upload-outline" size={18} color="#fff" /><Text style={styles.logoActionText}>{qrSettings.customLogo ? (t('custom_qr_change_logo') || 'Logoyu değiştir') : (t('custom_qr_add_logo') || 'Logo ekle')}</Text></>}
                  </TouchableOpacity>
                  {qrSettings.customLogo && (
                    <TouchableOpacity style={[styles.logoActionBtnSecondary, { borderColor: dark ? '#374151' : '#cbd5f5' }]} onPress={() => updateQr({ customLogo: null })}>
                      <Ionicons name="trash-outline" size={18} color={dark ? '#f87171' : '#dc2626'} />
                      <Text style={[styles.logoActionTextSecondary, { color: dark ? '#f87171' : '#dc2626' }]}>{t('custom_qr_remove_logo') || 'Logoyu kaldır'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {showFrameControls && (
              <View style={[styles.frameCard, { borderColor: dark ? '#1f2937' : '#dbe2ea', backgroundColor: dark ? '#0d1523' : '#ffffff' }]}>
                <Text style={[styles.frameLabelTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('custom_qr_frame_text') || 'Çerçeve Yazısı'}</Text>
                <TextInput
                  style={[styles.frameInput, { backgroundColor: dark ? '#0b1220' : '#fff', borderColor: dark ? '#1f2937' : '#d1d5db', color: dark ? '#e6edf3' : '#0b1220' }]}
                  placeholder={t('custom_qr_frame_placeholder') || 'SCAN ME'}
                  placeholderTextColor={dark ? '#4b5563' : '#94a3b8'}
                  value={qrSettings.customFrameText}
                  onChangeText={(t) => updateQr({ customFrameText: t.slice(0, FRAME_TEXT_MAX) })}
                  maxLength={FRAME_TEXT_MAX}
                />
                <Text style={[styles.frameCounter, { color: dark ? '#8b98a5' : '#475569' }]}>{(qrSettings.customFrameText || '').length}/{FRAME_TEXT_MAX}</Text>
              </View>
            )}

            {!uiState.premium && qrSettings.customMode !== 'none' && !isModeUnlocked(qrSettings.customMode) && (
              <Text style={[styles.customHint, { color: dark ? '#94a3b8' : '#475569' }]}>{t('custom_qr_locked_hint') || 'Premium üye olun ya da bu seçenek için ödüllü reklam izleyin.'}</Text>
            )}
          </View>

          <Text style={[styles.charCount, compact ? { fontSize: 11 } : null, { color: dark ? '#8b98a5' : '#7a8699' }]}>{payloadLength} {t('characters') || 'karakter'}</Text>
          <View style={[styles.generateRow, compact ? { marginTop: 8 } : null]}>
            <TouchableOpacity style={[styles.generateBtn, !canGenerate() ? { opacity: 0.7 } : null]} onPress={onGenerate} disabled={uiState.generating} activeOpacity={0.85}>
              <Ionicons name="flash-outline" size={20} color="#fff" />
              <Text style={styles.generateText}>{t('actions.generate') || 'QR Oluştur'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {uiState.error && (
          <View style={[styles.errorContainer, { backgroundColor: dark ? '#2d1515' : '#fee' }]}>
            <Ionicons name="alert-circle" size={20} color={dark ? '#ff6b6b' : '#dc2626'} />
            <Text style={[styles.errorText, { color: dark ? '#ff6b6b' : '#dc2626' }]}>{uiState.error}</Text>
          </View>
        )}

        {uiState.generating && (
          <View style={[styles.loadingContainer, compact ? { paddingVertical: 24 } : null]}>
            <ActivityIndicator size="large" color={dark ? '#4a9eff' : '#0066cc'} />
            <Text style={[styles.loadingText, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('generating') || 'Oluşturuluyor...'}</Text>
          </View>
        )}

        {uiState.matrix && !uiState.generating && (
          <View style={[styles.qrSection, compact ? { gap: 12, marginVertical: 12 } : null]}>
            <ViewShot ref={qrRef} options={{ format: 'png', quality: 1 }}>
              <View style={[styles.qrContainer, { backgroundColor: showFrameControls ? qrSettings.frameThemeColor : (dark ? '#1b2330' : '#fff') }]}>
                <View style={[styles.qrPreview, showFrameControls ? styles.qrPreviewFramed : null]}>
                  <View style={[styles.qrWrap, { width: qrSize, height: qrSize }, showFrameControls ? styles.qrWrapElevated : null]}>
                    {uiState.matrix.rows.map((row, y) => (
                      <View key={y} style={{ flexDirection: 'row' }}>
                        {row.map((on, x) => (
                          <View key={x} style={{ width: cellSize, height: cellSize, backgroundColor: on ? qrSettings.qrColor : '#fff' }} />
                        ))}
                      </View>
                    ))}
                    {showLogoControls && qrSettings.customLogo ? (
                      <View style={[styles.logoOverlay, { width: logoOverlaySize, height: logoOverlaySize, marginLeft: -(logoOverlaySize / 2), marginTop: -(logoOverlaySize / 2), borderRadius: logoOverlaySize / 4, overflow: 'hidden' }]}>
                        <Image source={{ uri: qrSettings.customLogo }} style={styles.logoOverlayImage} />
                      </View>
                    ) : null}
                  </View>
                  {showFrameControls && (
                    <View style={[styles.frameLabelBlock, { backgroundColor: qrSettings.frameThemeColor, borderColor: qrSettings.frameThemeColor.toLowerCase() === '#ffffff' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.9)' }]}>
                      <Text style={[styles.frameLabelText, { color: qrSettings.frameThemeColor.toLowerCase() === '#ffffff' ? '#0b1220' : '#fff' }]}>{frameLabelText}</Text>
                    </View>
                  )}
                </View>
              </View>
            </ViewShot>
            <View style={[styles.actionButtons, compact ? { gap: 8 } : null]}>
              <TouchableOpacity style={[styles.actionButton, compact ? { paddingVertical: 10 } : null, { backgroundColor: dark ? '#1b2330' : '#fff' }]} onPress={onDownload}>
                <Ionicons name="download-outline" size={20} color={dark ? '#4a9eff' : '#0066cc'} />
                <Text style={[styles.actionButtonText, compact ? { fontSize: 14 } : null, { color: dark ? '#4a9eff' : '#0066cc' }]}>{t('download') || 'İndir'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, compact ? { paddingVertical: 10 } : null, { backgroundColor: dark ? '#1b2330' : '#fff' }]} onPress={onShare}>
                <Ionicons name="share-outline" size={20} color={dark ? '#4a9eff' : '#0066cc'} />
                <Text style={[styles.actionButtonText, compact ? { fontSize: 14 } : null, { color: dark ? '#4a9eff' : '#0066cc' }]}>{t('share') || 'Paylaş'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!uiState.matrix && !uiState.generating && !uiState.error && (
          <View style={[styles.placeholder, { backgroundColor: dark ? '#0d1523' : '#ffffff', borderColor: dark ? '#1b2330' : '#dde3ea' }, compact ? { padding: 24 } : null]}>
            <View style={[styles.placeholderIcon, { backgroundColor: dark ? '#1b2330' : '#f0f4f8' }]}>
              <Ionicons name="qr-code-outline" size={compact ? 52 : 64} color={dark ? '#4a5568' : '#94a3b8'} />
            </View>
            <Text style={[styles.placeholderTitle, compact ? { fontSize: 16 } : null, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('placeholder_title') || 'QR Kod Oluşturun'}</Text>
            <Text style={[styles.placeholderText, { color: dark ? '#8b98a5' : '#7a8699' }]}>{t('placeholder_text') || 'Yukarıdaki alana metin veya URL girin, QR kodunuz otomatik olarak oluşturulacak'}</Text>
          </View>
        )}

        <View style={[styles.infoSection, { backgroundColor: dark ? '#0d1523' : '#ffffff', borderColor: dark ? '#1f2937' : '#dbe2ea' }]}>
          <Text style={[styles.infoTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}><Ionicons name="information-circle" size={16} /> {t('info_title') || 'Bilgi'}</Text>
          <Text style={[styles.infoText, { color: dark ? '#8b98a5' : '#7a8699' }]}>{t('info_text') || 'QR kodları URL, metin, telefon numarası, e-posta adresi ve daha fazlasını içerebilir. Maksimum 2.953 karakter desteklenir.'}</Text>
        </View>
      </ScrollView>

      <Toast visible={uiState.toast.visible} message={uiState.toast.message} type={uiState.toast.type} dark={dark} onHide={() => updateUi({ toast: { ...uiState.toast, visible: false } })} style={{ bottom: Math.max(insets.bottom + 32, 32) }} />

      {/* Color Picker Modal */}
      <Modal visible={uiState.colorPickerVisible} transparent animationType="fade" onRequestClose={() => updateUi({ colorPickerVisible: false })}>
        <View style={styles.colorModalOverlay}>
          <View style={[styles.colorModalCard, { backgroundColor: dark ? '#0b1120' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
            <Text style={[styles.colorModalTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
              {uiState.colorPickerTarget === 'qr' ? (t('custom_qr_dot_color') || 'Nokta Rengi') : (t('custom_qr_color_pick') || 'Tema rengi seç')}
            </Text>
            
            <View style={{ height: 260, width: '100%', marginVertical: 8 }}>
              <ColorPicker 
                style={{ flex: 1 }} 
                value={uiState.colorPickerTarget === 'qr' ? qrSettings.tempQrColor : qrSettings.tempFrameColor} 
                onComplete={({ hex }) => {
                  'worklet';
                  runOnJS(onColorChange)(hex);
                }}
              >
                <Preview 
                  hideInitialColor 
                  textStyle={{ color: dark ? '#fff' : '#000', fontSize: 16, fontWeight: 'bold' }} 
                />
                <Panel1 style={{ marginTop: 12, borderRadius: 12 }} />
                <HueSlider style={{ marginTop: 12, borderRadius: 12, height: 24 }} />
              </ColorPicker>
            </View>

            <View style={styles.colorModalActions}>
              <TouchableOpacity style={[styles.colorBtn, { backgroundColor: dark ? '#1f2937' : '#e5e7eb' }]} onPress={() => updateUi({ colorPickerVisible: false })} activeOpacity={0.85}>
                <Text style={[styles.colorBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('common.cancel') || 'İptal'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.colorBtn, { backgroundColor: '#2563eb' }]} onPress={() => { 
                if (uiState.colorPickerTarget === 'qr') {
                  updateQr({ qrColor: qrSettings.tempQrColor });
                } else {
                  updateQr({ frameThemeColor: qrSettings.tempFrameColor });
                }
                updateUi({ colorPickerVisible: false }); 
              }} activeOpacity={0.9}>
                <Text style={[styles.colorBtnText, { color: '#fff' }]}>{t('common.select') || 'Seç'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Unlock Success Modal */}
      <Modal visible={uiState.unlockModalVisible} animationType="fade" transparent onRequestClose={closeCustomGate}>
        <View style={styles.rewardOverlay}>
          <View style={[styles.rewardCard, { backgroundColor: dark ? '#0b1120' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Ionicons name="checkmark-circle" size={22} color={dark ? '#22c55e' : '#15803d'} />
              <Text style={[styles.rewardTitle, { color: dark ? '#e6edf3' : '#0f172a' }]}>{t('reward.unlocked_title') || 'Kilit açıldı'}</Text>
            </View>
            <Text style={[styles.rewardSubtitle, { color: dark ? '#94a3b8' : '#475569', marginBottom: 14 }]}>{t('reward.unlocked_desc') || 'Özel stiller artık kullanılabilir.'}</Text>
            <TouchableOpacity style={[styles.rewardCta, { backgroundColor: '#22c55e', shadowColor: 'transparent', borderRadius: 12 }]} onPress={closeCustomGate} activeOpacity={0.9}>
              <Text style={styles.rewardCtaText}>{t('actions.ok') || 'Tamam'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Missing Info Modal */}
      <Modal visible={!!uiState.missingInfoType} animationType="fade" transparent onRequestClose={() => updateUi({ missingInfoType: null })}>
        <View style={styles.rewardOverlay}>
          <View style={[styles.rewardCard, { backgroundColor: dark ? '#0b1120' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Ionicons name="alert-circle" size={22} color={dark ? '#facc15' : '#d97706'} />
              <Text style={[styles.rewardTitle, { color: dark ? '#e6edf3' : '#0f172a' }]}>{t('missing_info.title') || 'Eksik bilgi'}</Text>
            </View>
            <Text style={[styles.rewardSubtitle, { color: dark ? '#94a3b8' : '#475569' }]}>{missingInfoMessage}</Text>
            <TouchableOpacity style={[styles.rewardCta, { backgroundColor: '#2563eb', marginTop: 14 }]} onPress={() => updateUi({ missingInfoType: null })} activeOpacity={0.9}>
              <Text style={styles.rewardCtaText}>{t('actions.ok') || 'Tamam'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Ad Info/Error Modal */}
      <Modal visible={uiState.adInfoModal.visible} animationType="fade" transparent onRequestClose={() => updateUi({ adInfoModal: { ...uiState.adInfoModal, visible: false } })}>
        <View style={styles.rewardOverlay}>
          <View style={[styles.rewardCard, { backgroundColor: dark ? '#0b1120' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Ionicons name="alert-circle" size={22} color={dark ? '#facc15' : '#d97706'} />
              <Text style={[styles.rewardTitle, { color: dark ? '#e6edf3' : '#0f172a' }]}>{uiState.adInfoModal.title}</Text>
            </View>
            <Text style={[styles.rewardSubtitle, { color: dark ? '#94a3b8' : '#475569' }]}>{uiState.adInfoModal.message}</Text>
            <TouchableOpacity style={[styles.rewardCta, { backgroundColor: '#2563eb', marginTop: 14 }]} onPress={() => updateUi({ adInfoModal: { ...uiState.adInfoModal, visible: false } })} activeOpacity={0.9}>
              <Text style={styles.rewardCtaText}>{t('actions.ok') || 'Tamam'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Feature Gate Modal */}
      <Modal visible={uiState.customGateVisible} animationType="fade" transparent onRequestClose={closeCustomGate}>
        <View style={styles.rewardOverlay}>
          <View style={[styles.rewardCard, { backgroundColor: dark ? '#0b1120' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
            <TouchableOpacity onPress={closeCustomGate} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }} style={{ position: 'absolute', top: 10, right: 10, padding: 4 }} activeOpacity={0.8}>
              <Ionicons name="close-circle" size={22} color={dark ? '#94a3b8' : '#94a3b8'} />
            </TouchableOpacity>
            <View style={styles.rewardHeader}>
              <Ionicons name="sparkles" size={22} color={dark ? '#facc15' : '#f59e0b'} />
              <Text style={[styles.rewardTitle, { color: dark ? '#e6edf3' : '#0f172a' }]}>{gateTitle}</Text>
            </View>
            <Text style={[styles.rewardSubtitle, { color: dark ? '#94a3b8' : '#475569' }]}>{gateDesc}</Text>
            
            <TouchableOpacity
              style={[styles.premiumBtn, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderColor: 'rgba(236,72,153,0.7)', backgroundColor: 'rgba(236,72,153,0.26)', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 2 }]}
              onPress={() => {
                if (Platform.OS === 'ios') {
                  closeCustomGate();
                  setTimeout(() => { updateUi({ adInfoModal: { visible: true, title: t('premium.inactive.title'), message: t('premium.inactive.message') } }); }, 300);
                } else {
                  closeCustomGate();
                  navigation.navigate('Paywall');
                }
              }}
              activeOpacity={0.9}
            >
              <Ionicons name="diamond" size={18} color={dark ? '#fce7f3' : '#be185d'} style={{ marginRight: 8 }} />
              <Text style={[styles.premiumText, { color: dark ? '#fce7f3' : '#9d174d', fontWeight: '800' }]}>{t('custom_qr_go_premium') || 'Premium planlarını gör'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rewardCta, { backgroundColor: dark ? '#166534' : '#16a34a', borderColor: dark ? '#22c55e' : '#16a34a', borderWidth: 1 }]}
              onPress={handleWatchAdUnlock}
              disabled={uiState.customGateLoading}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {uiState.customGateLoading ? (
                  <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name={uiState.rewardUnlocked ? 'checkmark-circle' : 'play-circle-outline'} size={20} color="#fff" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.rewardCtaText}>{uiState.customGateLoading ? (t('reward.loading') || 'Ödüllü reklam yükleniyor...') : uiState.rewardUnlocked ? (t('reward.unlocked') || 'Kilit açıldı!') : (t('custom_qr_watch_ad') || 'Ödüllü reklam izle')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}


