(() => {
  const ENDPOINT = "https://wfhgyunfvdyxwtggntpc.supabase.co/functions/v1/hello-david-price-compare";
  const list = document.getElementById("itemsList");
  const out = document.getElementById("basketResults");
  const notice = document.querySelector(".notice");
  if (!list || !out) return;

  let timer = null;
  let requestId = 0;

  function readItems() {
    return [...document.querySelectorAll(".item-row")]
      .map(row => {
        const meta = row.querySelector(".item-meta")?.textContent || "";
        const unit = meta.split("·")[0]?.trim() || "";
        return {
          name: row.querySelector(".item-name")?.value?.trim() || "",
          quantity: Number(row.querySelector(".item-qty")?.value || 1),
          unit
        };
      })
      .filter(item => item.name);
  }

  function money(value) {
    return Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : "—";
  }

  function card(title, price, detail, best = false) {
    const div = document.createElement("div");
    div.className = `basket-card${best ? " best" : ""}`;

    const top = document.createElement("div");
    top.className = "basket-top";

    const name = document.createElement("div");
    name.className = "basket-name";
    name.textContent = title;

    const priceEl = document.createElement("div");
    priceEl.className = "basket-price";
    priceEl.textContent = price;

    const detailEl = document.createElement("div");
    detailEl.className = "basket-detail";
    detailEl.textContent = detail;

    top.append(name, priceEl);
    div.append(top, detailEl);
    return div;
  }

  function renderLoading() {
    out.innerHTML = "";
    if (notice) notice.textContent = "Finding reliable matches and live prices…";
  }

  function renderUnavailable(message = "Live retailer prices are temporarily unavailable. Your shopping list is unaffected.") {
    out.innerHTML = "";
    out.appendChild(card("Live prices unavailable", "—", "No basket total is shown until live prices can be verified."));
    if (notice) notice.textContent = message;
  }

  function renderNotConfigured() {
    out.innerHTML = "";
    out.appendChild(card("Live comparison ready", "—", "The comparison engine is connected. Live retailer access still needs to be activated."));
    if (notice) notice.textContent = "The comparison engine is ready. Live retailer data is the final connection.";
  }

  function renderResults(result) {
    out.innerHTML = "";

    if (!result?.configured) {
      renderNotConfigured();
      return;
    }

    if (result?.providerAvailable === false) {
      renderUnavailable("Live retailer data is temporarily unavailable. No stale or estimated prices are being shown.");
      return;
    }

    const itemCount = readItems().length;
    const retailers = Array.isArray(result.retailers) ? result.retailers : [];
    const complete = retailers.filter(r => !r.missing?.length && Number(r.matched) === itemCount && itemCount > 0);
    const bestComplete = complete.length
      ? complete.reduce((a, b) => Number(a.total) <= Number(b.total) ? a : b)
      : null;

    for (const retailer of retailers) {
      const missing = Array.isArray(retailer.missing) ? retailer.missing : [];
      const matched = Number(retailer.matched || 0);
      const isComplete = itemCount > 0 && matched === itemCount && missing.length === 0;
      const detail = `${matched}/${itemCount} reliable matches${missing.length ? ` · No reliable match: ${missing.join(", ")}` : ""}`;

      out.appendChild(card(
        `${retailer.retailer}${bestComplete?.retailer === retailer.retailer ? " · Best complete basket" : ""}`,
        isComplete ? money(retailer.total) : "—",
        detail,
        bestComplete?.retailer === retailer.retailer
      ));
    }

    if (result.split) {
      const split = result.split;
      const missing = Array.isArray(split.missing) ? split.missing : [];
      const selections = Array.isArray(split.selections) ? split.selections : [];
      const counts = {};

      for (const row of selections) {
        const retailer = row?.offer?.retailer || "Other";
        counts[retailer] = (counts[retailer] || 0) + 1;
      }

      const breakdown = Object.entries(counts).map(([r, n]) => `${n} from ${r}`).join(" · ") || "No reliable product matches";
      out.appendChild(card(
        "Cheapest item-by-item",
        missing.length ? "—" : money(split.total),
        `${breakdown}${missing.length ? ` · No reliable match: ${missing.join(", ")}` : ""}`
      ));
    }

    if (!retailers.length) {
      renderUnavailable();
      return;
    }

    if (notice) {
      const hasComplete = complete.length > 0;
      notice.textContent = hasComplete
        ? `Live product matching via ${result.provider || "retailer data"}. Review the chosen products before purchase.`
        : "Live prices found for some items, but no complete basket is reliable yet.";
    }
  }

  async function compare() {
    const items = readItems();
    const id = ++requestId;

    if (!items.length) {
      out.innerHTML = "";
      if (notice) notice.textContent = "Add an item and David will compare live prices.";
      return;
    }

    renderLoading();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (id !== requestId) return;
      if (!response.ok || !result?.success) throw new Error(result?.error || "Price comparison failed.");
      renderResults(result);
    } catch (error) {
      console.error("Hello David price comparison error", error);
      if (id !== requestId) return;
      renderUnavailable();
    } finally {
      clearTimeout(timeout);
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(compare, 900);
  }

  new MutationObserver(schedule).observe(list, { childList: true, subtree: true });
  document.addEventListener("change", event => {
    if (event.target?.matches?.(".item-name, .item-qty")) schedule();
  });

  if (readItems().length) schedule();
})();
