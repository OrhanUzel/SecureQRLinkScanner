import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

/**
 * Floating offline warning banner that respects safe areas.
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {boolean} props.dark
 * @param {string} props.message
 * @param {(height: number) => void} [props.onHeightChange]
 */
export default function OfflineNotice({ visible, dark, message, onHeightChange, onRetry }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const handleLayout = useCallback(
    (e) => {
      onHeightChange?.(e.nativeEvent.layout.height);
    },
    [onHeightChange]
  );

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { top: Platform.OS === 'ios' ? insets.top + 1 : 14 }]}
      onLayout={handleLayout}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: dark ? '#43161c' : '#ffe5e2',
            borderColor: dark ? '#7f1d1d' : '#ffc1b9',
          },
        ]}
      >
        <Ionicons name="wifi" size={18} color={dark ? '#ffb4b9' : '#cf222e'} />
        <Text style={[styles.text, { color: dark ? '#ffb4b9' : '#cf222e' }]}>{message}</Text>
        {onRetry && (
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: dark ? '#2f9e44' : '#22c55e' }]}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={16} color="#ffffff" />
            <Text style={styles.retryText}>{t('actions.retry') || 'Retry'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    alignItems: 'center',
    paddingHorizontal: 20,
  
  },
  bar: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
