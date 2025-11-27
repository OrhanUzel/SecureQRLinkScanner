import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, useWindowDimensions, Animated, Share, Keyboard, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { classifyInput, loadBlacklist } from '../utils/classifier';
import { checkRisk } from '../utils/riskcheck';
import { useAppTheme } from '../theme/ThemeContext';
import AdBanner from '../components/AdBanner';
import AdvancedAdCard from '../components/AdvancedAdCard';
import ConfirmOpenLinkModal from '../components/ConfirmOpenLinkModal';
import Toast from '../components/Toast';

export default function LinkScanScreen() {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 360 || height < 640;
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

 const onAnalyze = async () => {
  if (!input.trim()) return;
  Keyboard.dismiss();
  
  // İlk yükleme için loading state ekleyin
  //setLoading(true);
  
  setLoading(true);
  try {
    // Blacklist yükleme devre dışı (isteğe bağlı):
    // await loadBlacklist();
    const res = classifyInput(input.trim());

    // Uzaktan risk kontrolü (yalnızca URL ise)
    let updated = res;
    if (res.isUrl) {
      try {
        const remote = await checkRisk(res.normalized);
        // If remote check failed due to network, show offline warning
        if (remote?.error) {
          setOffline(true);
        } else {
          setOffline(false);
        }
        if (remote?.isRisky) {
          const domainInfo = t('remoteRisk.checkedDomainLabel') + ' ' + (remote?.checkedDomain || res.normalized);
          const sources = t('remoteRisk.sourcesLabel') + ' ' + ((remote?.foundInFiles || []).join(', ') || '-');
          const reasons = [ ...(res.reasons || []), 'remoteRisk.defaultMessage', domainInfo, sources ];
          updated = { ...res, level: 'unsafe', reasons };
        }
      } catch (e) {
        // Uzaktan kontrol başarısız ise (muhtemelen ağ yok) uyarı barını göster
        setOffline(true);
      }
    }

    setResult(updated);
  } catch (error) {
    console.error('Analysis failed:', error);
    const res = classifyInput(input.trim());
    setResult(res);
  } finally {
    setLoading(false);
  }
};

  const clearInput = () => {
    setInput('');
    setResult(null);
  };

  const openLink = () => {
    if (result?.normalized && result.isUrl) {
      setPendingUrl(result.normalized);
      setConfirmVisible(true);
    }
  };

  const vtLink = async () => {
    if (result?.normalized) {
      let domain = result.normalized;
      try {
        const urlObj = new URL(result.normalized.startsWith('http') ? result.normalized : 'https://' + result.normalized);
        domain = urlObj.hostname;
      } catch (e) {
        domain = result.normalized.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      }
      const url = 'https://www.virustotal.com/gui/domain/' + encodeURIComponent(domain);
      try { await Linking.openURL(url); } catch (e) { Alert.alert('Hata', e.message); }
    }
  };

  const copyLink = async () => {
    if (result?.normalized) {
      try {
        await Clipboard.setStringAsync(result.normalized);
        setToastMsg(t('toast.copied'));
        setToastVisible(true);
      } catch {}
    }
  };

  const shareLink = async () => {
    if (result?.normalized) {
      try { await Share.share({ message: result.normalized }); } catch {}
    }
  };

  return (
    <View style={[styles.page, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}> 
    <ScrollView style={[styles.container, { padding: compact ? 12 : 20 }]}
      contentContainerStyle={{ gap: 16 }}
      keyboardShouldPersistTaps="handled"
    > 
      {offline && (
        <View style={[styles.alertBar, { backgroundColor: dark ? 'rgba(207,34,46,0.15)' : 'rgba(207,34,46,0.1)', borderColor: dark ? 'rgba(207,34,46,0.3)' : 'rgba(207,34,46,0.25)' }]}> 
          <Ionicons name="wifi" size={18} color={dark ? '#ffb4b9' : '#cf222e'} />
          <Text style={[styles.alertText, { color: dark ? '#ffb4b9' : '#cf222e' }]}>{t('alerts.offline')}</Text>
        </View>
      )}
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlayModal}>
          <View style={[styles.loadingCard, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea' }]}> 
            <ActivityIndicator size="large" color={dark ? '#9ecaff' : '#0969da'} />
            <Text style={[styles.loadingText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('loading.securityChecks')}</Text>
          </View>
        </View>
      </Modal>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, { backgroundColor: dark ? '#10151c' : '#fff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]}
          placeholder={t('scan.link')}
          placeholderTextColor={dark ? '#8b98a5' : '#7a8699'}
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {input.length > 0 && (
          <TouchableOpacity 
            style={[styles.clearButton, { backgroundColor: dark ? '#172031' : '#f0f4f8', borderColor: dark ? '#243044' : '#dbe2ea' }]} 
            onPress={clearInput}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color={dark ? '#8b98a5' : '#7a8699'} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.button, compact ? { paddingVertical: 12 } : null, !input.trim() && styles.buttonDisabled]} 
        onPress={onAnalyze}
        disabled={!input.trim()}
        activeOpacity={0.8}
      >
        <Ionicons name="shield-checkmark" size={20} color="#fff" />
        <Text style={styles.buttonText}>{t('actions.scan')}</Text>
      </TouchableOpacity>

      {result && (
        <View style={[styles.card, compact ? { padding: 12 } : null, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea' }]}> 
          <Text style={[styles.linkText, { color: dark ? '#9ecaff' : '#0969da' }]} numberOfLines={2} selectable>
            {result.normalized}
          </Text>
          <View style={styles.badgeRow}>
            <RiskBadge level={result.level} />
          </View>
          {result.reasons?.length > 0 && (
            <View style={styles.reasonList}>
              {result.reasons.map((r, idx) => (
                <Text key={idx} style={[styles.reasonText, { color: dark ? '#8b98a5' : '#57606a' }]}>
                  • {t(r)}
                </Text>
              ))}
            </View>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.primaryBtn]} 
              onPress={openLink}
              activeOpacity={0.8}
            >
              <Ionicons name="open-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>{t('actions.openLink')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.copyBtn]} 
              onPress={copyLink}
              activeOpacity={0.8}
            >
              <Ionicons name="copy" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>{t('actions.copy')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionsBottom}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.secondaryBtn, styles.wideBtn]} 
              onPress={shareLink}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>{t('actions.share') || 'Paylaş'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.vtBtn, styles.wideBtn]} 
              onPress={vtLink}
              activeOpacity={0.8}
            >
              <Ionicons name="search-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>{t('actions.analyzeVirusTotal') || 'VirusTotal'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <AdvancedAdCard placement="link" large />
      <ConfirmOpenLinkModal 
        visible={confirmVisible}
        url={pendingUrl}
        onConfirm={async () => {
          setConfirmVisible(false);
          if (pendingUrl) {
            try { await Linking.openURL(pendingUrl); } catch (e) { Alert.alert('Hata', e.message); }
          }
          setPendingUrl(null);
        }}
        onCancel={() => { setConfirmVisible(false); setPendingUrl(null); }}
      />
      <Toast 
        visible={toastVisible}
        message={toastMsg}
        onHide={() => setToastVisible(false)}
        dark={dark}
      />
    </ScrollView>
    <View style={[styles.bottomBannerWrap, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}> 
      <AdBanner placement="link" />
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
      <Ionicons name={icon} size={22} color="#fff" />
      <Text style={styles.badgeText}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  container: { 
    flex: 1, 
    padding: 20, 
    gap: 16 
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 100,
  },
  loadingOverlayModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingCard: {
    width: '80%',
    maxWidth: 360,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600'
  },
  inputContainer: {
    position: 'relative',
    width: '100%'
  },
  input: { 
    borderWidth: 1, 
    borderRadius: 12, 
    padding: 14,
    paddingRight: 44,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 44
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -16 }],
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  button: { 
    backgroundColor: '#0969da', 
    borderRadius: 12, 
    paddingVertical: 14, 
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  buttonDisabled: {
    backgroundColor: '#6e7781',
    opacity: 0.5
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 16
  },
  alertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  card: { 
    borderWidth: 1, 
    borderRadius: 12, 
    padding: 16, 
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  linkText: { 
    fontSize: 15, 
    fontWeight: '600',
    lineHeight: 22
  },
  badgeRow: { flexDirection: 'row', justifyContent: 'center' },
  badge: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  badgeGradient: {},
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  reasonList: { 
    gap: 6,
    marginTop: 4
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  adContainer: { marginTop: 12, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  bottomBannerWrap: { borderTopWidth: 1, borderTopColor: 'rgba(139,152,165,0.2)', padding: 8 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actionBtn: { 
    flex: 1,
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
  actionsBottom: { marginTop: 6, flexDirection: 'column', gap: 6 },
  wideBtn: { alignSelf: 'stretch' },
  primaryBtn: { backgroundColor: '#2f9e44' },
  copyBtn: { backgroundColor: '#0969da' },
  secondaryBtn: { backgroundColor: '#6c5ce7' },
  vtBtn: { backgroundColor: '#8250df' },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 }
});