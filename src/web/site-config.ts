// Public site settings for the browser.
// Pass the publishable key only. The service-role key must never be placed here.

export function configSource(url: string, anonKey: string): string {
  const cleanUrl = url.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const body = { url: cleanUrl, anonKey: anonKey.trim() };
  return `window.SITE_CONFIG = ${JSON.stringify(body)};\n`;
}
