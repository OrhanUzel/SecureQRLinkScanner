import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Reusable grid/stack of action buttons.
 * buttons: Array<{ key, label, icon, onPress, color, fullWidth?, style?, textStyle?, disabled?, iconColor? }>
 * columns: number of columns when width not overridden (default 2).
 */
export default function ActionButtonsGrid({ buttons = [], columns = 2, compact = false, style, textStyle }) {
  const filtered = buttons.filter(Boolean);
  if (!filtered.length) return null;

  // Special layout: when exactly 3 buttons and one is "google", place Google full-width on top, the rest as a row.
  let arranged = filtered;
  if (filtered.length === 3 && filtered.some(b => b.key === 'google')) {
    arranged = filtered.map(b => (b.key === 'google' ? { ...b, fullWidth: true } : { ...b, fullWidth: false }));
    // Put google first
    arranged.sort((a, b) => (a.key === 'google' ? -1 : b.key === 'google' ? 1 : 0));
  }

  const baseWidth = columns <= 1 ? '100%' : columns === 3 ? '31%' : '48%';

  return (
    <View style={[styles.grid, style]}>
      {arranged.map(btn => {
        const width = btn.fullWidth ? '100%' : baseWidth;
        return (
          <TouchableOpacity
            key={btn.key || btn.label}
            style={[
              styles.tile,
              { backgroundColor: btn.color || '#0969da', width },
              compact ? { paddingVertical: 12 } : null,
              btn.style
            ]}
            onPress={btn.onPress}
            activeOpacity={0.85}
            disabled={btn.disabled}
          >
            {btn.icon ? <Ionicons name={btn.icon} size={20} color={btn.iconColor || '#fff'} /> : null}
            <Text style={[styles.tileLabel, textStyle, btn.textStyle]} numberOfLines={2}>
              {btn.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  tile: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tileLabel: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
    lineHeight: 18,
  },
});
