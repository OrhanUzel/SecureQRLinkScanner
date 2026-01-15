import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, Platform, Share, StyleSheet, Text, ScrollView, RefreshControl, BackHandler } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { extractDomain } from '../utils/linkActions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import Toast from '../components/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { appEvents } from '../utils/events';

/**
 * WebViewScreen Component
 * 
 * This screen is responsible for rendering web content within the application using the WebView component.
 * It provides a full-featured browser-like experience with navigation controls, sharing capabilities,
 * and external browser opening options.
 * 
 * Key Features:
 * - In-app browsing with progress indicator
 * - Navigation controls (Back, Forward, Refresh, Stop)
 * - Copy URL, Share, and Open in Browser functionality
 * - Custom error handling for HTTP errors and network issues
 * - Dark mode support aligned with the app theme
 * - Premium status check for removing ads/adjusting layout
 * - Hardware back button handling for Android
 * - Pull-to-refresh functionality (custom implementation for Android to avoid conflicts)
 */
export default function WebViewScreen({ route, navigation }) {
  // Localization hook for translating strings
  const { t } = useTranslation();
  
  // Theme context to detect dark/light mode
  const { dark } = useAppTheme();
  
  // Safe area insets for handling notches and home indicators
  const insets = useSafeAreaInsets();
  
  // Get the initial URL passed via navigation parameters
  const initialUrl = (route?.params?.url || '').trim();

  // State Variables
  const [loading, setLoading] = useState(true); // Tracks whether the page is currently loading
  const [refreshing, setRefreshing] = useState(false); // Tracks pull-to-refresh state
  const [enableRefresher, setEnableRefresher] = useState(true); // Enables/disables pull-to-refresh based on scroll position
  const [canGoBack, setCanGoBack] = useState(false); // Can the WebView go back?
  const [canGoForward, setCanGoForward] = useState(false); // Can the WebView go forward?
  const [currentUrl, setCurrentUrl] = useState(initialUrl); // Currently displayed URL
  const [progress, setProgress] = useState(0); // Loading progress (0.0 to 1.0)
  const [toastVisible, setToastVisible] = useState(false); // Visibility of the toast message
  const [toastMsg, setToastMsg] = useState(''); // Content of the toast message
  
  // Reference to the WebView component to call its methods (reload, goBack, etc.)
  const webRef = useRef(null);
  
  // Additional State for Business Logic
  const [isPremium, setIsPremium] = useState(false); // Is the user a premium member?
  const [isConnected, setIsConnected] = useState(true); // Network connection status
  const [lastError, setLastError] = useState(null); // Last encountered error (HTTP or generic)

  // Effect: Check Premium Status
  // Checks AsyncStorage for premium status on mount and listens for changes via appEvents
  useEffect(() => {
    let mounted = true;
    const checkPremium = async () => {
      try {
        const v = await AsyncStorage.getItem('premium');
        if (mounted) setIsPremium(v === 'true');
      } catch {}
    };
    checkPremium();

    const removeListener = appEvents.on('premiumChanged', (status) => {
      if (mounted) setIsPremium(status === true);
    });

    return () => {
      mounted = false;
      if (removeListener) removeListener();
    };
  }, []);

  // Effect: Network Connectivity Listener
  // Subscribes to network state updates to handle offline scenarios
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });
    return unsubscribe;
  }, []);

  // Effect: Hardware Back Button Handling (Android)
  // Intercepts the hardware back button to navigate back within the WebView history
  // instead of immediately exiting the screen. If no history, goes back to previous app screen.
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true; // Prevent default behavior
      }
      // If no history in WebView, manually navigate back in the app stack
      navigation.goBack();
      return true; // We handled the event
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => subscription.remove();
  }, [canGoBack, navigation]);

  // Extract domain name for display in the header
  const domain = useMemo(() => extractDomain(currentUrl) || t('label.url') || 'URL', [currentUrl, t]);
  const isSecure = currentUrl.startsWith('https://');

  // Effect: Configure Navigation Header
  // Sets the header title (with security icon), close button, and styling
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Security Indicator: Lock for HTTPS, Warning for HTTP */}
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
      headerRight: () => null, // Empty right side as we use a bottom toolbar
    });
  }, [navigation, domain, isSecure, dark]);

  // Render a placeholder if no URL is provided
  if (!initialUrl) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#0b0f14' : '#e9edf3' }} />;
  }

  // Handler: Navigation State Change
  // Updates local state when WebView navigation state changes (url, loading, back/forward availability)
  const handleNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setCurrentUrl(navState.url);
    setLoading(navState.loading);
  };

  // Handler: Share URL
  // Opens the native share sheet with the current URL
  const onShare = async () => {
    try {
      await Share.share({
        message: currentUrl,
        url: currentUrl, // iOS requires the 'url' field
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  // Handler: Open in External Browser
  // Opens the current URL in the default system browser (Safari/Chrome)
  const openInBrowser = async () => {
    try {
      await Linking.openURL(currentUrl);
    } catch {}
  };

  // Handler: Copy to Clipboard
  // Copies the current URL to the clipboard and shows a toast
  const copyToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(currentUrl);
      setToastMsg(t('toast.copied'));
      setToastVisible(true);
    } catch {}
  };

  // Handler: Manual Refresh
  // Reloads the WebView content
  const handleRefresh = () => {
    setRefreshing(true);
    webRef.current?.reload();
  };

  // Handler: Message from Injected JavaScript
  // Receives scroll events from the WebView to determine if the user is at the top of the page.
  // This is crucial for enabling/disabling the pull-to-refresh gesture correctly.
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
      // ignore parsing errors
    }
  };

  // Render Component: Error View
  // Displays a localized error message with a retry button when loading fails
  const renderErrorView = () => {
    let errorTitle = t('webview.errorTitle');
    let errorMessage = t('webview.errorMessage');

    if (lastError) {
      if (lastError.type === 'http') {
        // Handle specific HTTP errors (404, 500, etc.)
        const codeStr = String(lastError.code);
        const localizedError = t(`webview.errors.${codeStr}`, { defaultValue: t('webview.errors.unknown') });
        errorTitle = t('webview.httpError', { code: codeStr });
        errorMessage = localizedError;
      } else if (lastError.description) {
        // Handle generic network or webview errors
        errorMessage = lastError.description;
      }
    }

    return (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#0b0f14' : '#ffffff', padding: 20 }}>
         <Ionicons name="alert-circle-outline" size={64} color={dark ? '#30363d' : '#d0d7de'} style={{ marginBottom: 16 }} />
         <Text style={{ fontSize: 18, fontWeight: 'bold', color: dark ? '#e6edf3' : '#0b1220', marginBottom: 8, textAlign: 'center' }}>
           {errorTitle}
         </Text>
         <Text style={{ fontSize: 14, color: dark ? '#8b98a5' : '#3b4654', textAlign: 'center', marginBottom: 24 }}>
           {errorMessage}
         </Text>
         <TouchableOpacity
           onPress={() => {
             setLastError(null);
             webRef.current?.reload();
           }}
           style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: dark ? '#2da44e' : '#2f9e44', borderRadius: 8 }}
         >
           <Text style={{ color: '#fff', fontWeight: '600' }}>{t('webview.retry')}</Text>
         </TouchableOpacity>
      </View>
    );
  };

  // Injected JavaScript: Scroll Detection
  // This script runs inside the WebView to detect the scroll position and send it back to React Native.
  // It handles compatibility across different scrolling elements (window, documentElement, body).
  // The 'true' at the end is required for iOS to signal successful injection.
  const INJECTED_JAVASCRIPT = `
    (function() {
      function handleScroll(e) {
        var scrollY = 0;
        // Prioritize window.scrollY as it's the standard
        if (window.scrollY > 0) {
           scrollY = window.scrollY;
        } else if (e.target && typeof e.target.scrollTop === 'number') {
           scrollY = e.target.scrollTop;
        } else {
           scrollY = document.documentElement.scrollTop || document.body.scrollTop;
        }
        
        // Post message to React Native
        window.ReactNativeWebView.postMessage(JSON.stringify({
           type: 'scroll',
           scrollY: scrollY
        }));
      }

      // Use capture phase (true) to catch scroll events from any internal scrollable element
      window.addEventListener('scroll', handleScroll, true);
    })();
    true;
  `;

  // WebView Component Configuration
  const webViewContent = (
    <WebView
      ref={webRef}
      source={{ uri: initialUrl }}
      // Lifecycle Handlers
      onLoadStart={() => {
        setLoading(true);
        setLastError(null);
      }}
      onLoadEnd={() => {
        setLoading(false);
        setRefreshing(false);
      }}
      onError={(syntheticEvent) => {
        // Handle connection errors (e.g., no internet, DNS failure)
        setLoading(false);
        setRefreshing(false);
        const { nativeEvent } = syntheticEvent;
        setLastError({
          type: 'generic',
          code: nativeEvent.code,
          description: nativeEvent.description
        });
      }}
      onHttpError={(syntheticEvent) => {
        // Handle HTTP status errors (e.g., 404, 500)
        setLoading(false);
        setRefreshing(false);
        const { nativeEvent } = syntheticEvent;
        setLastError({
          type: 'http',
          code: nativeEvent.statusCode,
          description: 'HTTP Error'
        });
      }}
      onNavigationStateChange={handleNavigationStateChange}
      onLoadProgress={({ nativeEvent }) => {
        const p = nativeEvent?.progress ?? 0;
        setProgress(p);
      }}
      // Pull to Refresh Logic
      // Enabled natively only on iOS; Android uses a wrapper ScrollView
      pullToRefreshEnabled={Platform.OS === 'ios'}
      onRefresh={() => {
        webRef.current?.reload();
      }}
      // Error Rendering
      renderError={renderErrorView}
      // Script Injection
      injectedJavaScript={INJECTED_JAVASCRIPT}
      onMessage={handleMessage}
      // UI/UX Configuration
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
      {/* 
        Android ScrollView Wrapper for Pull-to-Refresh:
        On Android, native WebView pull-to-refresh can be buggy or conflict with other gestures.
        We wrap it in a ScrollView with RefreshControl for a consistent experience.
      */}
      {Platform.OS === 'android' ? (
        <ScrollView
          contentContainerStyle={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              enabled={enableRefresher} // Only enable when at the top of the page
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
      
      {/* Loading Progress Bar */}
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
          // Adjust padding for safe area and premium status (no ads space needed if premium)
          paddingBottom: (!isPremium && isConnected) ? 10 : Math.max(insets.bottom, 10)
        }
      ]}>
        {/* Back Button */}
        <TouchableOpacity 
          style={styles.toolbarBtn} 
          disabled={!canGoBack} 
          onPress={() => webRef.current?.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={canGoBack ? (dark ? '#e6edf3' : '#0b1220') : (dark ? '#30363d' : '#d0d7de')} />
        </TouchableOpacity>

        {/* Forward Button */}
        <TouchableOpacity 
          style={styles.toolbarBtn} 
          disabled={!canGoForward} 
          onPress={() => webRef.current?.goForward()}
        >
          <Ionicons name="chevron-forward" size={24} color={canGoForward ? (dark ? '#e6edf3' : '#0b1220') : (dark ? '#30363d' : '#d0d7de')} />
        </TouchableOpacity>

        {/* Copy URL Button */}
        <TouchableOpacity 
          style={styles.toolbarBtn} 
          onPress={copyToClipboard}
        >
          <Ionicons name="copy-outline" size={22} color={dark ? '#e6edf3' : '#0b1220'} />
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity 
          style={styles.toolbarBtn} 
          onPress={onShare}
        >
          <Ionicons name="share-outline" size={22} color={dark ? '#e6edf3' : '#0b1220'} />
        </TouchableOpacity>

        {/* Open in Browser Button */}
        <TouchableOpacity 
          style={styles.toolbarBtn} 
          onPress={openInBrowser}
        >
          <Ionicons name="compass-outline" size={24} color={dark ? '#e6edf3' : '#0b1220'} />
        </TouchableOpacity>

        {/* Refresh/Stop Button (toggles based on loading state) */}
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

      {/* Toast Notification Component */}
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
