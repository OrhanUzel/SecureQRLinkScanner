import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { classifyInput } from '../utils/classifier';
import { useAppTheme } from '../theme/ThemeContext';

export default function CodeScanScreen({ navigation }) {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const cameraRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facing, setFacing] = useState('back');
  const [gs1Country, setGs1Country] = useState(null);
  const [showCamera, setShowCamera] = useState(true);

  useEffect(() => {
    (async () => {
      if (!permission || !permission.granted) {
        await requestPermission();
      }
    })();
  }, [permission]);

  useEffect(() => {
    if (!showCamera && result) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showCamera, result]);

  const saveHistory = async (item) => {
    try {
      const raw = await AsyncStorage.getItem('scan_history');
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift({ ...item, timestamp: Date.now() });
      await AsyncStorage.setItem('scan_history', JSON.stringify(arr.slice(0, 50)));
    } catch {}
  };

  const onBarcodeScanned = async (ev) => {
    const data = ev?.data ?? (Array.isArray(ev?.barcodes) ? ev.barcodes[0]?.data : undefined);
    if (!data) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    let usomBad = false;
    try {
      usomBad = await isUsomUnsafe(data) || await isUsomHostUnsafe(data);
    } catch {}

    const res = classifyInput(data);
    const reasons = usomBad ? [...(res.reasons || []), 'classifier.usomWarning'] : res.reasons || [];
    const level = usomBad ? 'unsafe' : res.level;
    const updated = { ...res, level, reasons };
    setResult(updated);
    setShowCamera(false);
    saveHistory({ content: updated.normalized, level: updated.level });
    const country = detectGs1Country(data);
    setGs1Country(country);
  };

  const openLink = () => {
    if (!result?.normalized) return;
    if (result.normalized.startsWith('http')) Linking.openURL(result.normalized);
  };

  const shareText = async () => {
    if (!result?.normalized) return;
    try { await Share.share({ message: result.normalized }); } catch {}
  };

  const resetScan = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    setResult(null);
    setGs1Country(null);
    setShowCamera(true);
  };

  const goToHome = () => {
    if (navigation) {
      navigation.navigate('Home');
    }
  };

  if (!permission) {
    return <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}>
        <Ionicons name="camera-outline" size={64} color={dark ? '#3b4654' : '#8b98a5'} />
        <Text style={[styles.permissionText, { color: dark ? '#e6edf3' : '#0b1220' }]}>
          {t('We need your permission to show the camera') || 'Kamera kullanımı için izin gerekli'}
        </Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.grantBtnText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showCamera && (
        <>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            enableTorch={torchOn}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'code39', 'code128'] }}
            onBarcodeScanned={onBarcodeScanned}
          />

          <View style={styles.overlay} />

          <View style={styles.topBar}>
            <TouchableOpacity 
              style={[styles.iconBtn, { backgroundColor: torchOn ? '#ffb703' : 'rgba(16, 21, 28, 0.8)', borderColor: 'rgba(255, 255, 255, 0.15)' }]} 
              onPress={() => setTorchOn(v => !v)}
            >
              <Ionicons name={torchOn ? "flashlight" : "flashlight-outline"} size={20} color={torchOn ? '#000' : '#fff'} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconBtn, { backgroundColor: 'rgba(16, 21, 28, 0.8)', borderColor: 'rgba(255, 255, 255, 0.15)' }]} 
              onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
            >
              <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View pointerEvents="none" style={styles.guideWrap}>
            <View style={styles.scannerFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={styles.guideText}>
              QR kodu veya barkodu çerçeve içine hizalayın
            </Text>
          </View>
        </>
      )}

      {result && !showCamera && (
        <Animated.View 
          style={[
            styles.resultContainer, 
            { 
              backgroundColor: dark ? '#0b0f14' : '#f2f6fb',
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.resultHeader}>
            <Ionicons 
              name={result.level === 'secure' ? 'shield-checkmark' : result.level === 'suspicious' ? 'warning' : 'shield'} 
              size={48} 
              color={result.level === 'secure' ? '#2f9e44' : result.level === 'suspicious' ? '#ffb703' : '#d00000'} 
            />
            <RiskBadge level={result.level} />
          </View>

          <View style={[styles.resultCard, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#e5e9f0' }]}> 
            <View style={styles.resultSection}>
              <Text style={[styles.sectionLabel, { color: dark ? '#8b98a5' : '#5c6a7a' }]}>
                {result.isUrl ? 'URL' : 'İçerik'}
              </Text>
              <Text style={[styles.linkText, { color: dark ? '#9ecaff' : '#0066cc' }]} numberOfLines={3}>
                {result.normalized}
              </Text>
            </View>

            {gs1Country && (
              <View style={[styles.resultSection, styles.countrySection]}>
                <View style={styles.countryBadge}>
                  <Ionicons name="flag" size={18} color={dark ? '#8b98a5' : '#5c6a7a'} />
                  <Text style={[styles.countryText, { color: dark ? '#e6edf3' : '#0b1220' }]}>
                    {gs1Country}
                  </Text>
                </View>
              </View>
            )}

            {result.reasons?.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={[styles.sectionLabel, { color: dark ? '#8b98a5' : '#5c6a7a' }]}>
                  Tespit Edilen Riskler
                </Text>
                <View style={styles.reasonList}>
                  {result.reasons.map((r, idx) => (
                    <View key={idx} style={styles.reasonItem}>
                      <View style={[styles.reasonDot, { backgroundColor: result.level === 'unsafe' ? '#d00000' : '#ffb703' }]} />
                      <Text style={[styles.reasonText, { color: dark ? '#c4cdd6' : '#3b4654' }]}>
                        {t(r)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={styles.buttonGroup}>
            {result.isUrl && (
              <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={openLink}>
                <Ionicons name="open-outline" size={22} color="#fff" />
                <Text style={styles.actionBtnText}>{t('actions.openLink') || 'Linki Aç'}</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn]} onPress={shareText}>
              <Ionicons name="share-outline" size={22} color="#fff" />
              <Text style={styles.actionBtnText}>{t('actions.share') || 'Paylaş'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomActions}>
            <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]} onPress={resetScan}>
              <Ionicons name="scan-outline" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
              <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>
                Yeniden Tara
              </Text>
            </TouchableOpacity>
            
            {navigation && (
              <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]} onPress={goToHome}>
                <Ionicons name="home-outline" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
                <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>
                  Ana Menü
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function RiskBadge({ level }) {
  let color = '#2f9e44', text = 'Güvenli', icon = 'shield-checkmark';
  if (level === 'suspicious') { color = '#ffb703'; text = 'Şüpheli'; icon = 'warning'; }
  if (level === 'unsafe') { color = '#d00000'; text = 'Tehlikeli'; icon = 'alert-circle'; }
  
  return (
    <View style={[styles.badge, { backgroundColor: color }]}> 
      <Ionicons name={icon} size={18} color="#fff" />
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function detectGs1Country(raw) {
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (digits.length < 8) return null;
  const prefix = parseInt(digits.slice(0, 3), 10);
  if (Number.isNaN(prefix)) return null;

  const ranges = [
    [[1, 19], 'Amerika Birleşik Devletleri'],
    [[30, 39], 'Amerika Birleşik Devletleri'],
    [[60, 99], 'Amerika Birleşik Devletleri'],
    [[100, 139], 'Amerika Birleşik Devletleri'],
    [[300, 379], 'Fransa & Monako'],
    [[380, 380], 'Bulgaristan'],
    [[383, 383], 'Slovenya'],
    [[385, 385], 'Hırvatistan'],
    [[387, 387], 'Bosna-Hersek'],
    [[389, 389], 'Karadağ'],
    [[400, 440], 'Almanya'],
    [[450, 459], 'Japonya'],
    [[460, 469], 'Rusya'],
    [[471, 471], 'Tayvan'],
    [[474, 474], 'Estonya'],
    [[475, 475], 'Letonya'],
    [[476, 476], 'Azerbaycan'],
    [[477, 477], 'Litvanya'],
    [[478, 478], 'Özbekistan'],
    [[479, 479], 'Sri Lanka'],
    [[480, 480], 'Filipinler'],
    [[481, 481], 'Belarus'],
    [[482, 482], 'Ukrayna'],
    [[483, 483], 'Türkmenistan'],
    [[484, 484], 'Moldova'],
    [[485, 485], 'Ermenistan'],
    [[486, 486], 'Gürcistan'],
    [[487, 487], 'Kazakistan'],
    [[488, 488], 'Tacikistan'],
    [[489, 489], 'Hong Kong'],
    [[490, 499], 'Japonya'],
    [[500, 509], 'Birleşik Krallık'],
    [[520, 521], 'Yunanistan'],
    [[528, 528], 'Lübnan'],
    [[529, 529], 'Kıbrıs'],
    [[530, 530], 'Arnavutluk'],
    [[531, 531], 'Kuzey Makedonya'],
    [[535, 535], 'Malta'],
    [[539, 539], 'İrlanda'],
    [[540, 549], 'Belçika & Lüksemburg'],
    [[560, 560], 'Portekiz'],
    [[569, 569], 'İzlanda'],
    [[570, 579], 'Danimarka'],
    [[590, 590], 'Polonya'],
    [[594, 594], 'Romanya'],
    [[599, 599], 'Macaristan'],
    [[600, 601], 'Güney Afrika'],
    [[608, 608], 'Bahreyn'],
    [[611, 611], 'Fas'],
    [[613, 613], 'Cezayir'],
    [[616, 616], 'Kenya'],
    [[619, 619], 'Tunus'],
    [[621, 621], 'Suriye'],
    [[622, 622], 'Mısır'],
    [[624, 624], 'Libya'],
    [[625, 625], 'Ürdün'],
    [[626, 626], 'İran'],
    [[627, 627], 'Kuveyt'],
    [[628, 628], 'Suudi Arabistan'],
    [[629, 629], 'Birleşik Arap Emirlikleri'],
    [[640, 649], 'Finlandiya'],
    [[680, 681], 'Çin'],
    [[690, 699], 'Çin'],
    [[700, 709], 'Norveç'],
    [[729, 729], 'İsrail'],
    [[730, 739], 'İsveç'],
    [[740, 740], 'Guatemala'],
    [[741, 741], 'El Salvador'],
    [[742, 742], 'Honduras'],
    [[743, 743], 'Nikaragua'],
    [[744, 744], 'Kosta Rika'],
    [[745, 745], 'Panama'],
    [[746, 746], 'Dominik Cumhuriyeti'],
    [[750, 750], 'Meksika'],
    [[754, 755], 'Kanada'],
    [[759, 759], 'Venezuela'],
    [[760, 769], 'İsviçre & Lihtenştayn'],
    [[770, 771], 'Kolombiya'],
    [[773, 773], 'Uruguay'],
    [[775, 775], 'Peru'],
    [[777, 777], 'Bolivya'],
    [[778, 779], 'Arjantin'],
    [[780, 780], 'Şili'],
    [[784, 784], 'Paraguay'],
    [[786, 786], 'Ekvador'],
    [[789, 790], 'Brezilya'],
    [[800, 839], 'İtalya'],
    [[840, 849], 'İspanya & Andorra'],
    [[850, 850], 'Küba'],
    [[858, 858], 'Slovakya'],
    [[859, 859], 'Çek Cumhuriyeti'],
    [[860, 860], 'Sırbistan'],
    [[865, 865], 'Moğolistan'],
    [[867, 867], 'Kuzey Kore'],
    [[868, 869], 'Türkiye'],
    [[870, 879], 'Hollanda'],
    [[880, 881], 'Güney Kore'],
    [[883, 883], 'Myanmar'],
    [[884, 884], 'Kamboçya'],
    [[885, 885], 'Tayland'],
    [[888, 888], 'Singapur'],
    [[890, 890], 'Hindistan'],
    [[893, 893], 'Vietnam'],
    [[894, 894], 'Bangladeş'],
    [[896, 896], 'Pakistan'],
    [[899, 899], 'Endonezya'],
    [[900, 919], 'Avusturya'],
    [[930, 939], 'Avustralya'],
    [[940, 949], 'Yeni Zelanda'],
    [[955, 955], 'Malezya'],
    [[958, 958], 'Makao'],
  ];

  for (const [[from, to], name] of ranges) {
    if (prefix >= from && prefix <= to) return name;
  }
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  topBar: { 
    position: 'absolute', 
    top: 50, 
    right: 20, 
    flexDirection: 'row', 
    gap: 12,
    zIndex: 10,
  },
  iconBtn: { 
    paddingVertical: 12, 
    paddingHorizontal: 12, 
    borderRadius: 12, 
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  guideWrap: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    top: 0, 
    bottom: 0, 
    alignItems: 'center', 
    justifyContent: 'center',
    zIndex: 5,
  },
  scannerFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
    borderWidth: 4,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  guideText: { 
    marginTop: 32, 
    fontWeight: '600', 
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  resultContainer: { 
    flex: 1, 
    padding: 20,
    justifyContent: 'center',
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  resultCard: { 
    padding: 20, 
    gap: 20, 
    borderWidth: 1, 
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  resultSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linkText: { 
    fontSize: 16, 
    fontWeight: '600',
    lineHeight: 24,
  },
  countrySection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 152, 165, 0.2)',
  },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(158, 202, 255, 0.1)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  countryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  badge: { 
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    borderRadius: 999, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 15,
  },
  reasonList: { 
    gap: 10,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reasonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  buttonGroup: { 
    gap: 12,
    marginTop: 24,
  },
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    paddingVertical: 16, 
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryBtn: {
    backgroundColor: '#2f9e44',
  },
  secondaryBtn: {
    backgroundColor: '#6c5ce7',
  },
  actionBtnText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 16,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  bottomBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  center: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 20, 
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 24,
  },
  grantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
  },
  grantBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});