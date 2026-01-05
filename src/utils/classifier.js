import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkRisk } from './riskcheck';

// Configuration
const SUS_KEYWORDS = [
  'login', 'verify', 'free', 'gift', 'claim', 'freegift', 'update', 
  'wallet', 'signin', 'bank', 'confirm', 'secure', 'account', 
  'password', 'bonus', 'promo', 'win', 'offer', 'credit', 'prize',
  'urgent', 'suspended', 'locked', 'unusual', 'activity'
];

const LOW_TRUST_TLDS = [
  'xyz', 'top', 'click', 'work', 'info', 'zip', 'country', 
  'tk', 'ga', 'ml', 'gq', 'biz', 'kim', 'loan', 'club', 
  'date', 'men', 'online', 'site', 'website'
];

const SHORTENER_DOMAINS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 
  'is.gd', 'buff.ly', 'rebrand.ly', 's.id', 'cutt.ly'
];

const BRAND_DOMAINS = {
  paypal: 'paypal.com',
  facebook: 'facebook.com',
  instagram: 'instagram.com',
  google: 'google.com',
  gmail: 'google.com',
  apple: 'apple.com',
  microsoft: 'microsoft.com',
  outlook: 'outlook.com',
  amazon: 'amazon.com',
  netflix: 'netflix.com',
  twitter: 'twitter.com',
  whatsapp: 'whatsapp.com',
  linkedin: 'linkedin.com'
};

// Common multi-part TLDs for better base domain detection
const MULTI_PART_TLDS = [
  'co.uk', 'co.jp', 'com.tr', 'com.br', 'com.au', 'co.za',
  'co.in', 'com.mx', 'co.nz', 'com.ar', 'co.id', 'com.sg'
];

const SCORE_WEIGHTS = {
  http: 2,
  homoglyph: 2,
  userinfo: 3,
  ipHost: 3,
  keyword: 1,
  tld: 1,
  shortener: 2,
  port: 1,
  pathEntropy: 2,
  brandMismatch: 3,
  executable: 3
};

// Score thresholds
const THRESHOLDS = {
  unsafe: 4,
  suspicious: 2
};

// Executable file extensions and safe hosts (official sources)
const EXECUTABLE_EXTS = /\.(apk|exe|msi|dmg|pkg|deb|rpm|appx|ipa)(?:[?#]|$)/i;
const SAFE_EXECUTABLE_HOSTS = [
  'play.google.com',
  'dl.google.com'
];

// ------------------------
// Utility Functions
// ------------------------

function sanitizeInput(raw) {
  return String(raw || '')
    .replace(/^\uFEFF/, '') // Remove BOM
    .replace(/^[\u200B\u200C\u200D\u2060\u202A-\u202E]+/, '') // Leading zero-width / directional marks
    .replace(/[\u200B\u200C\u200D\u2060]/g, '') // Remove zero-width chars inside
    .trim();
}

function isIPv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every(n => {
    const num = parseInt(n, 10);
    return num >= 0 && num <= 255;
  });
}

function isIPv6(host) {
  return host.includes(':') && /^[0-9a-fA-F:]+$/.test(host);
}

function getBaseDomain(host) {
  const parts = host.split('.');
  if (parts.length <= 2) return host;

  // Check for multi-part TLDs
  for (const tld of MULTI_PART_TLDS) {
    if (host.endsWith('.' + tld)) {
      const tldParts = tld.split('.');
      const domainParts = tldParts.length + 1;
      if (parts.length >= domainParts) {
        return parts.slice(-domainParts).join('.');
      }
    }
  }

  // Default: last two parts
  return parts.slice(-2).join('.');
}

function normalizeHost(host) {
  const lower = host.toLowerCase();
  return lower.startsWith('www.') ? lower.slice(4) : lower;
}

// (Blacklist functionality removed)

// ------------------------
// Classification Logic
// ------------------------

async function classifyURL(urlString, u) {
  const host = u.hostname || '';
  const path = (u.pathname || '') + (u.search || '') + (u.hash || '');
  const lowerAll = (host + path).toLowerCase();
  
  const reasons = [];
  let score = 0;

  

  // 2. HTTP vs HTTPS
  if (u.protocol === 'http:') {
    reasons.push('classifier.httpWarning');
    score += SCORE_WEIGHTS.http;
  }

  // 3. Homoglyph / IDN detection
  const hasNonAscii = /[^\x00-\x7F]/.test(host) || host.includes('xn--');
  if (hasNonAscii) {
    reasons.push('classifier.homoglyphWarning');
    score += SCORE_WEIGHTS.homoglyph;
  }

  // 4. Userinfo (@) in URL
  if (u.username || u.password) {
    reasons.push('classifier.userinfoWarning');
    score += SCORE_WEIGHTS.userinfo;
  }

  // 5. IP address as host
  if (isIPv4(host) || isIPv6(host)) {
    reasons.push('classifier.ipHostWarning');
    score += SCORE_WEIGHTS.ipHost;
  }

  // 6. Suspicious keywords
  const foundKeywords = SUS_KEYWORDS.filter(k => lowerAll.includes(k));
  if (foundKeywords.length > 0) {
    reasons.push('classifier.keywordWarning');
    score += SCORE_WEIGHTS.keyword * Math.min(foundKeywords.length, 3);
  }

  // 7. Low trust TLD, excessive subdomains, or long domain
  const parts = host.split('.');
  const tld = parts[parts.length - 1] || '';
  const subCount = parts.length - 2;
  
  if (LOW_TRUST_TLDS.includes(tld)) {
    reasons.push('classifier.tldWarning');
    score += SCORE_WEIGHTS.tld;
  }
  
  if (host.length > 40 || subCount > 4) {
    if (!reasons.includes('classifier.tldWarning')) {
      reasons.push('classifier.tldWarning');
    }
    score += SCORE_WEIGHTS.tld;
  }

  // 8. URL shortener domains
  if (SHORTENER_DOMAINS.some(d => host === d || host.endsWith('.' + d))) {
    reasons.push('classifier.shortenerWarning');
    score += SCORE_WEIGHTS.shortener;
  }

  // 9. Unusual port
  if (u.port && !['', '80', '443'].includes(u.port)) {
    reasons.push('classifier.portWarning');
    score += SCORE_WEIGHTS.port;
  }

  // 10. Path entropy / suspicious encoding
  const encodedChars = (path.match(/%[0-9A-Fa-f]{2}/g) || []).length;
  const nonWords = (path.match(/[^A-Za-z0-9_\/.\-?=&]/g) || []).length;
  
  // Limit regex check to prevent ReDoS
  const pathSample = path.slice(0, 300);
  const hasLongBase64 = /[A-Za-z0-9+\/=]{40}/.test(pathSample);
  
  if (path.length > 90 && (encodedChars > 10 || nonWords > 25 || hasLongBase64)) {
    reasons.push('classifier.pathEntropyWarning');
    score += SCORE_WEIGHTS.pathEntropy;
  }

  // Executable download detection (.apk, .exe, etc.)
  if (EXECUTABLE_EXTS.test(path)) {
    const normalizedHost = normalizeHost(host);
    const isSafeHost = SAFE_EXECUTABLE_HOSTS.some(d => normalizedHost === d || normalizedHost.endsWith('.' + d));
    if (!isSafeHost) {
      reasons.push('classifier.executableWarning');
      score += SCORE_WEIGHTS.executable;
    }
  }

  // 11. Brand impersonation detection
  const normalizedHost = normalizeHost(host);
  const baseDomain = getBaseDomain(normalizedHost);
  
  for (const brand in BRAND_DOMAINS) {
    if (lowerAll.includes(brand)) {
      const expectedDomain = BRAND_DOMAINS[brand];
      const normalizedExpected = normalizeHost(expectedDomain);
      
      // Check if host is exactly the brand domain or a valid subdomain
      const isValidDomain = baseDomain === normalizedExpected || 
                           normalizedHost === normalizedExpected ||
                           normalizedHost.endsWith('.' + normalizedExpected);
      
      if (!isValidDomain) {
        reasons.push('classifier.brandMismatchWarning');
        score += SCORE_WEIGHTS.brandMismatch;
        break; // Only warn once
      }
    }
  }

  // Remote API risk check
  try {
    const rc = await checkRisk(urlString);
    if (rc && rc.isRisky) {
      reasons.push('classifier.blacklistWarning');
      if (score < THRESHOLDS.unsafe) score = THRESHOLDS.unsafe;
    }
  } catch {}

  // Determine threat level
  let level = 'secure';
  if (score >= THRESHOLDS.unsafe) {
    level = 'unsafe';
  } else if (score >= THRESHOLDS.suspicious) {
    level = 'suspicious';
  }

  return { level, reasons, score };
}

// classifyText temporarily disabled (txt-based search off)
// function classifyText(text) {
//   const reasons = [];
//   let score = 0;
//   const lowerText = text.toLowerCase();
//   const foundKeywords = SUS_KEYWORDS.filter(k => lowerText.includes(k));
//   if (foundKeywords.length > 0) {
//     reasons.push('classifier.keywordWarning');
//     score += foundKeywords.length;
//   }
//   const level = score >= 3 ? 'unsafe' : score >= 1 ? 'suspicious' : 'secure';
//   return { level, reasons, score };
// }

// ------------------------
// Public API
// ------------------------

/**
 * Synchronous classification (may miss blacklist on first calls)
 * Use classifyInputAsync for guaranteed blacklist checking
 */
export function classifyInput(input, scannedType = null) {
  let normalized = sanitizeInput(input);
  const pre = normalized.toLowerCase();

  const isBarcode = scannedType && ['ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code93', 'code128', 'codabar', 'itf', 'rss14', 'pdf417', 'aztec', 'datamatrix'].includes(scannedType);

  // Try standard WiFi format first
  const w = parseWifi(normalized);
  if (w) return w;

  const te = pre.startsWith('tel:') ? parseTel(normalized) : null;
  if (te) return te;
  const ma = pre.startsWith('mailto:') ? parseMailto(normalized) : null;
  if (ma) return ma;
  const plainEmail = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(normalized) ? normalized : null;
  if (plainEmail) {
    const addr = plainEmail;
    const nrm = `mailto:${encodeURIComponent(addr)}`;
    return { type: 'email', normalized: nrm, isUrl: false, email: { to: addr, subject: '', body: '' }, level: 'secure', reasons: [], score: 0 };
  }
  const mm = parseMatmsg(normalized);
  if (mm) return mm;
  const sm = parseSms(normalized);
  if (sm) return sm;
  const ge = parseGeo(normalized);
  if (ge) return ge;
  const vc = parseVCard(normalized);
  if (vc) return vc;
  const ve = parseVEvent(normalized);
  if (ve) return ve;

  // Fallback: Some scanners (like expo-camera) may return WiFi data in alternative formats
  // Try to detect and reconstruct WiFi format from common patterns after other formats are checked
  const wifiFallback = tryParseWifiFallback(normalized);
  if (wifiFallback) {
    console.log('[classifyInput] WiFi detected via fallback:', wifiFallback);
    return wifiFallback;
  }

  const phoneLike = !isBarcode && /^[+()\-\s0-9]{6,}$/.test(normalized) && /[0-9]{6,}/.test(normalized);
  if (phoneLike) {
    const num = normalized.replace(/\s+/g, '');
    return { type: 'tel', normalized: `tel:${num}`, isUrl: false, tel: { number: num } };
  }

  // If it is a known barcode type and not a URL structure, treat as plain text
  if (isBarcode && !/^https?:\/\//i.test(normalized) && !normalized.includes('.')) {
    return { normalized, isUrl: false, type: 'text', level: 'secure', reasons: [], score: 0 };
  }
  
  try {
    // Add scheme if missing for parsing
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'http://' + normalized;
    }
    
    const u = new URL(normalized);
    normalized = u.toString();
    
    // For sync version, check blacklist if available but don't wait
    const host = u.hostname || '';
    const path = (u.pathname || '') + (u.search || '') + (u.hash || '');
    const lowerAll = (host + path).toLowerCase();
    
    const reasons = [];
    let score = 0;
    
    
    
    // Run other checks synchronously
    if (u.protocol === 'http:') {
      reasons.push('classifier.httpWarning');
      score += SCORE_WEIGHTS.http;
    }
    
    const hasNonAscii = /[^\x00-\x7F]/.test(host) || host.includes('xn--');
    if (hasNonAscii) {
      reasons.push('classifier.homoglyphWarning');
      score += SCORE_WEIGHTS.homoglyph;
    }
    
    if (u.username || u.password) {
      reasons.push('classifier.userinfoWarning');
      score += SCORE_WEIGHTS.userinfo;
    }
    
    if (isIPv4(host) || isIPv6(host)) {
      reasons.push('classifier.ipHostWarning');
      score += SCORE_WEIGHTS.ipHost;
    }
    
    const foundKeywords = SUS_KEYWORDS.filter(k => lowerAll.includes(k));
    if (foundKeywords.length > 0) {
      reasons.push('classifier.keywordWarning');
      score += SCORE_WEIGHTS.keyword * Math.min(foundKeywords.length, 3);
    }
    
    const parts = host.split('.');
    const tld = parts[parts.length - 1] || '';
    const subCount = parts.length - 2;
    
    if (LOW_TRUST_TLDS.includes(tld) || host.length > 40 || subCount > 4) {
      reasons.push('classifier.tldWarning');
      score += SCORE_WEIGHTS.tld;
    }
    
    if (SHORTENER_DOMAINS.some(d => host === d || host.endsWith('.' + d))) {
      reasons.push('classifier.shortenerWarning');
      score += SCORE_WEIGHTS.shortener;
    }
    
    if (u.port && !['', '80', '443'].includes(u.port)) {
      reasons.push('classifier.portWarning');
      score += SCORE_WEIGHTS.port;
    }
    
    const encodedChars = (path.match(/%[0-9A-Fa-f]{2}/g) || []).length;
    const nonWords = (path.match(/[^A-Za-z0-9_\/.\-?=&]/g) || []).length;
    const pathSample = path.slice(0, 300);
    const hasLongBase64 = /[A-Za-z0-9+\/=]{40}/.test(pathSample);
    
    if (path.length > 90 && (encodedChars > 10 || nonWords > 25 || hasLongBase64)) {
      reasons.push('classifier.pathEntropyWarning');
      score += SCORE_WEIGHTS.pathEntropy;
    }

    // Executable download detection (.apk, .exe, etc.)
    if (EXECUTABLE_EXTS.test(path)) {
      const normalizedHost = normalizeHost(host);
      const isSafeHost = SAFE_EXECUTABLE_HOSTS.some(d => normalizedHost === d || normalizedHost.endsWith('.' + d));
      if (!isSafeHost) {
        reasons.push('classifier.executableWarning');
        score += SCORE_WEIGHTS.executable;
      }
    }
    
    const normalizedHost = normalizeHost(host);
    const baseDomain = getBaseDomain(normalizedHost);
    
    for (const brand in BRAND_DOMAINS) {
      if (lowerAll.includes(brand)) {
        const expectedDomain = BRAND_DOMAINS[brand];
        const normalizedExpected = normalizeHost(expectedDomain);
        
        const isValidDomain = baseDomain === normalizedExpected || 
                             normalizedHost === normalizedExpected ||
                             normalizedHost.endsWith('.' + normalizedExpected);
        
        if (!isValidDomain) {
          reasons.push('classifier.brandMismatchWarning');
          score += SCORE_WEIGHTS.brandMismatch;
          break;
        }
      }
    }
    
    let level = 'secure';
    if (score >= THRESHOLDS.unsafe) {
      level = 'unsafe';
    } else if (score >= THRESHOLDS.suspicious) {
      level = 'suspicious';
    }
    
    return { normalized, isUrl: true, type: 'url', level, reasons, score };
    
  } catch (e) {
    const lowerText = normalized.toLowerCase();
    const reasons = [];
    let score = 0;
    const foundKeywords = SUS_KEYWORDS.filter(k => lowerText.includes(k));
    if (foundKeywords.length > 0) {
      reasons.push('classifier.keywordWarning');
      score += Math.min(foundKeywords.length, 3);
    }
    const level = score >= 1 ? 'suspicious' : 'secure';
    return { normalized, isUrl: false, type: 'text', level, reasons, score };
}
}

/**
 * Async classification with guaranteed blacklist checking
 * Recommended for critical security checks
 */
export async function classifyInputAsync(input, scannedType = null) {
  let normalized = sanitizeInput(input);
  const pre = normalized.toLowerCase();

  const isBarcode = scannedType && ['ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code93', 'code128', 'codabar', 'itf', 'rss14', 'pdf417', 'aztec', 'datamatrix'].includes(scannedType);

  const w = parseWifi(normalized);
  if (w) return w;
  const te = pre.startsWith('tel:') ? parseTel(normalized) : null;
  if (te) return te;
  const ma = pre.startsWith('mailto:') ? parseMailto(normalized) : null;
  if (ma) return ma;
  const plainEmail = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(normalized) ? normalized : null;
  if (plainEmail) {
    const addr = plainEmail;
    const nrm = `mailto:${encodeURIComponent(addr)}`;
    return { type: 'email', normalized: nrm, isUrl: false, email: { to: addr, subject: '', body: '' }, level: 'secure', reasons: [], score: 0 };
  }
  const mm = parseMatmsg(normalized);
  if (mm) return mm;
  const sm = parseSms(normalized);
  if (sm) return sm;
  const ge = parseGeo(normalized);
  if (ge) return ge;
  const vc = parseVCard(normalized);
  if (vc) return vc;
  const ve = parseVEvent(normalized);
  if (ve) return ve;

  const wifiFallback = tryParseWifiFallback(normalized);
  if (wifiFallback) {
    console.log('[classifyInputAsync] WiFi detected via fallback:', wifiFallback);
    return wifiFallback;
  }

  const phoneLike = !isBarcode && /^[+()\-\s0-9]{6,}$/.test(normalized) && /[0-9]{6,}/.test(normalized);
  if (phoneLike) {
    const num = normalized.replace(/\s+/g, '');
    return { type: 'tel', normalized: `tel:${num}`, isUrl: false, tel: { number: num } };
  }

  // If it is a known barcode type and not a URL structure, treat as plain text
  if (isBarcode && !/^https?:\/\//i.test(normalized) && !normalized.includes('.')) {
    return { normalized, isUrl: false, type: 'text', level: 'secure', reasons: [], score: 0 };
  }
  
  try {
    // Add scheme if missing for parsing
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'http://' + normalized;
    }
    
    const u = new URL(normalized);
    normalized = u.toString();
    
    // Run full async classification
    const { level, reasons, score } = await classifyURL(normalized, u);
    
    return { normalized, isUrl: true, type: 'url', level, reasons, score };
    
  } catch (e) {
    const lowerText = normalized.toLowerCase();
    const reasons = [];
    let score = 0;
    const foundKeywords = SUS_KEYWORDS.filter(k => lowerText.includes(k));
    if (foundKeywords.length > 0) {
      reasons.push('classifier.keywordWarning');
      score += Math.min(foundKeywords.length, 3);
    }
    const level = score >= 1 ? 'suspicious' : 'secure';
    return { normalized, isUrl: false, type: 'text', level, reasons, score };
}
}

// ------------------------
// History Management
// ------------------------

async function saveHistory(item) {
  try {
    const raw = await AsyncStorage.getItem('scan_history');
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift(item);
    
    // Limit history to 200 items
    if (arr.length > 200) {
      arr.length = 200;
    }
    
    await AsyncStorage.setItem('scan_history', JSON.stringify(arr));
  } catch (err) {
    console.error('[Classifier] Failed to save history:', err);
  }
}

export async function getHistory() {
  try {
    const raw = await AsyncStorage.getItem('scan_history');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('[Classifier] Failed to get history:', err);
    return [];
  }
}

export async function clearHistory() {
  try {
    await AsyncStorage.removeItem('scan_history');
    return true;
  } catch (err) {
    console.error('[Classifier] Failed to clear history:', err);
    return false;
  }
}
/**
 * Fallback WiFi detection for scanners that return data without WIFI: prefix
 * Some barcode scanners (like expo-camera) may parse WiFi QR and return just SSID/password
 */
function tryParseWifiFallback(raw) {
  const s = String(raw || '').trim();
  
  // Skip if it looks like a URL, email, or other known format
  if (/^(https?:|tel:|mailto:|sms:|smsto:|geo:|BEGIN:V)/i.test(s)) return null;
  if (s.includes('@') && s.includes('.')) return null; // Looks like email
  if (/^[+\d\s()-]{7,}$/.test(s)) return null; // Looks like phone
  
  // Pattern 1: "SSID password" or "SSID\npassword" format (common in some scanners)
  // SSID typically doesn't have spaces, password follows
  const spaceMatch = s.match(/^([^\s]+)\s+(.+)$/);
  if (spaceMatch) {
    const [, possibleSsid, possiblePass] = spaceMatch;
    // Validate: SSID should look like a network name (alphanumeric, underscores, hyphens)
    if (/^[\w\-_]+$/.test(possibleSsid) && possiblePass.length >= 4) {
      console.log('[tryParseWifiFallback] Detected pattern: SSID space PASSWORD');
      const ssid = possibleSsid;
      const password = possiblePass.trim();
      const normalized = `WIFI:T:WPA;S:${ssid};P:${password};;`;
      return { 
        type: 'wifi', 
        normalized, 
        isUrl: false, 
        wifi: { ssid, password, security: 'WPA', hidden: false },
        level: 'secure',
        reasons: [],
        score: 0
      };
    }
  }
  
  // Pattern 2: Key-value pairs without WIFI: prefix (T:WPA;S:SSID;P:PASS)
  if (s.includes(';') && (s.includes('S:') || s.includes('s:'))) {
    // Try to parse as if it had WIFI: prefix
    const reconstructed = 'WIFI:' + s;
    // Use regex to extract key-value pairs
    const kvMatch = {};
    const tokens = reconstructed.replace(/^WIFI:/i, '').split(';');
    for (const tok of tokens) {
      const idx = tok.indexOf(':');
      if (idx > 0) {
        const k = tok.slice(0, idx).trim().toUpperCase();
        const v = tok.slice(idx + 1);
        if (k && !kvMatch[k]) kvMatch[k] = v;
      }
    }
    if (kvMatch.S) {
      console.log('[tryParseWifiFallback] Detected pattern: Key-value without WIFI prefix');
      const ssid = kvMatch.S;
      const password = kvMatch.P || '';
      const security = (kvMatch.T || 'WPA').toUpperCase();
      const hidden = ['true', '1', 'yes'].includes((kvMatch.H || '').toLowerCase());
      const normalized = `WIFI:T:${security};S:${ssid};P:${password};;`;
      return { 
        type: 'wifi', 
        normalized, 
        isUrl: false, 
        wifi: { ssid, password, security, hidden },
        level: 'secure',
        reasons: [],
        score: 0
      };
    }
  }
  
  return null;
}

function unescapeWifi(s) {
  return String(s || '').replace(/\\([;,:\\])/g, '$1');
}

function parseWifi(raw) {
  // Remove BOM, invisible chars, and normalize whitespace
  let s = String(raw || '')
    .replace(/^\uFEFF/, '') // Remove BOM
    .replace(/^[\x00-\x1F\x7F-\x9F]+/, '') // Remove control chars at start
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove all control chars except newlines/tabs
    .trim();
  
  console.log('[parseWifi] Raw input length:', raw?.length, 'Cleaned length:', s.length);
  console.log('[parseWifi] Input:', s, '| Starts with WIFI:', /^WIFI:/i.test(s));
  console.log('[parseWifi] First 10 char codes:', s.substring(0, 10).split('').map(c => c.charCodeAt(0)));
  
  if (!/^WIFI:/i.test(s)) return null;

  // Robust tokenization: split on unescaped ';'
  const body = s.replace(/^WIFI:/i, '');
  const tokens = [];
  let cur = '';
  let esc = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (esc) {
      cur += ch;
      esc = false;
      continue;
    }
    if (ch === '\\') {
      cur += ch;
      esc = true;
      continue;
    }
    if (ch === ';') {
      const t = cur.trim();
      if (t) tokens.push(t);
      cur = '';
      continue;
    }
    cur += ch;
  }
  const tail = cur.trim();
  if (tail) tokens.push(tail);

  const kv = {};
  for (const tok of tokens) {
    const idx = tok.indexOf(':');
    if (idx <= 0) continue;
    const k = tok.slice(0, idx).trim().toUpperCase();
    const v = tok.slice(idx + 1);
    if (!k) continue;
    if (kv[k] !== undefined) continue;
    kv[k] = v;
  }

  const ssidRaw = kv.S;
  if (ssidRaw === undefined) return null;
  const ssid = unescapeWifi(ssidRaw);
  const tVal = String(kv.T || '').trim().toUpperCase();
  const pass = unescapeWifi(kv.P ?? '');
  const hiddenVal = String(kv.H || '').trim().toLowerCase();
  const hidden = hiddenVal === 'true' || hiddenVal === '1' || hiddenVal === 'yes';

  let sec = 'WPA';
  if (tVal === 'WEP') sec = 'WEP';
  else if (tVal === 'NOPASS' || tVal === 'NO' || tVal === 'NONE' || tVal === 'OPEN') sec = 'nopass';
  else if (tVal) sec = 'WPA';

  const escapeOut = (v) => String(v || '').replace(/([\\;,:])/g, '\\$1');
  const parts = [`T:${sec}`, `S:${escapeOut(ssid)}`];
  if (sec !== 'nopass') parts.push(`P:${escapeOut(pass)}`);
  if (hidden) parts.push('H:true');
  const normalized = 'WIFI:' + parts.join(';') + ';';

  return { type: 'wifi', normalized, isUrl: false, wifi: { ssid, password: pass, security: sec, hidden } };
}

function parseTel(raw) {
  const m = String(raw).match(/^tel:(.+)$/i);
  if (!m) return null;
  const number = m[1].trim();
  return { type: 'tel', normalized: `tel:${number}`, isUrl: false, tel: { number } };
}

function parseMailto(raw) {
  const m = String(raw).match(/^mailto:([^?]*)?(?:\?([^#]*))?$/i);
  if (!m) return null;
  const to = decodeURIComponent(m[1] || '');
  const q = (m[2] || '').split('&').filter(Boolean);
  const params = {};
  for (const kv of q) {
    const [k, v] = kv.split('=');
    if (k) params[k.toLowerCase()] = decodeURIComponent(v || '');
  }
  const subject = params.subject || '';
  const body = params.body || '';
  const normalized = `mailto:${encodeURIComponent(to)}${subject || body ? `?${[subject ? `subject=${encodeURIComponent(subject)}` : '', body ? `body=${encodeURIComponent(body)}` : ''].filter(Boolean).join('&')}` : ''}`;
  return { type: 'email', normalized, isUrl: false, email: { to, subject, body } };
}

function parseMatmsg(raw) {
  const s = String(raw);
  if (!/^MATMSG:/i.test(s)) return null;
  const get = (key) => {
    const m = s.match(new RegExp(`${key}:([^;]*)`, 'i'));
    return m ? m[1] : '';
  };
  const to = get('TO');
  const sub = get('SUB');
  const body = get('BODY');
  const normalized = `mailto:${encodeURIComponent(to)}${(sub || body) ? `?${[sub ? `subject=${encodeURIComponent(sub)}` : '', body ? `body=${encodeURIComponent(body)}` : ''].filter(Boolean).join('&')}` : ''}`;
  return { type: 'email', normalized, isUrl: false, email: { to, subject: sub, body } };
}

function buildSmsNormalized(number, body) {
  const encodedNumber = encodeURIComponent(number);
  const encodedBody = body ? `?body=${encodeURIComponent(body)}` : '';
  return `sms:${encodedNumber}${encodedBody}`;
}

function parseSms(raw) {
  const m1 = String(raw).match(/^SMSTO:([^:;]+)(?::([^;]+))?$/i);
  if (m1) {
    const number = m1[1].trim();
    const body = (m1[2] || '').trim();
    const normalized = buildSmsNormalized(number, body);
    return { type: 'sms', normalized, isUrl: false, sms: { number, body } };
  }
  const m2 = String(raw).match(/^sms:([^?]+)(?:\?body=([^#]*))?$/i);
  if (m2) {
    const number = decodeURIComponent(m2[1] || '').trim();
    const body = decodeURIComponent(m2[2] || '').trim();
    const normalized = buildSmsNormalized(number, body);
    return { type: 'sms', normalized, isUrl: false, sms: { number, body } };
  }

  // Expo barcode için: "<number>\n<body>" veya "<number> body"
  const m3 = String(raw).match(/^([+0-9()\-\s]{4,})[\r\n]+([\s\S]+)$/);
  if (m3) {
    const number = m3[1].replace(/\s+/g, '').trim();
    const body = (m3[2] || '').trim();
    if (number && body) {
      const normalized = buildSmsNormalized(number, body);
      return { type: 'sms', normalized, isUrl: false, sms: { number, body } };
    }
  }

  return null;
}

function parseGeo(raw) {
  const m = String(raw).match(/^geo:([\-0-9.]+),([\-0-9.]+)(?:\?q=([^#]*))?$/i);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  const q = decodeURIComponent(m[3] || '');
  const normalized = `geo:${lat},${lon}${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  return { type: 'geo', normalized, isUrl: false, geo: { lat, lon, query: q } };
}

function parseVCard(raw) {
  const s = String(raw);
  if (!/BEGIN:VCARD/i.test(s)) return null;
  const normalized = s.trim();
  const get = (key) => {
    const m = s.match(new RegExp(`^${key}:([^\r\n]*)`, 'im'));
    return m ? m[1].trim() : '';
  };
  const fn = get('FN') || '';
  const n = get('N') || '';
  const tel = get('TEL') || '';
  const email = get('EMAIL') || '';
  const org = get('ORG') || '';
  const title = get('TITLE') || '';
  const adr = get('ADR') || '';
  const url = get('URL') || '';
  return { type: 'vcard', normalized, isUrl: false, vcard: { fn, n, tel, email, org, title, adr, url } };
}

function parseVEvent(raw) {
  const s = String(raw);
  if (!( /BEGIN:VEVENT/i.test(s) || /BEGIN:VCALENDAR/i.test(s))) return null;
  const normalized = s.trim();
  const get = (key) => {
    const m = s.match(new RegExp(`^${key}:([^\r\n]*)`, 'im'));
    return m ? m[1].trim() : '';
  };
  const summary = get('SUMMARY') || '';
  const location = get('LOCATION') || '';
  const description = get('DESCRIPTION') || '';
  const dtstart = get('DTSTART') || '';
  const dtend = get('DTEND') || '';
  return { type: 'event', normalized, isUrl: false, event: { summary, location, description, dtstart, dtend } };
}
