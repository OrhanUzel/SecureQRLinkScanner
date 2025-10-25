import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { getItemAsync, setItemAsync } from '../utils/secureStore';

export default function ConsentModal({ visible, onAccept }) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <BlurView intensity={40} tint={dark ? 'dark' : 'light'} style={styles.modal}>
          <Text style={[styles.title, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('consent.title')}</Text>
          <Text style={[styles.message, { color: dark ? '#8b98a5' : '#3b4654' }]}>{t('consent.message')}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#2f9e44' }]} onPress={onAccept}>
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
  return v === 'yes';
}

export async function setConsent() {
  await setItemAsync('user_consent', 'yes');
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', borderRadius: 16, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  message: { fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' }
});