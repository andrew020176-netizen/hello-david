const React = require('react');
const { Alert } = require('react-native');
const WebViewModule = require('react-native-webview');

const OriginalWebView = WebViewModule.WebView;
let proposed = [];
let lastAlertSignature = '';
let cartWatchSession = 0;
let lastCartProducts = null;
let pendingRemoved = [];

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
  { test: /\bmuffins?\b/i, terms: ['muffin','muffins','choc','chocolate'] },
  { test: /\blaundry\b|\bdetergent\b/i, terms: ['laundry','detergent','liquid','wash'] },
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

function patchMatcherScript(script) {
  let out = String(script || '');
  if (!out.includes('Matching your groceries')) return out;

  out = out.replace(
    "if(r.includes('chocolate muffin'))return t.includes('muffin')&&t.includes('chocolate');",
    "if(r.includes('chocolate muffin'))return t.includes('muffin')&&(t.includes('chocolate')||/\\bchoc\\b/.test(t));"
  );
  out = out.replace(
    "if(r.includes('cheddar'))return t.includes('cheddar')&&t.includes('cheese');",
    "if(r.includes('cheddar'))return (t.includes('cheddar')||t.includes('tasty'))&&t.includes('cheese');"
  );

  const oldRank = "const ws=words(query(i)),needed=ws.length===1?1:Math.min(2,ws.length);let ranked=ps.map(p=>({p,s:score(i,p),hits:ws.filter(w=>txt(p).includes(w)).length,price:+(p.Price||999)}))";
  const newRank = "const ws=words(query(i)),needed=ws.length===1?1:Math.min(2,ws.length);const wordHit=(t,w)=>t.includes(w)||(w==='avocados'&&t.includes('avocado'))||(w==='avocado'&&t.includes('avocados'))||(w==='muffins'&&t.includes('muffin'))||(w==='muffin'&&t.includes('muffins'))||(w==='chocolate'&&(t.includes('chocolate')||/\\bchoc\\b/.test(t)))||(w==='cheddar'&&(t.includes('cheddar')||t.includes('tasty')));let ranked=ps.map(p=>({p,s:score(i,p),hits:ws.filter(w=>wordHit(txt(p),w)).length,price:+(p.Price||999)}))";
  out = out.replace(oldRank, newRank);

  return out;
}

function proposedForProduct(productId) {
  return proposed.find(p => String(p?.productId || '') === String(productId || '')) || null;
}

function showReplacement(beforeProduct, afterProduct) {
  if (!beforeProduct || !afterProduct) return;
  const beforeId = String(beforeProduct.productId || '');
  const afterId = String(afterProduct.productId || '');
  if (!beforeId || !afterId || beforeId === afterId) return;

  const original = proposedForProduct(beforeId);
  const signature = `${beforeId}>${afterId}`;
  if (signature === lastAlertSignature) return;
  lastAlertSignature = signature;

  const request = clean(original?.request) || 'Cart item';
  const before = clean(original?.productName || beforeProduct.productName) || `Woolies product ${beforeId}`;
  const after = clean(afterProduct.productName) || `Woolies product ${afterId}`;

  Alert.alert(
    'Stuff spotted your change',
    `${request}\n${before}\n→ ${after}\n\nThat replacement is the useful signal Stuff can learn from.`,
    [{ text: 'Got it' }]
  );
}

function detectDirectCartReplacement(products) {
  if (!Array.isArray(products) || !products.length) return;

  if (!Array.isArray(lastCartProducts)) {
    lastCartProducts = products;
    return;
  }

  const previousById = new Map(lastCartProducts.map(p => [String(p.productId || ''), p]));
  const currentById = new Map(products.map(p => [String(p.productId || ''), p]));
  const removed = [...previousById.entries()].filter(([id]) => id && !currentById.has(id)).map(([,p]) => p);
  const added = [...currentById.entries()].filter(([id]) => id && !previousById.has(id)).map(([,p]) => p);
  lastCartProducts = products;

  const now = Date.now();
  pendingRemoved = pendingRemoved.filter(x => now - x.at < 30000);
  for (const product of removed) pendingRemoved.push({ product, at: now });

  if (!added.length || !pendingRemoved.length) return;

  // The strongest learning signal is a simple cart swap: one product disappears,
  // then another appears shortly afterwards. It does not depend on retailer naming.
  if (added.length === 1 && pendingRemoved.length === 1) {
    const before = pendingRemoved[0].product;
    pendingRemoved = [];
    showReplacement(before, added[0]);
    return;
  }

  // If several edits happen together, use the original request only to pair them.
  const available = [...pendingRemoved];
  for (const after of added) {
    let ranked = available
      .map((entry, idx) => {
        const original = proposedForProduct(entry.product.productId);
        return { entry, idx, score: original ? candidateScore(original.request, after) : 0 };
      })
      .sort((a,b) => b.score - a.score);
    if (!ranked.length) break;
    const best = ranked[0];
    if (best.score < 40) continue;
    showReplacement(best.entry.product, after);
    const removeIndex = pendingRemoved.findIndex(x => x === best.entry);
    if (removeIndex >= 0) pendingRemoved.splice(removeIndex, 1);
    available.splice(best.idx, 1);
  }
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

  for (const change of changes) {
    showReplacement(
      { productId: change.original.productId, productName: change.original.productName },
      change.replacement
    );
  }
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
  const interval = setInterval(collect, 2000);
  window.__stuffCartWatcher = { send: collect, observer, interval };
  setTimeout(collect, 500);
})();true;
`;

if (OriginalWebView && !OriginalWebView.__stuffLearningWrapped) {
  const WrappedWebView = React.forwardRef((props, forwardedRef) => {
    const innerRef = React.useRef(null);
    const exposedRef = React.useRef(null);

    const setRef = React.useCallback(node => {
      innerRef.current = node;
      if (node) {
        exposedRef.current = new Proxy(node, {
          get(target, prop) {
            if (prop === 'injectJavaScript') return script => target.injectJavaScript(patchMatcherScript(script));
            const value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
          }
        });
      } else {
        exposedRef.current = null;
      }
      if (typeof forwardedRef === 'function') forwardedRef(exposedRef.current);
      else if (forwardedRef) forwardedRef.current = exposedRef.current;
    }, [forwardedRef]);

    const onMessage = React.useCallback(event => {
      let parsed = null;
      try { parsed = JSON.parse(event?.nativeEvent?.data || '{}'); } catch (_) {}

      if (parsed?.type === 'WOOLIES_DONE') {
        proposed = Array.isArray(parsed.remembered) ? parsed.remembered : [];
        lastAlertSignature = '';
        lastCartProducts = null;
        pendingRemoved = [];
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
        const products = parsed.products || [];
        detectDirectCartReplacement(products);
        detectChanges(products);
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
        }, 700);
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
