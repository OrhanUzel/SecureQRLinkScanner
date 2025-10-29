import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../theme/ThemeContext';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { dark, theme, setTheme } = useAppTheme();
  const navigation = useNavigation();

  useEffect(() => {
    (async () => {
      const savedLang = await AsyncStorage.getItem('language');
      if (savedLang) { setLanguage(savedLang); }
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme) setTheme(savedTheme);
    })();
  }, []);

  const onLang = async (lng) => {
    await AsyncStorage.setItem('language', lng);
    setLanguage(lng);
  };

  const onTheme = async (th) => {
    await AsyncStorage.setItem('theme', th);
    setTheme(th);
  };

  const openDisclaimer = () => {
    navigation.navigate('Disclaimer');
  };

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}> 
      <Text style={[styles.title, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('settings.title')}</Text>

      <Text style={[styles.sectionTitle, { color: dark ? '#8b98a5' : '#3b4654' }]}>{t('language.select')}</Text>
      <View style={styles.row}>
        {['en', 'tr', 'es', 'ar'].map(lng => (
          <TouchableOpacity key={lng} style={[styles.chip, { backgroundColor: i18n.language === lng ? '#0066cc' : (dark ? '#10151c' : '#fff'), borderColor: dark ? '#1b2330' : '#dde3ea' }]} onPress={() => onLang(lng)}>
            <Text style={{ color: i18n.language === lng ? '#fff' : (dark ? '#e6edf3' : '#0b1220'), fontWeight: '700' }}>{lng.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: dark ? '#8b98a5' : '#3b4654' }]}>{t('settings.theme')}</Text>
      <View style={styles.row}>
        {['light', 'dark', 'system'].map(th => (
          <TouchableOpacity key={th} style={[styles.chip, { backgroundColor: theme === th ? '#2f9e44' : (dark ? '#10151c' : '#fff'), borderColor: dark ? '#1b2330' : '#dde3ea' }]} onPress={() => onTheme(th)}>
            <Text style={{ color: theme === th ? '#fff' : (dark ? '#e6edf3' : '#0b1220'), fontWeight: '700' }}>{t(`settings.${th}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.disclaimerBtn} onPress={openDisclaimer}>
        <Text style={styles.disclaimerText}>{t('settings.disclaimer')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 6 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  disclaimerBtn: { backgroundColor: '#6c5ce7', marginTop: 12, padding: 12, borderRadius: 12 },
  disclaimerText: { color: '#fff', fontWeight: '700', textAlign: 'center' }
});