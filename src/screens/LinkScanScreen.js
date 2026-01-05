import { getUsomInfo } from '../utils/usomHelper';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, useWindowDimensions, Animated, Share, Keyboard, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { classifyInput, loadBlacklist } from '../utils/classifier';
import { checkRisk } from '../utils/riskcheck';
import { openVirusTotalForResult } from '../utils/linkActions';
import { useAppTheme } from '../theme/ThemeContext';
import AdBanner from '../components/AdBanner';
import ActionButtonsGrid from '../components/ActionButtonsGrid';
import AdvancedAdCard from '../components/AdvancedAdCard';
import ConfirmOpenLinkModal from '../components/ConfirmOpenLinkModal';
import Toast from '../components/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OfflineNotice from '../components/OfflineNotice';

export default function LinkScanScreen() {
  const { t, i18n } = useTranslation();
  const { dark } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 360 || height < 640;
  const route = useRoute();
  const navigation = useNavigation();
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [offlineNoticeHeight, setOfflineNoticeHeight] = useState(0);
  const hasInitialized = useRef(false);

  // Handle shared links from navigation params or deep linking
  useEffect(() => {
    const handleSharedLinkInternal = async () => {
      if (hasInitialized.current) return;
      
      let sharedUrl = null;
      
      // Check route params first (from navigation)
      const routeParams = route.params;
      if (routeParams?.url) {
        sharedUrl = decodeURIComponent(routeParams.url);
        hasInitialized.current = true;
        setInput(sharedUrl);
        setTimeout(() => {
          onAnalyzeWithUrl(sharedUrl);
        }, 300);
        return;
      }
      
      // Check for initial URL from deep linking or share intent
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          // Parse URL - could be secureqrlinkscanner://linkscan/URL or direct https://
          if (initialUrl.includes('linkscan/')) {
            const parts = initialUrl.split('linkscan/');
            if (parts.length > 1) {
              sharedUrl = decodeURIComponent(parts[1]);
            }
          } else if (initialUrl.startsWith('http://') || initialUrl.startsWith('https://')) {
            // Direct URL from share intent
            sharedUrl = initialUrl;
          } else if (initialUrl.startsWith('secureqrlinkscanner://')) {
            // Custom scheme with URL
            const urlPart = initialUrl.replace('secureqrlinkscanner://', '');
            if (urlPart.startsWith('http://') || urlPart.startsWith('https://')) {
              sharedUrl = urlPart;
            }
          }
        }
      } catch (e) {
        console.error('Error getting initial URL:', e);
      }
      
      if (sharedUrl && !hasInitialized.current) {
        hasInitialized.current = true;
        setInput(sharedUrl);
        // Auto-start analysis after a short delay
        setTimeout(() => {
          onAnalyzeWithUrl(sharedUrl);
        }, 300);
      }
    };
    
    handleSharedLinkInternal();
    
    // Listen for URL changes while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      let parsedUrl = null;
      if (url.includes('linkscan/')) {
        const parts = url.split('linkscan/');
        if (parts.length > 1) {
          parsedUrl = decodeURIComponent(parts[1]);
        }
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        parsedUrl = url;
      } else if (url.startsWith('secureqrlinkscanner://')) {
        const urlPart = url.replace('secureqrlinkscanner://', '');
        if (urlPart.startsWith('http://') || urlPart.startsWith('https://')) {
          parsedUrl = urlPart;
        }
      }
      
      if (parsedUrl) {
        hasInitialized.current = true;
        setInput(parsedUrl);
        setTimeout(() => {
          onAnalyzeWithUrl(parsedUrl);
        }, 300);
      }
    });
    
    return () => {
      subscription?.remove();
    };
  }, [route.params]);

  // Focus listener to handle shared links when app comes to foreground
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      if (!hasInitialized.current) {
        const handleSharedLinkInternal = async () => {
          if (hasInitialized.current) return;
          
          let sharedUrl = null;
          
          // Check route params first (from navigation)
          const routeParams = route.params;
          if (routeParams?.url) {
            sharedUrl = decodeURIComponent(routeParams.url);
            hasInitialized.current = true;
            setInput(sharedUrl);
            setTimeout(() => {
              onAnalyzeWithUrl(sharedUrl);
            }, 300);
            return;
          }
          
          // Check for initial URL from deep linking or share intent
          try {
            const initialUrl = await Linking.getInitialURL();
            if (initialUrl) {
              // Parse URL - could be secureqrlinkscanner://linkscan/URL or direct https://
              if (initialUrl.includes('linkscan/')) {
                const parts = initialUrl.split('linkscan/');
                if (parts.length > 1) {
                  sharedUrl = decodeURIComponent(parts[1]);
                }
              } else if (initialUrl.startsWith('http://') || initialUrl.startsWith('https://')) {
                // Direct URL from share intent
                sharedUrl = initialUrl;
              } else if (initialUrl.startsWith('secureqrlinkscanner://')) {
                // Custom scheme with URL
                const urlPart = initialUrl.replace('secureqrlinkscanner://', '');
                if (urlPart.startsWith('http://') || urlPart.startsWith('https://')) {
                  sharedUrl = urlPart;
                }
              }
            }
          } catch (e) {
            console.error('Error getting initial URL:', e);
          }
          
          if (sharedUrl && !hasInitialized.current) {
            hasInitialized.current = true;
            setInput(sharedUrl);
            // Auto-start analysis after a short delay
            setTimeout(() => {
              onAnalyzeWithUrl(sharedUrl);
            }, 300);
          }
        };
        
        handleSharedLinkInternal();
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [navigation]);

  const onAnalyzeWithUrl = async (urlToAnalyze) => {
    if (!urlToAnalyze || !urlToAnalyze.trim()) return;
    Keyboard.dismiss();
    
    setLoading(true);
    let finalResult = null;
    try {
      const res = classifyInput(urlToAnalyze.trim());

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
            const files = remote?.foundInFiles || [];
          const reasons = [ ...(res.reasons || []), 'remoteRisk.defaultMessage', domainInfo, sources ];
            if (files.includes('usom')) {
              reasons.push({ type: 'usom', data: remote?.usomDetails || {} });
            } else if (files.includes('aa') || files.includes('ab') || files.includes('ac')) {
              reasons.push({ type: 'github', repo: 'romainmarcoux/malicious-domains', url: 'https://github.com/romainmarcoux/malicious-domains/tree/main' });
            }
            updated = { ...res, level: 'unsafe', reasons };

          }
        } catch (e) {
          // Uzaktan kontrol başarısız ise (muhtemelen ağ yok) uyarı barını göster
          setOffline(true);
        }
      }

      finalResult = updated;
      setResult(updated);
    } catch (error) {
      console.error('Analysis failed:', error);
      const res = classifyInput(urlToAnalyze.trim());
      finalResult = res;
      setResult(res);
    } finally {
      setLoading(false);
      
      // Save to history only once, after analysis is complete
      if (finalResult) {
        try {
          const raw = await AsyncStorage.getItem('scan_history');
          const arr = raw ? JSON.parse(raw) : [];
          arr.unshift({ content: finalResult.normalized, level: finalResult.level, timestamp: Date.now() });
          if (arr.length > 200) arr.length = 200;
          await AsyncStorage.setItem('scan_history', JSON.stringify(arr));
        } catch (err) {
          console.error('Failed to save history:', err);
        }
      }
    }
  };

 const onAnalyze = async () => {
  if (!input.trim()) return;
  Keyboard.dismiss();
  
  setLoading(true);
  let finalResult = null;
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
          const files = remote?.foundInFiles || [];
          const reasons = [ ...(res.reasons || []), 'remoteRisk.defaultMessage', domainInfo, sources ];
          if (files.includes('usom')) {
            reasons.push({ type: 'usom', data: remote?.usomDetails || {} });
          } else if (files.includes('aa') || files.includes('ab') || files.includes('ac')) {
            reasons.push({ type: 'github', repo: 'romainmarcoux/malicious-domains', url: 'https://github.com/romainmarcoux/malicious-domains/tree/main' });
          }
          updated = { ...res, level: 'unsafe', reasons };
        }
      } catch (e) {
        // Uzaktan kontrol başarısız ise (muhtemelen ağ yok) uyarı barını göster
        setOffline(true);
      }
    }

    finalResult = updated;
    setResult(updated);
  } catch (error) {
    console.error('Analysis failed:', error);
    const res = classifyInput(input.trim());
    finalResult = res;
    setResult(res);
  } finally {
    setLoading(false);
    
    // Save to history only once, after analysis is complete
    if (finalResult) {
      try {
        const raw = await AsyncStorage.getItem('scan_history');
        const arr = raw ? JSON.parse(raw) : [];
        arr.unshift({ content: finalResult.normalized, level: finalResult.level, timestamp: Date.now() });
        if (arr.length > 200) arr.length = 200;
        await AsyncStorage.setItem('scan_history', JSON.stringify(arr));
      } catch (err) {
        console.error('Failed to save history:', err);
      }
    }
  }
};

  const clearInput = () => {
    setInput('');
    setResult(null);
  };

  const resetScan = () => {
    setInput('');
    setResult(null);
    setOffline(false);
  };

  const goToHome = () => {
    navigation.navigate('Home');
  };

  const openLink = () => {
    if (result?.normalized && result.isUrl) {
      setPendingUrl(result.normalized);
      setConfirmVisible(true);
    }
  };

  const vtLink = async () => {
    await openVirusTotalForResult(result);
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

  const renderLoadingStates = () => {
    if (!loading) return null;
    return (
      <View style={[styles.loadingOverlay, { backgroundColor: dark ? 'rgba(10,14,20,0.8)' : 'rgba(255,255,255,0.9)' }]}>
        <View style={[styles.loadingCard, { backgroundColor: dark ? '#0f172a' : '#ffffff', borderColor: dark ? '#1d2a3f' : '#e2e8f0' }]}>
          <View style={[styles.loadingIconWrap, { backgroundColor: dark ? 'rgba(14,116,144,0.15)' : 'rgba(14,165,233,0.12)' }]}>
            <ActivityIndicator size="small" color={dark ? '#67e8f9' : '#0284c7'} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.loadingTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
              {t('loading.securityChecks') || 'Güvenlik kontrolü yapılıyor...'}
            </Text>
            <Text style={[styles.loadingSubtitle, { color: dark ? '#94a3b8' : '#475569' }]}>
              {t('loading.securityChecksDesc') || 'Bağlantı güvenliği ve risk analizi yapılıyor'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.page, { backgroundColor: dark ? '#0b0f14' : '#e9edf3' }]}> 
    <OfflineNotice
      visible={offline}
      dark={dark}
      message={t('alerts.offline')}
      onHeightChange={setOfflineNoticeHeight}
    />
    <ScrollView style={[styles.container, { padding: compact ? 12 : 20 }]}
      contentContainerStyle={{ gap: 12, paddingBottom: 120, paddingTop: offline ? offlineNoticeHeight + 8 : 0 }}
      keyboardShouldPersistTaps="handled"
    > 
      {!offline && <View style={{ height: 0 }} />}
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, { backgroundColor: dark ? '#10151c' : '#fff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]}
          placeholder={t('scan.link.inputPlaceholder')}
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
              {result.reasons.map((r, idx) => {
                if (typeof r === 'object' && r.type === 'usom') {
                  const d = r.data;
                  const usomInfo = getUsomInfo(d.threatType, i18n.language, d.description);
                  return (
                    <View key={idx} style={[styles.usomBlock, { backgroundColor: dark ? 'rgba(207,34,46,0.1)' : '#fff5f5', borderColor: dark ? 'rgba(207,34,46,0.3)' : '#ffcccc' }]}>
                      <Text style={[styles.usomTitle, { color: dark ? '#ff7b72' : '#cf222e' }]}>{t('remoteRisk.usomTitle')}</Text>
                      {usomInfo.title && <Text style={[styles.usomText, { color: dark ? '#e6edf3' : '#24292f' }]}><Text style={{fontWeight:'700'}}>{t('remoteRisk.usomTypeLabel')}</Text> {usomInfo.title}</Text>}
                      {(usomInfo.desc || d.description) && <Text style={[styles.usomText, { color: dark ? '#e6edf3' : '#24292f' }]}><Text style={{fontWeight:'700'}}>{t('remoteRisk.usomDescLabel')}</Text> {usomInfo.desc || d.description}</Text>}
                      {d.detectedDate && <Text style={[styles.usomText, { color: dark ? '#e6edf3' : '#24292f' }]}><Text style={{fontWeight:'700'}}>{t('remoteRisk.usomDateLabel')}</Text> {(() => {
                        try {
                          return new Date(d.detectedDate).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        } catch (e) {
                          return d.detectedDate;
                        }
                      })()}</Text>}
                      {d.url && <Text style={[styles.usomText, { color: dark ? '#e6edf3' : '#24292f' }]}><Text style={{fontWeight:'700'}}>{t('remoteRisk.usomUrlLabel')}</Text> {d.url}</Text>}
                      {(d.ipAddress || d.ip) && <Text style={[styles.usomText, { color: dark ? '#e6edf3' : '#24292f' }]}><Text style={{fontWeight:'700'}}>{t('remoteRisk.usomIpLabel')}</Text> {d.ipAddress || d.ip}</Text>}
                      <TouchableOpacity onPress={() => Linking.openURL('https://www.usom.gov.tr/adres')} style={{marginTop: 8}}>
                        <Text style={{color: dark ? '#58a6ff' : '#0969da', textDecorationLine: 'underline', fontWeight: '500'}}>{t('remoteRisk.usomReference')}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                 if (typeof r === 'object' && r.type === 'github') {
                   return (
                     <View key={idx} style={[styles.usomBlock, { backgroundColor: dark ? 'rgba(210,153,34,0.1)' : '#fff8c5', borderColor: dark ? 'rgba(210,153,34,0.3)' : '#e3b341' }]}>
                       <Text style={[styles.usomTitle, { color: dark ? '#d29922' : '#9a6700' }]}>{t('remoteRisk.githubTitle')}</Text>
                       <Text style={[styles.usomText, { color: dark ? '#e6edf3' : '#24292f' }]}>
                         {t('remoteRisk.githubFoundText', { repo: r.repo })}
                       </Text>
                       <TouchableOpacity onPress={() => Linking.openURL(r.url)} style={{marginTop: 4}}>
                          <Text style={{color: dark ? '#58a6ff' : '#0969da', textDecorationLine: 'underline'}}>{t('remoteRisk.viewSource')}</Text>
                       </TouchableOpacity>
                     </View>
                   );
                 }
                return (
                  <Text key={idx} style={[styles.reasonText, { color: dark ? '#8b98a5' : '#57606a' }]}>
                    • {t(r)}
                  </Text>
                );
              })}
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
      {result && (
        <View style={[styles.bottomActions, compact ? { marginTop: 12 } : null]}>
          <TouchableOpacity 
            style={[styles.bottomBtn, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]} onPress={resetScan}>
            <Ionicons name="scan-outline" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
            <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>
              {t('actions.rescan') || 'Yeniden Tara'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.bottomBtn, { backgroundColor: dark ? '#1b2330' : '#e5e9f0' }]} onPress={goToHome}>
            <Ionicons name="home-outline" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
            <Text style={[styles.bottomBtnText, { color: dark ? '#e6edf3' : '#0b1220' }]}>
              {t('actions.mainMenu') || 'Ana Menü'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
      {renderLoadingStates()}
    </ScrollView>
    <View style={[ { backgroundColor: dark ? '#0b0f14' : '#e9edf3' }]}> 
      <AdBanner placement="link" isFooter />
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 100,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  loadingIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  loadingTitle: { fontSize: 15, fontWeight: '800' },
  loadingSubtitle: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
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
  usomBlock: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 4,
    gap: 4
  },
  usomTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5
  },
  usomText: {
    fontSize: 13,
    lineHeight: 18
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  adContainer: { marginTop: 12, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  bottomBannerWrap: { padding: 8 },
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
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
  }
});
