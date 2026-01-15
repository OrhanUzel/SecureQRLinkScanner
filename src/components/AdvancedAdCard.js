import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import AdBanner from './AdBanner';
import { nativeUnitId } from '../config/adUnitIds';

function AdvancedAdCard({ placement, variant = 'mrec' }) {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const [premium, setPremium] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem('premium');
        setPremium(v === 'true');
      } catch {}
    })();
  }, []);

  if (premium) return null;

  const isBanner = variant === 'banner';

  return (
    <View style={[
      styles.card, 
      { 
        padding: isBanner ? 8 : 10, 
        alignItems: 'center', 
        backgroundColor: dark ? '#10151c' : '#fff', 
        borderColor: dark ? '#363738ff' : '#dde3ea',
        // Banner ise margin'i farklı yönetebiliriz veya çağıran yer yönetir
      }
    ]}>
      <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', marginBottom: 0 }}>
        <View style={{ 
          backgroundColor: dark ? '#2d333b' : '#f0f4f8', 
          paddingHorizontal: 4, 
          paddingVertical: 2, 
          borderRadius: 6 
        }}>
          <Text style={{ 
            fontSize: 9, 
            fontWeight: '700', 
            color: dark ? '#8b98a5' : '#57606a', 
            textTransform: 'uppercase' 
          }}>
            {t('ads.modal.title', 'Ad')}
          </Text>
        </View>
      </View>
      <AdBanner placement={placement} variant={variant} />
    </View>
  );
}

export default React.memo(AdvancedAdCard);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  }
});
