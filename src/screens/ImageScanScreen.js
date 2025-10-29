import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { classifyInput } from '../utils/classifier';
import { useAppTheme } from '../theme/ThemeContext';

export default function ImageScanScreen() {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const scanImageForCodes = async (uri) => {
    try {
      const { scanFromURLAsync } = await import('expo-barcode-scanner');
      const codes = await scanFromURLAsync(uri, {
        barCodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'code39', 'code128']
      });
      if (codes && codes.length > 0 && codes[0]?.data) {
        const data = codes[0].data;
        setResult(classifyInput(data));
        setError(null);
      } else {
        setResult(null);
        setError(t('Bu görselde kod bulunamadı') || 'Bu görselde kod bulunamadı');
      }
    } catch (e) {
      setResult(null);
      setError('Bu Expo çalışma ortamında barkod modülü yüklü değil. Geliştirme derlemesi (expo run:android) veya APK ile çalıştırın.');
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: [ImagePicker.MediaType.IMAGE], quality: 1 });
    if (!res.canceled) {
      const uri = res.assets[0].uri;
      setImage(uri);
      await scanImageForCodes(uri);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}> 
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
          <Text style={[styles.linkText, { color: dark ? '#9ecaff' : '#0b1220' }]}>{result.normalized}</Text>
          <RiskBadge level={result.level} />
          {result.reasons?.length ? (
            <View style={styles.reasonList}>
              {result.reasons.map((r, idx) => (
                <Text key={idx} style={{ color: dark ? '#8b98a5' : '#3b4654' }}>• {t(r)}</Text>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
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
  container: { flex: 1, padding: 20, gap: 12 },
  button: { backgroundColor: '#0066cc', borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  linkText: { fontSize: 14, fontWeight: '600' },
  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  badgeText: { color: '#fff', fontWeight: '700' },
  reasonList: { gap: 4 }
});