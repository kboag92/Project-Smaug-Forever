// Reads prices in the browser with the publishable key from config.js.
// The service-role key is never sent here.
(function () {
  const PAGE = 1000;

  function site() {
    const config = window.SITE_CONFIG || {};
    if (!config.url || !config.anonKey) {
      throw new Error("Add SUPABASE_ANON_KEY. Use the publishable key, not the service role.");
    }
    return config;
  }

  async function rest(query) {
    const config = site();
    const response = await fetch(config.url + "/rest/v1/" + query, {
      headers: {
        apikey: config.anonKey,
        Authorization: "Bearer " + config.anonKey,
        Accept: "application/json",
      },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "Supabase read failed.");
    return body;
  }

  async function allRows(query, cap) {
    const rows = [];
    for (let offset = 0; offset < cap; offset += PAGE) {
      const page = await rest(query + "&limit=" + PAGE + "&offset=" + offset);
      rows.push(...page);
      if (!page.length || page.length < PAGE) break;
    }
    return rows;
  }

  function asHit(row, name) {
    return {
      itemId: row.item_id,
      houseId: row.house_id,
      name: name || null,
      p10: row.p10_price,
      median: row.median_price,
      average: row.average_price,
      quantity: row.quantity,
      isListed: row.is_listed,
    };
  }

  async function search(query) {
    const trimmed = String(query || "").trim();
    if (!trimmed) return [];
    if (/^\d+$/.test(trimmed)) {
      const prices = await rest("latest_prices?select=house_id,item_id,p10_price,median_price,average_price,quantity,is_listed&item_id=eq." + trimmed);
      const named = await rest("items?select=id,name&id=eq." + trimmed);
      const name = named[0] ? named[0].name : null;
      return prices.map((row) => asHit(row, name));
    }
    const safe = trimmed.replace(/[%_*]/g, "");
    const named = await rest("items?select=id,name&name=ilike.*" + encodeURIComponent(safe) + "*&limit=20");
    if (!named.length) return [];
    const ids = named.map((row) => row.id).join(",");
    const prices = await rest("latest_prices?select=house_id,item_id,p10_price,median_price,average_price,quantity,is_listed&item_id=in.(" + ids + ")");
    const names = new Map(named.map((row) => [row.id, row.name]));
    return prices.map((row) => asHit(row, names.get(row.item_id)));
  }

  function history(itemId, houseId) {
    return rest("scan_prices?select=scanned_at,p10_price,median_price,average_price,quantity&item_id=eq." + itemId + "&house_id=eq." + houseId + "&order=scanned_at.asc&limit=2000");
  }

  async function latest(itemId, houseId) {
    const rows = await rest("scan_prices?select=scanned_at,p10_price&item_id=eq." + itemId + "&house_id=eq." + houseId + "&order=scanned_at.desc&limit=1");
    return rows[0] || null;
  }

  // Last 21 days, then the same cycle rules as the scanner module.
  async function cycles() {
    const houses = await rest("scans?select=house_id&status=eq.success&order=scanned_at.desc&limit=1");
    if (!houses.length) return { houseId: null, scanCount: 0, days: 0, rows: [] };
    const houseId = houses[0].house_id;
    const since = new Date(Date.now() - 21 * 86400000).toISOString();
    const [raw, named] = await Promise.all([
      allRows("scan_prices?select=item_id,scanned_at,p10_price,median_price,quantity&house_id=eq." + houseId + "&scanned_at=gte." + encodeURIComponent(since) + "&order=scanned_at.asc", 120000),
      allRows("items?select=id,name&name=not.is.null", 5000),
    ]);
    const names = new Map(named.filter((row) => row.name).map((row) => [row.id, row.name]));
    const grouped = new Map();
    const days = new Set();
    for (const row of raw) {
      const at = Date.parse(row.scanned_at);
      if (!Number.isFinite(at)) continue;
      const p10 = Number(row.p10_price);
      const med = Number(row.median_price);
      const buy = p10 > 0 ? p10 : null;
      const sell = med > 0 ? med : null;
      if (buy == null && sell == null) continue;
      const day = Math.floor(at / 86400000);
      // UTC day, matching Midas floor(time / 86400). The hour is this computer's clock.
      days.add(day);
      let item = grouped.get(row.item_id);
      if (!item) {
        item = { itemId: row.item_id, name: names.get(row.item_id) || "", points: [] };
        grouped.set(row.item_id, item);
      }
      const qty = row.quantity == null ? null : Number(row.quantity);
      item.points.push({
        hour: new Date(at).getHours(),
        day,
        p10: buy,
        med: sell,
        qty: qty != null && qty >= 0 ? qty : null,
        at,
      });
    }
    if (!window.CycleScore) throw new Error("Cycle rules did not load.");
    return { houseId, scanCount: raw.length, days: days.size, rows: window.CycleScore.findCycles([...grouped.values()]) };
  }

  window.AuctionData = { search, history, latest, cycles };
})();
