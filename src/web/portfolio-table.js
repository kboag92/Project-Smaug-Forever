// Draws the portfolio summary and the holdings rows.
// The page owns prices and storage. This file only builds the table.
(function () {
  const summaryBody = document.querySelector("#summary-rows");
  const holdingsBody = document.querySelector("#holdings-rows");

  // Color follows the rounded tenth, so a move that prints as 0.0% stays plain.
  function shown(pct) {
    if (pct == null || !Number.isFinite(pct)) return null;
    return Math.round(pct * 1000) / 10;
  }

  function pctText(pct) {
    const value = shown(pct);
    if (value == null) return "—";
    const body = value.toFixed(1) + "%";
    return value > 0 ? "+" + body : body;
  }

  function fillPct(td, pct) {
    const value = shown(pct);
    td.className = value == null || value === 0 ? "num" : value > 0 ? "num up" : "num down";
    td.textContent = pctText(pct);
  }

  // The count is how many holdings had both days. Size is the whole list.
  function fillIndex(td, windowScore, size) {
    fillPct(td, windowScore.pct);
    if (windowScore.pct != null) {
      td.textContent = pctText(windowScore.pct) + " · " + windowScore.count + "/" + size;
    }
  }

  function fillValue(td, copper) {
    td.className = "num";
    if (copper == null) td.textContent = "—";
    else AuctionData.paintMoney(td, copper);
  }

  function readQuantity(raw) {
    const text = String(raw).trim();
    if (!/^\d+$/.test(text)) return null;
    const qty = Number(text);
    if (qty < 1 || qty > PortfolioHoldings.MAX_QTY) return null;
    return qty;
  }

  function clear() {
    summaryBody.replaceChildren();
    holdingsBody.replaceChildren();
  }

  // names is a Map of item id to { name, icon }. actions.saveQuantity and actions.remove
  // return true when the page should draw again.
  function draw(score, names, actions) {
    clear();
    const summary = document.createElement("tr");
    const held = document.createElement("td");
    held.textContent = "Held";
    summary.append(held);
    const total = document.createElement("td");
    fillValue(total, score.total);
    summary.append(total);
    for (const windowScore of [score.day1, score.day3, score.day7]) {
      const td = document.createElement("td");
      fillIndex(td, windowScore, score.size);
      summary.append(td);
    }
    summaryBody.append(summary);

    for (const row of score.items) {
      const tr = document.createElement("tr");
      const nameCell = document.createElement("td");
      const meta = names.get(row.itemId);
      nameCell.className = "item";
      // A missing name stays as the item id. The icon is optional.
      AuctionData.face(nameCell, meta && meta.icon, (meta && meta.name) || ("Item " + row.itemId));
      nameCell.addEventListener("click", () => { location.href = "index.html?item=" + row.itemId; });
      tr.append(nameCell);

      const qtyCell = document.createElement("td");
      qtyCell.className = "num";
      const input = document.createElement("input");
      input.className = "qty";
      input.type = "number";
      input.min = "1";
      input.step = "1";
      input.value = String(row.quantity);
      input.setAttribute("aria-label", "Quantity");
      input.addEventListener("change", () => {
        const qty = readQuantity(input.value);
        if (qty == null) {
          input.value = String(row.quantity);
          actions.badQuantity();
          return;
        }
        actions.saveQuantity(row.itemId, qty);
      });
      qtyCell.append(input);
      tr.append(qtyCell);

      const median = document.createElement("td");
      fillValue(median, row.current);
      tr.append(median);
      const value = document.createElement("td");
      fillValue(value, row.value);
      tr.append(value);
      for (const pct of [row.pct[1], row.pct[3], row.pct[7]]) {
        const td = document.createElement("td");
        fillPct(td, pct);
        tr.append(td);
      }

      const removeCell = document.createElement("td");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => actions.remove(row.itemId));
      removeCell.append(remove);
      tr.append(removeCell);
      holdingsBody.append(tr);
    }
  }

  window.PortfolioTable = { clear, draw };
})();
