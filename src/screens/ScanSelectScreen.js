import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { classifyInput } from '../utils/classifier';
import { useAppTheme } from '../theme/ThemeContext';

export default function ScanSelectScreen({ navigation }) {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [scanner, setScanner] = useState(null);
  const [scannerReady, setScannerReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { scanFromURLAsync } = await import('expo-barcode-scanner');
        if (mounted) { setScanner({ scanFromURLAsync }); setScannerReady(true); }
      } catch (e) {
        if (mounted) { setScanner(null); setScannerReady(false); }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const pickAndScanImage = async () => {
    try {
      const { status, granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted || status !== 'granted') {
        Alert.alert('İzin gerekli', 'Fotoğraflara erişmek için medya kütüphanesi iznine izin verin.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
      if (res.canceled) return;
      const uri = res.assets[0].uri;
      setImage(uri);
      if (!scannerReady || !scanner || typeof scanner.scanFromURLAsync !== 'function') {
        Alert.alert('Modül hazır değil', 'Görüntüden tarama için gerekli modül yüklenmemiş veya Expo Go ile uyumlu değil. Geliştirme derlemesi (npx expo run:android) önerilir.');
        setResult(null);
        return;
      }
      const codes = await scanner.scanFromURLAsync(uri, {
        barCodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'code39', 'code128']
      });
      if (codes && codes.length > 0 && codes[0]?.data) {
        setResult(classifyInput(codes[0].data));
      } else {
        setResult(null);
      }
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Görüntü seçme veya tarama sırasında bir sorun oluştu.');
      setResult(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}> 
      <Text style={[styles.title, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('scan.select.title')}</Text>
      <View style={styles.grid}>
        <BlurView intensity={30} tint={dark ? 'dark' : 'light'} style={styles.card}>
          <TouchableOpacity style={styles.cardInner} onPress={() => navigation.navigate('LinkScan')}>
            <Ionicons name="link" size={32} color={dark ? '#9ecaff' : '#0066cc'} />
            <Text style={[styles.cardText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('scan.link')}</Text>
          </TouchableOpacity>
        </BlurView>
        <BlurView intensity={30} tint={dark ? 'dark' : 'light'} style={styles.card}>
          <TouchableOpacity style={styles.cardInner} onPress={() => navigation.navigate('CodeScan')}>
            <Ionicons name="qr-code" size={32} color={dark ? '#b9f3b6' : '#2f9e44'} />
            <Text style={[styles.cardText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('scan.code')}</Text>
          </TouchableOpacity>
        </BlurView>
        <BlurView intensity={30} tint={dark ? 'dark' : 'light'} style={styles.card}>
          <TouchableOpacity style={styles.cardInner} onPress={pickAndScanImage}>
            <Ionicons name="image" size={32} color={dark ? '#ffd479' : '#d9480f'} />
            <Text style={[styles.cardText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('scan.image')}</Text>
          </TouchableOpacity>
        </BlurView>
        <BlurView intensity={30} tint={dark ? 'dark' : 'light'} style={styles.card}>
          <TouchableOpacity style={styles.cardInner} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={32} color={dark ? '#c1b6ff' : '#6c5ce7'} />
            <Text style={[styles.cardText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('settings.title')}</Text>
          </TouchableOpacity>
        </BlurView>
      </View>

      {image && (
        <Image source={{ uri: image }} style={[styles.preview, { borderColor: dark ? '#1b2330' : '#dde3ea' }]} />
      )}

      {result && (
        <View style={[styles.resultCard, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea' }]}> 
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
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: '700', marginVertical: 16, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  cardInner: { paddingVertical: 24, alignItems: 'center', gap: 8 },
  cardText: { fontSize: 16, fontWeight: '600' },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 12, borderWidth: 1 },
  resultCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, marginTop: 12 },
  linkText: { fontSize: 14, fontWeight: '600' },
  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  badgeText: { color: '#fff', fontWeight: '700' },
  reasonList: { gap: 4 }
});