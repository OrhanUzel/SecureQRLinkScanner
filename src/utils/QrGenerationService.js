import { Platform } from 'react-native';

/**
 * QR ve barkod oluşturma iş mantığını kapsülleyen servis sınıfı.
 * Bu sınıf React/React Native bağımsızdır ve sadece saf iş kurallarını içerir.
 */
export default class QrGenerationService {
  buildWifiPayload(wifiConfig) {
    const esc = (value) => (value || '').replace(/([\\;,:])/g, '\\$1');
    const security =
      wifiConfig.security === 'nopass'
        ? 'nopass'
        : wifiConfig.security === 'WEP'
        ? 'WEP'
        : 'WPA';

    const parts = [`T:${security}`, `S:${esc(wifiConfig.ssid)}`];
    if (security !== 'nopass') {
      parts.push(`P:${esc(wifiConfig.password)}`);
    }
    if (wifiConfig.hidden) {
      parts.push('H:true');
    }

    return `WIFI:${parts.join(';')};`;
  }

  buildContactPayload(type, contactInfo) {
    if (type === 'tel') {
      const phone = (contactInfo.phone || '').trim();
      return phone ? `tel:${phone}` : '';
    }

    if (type === 'email') {
      const to = (contactInfo.email || '').trim();
      const queryParts = [];

      if (contactInfo.subject) {
        queryParts.push(`subject=${encodeURIComponent(contactInfo.subject)}`);
      }
      if (contactInfo.body) {
        queryParts.push(`body=${encodeURIComponent(contactInfo.body)}`);
      }

      const query = queryParts.length ? `?${queryParts.join('&')}` : '';
      return to ? `mailto:${to}${query}` : '';
    }

    if (type === 'sms') {
      const number = (contactInfo.smsNumber || '').trim();
      const body = (contactInfo.smsBody || '').trim();
      if (!number && !body) return '';
      return body ? `SMSTO:${number}:${body}` : `SMSTO:${number}`;
    }

    return '';
  }

  /**
   * UI katmanına bağımlı olmadan payload üretir.
   */
  buildPayload({ type, symbolType, input, wifiConfig, contactInfo }) {
    if (type === 'url' || type === 'text') {
      const raw = (input || '').trim();
      return raw;
    }

    if (type === 'wifi') {
      return this.buildWifiPayload(wifiConfig);
    }

    if (type === 'tel' || type === 'email' || type === 'sms') {
      return this.buildContactPayload(type, contactInfo);
    }

    return '';
  }

  /**
   * Barkod içeriğini formata göre doğrular.
   * UI, dönen sonucu kullanarak uygun hata mesajını gösterebilir.
   */
  validateBarcodeContent(formatKey, raw) {
    const content = (raw || '').trim();
    const fmt = formatKey || 'CODE128';

    if (__DEV__) {
      console.log('[QrGenerationService] validateBarcodeContent', {
        formatKey,
        resolvedFormat: fmt,
        raw,
        content,
        length: content.length,
      });
    }

    if (!content) {
      if (__DEV__) {
        console.log('[QrGenerationService] validateBarcodeContent empty content');
      }
      return { ok: false, reason: 'empty' };
    }

    const isNumeric = (value) => /^[0-9]+$/.test(value);
    const isCode39Chars = (value) =>
      /^[0-9A-Z\-\.\ \$\/\+\%]+$/.test(value);

    const fail = (reason) => ({ ok: false, reason });

    const computeEAN13CheckDigit = (digits12) => {
      if (!/^[0-9]{12}$/.test(digits12)) return null;
      let sum = 0;
      for (let i = 0; i < 12; i += 1) {
        const n = parseInt(digits12[i], 10);
        if (Number.isNaN(n)) return null;
        if (i % 2 === 0) {
          sum += n;
        } else {
          sum += n * 3;
        }
      }
      const mod = sum % 10;
      return mod === 0 ? 0 : 10 - mod;
    };

    const computeEAN8CheckDigit = (digits7) => {
      if (!/^[0-9]{7}$/.test(digits7)) return null;
      let sumOdd = 0;
      let sumEven = 0;
      for (let i = 0; i < 7; i += 1) {
        const n = parseInt(digits7[i], 10);
        if (Number.isNaN(n)) return null;
        if ((i + 1) % 2 === 1) {
          sumOdd += n;
        } else {
          sumEven += n;
        }
      }
      const sum = sumOdd * 3 + sumEven;
      const mod = sum % 10;
      return mod === 0 ? 0 : 10 - mod;
    };

    const validateEAN13 = () => {
      if (!isNumeric(content)) return fail('non_numeric');
      if (content.length === 12) {
        const check = computeEAN13CheckDigit(content);
        if (check === null) return fail('non_numeric');
        return { ok: true, value: `${content}${check}` };
      }
      if (content.length === 13) {
        const base = content.slice(0, 12);
        const checkDigit = content[12];
        const check = computeEAN13CheckDigit(base);
        if (check === null) return fail('non_numeric');
        if (String(check) !== checkDigit) return fail('checksum');
        return { ok: true, value: content };
      }
      return fail('length');
    };

    if (fmt === 'EAN13') {
      return validateEAN13();
    }
    if (fmt === 'EAN8') {
      if (!isNumeric(content)) return fail('non_numeric');
      if (content.length === 7) {
        const check = computeEAN8CheckDigit(content);
        if (check === null) return fail('non_numeric');
        return { ok: true, value: `${content}${check}` };
      }
      if (content.length === 8) {
        const base = content.slice(0, 7);
        const checkDigit = content[7];
        const check = computeEAN8CheckDigit(base);
        if (check === null) return fail('non_numeric');
        if (String(check) !== checkDigit) return fail('checksum');
        return { ok: true, value: content };
      }
      return fail('length');
    }
    if (fmt === 'EAN5') {
      if (!isNumeric(content)) return fail('non_numeric');
      if (content.length !== 5) return fail('length');
      return { ok: true, value: content };
    }
    if (fmt === 'EAN2') {
      if (!isNumeric(content)) return fail('non_numeric');
      if (content.length !== 2) return fail('length');
      return { ok: true, value: content };
    }
    if (fmt === 'UPC') {
      if (!isNumeric(content)) return fail('non_numeric');
      if (content.length !== 12) return fail('length');
      return { ok: true, value: content };
    }
    if (fmt === 'UPCE') {
      if (!isNumeric(content)) return fail('non_numeric');
      if (content.length !== 6 && content.length !== 8) {
        return fail('length');
      }
      return { ok: true, value: content };
    }
    if (fmt === 'ITF14') {
      if (!isNumeric(content)) return fail('non_numeric');
      if (content.length !== 14) return fail('length');
      return { ok: true, value: content };
    }
    if (fmt === 'ITF') {
      if (!isNumeric(content)) return fail('non_numeric');
      if (content.length % 2 !== 0) return fail('length');
      return { ok: true, value: content };
    }
    if (
      fmt === 'MSI' ||
      fmt === 'MSI10' ||
      fmt === 'MSI11' ||
      fmt === 'MSI1010' ||
      fmt === 'MSI1110'
    ) {
      if (!isNumeric(content)) return fail('non_numeric');
      return { ok: true, value: content };
    }
    if (fmt === 'pharmacode') {
      if (!isNumeric(content)) return fail('non_numeric');
      const n = parseInt(content, 10);
      if (Number.isNaN(n) || n < 3 || n > 131070) {
        return fail('range');
      }
      return { ok: true, value: String(n) };
    }
    if (fmt === 'codabar') {
      if (!/^[0-9\-\$\:\.\/\+ABCD]+$/.test(content)) {
        return fail('charset');
      }
      if (content.length < 2) return fail('length');
      const first = content[0];
      const last = content[content.length - 1];
      if (!/[ABCD]/.test(first) || !/[ABCD]/.test(last)) {
        return fail('charset');
      }
      return { ok: true, value: content };
    }
    if (fmt === 'CODE128A') {
      if (!/^[\x20-\x5F]+$/.test(content)) return fail('charset');
      return { ok: true, value: content };
    }
    if (fmt === 'CODE128B') {
      if (!/^[\x20-\x7E]+$/.test(content)) return fail('charset');
      return { ok: true, value: content };
    }
    if (fmt === 'CODE128C') {
      if (!isNumeric(content)) return fail('non_numeric');
      if (content.length % 2 !== 0) return fail('length');
      return { ok: true, value: content };
    }
    if (fmt === 'CODE39') {
      if (!isCode39Chars(content)) return fail('charset');
      return { ok: true, value: content };
    }

    return { ok: true, value: content };
  }

  /**
   * QR/Barcode matris verisini üretir.
   * Şu an için SVG tabanlı gösterim için basitleştirilmiş dummy matris döner.
   */
  async generateMatrix(text) {
    const value = (text || '').trim();

    if (__DEV__) {
      console.log('[QrGenerationService] generateMatrix called', {
        raw: text,
        value,
        length: value.length,
      });
    }

    if (!value) {
      if (__DEV__) {
        console.log('[QrGenerationService] generateMatrix empty value, returning null matrix');
      }
      return { matrix: null, generatedContent: null };
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = {
      matrix: { size: 100, rows: [] },
      generatedContent: value,
    };

    if (__DEV__) {
      console.log('[QrGenerationService] generateMatrix result', result);
    }

    return result;
  }

  payloadLength(payload) {
    return (payload || '').length;
  }

  getFilename() {
    const now = new Date();
    const ts = `${now.getFullYear()}_${String(
      now.getMonth() + 1
    ).padStart(2, '0')}_${String(now.getDate()).padStart(
      2,
      '0'
    )}_${String(now.getHours()).padStart(2, '0')}${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
    return `Secure_QR_${ts}.png`;
  }

  /**
   * Web canvas tabanlı data URL oluşturucu.
   * SVG geçişi sonrası geçici olarak devre dışı bırakıldığı için null döner.
   */
  buildCanvasDataUrl() {
    if (Platform.OS === 'web') {
      return null;
    }
    return null;
  }
}
