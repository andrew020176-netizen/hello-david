(() => {
  const actions = document.querySelector('.voice-first-actions');
  if (!actions) return;

  const SHARED_SHOP_ENDPOINT = 'https://wfhgyunfvdyxwtggntpc.supabase.co/functions/v1/hello-david-shared-shop';
  const TOKEN_KEY = 'helloDavid.sharedShopToken.v1';
  const RETAILER_KEY = 'helloDavid.retailer.v1';
  const retailerButtons = [...document.querySelectorAll('[data-retailer]')];

  const style = document.createElement('style');
  style.textContent = `
    .technical-only { display: none !important; }
    .voice-first-actions { align-items: center; }
    .voice-primary { padding: 14px 22px; font-weight: 700; }
    .woolies-btn { background: #0b7a35; color: #fff; border-color: #0b7a35; font-weight: 700; }
    .woolies-btn:disabled { opacity: .48; cursor: default; }
    .woolies-handoff-note { margin-top: 9px; font-size: 12px; color: var(--muted); line-height: 1.4; }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'sendToWooliesBtn';
  btn.className = 'secondary-btn woolies-btn';
  actions.appendChild(btn);

  const note = document.createElement('div');
  note.className = 'woolies-handoff-note';
  actions.parentElement?.appendChild(note);

  function preferredRetailer() {
    const saved = localStorage.getItem(RETAILER_KEY);
    return saved === 'Coles' ? 'Coles' : 'Woolworths';
  }

  function setPreferredRetailer(retailer) {
    const next = retailer === 'Coles' ? 'Coles' : 'Woolworths';
    localStorage.setItem(RETAILER_KEY, next);
    retailerButtons.forEach(button => button.classList.toggle('active', button.dataset.retailer === next));
    updateRetailerUI();
    window.dispatchEvent(new CustomEvent('hello-david-retailer-change', { detail: { retailer: next } }));
  }

  function updateRetailerUI() {
    const retailer = preferredRetailer();
    const isWoolies = retailer === 'Woolworths';
    btn.disabled = !isWoolies;
    btn.textContent = isWoolies ? 'Send to Woolies' : 'Coles cart coming next';
    note.textContent = isWoolies
      ? 'David will use Woolworths itself to find and match the products when you send the shop.'
      : 'Coles will use the same flow once the direct cart connection is added.';
  }

  retailerButtons.forEach(button => {
    button.addEventListener('click', () => setPreferredRetailer(button.dataset.retailer));
  });

  function currentItems() {
    return [...document.querySelectorAll('.item-row')].map(row => {
      const name = row.querySelector('.item-name')?.value?.trim() || '';
      const qty = Number(row.querySelector('.item-qty')?.value || 1);
      const meta = row.querySelector('.item-meta')?.textContent || '';
      const unit = meta.split('·')[0]?.trim() || '';
      return { name, qty, unit };
    }).filter(item => item.name);
  }

  function inNativeApp() {
    return Boolean(window.ReactNativeWebView?.postMessage);
  }

  function helperReady() {
    return document.documentElement.dataset.helloDavidWooliesHelper === 'ready';
  }

  function validToken(value) {
    return /^[0-9a-fA-F-]{36}$/.test(String(value || ''));
  }

  async function ensureHouseholdToken(items) {
    const urlToken = new URLSearchParams(window.location.search).get('shop');
    const stored = localStorage.getItem(TOKEN_KEY);
    let token = validToken(urlToken) ? urlToken : (validToken(stored) ? stored : null);
    if (token) return token;

    const response = await fetch(SHARED_SHOP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', items })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success || !validToken(result.share_token)) {
      throw new Error(result?.error || 'Could not create household memory.');
    }

    token = result.share_token;
    localStorage.setItem(TOKEN_KEY, token);
    const url = new URL(window.location.href);
    url.searchParams.set('shop', token);
    history.replaceState({}, '', url);
    return token;
  }

  function resetButton() {
    updateRetailerUI();
  }

  window.addEventListener('hello-david-woolies-helper-ready', () => {
    if (preferredRetailer() === 'Woolworths') {
      note.textContent = 'David will use Woolworths itself to find and match the products when you send the shop.';
    }
  });

  window.addEventListener('hello-david-woolies-status', () => {
    if (preferredRetailer() !== 'Woolworths') return;
    note.textContent = document.documentElement.dataset.helloDavidWooliesStatus || '';
    if (/could not|nothing/i.test(note.textContent)) resetButton();
  });

  btn.addEventListener('click', async () => {
    if (preferredRetailer() !== 'Woolworths') return;

    const items = currentItems();
    if (!items.length) {
      note.textContent = 'Add something to the shop first.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Building Woolies cart…';
    note.textContent = 'Opening Woolworths. David will search Woolworths directly and choose each product there.';

    if (inNativeApp()) {
      let householdToken = null;
      try {
        householdToken = await ensureHouseholdToken(items);
      } catch (error) {
        console.warn('Hello David memory identity unavailable', error);
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'HELLO_DAVID_SEND_TO_WOOLIES',
        items,
        householdToken
      }));
      setTimeout(resetButton, 6000);
      return;
    }

    if (helperReady()) {
      document.documentElement.dataset.helloDavidShop = JSON.stringify(items);
      window.dispatchEvent(new Event('hello-david-send-to-woolies'));
      setTimeout(resetButton, 6000);
      return;
    }

    note.textContent = 'Open Hello David in the mobile app to send this shop straight to Woolies.';
    resetButton();
  });

  setPreferredRetailer(preferredRetailer());
})();
