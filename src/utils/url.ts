/** Allow relative and HTTP(S) URLs; reject executable schemes and protocol-relative URLs. */
export function safeUrl(value = ''): string | undefined {
  const url = value.trim();
  if (!url || /[\s\\\u0000-\u001f\u007f]/.test(url) || url.startsWith('//')) return;
  if (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^https?:\/\//i.test(url)) return;
  return url;
}
