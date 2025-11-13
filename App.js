import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import i18n from './src/i18n';
import ScanSelectScreen from './src/screens/ScanSelectScreen';
import LinkScanScreen from './src/screens/LinkScanScreen';
import CodeScanScreen from './src/screens/CodeScanScreen';
import ImageScanScreen from './src/screens/ImageScanScreen';
import CreateQrScreen from './src/screens/CreateQrScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import DisclaimerScreen from './src/screens/DisclaimerScreen';
import ConsentModal, { hasConsent, setConsent } from './src/components/ConsentModal';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { loadBlacklist } from './src/utils/classifier';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { dark } = useAppTheme();

  const linking = {
    prefixes: ['app:///'],
    config: { screens: { Disclaimer: 'disclaimer' } }
  };

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' },
          headerTitleStyle: { color: dark ? '#e6edf3' : '#0b1220', fontWeight: '700' },
          headerTintColor: dark ? '#e6edf3' : '#0b1220',
          headerShadowVisible: true,
          contentStyle: { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }
        }}
      >
        <Stack.Screen
          name="Home"
          component={ScanSelectScreen}
          options={({ navigation }) => ({
            title: i18n.t('app.title'),
            headerRight: () => (
              <Ionicons
                name="time-outline"
                size={22}
                color={dark ? '#9ecaff' : '#0066cc'}
                onPress={() => navigation.navigate('History')}
              />
            ),
            headerLeft: () => (
              <Ionicons
                name="settings-outline"
                size={22}
                color={dark ? '#c1b6ff' : '#6c5ce7'}
                onPress={() => navigation.navigate('Settings')}
              />
            )
          })}
        />
        <Stack.Screen name="LinkScan" component={LinkScanScreen} options={{ title: i18n.t('scan.link') }} />
        <Stack.Screen name="CodeScan" component={CodeScanScreen} options={{ title: i18n.t('scan.code') }} />
        <Stack.Screen name="ImageScan" component={ImageScanScreen} options={{ title: i18n.t('scan.image') }} />
        <Stack.Screen name="CreateQR" component={CreateQrScreen} options={{ title: i18n.t('scan.create') }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: i18n.t('history.title') }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: i18n.t('settings.title') }} />
        <Stack.Screen name="Disclaimer" component={DisclaimerScreen} options={{ title: i18n.t('disclaimer.title'), presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [consented, setConsented] = useState(true);

  useEffect(() => {
    (async () => {
      const ok = await hasConsent();
      setConsented(ok);
      // Preload blacklist so classification can check synchronously
      try { await loadBlacklist(); } catch {}
    })();
  }, []);

  return (
    <ThemeProvider>
      <RootNavigator />
      <StatusBar style={consented ? 'auto' : 'light'} />
      <ConsentModal visible={!consented} onAccept={async () => { await setConsent(); setConsented(true); }} />
    </ThemeProvider>
  );
}
