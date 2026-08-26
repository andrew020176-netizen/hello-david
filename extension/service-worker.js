async function runWooliesAutomation(items) {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function overlay() {
    let box = document.getElementById('hello-david-woolies-progress');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'hello-david-woolies-progress';
    Object.assign(box.style, {
      position: 'fixed', top: '18px', right: '18px', zIndex: '2147483647',
      width: '340px', maxWidth: 'calc(100vw - 36px)', padding: '16px 18px',
      borderRadius: '16px', background: '#fff', color: '#171717',
      font: '14px/1.45 Arial, sans-serif', boxShadow: '0 12px 40px rgba(0,0,0,.22)',
      border: '1px solid #ddd'
    });
    box.innerHTML = '<strong style="font-size:16px">Hello David</strong><div id="hello-david-woolies-progress-text" style="margin-top:6px">Starting your Woolies shop…</div>';
    document.body.appendChild(box);
    return box;
  }

  function setProgress(text) {
    overlay();
    const el = document.getElementById('hello-david-woolies-progress-text');
    if (el) el.textContent = text;
  }

  function cleanQuery(name) {
    return String(name || '')
      .replace(/\b(whatever(?:'s| is)? on special|on special|cheapest|best value|value option)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function words(value) {
    const stop = new Set(['the','a','an','of','and','for','with','on','pack','packet','bag','box','carton']);
    return String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !stop.has(w));
  }

  function scoreProduct(item, product) {
    const wanted = cleanQuery(item.name).toLowerCase();
    const text = `${product.DisplayName || product.Name || ''} ${product.Brand || ''} ${product.PackageSize || ''}`.toLowerCase();
    let score = 0;
    for (const word of words(wanted)) if (text.includes(word)) score += 12;
    if (text.includes(wanted)) score += 35;

    const unit = String(item.unit || '').toLowerCase();
    const packSize = unit.match(/(?:pack|packet|box|bag)\s+of\s+(\d+)/i)?.[1];
    if (packSize && new RegExp(`\\b${packSize}\\s*(?:pack|pk|x)\\b`, 'i').test(text)) score += 35;

    const wantsSpecial = /special|sale/i.test(item.name || '') || /special|sale/i.test(unit);
    if (wantsSpecial) score += product.IsOnSpecial ? 35 : -12;

    if (product.IsAvailable === false || product.IsInStock === false) score -= 150;
    const price = Number(product.Price);
    if (/cheapest|best value/i.test(item.name || '') && Number.isFinite(price)) score += Math.max(0, 25 - price);
    return score;
  }

  async function searchProducts(item) {
    const query = cleanQuery(item.name);
    const response = await fetch('/apis/ui/Search/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/plain, */*' },
      credentials: 'same-origin',
      body: JSON.stringify({
        Filters: [],
        IsSpecial: false,
        Location: `/shop/search/products?searchTerm=${encodeURIComponent(query)}`,
        PageNumber: 1,
        PageSize: 12,
        SearchTerm: query,
        SortType: 'TraderRelevance',
        IsHideEverydayMarketProducts: false,
        IsRegisteredRewardCardPromotion: null,
        ExcludeSearchTypes: ['UntraceableVendors'],
        GpBoost: 0,
        GroupEdmVariants: false,
        EnableAdReRanking: false
      })
    });
    if (!response.ok) throw new Error(`Search failed (${response.status})`);
    const data = await response.json();
    const products = [];
    for (const group of data?.Products || []) {
      for (const product of group?.Products || []) products.push(product);
    }
    return products;
  }

  function quantityFor(item, product) {
    const wanted = Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1);
    const unit = String(item.unit || '').toLowerCase();
    if (/^(pack|packet|box|bag|carton|bottle|tin|can)/.test(unit)) return Math.max(1, Math.round(wanted));

    const productText = `${product.DisplayName || product.Name || ''} ${product.PackageSize || ''}`.toLowerCase();
    if (wanted > 1 && /roll|muffin|fillet|item|piece/.test(unit)) {
      const exactPack = new RegExp(`(?:\\b${wanted}\\s*(?:pack|pk)\\b|\\bpack\\s*of\\s*${wanted}\\b)`, 'i');
      if (exactPack.test(productText)) return 1;
    }
    return Math.max(1, Math.round(wanted));
  }

  try {
    if (!Array.isArray(items) || !items.length) {
      setProgress('There is nothing to add.');
      return;
    }

    const selected = [];
    const unmatched = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      setProgress(`Matching ${index + 1} of ${items.length}: ${item.name}`);
      const products = await searchProducts(item);
      const ranked = products
        .map(product => ({ product, score: scoreProduct(item, product) }))
        .sort((a, b) => b.score - a.score || Number(a.product.Price || 9999) - Number(b.product.Price || 9999));
      const best = ranked[0];
      if (!best || best.score < 10 || !best.product.Stockcode) {
        unmatched.push(item.name);
      } else {
        selected.push({
          item,
          product: best.product,
          quantity: quantityFor(item, best.product)
        });
      }
      await sleep(180);
    }

    let added = 0;
    let failed = 0;
    for (let i = 0; i < selected.length; i += 10) {
      const batchRows = selected.slice(i, i + 10);
      setProgress(`Adding ${Math.min(i + 10, selected.length)} of ${selected.length} matched products…`);
      const body = {
        items: batchRows.map(row => ({
          stockcode: Number(row.product.Stockcode),
          quantity: row.quantity,
          source: 'SearchResults',
          diagnostics: '0',
          searchTerm: cleanQuery(row.item.name),
          evaluateRewardPoints: false,
          offerId: null,
          profileId: null,
          priceLevel: null
        }))
      };
      const response = await fetch('/api/v3/ui/trolley/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
        credentials: 'same-origin',
        body: JSON.stringify(body)
      });
      if (response.ok) added += batchRows.length;
      else failed += batchRows.length;
      await sleep(250);
    }

    try {
      sessionStorage.setItem('helloDavid.woolies.lastRun', JSON.stringify({
        at: new Date().toISOString(),
        added,
        failed,
        unmatched,
        matched: selected.map(row => ({
          requested: row.item,
          stockcode: row.product.Stockcode,
          matched: row.product.DisplayName || row.product.Name,
          packageSize: row.product.PackageSize || '',
          price: row.product.Price,
          quantity: row.quantity
        }))
      }));
    } catch (_) {}

    if (!failed && !unmatched.length) {
      setProgress(`${added} products added. Opening your cart for review…`);
      await sleep(1200);
      location.href = '/shop/cart';
      return;
    }

    const parts = [`${added} products added.`];
    if (unmatched.length) parts.push(`Could not confidently match: ${unmatched.join(', ')}.`);
    if (failed) parts.push(`${failed} matched products failed to add.`);
    parts.push('Open your cart to review what was added.');
    setProgress(parts.join(' '));
  } catch (error) {
    console.error('Hello David Woolies automation failed', error);
    setProgress(`Could not finish the Woolies shop: ${error?.message || 'unknown error'}. Make sure you are signed in, then try again.`);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'START_WOOLIES') return;

  const items = Array.isArray(message.items) ? message.items.slice(0, 60) : [];
  if (!items.length) {
    sendResponse({ ok: false, error: 'No shopping items were supplied.' });
    return;
  }

  chrome.storage.local.set({ helloDavidPendingShop: items, helloDavidPendingAt: Date.now() }, () => {
    chrome.tabs.create({ url: 'https://www.woolworths.com.au/' }, tab => {
      if (!tab?.id) {
        sendResponse({ ok: false, error: 'Could not open Woolies.' });
        return;
      }

      const tabId = tab.id;
      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: runWooliesAutomation,
          args: [items]
        }).catch(error => console.error('Hello David executeScript failed', error));
      };
      chrome.tabs.onUpdated.addListener(listener);
      sendResponse({ ok: true });
    });
  });

  return true;
});
