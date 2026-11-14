// Price watches for the local graph. Stored in this browser only.
// A cross matches Midas: previous P10 on one side, the new scan on the other.
(function () {
  const KEY = "forever-auction-alerts";
  const MAX_WATCH = 40;
  const MAX_EVENT = 80;

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "");
      return { nextId: raw.nextId || 1, watches: raw.watches || [], events: raw.events || [] };
    } catch (error) {
      return { nextId: 1, watches: [], events: [] };
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  // Below then at-or-above is "above". The other way is "below". Zero is a real price.
  function crossSide(prev, level, now) {
    if (level <= 0 || prev == null || now == null) return null;
    if (prev < level && now >= level) return "above";
    if (prev > level && now <= level) return "below";
    return null;
  }

  function addWatch(item, copper, lastP10, seenAt) {
    const state = load();
    copper = Math.round(Number(copper));
    if (!item || !(copper > 0)) return { ok: false, reason: "Pick a price above zero." };
    const same = (watch) => watch.itemId === item.itemId && watch.houseId === item.houseId && Math.abs(watch.price - copper) < 1;
    const dup = state.watches.some(same);
    if (dup) return { ok: false, reason: "Already watching that price." };
    while (state.watches.length >= MAX_WATCH) state.watches.shift();
    const watch = {
      id: state.nextId++,
      itemId: item.itemId,
      houseId: item.houseId,
      name: item.name || "",
      price: copper,
      // Snapshot so the price already on the chart does not fire immediately.
      last: Number.isFinite(Number(lastP10)) ? Number(lastP10) : null,
      seenAt: seenAt || null,
      ts: Date.now(),
    };
    state.watches.push(watch);
    save(state);
    return { ok: true, watch };
  }

  function removeWatch(id) {
    const state = load();
    state.watches = state.watches.filter((watch) => watch.id !== id);
    save(state);
  }

  function watchesFor(itemId, houseId) {
    return load().watches.filter((watch) => watch.itemId === itemId && watch.houseId === houseId);
  }

  // Same shape as Midas AlertRows: watches first, then newest fires.
  function rows() {
    const state = load();
    const list = state.watches.map((watch) => ({
      kind: "watch", id: watch.id, itemId: watch.itemId, houseId: watch.houseId,
      name: watch.name, price: watch.price, last: watch.last, time: watch.ts || 0, unread: false,
    }));
    for (let i = state.events.length - 1; i >= 0; i--) {
      const event = state.events[i];
      list.push({
        kind: "event", id: event.id, itemId: event.itemId, houseId: event.houseId,
        name: event.name, price: event.price, last: event.now, side: event.side,
        time: event.ts || 0, unread: !event.read,
      });
    }
    return list;
  }

  // Opening the list counts as read, same as opening the Midas Alerts tab.
  function markRead() {
    const state = load();
    let changed = false;
    for (const event of state.events) {
      if (!event.read) { event.read = true; changed = true; }
    }
    if (changed) save(state);
  }

  function dismiss(id) {
    const state = load();
    state.events = state.events.filter((event) => event.id !== id);
    save(state);
  }

  // One new scan. No row, or the same scan we already stored, leaves the watch alone.
  function noteScan(watchId, point) {
    const state = load();
    const watch = state.watches.find((item) => item.id === watchId);
    // No row means the item was absent. Leave the watch where it is.
    if (!watch || !point || point.p10_price == null) return null;
    if (point.scanned_at && point.scanned_at === watch.seenAt) return null;
    const nowP = point.p10_price;
    const side = crossSide(watch.last, watch.price, nowP);
    watch.last = nowP;
    watch.seenAt = point.scanned_at || null;
    let fired = null;
    if (side) {
      while (state.events.length >= MAX_EVENT) state.events.shift();
      fired = {
        id: state.nextId++,
        itemId: watch.itemId,
        houseId: watch.houseId,
        name: watch.name,
        price: watch.price,
        now: nowP,
        side,
        ts: Date.now(),
        read: false,
      };
      state.events.push(fired);
    }
    save(state);
    return fired;
  }

  function formatCopper(copper) {
    const abs = Math.abs(Number(copper));
    const gold = Math.floor(abs / 10000);
    const silver = Math.floor((abs % 10000) / 100);
    return gold + "g " + silver + "s " + (abs % 100) + "c";
  }

  function beep() {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  // Poll while the page is open. The review table is drawn by alert-list.js.
  function bind(page) {
    const list = PriceAlertList.mount({
      rows, removeWatch, dismiss, markRead, formatCopper,
      redraw: () => page.redraw(),
      open: (row) => page.open(row),
    });

    async function poll() {
      const fired = [];
      for (const watch of load().watches) {
        let point = null;
        try {
          point = await AuctionData.latest(watch.itemId, watch.houseId);
        } catch (error) {
          continue;
        }
        const event = noteScan(watch.id, point);
        if (event) fired.push(event);
      }
      // Refresh even when nothing fired, so the P10 column follows the newest scan.
      list.refresh();
      if (!fired.length) return;
      beep();
      if ("Notification" in window && Notification.permission === "granted") {
        const body = fired.map((event) => (event.name || "Item " + event.itemId) + " " + event.side).join(", ");
        new Notification("Auction alert", { body });
      }
    }

    document.querySelector("#allow").addEventListener("click", () => {
      if ("Notification" in window) Notification.requestPermission();
    });
    list.refresh();
    poll();
    setInterval(poll, 60000);
    return { renderWatches: () => list.refresh(), formatCopper };
  }

  window.PriceAlerts = { addWatch, removeWatch, watchesFor, noteScan, bind };
})();
