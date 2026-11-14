import { listingRows, type AuctionRow } from "./parse.js";

// A signed-in client-credentials token plus the region we are scanning.
export type BlizzardClient = {
  token: string;
  region: string;
  locale: string;
};

export type ItemProfile = {
  id: number;
  name: string | null;
  quality: string | null;
  item_level: number | null;
  vendor_sell_copper: number | null;
  icon_url: string | null;
  item_class: string | null;
};

type HouseIndex = {
  auctions?: { id: number; name: string }[];
};

type HouseBook = {
  auctions?: AuctionRow[];
  commodities?: AuctionRow[];
};

type ItemDocument = {
  id: number;
  name?: string;
  quality?: { type?: string };
  level?: number;
  sell_price?: number;
  item_class?: { name?: string };
};

type MediaDocument = {
  assets?: { key?: string; value?: string }[];
};

// Battle.net app token. Public auction reads use this. No player login.
export async function fetchAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://oauth.battle.net/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Battle.net token request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Battle.net token response had no access_token.");
  }
  return payload.access_token;
}

// Forever routes live on the normal regional host, with a forever namespace.
async function blizzardGet<T>(client: BlizzardClient, path: string, kind: "dynamic" | "static"): Promise<T> {
  const url = new URL(path, `https://${client.region}.api.blizzard.com`);
  url.searchParams.set("namespace", `${kind}-forever-${client.region}`);
  url.searchParams.set("locale", client.locale);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${client.token}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Blizzard HTTP ${response.status} for ${url.pathname}: ${body.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

// The index path must end in /index. The bare /auctions path is a 404 on Forever.
export async function fetchHouseIndex(
  client: BlizzardClient,
  rulesetId: number,
): Promise<{ id: number; name: string }[]> {
  const payload = await blizzardGet<HouseIndex>(
    client,
    `/data/wow/ruleset/${rulesetId}/auctions/index`,
    "dynamic",
  );
  return payload.auctions ?? [];
}

// Gear listings and stackable commodities are separate documents.
// Some house payloads also embed a commodities array, so the caller dedupes by auction id.
export async function fetchHouseBook(
  client: BlizzardClient,
  rulesetId: number,
  houseId: number,
): Promise<{ auctions: AuctionRow[]; commodities: AuctionRow[] }> {
  const housePath = `/data/wow/ruleset/${rulesetId}/auctions/${houseId}`;
  const [book, commodities] = await Promise.all([
    blizzardGet<HouseBook>(client, housePath, "dynamic"),
    blizzardGet<HouseBook>(client, `${housePath}/commodities`, "dynamic"),
  ]);

  return {
    auctions: listingRows(book.auctions ?? book),
    // A link object is ignored. The commodities document holds the real rows.
    commodities: [...listingRows(book.commodities), ...listingRows(commodities)],
  };
}

// Name, quality, vendor price, and icon for one item. Icon failure still keeps the name.
export async function fetchItemProfile(client: BlizzardClient, itemId: number): Promise<ItemProfile> {
  const item = await blizzardGet<ItemDocument>(client, `/data/wow/item/${itemId}`, "static");
  let iconUrl: string | null = null;

  try {
    const media = await blizzardGet<MediaDocument>(client, `/data/wow/media/item/${itemId}`, "static");
    iconUrl = media.assets?.find((asset) => asset.key === "icon")?.value ?? null;
  } catch (error) {
    console.error(`Icon lookup failed for item ${itemId}:`, error);
  }

  return {
    id: item.id,
    name: item.name ?? null,
    quality: item.quality?.type ?? null,
    item_level: item.level ?? null,
    vendor_sell_copper: item.sell_price ?? null,
    icon_url: iconUrl,
    item_class: item.item_class?.name ?? null,
  };
}
