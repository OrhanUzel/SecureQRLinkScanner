import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

export default function ConfirmOpenLinkModal({ visible, url, onConfirm, onCancel }) {
  const { t } = useTranslation();
  const { dark } = useAppTheme();

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <BlurView
          intensity={60}
          tint={dark ? 'dark' : 'light'}
          style={[
            styles.modal,
            { backgroundColor: dark ? 'rgba(22,27,34,0.85)' : 'rgba(255,255,255,0.9)', borderColor: dark ? '#30363d' : '#e1e4e8' }
          ]}
        >
          <View style={styles.headerRow}>
            <Ionicons name="link" size={22} color={dark ? '#9ecaff' : '#0969da'} />
            <Text style={[styles.title, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('confirm.openTitle')}</Text>
          </View>
          <Text style={[styles.message, { color: dark ? '#8b98a5' : '#3b4654' }]}>{t('confirm.openMessage')}</Text>
          {!!url && (
            <View style={[styles.urlBox, { backgroundColor: dark ? '#0b0f14' : '#e9edf3', borderColor: dark ? '#1b2330' : '#dde3ea' }]}>
              <Text style={[styles.urlText, { color: dark ? '#9ecaff' : '#0969da' }]} numberOfLines={2}>
                {url}
              </Text>
            </View>
          )}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: dark ? '#2da44e' : '#2f9e44' }]} onPress={onConfirm} activeOpacity={0.8}>
              <Text style={styles.btnText}>{t('confirm.yes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnOutline, { borderColor: dark ? '#8b98a5' : '#7a8699' }]} onPress={onCancel} activeOpacity={0.8}>
              <Text style={[styles.btnOutlineText, { color: dark ? '#c9d1d9' : '#24292f' }]}>{t('confirm.no')}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', borderRadius: 16, padding: 16, borderWidth: 1, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  message: { fontSize: 14, marginBottom: 12 },
  urlBox: { borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 12 },
  urlText: { fontSize: 14, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnOutline: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1 },
  btnOutlineText: { fontWeight: '700' }
});