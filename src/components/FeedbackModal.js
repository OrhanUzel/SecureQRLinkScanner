import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import InAppReview from 'react-native-in-app-review';
import * as MailComposer from 'expo-mail-composer';

const { width } = Dimensions.get('window');

export default function FeedbackModal({ visible, onClose, onFeedbackGiven }) {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const [step, setStep] = useState('initial'); // 'initial', 'negative'

  // Reset step when visible changes to true
  useEffect(() => {
    if (visible) {
      setStep('initial');
    }
  }, [visible]);

  const handlePositive = async () => {
    // 1. Mark feedback as given immediately
    if (onFeedbackGiven) onFeedbackGiven();
    
    // 2. Close the modal
    onClose();

    // 3. Attempt In-App Review
    try {
      const isAvailable = InAppReview.isAvailable();
      console.log('InAppReview.isAvailable() result:', isAvailable);

      if (isAvailable) {
        console.log('Requesting In-App Review...');
        const hasFlowFinishedSuccessfully = await InAppReview.RequestInAppReview();
        console.log('InAppReview flow finished:', hasFlowFinishedSuccessfully);
      } else {
        console.log('InAppReview not available, falling back to store link');
        
        // In Development, show an alert to inform the user
        if (__DEV__) {
          alert('In-App Review is NOT available. \n\nReason: This API usually requires the app to be downloaded from the Play Store (Production, Open/Closed Testing, or Internal App Sharing). It often fails in debug builds or side-loaded APKs.');
        }

        // Fallback to store page
        if (Platform.OS === 'android') {
          // Note: This link only works if the app is published on Play Store
          Linking.openURL('market://details?id=com.orhanuzel.secureqrlinkscanner&showAllReviews=true')
            .catch(err => console.error('Could not open store link:', err));
        } else {
          // iOS: Try to open App Store
          const appStoreSearchUrl = 'https://apps.apple.com/us/search?term=Secure%20QR%20%26%20Link%20Scanner';
          Linking.openURL(appStoreSearchUrl);
        }
      }
    } catch (e) {
      console.log('InAppReview error:', e);
      if (__DEV__) {
        alert(`InAppReview Error: ${e.message}`);
      }
      // Fallback on error
      if (Platform.OS === 'android') {
        Linking.openURL('market://details?id=com.orhanuzel.secureqrlinkscanner&showAllReviews=true');
      } else {
        const appStoreSearchUrl = 'https://apps.apple.com/us/search?term=Secure%20QR%20%26%20Link%20Scanner';
        Linking.openURL(appStoreSearchUrl);
      }
    }
  };

  const handleNegative = () => {
    setStep('negative');
  };

  const handleSendEmail = async () => {
    const isAvailable = await MailComposer.isAvailableAsync();
    if (isAvailable) {
      await MailComposer.composeAsync({
        recipients: ['orhanuzel@yahoo.com'],
        subject: 'Secure QR & Link Scanner Feedback',
        body: ''
      });
    } else {
      Linking.openURL('mailto:orhanuzel@yahoo.com?subject=Secure QR & Link Scanner Feedback');
    }
    if (onFeedbackGiven) onFeedbackGiven();
    onClose();
  };

  // Styles based on theme
  const bg = dark ? '#0f172a' : '#ffffff';
  const border = dark ? '#1e293b' : '#e2e8f0';
  const titleColor = dark ? '#f1f5f9' : '#0f172a';
  const textColor = dark ? '#94a3b8' : '#475569';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: bg, borderColor: border }]}>
          
          {step === 'initial' ? (
            <>
              <View style={[styles.iconWrapper, { backgroundColor: dark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4' }]}>
                <Ionicons name="heart" size={42} color={dark ? '#22c55e' : '#16a34a'} />
              </View>
              
              <Text style={[styles.title, { color: titleColor }]}>
                {t('feedback.title')}
              </Text>
              <Text style={[styles.message, { color: textColor }]}>
                {t('feedback.description')}
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: dark ? '#22c55e' : '#16a34a', marginBottom: 12 }]}
                  onPress={handlePositive}
                >
                  <Text style={styles.buttonText}>{t('feedback.positive')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: dark ? '#334155' : '#cbd5e1' }]}
                  onPress={handleNegative}
                >
                  <Text style={[styles.buttonText, { color: textColor }]}>{t('feedback.negative')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
               <View style={[styles.iconWrapper, { backgroundColor: dark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff' }]}>
                <Ionicons name="mail" size={42} color={dark ? '#3b82f6' : '#2563eb'} />
              </View>

              <Text style={[styles.title, { color: titleColor }]}>
                {t('feedback.contactTitle')}
              </Text>
              <Text style={[styles.message, { color: textColor }]}>
                {t('feedback.contactDescription')}
              </Text>

              <View style={styles.buttonContainer}>
                 <TouchableOpacity
                  style={[styles.button, { backgroundColor: dark ? '#3b82f6' : '#2563eb', marginBottom: 12 }]}
                  onPress={handleSendEmail}
                >
                  <Text style={styles.buttonText}>{t('feedback.sendEmail')}</Text>
                </TouchableOpacity>

                 <TouchableOpacity
                  style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: dark ? '#334155' : '#cbd5e1' }]}
                  onPress={onClose}
                >
                  <Text style={[styles.buttonText, { color: textColor }]}>{t('feedback.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: width - 40,
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22
  },
  buttonContainer: {
    width: '100%'
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});
