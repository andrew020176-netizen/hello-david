(() => {
  const ENDPOINT = "https://wfhgyunfvdyxwtggntpc.supabase.co/functions/v1/hello-david-price-compare";
  const RETAILER_KEY = "helloDavid.retailer.v1";
  const list = document.getElementById("itemsList");
  const out = document.getElementById("basketResults");
  const notice = document.querySelector(".notice");
  const heading = document.getElementById("picksHeading");
  const retailerButtons = [...document.querySelectorAll("[data-retailer]")];
  if (!list || !out) return;

  let timer = null;
  let requestId = 0;
  let retailer = localStorage.getItem(RETAILER_KEY) || "Woolworths";
  if (!['Woolworths', 'Coles'].includes(retailer)) retailer = 'Woolworths';

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

  function setRetailer(next, shouldRefresh = true) {
    retailer = ['Woolworths', 'Coles'].includes(next) ? next : 'Woolworths';
    localStorage.setItem(RETAILER_KEY, retailer);
    retailerButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.retailer === retailer));
    if (heading) heading.textContent = `Ready for ${retailer}`;
    window.dispatchEvent(new CustomEvent('hello-david-retailer-change', { detail: { retailer } }));
    if (shouldRefresh) schedule(0);
  }

  function pickCard(requested, offer) {
    const div = document.createElement("div");
    div.className = `basket-card${offer ? '' : ' pick-missing'}`;

    const request = document.createElement('div');
    request.className = 'pick-request';
    request.textContent = requested;
    div.appendChild(request);

    const top = document.createElement("div");
    top.className = "basket-top";

    const name = document.createElement("div");
    name.className = "basket-name";
    name.textContent = offer?.productName || `David will confirm this in ${retailer}`;

    if (offer?.onSpecial) {
      const badge = document.createElement('span');
      badge.className = 'pick-special';
      badge.textContent = 'SPECIAL';
      name.appendChild(badge);
    }

    const priceEl = document.createElement("div");
    priceEl.className = "basket-price";
    priceEl.textContent = offer ? money(offer.price) : "—";

    top.append(name, priceEl);
    div.appendChild(top);

    const detail = document.createElement('div');
    detail.className = 'basket-detail';
    if (offer) {
      const bits = [];
      if (offer.onSpecial && Number.isFinite(Number(offer.wasPrice)) && Number(offer.wasPrice) > Number(offer.price)) {
        bits.push(`was ${money(offer.wasPrice)}`);
      }
      if (offer.unitLabel) bits.push(String(offer.unitLabel));
      bits.push('David picked the closest sensible match');
      detail.textContent = bits.join(' · ');
    } else {
      detail.textContent = retailer === 'Woolworths'
        ? 'David will make a final match when he opens Woolworths rather than guess.'
        : 'No reliable live match yet — David will not substitute blindly.';
    }
    div.appendChild(detail);
    return div;
  }

  function renderLoading() {
    out.innerHTML = "";
    if (notice) notice.textContent = `Choosing sensible ${retailer} products and looking for specials…`;
  }

  function renderUnavailable() {
    out.innerHTML = "";
    if (notice) {
      notice.textContent = `Live ${retailer} product data is temporarily unavailable. Your shop is safe — David will not invent prices or products.`;
    }
  }

  function renderResults(result) {
    out.innerHTML = "";

    if (!result?.configured || result?.providerAvailable === false) {
      renderUnavailable();
      return;
    }

    const rows = Array.isArray(result.items) ? result.items : [];
    let matched = 0;
    let specials = 0;

    for (const row of rows) {
      const offers = Array.isArray(row?.offers) ? row.offers : [];
      const offer = offers
        .filter(o => o?.retailer === retailer)
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(a.price || 9999) - Number(b.price || 9999))[0] || null;

      if (offer) matched += 1;
      if (offer?.onSpecial) specials += 1;
      out.appendChild(pickCard(row?.item?.name || 'Item', offer));
    }

    if (!rows.length) {
      if (notice) notice.textContent = 'Add something to the shop and David will choose the product.';
      return;
    }

    if (notice) {
      const bits = [`David found ${matched}/${rows.length} reliable ${retailer} matches`];
      if (specials) bits.push(`${specials} ${specials === 1 ? 'is' : 'are'} on special`);
      if (matched < rows.length) bits.push('unmatched items will be confirmed rather than guessed');
      notice.textContent = `${bits.join(' · ')}.`;
    }
  }

  async function chooseProducts() {
    const items = readItems();
    const id = ++requestId;

    if (!items.length) {
      out.innerHTML = "";
      if (notice) notice.textContent = `Add an item and David will choose a sensible ${retailer} product.`;
      return;
    }

    renderLoading();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, retailer }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (id !== requestId) return;
      if (!response.ok || !result?.success) throw new Error(result?.error || "Product matching failed.");
      renderResults(result);
    } catch (error) {
      console.error("Hello David product matching error", error);
      if (id !== requestId) return;
      renderUnavailable();
    } finally {
      clearTimeout(timeout);
    }
  }

  function schedule(delay = 700) {
    clearTimeout(timer);
    timer = setTimeout(chooseProducts, delay);
  }

  retailerButtons.forEach(btn => btn.addEventListener('click', () => setRetailer(btn.dataset.retailer)));

  new MutationObserver(() => schedule()).observe(list, { childList: true, subtree: true });
  document.addEventListener("change", event => {
    if (event.target?.matches?.(".item-name, .item-qty")) schedule();
  });

  setRetailer(retailer, false);
  if (readItems().length) schedule(0);
})();
