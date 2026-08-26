const React = require('react');
const { Alert } = require('react-native');
const WebViewModule = require('react-native-webview');

const OriginalWebView = WebViewModule.WebView;
let proposed = [];
let lastAlertSignature = '';
let cartWatchSession = 0;

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function words(value) {
  return clean(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w && !['the','a','an','of','and','for','pack','packet','bag','box','large','small','medium','fresh','white','wholemeal','wholegrain'].includes(w));
}

const CATEGORY_RULES = [
  { test: /\bbread\b|\bloaf\b/i, terms: ['bread','loaf'] },
  { test: /\beggs?\b/i, terms: ['egg'] },
  { test: /\bmilk\b/i, terms: ['milk'] },
  { test: /\bcheese\b|\bcheddar\b/i, terms: ['cheese','cheddar','tasty'] },
  { test: /\bavocados?\b/i, terms: ['avocado','avocados'] },
  { test: /\bmuffins?\b/i, terms: ['muffin','muffins'] },
  { test: /\btomatoes?\b/i, terms: ['tomato','tomatoes'] },
  { test: /\bapples?\b/i, terms: ['apple','apples'] },
  { test: /\bbananas?\b/i, terms: ['banana','bananas'] },
  { test: /\bchicken\b/i, terms: ['chicken'] },
  { test: /\bsalmon\b/i, terms: ['salmon'] },
  { test: /\btoilet\s*paper\b/i, terms: ['toilet','paper'] },
];

function categoryTerms(request) {
  const rule = CATEGORY_RULES.find(r => r.test.test(String(request || '')));
  return rule ? rule.terms : words(request);
}

function candidateScore(request, product) {
  const hay = `${product?.productName || ''} ${product?.text || ''}`.toLowerCase();
  const terms = categoryTerms(request);
  let score = 0;
  for (const term of terms) if (hay.includes(term)) score += 40;
  for (const word of words(request)) if (hay.includes(word)) score += 8;
  return score;
}

function detectChanges(products) {
  if (!proposed.length || !Array.isArray(products) || !products.length) return;

  const currentIds = new Set(products.map(p => String(p.productId || '')));
  const proposedIds = new Set(proposed.map(p => String(p.productId || '')));
  const possibleNew = products.filter(p => !proposedIds.has(String(p.productId || '')));
  const changes = [];
  const used = new Set();

  for (const original of proposed) {
    const originalId = String(original.productId || '');
    if (originalId && currentIds.has(originalId)) continue;

    const ranked = possibleNew
      .filter(p => !used.has(String(p.productId || '')))
      .map(p => ({ p, score: candidateScore(original.request, p) }))
      .filter(x => x.score >= 40)
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) continue;
    const replacement = ranked[0].p;
    used.add(String(replacement.productId || ''));
    changes.push({ original, replacement });
  }

  if (!changes.length) return;
  const signature = changes.map(c => `${c.original.productId}>${c.replacement.productId}`).sort().join('|');
  if (!signature || signature === lastAlertSignature) return;
  lastAlertSignature = signature;

  const lines = changes.map(c => {
    const request = clean(c.original.request) || 'Item';
    const before = clean(c.original.productName) || `Woolies product ${c.original.productId}`;
    const after = clean(c.replacement.productName) || `Woolies product ${c.replacement.productId}`;
    return `${request}\n${before}\n→ ${after}`;
  });

  Alert.alert(
    'Stuff spotted your change',
    `${lines.join('\n\n')}\n\nThis is the signal Stuff can use to learn your household’s usual products.`,
    [{ text: 'Got it' }]
  );
}

const CART_WATCH_SCRIPT = `
(() => {
  if (window.__stuffCartWatcher) { window.__stuffCartWatcher.send(); return true; }
  const clean = v => String(v || '').replace(/\\s+/g, ' ').trim();
  const collect = () => {
    try {
      const found = new Map();
      const anchors = Array.from(document.querySelectorAll('a[href*="/shop/productdetails/"]'));
      for (const a of anchors) {
        const href = String(a.getAttribute('href') || '');
        const m = href.match(/\\/shop\\/productdetails\\/(\\d+)/i);
        if (!m) continue;
        const productId = m[1];
        const card = a.closest('article, li, [data-testid*="cart"], [data-testid*="trolley"], [class*="cart"], [class*="trolley"], [class*="product"]') || a.parentElement;
        const aria = clean(a.getAttribute('aria-label'));
        const linkText = clean(a.textContent);
        const text = clean(card && card.innerText);
        const productName = aria || linkText || text.slice(0, 180);
        if (!found.has(productId)) found.set(productId, { productId, productName, text: text.slice(0, 500) });
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STUFF_CART_SNAPSHOT', products: Array.from(found.values()) }));
    } catch (_) {}
  };
  let timer = null;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(collect, 450); };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  const interval = setInterval(collect, 2500);
  window.__stuffCartWatcher = { send: collect, observer, interval };
  setTimeout(collect, 600);
})();true;
`;

if (OriginalWebView && !OriginalWebView.__stuffLearningWrapped) {
  const WrappedWebView = React.forwardRef((props, forwardedRef) => {
    const innerRef = React.useRef(null);

    const setRef = React.useCallback(node => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }, [forwardedRef]);

    const onMessage = React.useCallback(event => {
      let parsed = null;
      try { parsed = JSON.parse(event?.nativeEvent?.data || '{}'); } catch (_) {}

      if (parsed?.type === 'WOOLIES_DONE') {
        proposed = Array.isArray(parsed.remembered) ? parsed.remembered : [];
        lastAlertSignature = '';
        cartWatchSession += 1;

        // Do not let the app reinforce its own first guess as a household preference.
        // A proposed product only becomes a learning signal after the user reviews the cart.
        if (props.onMessage) {
          const sanitized = { ...parsed, remembered: [] };
          props.onMessage({ ...event, nativeEvent: { ...event.nativeEvent, data: JSON.stringify(sanitized) } });
          return;
        }
      }

      if (parsed?.type === 'STUFF_CART_SNAPSHOT') {
        detectChanges(parsed.products || []);
        return;
      }

      props.onMessage && props.onMessage(event);
    }, [props.onMessage]);

    const onLoadEnd = React.useCallback(event => {
      props.onLoadEnd && props.onLoadEnd(event);
      const url = String(event?.nativeEvent?.url || props?.source?.uri || '').toLowerCase();
      if (url.includes('woolworths.com.au') && url.includes('/shop/cart')) {
        const sessionAtLoad = cartWatchSession;
        setTimeout(() => {
          if (sessionAtLoad === cartWatchSession) innerRef.current?.injectJavaScript(CART_WATCH_SCRIPT);
        }, 900);
      }
    }, [props.onLoadEnd, props?.source?.uri]);

    return React.createElement(OriginalWebView, {
      ...props,
      ref: setRef,
      onMessage,
      onLoadEnd,
    });
  });

  WrappedWebView.__stuffLearningWrapped = true;
  WebViewModule.WebView = WrappedWebView;
}
