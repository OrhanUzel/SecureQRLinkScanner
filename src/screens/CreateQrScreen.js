import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import ViewShot, { captureRef } from 'react-native-view-shot';
import Toast from '../components/Toast';

export default function CreateQrScreen() {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const [input, setInput] = useState('');
  const [matrix, setMatrix] = useState(null);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const isWeb = Platform.OS === 'web';
  const qrRef = useRef(null);
  const [inputHeight, setInputHeight] = useState(44);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const generateMatrix = useCallback(async (text) => {
    try {
      if (!text || !text.trim()) {
        setMatrix(null);
        setError(null);
        return;
      }

      setIsGenerating(true);
      setError(null);

      const { QRCodeWriter, BarcodeFormat, EncodeHintType } = await import('@zxing/library');
      const writer = new QRCodeWriter();
      const hints = new Map();
      hints.set(EncodeHintType.MARGIN, 2);
      // Render-friendly size: avoid creating too many views which can crash RN
      const targetSize = 48; // modules (daha kompakt)
      const bitMatrix = writer.encode(text, BarcodeFormat.QR_CODE, targetSize, targetSize, hints);
      const width = bitMatrix.getWidth();
      const height = bitMatrix.getHeight();
      const rows = [];
      
      for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
          row.push(bitMatrix.get(x, y));
        }
        rows.push(row);
      }
      
      setMatrix({ rows, size: width });
      setError(null);
    } catch (e) {
      console.error('QR generation error:', e);
      setMatrix(null);
      setError(t('qr_generation_error') || 'QR kod oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsGenerating(false);
    }
  }, [t]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      generateMatrix(input);
    }, 300); // Debounce for better performance

    return () => clearTimeout(timeoutId);
  }, [input, generateMatrix]);

  const clearInput = () => {
    setInput('');
    setMatrix(null);
    setError(null);
  };

  // Keep per-module pixel size reasonable to avoid excessive child views
  const cellSize = 6;
  const qrSize = matrix ? matrix.size * cellSize : 0;

  const buildCanvasDataUrl = () => {
    if (!matrix || !isWeb) return null;
    const size = matrix.size * cellSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    for (let y = 0; y < matrix.size; y++) {
      for (let x = 0; x < matrix.size; x++) {
        if (matrix.rows[y][x]) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
    return canvas.toDataURL('image/png');
  };

  const onDownload = async () => {
    try {
      if (!matrix) return;
      if (isWeb) {
        const url = buildCanvasDataUrl();
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = 'qr.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t('permission_required_media') || 'Medya izni gerekli');
          return;
        }
        const uri = await captureRef(qrRef, { format: 'png', quality: 1, result: 'tmpfile' });
        if (!uri) throw new Error('capture_failed');
        await MediaLibrary.saveToLibraryAsync(uri);
        setToast({ visible: true, message: t('saved_to_gallery') || 'Galeriye kaydedildi', type: 'success' });
      }
    } catch (e) {
      Alert.alert(t('qr_generation_error') || 'QR kod oluşturulamadı. Lütfen tekrar deneyin.');
    }
  };

  const onShare = async () => {
    try {
      if (isWeb) {
        const canvasUrl = buildCanvasDataUrl();
        if (!canvasUrl) return;
        const res = await fetch(canvasUrl);
        const blob = await res.blob();
        const file = new File([blob], 'qr.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'QR Code', text: input || '' });
        } else {
          const win = window.open(canvasUrl, '_blank');
          if (!win) Alert.alert(t('share_unavailable') || 'Paylaşım desteklenmiyor');
        }
      } else {
        const uri = await captureRef(qrRef, { format: 'png', quality: 1, result: 'tmpfile' });
        if (!uri) throw new Error('capture_failed');
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('share') || 'Paylaş' });
        } else {
          const { Share } = await import('react-native');
          await Share.share({ message: input || '', url: uri });
        }
      }
    } catch (e) {
      setToast({ visible: true, message: t('share_unavailable') || 'Paylaşım şu anda kullanılamıyor', type: 'error' });
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#f2f6fb' }]}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons 
          name="qr-code" 
          size={32} 
          color={dark ? '#4a9eff' : '#0066cc'} 
        />
        <Text style={[styles.title, { color: dark ? '#e6edf3' : '#0b1220' }]}>
          {t('qr_generator_title') || 'QR Kod Oluşturucu'}
        </Text>
      </View>

      {/* Input Section */}
      <View style={styles.inputSection}>
        <Text style={[styles.label, { color: dark ? '#b1bac4' : '#4a5568' }]}>
          {t('input_label') || 'İçerik veya URL'}
        </Text>
        
        <View style={styles.inputWrapper}>
          <TextInput
            style={[
              styles.input, 
              { 
                backgroundColor: dark ? '#10151c' : '#fff', 
                color: dark ? '#e6edf3' : '#0b1220', 
                borderColor: error 
                  ? (dark ? '#ff6b6b' : '#dc2626')
                  : (dark ? '#1b2330' : '#dde3ea')
              , height: inputHeight
              }
            ]}
            placeholder={t('input_placeholder') || 'Metin, URL veya veri girin...'}
            placeholderTextColor={dark ? '#8b98a5' : '#7a8699'}
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={1}
            textAlignVertical="top"
            scrollEnabled={false}
            onContentSizeChange={(e) => {
              const h = Math.max(44, Math.min(e.nativeEvent.contentSize.height, 160));
              setInputHeight(h);
            }}
          />
          
          {input.length > 0 && (
            <TouchableOpacity 
              style={[
                styles.clearButton,
                { 
                  backgroundColor: dark ? '#172031' : '#f0f4f8',
                  borderColor: dark ? '#243044' : '#dbe2ea'
                }
              ]}
              onPress={clearInput}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons 
                name="close" 
                size={18} 
                color={dark ? '#8b98a5' : '#7a8699'} 
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Character Count */}
        <Text style={[styles.charCount, { color: dark ? '#8b98a5' : '#7a8699' }]}>
          {input.length} {t('characters') || 'karakter'}
        </Text>
      </View>

      {/* Error Message */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: dark ? '#2d1515' : '#fee' }]}>
          <Ionicons name="alert-circle" size={20} color={dark ? '#ff6b6b' : '#dc2626'} />
          <Text style={[styles.errorText, { color: dark ? '#ff6b6b' : '#dc2626' }]}>
            {error}
          </Text>
        </View>
      )}

      {/* Loading Indicator */}
      {isGenerating && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={dark ? '#4a9eff' : '#0066cc'} />
          <Text style={[styles.loadingText, { color: dark ? '#b1bac4' : '#4a5568' }]}>
            {t('generating') || 'Oluşturuluyor...'}
          </Text>
        </View>
      )}

      {/* QR Code Display */}
      {matrix && !isGenerating && (
        <View style={styles.qrSection}>
          <ViewShot ref={qrRef} options={{ format: 'png', quality: 1 }}>
            <View style={[ styles.qrContainer, { backgroundColor: dark ? '#1b2330' : '#fff' } ]}>
              <View style={[styles.qrWrap, { width: qrSize, height: qrSize }]}>
                {matrix.rows.map((row, y) => (
                  <View key={y} style={{ flexDirection: 'row' }}>
                    {row.map((on, x) => (
                      <View 
                        key={x} 
                        style={{ 
                          width: cellSize, 
                          height: cellSize, 
                          backgroundColor: on ? '#000' : '#fff' 
                        }} 
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </ViewShot>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: dark ? '#1b2330' : '#fff' }]}
              onPress={onDownload}
            >
              <Ionicons name="download-outline" size={20} color={dark ? '#4a9eff' : '#0066cc'} />
              <Text style={[styles.actionButtonText, { color: dark ? '#4a9eff' : '#0066cc' }]}>
                {t('download') || 'İndir'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: dark ? '#1b2330' : '#fff' }]}
              onPress={onShare}
            >
              <Ionicons name="share-outline" size={20} color={dark ? '#4a9eff' : '#0066cc'} />
              <Text style={[styles.actionButtonText, { color: dark ? '#4a9eff' : '#0066cc' }]}>
                {t('share') || 'Paylaş'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Placeholder */}
      {!matrix && !isGenerating && !error && (
        <View style={[styles.placeholder, { borderColor: dark ? '#1b2330' : '#dde3ea' }]}>
          <View style={[styles.placeholderIcon, { backgroundColor: dark ? '#1b2330' : '#f0f4f8' }]}>
            <Ionicons name="qr-code-outline" size={64} color={dark ? '#4a5568' : '#94a3b8'} />
          </View>
          <Text style={[styles.placeholderTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
            {t('placeholder_title') || 'QR Kod Oluşturun'}
          </Text>
          <Text style={[styles.placeholderText, { color: dark ? '#8b98a5' : '#7a8699' }]}>
            {t('placeholder_text') || 'Yukarıdaki alana metin veya URL girin, QR kodunuz otomatik olarak oluşturulacak'}
          </Text>
        </View>
      )}

      {/* Info Section */}
      <View style={[styles.infoSection, { backgroundColor: dark ? '#10151c' : '#fff' }]}>
        <Text style={[styles.infoTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>
          <Ionicons name="information-circle" size={16} /> {t('info_title') || 'Bilgi'}
        </Text>
        <Text style={[styles.infoText, { color: dark ? '#8b98a5' : '#7a8699' }]}>
          {t('info_text') || 'QR kodları URL, metin, telefon numarası, e-posta adresi ve daha fazlasını içerebilir. Maksimum 2.953 karakter desteklenir.'}
        </Text>
      </View>
      <Toast 
        visible={toast.visible} 
        message={toast.message}
        type={toast.type}
        dark={dark}
        onHide={() => setToast(prev => ({ ...prev, visible: false }))}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 44,
    fontSize: 16,
    minHeight: 44,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charCount: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  qrSection: {
    alignItems: 'center',
    gap: 20,
    marginVertical: 20,
  },
  qrContainer: {
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrWrap: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#4a9eff',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 40,
    gap: 16,
    marginVertical: 20,
  },
  placeholderIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoSection: {
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
});