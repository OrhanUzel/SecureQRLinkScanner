import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Share, ScrollView, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import BarcodeScanning from '@react-native-ml-kit/barcode-scanning';
import { Ionicons } from '@expo/vector-icons';
import { classifyInput } from '../utils/classifier';
import { useAppTheme } from '../theme/ThemeContext';
import { useRoute } from '@react-navigation/native';
import AdBanner from '../components/AdBanner';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import ConfirmOpenLinkModal from '../components/ConfirmOpenLinkModal';
import Toast from '../components/Toast';

export default function ImageScanScreen() {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 360 || height < 640;
  const route = useRoute();
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [autoPickTriggered, setAutoPickTriggered] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const scanImageForCodes = async (uri) => {
    try {
      if (Platform.OS === 'web') {
        const { BrowserMultiFormatReader } = await import('@zxing/library');
        const reader = new BrowserMultiFormatReader();
        const zxResult = await reader.decodeFromImageUrl(uri);
        const data = zxResult?.getText?.();
        if (data) {
          setResult(classifyInput(data));
          setError(null);
        } else {
          setResult(null);
          setError(t('Bu görselde kod bulunamadı') || 'Bu görselde kod bulunamadı');
        }
      } else {
        const barcodes = await BarcodeScanning.scan(uri);
        if (barcodes && barcodes.length > 0) {
          const first = barcodes[0];
          const data = first?.value || first?.rawValue || first?.displayValue;
          if (data) {
            setResult(classifyInput(data));
            setError(null);
          } else {
            setResult(null);
            setError(t('Bu görselde kod bulunamadı') || 'Bu görselde kod bulunamadı');
          }
        } else {
          setResult(null);
          setError(t('Bu görselde kod bulunamadı') || 'Bu görselde kod bulunamadı');
        }
      }
    } catch (e) {
      setResult(null);
      setError(t('Bu görselde kod bulunamadı') || 'Bu görselde kod bulunamadı');
    }
  };

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(t('Medya izni gerekli') || 'Medya izni gerekli');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1
      });
      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;
      setImage(uri);
      await scanImageForCodes(uri);
    } catch (e) {
      setError('Görüntü seçerken bir sorun oluştu.');
    }
  };

  useEffect(() => {
    if (!autoPickTriggered && route?.params?.autoPick) {
      setAutoPickTriggered(true);
      // Defer to next tick to ensure screen is ready
      setTimeout(() => {
        pickImage();
      }, 0);
    }
  }, [route, autoPickTriggered]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb', padding: compact ? 12 : 20 }]}
      contentContainerStyle={{ gap: 12 }}
    > 
      <TouchableOpacity style={styles.button} onPress={pickImage}>
        <Ionicons name="images" size={18} color="#fff" />
        <Text style={styles.buttonText}>{t('scan.image')}</Text>
      </TouchableOpacity>
      {image && (
        <Image source={{ uri: image }} style={styles.preview} />
      )}
      {error && (
        <Text style={{ color: dark ? '#ffb3b3' : '#b00020' }}>{error}</Text>
      )}
      {result && (
        <View style={[styles.card, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea' }]}> 
          <Text style={[styles.linkText, { color: dark ? '#9ecaff' : '#0b1220' }]} selectable>{result.normalized}</Text>
          <RiskBadge level={result.level} />
          {result.reasons?.length ? (
            <View style={styles.reasonList}>
              {result.reasons.map((r, idx) => (
                <Text key={idx} style={{ color: dark ? '#8b98a5' : '#3b4654' }}>• {t(r)}</Text>
              ))}
            </View>
          ) : null}
          <View style={styles.actionsGrid}>
            {result.isUrl && (
              <TouchableOpacity 
                style={[styles.tile, { backgroundColor: '#2da44e' }]} 
                onPress={() => { const raw = result.normalized.startsWith('http') ? result.normalized : 'https://' + result.normalized; setPendingUrl(raw); setConfirmVisible(true); }}
                activeOpacity={0.85}
              >
                <Ionicons name="open-outline" size={20} color="#fff" />
                <Text style={styles.tileLabel}>{t('actions.openLink') || 'Linki Aç'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.tile, { backgroundColor: '#334155' }]} 
              onPress={async () => { try { await Clipboard.setStringAsync(result.normalized); setToastMsg(t('toast.copied')); setToastVisible(true); } catch {} }}
              activeOpacity={0.85}
            >
              <Ionicons name="copy-outline" size={20} color="#fff" />
              <Text style={styles.tileLabel}>{t('actions.copy') || 'Kopyala'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tile, { backgroundColor: '#6c5ce7' }]} 
              onPress={async () => { try { await Share.share({ message: result.normalized }); } catch {} }}
              activeOpacity={0.85}
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={styles.tileLabel}>{t('actions.share') || 'Paylaş'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tile, { backgroundColor: '#8250df' }]} 
              onPress={() => { try { const urlObj = new URL(result.normalized.startsWith('http') ? result.normalized : 'https://' + result.normalized); const domain = urlObj.hostname; const vt = 'https://www.virustotal.com/gui/domain/' + encodeURIComponent(domain); setPendingUrl(vt); setConfirmVisible(true); } catch { const domain = result.normalized.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]; const vt = 'https://www.virustotal.com/gui/domain/' + encodeURIComponent(domain); setPendingUrl(vt); setConfirmVisible(true); } }}
              activeOpacity={0.85}
            >
              <Ionicons name="search-outline" size={20} color="#fff" />
              <Text style={styles.tileLabel}>VirusTotal</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <AdBanner placement="image" />
      <ConfirmOpenLinkModal
        visible={confirmVisible}
        url={pendingUrl}
        onConfirm={async () => { setConfirmVisible(false); if (pendingUrl) { try { await Linking.openURL(pendingUrl); } catch {} } setPendingUrl(null); }}
        onCancel={() => { setConfirmVisible(false); setPendingUrl(null); }}
      />
      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} dark={dark} />
    </ScrollView>
  );
}

function RiskBadge({ level }) {
  let color = '#2f9e44', text = 'result.secure', icon = 'shield-checkmark';
  if (level === 'suspicious') { color = '#ffb703'; text = 'result.suspicious'; icon = 'warning'; }
  if (level === 'unsafe') { color = '#d00000'; text = 'result.unsafe'; icon = 'shield'; }
  const { t } = useTranslation();
  return (
    <View style={[styles.badge, { backgroundColor: color }]}> 
      <Ionicons name={icon} size={16} color="#fff" />
      <Text style={styles.badgeText}>{t(text)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  button: { backgroundColor: '#0066cc', borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  linkText: { fontSize: 14, fontWeight: '600' },
  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  badgeText: { color: '#fff', fontWeight: '700' },
  reasonList: { gap: 4 }
  ,actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }
  ,tile: { width: '48%', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }
  ,tileLabel: { color: '#fff', fontWeight: '700' }
});