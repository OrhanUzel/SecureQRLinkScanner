import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ColorPicker, { Panel1, Preview, HueSlider } from 'reanimated-color-picker';
import { runOnJS } from 'react-native-reanimated';
import { styles } from '../../screens/CreateQrScreen.styles';

export default function ColorPickerModal({
  dark,
  t,
  uiState,
  qrSettings,
  updateUi,
  updateQr,
  onColorChange,
}) {
  return (
    <Modal
      visible={uiState.colorPickerVisible}
      transparent
      animationType="fade"
      onRequestClose={() => updateUi({ colorPickerVisible: false })}
    >
      <GestureHandlerRootView style={styles.colorModalOverlay}>
        <View
          style={[
            styles.colorModalCard,
            {
              backgroundColor: dark ? '#111827' : '#fff',
              borderColor: dark ? '#1f2937' : '#e2e8f0',
            },
          ]}
        >
          <Text
            style={[
              styles.colorModalTitle,
              { color: dark ? '#e6edf3' : '#0b1220' },
            ]}
          >
            {uiState.colorPickerTarget === 'frame'
              ? t('custom_qr_color_pick') || 'Tema rengi seç'
              : t('custom_qr_dot_color') || 'Nokta Rengi'}
          </Text>

          <View style={{ height: 260, width: '100%', marginVertical: 10 }}>
            <ColorPicker
              style={{ flex: 1 }}
              value={
                uiState.colorPickerTarget === 'frame'
                  ? qrSettings.tempFrameColor
                  : qrSettings.tempQrColor
              }
              onComplete={({ hex }) => {
                'worklet';
                runOnJS(onColorChange)(hex);
              }}
            >
              <Preview
                hideInitialColor
                textStyle={{
                  color: dark ? '#fff' : '#000',
                  fontSize: 16,
                  fontWeight: 'bold',
                }}
              />
              <Panel1 style={{ marginTop: 12, borderRadius: 12 }} />
              <HueSlider
                style={{ marginTop: 12, borderRadius: 12, height: 30 }}
              />
            </ColorPicker>
          </View>

          <View style={styles.colorModalActions}>
            <TouchableOpacity
              style={[
                styles.colorBtn,
                { backgroundColor: dark ? '#1f2937' : '#e5e7eb' },
              ]}
              onPress={() => updateUi({ colorPickerVisible: false })}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.colorBtnText,
                  { color: dark ? '#e6edf3' : '#0b1220' },
                ]}
              >
                {t('common.cancel') || 'İptal'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.colorBtn, { backgroundColor: '#2563eb' }]}
              onPress={() => {
                if (uiState.colorPickerTarget === 'frame') {
                  updateQr({ frameThemeColor: qrSettings.tempFrameColor });
                } else {
                  updateQr({ qrColor: qrSettings.tempQrColor });
                }
                updateUi({ colorPickerVisible: false });
              }}
              activeOpacity={0.9}
            >
              <Text style={[styles.colorBtnText, { color: '#fff' }]}>
                {t('common.select') || 'Seç'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
