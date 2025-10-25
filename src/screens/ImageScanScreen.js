import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useColorScheme, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { classifyInput } from '../utils/classifier';

// Simpler approach: rely on QR images that are already URLs or text. A real QR decode
// from image would require a library; Expo doesn't ship one built-in. For MVP,
// let users pick image and manually enter/confirm the decoded text.

export default function ImageScanScreen() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const [image, setImage] = useState(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: [ImagePicker.MediaType.IMAGE], quality: 1 });
    if (!res.canceled) {
      setImage(res.assets[0].uri);
    }
  };

  const analyzeText = () => {
    if (!text.trim()) return;
    setResult(classifyInput(text.trim()));
  };

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}> 
      <TouchableOpacity style={styles.button} onPress={pickImage}>
        <Ionicons name="images" size={18} color="#fff" />
        <Text style={styles.buttonText}>{t('scan.image')}</Text>
      </TouchableOpacity>
      {image && (
        <Image source={{ uri: image }} style={styles.preview} />
      )}
      <TextInput
        style={[styles.input, { backgroundColor: dark ? '#10151c' : '#fff', color: dark ? '#e6edf3' : '#0b1220', borderColor: dark ? '#1b2330' : '#dde3ea' }]}
        placeholder={t('scan.code') || 'Metin veya URL girin'}
        placeholderTextColor={dark ? '#8b98a5' : '#7a8699'}
        value={text}
        onChangeText={setText}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={{ color: dark ? '#8b98a5' : '#3b4654', fontSize: 12, marginTop: 6 }}>
        Görüntü seçip buraya metin/URL yazın; sonra "Analiz".
      </Text>
      <TouchableOpacity style={[styles.button, { backgroundColor: '#2f9e44' }]} onPress={analyzeText}>
        <Ionicons name="shield-checkmark" size={18} color="#fff" />
        <Text style={styles.buttonText}>{t('actions.scan')}</Text>
      </TouchableOpacity>
      {result && (
        <View style={[styles.card, { backgroundColor: dark ? '#10151c' : '#fff', borderColor: dark ? '#1b2330' : '#dde3ea' }]}> 
          <Text style={[styles.linkText, { color: dark ? '#9ecaff' : '#0b1220' }]}>{result.normalized}</Text>
          <RiskBadge level={result.level} />
          {result.reasons?.length ? (
            <View style={styles.reasonList}>
              {result.reasons.map((r, idx) => (
                <Text key={idx} style={{ color: dark ? '#8b98a5' : '#3b4654' }}>• {t(r)}</Text>
              ))}
            </View>
          ) : null}
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
  button: { backgroundColor: '#0066cc', borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  linkText: { fontSize: 14, fontWeight: '600' },
  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  badgeText: { color: '#fff', fontWeight: '700' },
  reasonList: { gap: 4 }
});