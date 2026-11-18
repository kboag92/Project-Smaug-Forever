// Typeahead under an item search box. The page supplies the candidates.
// Arrow keys move, Enter chooses, and Escape or a click outside closes the list.
(function () {
  const style = document.createElement("style");
  style.textContent = [
    ".suggest { position: relative; }",
    ".suggest.grow { flex: 1; min-width: 0; }",
    ".suggest.grow input { width: 100%; box-sizing: border-box; }",
    ".suggest-list { position: absolute; z-index: 20; left: 0; top: 100%; min-width: 100%; width: max-content; max-width: 420px; margin: 4px 0 0; padding: 0; list-style: none; background: #2a2116; border: 1px solid #6b5428; max-height: 280px; overflow: auto; }",
    ".suggest-list button { width: 100%; text-align: left; background: #2a2116; color: #f3e6c8; border: 0; border-bottom: 1px solid #6b5428; font: inherit; padding: 8px 10px; display: flex; align-items: center; cursor: pointer; }",
    ".suggest-list button.on { background: #8a6a2f; color: #fff8e8; }",
    ".suggest-id { margin-left: auto; padding-left: 12px; color: #cbb892; font-size: 12px; }",
  ].join("");
  document.head.append(style);

  function attach(input, options) {
    if (!window.SuggestRank) throw new Error("Suggestion rules did not load.");
    const wrap = document.createElement("div");
    wrap.className = options.grow ? "suggest grow" : "suggest";
    input.parentNode.insertBefore(wrap, input);
    wrap.append(input);
    const list = document.createElement("ul");
    list.className = "suggest-list";
    list.hidden = true;
    wrap.append(list);

    let rows = [];
    let highlight = 0;
    let token = 0;
    let timer = 0;
    let suppress = false;

    function close() {
      list.hidden = true;
      list.replaceChildren();
      rows = [];
    }

    // A newer keystroke or a form submit drops a suggestion request that is still in flight.
    function cancel() {
      clearTimeout(timer);
      token += 1;
      close();
    }

    function choose(item) {
      suppress = true;
      cancel();
      options.onPick(item);
      suppress = false;
    }

    function mark() {
      const buttons = list.querySelectorAll("button");
      buttons.forEach((button, index) => {
        button.classList.toggle("on", index === highlight);
        if (index === highlight) button.scrollIntoView({ block: "nearest" });
      });
    }

    function paint(found) {
      rows = found;
      highlight = 0;
      list.replaceChildren();
      if (!found.length) {
        list.hidden = true;
        return;
      }
      found.forEach((item, index) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        // Keep the box focused, or the click lands after the list has closed.
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("mouseenter", () => {
          highlight = index;
          mark();
        });
        button.addEventListener("click", () => choose(item));
        AuctionData.face(button, item.icon, item.name || "Item " + item.itemId);
        const id = document.createElement("span");
        id.className = "suggest-id";
        id.textContent = "#" + item.itemId;
        button.append(id);
        li.append(button);
        list.append(li);
      });
      list.hidden = false;
      mark();
    }

    async function run() {
      const text = input.value;
      const mine = ++token;
      if (text.trim().length < 2) {
        close();
        return;
      }
      let found = [];
      try {
        found = await Promise.resolve(options.lookup(text));
      } catch {
        if (mine === token) close();
        return;
      }
      if (mine !== token) return;
      paint(window.SuggestRank.rank(found || [], text));
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(run, options.wait || 0);
    }

    input.addEventListener("input", () => {
      if (suppress) return;
      schedule();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (list.hidden || !rows.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        highlight = Math.min(highlight + 1, rows.length - 1);
        mark();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        highlight = Math.max(highlight - 1, 0);
        mark();
      } else if (event.key === "Enter") {
        event.preventDefault();
        choose(rows[highlight]);
      }
    });
    if (input.form) input.form.addEventListener("submit", cancel);
    document.addEventListener("click", (event) => {
      if (!wrap.contains(event.target)) close();
    });
  }

  window.AuctionSuggest = { attach };
})();
