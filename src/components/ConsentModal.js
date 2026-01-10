import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { getItemAsync, setItemAsync } from '../utils/secureStore';
import Constants from 'expo-constants';
import { useAppTheme } from '../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function ConsentModal({ visible, onAccept }) {
  const { t } = useTranslation();
  const { dark } = useAppTheme();

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <BlurView intensity={60} tint={dark ? 'dark' : 'light'} style={[styles.modal, { backgroundColor: dark ? 'rgba(22,27,34,0.85)' : 'rgba(255,255,255,0.85)' } ]}>
          <View style={styles.headerRow}>
            <Ionicons name="shield-checkmark" size={24} color={dark ? '#7ee787' : '#2da44e'} />
            <Text style={[styles.title, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('consent.title')}</Text>
          </View>

          <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={[styles.message, { color: dark ? '#8b98a5' : '#3b4654' }]}>{t('consent.message')}</Text>
            {['consent.p1','consent.p2','consent.p3','consent.p4','consent.p5','consent.p6'].map((key) => (
              <View key={key} style={styles.pointRow}>
                <Ionicons name="information-circle" size={18} color={dark ? '#8b98a5' : '#3b4654'} />
                <Text style={[styles.pointText, { color: dark ? '#9aa6b2' : '#354253' }]}>{t(key)}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.actionsCentered}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: dark ? '#2da44e' : '#2f9e44' }]} onPress={onAccept}>
              <Text style={styles.btnText}>{t('consent.accept')}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

export async function hasConsent() {
  const v = await getItemAsync('user_consent');
  if (!v) return false;
  try {
    const obj = JSON.parse(v);
    return !!obj && obj.status === 'accepted';
  } catch {
    return v === 'yes';
  }
}

export async function setConsent() {
  const payload = {
    status: 'accepted',
    timestamp: new Date().toISOString(),
    appVersion: (Constants?.expoConfig?.version) || 'unknown'
  };
  await setItemAsync('user_consent', JSON.stringify(payload));
}

export async function getConsentInfo() {
  const v = await getItemAsync('user_consent');
  if (!v) return null;
  try { return JSON.parse(v); } catch { return { status: v }; }
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(100,100,100,0.2)', overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  message: { fontSize: 14, marginBottom: 8 },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  pointText: { fontSize: 13, lineHeight: 18, flex: 1 },
  //actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  actionsCentered: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12 },

  btn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' }
  ,
  btnSecondary: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  btnSecondaryText: { fontWeight: '600' }
});
