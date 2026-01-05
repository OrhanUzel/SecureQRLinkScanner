import { USOM_TYPES } from '../constants/usomTypes';

export const getUsomInfo = (typeCode, language = 'tr', description = null) => {
  if (!typeCode && !description) return { title: null, desc: null };
  
  let normalizedCode = String(typeCode || '').trim();
  let type = null;

  // Ignore generic "domain" type if we have a description to try
  if (normalizedCode.toLowerCase() === 'domain' && description) {
    normalizedCode = String(description).trim();
  } else if (normalizedCode) {
    type = USOM_TYPES[normalizedCode];
  }

  // If not found by code, try case-insensitive code match or title lookup
  if (!type && normalizedCode) {
    const entry = Object.entries(USOM_TYPES).find(([k, t]) => 
      k.toLowerCase() === normalizedCode.toLowerCase() ||
      t.tr_title === normalizedCode || 
      t.en_title === normalizedCode ||
      (t.tr_title && t.tr_title.toLowerCase() === normalizedCode.toLowerCase()) ||
      (t.en_title && t.en_title.toLowerCase() === normalizedCode.toLowerCase())
    );
    if (entry) {
      type = entry[1];
    }
  }

  // If still not found and we have a description, try looking up by description
  if (!type && description && description !== normalizedCode) {
    const descStr = String(description).trim();
    const entry = Object.entries(USOM_TYPES).find(([k, t]) => 
      k.toLowerCase() === descStr.toLowerCase() ||
      t.tr_title === descStr || 
      t.en_title === descStr ||
      (t.tr_title && t.tr_title.toLowerCase() === descStr.toLowerCase()) ||
      (t.en_title && t.en_title.toLowerCase() === descStr.toLowerCase())
    );
    if (entry) {
      type = entry[1];
    }
  }
  
  // If still not found, return the code itself as title (or description if code is missing)
  // But if the code was generic "domain" and we have a description, prefer the description
  if (!type) {
    const isGenericDomain = String(typeCode || '').trim().toLowerCase() === 'domain';
    return { 
      title: (isGenericDomain && description) ? description : (typeCode || description), 
      desc: null 
    };
  }
  
  const safeLang = language || 'tr';
  const isTr = safeLang.startsWith('tr');
  const isEs = safeLang.startsWith('es');
  const isAr = safeLang.startsWith('ar');
  
  // Default to EN if not TR/ES/AR
  const titleKey = isTr ? 'tr_title' : (isEs ? 'es_title' : (isAr ? 'ar_title' : 'en_title'));
  const descKey = isTr ? 'tr_desc' : (isEs ? 'es_desc' : (isAr ? 'ar_desc' : 'en_desc'));
  
  // Fallback to English then Turkish if specific language is missing
  const title = type[titleKey] || type.en_title || type.tr_title;
  const desc = type[descKey] || type.en_desc || type.tr_desc;

  return { title, desc };
};
