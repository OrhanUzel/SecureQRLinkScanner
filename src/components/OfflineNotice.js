import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Floating offline warning banner that respects safe areas.
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {boolean} props.dark
 * @param {string} props.message
 * @param {(height: number) => void} [props.onHeightChange]
 */
export default function OfflineNotice({ visible, dark, message, onHeightChange }) {
  const insets = useSafeAreaInsets();
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
      style={[styles.wrapper]}
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
});
