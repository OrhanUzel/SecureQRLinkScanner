import { classifyInput, classifyInputAsync } from '../src/utils/classifier';

jest.mock('../src/utils/riskcheck', () => ({
  checkRisk: jest.fn(async (url) => {
    if (String(url).includes('evil.com')) {
      return { isRisky: true, checkedDomain: 'evil.com', message: 'flagged' };
    }
    return { isRisky: false };
  })
}));

describe('classifier', () => {
  test('flags http as suspicious', () => {
    const res = classifyInput('http://example.com/login');
    expect(res.isUrl).toBe(true);
    expect(res.level === 'suspicious' || res.level === 'unsafe').toBe(true);
    expect(res.reasons).toEqual(expect.arrayContaining(['classifier.httpWarning','classifier.keywordWarning']));
  });

  test('secure https simple domain', () => {
    const res = classifyInput('https://example.com');
    expect(res.level).toBe('secure');
  });

  test('low trust tld increases risk', () => {
    const res = classifyInput('https://bad.xyz/freegift');
    expect(res.level === 'suspicious' || res.level === 'unsafe').toBe(true);
    expect(res.reasons).toEqual(expect.arrayContaining(['classifier.tldWarning','classifier.keywordWarning']));
  });

  test('non-url text with suspicious keywords', () => {
    const res = classifyInput('claim your free gift now');
    expect(res.isUrl).toBe(false);
    expect(res.level).toBe('suspicious');
  });

  test('remote API risk marks URL as unsafe', async () => {
    const res = await classifyInputAsync('https://evil.com');
    expect(res.isUrl).toBe(true);
    expect(res.level).toBe('unsafe');
    expect(res.reasons).toEqual(expect.arrayContaining(['classifier.blacklistWarning']));
  });
});