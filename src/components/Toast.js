import React, { useEffect, useRef } from 'react';
import { Platform,Animated, View, Text, StyleSheet } from 'react-native';

export default function Toast({ visible, message, type = 'success', onHide, dark, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        const t = setTimeout(() => {
          Animated.parallel([
            Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 20, duration: 160, useNativeDriver: true }),
          ]).start(() => onHide && onHide());
        }, 1800);
        return () => clearTimeout(t);
      });
    }
  }, [visible, opacity, translateY, onHide]);

  if (!visible) return null;

  const bg = type === 'success'
    ? (dark ? '#153018' : '#e8f7ee')
    : (dark ? '#311515' : '#fee');
  const border = type === 'success'
    ? (dark ? '#1f7a3e' : '#8fd3aa')
    : (dark ? '#b85c5c' : '#f5b5b5');
  const color = type === 'success'
    ? (dark ? '#9ae6b4' : '#0f5132')
    : (dark ? '#ff6b6b' : '#842029');

  return (
    <Animated.View 
      style={[styles.container, { opacity, transform: [{ translateY }] }, style]}
      pointerEvents={visible ? 'auto' : 'none'}
      needsOffscreenAlphaCompositing={Platform.OS === 'android'}
      renderToHardwareTextureAndroid={true}//gölgelenme sorunu için
    > 
      <View style={[styles.toast, { backgroundColor: bg, borderColor: border }]}> 
        <Text style={[styles.text, { color }]}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    minWidth: 200,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    alignSelf: 'center',
  },
});