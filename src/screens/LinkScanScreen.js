import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, useColorScheme, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { classifyInput } from '../utils/classifier';

export default function LinkScanScreen() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';

  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);

  const onAnalyze = () => {
    if (!input.trim()) return;
    const res = classifyInput(input.trim());
    setResult(res);
  };

  const openLink = async () => {
    if (result?.normalized && (result.isUrl)) {
      try {
        await Linking.openURL(result.normalized);
      } catch (e) {
        Alert.alert('Error', e.message);
      }
    }
  };

  const vtLink = () => {
    if (result?.normalized) {
      const url = 'https://www.virustotal.com/gui/url/' + encodeURIComponent(result.normalized);
      Linking.openURL(url);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}> 
      <TextInput
        style={[styles.input, { backgroundColor: dark ? '#10151c' : '#fff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]}
        placeholder={t('scan.link')}
        placeholderTextColor={dark ? '#8b98a5' : '#7a8699'}
        value={input}
        onChangeText={setInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity style={styles.button} onPress={onAnalyze}>
        <Ionicons name="shield-checkmark" size={18} color="#fff" />
        <Text style={styles.buttonText}>{t('actions.scan')}</Text>
      </TouchableOpacity>

      {result && (
        <View style={[styles.card, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea' }]}> 
          <Text style={[styles.linkText, { color: dark ? '#9ecaff' : '#0b1220' }]}>{result.normalized}</Text>
          <View style={styles.badgeRow}>
            <RiskBadge level={result.level} />
          </View>
          {result.reasons?.length ? (
            <View style={styles.reasonList}>
              {result.reasons.map((r, idx) => (
                <Text key={idx} style={{ color: dark ? '#8b98a5' : '#3b4654' }}>• {t(r)}</Text>
              ))}
            </View>
          ) : null}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#2f9e44' }]} onPress={openLink}>
              <Ionicons name="open" size={16} color="#fff" />
              <Text style={styles.smallBtnText}>{t('actions.openLink')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#6c5ce7' }]} onPress={vtLink}>
              <Ionicons name="bug" size={16} color="#fff" />
              <Text style={styles.smallBtnText}>{t('actions.analyzeVirusTotal')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function RiskBadge({ level }) {
  let color = '#2f9e44', text = 'result.secure', icon = 'shield-checkmark';
  if (level === 'suspicious') { color = '#ffb703'; text = 'result.suspicious'; icon = 'warning'; }
  if (level === 'unsafe') { color = '#d00000'; text = 'result.unsafe'; icon = 'shield'; }
  const { t } = useTranslation();
  return (
    <View style={[styles.badge, { backgroundColor: color }]}> 
      <Ionicons name={icon} size={16} color="#fff" />
      <Text style={styles.badgeText}>{t(text)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12 },
  button: { backgroundColor: '#0066cc', borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  linkText: { fontSize: 14, fontWeight: '600' },
  badgeRow: { flexDirection: 'row' },
  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeText: { color: '#fff', fontWeight: '700' },
  reasonList: { gap: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  smallBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  smallBtnText: { color: '#fff', fontWeight: '600' }
});