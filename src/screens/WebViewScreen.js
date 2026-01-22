import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, Platform, Share, StyleSheet, Text, ScrollView, RefreshControl, BackHandler, TextInput, Modal, FlatList, Keyboard, ActivityIndicator } from 'react-native';
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
 * Enhanced with Search Bar and Tab Management.
 * Acts as a "Secure Browser" for the application.
 */
export default function WebViewScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  
  const initialUrl = (route?.params?.url || '').trim();

  // --- Tab Management State ---
  // We maintain a list of tabs. The WebView renders the 'active' tab's URL.
  // Note: For memory efficiency, we use a single WebView instance that switches URLs.
  // This means history is reset when switching tabs, but it's lighter for the device.
  const [tabs, setTabs] = useState([
    { id: '1', url: initialUrl, title: extractDomain(initialUrl) || 'New Tab' }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [showTabs, setShowTabs] = useState(false);

  // Derived state for the active tab
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // --- WebView State ---
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enableRefresher, setEnableRefresher] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // --- UI State ---
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [inputText, setInputText] = useState(initialUrl);
  const [isFocused, setIsFocused] = useState(false);

  // --- Search Suggestions State ---
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef(null);

  // Refs
  const webRef = useRef(null);
  const inputRef = useRef(null);

  // --- Business Logic State ---
  const [isPremium, setIsPremium] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [lastError, setLastError] = useState(null);

  // --- Effects ---

  // Hide default header to use our custom Search Bar header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Sync Input Text with Active Tab URL when loading finishes
  useEffect(() => {
    if (!loading && activeTab) {
      setInputText(activeTab.url);
    }
  }, [loading, activeTab]);

  // Check Premium
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

  // Network Listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });
    return unsubscribe;
  }, []);

  // --- Helper: Safe Navigation ---
  const safeGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  // Back Handler
  useEffect(() => {
    const onBackPress = () => {
      if (showTabs) {
        setShowTabs(false);
        return true;
      }
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      // If closing the last tab or back from app, normal behavior
      if (tabs.length > 1) {
        // Close current tab logic could go here, but usually Back exits the screen if no history
        // Let's stick to standard behavior: exit screen
      }
      safeGoBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [canGoBack, navigation, showTabs, tabs]);

  // --- Actions ---

  const updateActiveTab = (updates) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, ...updates } : tab
    ));
  };

  const handleNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setLoading(navState.loading);
    
    // Update the active tab's URL and Title
    if (!navState.loading) {
      updateActiveTab({ 
        url: navState.url,
        title: navState.title || extractDomain(navState.url) || t('label.url')
      });
      // Only update input text if user is not typing
      if (!isFocused) {
        setInputText(navState.url);
      }
    }
  };

  const performSearch = (text) => {
    let url = text.trim();
    if (!url) return;

    // Basic URL detection
    const hasProtocol = url.startsWith('http://') || url.startsWith('https://');
    const hasDomain = url.includes('.') && !url.includes(' ');
    
    let finalUrl = url;
    if (hasProtocol) {
      // It's a URL
    } else if (hasDomain) {
      finalUrl = 'https://' + url;
    } else {
      // It's a search query
      finalUrl = 'https://www.google.com/search?q=' + encodeURIComponent(url);
    }

    Keyboard.dismiss();
    setShowSuggestions(false);
    updateActiveTab({ url: finalUrl, title: finalUrl }); // Optimistic update
    setInputText(finalUrl);
  };

  const handleSearchSubmit = () => {
    performSearch(inputText);
  };

  const onSearchTextChange = (text) => {
    setInputText(text);
    
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    if (!text || text.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        let currentLang = 'en';
        if (i18n && i18n.language) {
          currentLang = i18n.language.split('-')[0];
        }
        
        // Using http to avoid any SSL issues on specific devices/emulators
        const response = await fetch(`http://suggestqueries.google.com/complete/search?client=firefox&hl=${currentLang}&oe=utf-8&q=${encodeURIComponent(text)}`);
        const data = await response.json();
        if (data && data[1]) {
           setSuggestions(data[1]);
           setShowSuggestions(true);
        }
      } catch (e) {
        console.log('Suggestion fetch error:', e);
      }
    }, 200);
  };

  const onSuggestionPress = (item) => {
    performSearch(item);
  };

  const addNewTab = () => {
    const newId = Date.now().toString();
    const newTab = {
      id: newId,
      url: 'https://www.google.com', // Default to Google
      title: 'Google'
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setShowTabs(false);
  };

  const closeTab = (idToClose) => {
    if (tabs.length === 1) {
      // If it's the last tab, close the screen
      navigation.goBack();
      return;
    }

    const newTabs = tabs.filter(t => t.id !== idToClose);
    setTabs(newTabs);

    if (activeTabId === idToClose) {
      // Switch to the last available tab
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const switchToTab = (id) => {
    setActiveTabId(id);
    setShowTabs(false);
  };

  const onShare = async () => {
    try {
      await Share.share({
        message: activeTab.url,
        url: activeTab.url,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  const openInBrowser = async () => {
    try {
      await Linking.openURL(activeTab.url);
    } catch {}
  };

  const copyToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(activeTab.url);
      setToastMsg(t('toast.copied'));
      setToastVisible(true);
    } catch {}
  };

  const handleRefresh = () => {
    setRefreshing(true);
    webRef.current?.reload();
  };

  // --- Components ---

  const renderErrorView = () => {
    let errorTitle = t('webview.errorTitle');
    let errorMessage = t('webview.errorMessage');

    if (lastError) {
      if (lastError.type === 'http') {
        const codeStr = String(lastError.code);
        const localizedError = t(`webview.errors.${codeStr}`, { defaultValue: t('webview.errors.unknown') });
        errorTitle = t('webview.httpError', { code: codeStr });
        errorMessage = localizedError;
      } else if (lastError.description) {
        errorMessage = lastError.description;
      }
    }

    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
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

  const INJECTED_JAVASCRIPT = `
    (function() {
      function handleScroll(e) {
        var scrollY = 0;
        if (window.scrollY > 0) scrollY = window.scrollY;
        else if (e.target && typeof e.target.scrollTop === 'number') scrollY = e.target.scrollTop;
        else scrollY = document.documentElement.scrollTop || document.body.scrollTop;
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
           type: 'scroll',
           scrollY: scrollY
        }));
      }
      window.addEventListener('scroll', handleScroll, true);
    })();
    true;
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'scroll') {
        const isAtTop = data.scrollY <= 0;
        if (isAtTop !== enableRefresher) {
          setEnableRefresher(isAtTop);
        }
      }
    } catch (error) {}
  };

  // --- Render ---

  const isSecure = activeTab?.url.startsWith('https://');

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#0b0f14' : '#ffffff', paddingTop: insets.top }}>
      
      {/* --- Custom Header / Address Bar --- */}
      <View style={[styles.headerContainer, { borderBottomColor: dark ? '#30363d' : '#e1e4e8', backgroundColor: dark ? '#0b0f14' : '#ffffff' }]}>
        {/* Close Button */}
        <TouchableOpacity 
          onPress={safeGoBack} 
          style={styles.headerBtn}
        >
          <Ionicons name="close" size={24} color={dark ? '#e6edf3' : '#0b1220'} />
        </TouchableOpacity>

        {/* Search/Address Input */}
        <View style={[styles.searchBar, { backgroundColor: dark ? '#161b22' : '#f6f8fa', borderColor: isFocused ? (dark ? '#388bfd' : '#0969da') : 'transparent', borderWidth: 1 }]}>
          {isSecure ? (
            <Ionicons name="lock-closed" size={14} color="#2ea043" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="globe-outline" size={14} color={dark ? '#8b98a5' : '#656d76'} style={{ marginRight: 8 }} />
          )}
          <TextInput
            ref={inputRef}
            style={{ flex: 1, color: dark ? '#e6edf3' : '#1f2328', fontSize: 17, height: '100%' }}
            value={inputText}
            onChangeText={onSearchTextChange}
            onSubmitEditing={handleSearchSubmit}
            onFocus={() => {
              setIsFocused(true);
              if (inputText && inputText.length > 0) setShowSuggestions(true);
            }}
            onBlur={() => {
              setIsFocused(false);
              // Small delay to allow tap on suggestion to register
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            placeholder={t('webview.placeholder')}
            placeholderTextColor={dark ? '#8b98a5' : '#656d76'}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectTextOnFocus
          />
          {inputText.length > 0 && isFocused && (
             <TouchableOpacity onPress={() => setInputText('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={20} color={dark ? '#8b98a5' : '#656d76'} />
             </TouchableOpacity>
          )}
        </View>

        {/* Menu/More Button (Optional, could be used for reload or other actions) */}
        <TouchableOpacity 
          onPress={() => webRef.current?.reload()} 
          style={styles.headerBtn}
        >
          <Ionicons name="refresh" size={20} color={dark ? '#e6edf3' : '#0b1220'} />
        </TouchableOpacity>
      </View>

      {/* --- Suggestions List --- */}
      {showSuggestions && suggestions.length > 0 && (
         <View style={{
            position: 'absolute',
            top: 64 + insets.top, 
            left: 0, 
            right: 0, 
            backgroundColor: dark ? '#161b22' : '#ffffff', 
            borderBottomWidth: 1, 
            borderBottomColor: dark ? '#30363d' : '#e1e4e8', 
            zIndex: 100,
            maxHeight: 240,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 4
         }}>
           <FlatList
             data={suggestions}
             keyExtractor={(item, index) => index.toString()}
             keyboardShouldPersistTaps="handled"
             renderItem={({ item }) => (
               <TouchableOpacity 
                 style={{ 
                   paddingHorizontal: 16, 
                   paddingVertical: 12, 
                   borderBottomWidth: 0.5, 
                   borderBottomColor: dark ? '#30363d' : '#e1e4e8', 
                   flexDirection: 'row', 
                   alignItems: 'center' 
                 }}
                 onPress={() => onSuggestionPress(item)}
               >
                 <Ionicons name="search" size={16} color={dark ? '#8b98a5' : '#656d76'} style={{ marginRight: 12 }} />
                 <Text style={{ color: dark ? '#e6edf3' : '#1f2328', fontSize: 16 }}>{item}</Text>
               </TouchableOpacity>
             )}
           />
         </View>
      )}

      {/* --- WebView Body --- */}
      <View style={{ flex: 1 }}>
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
             <WebView
              key={activeTabId} // Force re-render when switching tabs (optional, but ensures clean state)
              ref={webRef}
              source={{ uri: activeTab.url }}
              originWhitelist={['*']}
              onLoadStart={() => { setLoading(true); setLastError(null); }}
              onLoadEnd={() => { setLoading(false); setRefreshing(false); }}
              onError={(e) => { setLoading(false); setRefreshing(false); setLastError({ type: 'generic', ...e.nativeEvent }); }}
              onHttpError={(e) => { setLoading(false); setRefreshing(false); setLastError({ type: 'http', code: e.nativeEvent.statusCode }); }}
              onNavigationStateChange={handleNavigationStateChange}
              onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent?.progress ?? 0)}
              renderError={renderErrorView}
              injectedJavaScript={INJECTED_JAVASCRIPT}
              onMessage={handleMessage}
              overScrollMode="always"
              nestedScrollEnabled
              startInLoadingState={false}
              incognito
              style={{ flex: 1, backgroundColor: dark ? '#0b0f14' : '#ffffff' }}
            />
          </ScrollView>
        ) : (
          <WebView
            key={activeTabId}
            ref={webRef}
            source={{ uri: activeTab.url }}
            originWhitelist={['*']}
            onLoadStart={() => { setLoading(true); setLastError(null); }}
            onLoadEnd={() => { setLoading(false); setRefreshing(false); }}
            onError={(e) => { setLoading(false); setRefreshing(false); setLastError({ type: 'generic', ...e.nativeEvent }); }}
            onHttpError={(e) => { setLoading(false); setRefreshing(false); setLastError({ type: 'http', code: e.nativeEvent.statusCode }); }}
            onNavigationStateChange={handleNavigationStateChange}
            onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent?.progress ?? 0)}
            pullToRefreshEnabled={Platform.OS === 'ios'}
            decelerationRate="normal"
            onRefresh={() => webRef.current?.reload()}
            renderError={renderErrorView}
            injectedJavaScript={INJECTED_JAVASCRIPT}
            onMessage={handleMessage}
            bounces
            overScrollMode="always"
            nestedScrollEnabled
            allowsBackForwardNavigationGestures
            startInLoadingState={false}
            incognito
            style={{ flex: 1, backgroundColor: dark ? '#0b0f14' : '#ffffff' }}
          />
        )}

        {/* Loading Bar */}
        {loading && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
            <View style={{ height: 3, width: '100%', backgroundColor: dark ? '#1b2330' : '#e5e9f0' }}>
              <View style={{ height: 3, width: `${Math.max(2, Math.floor(progress * 100))}%`, backgroundColor: '#2ea043' }} />
            </View>
          </View>
        )}
      </View>

      {/* --- Bottom Toolbar --- */}
      <View style={[styles.toolbar, { 
          backgroundColor: dark ? '#161b22' : '#ffffff', 
          borderTopColor: dark ? '#30363d' : '#e1e4e8',
          paddingBottom: (!isPremium && isConnected) ? 10 : Math.max(insets.bottom, 10)
        }]}>
        
        <TouchableOpacity style={styles.toolbarBtn} disabled={!canGoBack} onPress={() => webRef.current?.goBack()}>
          <Ionicons name="chevron-back" size={24} color={canGoBack ? (dark ? '#e6edf3' : '#0b1220') : (dark ? '#30363d' : '#d0d7de')} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarBtn} disabled={!canGoForward} onPress={() => webRef.current?.goForward()}>
          <Ionicons name="chevron-forward" size={24} color={canGoForward ? (dark ? '#e6edf3' : '#0b1220') : (dark ? '#30363d' : '#d0d7de')} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarBtn} onPress={onShare}>
          <Ionicons name="share-outline" size={22} color={dark ? '#e6edf3' : '#0b1220'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarBtn} onPress={openInBrowser}>
          <Ionicons name="compass-outline" size={24} color={dark ? '#e6edf3' : '#0b1220'} />
        </TouchableOpacity>

        {/* Tabs Button */}
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowTabs(true)}>
          <View style={{ width: 24, height: 24, borderWidth: 2, borderColor: dark ? '#e6edf3' : '#0b1220', borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: dark ? '#e6edf3' : '#0b1220' }}>
              {tabs.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* --- Tab Switcher Modal --- */}
      <Modal
        visible={showTabs}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowTabs(false)}
        presentationStyle="fullScreen"
      >
        <View style={{ flex: 1, backgroundColor: dark ? '#0d1117' : '#f6f8fa' }}>
          {/* Modal Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginTop: Platform.OS === 'ios' ? insets.top : 16,
            borderBottomWidth: 1, 
            borderBottomColor: dark ? '#30363d' : '#d0d7de' 
          }}>
            <TouchableOpacity 
              onPress={() => setShowTabs(false)}
              style={{ padding: 8, marginLeft: -8 }}
            >
              <Text style={{ fontSize: 17, color: dark ? '#58a6ff' : '#0969da' }}>{t('webview.close')}</Text>
            </TouchableOpacity>
            
            <Text style={{ fontSize: 17, fontWeight: '600', color: dark ? '#e6edf3' : '#0b1220' }}>
              {t('webview.tabs')} ({tabs.length})
            </Text>
            
            <TouchableOpacity 
              onPress={addNewTab}
              style={{ padding: 8, marginRight: -8 }}
            >
              <Ionicons name="add" size={28} color={dark ? '#58a6ff' : '#0969da'} />
            </TouchableOpacity>
          </View>

          {/* Tabs List */}
          <FlatList
            data={tabs}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, gap: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity 
                onPress={() => switchToTab(item.id)}
                activeOpacity={0.7}
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  backgroundColor: dark ? '#161b22' : '#ffffff', 
                  padding: 16, 
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: item.id === activeTabId ? '#2ea043' : (dark ? '#30363d' : '#d0d7de'),
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2
                }}
              >
                <View style={{ 
                  width: 48, 
                  height: 48, 
                  backgroundColor: dark ? '#21262d' : '#f6f8fa', 
                  borderRadius: 12, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginRight: 16 
                }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: dark ? '#e6edf3' : '#0b1220' }}>
                    {item.title ? item.title.charAt(0).toUpperCase() : 'N'}
                  </Text>
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: dark ? '#e6edf3' : '#0b1220', marginBottom: 4 }} numberOfLines={1}>
                    {item.title || t('webview.newTab')}
                  </Text>
                  <Text style={{ fontSize: 13, color: dark ? '#8b98a5' : '#656d76' }} numberOfLines={1}>
                    {item.url}
                  </Text>
                </View>
                
                <TouchableOpacity 
                  onPress={(e) => { e.stopPropagation(); closeTab(item.id); }} 
                  style={{ padding: 8, marginRight: -8 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                   <Ionicons name="close-circle" size={24} color={dark ? '#8b98a5' : '#656d76'} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
          
          {/* Bottom Action (Add New Tab - Big Button) */}
          <View style={{ padding: 16, paddingBottom: insets.bottom + 16, backgroundColor: dark ? '#161b22' : '#ffffff', borderTopWidth: 1, borderTopColor: dark ? '#30363d' : '#d0d7de' }}>
             <TouchableOpacity 
               onPress={addNewTab}
               style={{ 
                 backgroundColor: dark ? '#238636' : '#2da44e', 
                 paddingVertical: 14, 
                 borderRadius: 8, 
                 alignItems: 'center',
                 flexDirection: 'row',
                 justifyContent: 'center',
                 gap: 8
               }}
             >
               <Ionicons name="add-circle-outline" size={20} color="#ffffff" />
               <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>{t('webview.newTab')}</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    gap: 2,
  },
  headerBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 10,
    marginHorizontal: 4,
  },
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
