// Holdings for this browser only. There is no account.
// Each row is an item id and a quantity. Names and prices are loaded on the page.
(function () {
  const KEY = "forever-auction-portfolio";
  // 100 items over 8 UTC days stays inside one 1000-row price read.
  const MAX_ITEMS = 100;
  // A million units keeps quantity times a normal median inside a safe integer.
  const MAX_QTY = 1000000;

  function clean(rows) {
    if (!Array.isArray(rows)) return [];
    const kept = [];
    const seen = new Set();
    for (const row of rows) {
      const itemId = Number(row && row.itemId);
      const quantity = Number(row && row.quantity);
      if (!Number.isInteger(itemId) || itemId <= 0) continue;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) continue;
      if (seen.has(itemId)) continue;
      seen.add(itemId);
      kept.push({ itemId, quantity });
      if (kept.length >= MAX_ITEMS) break;
    }
    return kept;
  }

  function load() {
    try {
      return clean(JSON.parse(localStorage.getItem(KEY) || "[]"));
    } catch (error) {
      return [];
    }
  }

  function save(rows) {
    const kept = clean(rows);
    localStorage.setItem(KEY, JSON.stringify(kept));
    return kept;
  }

  // Adding an item that is already held adds to its quantity instead of a second row.
  function add(itemId, quantity) {
    const id = Number(itemId);
    const qty = Number(quantity);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, reason: "Pick an item." };
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return { ok: false, reason: "Quantity has to be a whole number from 1 to " + MAX_QTY + "." };
    }
    const rows = load();
    const existing = rows.find((row) => row.itemId === id);
    if (existing) {
      if (existing.quantity + qty > MAX_QTY) {
        return { ok: false, reason: "That would be more than " + MAX_QTY + " of this item." };
      }
      existing.quantity += qty;
    } else if (rows.length >= MAX_ITEMS) {
      return { ok: false, reason: "The portfolio already holds " + MAX_ITEMS + " items." };
    } else {
      rows.push({ itemId: id, quantity: qty });
    }
    return { ok: true, holdings: save(rows) };
  }

  // Replaces the quantity. A bad number leaves the saved row alone.
  function setQuantity(itemId, quantity) {
    const rows = load();
    const existing = rows.find((row) => row.itemId === Number(itemId));
    if (!existing) return { ok: false, holdings: rows };
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return { ok: false, holdings: rows };
    existing.quantity = qty;
    return { ok: true, holdings: save(rows) };
  }

  function remove(itemId) {
    return save(load().filter((row) => row.itemId !== Number(itemId)));
  }

  window.PortfolioHoldings = { load, add, setQuantity, remove, MAX_QTY, MAX_ITEMS };
})();
