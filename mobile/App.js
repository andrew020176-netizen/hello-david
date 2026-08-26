import React, { useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const DAVID_URL = 'https://hellodavid.com.au/?app=1';
const WOOLIES_HOME = 'https://www.woolworths.com.au/';
const WOOLIES_CART = 'https://www.woolworths.com.au/shop/cart';
const SAFARI_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';

function buildWooliesScript(items) {
  const payload = JSON.stringify(Array.isArray(items) ? items.slice(0, 60) : []);

  return `
  (async () => {
    const items = ${payload};
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const post = (type, message, extra = {}) => {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, message, ...extra }));
      } catch (_) {}
    };

    const setProgress = text => {
      try {
        let box = document.getElementById('hello-david-mobile-progress');
        if (!box) {
          box = document.createElement('div');
          box.id = 'hello-david-mobile-progress';
          Object.assign(box.style, {
            position: 'fixed',
            top: '16px',
            left: '16px',
            right: '16px',
            zIndex: '2147483647',
            padding: '14px 16px',
            borderRadius: '14px',
            background: '#fff',
            color: '#171717',
            font: '14px/1.45 Arial, sans-serif',
            boxShadow: '0 10px 35px rgba(0,0,0,.22)',
            border: '1px solid #ddd'
          });
          box.innerHTML =
            '<strong style="font-size:16px">Hello David</strong>' +
            '<div id="hello-david-mobile-progress-text" style="margin-top:5px"></div>';
          document.body.appendChild(box);
        }
        const el = document.getElementById('hello-david-mobile-progress-text');
        if (el) el.textContent = text;
      } catch (_) {}
      post('WOOLIES_STATUS', text);
    };

    async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    }

    function normaliseUnit(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/litres?/g, 'l')
        .replace(/millilitres?/g, 'ml')
        .replace(/kilograms?/g, 'kg')
        .replace(/grams?/g, 'g')
        .trim();
    }

    function requestText(item) {
      return (String(item.name || '') + ' ' + String(item.unit || '')).toLowerCase();
    }

    function cleanQuery(item) {
      let query = String(item.name || '')
        .replace(/\\b(whatever(?:'s| is)? on special|on special|cheapest|best value|value option)\\b/gi, '')
        .replace(/\\s+/g, ' ')
        .trim();

      query = query
        .replace(/\\bweet\\s*-?\\s*a?bix\\b/gi, 'Weet-Bix')
        .replace(/\\bweetbix\\b/gi, 'Weet-Bix')
        .replace(/\\bweet bix\\b/gi, 'Weet-Bix');

      if (/\\bbaby\\s+(?:roma\\s+)?tomatoes?\\b/i.test(query)) {
        query = 'cherry tomatoes';
      }

      if (/\\s+or\\s+/i.test(query)) {
        query = query.split(/\\s+or\\s+/i)[0].trim();
      }

      return query;
    }

    function words(value) {
      const stop = new Set([
        'the','a','an','of','and','for','with','on',
        'pack','packet','bag','box','carton','large','small','medium'
      ]);
      return String(value || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(w => w && !stop.has(w));
    }

    function productText(product) {
      return (
        String(product.DisplayName || product.Name || '') + ' ' +
        String(product.Brand || '') + ' ' +
        String(product.PackageSize || '')
      ).toLowerCase();
    }

    function requestedMeasure(item) {
      const unit = normaliseUnit(item.unit);
      const name = String(item.name || '').toLowerCase();
      const combined = name + ' ' + unit;
      const explicit = combined.match(/\\b(\\d+(?:\\.\\d+)?)\\s*(kg|g|l|ml)\\b/i);

      if (explicit) {
        return { value: Number(explicit[1]), unit: explicit[2].toLowerCase() };
      }

      const quantity = Number(item.qty ?? item.quantity ?? 1);
      if (Number.isFinite(quantity) && quantity > 0 && /^(kg|g|l|ml)$/.test(unit)) {
        return { value: quantity, unit };
      }

      return null;
    }

    function toBase(value, unit) {
      if (!Number.isFinite(value)) return null;
      if (unit === 'kg' || unit === 'l') return value * 1000;
      if (unit === 'g' || unit === 'ml') return value;
      return null;
    }

    function productMeasure(product) {
      const text =
        (String(product.PackageSize || '') + ' ' + String(product.DisplayName || product.Name || '')).toLowerCase();
      const match = text.match(/\\b(\\d+(?:\\.\\d+)?)\\s*(kg|g|l|ml)\\b/i);
      if (!match) return null;

      const value = Number(match[1]);
      const unit = match[2].toLowerCase();
      return { value, unit, base: toBase(value, unit) };
    }

    function isHardMismatch(item, product) {
      const request = requestText(item);
      const text = productText(product);

      if (/\\bbaby\\s+(?:roma\\s+)?tomatoes?\\b/.test(request)) {
        if (!/\\btomato(?:es)?\\b/.test(text)) return true;
        if (!/\\b(cherry|grape|cocktail|solanato|mini)\\b/.test(text)) return true;
        if (/\\b(mutti|whole|diced|crushed|peeled|passata|paste|sauce|canned|tinned|tin|can|jar)\\b/.test(text)) return true;
      } else if (/\\btomato(?:es)?\\b/.test(request)) {
        if (/\\b(mutti|diced|crushed|peeled|passata|paste|sauce|canned|tinned|tin|can|jar)\\b/.test(text)) return true;
      }

      if (/\\bcarrots?\\b/.test(request) && !/\\bbaby\\b/.test(request) && /\\bbaby\\s+carrots?\\b/.test(text)) {
        return true;
      }

      if (/\\bbread\\b/.test(request) && /\\b(mix|flour|crumb|crumbs|breadcrumbs)\\b/.test(text)) {
        return true;
      }

      const wanted = requestedMeasure(item);
      const actual = productMeasure(product);
      if (wanted && actual) {
        const wantedBase = toBase(wanted.value, wanted.unit);
        if (wantedBase && actual.base) {
          const ratio = actual.base / wantedBase;
          if (ratio < 0.60 || ratio > 1.55) return true;
        }
      }

      return false;
    }

    function buildSearchQuery(item) {
      let query = cleanQuery(item);
      const measure = requestedMeasure(item);

      if (measure) {
        const token = String(measure.value) + measure.unit;
        if (!query.toLowerCase().includes(token.toLowerCase())) {
          query += ' ' + token;
        }
      }

      return query.trim();
    }

    function rankProduct(item, product) {
      const query = cleanQuery(item);
      const wantedWords = words(query);
      const text = productText(product);
      const matchedWords = wantedWords.filter(w => text.includes(w)).length;
      const invalid = isHardMismatch(item, product);
      let score = invalid ? -10000 : 0;

      for (const word of wantedWords) {
        if (text.includes(word)) score += 14;
      }

      if (query && text.includes(query.toLowerCase())) score += 45;

      const request = requestText(item);

      if (/\\bbaby\\s+(?:roma\\s+)?tomatoes?\\b/.test(request)) {
        if (/\\b(cherry|grape|cocktail|solanato|mini)\\b/.test(text)) score += 140;
      }

      if (/\\bcarrots?\\b/.test(request) && !/\\bbaby\\b/.test(request) && !/\\bbaby\\b/.test(text)) {
        score += 35;
      }

      if (/\\bwhite\\s+bread\\b/.test(request) && /\\bwhite\\b/.test(text) && /\\b(bread|loaf)\\b/.test(text)) {
        score += 60;
      }

      if (/\\bgarlic\\s+bread\\b/.test(request) && /\\bgarlic\\b/.test(text) && /\\bbread\\b/.test(text)) {
        score += 70;
      }

      const wanted = requestedMeasure(item);
      const actual = productMeasure(product);
      if (wanted) {
        if (!actual) {
          score -= 60;
        } else {
          const wantedBase = toBase(wanted.value, wanted.unit);
          if (wantedBase && actual.base) {
            const ratio = actual.base / wantedBase;
            if (ratio >= 0.95 && ratio <= 1.05) score += 140;
            else if (ratio >= 0.85 && ratio <= 1.15) score += 85;
            else if (ratio >= 0.70 && ratio <= 1.30) score += 25;
            else score -= 250;
          }
        }
      }

      if (/\\b(large|big|family|largest|biggest)\\b/i.test(request) && actual?.base) {
        if (/weet[- ]?bix|weetabix/.test(query.toLowerCase())) {
          if (actual.base >= 1000 && actual.unit !== 'ml' && actual.unit !== 'l') score += 80;
          else if (actual.base >= 700) score += 35;
          else score -= 45;
        }
      }

      if (product.IsOnSpecial) score += 6;
      if (product.IsAvailable === false || product.IsInStock === false) score -= 200;

      return { product, score, matchedWords, wantedWords, invalid };
    }

    function confidentMatch(result) {
      if (!result || result.invalid) return false;
      const count = result.wantedWords.length;
      if (!count) return false;
      const needed = count === 1 ? 1 : Math.min(2, count);
      return result.matchedWords >= needed && result.score >= 20;
    }

    async function searchProducts(item) {
      const query = buildSearchQuery(item);
      const response = await fetchWithTimeout('/apis/ui/Search/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          Filters: [],
          IsSpecial: false,
          Location: '/shop/search/products?searchTerm=' + encodeURIComponent(query),
          PageNumber: 1,
          PageSize: 30,
          SearchTerm: query,
          SortType: 'TraderRelevance',
          IsHideEverydayMarketProducts: false,
          IsRegisteredRewardCardPromotion: null,
          ExcludeSearchTypes: ['UntraceableVendors'],
          GpBoost: 0,
          GroupEdmVariants: false,
          EnableAdReRanking: false
        })
      }, 12000);

      if (!response.ok) {
        throw new Error('Search failed (' + response.status + ')');
      }

      const data = await response.json();
      const products = [];

      for (const group of data?.Products || []) {
        for (const product of group?.Products || []) {
          products.push(product);
        }
      }

      return products;
    }

    function safeQuantity(item) {
      let wanted = Number(item.qty ?? item.quantity ?? 1);
      if (!Number.isFinite(wanted) || wanted <= 0) wanted = 1;

      if (requestedMeasure(item)) return 1;
      if (wanted > 12) return 1;

      const unit = normaliseUnit(item.unit);
      if (/^(pack|packet|box|bag|carton|bottle|tin|can|loaf|jar)/.test(unit)) {
        return Math.max(1, Math.min(6, Math.round(wanted)));
      }

      if (wanted > 6) return 1;
      return Math.max(1, Math.min(6, Math.round(wanted)));
    }

    function trolleyBody(rows) {
      return {
        items: rows.map(row => ({
          stockcode: Number(row.product.Stockcode),
          quantity: safeQuantity(row.item),
          source: row.product.Source || 'SearchServiceSearchProducts',
          diagnostics: row.product.Diagnostics || '0',
          searchTerm: buildSearchQuery(row.item),
          evaluateRewardPoints: false,
          offerId: row.product.OfferId ?? null,
          profileId: null,
          priceLevel: null
        }))
      };
    }

    async function addRows(rows) {
      try {
        const response = await fetchWithTimeout('/api/v3/ui/trolley/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*'
          },
          credentials: 'same-origin',
          body: JSON.stringify(trolleyBody(rows))
        }, 12000);

        if (!response.ok) {
          return { ok: false, detail: 'HTTP ' + response.status };
        }

        let body = null;
        try {
          body = await response.clone().json();
        } catch (_) {}

        return { ok: true, body };
      } catch (error) {
        return { ok: false, detail: error?.message || 'request failed' };
      }
    }

    try {
      if (!Array.isArray(items) || !items.length) {
        setProgress('There is nothing to add.');
        post('WOOLIES_DONE', 'Nothing to add.', { success: false, added: 0 });
        return true;
      }

      const selected = [];
      const unmatched = [];
      const searchFailed = [];
      const usedStockcodes = new Set();

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        setProgress('Matching ' + (index + 1) + ' of ' + items.length + ': ' + item.name);

        let products = [];
        try {
          products = await searchProducts(item);
        } catch (error) {
          searchFailed.push(item.name);
          continue;
        }

        const ranked = products
          .map(product => rankProduct(item, product))
          .sort((a, b) => b.score - a.score || Number(a.product.Price || 9999) - Number(b.product.Price || 9999));

        const best = ranked[0];

        if (!confidentMatch(best) || !best.product.Stockcode) {
          unmatched.push(item.name);
          continue;
        }

        const stockcode = String(best.product.Stockcode);
        if (usedStockcodes.has(stockcode)) {
          unmatched.push(item.name);
          continue;
        }

        usedStockcodes.add(stockcode);
        selected.push({ item, product: best.product });
        await sleep(120);
      }

      let added = 0;
      let failed = 0;

      for (let i = 0; i < selected.length; i++) {
        const row = selected[i];
        setProgress('Adding ' + (i + 1) + ' of ' + selected.length + ': ' + row.item.name);

        const result = await addRows([row]);
        if (result.ok) added += 1;
        else failed += 1;

        await sleep(180);
      }

      const parts = [String(added) + ' products added.'];
      if (unmatched.length) parts.push('Could not confidently match: ' + unmatched.join(', ') + '.');
      if (searchFailed.length) parts.push('Search failed for: ' + searchFailed.join(', ') + '.');
      if (failed) parts.push(String(failed) + ' products failed to add.');
      parts.push('Refreshing your cart.');

      const summary = parts.join(' ');
      setProgress(summary);
      post('WOOLIES_DONE', summary, {
        success: added > 0,
        added,
        failed,
        unmatched,
        searchFailed
      });
    } catch (error) {
      const message = 'Could not finish the Woolies shop: ' + (error?.message || 'unknown error') + '.';
      setProgress(message);
      post('WOOLIES_DONE', message, { success: false, added: 0 });
    }

    return true;
  })();
  true;
  `;
}

export default function App() {
  const webRef = useRef(null);
  const pendingItemsRef = useRef(null);
  const injectedForRunRef = useRef(false);
  const [url, setUrl] = useState(DAVID_URL);
  const [status, setStatus] = useState('David');

  const isWoolies = useMemo(() => url.includes('woolworths.com.au'), [url]);

  function goDavid() {
    pendingItemsRef.current = null;
    injectedForRunRef.current = false;
    setStatus('David');
    setUrl(DAVID_URL + '&t=' + Date.now());
  }

  function goWoolies() {
    pendingItemsRef.current = null;
    injectedForRunRef.current = false;
    setStatus('Woolies cart');
    setUrl(WOOLIES_CART + '?helloDavid=' + Date.now());
  }

  function handleMessage(event) {
    let message;

    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch (_) {
      return;
    }

    if (message?.type === 'HELLO_DAVID_SEND_TO_WOOLIES') {
      const items = Array.isArray(message.items) ? message.items : [];
      if (!items.length) {
        setStatus('Nothing to send');
        return;
      }

      pendingItemsRef.current = items;
      injectedForRunRef.current = false;
      setStatus('Opening Woolies cart…');

      setUrl(WOOLIES_CART + '?helloDavid=' + Date.now());
      return;
    }

    if (message?.type === 'WOOLIES_STATUS') {
      setStatus(message.message || 'Building Woolies cart…');
      return;
    }

    if (message?.type === 'WOOLIES_DONE') {
      const added = Number(message.added || 0);
      pendingItemsRef.current = null;
      injectedForRunRef.current = true;

      if (added > 0) {
        setStatus('Cart ready — ' + added + ' added');
        setTimeout(() => {
          setUrl(WOOLIES_CART + '?helloDavidDone=' + Date.now());
        }, 350);
      } else {
        setStatus(message.message || 'Nothing was added');
      }
    }
  }

  function handleLoadEnd(event) {
    const loadedUrl = String(event.nativeEvent.url || '');
    if (!loadedUrl.includes('woolworths.com.au')) return;
    if (!pendingItemsRef.current || injectedForRunRef.current) return;

    injectedForRunRef.current = true;
    setStatus('Matching your Woolies products…');
    webRef.current?.injectJavaScript(buildWooliesScript(pendingItemsRef.current));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.brandWrap}>
          <Text style={styles.brand}>HELLO DAVID</Text>
          <Text style={styles.status} numberOfLines={1}>{status}</Text>
        </View>

        <View style={styles.nav}>
          <TouchableOpacity
            style={[styles.navButton, !isWoolies && styles.navActive]}
            onPress={goDavid}
          >
            <Text style={styles.navText}>David</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, isWoolies && styles.navActive]}
            onPress={goWoolies}
          >
            <Text style={styles.navText}>Woolies</Text>
          </TouchableOpacity>
        </View>
      </View>

      <WebView
        ref={webRef}
        source={{ uri: url }}
        style={styles.webview}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        userAgent={SAFARI_USER_AGENT}
        javaScriptEnabled
        javaScriptCanOpenWindowsAutomatically
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled
        incognito={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FDFFF7' },
  header: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FDFFF7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d9d9d4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandWrap: { flex: 1, minWidth: 0 },
  brand: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: '#50514F',
  },
  status: {
    fontSize: 11,
    marginTop: 2,
    color: '#737470',
  },
  nav: {
    flexDirection: 'row',
    gap: 6,
  },
  navButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#efefe9',
  },
  navActive: {
    backgroundColor: '#B4ADEA',
  },
  navText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#292a28',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
