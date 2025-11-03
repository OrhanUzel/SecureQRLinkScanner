import AsyncStorage from '@react-native-async-storage/async-storage';

const SUS_KEYWORDS = ['login','verify','free','gift','claim','freegift','update','wallet','signin','bank','confirm','secure','account','password','bonus','promo','win','offer','bonus','credit','prize'];
const LOW_TRUST_TLDS = ['xyz','top','click','work','info','zip','country','tk','ga','ml','gq','biz','kim','loan','club','date','men'];
const SHORTENER_DOMAINS = ['bit.ly','tinyurl.com','t.co','goo.gl','ow.ly','is.gd','buff.ly','rebrand.ly','s.id'];
const BRAND_DOMAINS = {
  paypal: 'paypal.com', facebook: 'facebook.com', instagram: 'instagram.com', google: 'google.com', gmail: 'google.com',
  apple: 'apple.com', microsoft: 'microsoft.com', outlook: 'outlook.com', amazon: 'amazon.com', netflix: 'netflix.com'
};

function isIPv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every(n => +n >= 0 && +n <= 255);
}
function isIPv6(host) { return host.includes(':'); }
function getBaseDomain(host) {
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  // naive public suffix handling for common cases
  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  if (secondLast === 'co' && (last === 'uk' || last === 'jp')) {
    return parts.slice(parts.length - 3).join('.');
  }
  return parts.slice(parts.length - 2).join('.');
}

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

    // userinfo (@) present
    if (u.username || u.password) { reasons.push('classifier.userinfoWarning'); score += 2; }

    // IP address host
    if (isIPv4(host) || isIPv6(host)) { reasons.push('classifier.ipHostWarning'); score += 2; }

    // keywords
    const lowerAll = (host + path).toLowerCase();
    if (SUS_KEYWORDS.some(k => lowerAll.includes(k))) { reasons.push('classifier.keywordWarning'); score += 1; }

    // domain trust
    const parts = host.split('.');
    const tld = parts[parts.length - 1] || '';
    const subCount = parts.length - 2; // exclude root domain and tld
    if (LOW_TRUST_TLDS.includes(tld) || host.length > 35 || subCount > 3) {
      reasons.push('classifier.tldWarning');
      score += 1;
    }

    // shortener domains
    if (SHORTENER_DOMAINS.some(d => host.endsWith(d))) { reasons.push('classifier.shortenerWarning'); score += 2; }

    // unusual port
    if (u.port && !['', '80', '443'].includes(u.port)) { reasons.push('classifier.portWarning'); score += 1; }

    // path entropy / long encoded fragments (including #?)
    const encs = (path.match(/%[0-9A-Fa-f]{2}/g) || []).length;
    // Escape '-' inside character class to avoid invalid ranges in some runtimes
    const nonWords = (path.match(/[^A-Za-z0-9_\/.\-]/g) || []).length;
    if (path.length > 90 && (encs > 10 || nonWords > 25 || /[A-Za-z0-9+/=]{40,}/.test(path))) {
      reasons.push('classifier.pathEntropyWarning'); score += 1;
    }

    // brand mismatch: keyword present but base domain not matching brand domain
    const base = getBaseDomain(host);
    for (const brand in BRAND_DOMAINS) {
      if (lowerAll.includes(brand)) {
        const expected = BRAND_DOMAINS[brand];
        if (!host.endsWith(expected)) { reasons.push('classifier.brandMismatchWarning'); score += 2; }
      }
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