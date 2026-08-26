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
    div.innerHTML = `
      <div class="basket-top">
        <div class="basket-name">${title}</div>
        <div class="basket-price">${price}</div>
      </div>
      <div class="basket-detail">${detail}</div>
    `;
    return div;
  }

  function renderNotConfigured() {
    out.innerHTML = "";
    out.appendChild(card("Live comparison ready", "—", "The Hello David comparison engine is connected. Add the retailer data API key to switch on live prices."));
    if (notice) notice.textContent = "The comparison engine is ready. Live retailer data is the final connection.";
  }

  function renderResults(result) {
    out.innerHTML = "";
    if (!result?.configured) {
      renderNotConfigured();
      return;
    }

    const retailers = Array.isArray(result.retailers) ? result.retailers : [];
    const complete = retailers.filter(r => !r.missing?.length && r.matched > 0);
    const bestComplete = complete.length
      ? complete.reduce((a, b) => Number(a.total) <= Number(b.total) ? a : b)
      : null;

    for (const retailer of retailers) {
      const missing = Array.isArray(retailer.missing) ? retailer.missing : [];
      const detail = `${retailer.matched || 0}/${readItems().length} items matched${missing.length ? ` · Missing: ${missing.join(", ")}` : ""}`;
      out.appendChild(card(
        `${retailer.retailer}${bestComplete?.retailer === retailer.retailer ? " · Best complete basket" : ""}`,
        retailer.matched ? money(retailer.total) : "—",
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
      const breakdown = Object.entries(counts).map(([r, n]) => `${n} from ${r}`).join(" · ") || "No matched products";
      out.appendChild(card(
        "Cheapest item-by-item",
        missing.length ? "Partial" : money(split.total),
        `${breakdown}${missing.length ? ` · Unmatched: ${missing.join(", ")}` : ""}`
      ));
    }

    if (notice) notice.textContent = `Live product matching via ${result.provider || "retailer data"}. You still review the chosen products before purchase.`;
  }

  async function compare() {
    const items = readItems();
    const id = ++requestId;
    if (!items.length) return;

    if (notice) notice.textContent = "Finding the best matches and prices…";
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      const result = await response.json().catch(() => ({}));
      if (id !== requestId) return;
      if (!response.ok || !result?.success) throw new Error(result?.error || "Price comparison failed.");
      renderResults(result);
    } catch (error) {
      console.error("Hello David price comparison error", error);
      if (id !== requestId) return;
      if (notice) notice.textContent = "Price comparison is temporarily unavailable. Your shopping list is unaffected.";
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
