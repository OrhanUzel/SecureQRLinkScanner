export const CUSTOM_MODES = [
  { key: 'none', icon: 'qr-code-outline', labelKey: 'custom_qr_mode.none', defaultLabel: 'Klasik' },
  { key: 'logo', icon: 'image-outline', labelKey: 'custom_qr_mode.logo', defaultLabel: 'Logo Ortası' },
  { key: 'logo_frame', icon: 'albums-outline', labelKey: 'custom_qr_mode.logo_frame', defaultLabel: 'Logo + Çerçeve' },
  { key: 'frame_text', icon: 'chatbox-ellipses-outline', labelKey: 'custom_qr_mode.frame_text', defaultLabel: 'Çerçeve + Yazı' },
];

export const FRAME_TEXT_MAX = 42;
export const QR_TEXT_MAX = 256;

export const ICON_LIBRARY = [
  { id: 'whatsapp-light', family: 'fontisto', name: 'whatsapp', color: '#22c55e', category: 'messaging', previewBg: '#ffffff' },
  { id: 'whatsapp-dark', family: 'fontisto', name: 'whatsapp', color: '#22c55e', category: 'messaging', previewBg: '#020617' },
  { id: 'whatsapp-accent', family: 'ionicon', name: 'logo-whatsapp', color: '#22c55e', category: 'messaging', theme: { qrColor: '#22c55e', frameColor: '#16a34a', mode: 'logo_frame' } },

  { id: 'telegram-light', family: 'fontisto', name: 'telegram', color: '#0ea5e9', category: 'messaging', previewBg: '#ffffff' },
  { id: 'telegram-dark-variant', family: 'fontisto', name: 'telegram', color: '#0ea5e9', category: 'messaging', previewBg: '#020617' },
  { id: 'telegram-accent', family: 'ionicon', name: 'paper-plane-outline', color: '#0ea5e9', category: 'messaging', theme: { qrColor: '#0ea5e9', frameColor: '#0369a1', mode: 'logo_frame' } },

  { id: 'instagram-light', family: 'fontisto', name: 'instagram', color: '#ec4899', category: 'social', previewBg: '#ffffff' },
  { id: 'instagram-dark-variant', family: 'fontisto', name: 'instagram', color: '#ec4899', category: 'social', previewBg: '#020617' },
  { id: 'instagram-vivid', family: 'ionicon', name: 'logo-instagram', color: '#f97316', category: 'social', theme: { qrColor: '#f97316', frameColor: '#a855f7', mode: 'logo_frame' } },

  { id: 'youtube-light', family: 'fontisto', name: 'youtube-play', color: '#ef4444', category: 'social', previewBg: '#ffffff' },
  { id: 'youtube-dark-variant', family: 'fontisto', name: 'youtube-play', color: '#ef4444', category: 'social', previewBg: '#020617' },
  { id: 'youtube-dark', family: 'fontisto', name: 'youtube-play', color: '#b91c1c', category: 'social' },
  { id: 'youtube-soft', family: 'ionicon', name: 'logo-youtube', color: '#f97316', category: 'social', theme: { qrColor: '#ef4444', frameColor: '#991b1b', mode: 'logo_frame' } },

  { id: 'facebook-blue', family: 'fontisto', name: 'facebook', color: '#2563eb', category: 'social' },
  { id: 'facebook-deep', family: 'fontisto', name: 'facebook', color: '#1d4ed8', category: 'social', previewBg: '#020617' },
  { id: 'pinterest-red', family: 'fontisto', name: 'pinterest', color: '#e11d48', category: 'social' },
  { id: 'pinterest-deep', family: 'fontisto', name: 'pinterest', color: '#b91c1c', category: 'social' },
  { id: 'snapchat-yellow', family: 'fontisto', name: 'snapchat', color: '#facc15', category: 'social' },
  { id: 'discord-indigo', family: 'ionicon', name: 'logo-discord', color: '#4f46e5', category: 'social', theme: { qrColor: '#4f46e5', frameColor: '#1e1b4b', mode: 'logo_frame' } },
  { id: 'reddit-orange', family: 'ionicon', name: 'logo-reddit', color: '#f97316', category: 'social' },
  { id: 'twitch-purple', family: 'ionicon', name: 'logo-twitch', color: '#8b5cf6', category: 'social' },
  { id: 'dribbble-pink', family: 'ionicon', name: 'logo-dribbble', color: '#ec4899', category: 'social' },
  { id: 'behance-blue', family: 'ionicon', name: 'logo-behance', color: '#2563eb', category: 'social' },
  { id: 'medium-brand', family: 'fontawesome', name: 'medium', color: '#111827', category: 'social' },

  { id: 'fun-smile', family: 'fontawesome', name: 'smile-o', color: '#facc15', category: 'social' },

  { id: 'spotify-green', family: 'fontisto', name: 'spotify', color: '#22c55e', category: 'media', theme: { qrColor: '#16a34a', frameColor: '#022c22', mode: 'logo_frame' } },
  { id: 'spotify-light', family: 'fontisto', name: 'spotify', color: '#22c55e', category: 'media', previewBg: '#ffffff' },
  { id: 'spotify-dark', family: 'fontisto', name: 'spotify', color: '#22c55e', category: 'media', previewBg: '#020617' },
  { id: 'soundcloud-orange', family: 'fontisto', name: 'soundcloud', color: '#f97316', category: 'media' },
  { id: 'applemusic-pink', family: 'fontisto', name: 'applemusic', color: '#ec4899', category: 'media' },
  { id: 'vimeo-sky', family: 'ionicon', name: 'logo-vimeo', color: '#0ea5e9', category: 'media' },
  { id: 'youtube-music', family: 'ionicon', name: 'musical-notes', color: '#ef4444', category: 'media' },

  { id: 'fun-rocket', family: 'fontawesome', name: 'rocket', color: '#f97316', category: 'fun' },
  { id: 'fun-gamepad', family: 'fontawesome', name: 'gamepad', color: '#a855f7', category: 'fun' },
  { id: 'fun-music', family: 'feather', name: 'music', color: '#22c55e', category: 'fun' },
  { id: 'fun-film', family: 'feather', name: 'film', color: '#fbbf24', category: 'fun' },
  { id: 'fun-smile-feather', family: 'feather', name: 'smile', color: '#f97316', category: 'fun' },

  { id: 'fun-alien', family: 'mci', name: 'alien-outline', color: '#22c55e', category: 'fun' },
  { id: 'fun-robot', family: 'mci', name: 'robot-happy', color: '#22d3ee', category: 'fun' },
  { id: 'fun-controller-mci', family: 'mci', name: 'controller-classic', color: '#a855f7', category: 'fun' },
  { id: 'fun-emoticon', family: 'mci', name: 'emoticon-happy-outline', color: '#facc15', category: 'fun' },

  { id: 'fun-emoji-happy', family: 'entypo', name: 'emoji-happy', color: '#facc15', category: 'fun' },
  { id: 'fun-game-controller', family: 'entypo', name: 'game-controller', color: '#38bdf8', category: 'fun' },

  { id: 'twitter-blue', family: 'fontisto', name: 'twitter', color: '#0ea5e9', category: 'business' },
  { id: 'twitter-deep', family: 'fontisto', name: 'twitter', color: '#0369a1', category: 'business', previewBg: '#020617' },
  { id: 'linkedin-blue', family: 'fontisto', name: 'linkedin', color: '#2563eb', category: 'business' },
  { id: 'linkedin-deep', family: 'fontisto', name: 'linkedin', color: '#1d4ed8', category: 'business', previewBg: '#020617' },
  { id: 'email-primary', family: 'ionicon', name: 'mail', color: '#0f172a', category: 'business' },
  { id: 'email-accent', family: 'ionicon', name: 'mail-outline', color: '#2563eb', category: 'business' },
  { id: 'phone-primary', family: 'ionicon', name: 'call', color: '#16a34a', category: 'business' },
  { id: 'phone-accent', family: 'ionicon', name: 'call-outline', color: '#22c55e', category: 'business' },
  { id: 'slack-green', family: 'ionicon', name: 'logo-slack', color: '#10b981', category: 'business' },
  { id: 'github-dark', family: 'ionicon', name: 'logo-github', color: '#111827', category: 'business', previewBg: '#020617' },
  { id: 'github-light', family: 'ionicon', name: 'logo-github', color: '#6b7280', category: 'business', previewBg: '#ffffff' },

  { id: 'store-primary', family: 'fontisto', name: 'shopping-store', color: '#ea580c', category: 'store', theme: { qrColor: '#ea580c', frameColor: '#7c2d12', mode: 'logo_frame' } },
  { id: 'store-accent', family: 'fontisto', name: 'shopping-store', color: '#f97316', category: 'store' },
  { id: 'location-primary', family: 'ionicon', name: 'location', color: '#dc2626', category: 'store' },
  { id: 'location-accent', family: 'ionicon', name: 'location-outline', color: '#f97316', category: 'store' },

  { id: 'wifi-primary', family: 'ionicon', name: 'wifi', color: '#0f172a', category: 'utility' },
  { id: 'wifi-accent', family: 'ionicon', name: 'wifi-outline', color: '#2563eb', category: 'utility' },
  { id: 'link-primary', family: 'ionicon', name: 'link', color: '#0f172a', category: 'utility' },
  { id: 'link-accent', family: 'ionicon', name: 'link-outline', color: '#2563eb', category: 'utility' },
  { id: 'globe-primary', family: 'ionicon', name: 'globe', color: '#0f172a', category: 'utility' },
  { id: 'globe-accent', family: 'ionicon', name: 'globe-outline', color: '#2563eb', category: 'utility' },
  { id: 'chat-primary', family: 'ionicon', name: 'chatbubbles', color: '#2563eb', category: 'utility' },
  { id: 'chat-accent', family: 'ionicon', name: 'chatbubbles-outline', color: '#4f46e5', category: 'utility' },

  { id: 'calendar-primary', family: 'ionicon', name: 'calendar', color: '#2563eb', category: 'utility' },
  { id: 'qr-primary', family: 'ionicon', name: 'qr-code-outline', color: '#0f172a', category: 'utility' },
  { id: 'shield-green', family: 'ionicon', name: 'shield-checkmark', color: '#22c55e', category: 'utility' }
];

export const ICON_CATEGORIES = [
  { key: 'all', labelKey: 'icon_category.all', fallback: 'Tümü', color: '#0ea5e9' },
  { key: 'favorites', labelKey: 'icon_category.favorites', fallback: 'Favoriler', color: '#facc15' },
  { key: 'messaging', labelKey: 'icon_category.messaging', fallback: 'Mesajlaşma', color: '#22c55e' },
  { key: 'social', labelKey: 'icon_category.social', fallback: 'Sosyal', color: '#6366f1' },
  { key: 'media', labelKey: 'icon_category.media', fallback: 'Müzik / Video', color: '#ec4899' },
  { key: 'fun', labelKey: 'icon_category.fun', fallback: 'Eğlence', color: '#f97316' },
  { key: 'business', labelKey: 'icon_category.business', fallback: 'İş / İletişim', color: '#0ea5e9' },
  { key: 'store', labelKey: 'icon_category.store', fallback: 'Mağaza', color: '#f97316' },
  { key: 'utility', labelKey: 'icon_category.utility', fallback: 'Genel', color: '#64748b' }
];

export const QUICK_LINK_TEMPLATES = [
  {
    key: 'whatsapp',
    icon: 'whatsapp',
    color: '#22c55e',
    bgLight: 'rgba(34,197,94,0.08)',
    bgDark: 'rgba(22,163,74,0.18)',
    labelKey: 'quick_templates.whatsapp_label',
    descKey: 'quick_templates.whatsapp_desc',
    fallbackLabel: 'WhatsApp Sohbeti',
    fallbackDesc: 'Tek tıkla WhatsApp konuşması başlat',
    example: 'https://wa.me/905xxxxxxxxx'
  },
  {
    key: 'instagram',
    icon: 'instagram',
    color: '#ec4899',
    bgLight: 'rgba(236,72,153,0.08)',
    bgDark: 'rgba(219,39,119,0.18)',
    labelKey: 'quick_templates.instagram_label',
    descKey: 'quick_templates.instagram_desc',
    fallbackLabel: 'Instagram Profili',
    fallbackDesc: 'Profiline doğrudan yönlendiren QR kodu',
    example: 'https://instagram.com/kullaniciadi'
  },
  {
    key: 'telegram',
    icon: 'telegram',
    color: '#0ea5e9',
    bgLight: 'rgba(14,165,233,0.08)',
    bgDark: 'rgba(37,99,235,0.18)',
    labelKey: 'quick_templates.telegram_label',
    descKey: 'quick_templates.telegram_desc',
    fallbackLabel: 'Telegram Kanalı',
    fallbackDesc: 'Kanal veya gruba hızlı katılım linki',
    example: 'https://t.me/kanal_adi'
  },
  {
    key: 'youtube',
    icon: 'youtube-play',
    color: '#ef4444',
    bgLight: 'rgba(239,68,68,0.08)',
    bgDark: 'rgba(220,38,38,0.18)',
    labelKey: 'quick_templates.youtube_label',
    descKey: 'quick_templates.youtube_desc',
    fallbackLabel: 'YouTube Kanalı',
    fallbackDesc: 'Kanalına veya videona yönlendiren link',
    example: 'https://youtube.com/@kanal'
  }
];

export const BARCODE_FORMATS = [
  {
    k: 'CODE128',
    key: 'barcode_format.code128',
    fallback: 'Code 128',
    descKey: 'barcode_format_desc.code128',
    fallbackDesc: 'Genel amaçlı, yoğun alfanümerik barkod'
  },
  {
    k: 'CODE39',
    key: 'barcode_format.code39',
    fallback: 'Code 39',
    descKey: 'barcode_format_desc.code39',
    fallbackDesc: 'Basit alfanümerik, endüstriyel uygulamalarda yaygın'
  },
  {
    k: 'CODE128A',
    key: 'barcode_format.code128a',
    fallback: 'Code 128 A',
    descKey: 'barcode_format_desc.code128a',
    fallbackDesc: 'Code 128, büyük harf ve kontrol karakterleri'
  },
  {
    k: 'CODE128B',
    key: 'barcode_format.code128b',
    fallback: 'Code 128 B',
    descKey: 'barcode_format_desc.code128b',
    fallbackDesc: 'Code 128, tam ASCII destekli alfanümerik'
  },
  {
    k: 'CODE128C',
    key: 'barcode_format.code128c',
    fallback: 'Code 128 C',
    descKey: 'barcode_format_desc.code128c',
    fallbackDesc: 'Code 128, çift haneli sayısal veri için'
  },
  {
    k: 'EAN13',
    key: 'barcode_format.ean13',
    fallback: 'EAN-13',
    descKey: 'barcode_format_desc.ean13',
    fallbackDesc: 'Perakende ürünler için standart 13 haneli kod'
  },
  {
    k: 'EAN8',
    key: 'barcode_format.ean8',
    fallback: 'EAN-8',
    descKey: 'barcode_format_desc.ean8',
    fallbackDesc: 'Küçük paketler için 8 haneli kısaltılmış EAN'
  },
  {
    k: 'EAN5',
    key: 'barcode_format.ean5',
    fallback: 'EAN-5',
    descKey: 'barcode_format_desc.ean5',
    fallbackDesc: 'Fiyat veya ek bilgi için 5 haneli eklenti'
  },
  {
    k: 'EAN2',
    key: 'barcode_format.ean2',
    fallback: 'EAN-2',
    descKey: 'barcode_format_desc.ean2',
    fallbackDesc: 'Dergi sayısı gibi ek bilgi için 2 haneli eklenti'
  },
  {
    k: 'UPC',
    key: 'barcode_format.upc',
    fallback: 'UPC',
    descKey: 'barcode_format_desc.upc',
    fallbackDesc: 'ABD perakende ürünleri için 12 haneli kod'
  },
  {
    k: 'UPCE',
    key: 'barcode_format.upce',
    fallback: 'UPC-E',
    descKey: 'barcode_format_desc.upce',
    fallbackDesc: 'Küçük paketler için kısaltılmış 6 haneli UPC'
  },
  {
    k: 'ITF14',
    key: 'barcode_format.itf14',
    fallback: 'ITF-14',
    descKey: 'barcode_format_desc.itf14',
    fallbackDesc: 'Koli ve sevkiyat etiketleri için 14 haneli kod'
  },
  {
    k: 'ITF',
    key: 'barcode_format.itf',
    fallback: 'ITF',
    descKey: 'barcode_format_desc.itf',
    fallbackDesc: 'Sayısal veri için iç içe beşli barkod'
  },
  {
    k: 'MSI',
    key: 'barcode_format.msi',
    fallback: 'MSI',
    descKey: 'barcode_format_desc.msi',
    fallbackDesc: 'Envanter ve mağaza içi etiketler için sayısal'
  },
  {
    k: 'MSI10',
    key: 'barcode_format.msi10',
    fallback: 'MSI-10',
    descKey: 'barcode_format_desc.msi10',
    fallbackDesc: 'MSI, mod 10 kontrol basamağı ile'
  },
  {
    k: 'MSI11',
    key: 'barcode_format.msi11',
    fallback: 'MSI-11',
    descKey: 'barcode_format_desc.msi11',
    fallbackDesc: 'MSI, mod 11 kontrol basamağı ile'
  },
  {
    k: 'MSI1010',
    key: 'barcode_format.msi1010',
    fallback: 'MSI-1010',
    descKey: 'barcode_format_desc.msi1010',
    fallbackDesc: 'MSI, çift mod 10 kontrol basamağı ile'
  },
  {
    k: 'MSI1110',
    key: 'barcode_format.msi1110',
    fallback: 'MSI-1110',
    descKey: 'barcode_format_desc.msi1110',
    fallbackDesc: 'MSI, mod 11 ve mod 10 kontrol ile'
  },
  {
    k: 'pharmacode',
    key: 'barcode_format.pharmacode',
    fallback: 'Pharmacode',
    descKey: 'barcode_format_desc.pharmacode',
    fallbackDesc: 'İlaç ambalajları ve farmasötik süreçler için'
  },
  {
    k: 'codabar',
    key: 'barcode_format.codabar',
    fallback: 'Codabar',
    descKey: 'barcode_format_desc.codabar',
    fallbackDesc: 'Kütüphane ve kan bankası etiketleri için basit barkod'
  },
];
