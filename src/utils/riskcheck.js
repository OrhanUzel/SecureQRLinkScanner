// Simple remote risk check utility
// Uses the provided API to verify if a URL is risky
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Use Android emulator host for native; use localhost on web
// Allow overriding base URL via env (EXPO_PUBLIC_API_BASE_URL) or expo.extra.apiBaseUrl
// Support both modern (expoConfig) and legacy (manifest) access patterns
const envBase = (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_BASE_URL)
  || (Constants?.expoConfig?.extra?.apiBaseUrl)
  || (Constants?.manifest?.extra?.apiBaseUrl);
export const BASE_URL = envBase ? String(envBase) : null;

// Dev-only logger
const log = (...args) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[riskcheck]', ...args);
  }
};

// Log resolved BASE_URL at module init in dev for easier debugging
log('BASE_URL', BASE_URL);

/**
 * @typedef {Object} RiskCheckResponse
 * @property {boolean} isRisky
 * @property {string} [message]
 * @property {string} [checkedDomain]
 * @property {string[]} [foundInFiles]
 */

export async function checkRisk(url) {
  if (!BASE_URL) {
    return {
      isRisky: false,
      message: '',
      checkedDomain: '',
      foundInFiles: [],
      error: 'missing_base_url'
    };
  }
  const hasAbort = typeof AbortController !== 'undefined';
  const controller = hasAbort ? new AbortController() : null;
  const timeoutMs = 10000;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const endpoint = `${BASE_URL}/api/riskcheck?url=${encodeURIComponent(url)}`;
  const t0 = Date.now();
  log('Request start', { platform: Platform.OS, endpoint, url });
  try {
    const res = await fetch(endpoint, controller ? { signal: controller.signal } : undefined);
    if (timeoutId) clearTimeout(timeoutId);
    const ms = Date.now() - t0;
    log('Response', { status: res.status, ms });
    if (!res.ok) {
      log('Non-OK response', { status: res.status });
      return {
        isRisky: false,
        message: '',
        checkedDomain: '',
        foundInFiles: [],
        error: `HTTP ${res.status}`,
      };
    }
    let data;
    try {
      data = await res.json();
    } catch (e) {
      log('JSON parse error', e?.message);
      data = null;
    }
    if (!data) {
      return {
        isRisky: false,
        message: '',
        checkedDomain: '',
        foundInFiles: [],
        error: 'Invalid JSON body',
      };
    }
    log('Parsed body', data);
    if (data && data.isRisky) {
      log('Risk detected', {
        domain: data.checkedDomain,
        message: data.message,
        sources: data.foundInFiles,
      });
    } else {
      log('No risk detected');
    }
    return data;
  } catch (e) {
    if (timeoutId) clearTimeout(timeoutId);
    const ms = Date.now() - t0;
    log('Fetch error', { ms, error: e?.message });
    const name = e?.name || '';
    const msg = e?.message || '';
    const isAbort = name === 'AbortError';
    const isNetworkFailed = msg.toLowerCase().includes('network request failed');
    const errorCode = isAbort
      ? 'request_timeout'
      : isNetworkFailed
      ? 'network_unreachable'
      : msg || 'Network error';
    return {
      isRisky: false,
      message: '',
      checkedDomain: '',
      foundInFiles: [],
      error: errorCode,
    };
  }
}
