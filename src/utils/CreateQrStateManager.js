/**
 * Create QR ekranına ait state güncellemelerini yöneten küçük bir yönetici sınıf.
 * React hook'larından gelen setState fonksiyonlarını alır ve tek sorumluluğu
 * bu state'lere tutarlı şekilde patch uygulamaktır.
 */
export default class CreateQrStateManager {
  constructor({
    setUiState,
    setWifiConfig,
    setContactInfo,
    setQrSettings,
    setUnlockState,
  }) {
    this.setUiState = setUiState;
    this.setWifiConfig = setWifiConfig;
    this.setContactInfo = setContactInfo;
    this.setQrSettings = setQrSettings;
    this.setUnlockState = setUnlockState;
  }

  updateUi(updates) {
    this.setUiState((prev) => ({
      ...prev,
      ...updates,
    }));
  }

  updateWifi(updates) {
    this.setWifiConfig((prev) => ({
      ...prev,
      ...updates,
    }));
  }

  updateContact(updates) {
    this.setContactInfo((prev) => ({
      ...prev,
      ...updates,
    }));
  }

  updateQr(updates) {
    this.setQrSettings((prev) => ({
      ...prev,
      ...updates,
    }));
  }

  updateUnlock(updates) {
    this.setUnlockState((prev) => ({
      ...prev,
      ...updates,
    }));
  }
}

