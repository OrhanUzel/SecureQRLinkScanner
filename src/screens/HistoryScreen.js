import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import AdvancedAdCard from '../components/AdvancedAdCard';

export default function HistoryScreen() {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const [items, setItems] = useState([]);

  const load = async () => {
    const raw = await AsyncStorage.getItem('scan_history');
    setItems(raw ? JSON.parse(raw) : []);
  };

  const clear = async () => {
    await AsyncStorage.removeItem('scan_history');
    setItems([]);
  };

  useEffect(() => { load(); }, []);

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}> 
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('history.title')}</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={clear}>
          <Text style={styles.clearText}>{t('history.clear')}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item, idx) => String(idx)}
        renderItem={({ item }) => (
          <View style={[styles.item, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea' }]}> 
            <Text style={{ color: dark ? '#9ecaff' : '#0b1220', fontWeight: '600' }}>{item.content}</Text>
            <Text style={{ color: dark ? '#8b98a5' : '#3b4654' }}>{item.level}</Text>
            <Text style={{ color: dark ? '#8b98a5' : '#3b4654', fontSize: 12 }}>{new Date(item.timestamp).toLocaleString()}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListFooterComponent={<AdvancedAdCard placement="history" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  clearBtn: { backgroundColor: '#d00000', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  clearText: { color: '#fff', fontWeight: '700' },
  item: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 }
});