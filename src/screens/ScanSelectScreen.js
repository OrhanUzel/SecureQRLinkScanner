import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, FlatList, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../theme/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ScanSelectScreen({ navigation }) {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 360 || height < 640;
  const insets = useSafeAreaInsets();
  const [premium, setPremium] = useState(false);

  const loadPremiumFlag = useCallback(async () => {
    try {
      const flag = await AsyncStorage.getItem('premium');
      setPremium(flag === 'true');
    } catch {}
  }, []);

  useEffect(() => {
    loadPremiumFlag();
    const unsubscribe = navigation.addListener?.('focus', loadPremiumFlag);
    return () => { unsubscribe?.(); };
  }, [navigation, loadPremiumFlag]);

  const scanOptions = useMemo(() => [
    {
      id: 'link',
      route: 'LinkScan',
      colors: dark ? ['#1a4d8f', '#2563eb'] : ['#3b82f6', '#60a5fa'],
      title: t('scan.link'),
      emoji: '🔗'
    },
    {
      id: 'code',
      route: 'CodeScan',
      colors: dark ? ['#149e4bff', '#1fcd5eff'] : ['#10b981', '#34d399'],
      title: t('scan.code'),
      emoji: '⛶'
    },
    {
      id: 'image',
      route: 'ImageScan',
      colors: dark ? ['#4d1a8f', '#8b5cf6'] : ['#8b5cf6', '#a78bfa'],
      title: t('scan.image'),
      emoji: '🖼️'
    },
    {
      id: 'create',
      route: 'CreateQR',
      colors: dark ? ['#3a1c32', '#d946ef'] : ['#ec4899', '#f472b6'],
      title: t('scan.create'),
      emoji: '🖨️'
    },
    {
      id: 'history',
      route: 'History',
      colors: dark ? ['#149e4bff', '#1fcd5eff'] : ['#38bdf8', '#60a5fa'],
      title: t('history.title'),
      emoji: '🕘'
    },
    {
      id: 'settings',
      route: 'Settings',
      colors: dark ? ['#1a4d8f', '#2563eb'] : ['#592ae9ff', '#7d62ebff'],
      title: t('settings.title'),
      emoji: '⚙️'
    }
  ], [t, dark]);



  const handlePress = useCallback((item) => {
    if (item.id === 'history') {
      navigation.navigate('History');
      return;
    }
    navigation.navigate(
      item.route,
      item.id === 'image' ? { autoPick: true } : undefined
    );
  }, [navigation]);

  const renderItem = useCallback(({ item, index }) => (
    <ScanCard
      option={item}
      dark={dark}
      compact={compact}
      onPress={() => handlePress(item)}
      index={index}
    />
  ), [dark, compact, handlePress]);

  const keyExtractor = useCallback((item) => item.id, []);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        require('./CreateQrScreen');
      } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <View 
      style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#e9edf3' }]}
    >


      
      {/* Header removed per request */}

      {/* Scan Options Grid */}
      <View
        style={[
          styles.grid,
          compact ? { paddingHorizontal: 8 } : null,
          { paddingBottom: premium ? Math.max(insets.bottom, 20) : 0 }
        ]}
      >
        <FlatList
          key={compact ? 'c1' : 'c2'}
          data={scanOptions}
          keyExtractor={keyExtractor}
          numColumns={compact ? 1 : 2}
          scrollEnabled={true}
          style={styles.gridList}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={renderItem}
        />
      </View>

      {/* Quick Stats removed per request */}


    </View>
  );
}

const ScanCard = React.memo(({ option, dark, onPress, index, compact }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[styles.cardWrapper, compact ? { width: '100%' } : { width: '48%' }, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.touch}
        focusable={false}
      >
        <View style={[styles.cardShadow]}>
          <LinearGradient
            colors={option.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.cardContent}>
              
              <View style={styles.iconContainer}>
                <Text style={[styles.iconEmoji, compact ? { fontSize: 44 } : null]}>{option.emoji}</Text>
              </View>
              
              <View style={styles.cardTextContainer}>
                <Text style={[styles.cardTitle, compact ? { fontSize: 17 } : null]} numberOfLines={2}>{option.title}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});



const styles = StyleSheet.create({
  container: { 
    flex: 1,
    padding: 0,
    paddingBottom: 0
  },
  grid: { 
    padding: 20,
    flex: 1,
    marginBottom: 0,
    justifyContent: 'center',
    alignItems: 'center'
  },
  gridList: {
    flex: 1
  },
  gridContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 16
  },
  cardWrapper: {},
  touch: {
    borderRadius: 20,
  },
  cardShadow: {
    borderRadius: 20,
    height: 190
  },
  card: { 
    borderRadius: 20,
    overflow: 'hidden',
    height: '100%'
  },
  cardContent: {
    padding: 18,
    paddingBottom: 18
  },
  
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'center'
  },
  iconEmoji: {
    fontSize: 52
  },
  cardTextContainer: {
    gap: 4,
    alignItems: 'center'
  },
  cardTitle: { 
    fontSize: 19, 
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
    textAlign: 'center'
  }
});
