import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../theme/ThemeContext';

export default function ScanSelectScreen({ navigation }) {
  const { t } = useTranslation();
  const { dark } = useAppTheme();

  const scanOptions = [
    {
      id: 'link',
      route: 'LinkScan',
      icon: 'link',
      colors: dark ? ['#1a4d8f', '#2563eb'] : ['#3b82f6', '#60a5fa'],
      iconColor: dark ? '#9ecaff' : '#ffffff',
      title: t('scan.link'),
      description: t('scan.link.description'),
      emoji: '🔗'
    },
    {
      id: 'code',
      route: 'CodeScan',
      icon: 'qr-code',
      colors: dark ? ['#1a4d2e', '#22c55e'] : ['#10b981', '#34d399'],
      iconColor: dark ? '#b9f3b6' : '#ffffff',
      title: t('scan.code'),
      description: t('scan.code.description'),
      emoji: '📱'
    },
    {
      id: 'image',
      route: 'ImageScan',
      icon: 'images',
      colors: dark ? ['#4d1a8f', '#8b5cf6'] : ['#8b5cf6', '#a78bfa'],
      iconColor: dark ? '#c6e0ff' : '#ffffff',
      title: t('scan.image'),
      description: t('scan.image.description'),
      emoji: '🖼️'
    },
    {
      id: 'create',
      route: 'CreateQR',
      icon: 'add-circle',
      colors: dark ? ['#3a1c32', '#d946ef'] : ['#ec4899', '#f472b6'],
      iconColor: dark ? '#ffd6e7' : '#ffffff',
      title: t('scan.create'),
      description: t('scan.create.description'),
      emoji: '✳️'
    },
    {
      id: 'settings',
      route: 'Settings',
      icon: 'settings-outline',
      colors: dark ? ['#4d2e1a', '#f59e0b'] : ['#f59e0b', '#fbbf24'],
      iconColor: dark ? '#c1b6ff' : '#ffffff',
      title: t('settings.title'),
      description: t('settings.description'),
      emoji: '⚙️'
    }
  ];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerEmoji}>🛡️</Text>
          <Text style={[styles.title, { color: dark ? '#e6edf3' : '#0b1220' }]}>
            {t('scan.select.title')}
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: dark ? '#8b98a5' : '#5c6b7c' }]}>
          {t('scan.select.subtitle')}
        </Text>
      </View>

      {/* Scan Options Grid */}
      <View style={styles.grid}>
        {scanOptions.map((option, index) => (
          <ScanCard
            key={option.id}
            option={option}
            dark={dark}
            onPress={() => navigation.navigate(
              option.route,
              option.id === 'image' ? { autoPick: true } : undefined
            )}
            index={index}
          />
        ))}
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <StatCard 
          icon="shield-checkmark" 
          value="99.8%" 
          label={t('stats.accuracy')}
          color={dark ? '#7ee787' : '#2da44e'}
          dark={dark}
        />
        <StatCard 
          icon="flash" 
          value="<1s" 
          label={t('stats.speed')}
          color={dark ? '#58a6ff' : '#0366d6'}
          dark={dark}
        />
        <StatCard 
          icon="lock-closed" 
          value="100%" 
          label={t('stats.secure')}
          color={dark ? '#d29922' : '#bf8700'}
          dark={dark}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: dark ? '#6e7681' : '#8c959f' }]}>
          {t('scan.footer.text')}
        </Text>
      </View>
    </ScrollView>
  );
}

function ScanCard({ option, dark, onPress, index }) {
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
    <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <LinearGradient
          colors={option.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.cardContent}>
            <View style={styles.emojiContainer}>
              <Text style={styles.emoji}>{option.emoji}</Text>
            </View>
            
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name={option.icon} size={32} color={option.iconColor} />
            </View>
            
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardDescription}>{option.description}</Text>
            </View>

            <View style={styles.arrowContainer}>
              <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.8)" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

function StatCard({ icon, value, label, color, dark }) {
  return (
    <View style={[styles.statCard, { 
      backgroundColor: dark ? '#161b22' : '#ffffff',
      borderColor: dark ? '#30363d' : '#e1e4e8'
    }]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.statValue, { color: dark ? '#e6edf3' : '#0b1220' }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: dark ? '#8b949e' : '#57606a' }]}>
        {label}
      </Text>
    </View>
  );
}

function RiskBadge({ level }) {
  let color = '#2f9e44', text = 'result.secure', icon = 'shield-checkmark';
  if (level === 'suspicious') { 
    color = '#ffb703'; 
    text = 'result.suspicious'; 
    icon = 'warning'; 
  }
  if (level === 'unsafe') { 
    color = '#d00000'; 
    text = 'result.unsafe'; 
    icon = 'shield'; 
  }
  const { t } = useTranslation();
  
  return (
    <View style={[styles.badge, { backgroundColor: color }]}> 
      <Ionicons name={icon} size={16} color="#fff" />
      <Text style={styles.badgeText}>{t(text)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40
  },
  header: {
    marginBottom: 24,
    alignItems: 'center'
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8
  },
  headerEmoji: {
    fontSize: 32
  },
  title: { 
    fontSize: 28, 
    fontWeight: '700'
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22
  },
  infoCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20
  },
  grid: { 
    gap: 16,
    marginBottom: 24
  },
  cardWrapper: {
    width: '100%'
  },
  card: { 
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6
  },
  cardContent: {
    padding: 20,
    minHeight: 140
  },
  emojiContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    opacity: 0.3
  },
  emoji: {
    fontSize: 48
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  cardTextContainer: {
    gap: 4
  },
  cardTitle: { 
    fontSize: 20, 
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4
  },
  cardDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20
  },
  arrowContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700'
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center'
  },
  footer: {
    alignItems: 'center',
    paddingTop: 8
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18
  },
  badge: { 
    paddingVertical: 6, 
    paddingHorizontal: 10, 
    borderRadius: 999, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    alignSelf: 'flex-start' 
  },
  badgeText: { 
    color: '#fff', 
    fontWeight: '700' 
  }
});