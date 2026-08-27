const React = require('react');
const WebViewModule = require('react-native-webview');

const OriginalWebView = WebViewModule.WebView;

// This runs before Woolworths' own JavaScript. It does not make a separate
// product-search request. Instead it observes the search response Woolworths
// itself receives, extracts product IDs/names, then mirrors those products into
// an off-screen DOM container that the V2 matcher can read reliably.
const NETWORK_BRIDGE = `
(() => {
  if (window.__stuffNetworkBridge) return true;
  window.__stuffNetworkBridge = true;

  const clean = v => String(v == null ? '' : v).replace(/\\s+/g, ' ').trim();
  const products = new Map();

  const idOf = o => o && (o.Stockcode ?? o.StockCode ?? o.stockcode ?? o.stockCode);
  const nameOf = o => o && (o.DisplayName ?? o.displayName ?? o.ProductName ?? o.productName ?? o.Name ?? o.name ?? o.Title ?? o.title);

  const ensureRoot = () => {
    let root = document.getElementById('__stuff_network_products');
    if (!root && document.documentElement) {
      root = document.createElement('div');
      root.id = '__stuff_network_products';
      root.setAttribute('aria-hidden', 'true');
      root.style.cssText = 'position:absolute;left:-10000px;top:0;width:2px;height:2px;overflow:hidden;opacity:0.01;pointer-events:none;';
      (document.body || document.documentElement).appendChild(root);
    }
    return root;
  };

  const render = () => {
    const root = ensureRoot();
    if (!root) return;
    for (const p of products.values()) {
      if (root.querySelector('[data-stuff-stockcode="' + p.stockcode + '"]')) continue;
      const article = document.createElement('article');
      article.setAttribute('data-testid', 'stuff-network-product');
      article.setAttribute('data-stuff-stockcode', p.stockcode);
      const a = document.createElement('a');
      a.href = '/shop/productdetails/' + p.stockcode;
      a.setAttribute('aria-label', p.name);
      a.textContent = [p.name, p.brand, p.size].filter(Boolean).join(' ');
      article.appendChild(a);
      root.appendChild(article);
    }
  };

  const add = o => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return;
    const rawId = idOf(o);
    const rawName = nameOf(o);
    if (rawId == null || rawName == null) return;
    const stockcode = String(rawId);
    const name = clean(rawName);
    if (!/^\\d+$/.test(stockcode) || name.length < 2) return;
    if (!products.has(stockcode)) {
      products.set(stockcode, {
        stockcode,
        name,
        brand: clean(o.Brand ?? o.brand),
        size: clean(o.PackageSize ?? o.packageSize ?? o.Size ?? o.size),
      });
    }
  };

  const scan = (value, depth = 0) => {
    if (value == null || depth > 8) return;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length && i < 300; i++) scan(value[i], depth + 1);
      return;
    }
    if (typeof value !== 'object') return;
    add(value);
    let count = 0;
    for (const key of Object.keys(value)) {
      if (++count > 140) break;
      scan(value[key], depth + 1);
    }
  };

  const inspectText = text => {
    if (!text || text.length > 7000000) return;
    try {
      scan(JSON.parse(text));
      render();
    } catch (_) {}
  };

  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const clone = response.clone();
        const type = String(clone.headers && clone.headers.get && clone.headers.get('content-type') || '');
        if (/json|text/i.test(type)) clone.text().then(inspectText).catch(() => {});
      } catch (_) {}
      return response;
    };
  }

  try {
    const XHR = window.XMLHttpRequest;
    if (XHR) {
      const originalSend = XHR.prototype.send;
      XHR.prototype.send = function(...args) {
        this.addEventListener('load', function() {
          try {
            const type = String(this.getResponseHeader('content-type') || '');
            if (/json|text/i.test(type) && typeof this.responseText === 'string') inspectText(this.responseText);
          } catch (_) {}
        });
        return originalSend.apply(this, args);
      };
    }
  } catch (_) {}

  const observer = new MutationObserver(() => render());
  try { observer.observe(document.documentElement, {childList:true, subtree:true}); } catch (_) {}
  setInterval(render, 750);
  true;
})();true;
`;

if (OriginalWebView && !OriginalWebView.__stuffNetworkBridgeWrapped) {
  const WrappedWebView = React.forwardRef((props, forwardedRef) => {
    const before = [
      String(props.injectedJavaScriptBeforeContentLoaded || ''),
      NETWORK_BRIDGE,
    ].filter(Boolean).join('\n');

    return React.createElement(OriginalWebView, {
      ...props,
      ref: forwardedRef,
      injectedJavaScriptBeforeContentLoaded: before,
    });
  });

  WrappedWebView.__stuffNetworkBridgeWrapped = true;
  WebViewModule.WebView = WrappedWebView;
}
