import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { classifyInput, loadBlacklist } from '../utils/classifier';
import { useAppTheme } from '../theme/ThemeContext';

export default function LinkScanScreen() {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);

 const onAnalyze = async () => {
  if (!input.trim()) return;
  
  // İlk yükleme için loading state ekleyin
  //setLoading(true);
  
  try {
    // Blacklist'i yükleyip ardından sınıflandır
    await loadBlacklist();
    const res = classifyInput(input.trim());
    setResult(res);
  } catch (error) {
    console.error('Analysis failed:', error);
    // Hata durumunda fallback
    const res = classifyInput(input.trim());
    setResult(res);
  } 
};

  const clearInput = () => {
    setInput('');
    setResult(null);
  };

  const openLink = async () => {
    if (result?.normalized && result.isUrl) {
      try {
        await Linking.openURL(result.normalized);
      } catch (e) {
        Alert.alert('Hata', e.message);
      }
    }
  };

  const vtLink = () => {
    if (result?.normalized) {
      // URL'den domain çıkar
      let domain = result.normalized;
      try {
        const urlObj = new URL(result.normalized.startsWith('http') ? result.normalized : 'https://' + result.normalized);
        domain = urlObj.hostname;
      } catch (e) {
        // Eğer parse edilemezse, direkt kullan
        domain = result.normalized.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      }
      const url = 'https://www.virustotal.com/gui/domain/' + encodeURIComponent(domain);
      Linking.openURL(url);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}> 
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, { backgroundColor: dark ? '#10151c' : '#fff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]}
          placeholder={t('scan.link')}
          placeholderTextColor={dark ? '#8b98a5' : '#7a8699'}
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {input.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={clearInput}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={20} color={dark ? '#8b98a5' : '#7a8699'} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.button, !input.trim() && styles.buttonDisabled]} 
        onPress={onAnalyze}
        disabled={!input.trim()}
        activeOpacity={0.8}
      >
        <Ionicons name="shield-checkmark" size={20} color="#fff" />
        <Text style={styles.buttonText}>{t('actions.scan')}</Text>
      </TouchableOpacity>

      {result && (
        <View style={[styles.card, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea' }]}> 
          <Text style={[styles.linkText, { color: dark ? '#9ecaff' : '#0969da' }]} numberOfLines={2}>
            {result.normalized}
          </Text>
          <View style={styles.badgeRow}>
            <RiskBadge level={result.level} />
          </View>
          {result.reasons?.length > 0 && (
            <View style={styles.reasonList}>
              {result.reasons.map((r, idx) => (
                <Text key={idx} style={[styles.reasonText, { color: dark ? '#8b98a5' : '#57606a' }]}>
                  • {t(r)}
                </Text>
              ))}
            </View>
          )}
          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#2da44e' }]} 
              onPress={openLink}
              activeOpacity={0.8}
            >
              <Ionicons name="open-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>{t('actions.openLink')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#8250df' }]} 
              onPress={vtLink}
              activeOpacity={0.8}
            >
              <Ionicons name="search-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>VirusTotal</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function RiskBadge({ level }) {
  let color = '#2da44e', text = 'result.secure', icon = 'shield-checkmark';
  if (level === 'suspicious') { 
    color = '#fb8500'; 
    text = 'result.suspicious'; 
    icon = 'warning'; 
  }
  if (level === 'unsafe') { 
    color = '#cf222e'; 
    text = 'result.unsafe'; 
    icon = 'close-circle'; 
  }
  const { t } = useTranslation();
  
  return (
    <View style={[styles.badge, { backgroundColor: color }]}> 
      <Ionicons name={icon} size={16} color="#fff" />
      <Text style={styles.badgeText}>{t(text)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    gap: 16 
  },
  inputContainer: {
    position: 'relative',
    width: '100%'
  },
  input: { 
    borderWidth: 1, 
    borderRadius: 12, 
    padding: 14,
    paddingRight: 44,
    fontSize: 15,
    fontWeight: '500'
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
    padding: 4
  },
  button: { 
    backgroundColor: '#0969da', 
    borderRadius: 12, 
    paddingVertical: 14, 
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  buttonDisabled: {
    backgroundColor: '#6e7781',
    opacity: 0.5
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 16
  },
  card: { 
    borderWidth: 1, 
    borderRadius: 12, 
    padding: 16, 
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  linkText: { 
    fontSize: 15, 
    fontWeight: '600',
    lineHeight: 22
  },
  badgeRow: { 
    flexDirection: 'row' 
  },
  badge: { 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    borderRadius: 6, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  badgeText: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 13
  },
  reasonList: { 
    gap: 6,
    marginTop: 4
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20
  },
  actions: { 
    flexDirection: 'row', 
    gap: 10, 
    marginTop: 8 
  },
  actionBtn: { 
    flex: 1,
    paddingVertical: 10, 
    paddingHorizontal: 12, 
    borderRadius: 10, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 6 
  },
  actionBtnText: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 14
  }
});