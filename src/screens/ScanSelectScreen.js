import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

export default function ScanSelectScreen({ navigation }) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}> 
      <Text style={[styles.title, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('scan.select.title')}</Text>
      <View style={styles.grid}>
        <BlurView intensity={30} tint={dark ? 'dark' : 'light'} style={styles.card}>
          <TouchableOpacity style={styles.cardInner} onPress={() => navigation.navigate('LinkScan')}>
            <Ionicons name="link" size={32} color={dark ? '#9ecaff' : '#0066cc'} />
            <Text style={[styles.cardText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('scan.link')}</Text>
          </TouchableOpacity>
        </BlurView>
        <BlurView intensity={30} tint={dark ? 'dark' : 'light'} style={styles.card}>
          <TouchableOpacity style={styles.cardInner} onPress={() => navigation.navigate('CodeScan')}>
            <Ionicons name="qr-code" size={32} color={dark ? '#b9f3b6' : '#2f9e44'} />
            <Text style={[styles.cardText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('scan.code')}</Text>
          </TouchableOpacity>
        </BlurView>
        <BlurView intensity={30} tint={dark ? 'dark' : 'light'} style={styles.card}>
          <TouchableOpacity style={styles.cardInner} onPress={() => navigation.navigate('ImageScan')}>
            <Ionicons name="image" size={32} color={dark ? '#ffd479' : '#d9480f'} />
            <Text style={[styles.cardText, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('scan.image')}</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: '700', marginVertical: 16, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  cardInner: { paddingVertical: 24, alignItems: 'center', gap: 8 },
  cardText: { fontSize: 16, fontWeight: '600' }
});