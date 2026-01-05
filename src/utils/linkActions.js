import { Alert } from 'react-native';
import * as Linking from 'expo-linking';

function normalizeInput(value) {
  if (!value) return '';
  return value.trim();
}

export function extractDomain(value) {
  const normalized = normalizeInput(value);
  if (!normalized) return '';
  let domain = normalized;
  try {
    const prefixed = normalized.startsWith('http') ? normalized : 'https://' + normalized;
    const urlObj = new URL(prefixed);
    domain = urlObj.hostname;
  } catch (e) {
    domain = normalized.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
  return domain;
}

export async function openExternalUrl(targetUrl) {
  const url = normalizeInput(targetUrl);
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch (e) {
    Alert.alert('Hata', e?.message || 'Bağlantı açılamadı.');
  }
}

export async function openVirusTotalForValue(value) {
  const domain = extractDomain(value);
  if (!domain) return;
  const vtUrl = 'https://www.virustotal.com/gui/domain/' + encodeURIComponent(domain);
  await openExternalUrl(vtUrl);
}

export async function openVirusTotalForResult(result) {
  if (!result?.normalized) return;
  await openVirusTotalForValue(result.normalized);
}
