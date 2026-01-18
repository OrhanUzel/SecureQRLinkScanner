import React, { useState, useLayoutEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Alert, Modal, Share, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { rewardedUnitId, interstitialUnitId, rewardedInterstitialUnitId } from '../config/adUnitIds';
import { detectGs1Country } from '../utils/countryHelper';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import ConfirmOpenLinkModal from '../components/ConfirmOpenLinkModal';
import Toast from '../components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openExternalUrl } from '../utils/linkActions';
import AdvancedAdCard from '../components/AdvancedAdCard';

// Memoized Item Component to prevent unnecessary re-renders
const HistoryItem = React.memo(({ 
  item, 
  index, 
  dark, 
  t, 
  onDelete, 
  onOpenLink, 
  onCopy, 
  onShareWifi, 
  onCopyWifi, 
  onGoogleSearch 
}) => {
  const getLevelInfo = (level) => {
    if (level === 'secure') return { text: t('result.secure'), color: '#2f9e44', icon: 'shield-checkmark' };
    if (level === 'suspicious') return { text: t('result.suspicious'), color: '#ffb703', icon: 'warning' };
    if (level === 'unsafe') return { text: t('result.unsafe'), color: '#d00000', icon: 'shield' };
    return { text: level || 'Bilinmiyor', color: '#6e7781', icon: 'help-circle' };
  };

  const levelInfo = getLevelInfo(item.level);
  const cleanContent = item.content ? String(item.content).trim() : '';
  const upperContent = cleanContent.toUpperCase();
  const contentType = (item.contentType || item.type || '').toString().toLowerCase();
  const isWifi = contentType === 'wifi' || upperContent.startsWith('WIFI:');
  const isUrl = !isWifi && !!(cleanContent && (cleanContent.startsWith('http://') || cleanContent.startsWith('https://') || cleanContent.includes('.')));
  
  const wifi = isWifi ? (item.wifi || null) : null;
  const wifiSsid = wifi?.ssid || '';
  const wifiSecurity = wifi?.security || '';
  const wifiPassword = wifi?.password || '';
  const wifiHidden = typeof wifi?.hidden === 'boolean' ? wifi.hidden : null;
  const wifiTitle = wifiSsid ? `Wi‑Fi: ${wifiSsid}` : 'Wi‑Fi';

  // Enhanced barcode detection
  const isNumeric = /^\d+$/.test(cleanContent);
  const len = cleanContent.length;
  const isBarcode = !isWifi && ((item.type && ['ean13', 'ean8', 'upc_a', 'code39', 'code128'].includes(item.type.toLowerCase())) ||
                    (isNumeric && (len === 8 || len === 12 || len === 13)));
  const isSms = !isWifi && (contentType === 'sms' || upperContent.startsWith('SMSTO:'));
  const isEmail = !isWifi && (contentType === 'email' || cleanContent.startsWith('mailto:') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanContent));
  const isTel = !isWifi && (contentType === 'tel'  );

  let country = item.country;
  if (!country && isBarcode) {
    country = detectGs1Country(cleanContent, t);
  }
  
  return (
    <View style={[styles.item, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea' }]}> 
      <View style={styles.itemHeader}>
        <Text
          style={[styles.itemContent, { color: dark ? '#9ecaff' : '#0b1220' }]}
          numberOfLines={2}
        >
          {isWifi ? wifiTitle : item.content}
        </Text>
        <TouchableOpacity
          onPress={() => onDelete(index)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.deleteBtn, { backgroundColor: dark ? '#2b323f' : '#f4f6f8' }]}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={18} color={dark ? '#ff6b6b' : '#d00000'} />
        </TouchableOpacity>
      </View>
      <View style={styles.itemRow}>
        {isWifi ? (
          <View style={[styles.levelBadge, { backgroundColor: '#0f766e' }]}>
            <Ionicons name="wifi-outline" size={16} color="#fff" />
            <Text style={styles.levelText}>{t('label.wifi') || 'Wi‑Fi'}</Text>
          </View>
        ) : isSms ? (
          <View style={[styles.levelBadge, { backgroundColor: '#06b6d4' }]}>
            <Ionicons name="chatbubble-outline" size={16} color="#fff" />
            <Text style={styles.levelText}>{t('label.sms') || 'SMS'}</Text>
          </View>
        ) : isEmail ? (
          <View style={[styles.levelBadge, { backgroundColor: '#2563eb' }]}>
            <Ionicons name="mail-outline" size={16} color="#fff" />
            <Text style={styles.levelText}>{t('label.email') || 'E‑posta'}</Text>
          </View>
        ) : isTel ? (
          <View style={[styles.levelBadge, { backgroundColor: '#22c55e' }]}>
            <Ionicons name="call-outline" size={16} color="#fff" />
            <Text style={styles.levelText}>{t('label.phone') || 'Telefon'}</Text>
          </View>
        ) : isBarcode ? (
          <View style={[styles.levelBadge, { backgroundColor: '#b80ddfff' }]}>
            <Ionicons name="barcode-outline" size={16} color="#fff" />
            <Text style={[styles.levelText, styles.badgeLabel]}>{t('scan.barcodeDetected') || 'Barkod'}</Text>
            {country && (
              <>
                <View style={{ width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 6 }} />
                <Text style={{ fontSize: 14 }}>{country.flag}</Text>
                <Text style={styles.countryText}>{country.name}</Text>
              </>
            )}
          </View>
        ) : (
          <View style={[styles.levelBadge, { backgroundColor: levelInfo.color }]}>
            <Ionicons name={levelInfo.icon} size={16} color="#fff" />
            <Text style={styles.levelText}>{levelInfo.text}</Text>
          </View>
        )}
      </View>
      {isWifi && (
        <View style={[styles.wifiDetails, { backgroundColor: dark ? '#0b0f14' : '#f4f6f8', borderColor: dark ? '#1b2330' : '#dde3ea' }]}>
          <Text style={[styles.wifiDetailText, { color: dark ? '#c9d1d9' : '#24292f' }]}>
            {(t('wifi.ssid') || 'SSID') + ': '} {wifiSsid || '-'}
          </Text>
          <Text style={[styles.wifiDetailText, { color: dark ? '#c9d1d9' : '#24292f' }]}>
            {(t('wifi.security') || 'Güvenlik') + ': '} {wifiSecurity || '-'}
          </Text>
          <Text style={[styles.wifiDetailText, { color: dark ? '#c9d1d9' : '#24292f' }]}>
            {(t('wifi.hidden') || 'Gizli') + ': '} {wifiHidden === null ? '-' : (wifiHidden ? (t('confirm.yes') || 'Evet') : (t('confirm.no') || 'Hayır'))}
          </Text>
          <Text style={[styles.wifiDetailText, { color: dark ? '#c9d1d9' : '#24292f' }]}>
            {(t('wifi.password') || 'Şifre') + ': '} {wifiPassword || '-'}
          </Text>
        </View>
      )}
      {isBarcode && country && country.key === 'country.israel' && (
        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: dark ? '#1f2937' : '#1f2937' }]}>
            <Text style={styles.tagText}>#FreePalestine</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: dark ? '#1f2937' : '#1f2937' }]}>
            <Text style={styles.tagText}>#BoycottIsrael</Text>
          </View>
        </View>
      )}
      <View style={styles.timestampRow}>
        <Text style={[styles.timestamp, { color: dark ? '#8b98a5' : '#3b4654' }]}>
          {item.timestamp ? new Date(item.timestamp).toLocaleString('tr-TR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : ''}
        </Text>
      </View>
      {isUrl && (
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.openButton, { backgroundColor: dark ? '#6c5ce7' : '#6c5ce7' }]}
            onPress={() => {
              const url = item.content.startsWith('http') ? item.content : `https://${item.content}`;
              onOpenLink(url);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="open-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>{t('actions.openLink')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.copyButton, { backgroundColor: dark ? '#2f9e44' : '#2f9e44' }]}
            onPress={() => onCopy(item.content)}
            activeOpacity={0.8}
          >
            <Ionicons name="copy" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>{t('actions.copy')}</Text>
          </TouchableOpacity>
        </View>
      )}
      {isWifi && (
        <View style={styles.buttonRow}>
           <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: dark ? '#6c5ce7' : '#6c5ce7', opacity: wifiPassword ? 1 : 0.5 }]}
            onPress={() => onShareWifi(wifiPassword)}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>{t('actions.share') || 'Paylaş'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: dark ? '#2f9e44' : '#2f9e44', opacity: wifiPassword ? 1 : 0.5 }]}
            onPress={() => onCopyWifi(wifiPassword)}
            activeOpacity={0.8}
          >
            <Ionicons name="key-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>{t('actions.copyWifiPassword') || 'Wi‑Fi Şifresini Kopyala'}</Text>
          </TouchableOpacity>
 
        </View>
      )}
      {isBarcode && (
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.googleButton]}
            onPress={() => onGoogleSearch(item.content)}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>{t('actions.searchGoogle') || 'Google\'da Ara'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.copyButton, { backgroundColor: dark ? '#2f9e44' : '#2f9e44' }]}
            onPress={() => onCopy(item.content)}
            activeOpacity={0.8}
          >
            <Ionicons name="copy" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>{t('actions.copy')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to ensure strict equality check on item content/props
  return prevProps.item === nextProps.item && 
         prevProps.dark === nextProps.dark && 
         prevProps.index === nextProps.index;
});

// Memoized Header Component
const HistoryListHeader = React.memo(() => (
  <View style={{ marginBottom: 8 }}>
     <AdvancedAdCard placement="history_top" />
  </View>
));

export default function HistoryScreen() {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const ALWAYS_CONFIRM_LINK_KEY = 'always_confirm_link';

  const getAlwaysConfirmLink = async () => {
    try {
      const v = await AsyncStorage.getItem(ALWAYS_CONFIRM_LINK_KEY);
      return v === null ? true : v === 'true';
    } catch {
      return true;
    }
  };

  const deleteItem = useCallback(async (index) => {
    try {
      const updated = items.filter((_, i) => i !== index);
      setItems(updated);
      await AsyncStorage.setItem('scan_history', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to delete history item:', err);
      Alert.alert('Hata', 'Kayıt silinemedi: ' + err.message);
    }
  }, [items]);

  const load = useCallback(async () => {
    try {
      // Don't set loading(true) here to avoid flash on re-focus
      // If it's the very first load, 'loading' is already true from useState
      const raw = await AsyncStorage.getItem('scan_history');
      setItems(raw ? JSON.parse(raw) : []);
    } catch (err) {
      console.error('Failed to load history:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('scan_history');
      setItems([]);
      setToastMsg(t('settings.historyCleared') || 'Geçmiş temizlendi');
      setToastVisible(true);
    } catch (err) {
      Alert.alert('Hata', 'Geçmiş temizlenemedi: ' + err.message);
    }
  }, [t]);

  const confirmClearAll = useCallback(() => {
    if (!items.length) return;
    setClearModalVisible(true);
  }, [items.length]);

  // Replace useEffect with useFocusEffect to refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Set header right button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          style={Platform.OS === 'ios' ? styles.clearBtnIOS : styles.clearBtn} 
          onPress={confirmClearAll}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="trash-outline" 
            size={Platform.OS === 'ios' ? 22 : 16} 
            color={Platform.OS === 'ios' ? '#d00000' : '#fff'} 
            style={{ marginRight: 6 }} 
          />
          <Text style={Platform.OS === 'ios' ? styles.clearTextIOS : styles.clearText}>{t('history.clear')}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, t, confirmClearAll]);

  const handleCopy = useCallback(async (content) => {
    try {
      await Clipboard.setStringAsync(content);
      setToastMsg(t('toast.copied'));
      setToastVisible(true);
    } catch (e) {
      Alert.alert('Hata', 'Kopyalanamadı: ' + e.message);
    }
  }, [t]);

  const handleShareWifi = useCallback(async (password) => {
    if (!password) return;
    try {
      await Share.share({ message: password });
    } catch {}
  }, []);

  const handleCopyWifi = useCallback(async (password) => {
    if (!password) return;
    try {
      await Clipboard.setStringAsync(password);
      setToastMsg(t('toast.copied'));
      setToastVisible(true);
    } catch (e) {
      Alert.alert('Hata', 'Kopyalanamadı: ' + e.message);
    }
  }, [t]);

  const handleGoogleSearch = useCallback(async (content) => {
    const url = `https://www.google.com/search?q=${encodeURIComponent(content)}`;
    try { 
      await openExternalUrl(url); 
    } catch (e) { 
      Alert.alert('Hata', 'Link açılamadı: ' + e.message); 
    }
  }, []);

  const handleOpenLink = useCallback(async (url) => {
    const shouldConfirm = await getAlwaysConfirmLink();
    if (shouldConfirm) {
      setPendingUrl(url);
      setConfirmVisible(true);
      return;
    }
    try {
      await openExternalUrl(url);
    } catch (e) {
      Alert.alert('Hata', 'Link açılamadı: ' + e.message);
    }
  }, []);

  const renderItem = useCallback(({ item, index }) => (
    <HistoryItem 
      item={item} 
      index={index} 
      dark={dark} 
      t={t}
      onDelete={deleteItem}
      onOpenLink={handleOpenLink}
      onCopy={handleCopy}
      onShareWifi={handleShareWifi}
      onCopyWifi={handleCopyWifi}
      onGoogleSearch={handleGoogleSearch}
    />
  ), [dark, t, deleteItem, handleOpenLink, handleCopy, handleShareWifi, handleCopyWifi, handleGoogleSearch]);

  const keyExtractor = useCallback((item, index) => {
    // Use content and timestamp as key if available, otherwise fallback to index
    // Adding index ensures uniqueness if duplicate items exist
    return item.timestamp ? `${item.timestamp}-${index}` : String(index);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#e9edf3' }]}> 
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={dark ? '#67e8f9' : '#0284c7'} />
        </View>
      ) : (
      <FlatList
        style={{}}
        data={items}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 ? styles.emptyContainer : null,
          { paddingBottom: Math.max(insets.bottom + 2, 5) }
        ]}
        ListHeaderComponent={items.length > 0 ? HistoryListHeader : null}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]}>
              <Ionicons name="time-outline" size={64} color={dark ? '#3b4654' : '#8b98a5'} />
            </View>
            <Text style={[styles.emptyTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
              {t('history.empty.title')}
            </Text>
            <Text style={[styles.emptyDesc, { color: dark ? '#8b98a5' : '#5c6a7a' }]}>
              {t('history.empty.desc')}
            </Text>
            <TouchableOpacity 
              style={[styles.emptyButton, { backgroundColor: dark ? '#0969da' : '#0969da' }]}
              onPress={() => navigation.navigate('Home')}
            >
              <Ionicons name="scan-outline" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>{t('actions.scan')}</Text>
            </TouchableOpacity>
          </View>
        )}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
      />
      )}

      <ConfirmOpenLinkModal 
        visible={confirmVisible}
        url={pendingUrl}
        onConfirm={async () => {
          setConfirmVisible(false);
          if (pendingUrl) {
            try { 
              await openExternalUrl(pendingUrl); 
            } catch (e) { 
              Alert.alert('Hata', 'Link açılamadı: ' + e.message); 
            }
          }
          setPendingUrl(null);
        }}
        onCancel={() => { 
          setConfirmVisible(false); 
          setPendingUrl(null); 
        }}
      />
      <Modal visible={clearModalVisible} animationType="fade" transparent>
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
                onPress={() => setClearModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalBtnOutlineText, { color: dark ? '#c9d1d9' : '#24292f' }]}>{t('actions.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: dark ? '#d00000' : '#d00000' }]}
                onPress={async () => {
                  setClearModalVisible(false);
                  await clear();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnText}>{t('actions.delete')}</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
      <Toast 
        visible={toastVisible}
        message={toastMsg}
        onHide={() => setToastVisible(false)}
        dark={dark}
        style={{ bottom: Math.max(insets.bottom + 72, 72) }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1,},
  emptyContainer: { flex: 1, justifyContent: 'center', minHeight: 400 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
    marginTop: 20
  },
  emptyIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#d00000', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  clearBtnIOS: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  clearText: { color: '#fff', fontWeight: '700' },
  clearTextIOS: { color: '#d00000', fontWeight: '600', fontSize: 17 },
  item: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, overflow: 'hidden' },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemContent: { fontWeight: '600', fontSize: 15, marginBottom: 4, flex: 1, flexShrink: 1 },
  deleteBtn: { padding: 6, borderRadius: 8, alignSelf: 'flex-start' },
  listContent: { paddingHorizontal: 20, paddingTop: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginTop: 4 },
  levelBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    borderRadius: 999,
    maxWidth: '100%',
    flexShrink: 1
  },
  levelText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  badgeLabel: { maxWidth: 180 },
  countryText: { color: '#fff', fontWeight: '700', fontSize: 13, marginLeft: 4, maxWidth: 120 },
  timestampRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  timestamp: { fontSize: 11, textAlign: 'right' },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  googleButton: { backgroundColor: '#6c5ce7' },
  wifiDetails: { padding: 10, borderRadius: 10, borderWidth: 1, gap: 4 },
  wifiDetailText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  tag: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  tagText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  actionButton: {
    flex: 1,
    minWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8
  },
  openButton: {
    backgroundColor: '#0969da'
  },
  copyButton: {
    backgroundColor: '#2f9e44'
  },
  actionButtonText: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 14 
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 24 },
  modalCard: { width: '92%', maxWidth: 480, borderRadius: 16, padding: 16, borderWidth: 1, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalMessage: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, minWidth: 120, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '700' },
  modalBtnOutline: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, minWidth: 120, alignItems: 'center' },
  modalBtnOutlineText: { fontWeight: '700' }
});
