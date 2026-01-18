import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, ScrollView, ActivityIndicator, Alert, useWindowDimensions, Keyboard, Image, Modal, Animated, InteractionManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { styles } from './CreateQrScreen.styles';
import { Ionicons, Fontisto } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { captureRef } from 'react-native-view-shot';
import Toast from '../components/Toast';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useAdManager } from '../hooks/useAdManager';
import StatusModal from '../components/StatusModal';
import { useInterstitialAd } from '../hooks/useInterstitialAd';
import QrGenerationService from '../utils/QrGenerationService';
import CreateQrStateManager from '../utils/CreateQrStateManager';
import IconRenderer from '../components/IconRenderer';
import { debugLog } from '../utils/events';
import QrPreviewSection from '../components/qr/QrPreviewSection';
import IconPickerModal from '../components/qr/IconPickerModal';
import ColorPickerModal from '../components/qr/ColorPickerModal';
import { CUSTOM_MODES, FRAME_TEXT_MAX, QR_TEXT_MAX, ICON_LIBRARY, ICON_CATEGORIES, QUICK_LINK_TEMPLATES, BARCODE_FORMATS } from '../utils/CreateQrConstants';

function QrHero({ dark, compact, heroContent, heroCardStyle }) {
  return (
    <View style={heroCardStyle}>
      <View
        style={[
          styles.heroIconWrap,
          {
            backgroundColor: dark
              ? 'rgba(37,99,235,0.16)'
              : 'rgba(6,95,70,0.08)',
            borderColor: dark ? '#1e293b' : '#bbf7d0',
          },
        ]}
      >
        <Ionicons
          name={heroContent.icon}
          size={compact ? 30 : 34}
          color={dark ? '#4ade80' : '#059669'}
        />
      </View>
      <Text
        style={[
          styles.heroTitle,
          compact ? { fontSize: 22 } : null,
          { color: dark ? '#e6edf3' : '#0b1220' },
        ]}
      >
        {heroContent.title}
      </Text>
      <Text
        style={[
          styles.heroSubtitle,
          { color: dark ? '#94a3b8' : '#4b5563' },
        ]}
      >
        {heroContent.subtitle}
      </Text>
      <View
        style={[
          styles.heroBadge,
          {
            backgroundColor: dark
              ? 'rgba(34,197,94,0.14)'
              : 'rgba(16,185,129,0.08)',
            borderColor: dark
              ? 'rgba(52,211,153,0.5)'
              : 'rgba(16,185,129,0.4)',
          },
        ]}
      >
        <Ionicons
          name={heroContent.badgeIcon}
          size={14}
          color={dark ? '#6ee7b7' : '#059669'}
        />
        <Text
          style={[
            styles.heroBadgeText,
            { color: dark ? '#bbf7d0' : '#047857' },
          ]}
        >
          {heroContent.badge}
        </Text>
      </View>
    </View>
  );
}

export default function CreateQrScreen() {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 360 || height < 640;
  const insets = useSafeAreaInsets();
  const toastBottomOffset = Math.max((insets?.bottom ?? 0) + 32, 32);
  const navigation = useNavigation();
  const isWeb = Platform.OS === 'web';
  const qrRef = useRef(null);
  const lastGeneratedRef = useRef('');

  // --- State Groups ---
  const [uiState, setUiState] = useState({
    input: '',
    matrix: null,
    generatedContent: null,
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
    statusModal: { visible: false, title: '', message: '', type: 'error' },
    barcodeFormatPickerVisible: false,
    qrTypePickerVisible: false,
    iconPickerVisible: false,
    iconCategory: 'all',
    iconFavorites: [],
    lastIconId: null
  });
  const [interstitialEnabled, setInterstitialEnabled] = useState(false);

  // Call the hook to show interstitial ad on mount (if not premium)
  useInterstitialAd(!uiState.premium && interstitialEnabled);

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
    symbolType: 'qr',
    customMode: 'none',
    customLogo: null,
    customFrameText: '',
    frameThemeColor: '#0f172a',
    tempFrameColor: '#0f172a',
    qrColor: '#000000',
    tempQrColor: '#000000',
    barcodeFormat: 'CODE128',
  });

  const [unlockState, setUnlockState] = useState({
    unlockedModes: {},
    unlockedTemplates: {},
    pendingCustomMode: null,
    pendingQrType: null,
    pendingTemplateKey: null,
  });

  const [quickTemplatesVisible, setQuickTemplatesVisible] = useState(
    qrSettings.symbolType === 'qr' && qrSettings.type === 'url'
  );

  const stateManager = useMemo(
    () =>
      new CreateQrStateManager({
        setUiState,
        setWifiConfig,
        setContactInfo,
        setQrSettings,
        setUnlockState,
      }),
    []
  );

  const updateUi = useCallback(
    (updates) => stateManager.updateUi(updates),
    [stateManager]
  );
  const updateWifi = useCallback(
    (updates) => stateManager.updateWifi(updates),
    [stateManager]
  );
  const updateContact = useCallback(
    (updates) => stateManager.updateContact(updates),
    [stateManager]
  );
  const updateQr = useCallback(
    (updates) => stateManager.updateQr(updates),
    [stateManager]
  );
  const updateUnlock = useCallback(
    (updates) => stateManager.updateUnlock(updates),
    [stateManager]
  );

  const qrService = useMemo(() => new QrGenerationService(), []);

  // --- Ad Logic (Hook) ---
  const rewardedEnabled = Platform.OS !== 'ios';
  const { showAd } = useAdManager(rewardedEnabled);


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
    if (unlockState.pendingTemplateKey) {
      const tpl = QUICK_LINK_TEMPLATES.find((tplItem) => tplItem.key === unlockState.pendingTemplateKey);
      if (tpl) {
        const label = t(tpl.labelKey) || tpl.fallbackLabel;
        return t('template_unlock_title', { template: label }) || `${label} şablonunun kilidini açın`;
      }
    }
    if (unlockState.pendingQrType) return t('qr_type_unlock_title') || 'Bu QR tipini açın';
    if (unlockState.pendingCustomMode === 'barcode_generate') return t('barcode_unlock_title') || 'Barkod oluşturmayı açın';
    return t('custom_qr_unlock_title') || 'Özel stilleri açın';
  }, [unlockState.pendingTemplateKey, unlockState.pendingQrType, unlockState.pendingCustomMode, t]);

  const gateDesc = useMemo(() => {
    if (Platform.OS === 'ios') {
      if (unlockState.pendingTemplateKey) {
        const tpl = QUICK_LINK_TEMPLATES.find((tplItem) => tplItem.key === unlockState.pendingTemplateKey);
        const label = tpl ? (t(tpl.labelKey) || tpl.fallbackLabel) : '';
        return t('template_unlock_desc_premium', { template: label }) || 'Bu özellik Premium ile açılır.';
      }
      if (unlockState.pendingQrType) return t('qr_type_unlock_desc_premium') || 'Bu QR tipini kullanmak için Premium olun.';
      if (unlockState.pendingCustomMode === 'barcode_generate') {
        return t('barcode_unlock_desc_premium') || 'Barkod oluşturmak için Premium olun.';
      }
      if (unlockState.pendingCustomMode) return t('custom_qr_unlock_desc_premium') || 'Bu stil Premium ile açılır.';
      return t('premium_unlock_desc') || 'Premium ile tüm kilitler açılır.';
    }
    if (unlockState.pendingTemplateKey) {
      const tpl = QUICK_LINK_TEMPLATES.find((tplItem) => tplItem.key === unlockState.pendingTemplateKey);
      const label = tpl ? (t(tpl.labelKey) || tpl.fallbackLabel) : '';
      return t('template_unlock_desc', { template: label }) || 'Bu hazır şablonu logo ve çerçeve ile kullanmak için ödüllü reklam izleyin.';
    }
    if (unlockState.pendingQrType) return t('qr_type_unlock_desc') || 'Bu QR tipini kullanmak için Premium olun ya da ödüllü reklam izleyin.';
    if (unlockState.pendingCustomMode === 'barcode_generate') {
      return t('barcode_unlock_desc') || 'Barkod oluşturmak için Premium olun ya da ödüllü reklam izleyin.';
    }
    return t('custom_qr_unlock_desc') || 'Logo ve çerçeve eklemek için Premium olun ya da ödüllü reklam izleyin.';
  }, [unlockState.pendingTemplateKey, unlockState.pendingQrType, unlockState.pendingCustomMode, t]);

  const premiumBenefits = useMemo(() => {
    const items = [];

    if (unlockState.pendingQrType) {
      items.push(t('premium_benefit.qr_types') || 'Wi‑Fi, Telefon, E‑posta ve SMS QR');
    }

    if (unlockState.pendingTemplateKey) {
      items.push(t('premium_benefit.templates') || 'Hazır şablonlar');
    }

    if (unlockState.pendingCustomMode === 'barcode_generate') {
      items.push(t('premium_benefit.barcodes') || 'Barkod oluşturma');
    }

    if (unlockState.pendingCustomMode && unlockState.pendingCustomMode !== 'barcode_generate') {
      items.push(t('premium_benefit.custom_styles') || 'Özel QR stilleri (logo, çerçeve, yazı)');
    }

    items.push(t('premium_benefit.icons') || 'Özel ikonlar ve ikonlu QR');
    items.push(t('premium_benefit.remove_ads') || 'Reklamları kaldır');

    return items;
  }, [t, unlockState.pendingCustomMode, unlockState.pendingQrType, unlockState.pendingTemplateKey]);

  const isUrlQrType = useMemo(
    () => qrSettings.symbolType === 'qr' && qrSettings.type === 'url',
    [qrSettings.symbolType, qrSettings.type]
  );

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
  const showVisualFrame = useMemo(() => {
    if (qrSettings.symbolType !== 'qr') return false;
    if (showFrameControls) return true;
    if (isIconLogo && qrSettings.customMode === 'logo') return true;
    return false;
  }, [qrSettings.symbolType, showFrameControls, isIconLogo, qrSettings.customMode]);
  const iconLogoInfo = useMemo(() => {
    if (typeof qrSettings.customLogo !== 'string') return null;
    if (qrSettings.customLogo.startsWith('fontisto:')) {
      return { family: 'fontisto', name: qrSettings.customLogo.slice('fontisto:'.length) };
    }
    if (qrSettings.customLogo.startsWith('ionicon:')) {
      return { family: 'ionicon', name: qrSettings.customLogo.slice('ionicon:'.length) };
    }
    if (qrSettings.customLogo.startsWith('fontawesome:')) {
      return { family: 'fontawesome', name: qrSettings.customLogo.slice('fontawesome:'.length) };
    }
    if (qrSettings.customLogo.startsWith('mci:')) {
      return { family: 'mci', name: qrSettings.customLogo.slice('mci:'.length) };
    }
    if (qrSettings.customLogo.startsWith('entypo:')) {
      return { family: 'entypo', name: qrSettings.customLogo.slice('entypo:'.length) };
    }
    if (qrSettings.customLogo.startsWith('feather:')) {
      return { family: 'feather', name: qrSettings.customLogo.slice('feather:'.length) };
    }
    return null;
  }, [qrSettings.customLogo]);
  const isIconLogo = !!iconLogoInfo;

  const previewCategoryKey = uiState.iconCategory || 'all';
  const previewCategoryMeta = ICON_CATEGORIES.find((c) => c.key === previewCategoryKey) || ICON_CATEGORIES[0];
  const previewIcon = ICON_LIBRARY.find((i) => i.id === uiState.lastIconId) || null;
  const previewTheme = previewIcon && previewIcon.theme;
  const previewQrColor = previewTheme && previewTheme.qrColor
    ? previewTheme.qrColor
    : (previewIcon && previewIcon.color) || previewCategoryMeta.color || '#2563eb';
  const previewFrameColor = previewTheme && previewTheme.frameColor
    ? previewTheme.frameColor
    : previewQrColor;

  const quickTemplatesOpacity = useRef(new Animated.Value(isUrlQrType ? 1 : 0)).current;
  const quickTemplatesTranslateY = useRef(new Animated.Value(isUrlQrType ? 0 : 16)).current;

  useEffect(() => {
    if (isUrlQrType) {
      setQuickTemplatesVisible(true);
      Animated.parallel([
        Animated.timing(quickTemplatesOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(quickTemplatesTranslateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(quickTemplatesOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(quickTemplatesTranslateY, {
          toValue: 16,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setQuickTemplatesVisible(false);
        }
      });
    }
  }, [isUrlQrType, quickTemplatesOpacity, quickTemplatesTranslateY]);

  const selectedBarcodeFormat = useMemo(() => {
    const found = BARCODE_FORMATS.find(f => f.k === qrSettings.barcodeFormat);
    return found || BARCODE_FORMATS[0];
  }, [qrSettings.barcodeFormat]);

  const isNumericOnlyBarcodeFormat = useMemo(() => {
    const fmt = qrSettings.barcodeFormat;
    if (!fmt) return false;
    return [
      'EAN13',
      'EAN8',
      'EAN5',
      'EAN2',
      'UPC',
      'UPCE',
      'ITF14',
      'ITF',
      'MSI',
      'MSI10',
      'MSI11',
      'MSI1010',
      'MSI1110',
      'pharmacode',
      'CODE128C'
    ].includes(fmt);
  }, [qrSettings.barcodeFormat]);

  const barcodeLengthSpec = useMemo(() => {
    const fmt = qrSettings.barcodeFormat;
    if (!fmt) return null;
    if (fmt === 'EAN13') return { max: 13, exact: true };
    if (fmt === 'EAN8') return { max: 8, exact: true };
    if (fmt === 'EAN5') return { max: 5, exact: true };
    if (fmt === 'EAN2') return { max: 2, exact: true };
    if (fmt === 'UPC') return { max: 12, exact: true };
    if (fmt === 'UPCE') return { max: 8, exact: false };
    if (fmt === 'ITF14') return { max: 14, exact: true };
    if (fmt === 'ITF') return { max: 80, exact: false };
    if (fmt === 'MSI' || fmt === 'MSI10' || fmt === 'MSI11' || fmt === 'MSI1010' || fmt === 'MSI1110') {
      return { max: 30, exact: false };
    }
    if (fmt === 'pharmacode') return { max: 6, exact: false };
    if (fmt === 'CODE39') return { max: 43, exact: false };
    if (fmt === 'CODE128' || fmt === 'CODE128A' || fmt === 'CODE128B' || fmt === 'CODE128C') {
      return { max: 80, exact: false };
    }
    if (fmt === 'codabar') return { max: 20, exact: false };
    return null;
  }, [qrSettings.barcodeFormat]);

  const frameLabelText = useMemo(() => {
    return qrSettings.customFrameText.trim();
  }, [qrSettings.customFrameText]);
  const hasFrameText = frameLabelText.length > 0;

  const handleInputChange = useCallback(
    (text) => {
      let value = text;
      if (qrSettings.symbolType === 'barcode') {
        const fmt = qrSettings.barcodeFormat;
        if (isNumericOnlyBarcodeFormat) {
          value = text.replace(/[^0-9]/g, '');
        } else if (fmt === 'CODE39') {
          value = text.toUpperCase().replace(/[^0-9A-Z\-\.\ \$\/\+\%]/g, '');
        } else if (fmt === 'codabar') {
          value = text.toUpperCase().replace(/[^0-9\-\$\:\.\/\+ABCD]/g, '');
        } else if (fmt === 'CODE128A') {
          value = text.toUpperCase().replace(/[^\x20-\x5F]/g, '');
        } else if (fmt === 'CODE128' || fmt === 'CODE128B') {
          value = text.replace(/[^\x20-\x7E]/g, '');
        }
      }
      updateUi({ input: value });
    },
    [qrSettings.symbolType, qrSettings.barcodeFormat, isNumericOnlyBarcodeFormat, updateUi]
  );

  const isBarcodeLengthMaxed = useMemo(() => {
    if (!barcodeLengthSpec || qrSettings.symbolType !== 'barcode') return false;
    const len = (uiState.input || '').trim().length;
    return len >= barcodeLengthSpec.max;
  }, [barcodeLengthSpec, qrSettings.symbolType, uiState.input]);

  const handleIconSelect = useCallback((icon) => {
    if (!uiState.premium && !unlockState.unlockedModes.icon_pack) {
      updateUnlock({ pendingCustomMode: 'logo_frame' });
      openCustomGate();
      return;
    }

    const token = `${icon.family}:${icon.name}`;
    const updates = { customLogo: token };
    const theme = icon.theme || {};

    const nextMode = theme.mode || 'logo_frame';
    const nextQrColor = theme.qrColor || icon.color || qrSettings.qrColor || '#000000';
    const nextFrameColor = theme.frameColor || nextQrColor;

    updates.customMode = nextMode;
    updates.frameThemeColor = nextFrameColor;
    updates.tempFrameColor = nextFrameColor;
    updates.qrColor = nextQrColor;
    updates.tempQrColor = nextQrColor;

    updateQr(updates);
    updateUi({ iconPickerVisible: false, lastIconId: icon.id });
  }, [uiState.premium, unlockState.unlockedModes, qrSettings.qrColor, updateQr, updateUi, updateUnlock]);

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

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const v = await AsyncStorage.getItem('icon-favorites');
        if (v) {
          const arr = JSON.parse(v);
          if (Array.isArray(arr)) {
            updateUi({ iconFavorites: arr });
          }
        }
      } catch {}
    };
    loadFavorites();
  }, []);

  const overlayDelayMs = Platform.OS === 'ios' ? 60 : 0;

  const closeOverlays = useCallback(() => {
    updateUi({
      qrTypePickerVisible: false,
      barcodeFormatPickerVisible: false,
      iconPickerVisible: false,
      colorPickerVisible: false,
      customGateVisible: false,
      unlockModalVisible: false,
      customGateLoading: false,
    });
  }, [updateUi]);

  const openCustomGate = useCallback(() => {
    closeOverlays();
    if (overlayDelayMs > 0) {
      setTimeout(() => updateUi({ customGateVisible: true }), overlayDelayMs);
    } else {
      updateUi({ customGateVisible: true });
    }
  }, [closeOverlays, overlayDelayMs, updateUi]);

  const openQrTypePicker = useCallback(() => {
    closeOverlays();
    if (overlayDelayMs > 0) {
      setTimeout(() => updateUi({ qrTypePickerVisible: true }), overlayDelayMs);
    } else {
      updateUi({ qrTypePickerVisible: true });
    }
  }, [closeOverlays, overlayDelayMs, updateUi]);

  const openBarcodeFormatPicker = useCallback(() => {
    closeOverlays();
    if (overlayDelayMs > 0) {
      setTimeout(() => updateUi({ barcodeFormatPickerVisible: true }), overlayDelayMs);
    } else {
      updateUi({ barcodeFormatPickerVisible: true });
    }
  }, [closeOverlays, overlayDelayMs, updateUi]);

  const openIconPicker = useCallback(() => {
    closeOverlays();
    if (overlayDelayMs > 0) {
      setTimeout(() => updateUi({ iconPickerVisible: true }), overlayDelayMs);
    } else {
      updateUi({ iconPickerVisible: true });
    }
  }, [closeOverlays, overlayDelayMs, updateUi]);

  const openColorPicker = useCallback((target) => {
    closeOverlays();
    if (target === 'frame') {
      updateQr({ tempFrameColor: qrSettings.frameThemeColor });
    } else {
      updateQr({ tempQrColor: qrSettings.qrColor });
    }
    const open = () => updateUi({ colorPickerVisible: true, colorPickerTarget: target });
    if (overlayDelayMs > 0) {
      setTimeout(open, overlayDelayMs);
    } else {
      open();
    }
  }, [closeOverlays, overlayDelayMs, qrSettings.frameThemeColor, qrSettings.qrColor, updateQr, updateUi]);

  const ensureCustomAccess = useCallback((modeKey) => {
    if (modeKey === 'none') return true;
    if (isModeUnlocked(modeKey)) return true;
    updateUnlock({ pendingCustomMode: modeKey });
    openCustomGate();
    return false;
  }, [isModeUnlocked, openCustomGate, updateUnlock]);

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
    openCustomGate();
  }, [uiState.premium, isModeUnlocked, openCustomGate, updateUnlock]);

  const ensureBarcodeAccess = useCallback(() => {
    if (qrSettings.symbolType !== 'barcode') return true;
    if (uiState.premium) return true;
    if (unlockState.unlockedModes.barcode_generate) return true;

    updateUnlock({ pendingCustomMode: 'barcode_generate', pendingQrType: null });
    openCustomGate();
    return false;
  }, [qrSettings.symbolType, uiState.premium, unlockState.unlockedModes, openCustomGate, updateUnlock]);

  const isBarcodeGenerateLocked = useMemo(() => {
    if (qrSettings.symbolType !== 'barcode') return false;
    if (uiState.premium) return false;
    return !unlockState.unlockedModes.barcode_generate;
  }, [qrSettings.symbolType, uiState.premium, unlockState.unlockedModes]);

  const ensureTypeAccess = useCallback((typeKey) => {
    const needsUnlock = ['wifi', 'tel', 'email', 'sms'].includes(typeKey);
    if (!needsUnlock) return true;
    if (uiState.premium || unlockState.unlockedModes[typeKey]) return true;
    updateUnlock({ pendingQrType: typeKey });
    openCustomGate();
    return false;
  }, [uiState.premium, unlockState.unlockedModes, openCustomGate, updateUnlock]);

  const handleQrTypePress = useCallback((typeKey) => {
    if (!ensureTypeAccess(typeKey)) return;
    updateQr({ type: typeKey });
    updateUnlock({ pendingQrType: null });
  }, [ensureTypeAccess]);

  const dismissCustomGate = useCallback(() => {
    updateUi({ customGateVisible: false, unlockModalVisible: false });
  }, [updateUi]);

  const closeCustomGate = useCallback(() => {
    updateUi({ customGateVisible: false, rewardUnlocked: false, unlockModalVisible: false, customGateLoading: false });
    updateUnlock({ pendingCustomMode: null, pendingQrType: null, pendingTemplateKey: null });
  }, [updateUi, updateUnlock]);

  const applyRewardUnlock = useCallback(() => {
    setUnlockState((prev) => {
      const nextModes = { ...prev.unlockedModes };
      if (prev.pendingCustomMode && prev.pendingCustomMode !== 'none') nextModes[prev.pendingCustomMode] = true;
      if (prev.pendingQrType) nextModes[prev.pendingQrType] = true;
      if (!nextModes.icon_pack) nextModes.icon_pack = true;

      const nextTemplates = { ...(prev.unlockedTemplates || {}) };
      if (prev.pendingTemplateKey) nextTemplates[prev.pendingTemplateKey] = true;

      return { ...prev, unlockedModes: nextModes, unlockedTemplates: nextTemplates };
    });

    if (unlockState.pendingCustomMode && unlockState.pendingCustomMode !== 'qr_color') {
      updateQr({ customMode: unlockState.pendingCustomMode });
    }
    if (unlockState.pendingQrType) {
      updateQr({ type: unlockState.pendingQrType });
    }

    if (unlockState.pendingTemplateKey) {
      const tpl = QUICK_LINK_TEMPLATES.find((tplItem) => tplItem.key === unlockState.pendingTemplateKey);
      if (tpl) {
        const label = t(tpl.labelKey) || tpl.fallbackLabel;
        updateUi({ input: tpl.example, error: null });
        updateQr({
          customMode: 'logo_frame',
          customLogo: `fontisto:${tpl.icon}`,
          customFrameText: '',
          frameThemeColor: tpl.color,
          tempFrameColor: tpl.color,
          qrColor: tpl.color,
          tempQrColor: tpl.color
        });
      }
    }

    closeCustomGate();
    updateUi({ toast: { visible: true, type: 'success', message: t('custom_qr_unlocked') || 'Bu seçenek açıldı!' } });
  }, [unlockState.pendingCustomMode, unlockState.pendingQrType, unlockState.pendingTemplateKey, closeCustomGate, t, updateQr, updateUi]);

  const runAdUnlockFlow = useCallback(async () => {
    debugLog('CreateQrScreen.unlock', 'Ad flow starting', {
      pendingCustomMode: unlockState.pendingCustomMode,
      pendingQrType: unlockState.pendingQrType,
      pendingTemplateKey: unlockState.pendingTemplateKey,
    });

    const res = await showAd();
    debugLog('CreateQrScreen.unlock', 'showAd resolved', res);
    await new Promise(resolve => setTimeout(resolve, 300));

    InteractionManager.runAfterInteractions(() => {
      debugLog('CreateQrScreen.unlock', 'After interactions, applying result', res);
      updateUi({ customGateLoading: false });

      if (res.ok) {
        applyRewardUnlock();
      } else {
        const error = res.error;
        const isNotReady = error === 'not_ready';
        const message = isNotReady
          ? (t('ads.modal.notReady') || 'Reklam şu anda hazır değil. Lütfen biraz bekleyin ve tekrar deneyin.')
          : (t('ads.modal.generic') || 'Bir sorun oluştu. Lütfen tekrar deneyin.');

        updateUi({ toast: { visible: true, type: 'error', message } });
      }
    });
  }, [applyRewardUnlock, showAd, t, unlockState.pendingCustomMode, unlockState.pendingQrType, unlockState.pendingTemplateKey, updateUi]);

  const handleWatchAdUnlock = useCallback(async () => {
    if (uiState.customGateLoading) return;

    debugLog('CreateQrScreen.unlock', 'Watch ad unlock tapped', {
      pendingCustomMode: unlockState.pendingCustomMode,
      pendingQrType: unlockState.pendingQrType,
      pendingTemplateKey: unlockState.pendingTemplateKey,
    });

    if (!rewardedEnabled) {
      handlePremiumNavigation();
      return;
    }
    
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      debugLog('CreateQrScreen.unlock', 'Offline, aborting ad show', netState, 'warn');
      updateUi({
        adInfoModal: {
          visible: true,
          title: t('ads.modal.title') || 'Reklam',
          message: t('ads.modal.offline') || 'İnternet bağlantısı yok. Reklamı yüklemek için internete bağlanın.'
        }
      });
      return;
    }

    debugLog('CreateQrScreen.unlock', 'Dismissing gate before ad show');
    updateUi({ customGateLoading: true });
    dismissCustomGate();
    runAdUnlockFlow();
  }, [dismissCustomGate, handlePremiumNavigation, rewardedEnabled, runAdUnlockFlow, t, uiState.customGateLoading, unlockState.pendingCustomMode, unlockState.pendingQrType, unlockState.pendingTemplateKey, updateUi]);

  const handlePremiumNavigation = useCallback(async () => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      updateUi({
        statusModal: {
          visible: true,
          title: t('alerts.connectionErrorTitle'),
          message: t('alerts.connectionErrorMessage'),
          type: 'error'
        }
      });
      return;
    }
    closeCustomGate();
    navigation.navigate('Paywall');
  }, [closeCustomGate, navigation, t]);

  const onColorChange = useCallback((hex) => {
    if (uiState.colorPickerTarget !== 'frame') {
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
        let finalUri = result.assets[0].uri;
        
        // Resize if too large to prevent memory issues
        try {
          const manipResult = await ImageManipulator.manipulateAsync(
            finalUri,
            [{ resize: { width: 800 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.PNG }
          );
          if (manipResult?.uri) {
            finalUri = manipResult.uri;
          }
        } catch (e) {
          // Fallback to original if resize fails
        }

        updateQr({ customLogo: finalUri });
        if (qrSettings.customMode === 'none') updateQr({ customMode: 'logo' });
      }
    } catch (e) {
      updateUi({ toast: { visible: true, type: 'error', message: t('errors.imagePickFailed') || 'Görsel seçilemedi.' } });
    } finally {
      updateUi({ logoBusy: false });
    }
  }, [uiState.logoBusy, ensureCustomAccess, qrSettings.customMode, t]);

  const generateMatrix = useCallback(
    async (text) => {
      try {
        const result = await qrService.generateMatrix(text);
        if (!result.matrix) {
          updateUi({
            matrix: null,
            generatedContent: null,
            error: null,
          });
          return;
        }

        updateUi({
          matrix: result.matrix,
          generatedContent: result.generatedContent,
          error: null,
        });
      } catch (e) {
        updateUi({
          matrix: null,
          generatedContent: null,
          error: t('qr_generation_error') || 'QR kod oluşturulamadı.',
        });
      } finally {
        updateUi({ generating: false });
      }
    },
    [qrService, t, updateUi]
  );

  const validateBarcodeContent = useCallback(
    (raw) => qrService.validateBarcodeContent(qrSettings.barcodeFormat, raw),
    [qrService, qrSettings.barcodeFormat]
  );

  const buildPayload = useCallback(
    () =>
      qrService.buildPayload({
        type: qrSettings.type,
        symbolType: qrSettings.symbolType,
        input: uiState.input,
        wifiConfig,
        contactInfo,
      }),
    [qrService, qrSettings.type, qrSettings.symbolType, uiState.input, wifiConfig, contactInfo]
  );

  const payloadLength = useMemo(
    () => qrService.payloadLength(buildPayload()),
    [qrService, buildPayload]
  );

  useEffect(() => {
    lastGeneratedRef.current = '';
  }, [qrSettings.symbolType, qrSettings.barcodeFormat]);

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
    if (__DEV__) {
      console.log('[CreateQrScreen] onGenerate pressed', {
        symbolType: qrSettings.symbolType,
        type: qrSettings.type,
        barcodeFormat: qrSettings.barcodeFormat,
        input: uiState.input,
      });
    }

    if (!ensureBarcodeAccess()) {
      if (__DEV__) {
        console.log('[CreateQrScreen] ensureBarcodeAccess blocked generation', {
          symbolType: qrSettings.symbolType,
          unlockedModes: unlockState.unlockedModes,
          premium: uiState.premium,
        });
      }
      return;
    }

    if (!canGenerate()) {
      if (__DEV__) {
        console.log('[CreateQrScreen] canGenerate is false', {
          type: qrSettings.type,
          wifiConfig,
          contactInfo,
          input: uiState.input,
        });
      }
      updateUi({ missingInfoType: qrSettings.type });
      return;
    }

    let payload = '';
    const type = qrSettings.type;

    if ((type === 'url' || type === 'text') && qrSettings.symbolType === 'barcode') {
      const raw = (uiState.input || '').trim();
      if (__DEV__) {
        console.log('[CreateQrScreen] barcode validation start', {
          raw,
          barcodeFormat: qrSettings.barcodeFormat,
        });
      }
      const validation = validateBarcodeContent(raw);
      if (!validation.ok) {
        if (__DEV__) {
          console.log('[CreateQrScreen] barcode validation failed', {
            reason: validation.reason,
            raw,
            barcodeFormat: qrSettings.barcodeFormat,
          });
        }
        let message;
        if (validation.reason === 'non_numeric') {
          message = t('barcode.input.numericOnly') || 'Bu barkod için sadece rakam girin.';
        } else if (validation.reason === 'length') {
          message = t('barcode.input.lengthError') || 'Bu barkod için geçersiz uzunluk.';
        } else if (validation.reason === 'charset') {
          message = t('barcode.input.charsetError') || 'Bu barkod için geçersiz karakterler.';
        } else if (validation.reason === 'range') {
          message = t('barcode.input.rangeError') || 'Bu barkod için geçersiz sayı aralığı.';
        } else if (validation.reason === 'empty') {
          message = t('barcode.input.invalid') || 'Barkod verisi geçerli değil.';
        } else {
          message = t('barcode.input.invalid') || 'Barkod verisi geçerli değil.';
        }
        updateUi({ error: message });
        return;
      }
      if (__DEV__) {
        console.log('[CreateQrScreen] barcode validation ok', {
          value: validation.value,
          length: validation.value.length,
          barcodeFormat: qrSettings.barcodeFormat,
        });
      }
      updateUi({ error: null });
      payload = validation.value;
    } else {
      payload = buildPayload();
      if (__DEV__) {
        console.log('[CreateQrScreen] non-barcode payload built', {
          type,
          symbolType: qrSettings.symbolType,
          payload,
          length: payload ? payload.length : 0,
        });
      }
    }

    if (!payload) {
      if (__DEV__) {
        console.log('[CreateQrScreen] empty payload, clearing matrix');
      }
      updateUi({ matrix: null, error: null });
      return;
    }
    if (payload === lastGeneratedRef.current && uiState.matrix) {
      if (__DEV__) {
        console.log('[CreateQrScreen] payload unchanged, skipping generation');
      }
      return;
    }
    
    lastGeneratedRef.current = payload;
    if (__DEV__) {
      console.log('[CreateQrScreen] generating matrix', {
        payload,
        length: payload.length,
        symbolType: qrSettings.symbolType,
        barcodeFormat: qrSettings.barcodeFormat,
      });
    }
    updateUi({ generating: true });
    Keyboard.dismiss();
    await generateMatrix(payload);
  };

  const getFilename = () => qrService.getFilename();

  const buildCanvasDataUrl = () => qrService.buildCanvasDataUrl();

  const onDownload = async () => {
    if (!uiState.matrix) return;
    if (!uiState.premium) setInterstitialEnabled(true);
    try {
      const filename = getFilename();
      if (isWeb) {
        const url = buildCanvasDataUrl();
        if (!url) {
           updateUi({ toast: { visible: true, message: t('web_download_unavailable') || 'Web üzerinden indirme şu an desteklenmiyor.', type: 'error' } });
           return;
        }
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
    if (!uiState.premium) setInterstitialEnabled(true);
    try {
      const filename = getFilename();
      if (isWeb) {
        const url = buildCanvasDataUrl();
        if (!url) {
           updateUi({ toast: { visible: true, message: t('web_share_unavailable') || 'Web üzerinden paylaşım şu an desteklenmiyor.', type: 'error' } });
           return;
        }
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
    backgroundColor: dark ? '#111827' : '#ffffff',
    borderColor: dark ? '#1f2937' : '#dbe2ea',
    shadowColor: dark ? '#000000' : '#4a9eff',
  }];
  const inputStyle = [styles.input, {
    backgroundColor: dark ? '#111827' : '#ffffff',
    color: dark ? '#e6edf3' : '#0b1220',
    borderColor: uiState.error ? (dark ? '#ef4444' : '#dc2626') : (dark ? '#1f2937' : '#dde3ea'),
    height: uiState.inputHeight
  }];

  const heroContent = useMemo(() => {
    const commonBadge = t('hero.qr_badge') || 'Modern & Hızlı';
    const commonBadgeIcon = 'sparkles';
    if (qrSettings.symbolType === 'barcode') {
      return {
        title: t('hero.barcode_title') || 'Barkod Oluşturucu',
        subtitle: t('hero.barcode_subtitle') || 'Ürünler, envanter ve lojistik için endüstri standardı barkodlar oluşturun.',
        badge: commonBadge,
        icon: 'barcode-outline',
        badgeIcon: commonBadgeIcon
      };
    }
    return {
      title: t('hero.qr_title') || 'QR Kod Oluşturucu',
      subtitle: t('hero.qr_subtitle') || 'Bağlantı, Wi-Fi, metin ve daha fazlası için zahmetsiz QR kodları oluşturun.',
      badge: commonBadge,
      icon: 'qr-code',
      badgeIcon: commonBadgeIcon
    };
  }, [qrSettings.symbolType, t]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={containerStyle} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
        <QrHero dark={dark} compact={compact} heroContent={heroContent} heroCardStyle={heroCardStyle} />

        <View style={styles.inputSection}>
          <View style={[styles.segmented, { borderColor: dark ? '#1f2937' : '#cbd5f5', backgroundColor: dark ? 'rgba(15,23,42,0.9)' : '#eef2ff' }]}>
            {[
              { k: 'qr', label: t('code_type.qr') || 'QR Kod', icon: 'qr-code-outline' },
              { k: 'barcode', label: t('code_type.barcode') || 'Barkod', icon: 'barcode-outline' },
            ].map(opt => {
              const active = qrSettings.symbolType === opt.k;
              return (
                <TouchableOpacity
                  key={opt.k}
                  onPress={() => {
                    if (opt.k === 'barcode') {
                      updateQr({ symbolType: opt.k, type: 'text' });
                      updateUi({ error: null });
                    } else {
                      const wasBarcode = qrSettings.symbolType === 'barcode';
                      updateQr({
                        symbolType: opt.k,
                        type: qrSettings.symbolType === 'qr' ? qrSettings.type : 'url'
                      });
                      updateUi(
                        wasBarcode
                          ? { input: '', error: null, matrix: null, generatedContent: null, inputHeight: 44 }
                          : { error: null }
                      );
                    }
                  }}
                  style={[styles.segBtn, active ? [styles.segBtnActive, { shadowColor: dark ? '#0ea5e9' : '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 }] : null]}
                  activeOpacity={0.9}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={opt.icon} size={16} color={active ? '#fff' : dark ? '#9ca3af' : '#1e293b'} />
                    <Text
                      style={[
                        styles.segText,
                        { color: active ? '#fff' : dark ? '#9ca3af' : '#1e293b', textAlign: 'center' }
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.typeCard, { backgroundColor: dark ? '#111827' : '#ffffff', borderColor: dark ? '#1f2937' : '#dbe2ea', shadowColor: dark ? '#000000' : '#4a9eff' }]}>
            <View style={{ marginBottom: 8 }}>
              <Text style={[styles.customTitle, { color: dark ? '#d1d5db' : '#4a5568', fontSize: 16 }]}>
                {qrSettings.symbolType === 'qr'
                  ? (t('qr_type_label') || 'QR Tipleri')
                  : (t('barcode_type_label') || 'Barkod Tipi')}
              </Text>
            </View>
            {qrSettings.symbolType === 'qr' ? (
              <View style={styles.typeRow}>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    openQrTypePicker();
                  }}
                 style={[
                  styles.typeChip,
                  {
                    backgroundColor: dark ? '#111827' : '#f7f9fb',
                    borderColor: dark ? '#1f2937' : '#dbe2ea',
                    minWidth: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }
                ]}
                  activeOpacity={0.9}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View
                      style={[
                        styles.typeIconWrap,
                        {
                          backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                          borderColor: dark ? '#1f2937' : '#e5eaf1'
                        }
                      ]}
                    >
                      <Ionicons
                        name={
                          qrSettings.type === 'url'
                            ? 'link-outline'
                            : qrSettings.type === 'text'
                            ? 'document-text-outline'
                            : qrSettings.type === 'wifi'
                            ? 'wifi-outline'
                            : qrSettings.type === 'tel'
                            ? 'call-outline'
                            : qrSettings.type === 'email'
                            ? 'mail-outline'
                            : 'chatbubbles-outline'
                        }
                        size={18}
                        color={dark ? '#c3dafe' : '#2563eb'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: dark ? '#8b98a5' : '#0b1220', flex: 1 }
                      ]}
                      numberOfLines={1}
                    >
                      {qrSettings.type === 'url'
                        ? t('label.url') || 'URL'
                        : qrSettings.type === 'text'
                        ? t('label.content') || 'Metin'
                        : qrSettings.type === 'wifi'
                        ? t('label.wifi') || 'Wi‑Fi'
                        : qrSettings.type === 'tel'
                        ? t('label.phone') || 'Telefon'
                        : qrSettings.type === 'email'
                        ? t('label.email') || 'E‑posta'
                        : t('label.sms') || 'SMS'}
                    </Text>
                    {['wifi', 'tel', 'email', 'sms'].includes(qrSettings.type) && !uiState.premium && !unlockState.unlockedModes[qrSettings.type] && (
                      <Ionicons name="lock-closed" size={14} color="#f97316" />
                    )}
                  </View>
                  <Ionicons
                    name={uiState.qrTypePickerVisible ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={18}
                    color={dark ? '#8b98a5' : '#64748b'}
                  />
                </TouchableOpacity>

                {uiState.qrTypePickerVisible && (
                  <Modal
                    visible={uiState.qrTypePickerVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => updateUi({ qrTypePickerVisible: false })}
                  >
                  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      activeOpacity={1}
                      onPress={() => updateUi({ qrTypePickerVisible: false })}
                    />
                    <View
                      style={{
                        backgroundColor: dark ? '#111827' : '#ffffff',
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: 24,
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        borderWidth: 1,
                        borderColor: dark ? '#1f2937' : '#e2e8f0'
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 8
                        }}
                      >
                        <Text
                          style={[
                            styles.customTitle,
                            { color: dark ? '#e6edf3' : '#0b1220', fontSize: 16 }
                          ]}
                        >
                          {t('qr_type_label') || 'QR Tipleri'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => updateUi({ qrTypePickerVisible: false })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.85}
                          style={[
                            styles.modalCloseButton,
                            {
                              backgroundColor: dark ? '#111827' : '#f8fafc',
                              borderColor: dark ? '#1f2937' : '#e2e8f0',
                              shadowColor: dark ? '#000' : '#64748b',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.2,
                              shadowRadius: 4,
                              elevation: 3
                            }
                          ]}
                        >
                          <Ionicons
                            name="close"
                            size={18}
                            color={dark ? '#9ca3af' : '#64748b'}
                          />
                        </TouchableOpacity>
                      </View>

                      <ScrollView
                        style={{ maxHeight: 320 }}
                        contentContainerStyle={{ paddingTop: 4, paddingBottom: 4, gap: 8 }}
                      >
                        {[
                          { k: 'url', label: t('label.url') || 'URL', icon: 'link-outline' },
                          { k: 'text', label: t('label.content') || 'Metin', icon: 'document-text-outline' },
                          { k: 'wifi', label: t('label.wifi') || 'Wi‑Fi', icon: 'wifi-outline' },
                          { k: 'tel', label: t('label.phone') || 'Telefon', icon: 'call-outline' },
                          { k: 'email', label: t('label.email') || 'E‑posta', icon: 'mail-outline' },
                          { k: 'sms', label: t('label.sms') || 'SMS', icon: 'chatbubbles-outline' }
                        ].map((opt) => {
                          const active = qrSettings.type === opt.k;
                          const locked = ['wifi', 'tel', 'email', 'sms'].includes(opt.k) && !uiState.premium && !unlockState.unlockedModes[opt.k];
                          return (
                            <TouchableOpacity
                              key={opt.k}
                              onPress={() => {
                                if (!ensureTypeAccess(opt.k)) return;
                                updateQr({ type: opt.k });
                                updateUnlock({ pendingQrType: null });
                                updateUi({ qrTypePickerVisible: false });
                              }}
                              style={[
                                styles.typeChip,
                                {
                                  backgroundColor: active
                                    ? '#2563eb'
                                    : dark
                                    ? '#111827'
                                    : '#f9fafb',
                                  borderColor: active
                                    ? '#2563eb'
                                    : dark
                                    ? '#1f2937'
                                    : '#e2e8f0',
                                  minWidth: '100%',
                                  opacity: locked ? 0.7 : 1
                                }
                              ]}
                              activeOpacity={0.9}
                            >
                              <View
                                style={[
                                  styles.typeIconWrap,
                                  {
                                    backgroundColor: dark
                                      ? 'rgba(255,255,255,0.05)'
                                      : 'rgba(0,0,0,0.04)',
                                    borderColor: dark ? '#1f2937' : '#e5eaf1'
                                  },
                                  active ? styles.typeIconWrapActive : null
                                ]}
                              >
                                <Ionicons
                                  name={opt.icon}
                                  size={18}
                                  color={active ? '#fff' : dark ? '#c3dafe' : '#2563eb'}
                                />
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                <Text
                                  style={[
                                    styles.typeChipText,
                                    {
                                      color: active ? '#fff' : dark ? '#e5e7eb' : '#0b1220',
                                      flex: 1
                                    }
                                  ]}
                                  numberOfLines={1}
                                >
                                  {opt.label}
                                </Text>
                                {['wifi', 'tel', 'email', 'sms'].includes(opt.k) && !uiState.premium && !unlockState.unlockedModes[opt.k] && (
                                  <Ionicons name="lock-closed" size={14} color={active ? '#fff' : '#f97316'} />
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>
                  </Modal>
                )}
              </View>
            ) : (
              <View style={[styles.typeRow, { marginTop: 4 }]}>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    openBarcodeFormatPicker();
                  }}
                 style={[
                  styles.typeChip,
                  {
                    backgroundColor: dark ? '#111827' : '#f7f9fb',
                    borderColor: dark ? '#1f2937' : '#dbe2ea',
                    minWidth: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }
                ]}
                  activeOpacity={0.9}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View
                      style={[
                        styles.typeIconWrap,
                        {
                          backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                          borderColor: dark ? '#1f2937' : '#e5eaf1'
                        }
                      ]}
                    >
                      <Ionicons
                        name="barcode-outline"
                        size={18}
                        color={dark ? '#c3dafe' : '#2563eb'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: dark ? '#8b98a5' : '#0b1220', flex: 1 }
                      ]}
                      numberOfLines={2}
                    >
                      {(t(selectedBarcodeFormat.key) || selectedBarcodeFormat.fallback) +
                        (selectedBarcodeFormat.fallbackDesc
                          ? ' – ' +
                            (selectedBarcodeFormat.descKey
                              ? t(selectedBarcodeFormat.descKey) || selectedBarcodeFormat.fallbackDesc
                              : selectedBarcodeFormat.fallbackDesc)
                          : '')}
                    </Text>
                  </View>
                  <Ionicons
                    name={uiState.barcodeFormatPickerVisible ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={18}
                    color={dark ? '#8b98a5' : '#64748b'}
                  />
                </TouchableOpacity>

                {uiState.barcodeFormatPickerVisible && (
                  <Modal
                    visible={uiState.barcodeFormatPickerVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => updateUi({ barcodeFormatPickerVisible: false })}
                  >
                  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      activeOpacity={1}
                      onPress={() => updateUi({ barcodeFormatPickerVisible: false })}
                    />
                    <View
                      style={{
                        backgroundColor: dark ? '#111827' : '#ffffff',
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: 24,
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        borderWidth: 1,
                        borderColor: dark ? '#1f2937' : '#e2e8f0'
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 8
                        }}
                      >
                        <Text
                          style={[
                            styles.customTitle,
                            { color: dark ? '#e6edf3' : '#0b1220', fontSize: 16 }
                          ]}
                        >
                          {t('barcode_type_label') || 'Barkod Tipi'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => updateUi({ barcodeFormatPickerVisible: false })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.85}
                          style={[
                            styles.modalCloseButton,
                            {
                              backgroundColor: dark ? '#111827' : '#f8fafc',
                              borderColor: dark ? '#1f2937' : '#e2e8f0',
                              shadowColor: dark ? '#000' : '#64748b',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.2,
                              shadowRadius: 4,
                              elevation: 3
                            }
                          ]}
                        >
                          <Ionicons
                            name="close"
                            size={18}
                            color={dark ? '#9ca3af' : '#64748b'}
                          />
                        </TouchableOpacity>
                      </View>

                      <ScrollView
                        style={{ maxHeight: 320 }}
                        contentContainerStyle={{ paddingTop: 4, paddingBottom: 4, gap: 8 }}
                      >
                        {BARCODE_FORMATS.map((opt) => {
                          const active = qrSettings.barcodeFormat === opt.k;
                          const label = t(opt.key) || opt.fallback;
                          const desc = opt.descKey ? t(opt.descKey) || opt.fallbackDesc : opt.fallbackDesc;
                          return (
                            <TouchableOpacity
                              key={opt.k}
                              onPress={() => {
                                updateQr({ barcodeFormat: opt.k });
                                updateUi({
                                  barcodeFormatPickerVisible: false,
                                  matrix: null,
                                  generatedContent: null,
                                  error: null,
                                });
                              }}
                              style={[
                                styles.typeChip,
                                {
                                  backgroundColor: active
                                    ? '#2563eb'
                                    : dark
                                    ? '#111827'
                                    : '#f9fafb',
                                  borderColor: active
                                    ? '#2563eb'
                                    : dark
                                    ? '#1f2937'
                                    : '#e2e8f0',
                                  minWidth: '100%'
                                }
                              ]}
                              activeOpacity={0.9}
                            >
                              <View
                                style={[
                                  styles.typeIconWrap,
                                  {
                                    backgroundColor: dark
                                      ? 'rgba(255,255,255,0.05)'
                                      : 'rgba(0,0,0,0.04)',
                                    borderColor: dark ? '#1f2937' : '#e5eaf1'
                                  },
                                  active ? styles.typeIconWrapActive : null
                                ]}
                              >
                                <Ionicons
                                  name="barcode-outline"
                                  size={18}
                                  color={active ? '#fff' : dark ? '#c3dafe' : '#2563eb'}
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[
                                    styles.typeChipText,
                                    {
                                      color: active ? '#fff' : dark ? '#e5e7eb' : '#0b1220'
                                    }
                                  ]}
                                  numberOfLines={1}
                                >
                                  {label}
                                </Text>
                                {desc ? (
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      marginTop: 2,
                                      color: active ? 'rgba(255,255,255,0.85)' : dark ? '#9ca3af' : '#6b7280'
                                    }}
                                    numberOfLines={2}
                                  >
                                    {desc}
                                  </Text>
                                ) : null}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>
                  </Modal>
                )}
              </View>
            )}
          </View>
          <View style={{ height: 10 }} />

          {quickTemplatesVisible && (
            <Animated.View
              style={{
                marginBottom: 8,
                paddingHorizontal: 4,
                opacity: quickTemplatesOpacity,
                transform: [{ translateY: quickTemplatesTranslateY }],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text
                  style={[
                    styles.customTitle,
                    { color: dark ? '#e5e7eb' : '#111827', fontSize: 15 }
                  ]}
                >
                  {t('quick_templates.title') || 'Hazır Şablonlar'}
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4, gap: 10 }}
              >
                {QUICK_LINK_TEMPLATES.map((tpl) => {
                  const label = t(tpl.labelKey) || tpl.fallbackLabel;
                  const desc = t(tpl.descKey) || tpl.fallbackDesc;
                  const bgColor = dark ? tpl.bgDark : tpl.bgLight;
                  const templateUnlocked = unlockState.unlockedTemplates && unlockState.unlockedTemplates[tpl.key];
                  const locked = !uiState.premium && !templateUnlocked;
                  const exampleKey = `quick_templates.${tpl.key}_example`;
                  const localizedExample = t(exampleKey) || tpl.example;
                  return (
                      <TouchableOpacity
                      key={tpl.key}
                      onPress={() => {
                        if (!uiState.premium && !templateUnlocked) {
                          updateUnlock({ pendingTemplateKey: tpl.key, pendingCustomMode: 'logo_frame' });
                          openCustomGate();
                          return;
                        }
                        updateUi({ input: localizedExample, error: null });
                        updateQr({
                          customMode: 'logo_frame',
                          customLogo: `fontisto:${tpl.icon}`,
                          customFrameText: '',
                          frameThemeColor: tpl.color,
                          tempFrameColor: tpl.color,
                          qrColor: tpl.color,
                          tempQrColor: tpl.color
                        });
                      }}
                      activeOpacity={0.9}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: bgColor,
                        borderWidth: 1,
                        borderColor: dark ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.35)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        minWidth: 210,
                        maxWidth: 260,
                        opacity: locked ? 0.65 : 1
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 10,
                          backgroundColor: dark ? 'rgba(15,23,42,0.85)' : '#ffffff',
                          borderWidth: 1,
                          borderColor: dark ? 'rgba(148,163,184,0.6)' : 'rgba(148,163,184,0.5)'
                        }}
                      >
                        <Fontisto name={tpl.icon} size={18} color={tpl.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '600',
                            color: dark ? '#e5e7eb' : '#0b1220',
                            marginBottom: 2
                          }}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: dark ? '#9ca3af' : '#4b5563'
                          }}
                          numberOfLines={2}
                        >
                          {desc}
                        </Text>
                      </View>
                      {locked && (
                        <View style={{ marginLeft: 8 }}>
                          <Ionicons
                            name="lock-closed"
                            size={14}
                            color={dark ? '#facc15' : '#f97316'}
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>
          )}

          {/* Inputs based on type */}
          {(qrSettings.type === 'url' || qrSettings.type === 'text') && (
            <View style={styles.inputWrapper}>
              {qrSettings.symbolType === 'barcode' && !uiState.error && isNumericOnlyBarcodeFormat && (
                <Text
                  style={[
                    styles.infoText,
                    {
                      marginBottom: 6,
                      color: dark ? '#e5e7eb' : '#475569'
                    }
                  ]}
                >
                  {barcodeLengthSpec && barcodeLengthSpec.exact
                    ? (t('barcode.input.numericFixed', { length: barcodeLengthSpec.max }) ||
                      `Bu barkod formatı için ${barcodeLengthSpec.max} haneli sayısal kod girin.`)
                    : (t('barcode.input.numericOnly') || 'Bu barkod formatı için sadece rakam kullanın.')}
                </Text>
              )}
              {uiState.error && (
                <View style={[styles.errorContainer, { backgroundColor: dark ? '#2d1515' : '#fee' }]}>
                  <Ionicons name="alert-circle" size={20} color={dark ? '#ff6b6b' : '#dc2626'} />
                  <Text style={[styles.errorText, { color: dark ? '#ff6b6b' : '#dc2626' }]}>{uiState.error}</Text>
                </View>
              )}
              <View style={styles.inputInner}>
                <TextInput
                  style={inputStyle}
                  placeholder={
                    qrSettings.symbolType === 'barcode'
                      ? (barcodeLengthSpec && barcodeLengthSpec.exact
                          ? (t('input_placeholder_barcode_fixed', { length: barcodeLengthSpec.max }) ||
                             `${barcodeLengthSpec.max} haneli barkod kodu girin...`)
                          : (t('input_placeholder_barcode') || 'Barkod verisini girin...'))
                      : (t('input_placeholder') || (qrSettings.type === 'url' ? 'URL girin...' : 'Metin girin...'))
                  }
                  placeholderTextColor={dark ? '#8b98a5' : '#7a8699'}
                  value={uiState.input}
                  onChangeText={handleInputChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  numberOfLines={1}
                  textAlignVertical="top"
                  scrollEnabled={false}
                  keyboardType={qrSettings.symbolType === 'barcode' && isNumericOnlyBarcodeFormat ? 'number-pad' : 'default'}
                  maxLength={
                    qrSettings.symbolType === 'barcode' && barcodeLengthSpec
                      ? barcodeLengthSpec.max
                      : qrSettings.symbolType === 'qr'
                      ? QR_TEXT_MAX
                      : undefined
                  }
                  onContentSizeChange={(e) => updateUi({ inputHeight: Math.max(44, Math.min(e.nativeEvent.contentSize.height, 160)) })}
                />
                {qrSettings.symbolType === 'barcode' && barcodeLengthSpec && (
                  <View
                    style={[
                      styles.lengthIndicator,
                      uiState.input.length === 0
                        ? { right: 12 }
                        : { right: 50 },
                      {
                        backgroundColor: isBarcodeLengthMaxed
                          ? dark
                            ? 'rgba(153,27,27,0.38)'
                            : 'rgba(248,113,113,0.25)'
                          : dark
                          ? 'rgba(31,41,55,0.85)'
                          : 'rgba(148,163,184,0.18)',
                        borderColor: isBarcodeLengthMaxed
                          ? dark
                            ? '#fca5a5'
                            : '#dc2626'
                          : dark
                          ? '#4b5563'
                          : '#cbd5f5'
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.lengthIndicatorText,
                        {
                          color: isBarcodeLengthMaxed
                            ? dark
                              ? '#fecaca'
                              : '#b91c1c'
                            : dark
                            ? '#e5e7eb'
                            : '#475569'
                        }
                      ]}
                    >
                      {Math.min((uiState.input || '').trim().length, barcodeLengthSpec.max)}/{barcodeLengthSpec.max}
                    </Text>
                  </View>
                )}
                {qrSettings.symbolType === 'qr' && (
                  <View
                    style={[
                      styles.lengthIndicator,
                      uiState.input.length === 0
                        ? { right: 12 }
                        : { right: 50 },
                      {
                        backgroundColor: dark
                          ? 'rgba(31,41,55,0.85)'
                          : 'rgba(148,163,184,0.18)',
                        borderColor: dark ? '#4b5563' : '#cbd5f5'
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.lengthIndicatorText,
                        {
                          color: dark ? '#e5e7eb' : '#475569'
                        }
                      ]}
                    >
                      {(uiState.input || '').trim().length}
                    </Text>
                  </View>
                )}
                {uiState.input.length > 0 && (
                  <TouchableOpacity
                    style={[styles.clearButton, { backgroundColor: dark ? '#1f2937' : '#f0f4f8', borderColor: dark ? '#1f2937' : '#dbe2ea' }]}
                    onPress={() => updateUi({ input: '', matrix: null, error: null, inputHeight: 44 })}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={18} color={dark ? '#8b98a5' : '#7a8699'} />
                  </TouchableOpacity>
                )}
              </View>
              {qrSettings.symbolType === 'barcode' && (
                <View style={{ marginTop: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      if (!isModeUnlocked('qr_color')) {
                        updateUnlock({ pendingCustomMode: 'qr_color' });
                        openCustomGate();
                        return;
                      }
                      openColorPicker('barcode');
                    }}
                    activeOpacity={0.85}
                    style={[
                      styles.customModeChip,
                      {
                        backgroundColor: dark ? '#111827' : '#f8fafc',
                        borderColor: dark ? '#1f2937' : '#e2e8f0',
                        alignSelf: 'stretch',
                        minWidth: '100%',
                        justifyContent: 'center',
                      },
                      !isModeUnlocked('qr_color') ? { opacity: 0.65 } : null,
                    ]}
                  >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: qrSettings.qrColor,
                          borderWidth: 1,
                          borderColor: dark ? '#374151' : '#cbd5f5',
                        }}
                      />
                      <Text style={[styles.customModeText, { color: dark ? '#cbd5f5' : '#0f172a' }]}>
                        {t('custom_qr_dot_color') || 'Nokta Rengi'}
                      </Text>
                      {!isModeUnlocked('qr_color') && (
                        <Ionicons name="lock-closed" size={14} color="#f97316" />
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {qrSettings.type === 'wifi' && (
            <View style={{ gap: 10 }}>
              <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('wifi.ssid') || 'SSID'}</Text>
              <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#111827' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1f2937' : '#dde3ea' }]} value={wifiConfig.ssid} onChangeText={(t) => updateWifi({ ssid: t })} autoCapitalize="none" autoCorrect={false} />
              <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('wifi.security') || 'Güvenlik'}</Text>
              <View style={styles.segmented}>
                {[{ k: 'WPA', label: 'WPA/WPA2' }, { k: 'WEP', label: 'WEP' }, { k: 'nopass', label: 'Yok' }].map(opt => (
                  <TouchableOpacity key={opt.k} onPress={() => updateWifi({ security: opt.k })} style={[styles.segBtn, { borderColor: dark ? '#1f2937' : '#dbe2ea', backgroundColor: dark ? '#1f2937' : '#f0f4f8' }, wifiConfig.security === opt.k ? styles.segBtnActive : null]}>
                    <Text style={[styles.segText, { color: dark ? '#8b98a5' : '#0b1220' }, wifiConfig.security === opt.k ? { color: '#fff' } : null]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {wifiConfig.security !== 'nopass' && (
                <>
                  <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('wifi.password') || 'Şifre'}</Text>
                  <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#111827' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1f2937' : '#dde3ea' }]} value={wifiConfig.password} onChangeText={(t) => updateWifi({ password: t })} autoCapitalize="none" autoCorrect={false} secureTextEntry />
                </>
              )}
              <View style={styles.toggleRow}>
                <TouchableOpacity onPress={() => updateWifi({ hidden: !wifiConfig.hidden })} style={[styles.typeChip, { backgroundColor: dark ? '#1f2937' : '#f0f4f8', borderColor: dark ? '#1f2937' : '#dbe2ea' }, wifiConfig.hidden ? styles.typeChipActive : null]}>
                  <Text style={[styles.typeChipText, { color: dark ? '#8b98a5' : '#0b1220' }, wifiConfig.hidden ? { color: '#fff' } : null]}>{t('wifi.hiddenNetwork') || 'Gizli Ağ'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {qrSettings.type === 'tel' && (
            <View style={{ gap: 10 }}>
              <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('tel.number') || 'Telefon Numarası'}</Text>
              <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#111827' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1f2937' : '#dde3ea' }]} value={contactInfo.phone} onChangeText={(t) => updateContact({ phone: t })} keyboardType="phone-pad" />
            </View>
          )}

          {qrSettings.type === 'email' && (
             <View style={{ gap: 10 }}>
               <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('email.address') || 'E‑posta Adresi'}</Text>
               <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#111827' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1f2937' : '#dde3ea' }]} value={contactInfo.email} onChangeText={(t) => updateContact({ email: t })} keyboardType="email-address" autoCapitalize="none" />
               <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('email.subject') || 'Konu'}</Text>
               <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#111827' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1f2937' : '#dde3ea' }]} value={contactInfo.subject} onChangeText={(t) => updateContact({ subject: t })} />
               <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('email.body') || 'İçerik'}</Text>
               <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#111827' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1f2937' : '#dde3ea', minHeight: 80, paddingVertical: 10 }]} value={contactInfo.body} onChangeText={(t) => updateContact({ body: t })} multiline numberOfLines={3} />
             </View>
          )}

          {qrSettings.type === 'sms' && (
             <View style={{ gap: 10 }}>
               <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('sms.number') || 'Telefon Numarası'}</Text>
               <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#111827' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1f2937' : '#dde3ea' }]} value={contactInfo.smsNumber} onChangeText={(t) => updateContact({ smsNumber: t })} keyboardType="phone-pad" />
               <Text style={[styles.fieldLabel, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('sms.body') || 'Mesaj'}</Text>
               <TextInput style={[styles.fieldInput, { backgroundColor: dark ? '#111827' : '#ffffff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1f2937' : '#dde3ea', minHeight: 80, paddingVertical: 10 }]} value={contactInfo.smsBody} onChangeText={(t) => updateContact({ smsBody: t })} multiline numberOfLines={3} />
             </View>
          )}

          {/* Customization */}
          {qrSettings.symbolType === 'qr' && (
          <View style={[styles.customSection, { backgroundColor: dark ? '#111827' : '#ffffff', borderColor: dark ? '#1f2937' : '#dbe2ea' }]}>
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
                    openCustomGate();
                    return;
                  }
                  openColorPicker('qr');
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
                    openColorPicker('frame');
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
                    isIconLogo && iconLogoInfo ? (
                      <View style={[styles.logoImage, { alignItems: 'center', justifyContent: 'center', backgroundColor:'#ffffff' }]}>
                        <IconRenderer
                          family={iconLogoInfo.family}
                          name={iconLogoInfo.name}
                          size={40}
                          color={qrSettings.frameThemeColor || qrSettings.qrColor || '#22c55e'}
                        />
                      </View>
                    ) : (
                      <Image source={{ uri: qrSettings.customLogo }} style={styles.logoImage} resizeMode="cover" />
                    )
                  ) : (
                    <View style={[styles.logoPlaceholder, { borderColor: '#e2e8f0' }]}>
                      <Ionicons name="image-outline" size={26} color="#94a3b8" />
                      <Text style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>{t('custom_qr_logo_hint') || 'Galeriden logo seçin'}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <TouchableOpacity style={[styles.logoActionBtn, { backgroundColor: '#2563eb' }]} onPress={pickCustomLogo} disabled={uiState.logoBusy}>
                    {uiState.logoBusy ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="cloud-upload-outline" size={18} color="#fff" /><Text style={styles.logoActionText}>{qrSettings.customLogo ? (t('custom_qr_change_logo') || 'Logoyu değiştir') : (t('custom_qr_add_logo') || 'Logo ekle')}</Text></>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.logoActionBtnSecondary, { borderColor: '#cbd5f5' }]} onPress={openIconPicker}>
                    <Ionicons name="sparkles-outline" size={18} color="#2563eb" />
                    <Text style={[styles.logoActionTextSecondary, { color: '#2563eb' }]}>{t('custom_qr_choose_icon') || 'Hazır ikon seç'}</Text>
                  </TouchableOpacity>
                  {qrSettings.customLogo && (
                    <TouchableOpacity style={[styles.logoActionBtnSecondary, { borderColor: '#cbd5f5' }]} onPress={() => updateQr({ customLogo: null })}>
                      <Ionicons name="trash-outline" size={18} color="#dc2626" />
                      <Text style={[styles.logoActionTextSecondary, { color: '#dc2626' }]}>{t('custom_qr_remove_logo') || 'Logoyu kaldır'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {showFrameControls && (
              <View style={[styles.frameCard, { borderColor: dark ? '#1f2937' : '#dbe2ea', backgroundColor: dark ? '#111827' : '#ffffff' }]}>
                <Text style={[styles.frameLabelTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('custom_qr_frame_text') || 'Çerçeve Yazısı'}</Text>
                <TextInput
                  style={[styles.frameInput, { backgroundColor: dark ? '#111827' : '#fff', borderColor: dark ? '#1f2937' : '#d1d5db', color: dark ? '#e6edf3' : '#0b1220' }]}
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
              <Text style={[styles.customHint, { color: dark ? '#94a3b8' : '#475569' }]}>
                {rewardedEnabled
                  ? (t('custom_qr_locked_hint') || 'Premium üye olun ya da bu seçenek için ödüllü reklam izleyin.')
                  : (t('custom_qr_locked_hint_premium') || 'Bu seçenek için Premium olun.')}
              </Text>
            )}
          </View>
          )}

          <View style={[styles.generateRow, compact ? { marginTop: 8 } : null]}>
            <TouchableOpacity style={[styles.generateBtn, !canGenerate() ? { opacity: 0.7 } : null]} onPress={onGenerate} disabled={uiState.generating} activeOpacity={0.85}>
              <Ionicons name={qrSettings.symbolType === 'barcode' ? 'barcode-outline' : 'flash-outline'} size={20} color="#fff" />
              <Text style={styles.generateText}>
                {qrSettings.symbolType === 'barcode'
                  ? (t('actions.generate_barcode') || 'Barkod Oluştur')
                  : (t('actions.generate') || 'Kod Oluştur')}
              </Text>
              {qrSettings.symbolType === 'barcode' && isBarcodeGenerateLocked && (
                <Ionicons name="lock-closed" size={18} color="#facc15" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {uiState.generating && (
          <View style={[styles.loadingContainer, compact ? { paddingVertical: 24 } : null]}>
            <ActivityIndicator size="large" color={dark ? '#4a9eff' : '#0066cc'} />
            <Text style={[styles.loadingText, { color: dark ? '#b1bac4' : '#4a5568' }]}>{t('generating') || 'Oluşturuluyor...'}</Text>
          </View>
        )}

        <QrPreviewSection
          uiState={uiState}
          compact={compact}
          qrRef={qrRef}
          showVisualFrame={showVisualFrame}
          qrSettings={qrSettings}
          qrSize={qrSize}
          showLogoControls={showLogoControls}
          showFrameControls={showFrameControls}
          logoOverlaySize={logoOverlaySize}
          isIconLogo={isIconLogo}
          iconLogoInfo={iconLogoInfo}
          hasFrameText={hasFrameText}
          frameLabelText={frameLabelText}
          onDownload={onDownload}
          onShare={onShare}
          t={t}
          dark={dark}
        />

      </ScrollView>

      <Toast
        visible={uiState.toast.visible}
        message={uiState.toast.message}
        type={uiState.toast.type}
        dark={dark}
        onHide={() =>
          updateUi({ toast: { ...uiState.toast, visible: false } })
        }
        style={{ bottom: toastBottomOffset }}
      />

      {uiState.iconPickerVisible ? (
        <IconPickerModal
          dark={dark}
          t={t}
          uiState={uiState}
          unlockState={unlockState}
          updateUi={updateUi}
          previewFrameColor={previewFrameColor}
          previewQrColor={previewQrColor}
          previewIcon={previewIcon}
          handleIconSelect={handleIconSelect}
          ICON_CATEGORIES={ICON_CATEGORIES}
          ICON_LIBRARY={ICON_LIBRARY}
        />
      ) : null}

      {uiState.colorPickerVisible ? (
        <ColorPickerModal
          dark={dark}
          t={t}
          uiState={uiState}
          qrSettings={qrSettings}
          updateUi={updateUi}
          updateQr={updateQr}
          onColorChange={onColorChange}
        />
      ) : null}

      {/* Unlock Success Modal */}
      <Modal visible={uiState.unlockModalVisible} animationType="fade" transparent onRequestClose={closeCustomGate}>
        <View style={styles.rewardOverlay}>
          <View style={[styles.rewardCard, { backgroundColor: dark ? '#111827' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
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
          <View style={[styles.rewardCard, { backgroundColor: dark ? '#111827' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
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
          <View style={[styles.rewardCard, { backgroundColor: dark ? '#111827' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
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
      <Modal
        visible={uiState.customGateVisible}
        animationType="fade"
        transparent
        onRequestClose={closeCustomGate}
      >
        <View style={styles.rewardOverlay}>
          <View style={[styles.rewardCard, { backgroundColor: dark ? '#111827' : '#fff', borderColor: dark ? '#1f2937' : '#e2e8f0' }]}>
            <TouchableOpacity
              onPress={closeCustomGate}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                backgroundColor: dark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
                borderWidth: 1,
                borderColor: dark ? '#1f2937' : '#e5e7eb',
                shadowColor: '#000',
                shadowOpacity: 0.14,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 5,
                zIndex: 20
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={18} color={dark ? '#e5e7eb' : '#4b5563'} />
            </TouchableOpacity>
            <View style={[styles.rewardHeader, { marginTop: 6 }]}>
              <Ionicons name="sparkles" size={22} color={dark ? '#facc15' : '#f59e0b'} />
              <Text style={[styles.rewardTitle, { color: dark ? '#e6edf3' : '#0f172a' }]}>{gateTitle}</Text>
            </View>
            <Text style={[styles.rewardSubtitle, { color: dark ? '#94a3b8' : '#475569' }]}>{gateDesc}</Text>

            {premiumBenefits.length > 0 && (
              <View style={{ marginTop: 12, marginBottom: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: dark ? '#1f2937' : '#e2e8f0', backgroundColor: dark ? 'rgba(15,23,42,0.6)' : 'rgba(241,245,249,0.65)' }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: dark ? '#e5e7eb' : '#0f172a', marginBottom: 6 }}>
                  {t('premium_benefits_title') || 'Premium ile'}
                </Text>
                {premiumBenefits.map((item, idx) => (
                  <View key={`${idx}-${item}`} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Ionicons name="checkmark-circle" size={16} color={dark ? '#22c55e' : '#16a34a'} style={{ marginRight: 8 }} />
                    <Text style={{ flex: 1, fontSize: 12, color: dark ? '#cbd5f5' : '#0b1220' }}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
            
            { (
            <TouchableOpacity
              style={[styles.premiumBtn, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderColor: 'rgba(236,72,153,0.7)', backgroundColor: 'rgba(236,72,153,0.26)', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 2 }]}
              onPress={handlePremiumNavigation}
              activeOpacity={0.9}
            >
              <Ionicons name="diamond" size={18} color={dark ? '#fce7f3' : '#be185d'} style={{ marginRight: 8 }} />
              <Text style={[styles.premiumText, { color: dark ? '#fce7f3' : '#9d174d', fontWeight: '800' }]}>{t('custom_qr_go_premium') || 'Premium planlarını gör'}</Text>
            </TouchableOpacity>
            )}

            {rewardedEnabled && (
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
            )}
          </View>
        </View>
      </Modal>

      <StatusModal
        visible={uiState.statusModal.visible}
        title={uiState.statusModal.title}
        message={uiState.statusModal.message}
        type={uiState.statusModal.type}
        onClose={() => updateUi({ statusModal: { ...uiState.statusModal, visible: false } })}
      />
    </View>
  );
}
