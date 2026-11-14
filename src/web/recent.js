// Recent searches for this browser only. Newest stays at the top.
// Fifteen is inside the requested 10 to 20, short enough to scan.
(function () {
  const KEY = "forever-auction-recent";
  const MAX = 15;

  function load() {
    try {
      const rows = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      return [];
    }
  }

  function same(row, entry) {
    // One line per item. A later search replaces the copy from the old auction house.
    if (entry.itemId && row.itemId === entry.itemId) return true;
    const query = String(entry.query || "").trim().toLowerCase();
    return !row.itemId && String(row.query || "").trim().toLowerCase() === query;
  }

  // A repeat moves to the front. Older rows fall off after MAX.
  function remember(entry) {
    const query = String(entry.query || "").trim();
    if (!query && !entry.itemId) return load();
    const rows = load().filter((row) => !same(row, entry));
    rows.unshift({
      query,
      itemId: entry.itemId || null,
      houseId: entry.houseId || null,
      name: entry.name || null,
      p10: entry.p10 == null ? null : entry.p10,
      at: Date.now(),
    });
    const kept = rows.slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(kept));
    return kept;
  }

  function label(row) {
    if (row.itemId) return (row.name || "Item " + row.itemId) + " · #" + row.itemId;
    return row.query;
  }

  function mount(listNode, labelNode, onPick) {
    function render() {
      const rows = load();
      labelNode.hidden = rows.length === 0;
      listNode.replaceChildren();
      for (const row of rows) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label(row);
        button.addEventListener("click", () => onPick(row));
        item.append(button);
        listNode.append(item);
      }
    }
    render();
    return {
      remember(entry) { remember(entry); render(); },
      render,
    };
  }

  window.RecentSearches = { mount, remember, load };
})();
