import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import i18n from './src/i18n';
import ScanSelectScreen from './src/screens/ScanSelectScreen';
import LinkScanScreen from './src/screens/LinkScanScreen';
import CodeScanScreen from './src/screens/CodeScanScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import DisclaimerScreen from './src/screens/DisclaimerScreen';
import ConsentModal, { hasConsent, setConsent } from './src/components/ConsentModal';
import { Ionicons } from '@expo/vector-icons';

const Stack = createNativeStackNavigator();

export default function App() {
  const scheme = useColorScheme();
  const [consented, setConsented] = useState(true);

  useEffect(() => {
    (async () => {
      const ok = await hasConsent();
      setConsented(ok);
    })();
  }, []);

  const linking = {
    prefixes: ['app:///'],
    config: { screens: { Disclaimer: 'disclaimer' } }
  };

  return (
    <>
      <NavigationContainer linking={linking}>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={ScanSelectScreen} options={({ navigation }) => ({ title: i18n.t('app.title'),
            headerRight: () => (<Ionicons name="settings-outline" size={22} color="#6c5ce7" onPress={() => navigation.navigate('Settings')} />),
            headerLeft: () => (<Ionicons name="time-outline" size={22} color="#0066cc" onPress={() => navigation.navigate('History')} />)
          })} />
          <Stack.Screen name="LinkScan" component={LinkScanScreen} options={{ title: i18n.t('scan.link') }} />
          <Stack.Screen name="CodeScan" component={CodeScanScreen} options={{ title: i18n.t('scan.code') }} />
          <Stack.Screen name="History" component={HistoryScreen} options={{ title: i18n.t('history.title') }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: i18n.t('settings.title') }} />
          <Stack.Screen name="Disclaimer" component={DisclaimerScreen} options={{ title: i18n.t('disclaimer.title') }} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ConsentModal visible={!consented} onAccept={async () => { await setConsent(); setConsented(true); }} />
    </>
  );
}
