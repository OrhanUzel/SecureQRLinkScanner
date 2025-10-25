import { classifyInput } from '../src/utils/classifier';

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
});