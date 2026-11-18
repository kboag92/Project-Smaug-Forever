// Cross-sell table. Liquid hides a book with fewer than 10 units on either side.
(function () {
  const LIQUID_QTY = 10;
  const countNode = document.querySelector("#count");
  const body = document.querySelector("#rows");
  let deals = [];
  let liquid = true;
  let query = "";
  let sort = { field: "edge", asc: false };

  function directionText(row) {
    return row.direction === "alliance-neutral" ? "Alliance → Neutral" : "Neutral → Alliance";
  }

  function nameOf(row) {
    return row.name || "Item " + row.itemId;
  }

  function valueOf(row) {
    if (sort.field === "name") return nameOf(row);
    if (sort.field === "direction") return directionText(row);
    return row[sort.field];
  }

  function compare(a, b) {
    let va = valueOf(a);
    let vb = valueOf(b);
    if (typeof va === "string") {
      va = va.toLowerCase();
      vb = String(vb).toLowerCase();
    }
    if (va < vb) return sort.asc ? -1 : 1;
    if (va > vb) return sort.asc ? 1 : -1;
    return nameOf(a).localeCompare(nameOf(b));
  }

  function render() {
    const q = query.trim().toLowerCase();
    const list = deals.filter((row) => {
      if (liquid && (row.buyQty < LIQUID_QTY || row.sellQty < LIQUID_QTY)) return false;
      const name = nameOf(row).toLowerCase();
      return !q || name.includes(q) || String(row.itemId).includes(q);
    }).sort(compare);
    countNode.textContent = list.length
      ? list.length + " cross-sells · buy P10, sell the other P10, after the 5% cut"
      : "No profitable cross-sells" + (liquid ? " with 10 or more on both sides." : ".");
    body.replaceChildren();
    // These fields are copper. The coin pictures come from the shared price label.
    const moneyAt = { 2: "buy", 3: "sell", 4: "receive", 5: "edge" };
    for (const row of list) {
      const tr = document.createElement("tr");
      const cells = [
        [nameOf(row), ""],
        [directionText(row), row.direction === "alliance-neutral" ? "buy" : "sell"],
        [row.buy, "num"],
        [row.sell, "num"],
        [row.receive, "num"],
        [row.edge, "num"],
        [String(row.buyQty), "num"],
        [String(row.sellQty), "num"],
      ];
      cells.forEach((cell, index) => {
        const td = document.createElement("td");
        td.className = cell[1];
        if (index === 0) AuctionData.face(td, row.icon, cell[0]);
        else if (moneyAt[index]) {
          AuctionData.paintMoney(td, row[moneyAt[index]]);
          // Return on the buy, next to the copper profit. 164 on a 596 buy is 28%.
          if (index === 5) td.append(document.createTextNode(" " + Math.round(row.edge / row.buy * 100) + "%"));
        }
        else td.textContent = cell[0];
        tr.append(td);
      });
      tr.addEventListener("click", () => { location.href = "index.html?item=" + row.itemId; });
      body.append(tr);
    }
  }

  const searchInput = document.querySelector("#search");
  searchInput.addEventListener("input", (event) => {
    query = event.target.value;
    render();
  });
  // Names already on this page. Liquid hides a side with fewer than 10 units.
  AuctionSuggest.attach(searchInput, {
    lookup: () => deals
      .filter((row) => !liquid || (row.buyQty >= LIQUID_QTY && row.sellQty >= LIQUID_QTY))
      .map((row) => ({ itemId: row.itemId, name: nameOf(row), icon: row.icon })),
    onPick: (item) => {
      searchInput.value = item.name;
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    },
  });
  document.querySelector("#liquid").addEventListener("click", () => {
    liquid = true;
    document.querySelector("#liquid").classList.add("on");
    document.querySelector("#all").classList.remove("on");
    render();
  });
  document.querySelector("#all").addEventListener("click", () => {
    liquid = false;
    document.querySelector("#all").classList.add("on");
    document.querySelector("#liquid").classList.remove("on");
    render();
  });
  document.querySelector("thead").addEventListener("click", (event) => {
    const field = event.target.dataset.sort;
    if (!field) return;
    if (sort.field === field) sort.asc = !sort.asc;
    else sort = { field, asc: field === "name" || field === "direction" };
    render();
  });

  function book(rows) {
    return rows.map((row) => ({
      itemId: row.item_id,
      p10: Number(row.p10_price),
      quantity: Number(row.quantity),
    }));
  }

  // Latest listed row on each house. History stays in the database and is not downloaded here.
  async function load() {
    const config = window.SITE_CONFIG || {};
    const [allianceHouse, neutralHouse] = await Promise.all([
      AuctionData.houseId(config.allianceHouseId),
      AuctionData.houseId(config.neutralHouseId),
    ]);
    const listed = "latest_prices?select=item_id,p10_price,quantity&is_listed=eq.true&house_id=eq.";
    const [alliance, neutral, named] = await Promise.all([
      AuctionData.rows(listed + allianceHouse, 20000),
      AuctionData.rows(listed + neutralHouse, 20000),
      AuctionData.rows("items?select=id,name,icon_url&name=not.is.null", 5000),
    ]);
    if (!window.Arbitrage) throw new Error("Arbitrage rules did not load.");
    const names = new Map(named.filter((row) => row.name).map((row) => [row.id, { name: row.name, icon: row.icon_url }]));
    deals = window.Arbitrage.findDeals(book(alliance), book(neutral), names);
    render();
  }

  load().catch((error) => { countNode.textContent = error.message || "Could not load cross-sells."; });
})();
