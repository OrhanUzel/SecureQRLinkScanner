import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import ViewShot from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { Barcode } from 'react-native-svg-barcode';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../screens/CreateQrScreen.styles';
import IconRenderer from '../IconRenderer';

export default function QrPreviewSection({
  uiState,
  compact,
  qrRef,
  showVisualFrame,
  qrSettings,
  qrSize,
  showLogoControls,
  showFrameControls,
  logoOverlaySize,
  isIconLogo,
  iconLogoInfo,
  hasFrameText,
  frameLabelText,
  onDownload,
  onShare,
  t,
  dark,
}) {
  if (uiState.matrix && !uiState.generating) {
    if (__DEV__) {
      console.log('[QrPreviewSection] rendering code preview', {
        symbolType: qrSettings.symbolType,
        barcodeFormat: qrSettings.barcodeFormat,
        generatedContent: uiState.generatedContent,
        qrSize,
      });
    }
    return (
      <View style={[styles.qrSection, compact ? { gap: 12, marginVertical: 12 } : null]}>
        <ViewShot ref={qrRef} options={{ format: 'png', quality: 1 }}>
          <View
            style={[
              styles.qrContainer,
              showVisualFrame
                ? {
                    backgroundColor: '#ffffff',
                    borderWidth: 2,
                    borderColor: qrSettings.frameThemeColor,
                  }
                : {
                    backgroundColor: '#ffffff',
                  },
            ]}
          >
            <View style={[styles.qrPreview, showVisualFrame ? styles.qrPreviewFramed : null]}>
              <View style={[styles.qrWrap, { width: qrSize, height: qrSize }, showVisualFrame ? styles.qrWrapElevated : null]}>
                {qrSettings.symbolType === 'qr' ? (
                  <QRCode
                    value={uiState.generatedContent || ' '}
                    size={qrSize}
                    color={qrSettings.qrColor}
                    backgroundColor="white"
                    ecl="H"
                  />
                ) : (
                  <View
                    style={{
                      width: '100%',
                      height: '100%',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Barcode
                      value={uiState.generatedContent || ' '}
                      format={qrSettings.barcodeFormat || 'CODE128'}
                      lineColor={qrSettings.qrColor}
                      background="#ffffff"
                      height={Math.max(80, qrSize * 0.4 || 0)}
                      maxWidth={qrSize || 260}
                    />
                  </View>
                )}
                {qrSettings.symbolType === 'qr' && showLogoControls && qrSettings.customLogo && (
                  <View
                    style={[
                      styles.logoOverlay,
                      {
                        width: logoOverlaySize,
                        height: logoOverlaySize,
                        marginLeft: -logoOverlaySize / 2,
                        marginTop: -logoOverlaySize / 2,
                        borderRadius: logoOverlaySize * 0.23,
                      },
                      isIconLogo
                        ? {
                            backgroundColor: '#ffffff',
                            borderColor: qrSettings.qrColor || qrSettings.frameThemeColor || '#e2e8f0',
                            borderWidth: 2.5,
                          }
                        : null,
                    ]}
                  >
                    {isIconLogo && iconLogoInfo ? (
                      <IconRenderer
                        family={iconLogoInfo.family}
                        name={iconLogoInfo.name}
                        size={logoOverlaySize * 0.6}
                        color={qrSettings.qrColor || qrSettings.frameThemeColor || '#22c55e'}
                      />
                    ) : (
                      <Image source={{ uri: qrSettings.customLogo }} style={styles.logoOverlayImage} />
                    )}
                  </View>
                )}
              </View>
              {qrSettings.symbolType === 'qr' && showFrameControls && hasFrameText && (
                <View
                  style={[
                    styles.frameLabelBlock,
                    {
                      backgroundColor: qrSettings.frameThemeColor,
                      borderColor:
                        qrSettings.frameThemeColor.toLowerCase() === '#ffffff'
                          ? 'rgba(0,0,0,0.45)'
                          : 'rgba(255,255,255,0.9)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.frameLabelText,
                      {
                        color:
                          qrSettings.frameThemeColor.toLowerCase() === '#ffffff'
                            ? '#0b1220'
                            : '#fff',
                      },
                    ]}
                  >
                    {frameLabelText}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ViewShot>
        <View style={[styles.actionButtons, compact ? { gap: 8 } : null]}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              compact ? { paddingVertical: 10 } : null,
              { backgroundColor: dark ? '#1f2937' : '#fff' },
            ]}
            onPress={onDownload}
          >
            <Ionicons
              name="download-outline"
              size={20}
              color={dark ? '#4a9eff' : '#0066cc'}
            />
            <Text
              style={[
                styles.actionButtonText,
                compact ? { fontSize: 14 } : null,
                { color: dark ? '#4a9eff' : '#0066cc' },
              ]}
            >
              {t('download') || 'İndir'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              compact ? { paddingVertical: 10 } : null,
              { backgroundColor: dark ? '#1f2937' : '#fff' },
            ]}
            onPress={onShare}
          >
            <Ionicons
              name="share-outline"
              size={20}
              color={dark ? '#4a9eff' : '#0066cc'}
            />
            <Text
              style={[
                styles.actionButtonText,
                compact ? { fontSize: 14 } : null,
                { color: dark ? '#4a9eff' : '#0066cc' },
              ]}
            >
              {t('share') || 'Paylaş'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!uiState.matrix && !uiState.generating) {
    return (
      <View
        style={[
          styles.placeholder,
          {
            backgroundColor: dark ? '#111827' : '#ffffff',
            borderColor: dark ? '#1f2937' : '#dde3ea',
          },
          compact ? { padding: 24 } : null,
        ]}
      >
        <View
          style={[
            styles.placeholderIcon,
            { backgroundColor: dark ? '#1f2937' : '#f0f4f8' },
          ]}
        >
          <Ionicons
            name={
              qrSettings.symbolType === 'barcode'
                ? 'barcode-outline'
                : 'qr-code-outline'
            }
            size={compact ? 52 : 64}
            color={dark ? '#4b5563' : '#94a3b8'}
          />
        </View>
        <Text
          style={[
            styles.placeholderTitle,
            compact ? { fontSize: 16 } : null,
            { color: dark ? '#e6edf3' : '#0b1220' },
          ]}
        >
          {qrSettings.symbolType === 'barcode'
            ? t('placeholder_title_barcode') || 'Barkod Oluşturun'
            : t('placeholder_title') || 'QR Kod Oluşturun'}
        </Text>
        <Text
          style={[
            styles.placeholderText,
            { color: dark ? '#8b98a5' : '#7a8699' },
          ]}
        >
          {qrSettings.symbolType === 'barcode'
            ? t('placeholder_text_barcode') ||
              'Yukarıdaki alana geçerli barkod verisini girin, barkodunuz otomatik olarak oluşturulacak'
            : t('placeholder_text') ||
              'Yukarıdaki alana metin veya URL girin, QR kodunuz otomatik olarak oluşturulacak'}
        </Text>
      </View>
    );
  }

  return null;
}
