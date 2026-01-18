import React, { useState, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { appEvents } from '../utils/events';
import StatusModal from '../components/StatusModal';

export default function PaywallScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [statusModal, setStatusModal] = useState({ 
    visible: false, 
    title: '', 
    message: '', 
    type: 'success' // 'success' | 'info' | 'error'
  });
  
  // Başarılı işlem sonrası Paywall'un otomatik kapanmasını engellemek için flag
  const isSuccessRef = useRef(false);

  // RevenueCat panelinde tanımladığınız "Entitlement" (Hak) kimliği.
  // Genellikle 'pro', 'premium', 'plus' gibi bir isimdir.
  const ENTITLEMENT_ID = 'pro'; 

  const handlePremiumActivation = async (customerInfo) => {
    try {
      // Check for ANY active entitlement to be safe
      const activeEntitlements = customerInfo?.entitlements?.active || {};
      const activeKeys = Object.keys(activeEntitlements);
      
      if (activeKeys.length === 0) {
        console.log('No active entitlements found');
        return;
      }

      // Use the first active entitlement for info
      const entitlement = activeEntitlements[activeKeys[0]];

      await AsyncStorage.setItem('premium', 'true');
      
      const info = {
        type: entitlement.productIdentifier.includes('lifetime') ? 'lifetime' : 'subscription',
        planName: 'Premium Access',
        purchaseDate: entitlement.latestPurchaseDate,
        expiryDate: entitlement.expirationDate
      };
      
      await AsyncStorage.setItem('premium_info', JSON.stringify(info));
      appEvents.emit('premiumChanged', true);
    } catch (error) {
      console.error('Premium activation error:', error);
    }
  };

  const handleModalClose = () => {
    setStatusModal(prev => ({ ...prev, visible: false }));
    // Sadece başarılı işlemden sonra geri dön
    if (statusModal.type === 'success') {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  };

  return (
    <View style={styles.container}>
      <RevenueCatUI.Paywall
        // 1. Kullanıcı Paywall tasarımındaki 'X' (Kapat) butonuna basarsa:
        onDismiss={() => {
          // Eğer başarılı bir işlem olduysa ve modal açıksa, kapatmaya izin verme (modal yönetecek)
          if (isSuccessRef.current) return;
          
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }}

        // 2. Satın alma işlemi başarılı olduğunda:
        onPurchaseCompleted={async (customerInfo) => {
          console.log('Satın alma başarılı:', customerInfo);
          isSuccessRef.current = true; // Başarılı işlem flag'ini set et
          
          await handlePremiumActivation(customerInfo);
          
          setStatusModal({
            visible: true,
            title: t('paywall.successTitle'),
            message: t('paywall.successMessage'),
            type: 'success'
          });
        }}

        // 3. Geri Yükleme (Restore) işlemi tamamlandığında:
        onRestoreCompleted={async (customerInfo) => {
          const hasActive = Object.keys(customerInfo?.entitlements?.active || {}).length > 0;
          if (hasActive) {
            isSuccessRef.current = true; // Başarılı işlem flag'ini set et
            await handlePremiumActivation(customerInfo);
            setStatusModal({
              visible: true,
              title: t('paywall.restoreSuccessTitle'),
              message: t('paywall.restoreSuccessMessage'),
              type: 'success'
            });
          } else {
            // Başarısız restore durumunda modalı göster ama çıkışı engelleme (kullanıcı satın almak isteyebilir)
            setStatusModal({
              visible: true,
              title: t('paywall.restoreEmptyTitle'),
              message: t('paywall.restoreEmptyMessage'),
              type: 'info'
            });
          }
        }}
      />
      
      <StatusModal
        visible={statusModal.visible}
        title={statusModal.title}
        message={statusModal.message}
        type={statusModal.type}
        onClose={handleModalClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Paywall'un çentikli ekranlarda (iPhone 14/15 vb.) düzgün görünmesi için:
    backgroundColor: 'white' 
  },
});
