import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Share, ScrollView, useWindowDimensions, Animated, Modal, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import BarcodeScanning from '@react-native-ml-kit/barcode-scanning';
import { Ionicons } from '@expo/vector-icons';
import { classifyInput } from '../utils/classifier';
import { checkRisk } from '../utils/riskcheck';
import { useAppTheme } from '../theme/ThemeContext';
import { useRoute, useNavigation } from '@react-navigation/native';
import AdBanner from '../components/AdBanner';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import ConfirmOpenLinkModal from '../components/ConfirmOpenLinkModal';
import AdvancedAdCard from '../components/AdvancedAdCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from '../components/Toast';

export default function ImageScanScreen() {
  const { t } = useTranslation();
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

  const scanImageForCodes = async (uri) => {
    try {
      setLoading(true);
      if (Platform.OS === 'web') {
        const { BrowserMultiFormatReader } = await import('@zxing/library');
        const reader = new BrowserMultiFormatReader();
        const zxResult = await reader.decodeFromImageUrl(uri);
        const data = zxResult?.getText?.();
        if (data) {
          const res = classifyInput(data);
          let updated = res;
          try {
            if (res.isUrl) {
              const remote = await checkRisk(res.normalized);
              if (remote?.error) { setOffline(true); } else { setOffline(false); }
              if (remote?.isRisky) {
                const domainInfo = t('remoteRisk.checkedDomainLabel') + ' ' + (remote?.checkedDomain || res.normalized);
                const sources = t('remoteRisk.sourcesLabel') + ' ' + ((remote?.foundInFiles || []).join(', ') || '-');
                const reasons = [ ...(res.reasons || []), 'remoteRisk.defaultMessage', domainInfo, sources ];
                updated = { ...res, level: 'unsafe', reasons };
              }
            }
          } catch {
            setOffline(true);
          }
          setResult(updated);
          setError(null);
        } else {
          setResult(null);
          setError(t('scan.noCodeFound') || 'Bu görselde kod bulunamadı');
        }
      } else {
        const barcodes = await BarcodeScanning.scan(uri);
        if (barcodes && barcodes.length > 0) {
          const first = barcodes[0];
          const data = first?.value || first?.rawValue || first?.displayValue;
          if (data) {
            const res = classifyInput(data);
            let updated = res;
            try {
              if (res.isUrl) {
                const remote = await checkRisk(res.normalized);
                if (remote?.error) { setOffline(true); } else { setOffline(false); }
                if (remote?.isRisky) {
                  const domainInfo = t('remoteRisk.checkedDomainLabel') + ' ' + (remote?.checkedDomain || res.normalized);
                  const sources = t('remoteRisk.sourcesLabel') + ' ' + ((remote?.foundInFiles || []).join(', ') || '-');
                  const reasons = [ ...(res.reasons || []), 'remoteRisk.defaultMessage', domainInfo, sources ];
                  updated = { ...res, level: 'unsafe', reasons };
                }
              }
            } catch {
              setOffline(true);
            }
            setResult(updated);
            setError(null);
          } else {
            setResult(null);
            setError(t('scan.noCodeFound') || 'Bu görselde kod bulunamadı');
          }
        } else {
          setResult(null);
          setError(t('scan.noCodeFound') || 'Bu görselde kod bulunamadı');
        }
      }
    } catch (e) {
      setResult(null);
      setError(t('scan.noCodeFound') || 'Bu görselde kod bulunamadı');
    } finally {
      setLoading(false);
    }
  };

  const startImageSelection = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (res.canceled) return;
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    setImage(uri);
    await scanImageForCodes(uri);
  };

  const pickImage = async () => {
    try {
      const androidVer = Platform.OS === 'android' ? Platform.Version : null;
      const usePhotoPicker = Platform.OS === 'android' && typeof androidVer === 'number' && androidVer >= 33;

      if (usePhotoPicker) {
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
      setError('Görüntü seçerken bir sorun oluştu.');
    }
  };

  useEffect(() => {
    (async () => { try { const v = await AsyncStorage.getItem('media_consent'); setHasConsent(v === 'true'); } catch {} })();
    if (!autoPickTriggered && route?.params?.autoPick) {
      setAutoPickTriggered(true);
      // Defer to next tick to ensure screen is ready
      setTimeout(() => {
        pickImage();
      }, 0);
    }
  }, [route, autoPickTriggered]);

  const resetScan = async () => {
    setImage(null);
    setResult(null);
    setError(null);
    await pickImage();
  };

  const goToHome = () => {
    if (navigation) {
      navigation.navigate('Home');
    }
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView 
      style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb', padding: compact ? 12 : 20 }]}
      contentContainerStyle={{ gap: 12, paddingBottom: compact ? 48 : 72 }}
      showsVerticalScrollIndicator={false}
    > 
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlayModal}>
          <View style={[styles.loadingCard, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea' }]}> 
            <ActivityIndicator size="large" color={dark ? '#9ecaff' : '#0969da'} />
            <Text style={[styles.loadingText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('loading.securityChecks')}</Text>
          </View>
        </View>
      </Modal>
      
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
            <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>Yeniden Tara</Text>
          </TouchableOpacity>
          {navigation && (
            <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]} onPress={goToHome}>
              <Ionicons name="home-outline" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
              <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>Ana Menü</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {error && !result && (
        <AdvancedAdCard placement="image_scan_bottom" />
      )}
      {result && (
        <>
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
              {(result.isUrl || (/^([a-z]+:\/\/)/i.test(result.normalized) || /^(www\.)?[\w-]+\.[A-Za-z]{2,}/.test(result.normalized))) && (
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
                onPress={async () => { try { const urlObj = new URL(result.normalized.startsWith('http') ? result.normalized : 'https://' + result.normalized); const domain = urlObj.hostname; const vt = 'https://www.virustotal.com/gui/domain/' + encodeURIComponent(domain); await Linking.openURL(vt); } catch { const domain = result.normalized.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]; const vt = 'https://www.virustotal.com/gui/domain/' + encodeURIComponent(domain); try { await Linking.openURL(vt); } catch {} } }}
                activeOpacity={0.85}
              >
                <Ionicons name="search-outline" size={20} color="#fff" />
                <Text style={styles.tileLabel}>{t('actions.analyzeVirusTotal') || 'VirusTotal'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.bottomActions, compact ? { marginTop: 12 } : null]}>
            <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]} onPress={resetScan}>
              <Ionicons name="scan-outline" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
              <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>Yeniden Tara</Text>
            </TouchableOpacity>
            {navigation && (
              <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]} onPress={goToHome}>
                <Ionicons name="home-outline" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
                <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>Ana Menü</Text>
              </TouchableOpacity>
            )}
          </View>
          <AdvancedAdCard placement="image_scan_bottom" />
        </>
      )}
      
      <ConfirmOpenLinkModal
        visible={confirmVisible}
        url={pendingUrl}
        onConfirm={async () => { setConfirmVisible(false); if (pendingUrl) { try { await Linking.openURL(pendingUrl); } catch {} } setPendingUrl(null); }}
        onCancel={() => { setConfirmVisible(false); setPendingUrl(null); }}
      />
      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} dark={dark} />
      {/*
      <Modal visible={consentVisible} transparent animationType="fade">
        <View style={styles.consentOverlay}>
          <View style={[styles.consentCard, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea' }]}> 
            <View style={styles.consentHeader}>
              <Ionicons name="images-outline" size={22} color={dark ? '#e6edf3' : '#0b1220'} />
              <Text style={[styles.consentTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('consent.mediaAccessTitle') || 'Galeri Erişimi'}</Text>
            </View>
            <Text style={[styles.consentText, { color: dark ? '#8b98a5' : '#57606a' }]}>{t('consent.mediaAccessMessage') || 'Görselleri seçmek için galeriye erişim onayı verin.'}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[styles.consentBtn, { backgroundColor: dark ? '#1b2330' : '#f0f4f8', borderColor: dark ? '#243044' : '#dbe2ea' }]} onPress={() => setConsentVisible(false)} activeOpacity={0.85}>
                <Text style={[styles.consentBtnText, { color: dark ? '#8b98a5' : '#57606a' }]}>{t('confirm.no') || 'Vazgeç'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.consentBtn, { backgroundColor: '#2f9e44', borderColor: '#2f9e44' }]} onPress={async () => { try { await AsyncStorage.setItem('media_consent', 'true'); setHasConsent(true); setConsentVisible(false); await startImageSelection(); } catch { setConsentVisible(false); } }} activeOpacity={0.85}>
                <Text style={[styles.consentBtnText, { color: '#fff' }]}>{t('confirm.yes') || 'İzin Ver'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      */}
    </ScrollView>
    <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(139,152,165,0.2)', padding: 8 }}>
      <AdBanner placement="global_footer" />
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
  container: { flex: 1 },
  button: { backgroundColor: '#0066cc', borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  linkText: { fontSize: 14, fontWeight: '600' },
  badge: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  badgeGradient: { },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  reasonList: { gap: 4 }
  ,actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }
  ,tile: { width: '48%', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }
  ,tileLabel: { color: '#fff', fontWeight: '700' }
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
});