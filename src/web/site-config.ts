// Public site settings for the browser.
// Pass the publishable key only. The service-role key must never be placed here.

export type PublicHouses = {
  region: string;
  rulesetId: number;
  allianceHouseId: number;
  neutralHouseId: number;
};

export function configSource(url: string, anonKey: string, houses: PublicHouses): string {
  const cleanUrl = url.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  // The browser looks houses up by these Blizzard ids. They come from the scanner config.
  const body = {
    url: cleanUrl,
    anonKey: anonKey.trim(),
    region: houses.region,
    rulesetId: houses.rulesetId,
    allianceHouseId: houses.allianceHouseId,
    neutralHouseId: houses.neutralHouseId,
  };
  return `window.SITE_CONFIG = ${JSON.stringify(body)};\n`;
}
