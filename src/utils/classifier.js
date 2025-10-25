import AsyncStorage from '@react-native-async-storage/async-storage';

const SUS_KEYWORDS = ['login','verify','free','gift','claim','freegift','update','wallet','signin','bank','confirm','secure','account','password','bonus','promo','win'];
const LOW_TRUST_TLDS = ['xyz','top','click','work','info','zip','country','tk','ga','ml'];

export function classifyInput(input) {
  let normalized = input.trim();
  let isUrl = false;
  try {
    // add scheme if missing for parsing
    if (!/^https?:\/\//i.test(normalized)) normalized = 'http://' + normalized;
    const u = new URL(normalized);
    isUrl = true;
    normalized = u.toString();
    const host = u.hostname || '';
    const path = (u.pathname || '') + (u.search || '') + (u.hash || '');

    const reasons = [];
    let score = 0;

    // http vs https
    if (u.protocol === 'http:') { reasons.push('classifier.httpWarning'); score += 2; }

    // homoglyph / IDN
    const hasNonAscii = /[^\x00-\x7F]/.test(host) || host.includes('xn--');
    if (hasNonAscii) { reasons.push('classifier.homoglyphWarning'); score += 1; }

    // keywords
    const lowerAll = (host + path).toLowerCase();
    if (SUS_KEYWORDS.some(k => lowerAll.includes(k))) { reasons.push('classifier.keywordWarning'); score += 1; }

    // domain trust
    const parts = host.split('.');
    const tld = parts[parts.length - 1] || '';
    const subCount = parts.length - 2; // exclude root domain and tld
    if (LOW_TRUST_TLDS.includes(tld) || host.length > 25 || subCount > 3) {
      reasons.push('classifier.tldWarning');
      score += 1;
    }

    const level = score >= 3 ? 'unsafe' : score >= 1 ? 'suspicious' : 'secure';
    saveHistory({ content: normalized, level, reasons, timestamp: Date.now() });
    return { normalized, isUrl: true, level, reasons };
  } catch (e) {
    // not a URL, classify text
    const reasons = [];
    let score = 0;
    const lowerAll = normalized.toLowerCase();
    if (SUS_KEYWORDS.some(k => lowerAll.includes(k))) { reasons.push('classifier.keywordWarning'); score += 1; }
    const level = score >= 2 ? 'unsafe' : score >= 1 ? 'suspicious' : 'secure';
    saveHistory({ content: normalized, level, reasons, timestamp: Date.now() });
    return { normalized, isUrl: false, level, reasons };
  }
}

async function saveHistory(item) {
  try {
    const raw = await AsyncStorage.getItem('scan_history');
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift(item);
    // limit history length
    if (arr.length > 200) arr.pop();
    await AsyncStorage.setItem('scan_history', JSON.stringify(arr));
  } catch {}
}