// Enchanting index. One row per basket, then the materials inside each basket.
// A click opens that item's chart. Prices are Alliance daily medians.
(function () {
  const statusNode = document.querySelector("#status");
  const summaryBody = document.querySelector("#summary-rows");
  const sectionsNode = document.querySelector("#sections");

  // Color follows the rounded tenth, so a move that prints as 0.0% stays plain.
  function shown(pct) {
    if (pct == null || !Number.isFinite(pct)) return null;
    return Math.round(pct * 1000) / 10;
  }

  function pctClass(pct) {
    const value = shown(pct);
    if (value == null || value === 0) return "num";
    return value > 0 ? "num up" : "num down";
  }

  function pctText(pct) {
    const value = shown(pct);
    if (value == null) return "—";
    const body = value.toFixed(1) + "%";
    return value > 0 ? "+" + body : body;
  }

  function fillPct(td, pct) {
    td.className = pctClass(pct);
    td.textContent = pctText(pct);
  }

  // The count is how many materials had a full window. Size is the whole basket.
  function fillIndex(td, windowScore, size) {
    td.className = pctClass(windowScore.pct);
    td.textContent = windowScore.pct == null ? "—" : pctText(windowScore.pct) + " · " + windowScore.count + "/" + size;
  }

  function render(scores, icons) {
    summaryBody.replaceChildren();
    sectionsNode.replaceChildren();
    for (const basket of scores) {
      const summary = document.createElement("tr");
      const name = document.createElement("td");
      const link = document.createElement("a");
      link.href = "#basket-" + basket.id;
      link.textContent = basket.name;
      name.append(link);
      summary.append(name);
      for (const windowScore of [basket.day1, basket.day3, basket.day7]) {
        const td = document.createElement("td");
        fillIndex(td, windowScore, basket.size);
        summary.append(td);
      }
      summaryBody.append(summary);

      const section = document.createElement("section");
      section.id = "basket-" + basket.id;
      const heading = document.createElement("h2");
      heading.textContent = basket.name;
      section.append(heading);
      const table = document.createElement("table");
      const head = document.createElement("thead");
      const headRow = document.createElement("tr");
      for (const label of ["Item", "Median", "1 day", "3 days", "7 days"]) {
        const th = document.createElement("th");
        th.textContent = label;
        if (label !== "Item") th.className = "num";
        headRow.append(th);
      }
      head.append(headRow);
      table.append(head);
      const body = document.createElement("tbody");
      for (const row of basket.items) {
        const tr = document.createElement("tr");
        const itemCell = document.createElement("td");
        AuctionData.face(itemCell, icons.get(row.item.itemId) || null, row.item.name);
        tr.append(itemCell);
        const price = document.createElement("td");
        price.className = "num";
        if (row.current == null) price.textContent = "—";
        else AuctionData.paintMoney(price, row.current);
        tr.append(price);
        for (const pct of [row.pct[1], row.pct[3], row.pct[7]]) {
          const td = document.createElement("td");
          fillPct(td, pct);
          tr.append(td);
        }
        tr.addEventListener("click", () => { location.href = "index.html?item=" + row.item.itemId; });
        body.append(tr);
      }
      table.append(body);
      section.append(table);
      sectionsNode.append(section);
    }
  }

  async function load() {
    if (!window.EnchantIndex) throw new Error("Enchanting rules did not load.");
    const config = window.SITE_CONFIG || {};
    const today = EnchantIndex.utcToday();
    const since = EnchantIndex.shiftUtcDay(today, -7);
    const ids = EnchantIndex.itemIds().join(",");
    const houseId = await AuctionData.houseId(config.allianceHouseId);
    const [prices, named] = await Promise.all([
      AuctionData.rows(
        "daily_prices?select=item_id,day,median_price&house_id=eq." + houseId +
        "&item_id=in.(" + ids + ")&day=gte." + since,
        1000,
      ),
      AuctionData.rows("items?select=id,icon_url&id=in.(" + ids + ")", 100),
    ]);
    const icons = new Map(named.map((row) => [row.id, row.icon_url]));
    const scores = EnchantIndex.scoreBaskets(today, prices.map((row) => ({
      itemId: row.item_id,
      day: row.day,
      median: Number(row.median_price),
    })));
    render(scores, icons);
    statusNode.textContent = "Alliance medians for " + today + " UTC. A dash means that comparison day is missing.";
  }

  load().catch((error) => {
    statusNode.textContent = error.message || "Could not load enchanting prices.";
  });
})();
