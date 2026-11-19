// Portfolio page. Holdings live in this browser. Prices are Alliance daily medians.
// Clicking the name opens that item's chart. Quantity and Remove stay here.
(function () {
  const statusNode = document.querySelector("#status");
  const queryNode = document.querySelector("#query");
  const quantityNode = document.querySelector("#quantity");
  const EMPTY = "Nothing held yet. Add an item and how many you have.";

  // Set when a suggestion is chosen. Cleared if the box text changes after that.
  let picked = null;
  // Last price read. Editing a quantity rescores this instead of fetching again.
  let cache = null;

  function loadedText() {
    return "Alliance medians for " + PortfolioValue.utcToday() + " UTC. A dash means that comparison day is missing.";
  }

  function readQuantity(raw) {
    const text = String(raw).trim();
    if (!/^\d+$/.test(text)) return null;
    const qty = Number(text);
    if (qty < 1 || qty > PortfolioHoldings.MAX_QTY) return null;
    return qty;
  }

  function showEmpty() {
    cache = null;
    PortfolioTable.clear();
    statusNode.textContent = EMPTY;
  }

  function render() {
    const holdings = PortfolioHoldings.load();
    if (!holdings.length || !cache) return;
    const score = PortfolioValue.scorePortfolio(PortfolioValue.utcToday(), holdings, cache.rows);
    PortfolioTable.draw(score, cache.names, {
      badQuantity() {
        statusNode.textContent = "Quantity has to be a whole number from 1 to " + PortfolioHoldings.MAX_QTY + ".";
      },
      saveQuantity(itemId, quantity) {
        PortfolioHoldings.setQuantity(itemId, quantity);
        render();
        statusNode.textContent = loadedText();
      },
      remove(itemId) {
        PortfolioHoldings.remove(itemId);
        if (!PortfolioHoldings.load().length) showEmpty();
        else render();
      },
    });
  }

  async function refresh() {
    if (!window.PortfolioValue) throw new Error("Portfolio rules did not load.");
    const holdings = PortfolioHoldings.load();
    // An empty list has nothing to price. Skip the read.
    if (!holdings.length) {
      showEmpty();
      return;
    }
    statusNode.textContent = "Loading portfolio…";
    const config = window.SITE_CONFIG || {};
    const today = PortfolioValue.utcToday();
    const since = PortfolioValue.shiftUtcDay(today, -7);
    const ids = holdings.map((row) => row.itemId).join(",");
    const houseId = await AuctionData.houseId(config.allianceHouseId);
    const [prices, named] = await Promise.all([
      AuctionData.rows(
        "daily_prices?select=item_id,day,median_price&house_id=eq." + houseId +
        "&item_id=in.(" + ids + ")&day=gte." + since,
        1000,
      ),
      AuctionData.rows("items?select=id,name,icon_url&id=in.(" + ids + ")", 100),
    ]);
    cache = {
      rows: prices.map((row) => ({ itemId: row.item_id, day: row.day, median: Number(row.median_price) })),
      names: new Map(named.map((row) => [row.id, { name: row.name, icon: row.icon_url }])),
    };
    render();
    statusNode.textContent = loadedText();
  }

  // A chosen suggestion wins. A bare number is an item id. A name must match one item.
  async function itemIdFromForm() {
    const text = queryNode.value.trim();
    if (!text) return { error: "Type an item name or id." };
    if (picked && text === picked.label) return { itemId: picked.itemId };
    if (/^\d+$/.test(text)) return { itemId: Number(text) };
    const hits = await AuctionData.search(text);
    if (hits.length === 1) return { itemId: hits[0].itemId };
    if (!hits.length) return { error: "No matching items. Try an item id, or a name that has already been stored." };
    return { error: "Pick one item from the list." };
  }

  document.querySelector("#add-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const qty = readQuantity(quantityNode.value);
    if (qty == null) {
      statusNode.textContent = "Quantity has to be a whole number from 1 to " + PortfolioHoldings.MAX_QTY + ".";
      return;
    }
    let found;
    try {
      found = await itemIdFromForm();
    } catch (error) {
      statusNode.textContent = error.message || "Search failed.";
      return;
    }
    if (found.error) {
      statusNode.textContent = found.error;
      return;
    }
    const saved = PortfolioHoldings.add(found.itemId, qty);
    if (!saved.ok) {
      statusNode.textContent = saved.reason;
      return;
    }
    queryNode.value = "";
    quantityNode.value = "1";
    picked = null;
    try {
      await refresh();
    } catch (error) {
      statusNode.textContent = error.message || "Could not load portfolio prices.";
    }
  });

  queryNode.addEventListener("input", () => {
    if (picked && queryNode.value.trim() !== picked.label) picked = null;
  });

  // Listed Alliance items only. Choosing one keeps the name in the box and the id aside.
  AuctionSuggest.attach(queryNode, {
    grow: true,
    wait: 200,
    lookup: async (text) => {
      const hits = await AuctionData.search(text);
      return hits.map((hit) => ({ itemId: hit.itemId, name: hit.name || "", icon: hit.icon }));
    },
    onPick: (item) => {
      picked = { itemId: item.itemId, label: item.name || String(item.itemId) };
      queryNode.value = picked.label;
    },
  });

  refresh().catch((error) => {
    statusNode.textContent = error.message || "Could not load portfolio prices.";
  });
})();
