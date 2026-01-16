import QrGenerationService from '../src/utils/QrGenerationService';
import CreateQrStateManager from '../src/utils/CreateQrStateManager';
import { BARCODE_FORMATS } from '../src/utils/CreateQrConstants';

describe('QrGenerationService', () => {
  test('url ve text payloadları kırpılmış metin döner', () => {
    const service = new QrGenerationService();
    const urlPayload = service.buildPayload({
      type: 'url',
      symbolType: 'qr',
      input: '  https://example.com  ',
      wifiConfig: {},
      contactInfo: {},
    });
    const textPayload = service.buildPayload({
      type: 'text',
      symbolType: 'qr',
      input: '  merhaba  ',
      wifiConfig: {},
      contactInfo: {},
    });
    expect(urlPayload).toBe('https://example.com');
    expect(textPayload).toBe('merhaba');
  });

  test('wifi payloadı doğru formatta üretir', () => {
    const service = new QrGenerationService();
    const payload = service.buildPayload({
      type: 'wifi',
      symbolType: 'qr',
      input: '',
      wifiConfig: {
        ssid: 'My;WiFi',
        password: 'P@ss,123',
        security: 'WPA',
        hidden: true,
      },
      contactInfo: {},
    });
    expect(payload.startsWith('WIFI:T:WPA;S:')).toBe(true);
    expect(payload.includes('H:true')).toBe(true);
  });

  test('telefon ve e-posta payloadları beklendiği gibi üretilir', () => {
    const service = new QrGenerationService();
    const tel = service.buildContactPayload('tel', { phone: '5551234567' });
    const mail = service.buildContactPayload('email', {
      email: 'test@example.com',
      subject: 'Konu',
      body: 'İçerik',
    });
    expect(tel).toBe('tel:5551234567');
    expect(mail.startsWith('mailto:test@example.com')).toBe(true);
    expect(mail.includes('subject=')).toBe(true);
    expect(mail.includes('body=')).toBe(true);
  });

  test('sms payloadı SMSTO formatında döner', () => {
    const service = new QrGenerationService();
    const sms = service.buildContactPayload('sms', {
      smsNumber: '5551234',
      smsBody: 'Merhaba',
    });
    expect(sms).toBe('SMSTO:5551234:Merhaba');
  });

  test('EAN13 barkod doğrulaması uzunluk, sayısallık ve checksum kontrolü yapar', () => {
    const service = new QrGenerationService();
    const ok13 = service.validateBarcodeContent('EAN13', '1234567890128');
    const ok12 = service.validateBarcodeContent('EAN13', '123456789012');
    const nonNumeric = service.validateBarcodeContent('EAN13', '123ABC');
    const wrongLength = service.validateBarcodeContent('EAN13', '123456');
    const wrongChecksum = service.validateBarcodeContent('EAN13', '1234567890129');
    expect(ok13.ok).toBe(true);
    expect(ok12.ok).toBe(true);
    expect(ok12.value.length).toBe(13);
    expect(nonNumeric.ok).toBe(false);
    expect(wrongLength.ok).toBe(false);
    expect(wrongChecksum.ok).toBe(false);
  });

  test('tüm barkod formatları için geçerli içerik kabul edilir', () => {
    const service = new QrGenerationService();
    const samples = {
      CODE128: 'ABC123',
      CODE39: 'CODE39-123',
      CODE128A: 'ABC',
      CODE128B: 'Abc123',
      CODE128C: '123456',
      EAN13: '1234567890128',
      EAN8: '55123457',
      EAN5: '12345',
      EAN2: '12',
      UPC: '123456789012',
      UPCE: '123456',
      ITF14: '12345678901234',
      ITF: '123456',
      MSI: '123456',
      MSI10: '123456',
      MSI11: '123456',
      MSI1010: '123456',
      MSI1110: '123456',
      pharmacode: '123',
      codabar: 'A1234B',
    };

    BARCODE_FORMATS.forEach((fmt) => {
      const sample = samples[fmt.k];
      expect(sample).toBeDefined();
      const result = service.validateBarcodeContent(fmt.k, sample);
      expect(result.ok).toBe(true);
      expect(result.value).toBeDefined();
    });
  });

  test('CODE128A barkod doğrulaması küçük harfleri ve geçersiz karakterleri reddeder', () => {
    const service = new QrGenerationService();
    const ok = service.validateBarcodeContent('CODE128A', 'ABC123');
    const lower = service.validateBarcodeContent('CODE128A', 'Abc123');
    const invalid = service.validateBarcodeContent('CODE128A', 'ABC{');
    expect(ok.ok).toBe(true);
    expect(lower.ok).toBe(false);
    expect(lower.reason).toBe('charset');
    expect(invalid.ok).toBe(false);
    expect(invalid.reason).toBe('charset');
  });

  test('CODE128B barkod doğrulaması sadece ASCII 32-126 aralığını kabul eder', () => {
    const service = new QrGenerationService();
    const ok = service.validateBarcodeContent('CODE128B', 'Abc123');
    const invalid = service.validateBarcodeContent('CODE128B', 'ABCç');
    expect(ok.ok).toBe(true);
    expect(invalid.ok).toBe(false);
    expect(invalid.reason).toBe('charset');
  });

  test('pharmacode barkod doğrulaması aralık dışı değerleri reddeder', () => {
    const service = new QrGenerationService();
    const tooLow = service.validateBarcodeContent('pharmacode', '2');
    const tooHigh = service.validateBarcodeContent('pharmacode', '131071');
    const nonNumeric = service.validateBarcodeContent('pharmacode', '12A');
    expect(tooLow.ok).toBe(false);
    expect(tooLow.reason).toBe('range');
    expect(tooHigh.ok).toBe(false);
    expect(tooHigh.reason).toBe('range');
    expect(nonNumeric.ok).toBe(false);
    expect(nonNumeric.reason).toBe('non_numeric');
  });

  test('payloadLength fonksiyonu metin uzunluğunu döner', () => {
    const service = new QrGenerationService();
    expect(service.payloadLength('12345')).toBe(5);
    expect(service.payloadLength('')).toBe(0);
  });
});

describe('CreateQrStateManager', () => {
  test('state patch fonksiyonları shallow merge yapar', () => {
    const uiState = { input: '', generating: false };
    const wifiConfig = { ssid: 'a', password: 'b' };
    const contactInfo = { phone: '', email: '' };
    const qrSettings = { type: 'url', symbolType: 'qr' };
    const unlockState = { unlockedModes: {} };

    const setUiState = jest.fn((fn) => fn(uiState));
    const setWifiConfig = jest.fn((fn) => fn(wifiConfig));
    const setContactInfo = jest.fn((fn) => fn(contactInfo));
    const setQrSettings = jest.fn((fn) => fn(qrSettings));
    const setUnlockState = jest.fn((fn) => fn(unlockState));

    const manager = new CreateQrStateManager({
      setUiState,
      setWifiConfig,
      setContactInfo,
      setQrSettings,
      setUnlockState,
    });

    manager.updateUi({ generating: true });
    manager.updateWifi({ ssid: 'test' });
    manager.updateContact({ phone: '123' });
    manager.updateQr({ type: 'text' });
    manager.updateUnlock({ unlockedModes: { logo: true } });

    expect(setUiState).toHaveBeenCalledWith(expect.any(Function));
    expect(setWifiConfig).toHaveBeenCalledWith(expect.any(Function));
    expect(setContactInfo).toHaveBeenCalledWith(expect.any(Function));
    expect(setQrSettings).toHaveBeenCalledWith(expect.any(Function));
    expect(setUnlockState).toHaveBeenCalledWith(expect.any(Function));
  });
});
