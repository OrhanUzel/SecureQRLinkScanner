import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, Platform, Share, StyleSheet, Text, ScrollView, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { extractDomain } from '../utils/linkActions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import Toast from '../components/Toast';

export default function WebViewScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const initialUrl = (route?.params?.url || '').trim();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enableRefresher, setEnableRefresher] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [progress, setProgress] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const webRef = useRef(null);

  const domain = useMemo(() => extractDomain(currentUrl) || t('label.url') || 'URL', [currentUrl, t]);
  const isSecure = currentUrl.startsWith('https://');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isSecure ? (
            <Ionicons name="lock-closed" size={12} color="#2f9e44" style={{ marginRight: 4 }} />
          ) : (
            <Ionicons name="warning-outline" size={14} color="#f59e0b" style={{ marginRight: 6 }} />
          )}
          <Text style={{ fontSize: 16, fontWeight: '600', color: dark ? '#e6edf3' : '#0b1220' }} numberOfLines={1}>
            {domain}
          </Text>
        </View>
      ),
      headerTitleAlign: 'center',
      headerLeft: () => (
         <TouchableOpacity
           onPress={() => navigation.goBack()}
           activeOpacity={0.7}
           style={{ marginLeft: Platform.OS === 'ios' ? 0 : 0, padding: 4 }}
         >
           <Ionicons name="close" size={26} color={dark ? '#e6edf3' : '#0b1220'} />
         </TouchableOpacity>
      ),
      headerRight: () => null, // Sağ tarafı boş bırakıyoruz, çünkü altta toolbar var
    });
  }, [navigation, domain, isSecure, dark]);

  if (!initialUrl) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#0b0f14' : '#e9edf3' }} />;
  }

  const handleNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setCurrentUrl(navState.url);
    setLoading(navState.loading);
  };

  const onShare = async () => {
    try {
      await Share.share({
        message: currentUrl,
        url: currentUrl, // iOS için
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  const openInBrowser = async () => {
    try {
      await Linking.openURL(currentUrl);
    } catch {}
  };

  const copyToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(currentUrl);
      setToastMsg(t('toast.copied'));
      setToastVisible(true);
    } catch {}
  };

  const handleRefresh = () => {
    setRefreshing(true);
    webRef.current?.reload();
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'scroll') {
        const isAtTop = data.scrollY <= 0;
        if (isAtTop !== enableRefresher) {
          setEnableRefresher(isAtTop);
        }
      }
    } catch (error) {
      // ignore
    }
  };

  const INJECTED_JAVASCRIPT = `
    (function() {
      var lastScrollY = window.scrollY;
      window.addEventListener('scroll', function() {
        var currentScrollY = window.scrollY;
        // Post message only if scrollY changes significantly or crosses 0
        if (currentScrollY <= 0 || lastScrollY <= 0) {
           window.ReactNativeWebView.postMessage(JSON.stringify({
             type: 'scroll',
             scrollY: currentScrollY
           }));
        }
        lastScrollY = currentScrollY;
      });
    })();
    true;
  `;

  const webViewContent = (
    <WebView
      ref={webRef}
      source={{ uri: initialUrl }}
      onLoadStart={() => setLoading(true)}
      onLoadEnd={() => {
        setLoading(false);
        setRefreshing(false);
      }}
      onError={() => {
        setLoading(false);
        setRefreshing(false);
      }}
      onNavigationStateChange={handleNavigationStateChange}
      onLoadProgress={({ nativeEvent }) => {
        const p = nativeEvent?.progress ?? 0;
        setProgress(p);
      }}
      pullToRefreshEnabled
      onRefresh={() => {
        webRef.current?.reload();
      }}
      injectedJavaScript={INJECTED_JAVASCRIPT}
      onMessage={handleMessage}
      bounces
      overScrollMode="always"
      nestedScrollEnabled
      allowsBackForwardNavigationGestures
      startInLoadingState={false}
      incognito
      allowsInlineMediaPlayback
      setSupportMultipleWindows={false}
      style={{ flex: 1 }}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#0b0f14' : '#ffffff' }}>
      {Platform.OS === 'android' ? (
        <ScrollView
          contentContainerStyle={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              enabled={enableRefresher}
              onRefresh={handleRefresh}
              colors={['#2ea043']}
              progressBackgroundColor={dark ? '#161b22' : '#ffffff'}
            />
          }
        >
          {webViewContent}
        </ScrollView>
      ) : (
        webViewContent
      )}
      
      {loading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
          <View style={{ height: 3, width: '100%', backgroundColor: dark ? '#1b2330' : '#e5e9f0' }}>
            <View style={{ height: 3, width: `${Math.max(2, Math.floor(progress * 100))}%`, backgroundColor: dark ? '#2ea043' : '#2ea043' }} />
          </View>
        </View>
      )}

      {/* Bottom Toolbar */}
      <View style={[
        styles.toolbar, 
        { 
          backgroundColor: dark ? '#161b22' : '#ffffff', 
          borderTopColor: dark ? '#30363d' : '#e1e4e8',
          paddingBottom: Math.max(insets.bottom, 10)
        }
      ]}>
        <TouchableOpacity 
          style={styles.toolbarBtn} 
          disabled={!canGoBack} 
          onPress={() => webRef.current?.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={canGoBack ? (dark ? '#e6edf3' : '#0b1220') : (dark ? '#30363d' : '#d0d7de')} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toolbarBtn} 
          disabled={!canGoForward} 
          onPress={() => webRef.current?.goForward()}
        >
          <Ionicons name="chevron-forward" size={24} color={canGoForward ? (dark ? '#e6edf3' : '#0b1220') : (dark ? '#30363d' : '#d0d7de')} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toolbarBtn} 
          onPress={copyToClipboard}
        >
          <Ionicons name="copy-outline" size={22} color={dark ? '#e6edf3' : '#0b1220'} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toolbarBtn} 
          onPress={onShare}
        >
          <Ionicons name="share-outline" size={22} color={dark ? '#e6edf3' : '#0b1220'} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toolbarBtn} 
          onPress={openInBrowser}
        >
          <Ionicons name="compass-outline" size={24} color={dark ? '#e6edf3' : '#0b1220'} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toolbarBtn} 
          onPress={() => {
            if (loading) {
              webRef.current?.stopLoading();
            } else {
              webRef.current?.reload();
            }
          }}
        >
          <Ionicons name={loading ? 'close-circle-outline' : 'refresh'} size={22} color={dark ? '#e6edf3' : '#0b1220'} />
        </TouchableOpacity>
      </View>

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
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  toolbarBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  }
});
