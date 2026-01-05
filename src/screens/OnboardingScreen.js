import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Platform, StatusBar, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useAppTheme } from '../theme/ThemeContext';

import { appEvents } from '../utils/events';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ONBOARDING_KEY = 'hasSeenOnboarding';

export const checkOnboarding = async () => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
  } catch (e) {
    return false;
  }
};

export const setOnboardingSeen = async () => {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  } catch (e) {
    console.error('Error saving onboarding status', e);
  }
};

const Slide = ({ id, title, desc, icon, color, dark, t, screenWidth, screenHeight, isSmallScreen }) => {
  const iconSize = isSmallScreen ? 120 : 180;
  const iconFontSize = isSmallScreen ? 56 : 80;
  const titleSize = isSmallScreen ? 22 : 28;
  const descSize = isSmallScreen ? 15 : 17;
  const marginBottom = isSmallScreen ? 24 : 50;
  
  return (
    <ScrollView 
      style={{ width: screenWidth }} 
      contentContainerStyle={styles.slideContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[
        styles.iconContainer, 
        { 
          backgroundColor: dark ? '#1f2937' : '#f3f4f6',
          shadowColor: color,
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize / 2,
          marginBottom: marginBottom
        }
      ]}>
        <Ionicons name={icon} size={iconFontSize} color={color} />
      </View>
      <Text style={[styles.title, { color: dark ? '#f9fafb' : '#111827', fontSize: titleSize }]}>{title}</Text>
      <Text style={[styles.desc, { color: dark ? '#9ca3af' : '#4b5563', fontSize: descSize }]}>{desc}</Text>
      {id === 2 && (
        <View style={styles.linkWrap}>
          <View style={styles.linkRow}>
            <TouchableOpacity
              onPress={() => { Linking.openURL('https://www.usom.gov.tr/adres').catch(() => {}); }}
              style={[styles.linkBtn, { backgroundColor: dark ? '#172031' : '#eef3f9', borderColor: dark ? '#243044' : '#dbe2ea' }]}
              activeOpacity={0.85}
            >
              <Ionicons name="shield-checkmark-outline" size={18} color={dark ? '#9ecaff' : '#0066cc'} />
              <Text style={[styles.linkLabel, { color: dark ? '#9ecaff' : '#0066cc' }]}>USOM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { Linking.openURL('https://github.com/romainmarcoux/malicious-domains').catch(() => {}); }}
              style={[styles.linkBtn, { backgroundColor: dark ? '#1f1630' : '#f4f1fb', borderColor: dark ? '#3b2c52' : '#e3def8' }]}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-github" size={18} color={dark ? '#c1b6ff' : '#6c5ce7'} />
              <Text style={[styles.linkLabel, { color: dark ? '#c1b6ff' : '#6c5ce7' }]}>GitHub</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.examplesText, { color: dark ? '#8b98a5' : '#57606a' }]}>
            {t('onboarding.slide2.examples')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = height < 700;
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef(null);

  const slides = [
    {
      id: 1,
      title: t('onboarding.slide1.title'),
      desc: t('onboarding.slide1.desc'),
      icon: 'scan-outline',
      color: '#3b82f6' // Blue
    },
    {
      id: 2,
      title: t('onboarding.slide2.title'),
      desc: t('onboarding.slide2.desc'),
      icon: 'shield-checkmark-outline',
      color: '#10b981' // Green
    },
    {
      id: 3,
      title: t('onboarding.slide3.title'),
      desc: t('onboarding.slide3.desc'),
      icon: 'hardware-chip-outline',
      color: '#06b6d4' // Cyan
    },
    {
      id: 4,
      title: t('onboarding.slide4.title'),
      desc: t('onboarding.slide4.desc'),
      icon: 'camera-outline',
      color: '#f59e0b' // Amber/Orange
    },
    {
      id: 5,
      title: t('onboarding.slide5.title'),
      desc: t('onboarding.slide5.desc'),
      icon: 'qr-code-outline',
      color: '#8b5cf6' // Purple
    },
    {
      id: 6,
      title: t('onboarding.slide6.title'),
      desc: t('onboarding.slide6.desc'),
      icon: 'lock-closed-outline',
      color: '#ef4444' // Red
    }
  ];

  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    if (index >= 0 && index < slides.length) {
      setCurrentIndex(index);
    }
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (currentIndex + 1), animated: true });
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    await setOnboardingSeen();
    appEvents.emit('onboardingFinished');
    
    const state = navigation.getState();
    const canGoBack = navigation.canGoBack();
    
    if (canGoBack) {
      navigation.goBack();
    } else {
      navigation.replace('Home');
    }
  };

  const handleSkip = () => {
    finishOnboarding();
  };

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#ffffff', paddingTop: insets.top }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={[styles.skipText, { color: dark ? '#9ca3af' : '#6b7280' }]}>
            {currentIndex === slides.length - 1 ? '' : t('onboarding.skip')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        nestedScrollEnabled
      >
        {slides.map((slide) => (
          <Slide key={slide.id} {...slide} dark={dark} t={t} screenWidth={width} screenHeight={height} isSmallScreen={isSmallScreen} />
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.indicatorContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                {
                  backgroundColor: currentIndex === index 
                    ? (dark ? '#3b82f6' : '#2563eb') 
                    : (dark ? '#374151' : '#e5e7eb'),
                  width: currentIndex === index ? 24 : 8
                }
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={handleNext}
          style={[
            styles.button,
            { backgroundColor: dark ? '#3b82f6' : '#2563eb' }
          ]}
        >
          <Text style={styles.buttonText}>
            {currentIndex === slides.length - 1 ? t('onboarding.finish') : t('onboarding.next')}
          </Text>
          {currentIndex !== slides.length - 1 && (
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
  },
  skipButton: {
    padding: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  slideContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 15,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  title: {
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  desc: {
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  linkWrap: {
    marginTop: 16,
    alignItems: 'center',
    gap: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  linkLabel: {
    fontWeight: '700',
  },
  examplesText: {
    fontSize: 13,
    textAlign: 'center',
  },
  footer: {
    minHeight: 140,
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: 24,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 25,
  },
  indicator: {
    height: 8,
    borderRadius: 4,
  },
  button: {
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '600',
  },
});
