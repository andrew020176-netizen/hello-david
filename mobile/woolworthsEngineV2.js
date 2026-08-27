const React = require('react');
const WebViewModule = require('react-native-webview');

const OriginalWebView = WebViewModule.WebView;
const STATE_KEY = '__stuffWoolworthsV2';

function isLegacyMatcherScript(script) {
  const s = String(script || '');
  return s.includes('const items=') && s.includes('/apis/ui/Search/products') && s.includes('WOOLIES_DONE');
}

function extractItems(script) {
  const s = String(script || '');
  const start = s.indexOf('const items=');
  if (start < 0) return null;
  const jsonStart = start + 'const items='.length;
  const end = s.indexOf(',prefs=', jsonStart);
  if (end < 0) return null;
  try {
    const items = JSON.parse(s.slice(jsonStart, end));
    return Array.isArray(items) ? items : null;
  } catch (_) {
    return null;
  }
}

function startScript(items) {
  const payload = JSON.stringify({
    version: 2,
    items: (items || []).slice(0, 60),
    index: 0,
    added: 0,
    unmatched: [],
    failedNames: [],
    used: [],
    startedAt: Date.now(),
  });
  return `
(() => {
  try {
    sessionStorage.setItem('${STATE_KEY}', ${JSON.stringify(payload)});
    const items = ${JSON.stringify(items || [])};
    if (!items.length) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'WOOLIES_V2_DONE',added:0,unmatched:[],failedNames:[]}));
      return true;
    }
    const q = window.__stuffV2Query ? window.__stuffV2Query(items[0]) : String(items[0].name || '');
    location.assign('/shop/search/products?searchTerm=' + encodeURIComponent(q));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'WOOLIES_V2_FATAL',message:String(e && e.message || e)}));
  }
})();true;
`;
}

const PAGE_RUNNER = `
(async () => {
  if (window.__stuffV2Running) return true;
  window.__stuffV2Running = true;

  const KEY = '${STATE_KEY}';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const post = (type, extra={}) => {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({type, ...extra})); } catch (_) {}
  };
  const clean = v => String(v || '').replace(/\\s+/g, ' ').trim();
  const lower = v => clean(v).toLowerCase();
  const canonical = v => lower(v)
    .replace(/\\bavocadoes\\b/g, 'avocado')
    .replace(/\\bavocados\\b/g, 'avocado')
    .replace(/\\bchoc\\b/g, 'chocolate')
    .replace(/\\byogurt\\b/g, 'yoghurt')
    .replace(/\\bfillets\\b/g, 'fillet')
    .replace(/\\bmuffins\\b/g, 'muffin')
    .replace(/\\btomatoes\\b/g, 'tomato')
    .replace(/\\bbananas\\b/g, 'banana')
    .replace(/\\bapples\\b/g, 'apple');

  const requestText = item => lower(String(item?.name || '') + ' ' + String(item?.unit || ''));
  const requestQty = item => Math.max(1, Number(item?.quantity ?? item?.qty ?? 1) || 1);
  const unitText = item => lower(item?.unit || '');

  const queryFor = item => {
    const r = requestText(item);
    let q = clean(item?.name || '');
    if (/\\bavocado(?:es|s)?\\b/.test(r)) q = 'Hass Avocadoes';
    else if (/\\bcheddar\\b/.test(r)) q = 'Tasty Cheese';
    else if (/chocolate muffin|choc muffin/.test(r)) q = 'Chocolate Muffins';
    else if (/chicken breast/.test(r)) q = 'Chicken Breast Fillets';
    else if (/baby (?:roma )?tomato/.test(r)) q = 'Cherry Tomatoes';
    else if (/weet\\s*-?\\s*bix|weetbix|weet bix/.test(r)) q = 'Weet-Bix';
    else if (/greek yog/.test(r)) q = 'Greek Yoghurt';
    else if (/salmon/.test(r) && /fillet/.test(r)) q = 'Salmon Fillets';
    return q || clean(item?.name || '');
  };
  window.__stuffV2Query = queryFor;

  const petWords = /\\b(dog|cat|pet|puppy|kitten|treats?|chews?|dental chew|pet food)\\b/;
  const petRequest = r => /\\b(dog|cat|pet|puppy|kitten)\\b/.test(r);

  const categoryValid = (item, text) => {
    const r = requestText(item);
    const t = lower(text);
    const c = canonical(t);
    if (!petRequest(r) && petWords.test(t)) return false;

    if (/\\bavocado(?:es|s)?\\b/.test(r)) {
      return /\\bavocado\\b/.test(c) && !/(garden|ornament|storage|keeper|saver|holder|container|gadget|tool|slicer|cutter|oil|dip|spread|seasoning|flavour|flavor|guacamole)/.test(t);
    }
    if (/chicken breast/.test(r) && !/(diced|nugget|crumb|schnitzel|tender|strip|kiev|burger)/.test(r)) {
      return t.includes('chicken') && (t.includes('breast') || t.includes('fillet')) && !/(diced|nugget|crumbed|schnitzel|tender|strip|kiev|burger|dog|cat|pet|treat)/.test(t);
    }
    if (/\\bcheddar\\b/.test(r)) {
      return t.includes('cheese') && (t.includes('cheddar') || t.includes('tasty'));
    }
    if (/chocolate muffin|choc muffin/.test(r)) {
      return t.includes('muffin') && (t.includes('chocolate') || /\\bchoc\\b/.test(t)) && !/(mould|mold|silicone|tray|pan|liner|case)/.test(t);
    }
    if (/baby (?:roma )?tomato/.test(r)) {
      return t.includes('tomato') && /(cherry|grape|cocktail|solanato|mini)/.test(t) && !/(diced|crushed|peeled|passata|paste|sauce|canned|tinned|mutti)/.test(t);
    }
    if (/\\bbanana/.test(r)) return /\\bbanana\\b/.test(c) && !/(bread|chips|smoothie|flavour|flavor|baby food|lolly|candy)/.test(t);
    if (/\\bapple/.test(r) && !/(juice|cider|sauce|pie)/.test(r)) return /\\bapple\\b/.test(c) && !/(juice|cider|sauce|pie|flavour|flavor|candle|fragrance)/.test(t);
    if (/bread/.test(r)) return /(bread|loaf)/.test(t) && !/(bread mix|flour|breadcrumb)/.test(t);
    if (/full cream milk/.test(r)) return t.includes('milk') && /full cream|fullcream/.test(t) && !t.includes('lactose');
    if (/greek yog/.test(r)) return t.includes('greek') && /(yoghurt|yogurt)/.test(t);
    if (/weet\\s*-?\\s*bix|weetbix|weet bix/.test(r) && !r.includes('bites')) return /weet\\s*-?\\s*bix|weetbix|weet bix/.test(t) && !t.includes('bites');
    return true;
  };

  const words = value => canonical(value)
    .split(/[^a-z0-9]+/)
    .filter(w => w && !/^[0-9]+$/.test(w) && !['the','a','an','of','and','for','pack','packet','bag','box','large','small','medium','fresh','each','woolworths'].includes(w));

  const measure = value => {
    const m = lower(value).match(/\\b(\\d+(?:\\.\\d+)?)\\s*(kg|g|l|ml)\\b/);
    if (!m) return null;
    const n = Number(m[1]);
    const u = m[2];
    const base = u === 'kg' || u === 'l' ? n * 1000 : n;
    return { n, u, base };
  };

  const requestedMeasure = item => {
    const fromName = measure(requestText(item));
    if (fromName) return fromName;
    const u = unitText(item).replace(/litres?/g,'l').replace(/millilitres?/g,'ml').replace(/kilograms?/g,'kg').replace(/grams?/g,'g');
    if (!/^(kg|g|l|ml)$/.test(u)) return null;
    const n = requestQty(item);
    return {n,u,base:(u==='kg'||u==='l')?n*1000:n};
  };

  const packCount = value => {
    const t = lower(value);
    let m = t.match(/\\b(\\d+)\\s*(?:pack|pk|cans?|rolls?|eggs?|muffins?)\\b/);
    if (m) return Number(m[1]);
    m = t.match(/\\bpack of\\s*(\\d+)\\b/);
    return m ? Number(m[1]) : null;
  };

  const requestedPack = item => {
    const r = requestText(item);
    let m = r.match(/\\bpack of\\s*(\\d+)\\b/);
    if (m) return Number(m[1]);
    m = r.match(/\\b(\\d+)\\s*(?:can\\s*)?pack\\b/);
    if (m) return Number(m[1]);
    m = r.match(/\\b(\\d+)\\s*(?:cans?|rolls?|eggs?|muffins?)\\b/);
    if (m) return Number(m[1]);
    const q = requestQty(item);
    if (/eggs?|rolls?|cans?|muffins?/.test(unitText(item)) && q > 1) return q;
    return null;
  };

  const scoreCandidate = (item, candidate) => {
    const r = requestText(item);
    const t = lower(candidate.text);
    if (!categoryValid(item, t)) return -100000;

    const q = canonical(queryFor(item));
    const cw = words(t);
    const qWords = words(q);
    const requestWords = words(item?.name || '');
    let score = 0;

    for (const w of qWords) if (cw.includes(w) || canonical(t).includes(w)) score += 35;
    for (const w of requestWords) if (cw.includes(w) || canonical(t).includes(w)) score += 14;
    if (canonical(t).includes(q)) score += 90;

    if (/\\bavocado(?:es|s)?\\b/.test(r) && /hass/.test(t)) score += 100;
    if (/\\bcheddar\\b/.test(r) && /(tasty|cheddar)/.test(t)) score += 100;
    if (/chocolate muffin|choc muffin/.test(r) && /(chocolate|\\bchoc\\b)/.test(t)) score += 100;
    if (/chicken breast/.test(r) && /chicken/.test(t) && /(breast|fillet)/.test(t)) score += 120;

    const wantMeasure = requestedMeasure(item);
    const gotMeasure = measure(t);
    if (wantMeasure && gotMeasure) {
      const ratio = gotMeasure.base / wantMeasure.base;
      if (ratio >= .95 && ratio <= 1.05) score += 180;
      else if (ratio >= .8 && ratio <= 1.2) score += 90;
      else if (ratio < .5 || ratio > 1.75) score -= 180;
    }

    const wantPack = requestedPack(item);
    const gotPack = packCount(t);
    if (wantPack && gotPack) {
      const ratio = gotPack / wantPack;
      if (ratio >= .9 && ratio <= 1.1) score += 200;
      else if (ratio >= .7 && ratio <= 1.4) score += 50;
      else score -= 150;
    }

    if (/out of stock|unavailable/.test(t)) score -= 500;
    return score;
  };

  const collectCandidates = () => {
    const found = new Map();
    const anchors = Array.from(document.querySelectorAll('a[href*="/shop/productdetails/"]'));
    for (const a of anchors) {
      const href = String(a.getAttribute('href') || '');
      const m = href.match(/\\/shop\\/productdetails\\/(\\d+)/i);
      if (!m) continue;
      const stockcode = m[1];
      let card = a.closest('article, li, [data-testid*="product"], [class*="product"]');
      if (!card) {
        card = a.parentElement;
        for (let n=0; n<3 && card && clean(card.innerText).length < 30; n++) card = card.parentElement;
      }
      const img = card && card.querySelector && card.querySelector('img[alt]');
      const name = clean(a.getAttribute('aria-label')) || clean(img && img.getAttribute('alt')) || clean(a.textContent);
      const text = clean((card && card.innerText) || a.textContent).slice(0, 900);
      const combined = clean(name + ' ' + text);
      if (!found.has(stockcode) && combined) found.set(stockcode, {stockcode, name: name || text.slice(0,160), text: combined, href});
    }
    return Array.from(found.values());
  };

  const cartQuantity = (item, candidate) => {
    const q = requestQty(item);
    const wantPack = requestedPack(item);
    const gotPack = packCount(candidate.text);
    if (wantPack && gotPack) return Math.max(1, Math.min(8, Math.ceil(wantPack / gotPack)));

    const wantMeasure = requestedMeasure(item);
    const gotMeasure = measure(candidate.text);
    if (wantMeasure && gotMeasure) return Math.max(1, Math.min(8, Math.ceil(wantMeasure.base / gotMeasure.base)));

    const r = requestText(item);
    if (/banana/.test(r) && wantMeasure?.u === 'kg') return Math.max(1, Math.min(12, Math.round(wantMeasure.n * 6)));
    if (/\\b(pack|packet|bag|box|loaf)\\b/.test(unitText(item))) return 1;
    return Math.max(1, Math.min(8, Math.round(q)));
  };

  const addToCart = async (item, candidate) => {
    const res = await fetch('/api/v3/ui/trolley/update', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Accept':'application/json, text/plain, */*'},
      credentials: 'same-origin',
      body: JSON.stringify({items:[{
        stockcode: Number(candidate.stockcode),
        quantity: cartQuantity(item, candidate),
        source: 'SearchServiceSearchProducts',
        diagnostics: '0',
        searchTerm: queryFor(item),
        evaluateRewardPoints: false,
        offerId: null,
        profileId: null,
        priceLevel: null
      }]})
    });
    if (!res.ok) return false;
    const raw = await res.text();
    try {
      const d = raw ? JSON.parse(raw) : null;
      if (d && (d.Success === false || d.success === false)) return false;
    } catch (_) {}
    return true;
  };

  const loadState = () => {
    try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) { return null; }
  };
  const saveState = state => sessionStorage.setItem(KEY, JSON.stringify(state));

  const state = loadState();
  if (!state || !Array.isArray(state.items) || state.index >= state.items.length) {
    window.__stuffV2Running = false;
    return true;
  }

  if (!location.pathname.toLowerCase().includes('/shop/search/products')) {
    window.__stuffV2Running = false;
    return true;
  }

  const item = state.items[state.index];
  const query = queryFor(item);
  post('WOOLIES_V2_STATUS', {message:'Searching Woolies ' + (state.index + 1) + ' of ' + state.items.length + ': ' + item.name});

  let candidates = [];
  for (let attempt=0; attempt<24; attempt++) {
    candidates = collectCandidates();
    if (candidates.length) break;
    if (attempt === 8) window.scrollTo(0, 500);
    await sleep(500);
  }

  let ranked = candidates
    .filter(c => !state.used.includes(String(c.stockcode)))
    .map(c => ({...c, score: scoreCandidate(item, c)}))
    .filter(c => c.score > -10000)
    .sort((a,b) => b.score - a.score);

  const best = ranked[0] || null;
  post('WOOLIES_V2_DIAGNOSTIC', {
    request: item.name,
    query,
    resultCount: candidates.length,
    viableCount: ranked.length,
    top: ranked.slice(0,3).map(c => ({stockcode:c.stockcode,name:c.name,score:c.score}))
  });

  if (!best || best.score < 30) {
    state.unmatched.push(item.name);
    state.index += 1;
    saveState(state);
    post('WOOLIES_V2_STATUS', {message:item.name + ': Woolies showed ' + candidates.length + ' products, but none were a safe match.'});
  } else {
    post('WOOLIES_V2_STATUS', {message:item.name + ': ' + candidates.length + ' Woolies results · choosing ' + (best.name || 'best match')});
    let ok = false;
    try { ok = await addToCart(item, best); } catch (_) { ok = false; }
    if (ok) {
      state.added += 1;
      state.used.push(String(best.stockcode));
    } else {
      state.failedNames.push(item.name);
    }
    state.index += 1;
    saveState(state);
  }

  if (state.index >= state.items.length) {
    sessionStorage.removeItem(KEY);
    post('WOOLIES_V2_DONE', {
      added: state.added,
      unmatched: state.unmatched,
      failedNames: state.failedNames,
      remembered: [],
      success: state.added > 0,
      message: state.added ? ('Done — ' + state.added + ' added.') : 'Nothing was added.'
    });
    window.__stuffV2Running = false;
    return true;
  }

  const next = state.items[state.index];
  const nextQuery = queryFor(next);
  location.assign('/shop/search/products?searchTerm=' + encodeURIComponent(nextQuery));
  return true;
})();true;
`;

if (OriginalWebView && !OriginalWebView.__stuffWoolworthsV2Wrapped) {
  const WrappedWebView = React.forwardRef((props, forwardedRef) => {
    const innerRef = React.useRef(null);
    const exposedRef = React.useRef(null);

    const setRef = React.useCallback(node => {
      innerRef.current = node;
      if (node) {
        exposedRef.current = new Proxy(node, {
          get(target, prop) {
            if (prop === 'injectJavaScript') {
              return script => {
                if (isLegacyMatcherScript(script)) {
                  const items = extractItems(script);
                  if (!items) return target.injectJavaScript(script);
                  return target.injectJavaScript(startScript(items));
                }
                return target.injectJavaScript(script);
              };
            }
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

      if (parsed?.type === 'WOOLIES_V2_STATUS') {
        if (props.onMessage) {
          props.onMessage({...event, nativeEvent:{...event.nativeEvent, data:JSON.stringify({type:'WOOLIES_STATUS',message:parsed.message})}});
        }
        return;
      }
      if (parsed?.type === 'WOOLIES_V2_DONE') {
        if (props.onMessage) {
          props.onMessage({...event, nativeEvent:{...event.nativeEvent, data:JSON.stringify({type:'WOOLIES_DONE',...parsed,remembered:[]})}});
        }
        return;
      }
      if (parsed?.type === 'WOOLIES_V2_FATAL') {
        if (props.onMessage) {
          props.onMessage({...event, nativeEvent:{...event.nativeEvent, data:JSON.stringify({type:'WOOLIES_DONE',added:0,unmatched:[],failedNames:[],remembered:[],message:'Woolies matching stopped: '+(parsed.message||'unknown error')})}});
        }
        return;
      }
      if (parsed?.type === 'WOOLIES_V2_DIAGNOSTIC') {
        try { console.log('[Stuff Woolies V2]', parsed); } catch (_) {}
        return;
      }

      props.onMessage && props.onMessage(event);
    }, [props.onMessage]);

    const onLoadEnd = React.useCallback(event => {
      props.onLoadEnd && props.onLoadEnd(event);
      const url = String(event?.nativeEvent?.url || props?.source?.uri || '').toLowerCase();
      if (url.includes('woolworths.com.au') && url.includes('/shop/search/products')) {
        setTimeout(() => innerRef.current?.injectJavaScript(PAGE_RUNNER), 350);
      }
    }, [props.onLoadEnd, props?.source?.uri]);

    return React.createElement(OriginalWebView, {
      ...props,
      ref: setRef,
      onMessage,
      onLoadEnd,
    });
  });

  WrappedWebView.__stuffWoolworthsV2Wrapped = true;
  WebViewModule.WebView = WrappedWebView;
}
