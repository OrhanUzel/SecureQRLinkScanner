import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';

const { width } = Dimensions.get('window');

export default function StatusModal({ visible, title, message, type = 'success', onClose }) {
  const { t } = useTranslation();
  const { dark } = useAppTheme();

  const getConfig = () => {
    switch (type) {
      case 'error':
        return {
          icon: 'alert-circle',
          colorLight: '#dc2626',
          colorDark: '#ef4444',
          bgLight: '#fef2f2',
          bgDark: 'rgba(239, 68, 68, 0.1)',
          btnLight: '#dc2626',
          btnDark: '#dc2626'
        };
      case 'info':
        return {
          icon: 'information-circle',
          colorLight: '#2563eb',
          colorDark: '#3b82f6',
          bgLight: '#eff6ff',
          bgDark: 'rgba(59, 130, 246, 0.1)',
          btnLight: '#2563eb',
          btnDark: '#2563eb'
        };
      case 'success':
      default:
        return {
          icon: 'checkmark-circle',
          colorLight: '#16a34a',
          colorDark: '#22c55e',
          bgLight: '#f0fdf4',
          bgDark: 'rgba(34, 197, 94, 0.1)',
          btnLight: '#16a34a',
          btnDark: '#16a34a'
        };
    }
  };

  const config = getConfig();
  const iconColor = dark ? config.colorDark : config.colorLight;
  const btnColor = dark ? config.btnDark : config.btnLight;

  return (
    <Modal 
      visible={visible} 
      animationType="fade" 
      transparent 
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[
          styles.modalCard, 
          { 
            backgroundColor: dark ? '#0f172a' : '#ffffff',
            borderColor: dark ? '#1e293b' : '#e2e8f0',
            shadowColor: dark ? '#000' : '#64748b',
          }
        ]}>
          
          {/* Header Icon */}
          <View style={[
            styles.iconWrapper, 
            { backgroundColor: dark ? config.bgDark : config.bgLight }
          ]}>
            <Ionicons name={config.icon} size={42} color={iconColor} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={[styles.title, { color: dark ? '#f1f5f9' : '#0f172a' }]}>
              {title}
            </Text>
            
            <Text style={[styles.message, { color: dark ? '#94a3b8' : '#475569' }]}>
              {message}
            </Text>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: btnColor }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {type === 'success' ? t('common.continue') : (t('actions.ok') || 'Tamam')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  content: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
