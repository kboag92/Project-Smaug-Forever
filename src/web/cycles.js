// Cycles table. Liquid hides thin books. Click a row to open that item's chart.
(function () {
  const countNode = document.querySelector("#count");
  const body = document.querySelector("#rows");
  let report = { rows: [], days: 0, scanCount: 0 };
  let liquid = true;
  let query = "";
  let sort = { field: "edge", asc: false };

  function money(copper) {
    if (copper == null) return "—";
    const abs = Math.abs(Number(copper));
    const gold = Math.floor(abs / 10000);
    const silver = Math.floor((abs % 10000) / 100);
    return gold + "g " + silver + "s " + (abs % 100) + "c";
  }

  function qtyText(qty) {
    if (qty == null) return "—";
    return qty >= 10 ? String(Math.round(qty)) : qty.toFixed(1);
  }

  function nameOf(row) {
    return row.name || "Item " + row.itemId;
  }

  function compare(a, b) {
    let va = sort.field === "name" ? nameOf(a) : a[sort.field];
    let vb = sort.field === "name" ? nameOf(b) : b[sort.field];
    if (va == null) va = sort.asc ? Infinity : -Infinity;
    if (vb == null) vb = sort.asc ? Infinity : -Infinity;
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
    const list = report.rows.filter((row) => {
      if (liquid && !(row.avgQty >= 3)) return false;
      const name = nameOf(row).toLowerCase();
      return !q || name.includes(q) || String(row.itemId).includes(q);
    }).sort(compare);
    const dayLabel = report.days === 1 ? "1 day" : report.days + " days";
    countNode.textContent = list.length
      ? list.length + " daily cycles · Low = P10 scoop · High = ask · Edge after 5% cut · " + dayLabel + " of scans"
      : "No daily cycles yet. " + report.scanCount + " scans across " + dayLabel + ". A cycle needs at least 3 days, different hours, and a peak 10% above the dip.";
    body.replaceChildren();
    for (const row of list) {
      const tr = document.createElement("tr");
      const phase = row.phase === "buy" ? "BUY" : row.phase === "sell" ? "SELL" : "—";
      const cells = [
        [nameOf(row), ""],
        [row.cheap, "cheap"],
        [money(row.low), "num low"],
        [row.rich, "rich"],
        [money(row.high), "num high"],
        [money(row.edge), "num"],
        [(row.swing >= 0 ? "+" : "") + Math.round(row.swing) + "%", "num"],
        [phase, phase === "BUY" ? "buy" : phase === "SELL" ? "sell" : ""],
        [Math.round(row.conf) + "%", "num"],
        [String(row.days), "num"],
        [qtyText(row.avgQty), "num"],
      ];
      cells.forEach((cell, index) => {
        const td = document.createElement("td");
        td.textContent = cell[0];
        td.className = cell[1];
        if (index === 8) td.title = row.confMode === "same" ? "Same-day windows" : "Cross-day fallback";
        tr.append(td);
      });
      tr.addEventListener("click", () => { location.href = "index.html?item=" + row.itemId; });
      body.append(tr);
    }
  }

  document.querySelector("#search").addEventListener("input", (event) => {
    query = event.target.value;
    render();
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
    else sort = { field, asc: field === "name" || field === "cheap" || field === "rich" };
    render();
  });

  AuctionData.cycles().then((body) => {
    report = body;
    render();
  }).catch((error) => { countNode.textContent = error.message || "Could not load cycles."; });
})();
