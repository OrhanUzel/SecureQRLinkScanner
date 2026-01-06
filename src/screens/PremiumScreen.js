import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import AdvancedAdCard from '../components/AdvancedAdCard';
import { Ionicons } from '@expo/vector-icons';

export default function PremiumScreen() {
  const { t } = useTranslation();
  const { dark } = useAppTheme();
  const [premium, setPremium] = useState(false);
  const [iap, setIap] = useState(null);
  const [products, setProducts] = useState([]);
  const [sub, setSub] = useState(null);
  const [offers, setOffers] = useState([]);
  const [processing, setProcessing] = useState(false);
  const SKU_SUBSCRIPTION = 'secure_qr_link_scanner';
  const SKU_LIFETIME = 'premium_lifetime';
  const purchaseUpdateRef = useRef(null);
  const purchaseErrorRef = useRef(null);
  const isIOS = Platform.OS === 'ios';

  useEffect(() => { (async () => { try { const v = await AsyncStorage.getItem('premium'); setPremium(v === 'true'); } catch {} })(); }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('react-native-iap');
        if (!mounted) return;
        setIap(mod);
        try { await mod.initConnection(); } catch {}
        try { await mod.flushFailedPurchasesCachedAsPendingAndroid?.(); } catch {}
        // Android: subs + lifetime; iOS: only lifetime
        if (!isIOS) {
          let items = [];
          try { items = await mod.fetchProducts({ skus: [SKU_SUBSCRIPTION], type: 'subs' }); } catch {}
          if (items && items.length) { setSub(items[0]); setOffers(items[0]?.subscriptionOfferDetailsAndroid || []); }
        }
        let oneTime = [];
        try { oneTime = await mod.fetchProducts({ skus: [SKU_LIFETIME], type: 'in-app' }); } catch {}
        if (oneTime && oneTime.length) setProducts(oneTime);

        purchaseUpdateRef.current = mod.purchaseUpdatedListener(async (purchase) => {
          try {
            setProcessing(false);
            try { await mod.finishTransaction({ purchase }); } catch {}
            await AsyncStorage.setItem('premium', 'true');
            setPremium(true);
          } catch {}
        });
        purchaseErrorRef.current = mod.purchaseErrorListener(() => { setProcessing(false); });
      } catch {}
    })();
    return () => {
      try { purchaseUpdateRef.current?.remove(); } catch {}
      try { purchaseErrorRef.current?.remove(); } catch {}
      try { iap?.endConnection?.(); } catch {}
      mounted = false;
    };
  }, []);

  const pickOfferToken = (basePlanId) => {
    const found = offers?.find(o => o.basePlanId === basePlanId);
    const token = found?.offerToken || found?.offerIdToken || found?.offerTokenCode;
    if (token) return token;
    const first = offers?.[0]?.offerToken || sub?.subscriptionOfferDetailsAndroid?.[0]?.offerToken;
    return first || null;
  };

  const formatOfferPrice = (basePlanId) => {
    const found = offers?.find(o => o.basePlanId === basePlanId);
    const phase = found?.pricingPhases?.pricingPhaseList?.[0];
    return phase?.formattedPrice || phase?.priceFormatted || null;
  };

  const buyMonthly = async () => {
    try {
      setProcessing(true);
      const offerToken = pickOfferToken('monthly');
      if (iap && offerToken) {
        try {
          await iap.requestPurchase({ request: { android: { skus: [SKU_SUBSCRIPTION], subscriptionOffers: [{ sku: SKU_SUBSCRIPTION, offerToken }] } }, type: 'subs' });
          return;
        } catch {}
      }
      setProcessing(false);
    } catch { setProcessing(false); }
  };

  const buyYearly = async () => {
    try {
      setProcessing(true);
      const offerToken = pickOfferToken('yearly');
      if (iap && offerToken) {
        try {
          await iap.requestPurchase({ request: { android: { skus: [SKU_SUBSCRIPTION], subscriptionOffers: [{ sku: SKU_SUBSCRIPTION, offerToken }] } }, type: 'subs' });
          return;
        } catch {}
      }
      setProcessing(false);
    } catch { setProcessing(false); }
  };

  const buyLifetime = async () => {
    try {
      setProcessing(true);
      if (iap) {
        try { await iap.requestPurchase({ request: { android: { skus: [SKU_LIFETIME] } }, type: 'in-app' }); return; } catch {}
        setProcessing(false); return;
      }
      await AsyncStorage.setItem('premium', 'true');
      setPremium(true);
      setProcessing(false);
    } catch { setProcessing(false); }
  };

  const restorePurchases = async () => {
    try {
      if (!iap) return;
      setProcessing(true);
      let purchases = [];
      try { purchases = await iap.getAvailablePurchases(); } catch {}
      const hasPremium = purchases?.some(p => p.productId === SKU_LIFETIME || p.productId === SKU_SUBSCRIPTION);
      if (hasPremium) { await AsyncStorage.setItem('premium', 'true'); setPremium(true); }
      setProcessing(false);
    } catch { setProcessing(false); }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: dark ? '#0b0f14' : '#e9edf3' }]} contentContainerStyle={{ padding: 20, paddingBottom: 24 }}>
      <View style={styles.headerRow}>
        <View style={[styles.headerIconWrap, { backgroundColor: dark ? '#1b2330' : '#eef3f9', borderColor: dark ? '#243044' : '#dbe2ea' }]}> 
          <Ionicons name="sparkles" size={20} color={dark ? '#9ecaff' : '#0066cc'} />
        </View>
        <Text style={[styles.headerTitle, { color: dark ? '#e6edf3' : '#0b1220' }]}>{t('settings.premiumTitle')}</Text>
      </View>
      <Text style={{ color: dark ? '#8b949e' : '#57606a', marginBottom: 12 }}>{t('settings.premiumDesc')}</Text>
      {!premium ? (
        <View style={{ gap: 12 }}>
          {!isIOS && (
            <>
              <TouchableOpacity style={[styles.card, { backgroundColor: dark ? '#1f1630' : '#f4f1fb', borderColor: dark ? '#3b2c52' : '#e3def8' }]} onPress={buyMonthly} activeOpacity={0.9}>
                <Text style={styles.emoji}>📅</Text>
                <View style={styles.cardTextWrap}>
                  <Text style={[styles.cardTitle, { color: dark ? '#c1b6ff' : '#6c5ce7' }]}>{t('settings.premiumMonthly')}</Text>
                  <Text style={[styles.cardSub, { color: dark ? '#8b98a5' : '#57606a' }]}>{formatOfferPrice('monthly') || ''}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.card, { backgroundColor: dark ? '#311b16' : '#fff7ed', borderColor: dark ? '#5c3a2f' : '#fed7aa' }]} onPress={buyYearly} activeOpacity={0.9}>
                <Text style={styles.emoji}>🗓️</Text>
                <View style={styles.cardTextWrap}>
                  <Text style={[styles.cardTitle, { color: dark ? '#f59e0b' : '#d97706' }]}>{t('settings.premiumYearly')}</Text>
                  <Text style={[styles.cardSub, { color: dark ? '#8b98a5' : '#57606a' }]}>{formatOfferPrice('yearly') || ''}</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={[styles.card, { backgroundColor: dark ? '#1a4d2e' : '#e8f5e9', borderColor: '#4caf50' }]} onPress={buyLifetime} activeOpacity={0.9}>
            <Text style={styles.emoji}>💎</Text>
            <View style={styles.cardTextWrap}>
              <Text style={[styles.cardTitle, { color: dark ? '#7ee787' : '#2da44e' }]}>{t('settings.premiumLifetime')}</Text>
              <Text style={[styles.cardSub, { color: dark ? '#8b98a5' : '#57606a' }]}>{products?.[0]?.displayPrice || ''}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.card, { backgroundColor: dark ? '#172031' : '#eef3f9', borderColor: dark ? '#243044' : '#dbe2ea' }]} onPress={restorePurchases} activeOpacity={0.9}>
            <Text style={styles.emoji}>🔄</Text>
            <View style={styles.cardTextWrap}>
              <Text style={[styles.cardTitle, { color: dark ? '#9ecaff' : '#0066cc' }]}>{t('settings.restorePurchases')}</Text>
              <Text style={[styles.cardSub, { color: dark ? '#8b98a5' : '#57606a' }]}></Text>
            </View>
          </TouchableOpacity>
          {processing && <Text style={{ textAlign: 'center', color: dark ? '#8b949e' : '#57606a' }}>{t('settings.processing')}</Text>}
        </View>
      ) : (
        <View style={{ marginTop: 8 }}><Text style={{ color: dark ? '#7ee787' : '#2da44e', fontWeight: '700' }}>{t('settings.premiumActive')}</Text></View>
      )}
      <View style={{ marginTop: 16 }}>
        <AdvancedAdCard placement="premium_bottom" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  headerIconWrap: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.5 },
  emoji: { fontSize: 32 },
  cardTextWrap: { flex: 1 },
  cardTitle: { fontWeight: '700', fontSize: 16 },
  cardSub: { fontSize: 12, fontWeight: '600' }
});