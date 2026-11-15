// The Alerts list, matching Midas: every watch, plus each fired cross.
// WATCH rows stay until x. ABOVE / BELOW rows stay until x.
// Click a row to open that item's chart. Click the heading to mark fires read.
(function () {
  let sort = { field: "time", asc: false };
  let query = "";

  function when(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function itemName(row) {
    return row.name || "Item " + row.itemId;
  }

  function typeOf(row) {
    if (row.kind === "watch") return "WATCH";
    return row.side === "below" ? "BELOW" : "ABOVE";
  }

  // Watches stay above fires unless another column is the sort.
  function compare(a, b) {
    if ((sort.field === "time" || sort.field === "kind") && a.kind !== b.kind) {
      return a.kind === "watch" ? -1 : 1;
    }
    const pick = (row) => {
      if (sort.field === "name") return itemName(row).toLowerCase();
      if (sort.field === "kind") return typeOf(row);
      const value = row[sort.field];
      return value == null ? (sort.asc ? Infinity : -Infinity) : value;
    };
    const va = pick(a);
    const vb = pick(b);
    if (va < vb) return sort.asc ? -1 : 1;
    if (va > vb) return sort.asc ? 1 : -1;
    return itemName(a).localeCompare(itemName(b));
  }

  function mount(api) {
    const badge = document.querySelector("#alert-badge");
    const count = document.querySelector("#alert-count");
    const body = document.querySelector("#alert-rows");

    function render() {
      const q = query.trim().toLowerCase();
      const all = api.rows();
      // Badge is every unread fire, even when the search box hides that row.
      const unread = all.filter((row) => row.unread).length;
      const list = all.filter((row) => {
        const name = itemName(row).toLowerCase();
        return !q || name.includes(q) || String(row.itemId).includes(q);
      }).sort(compare);
      const watching = list.filter((row) => row.kind === "watch").length;
      count.textContent = watching + " watching · " + (list.length - watching) + " fired";
      badge.hidden = unread === 0;
      badge.textContent = unread ? String(unread) : "";
      body.replaceChildren();
      if (!list.length) {
        const empty = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 6;
        cell.textContent = "No alerts yet. Click the chart to watch a P10 level.";
        empty.append(cell);
        body.append(empty);
        return;
      }
      for (const row of list) {
        const tr = document.createElement("tr");
        if (row.unread) tr.className = "unread";
        const type = typeOf(row);
        const cells = [type, itemName(row), row.price, row.last, when(row.time)];
        cells.forEach((value, index) => {
          const td = document.createElement("td");
          td.className = index === 0 ? type.toLowerCase() : "";
          if (index === 1) AuctionData.face(td, row.icon, value);
          else if (index === 2 || index === 3) {
            if (value == null) td.textContent = "—";
            else AuctionData.paintMoney(td, value);
          } else td.textContent = value;
          tr.append(td);
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "x";
        remove.textContent = "x";
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          if (row.kind === "watch") api.removeWatch(row.id);
          else api.dismiss(row.id);
          api.redraw();
          render();
        });
        const action = document.createElement("td");
        action.append(remove);
        tr.append(action);
        tr.addEventListener("click", () => api.open(row));
        body.append(tr);
      }
    }

    document.querySelector("#alert-search").addEventListener("input", (event) => {
      query = event.target.value;
      render();
    });
    document.querySelector("#alert-head").addEventListener("click", (event) => {
      const field = event.target.dataset.sort;
      if (!field) return;
      if (sort.field === field) sort.asc = !sort.asc;
      else sort = { field, asc: field === "name" || field === "kind" };
      render();
    });
    // Seeing the list is what clears the unread count.
    document.querySelector("#alerts-title").addEventListener("click", () => {
      api.markRead();
      render();
    });
    return { refresh: render };
  }

  window.PriceAlertList = { mount };
})();
