import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import IconRenderer from '../IconRenderer';

export default function IconPickerModal({
  dark,
  t,
  uiState,
  unlockState,
  updateUi,
  previewFrameColor,
  previewQrColor,
  previewIcon,
  handleIconSelect,
  ICON_CATEGORIES,
  ICON_LIBRARY,
}) {
  return (
    <Modal
      visible={uiState.iconPickerVisible}
      transparent
      animationType="fade"
      onRequestClose={() => updateUi({ iconPickerVisible: false })}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: dark ? 'rgba(15,23,42,0.85)' : 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 20,
            backgroundColor: dark ? '#111827' : '#ffffff',
            padding: 16,
            borderWidth: 1,
            borderColor: dark ? '#1f2937' : '#e2e8f0',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="sparkles-outline" size={18} color="#2563eb" />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: dark ? '#e6edf3' : '#0f172a',
                }}
              >
                {t('custom_qr_icon_picker_title') || 'Hazır ikonlar'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => updateUi({ iconPickerVisible: false })}
              style={{ padding: 4 }}
            >
              <Ionicons
                name="close"
                size={20}
                color={dark ? '#9ca3af' : '#6b7280'}
              />
            </TouchableOpacity>
          </View>

          <Text
            style={{
              fontSize: 12,
              color: dark ? '#94a3b8' : '#6b7280',
              marginBottom: 4,
            }}
          >
            {t('custom_qr_icon_picker_subtitle') ||
              'Hazır kategorilerden ikon seçin, stil otomatik uygulansın.'}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: dark ? '#9ca3af' : '#9ca3af',
              marginBottom: 10,
            }}
          >
            {t('custom_qr_icon_picker_hint')}
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingVertical: 4,
              paddingHorizontal: 2,
              marginBottom: 10,
            }}
          >
            {ICON_CATEGORIES.map((cat) => {
              const active = (uiState.iconCategory || 'all') === cat.key;
              const color = cat.color || '#2563eb';
              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => updateUi({ iconCategory: cat.key })}
                  activeOpacity={0.9}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    marginRight: 6,
                    backgroundColor: active
                      ? color
                      : dark
                      ? '#111827'
                      : '#f3f4f6',
                    borderWidth: 1,
                    borderColor: active ? color : dark ? '#1f2937' : '#e5e7eb',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      backgroundColor: active
                        ? 'rgba(15,23,42,0.1)'
                        : dark
                        ? '#111827'
                        : '#ffffff',
                      borderWidth: 1,
                      borderColor: active
                        ? 'rgba(255,255,255,0.85)'
                        : color,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        backgroundColor: active ? '#ffffff' : color,
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: active
                        ? '#ffffff'
                        : dark
                        ? '#e6edf3'
                        : '#111827',
                    }}
                  >
                    {t(cat.labelKey) || cat.fallback}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ marginBottom: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: dark ? '#cbd5f5' : '#4b5563',
                }}
              >
                {(t('custom_qr_icon_picker_preview') ||
                  'Seçili kategoriye göre QR örneği') + ' '}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              />
            </View>
            <View
              style={{
                marginTop: 6,
                borderRadius: 14,
                padding: 10,
                backgroundColor: dark ? '#111827' : '#f9fafb',
                borderWidth: 1,
                borderColor: dark ? '#1f2937' : '#e5e7f0',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 12,
                  backgroundColor: '#ffffff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: previewFrameColor,
                  position: 'relative',
                }}
              >
                <QRCode
                  value="PREVIEW"
                  size={48}
                  color={previewQrColor}
                  backgroundColor="#ffffff"
                />
                {(() => {
                  const lastIcon = previewIcon;
                  if (!lastIcon) return null;
                  const bgColor = lastIcon.previewBg || '#ffffff';
                  return (
                    <View
                      style={{
                        position: 'absolute',
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        backgroundColor: bgColor,
                        borderWidth: 1.5,
                        borderColor: previewFrameColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconRenderer
                        family={lastIcon.family}
                        name={lastIcon.name}
                        size={12}
                        color={lastIcon.color || previewQrColor}
                      />
                    </View>
                  );
                })()}
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: dark ? '#e6edf3' : '#0f172a',
                    marginBottom: 2,
                  }}
                >
                  {t('custom_qr_icon_picker_preview_title') ||
                    'Kategori temalı mini önizleme'}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: dark ? '#94a3b8' : '#6b7280',
                  }}
                >
                  {t('custom_qr_icon_picker_preview_desc') ||
                    'Bu kategorideki ikonlar QR kodunuzu benzer renklerle renklendirir.'}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: 260 }}
            contentContainerStyle={{ paddingVertical: 4 }}
          >
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
              }}
            >
              {ICON_LIBRARY.filter((icon) => {
                const cat = uiState.iconCategory || 'all';
                if (cat === 'all') return true;
                if (cat === 'favorites') {
                  return (
                    uiState.iconFavorites &&
                    uiState.iconFavorites.includes(icon.id)
                  );
                }
                return icon.category === cat;
              }).map((icon) => {
                const selected = uiState.lastIconId === icon.id;
                const baseBg = icon.previewBg || '#ffffff';
                const chipBg = dark ? '#111827' : '#f9fafb';
                const locked =
                  !uiState.premium && !unlockState.unlockedModes.icon_pack;
                return (
                  <TouchableOpacity
                    key={icon.id}
                    onPress={() => handleIconSelect(icon)}
                    onLongPress={() => updateUi({ lastIconId: icon.id })}
                    delayLongPress={280}
                    activeOpacity={0.85}
                    style={{
                      width: '31%',
                      marginBottom: 10,
                      borderRadius: 14,
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      backgroundColor: chipBg,
                      borderWidth: 1,
                      borderColor: selected
                        ? icon.color
                        : dark
                        ? '#1f2937'
                        : '#e5e7f0',
                      shadowColor: selected ? icon.color : '#000',
                      shadowOpacity: selected ? 0.35 : 0.08,
                      shadowRadius: selected ? 8 : 4,
                      shadowOffset: { width: 0, height: selected ? 4 : 2 },
                      elevation: selected ? 6 : 2,
                      opacity: locked ? 0.6 : 1,
                    }}
                  >
                    <View
                      style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: baseBg,
                          borderWidth: 2,
                          borderColor: icon.color,
                        }}
                      >
                        <IconRenderer
                          family={icon.family}
                          name={icon.name}
                          size={20}
                          color={icon.color}
                        />
                      </View>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 2,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            backgroundColor: icon.color,
                          }}
                        />
                        <Text
                          numberOfLines={1}
                          style={{
                            flexShrink: 1,
                            fontSize: 11,
                            color: dark ? '#e6edf3' : '#111827',
                          }}
                        >
                          {icon.category}
                        </Text>
                        {locked && (
                          <Ionicons
                            name="lock-closed"
                            size={12}
                            color="#f97316"
                          />
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={async () => {
                          const list = uiState.iconFavorites || [];
                          const exists = list.includes(icon.id);
                          const next = exists
                            ? list.filter((id) => id !== icon.id)
                            : [...list, icon.id];
                          updateUi({ iconFavorites: next });
                          try {
                            await AsyncStorage.setItem(
                              'icon-favorites',
                              JSON.stringify(next),
                            );
                          } catch {}
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons
                          name={
                            uiState.iconFavorites &&
                            uiState.iconFavorites.includes(icon.id)
                              ? 'star'
                              : 'star-outline'
                          }
                          size={16}
                          color={
                            uiState.iconFavorites &&
                            uiState.iconFavorites.includes(icon.id)
                              ? '#facc15'
                              : '#9ca3af'
                          }
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
