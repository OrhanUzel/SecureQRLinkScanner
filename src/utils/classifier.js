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
export function classifyInput(input) {
  let normalized = input.trim();
  
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
    
    saveHistory({ content: normalized, level, reasons, score, timestamp: Date.now() });
    return { normalized, isUrl: true, level, reasons, score };
    
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
    saveHistory({ content: normalized, level, reasons, score, timestamp: Date.now() });
    return { normalized, isUrl: false, level, reasons, score };
  }
}

/**
 * Async classification with guaranteed blacklist checking
 * Recommended for critical security checks
 */
export async function classifyInputAsync(input) {
  let normalized = input.trim();
  
  try {
    // Add scheme if missing for parsing
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'http://' + normalized;
    }
    
    const u = new URL(normalized);
    normalized = u.toString();
    
    // Run full async classification
    const { level, reasons, score } = await classifyURL(normalized, u);
    
    saveHistory({ content: normalized, level, reasons, score, timestamp: Date.now() });
    return { normalized, isUrl: true, level, reasons, score };
    
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
    saveHistory({ content: normalized, level, reasons, score, timestamp: Date.now() });
    return { normalized, isUrl: false, level, reasons, score };
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