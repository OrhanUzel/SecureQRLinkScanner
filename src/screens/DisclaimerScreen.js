import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import AdBanner from '../components/AdBanner';

export default function DisclaimerScreen() {
  const { t } = useTranslation();
  const { dark } = useAppTheme();

  const textColor = dark ? '#e6edf3' : '#0b1220';
  const subTextColor = dark ? '#8b98a5' : '#3b4654';
  const bgColor = dark ? '#0d1117' : '#ffffff';
  const sectionTitleColor = dark ? '#58a6ff' : '#0969da';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: textColor }]}>{t('disclaimer.title')}</Text>
        
        <View style={[styles.note, { backgroundColor: dark ? 'rgba(56,139,253,0.1)' : '#f7f9fc', borderColor: dark ? 'rgba(56,139,253,0.4)' : '#dde3ea' }]}>
          <Text style={[styles.body, { color: textColor }]}>{t('disclaimer.intro')}</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>{t('disclaimer.service.title')}</Text>
        <Text style={[styles.body, { color: subTextColor }]}>{t('disclaimer.service.body')}</Text>
        <View style={styles.list}>
          <Text style={[styles.listItem, { color: subTextColor }]}>• {t('disclaimer.service.item1')}</Text>
          <Text style={[styles.listItem, { color: subTextColor }]}>• {t('disclaimer.service.item2')}</Text>
          <Text style={[styles.listItem, { color: subTextColor }]}>• {t('disclaimer.service.item3')}</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>{t('disclaimer.liability.title')}</Text>
        <Text style={[styles.body, { color: subTextColor }]}>{t('disclaimer.liability.body')}</Text>

        <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>{t('disclaimer.responsibility.title')}</Text>
        <Text style={[styles.body, { color: subTextColor }]}>{t('disclaimer.responsibility.body')}</Text>

        <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>{t('disclaimer.privacy.title')}</Text>
        <Text style={[styles.body, { color: subTextColor }]}>{t('disclaimer.privacy.body')}</Text>
        
        <View style={{ height: 20 }} />
      </ScrollView>
      
      <View style={{ borderTopWidth: 1, borderTopColor: dark ? '#30363d' : '#e1e4e8', padding: 8 }}>
        <AdBanner placement="global_footer" isFooter />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 22 },
  note: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 16 },
  list: { marginTop: 8, paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 20, marginBottom: 6 }
});
