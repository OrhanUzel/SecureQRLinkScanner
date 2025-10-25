import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';

export default function DisclaimerScreen() {
  const [html, setHtml] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/disclaimer.html'));
        await asset.downloadAsync();
        const response = await fetch(asset.localUri || asset.uri);
        const text = await response.text();
        setHtml(text);
      } catch (e) {
        setHtml('<h2>Disclaimer</h2><p>Unable to load HTML asset.</p>');
      }
    })();
  }, []);

  if (!html) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }
  return (
    <WebView originWhitelist={["*"]} source={{ html }} style={{ flex: 1 }} />
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });