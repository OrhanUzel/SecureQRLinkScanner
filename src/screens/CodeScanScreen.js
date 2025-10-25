import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { classifyInput } from '../utils/classifier';

export default function CodeScanScreen() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const cameraRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facing, setFacing] = useState('back');

  useEffect(() => {
    (async () => {
      if (!permission || !permission.granted) {
        await requestPermission();
      }
    })();
  }, [permission]);

  const saveHistory = async (item) => {
    try {
      const raw = await AsyncStorage.getItem('scan_history');
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift({ ...item, timestamp: Date.now() });
      await AsyncStorage.setItem('scan_history', JSON.stringify(arr.slice(0, 50)));
    } catch {}
  };

  const onBarcodeScanned = (ev) => {
    const data = ev?.data ?? (Array.isArray(ev?.barcodes) ? ev.barcodes[0]?.data : undefined);
    if (!data) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const res = classifyInput(data);
    setResult(res);
    saveHistory({ content: res.normalized, level: res.level });
  };

  const openLink = () => {
    if (!result?.normalized) return;
    if (result.normalized.startsWith('http')) Linking.openURL(result.normalized);
  };

  const shareText = async () => {
    if (!result?.normalized) return;
    try { await Share.share({ message: result.normalized }); } catch {}
  };

  if (!permission) {
    return <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]} />;
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ color: dark ? '#e6edf3' : '#0b1220' }}>{t('We need your permission to show the camera') || 'We need your permission to show the camera'}</Text>
        <TouchableOpacity style={[styles.badge, { backgroundColor: '#0066cc' }]} onPress={requestPermission}>
          <Text style={styles.badgeText}>Grant permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'code39', 'code128'] }}
        onBarcodeScanned={onBarcodeScanned}
      />

      {/* üst kontrol tuşları */}
      <View style={styles.topBar}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: torchOn ? '#ffb703' : (dark ? '#10151c' : '#fff'), borderColor: dark ? '#1b2330' : '#dde3ea' }]} onPress={() => setTorchOn(v => !v)}>
          <Ionicons name="flashlight" size={18} color={torchOn ? '#000' : (dark ? '#e6edf3' : '#0b1220')} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea' }]} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
          <Ionicons name="camera-reverse" size={18} color={dark ? '#e6edf3' : '#0b1220'} />
        </TouchableOpacity>
      </View>

      {/* tarama kılavuzu */}
      <View pointerEvents="none" style={styles.guideWrap}>
        <View style={[styles.guideBox, { borderColor: dark ? '#9ecaff' : '#0066cc' }]} />
        <Text style={[styles.guideText, { color: dark ? '#e6edf3' : '#0b1220' }]}>QR kodu çerçeve içine hizalayın</Text>
      </View>

      {result && (
        <View style={[styles.overlay, { backgroundColor: dark ? 'rgba(16,21,28,0.92)' : 'rgba(255,255,255,0.92)', borderColor: dark ? '#1b2330' : '#dde3ea' }]}> 
          <Text style={[styles.linkText, { color: dark ? '#9ecaff' : '#0b1220' }]}>{result.normalized}</Text>
          <RiskBadge level={result.level} />
          {result.reasons?.length ? (
            <View style={styles.reasonList}>
              {result.reasons.map((r, idx) => (
                <Text key={idx} style={{ color: dark ? '#8b98a5' : '#3b4654' }}>• {t(r)}</Text>
              ))}
            </View>
          ) : null}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#2f9e44' }]} onPress={openLink}>
              <Ionicons name="open" size={16} color="#fff" />
              <Text style={styles.smallBtnText}>{t('actions.openLink')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#6c5ce7' }]} onPress={shareText}>
              <Ionicons name="share" size={16} color="#fff" />
              <Text style={styles.smallBtnText}>{t('actions.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#d9480f' }]} onPress={() => setResult(null)}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.smallBtnText}>{t('actions.scan')}</Text>
            </TouchableOpacity>
          </View>
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
  container: { flex: 1 },
  camera: { flex: 1 },
  topBar: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', gap: 8 },
  iconBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  guideWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  guideBox: { width: 260, height: 260, borderWidth: 2, borderRadius: 16 },
  guideText: { marginTop: 12, fontWeight: '600' },
  overlay: { position: 'absolute', left: 12, right: 12, bottom: 12, padding: 12, gap: 8, borderWidth: 1, borderRadius: 12 },
  linkText: { fontSize: 14, fontWeight: '600' },
  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  badgeText: { color: '#fff', fontWeight: '700' },
  reasonList: { gap: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  smallBtnText: { color: '#fff', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});