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
const WOOLIES_URL = 'https://www.woolworths.com.au/';
const SAFARI_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';

function buildWooliesAuthCheckScript() {
  return `
  (() => {
    try {
      const text = String(document.body?.innerText || '').toLowerCase();
      const path = String(location.pathname || '').toLowerCase();
      const loggedOut =
        path.includes('login') ||
        text.includes('welcome to woolworths online') ||
        text.includes('log in or sign up') ||
        text.includes('forgot password');

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'WOOLIES_AUTH_STATE',
        loggedIn: !loggedOut,
        url: location.href
      }));
    } catch (_) {}
  })();
  true;
  `;
}

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

    function overlay() {
      let box = document.getElementById('hello-david-mobile-progress');
      if (box) return box;
      box = document.createElement('div');
      box.id = 'hello-david-mobile-progress';
      Object.assign(box.style, {
        position: 'fixed', top: '16px', left: '16px', right: '16px', zIndex: '2147483647',
        padding: '14px 16px', borderRadius: '14px', background: '#fff', color: '#171717',
        font: '14px/1.45 Arial, sans-serif', boxShadow: '0 10px 35px rgba(0,0,0,.22)',
        border: '1px solid #ddd'
      });
      box.innerHTML = '<strong style="font-size:16px">Hello David</strong><div id="hello-david-mobile-progress-text" style="margin-top:5px">Starting your Woolies shop…</div>';
      document.body.appendChild(box);
      return box;
    }

    function setProgress(text) {
      overlay();
      const el = document.getElementById('hello-david-mobile-progress-text');
      if (el) el.textContent = text;
      post('WOOLIES_STATUS', text);
    }

    function cleanQuery(name) {
      let query = String(name || '')
        .replace(/\\b(whatever(?:'s| is)? on special|on special|cheapest|best value|value option)\\b/gi, '')
        .replace(/\\s+/g, ' ')
        .trim();

      const aliases = [
        [/\\bweet\\s*-?\\s*a?bix\\b/gi, 'Weet-Bix'],
        [/\\bweetbix\\b/gi, 'Weet-Bix'],
        [/\\bweet bix\\b/gi, 'Weet-Bix']
      ];
      for (const [pattern, replacement] of aliases) query = query.replace(pattern, replacement);
      return query;
    }

    function words(value) {
      const stop = new Set(['the','a','an','of','and','for','with','on','pack','packet','bag','box','carton','large','small','medium']);
      return String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !stop.has(w));
    }

    function productText(product) {
      return String(product.DisplayName || product.Name || '') + ' ' + String(product.Brand || '') + ' ' + String(product.PackageSize || '');
    }

    function normaliseUnit(value) {
      return String(value || '').toLowerCase().replace(/litres?/g, 'l').replace(/millilitres?/g, 'ml').replace(/kilograms?/g, 'kg').replace(/grams?/g, 'g').trim();
    }

    function requestedMeasure(item) {
      const rawUnit = normaliseUnit(item.unit);
      const rawName = String(item.name || '').toLowerCase();
      const combined = rawName + ' ' + rawUnit;
      const explicit = combined.match(/\\b(\\d+(?:\\.\\d+)?)\\s*(kg|g|l|ml)\\b/i);
      if (explicit) return { value: Number(explicit[1]), unit: explicit[2].toLowerCase(), explicit: true };

      const quantity = Number(item.qty ?? item.quantity ?? 1);
      if (Number.isFinite(quantity) && quantity > 0) {
        if (/^(l|ml|kg|g)$/.test(rawUnit)) return { value: quantity, unit: rawUnit, explicit: true };
        if (/\\b(l|ml|kg|g)\\b/.test(rawUnit)) {
          const found = rawUnit.match(/\\b(l|ml|kg|g)\\b/);
          if (found?.[1]) return { value: quantity, unit: found[1], explicit: true };
        }
      }
      return null;
    }

    function toBaseMeasure(value, unit) {
      if (!Number.isFinite(value)) return null;
      if (unit === 'kg' || unit === 'l') return value * 1000;
      if (unit === 'g' || unit === 'ml') return value;
      return null;
    }

    function productMeasure(product) {
      const text = (String(product.PackageSize || '') + ' ' + String(product.DisplayName || product.Name || '')).toLowerCase();
      const match = text.match(/\\b(\\d+(?:\\.\\d+)?)\\s*(kg|g|l|ml)\\b/i);
      if (!match) return null;
      return {
        value: Number(match[1]),
        unit: match[2].toLowerCase(),
        base: toBaseMeasure(Number(match[1]), match[2].toLowerCase())
      };
    }

    function isLargePreference(item) {
      return /\\b(large|big|family|largest|biggest)\\b/i.test(String(item.name || '') + ' ' + String(item.unit || ''));
    }

    function buildSearchQuery(item) {
      let query = cleanQuery(item.name);
      const measure = requestedMeasure(item);
      if (measure) {
        const measurePattern = new RegExp('\\\\b' + measure.value + '\\\\s*' + measure.unit + '\\\\b', 'i');
        if (!measurePattern.test(query)) query = query + ' ' + measure.value + measure.unit;
      }
      return query.trim();
    }

    function rankProduct(item, product) {
      const query = cleanQuery(item.name);
      const wantedWords = words(query);
      const text = productText(product).toLowerCase();
      const matchedWords = wantedWords.filter(w => text.includes(w)).length;
      let score = 0;

      for (const word of wantedWords) if (text.includes(word)) score += 14;
      if (query && text.includes(query.toLowerCase())) score += 40;

      const unit = normaliseUnit(item.unit);
      const packSize = unit.match(/(?:pack|packet|box|bag)\\s+of\\s+(\\d+)/i)?.[1];
      if (packSize) {
        const packPattern = new RegExp('(?:\\\\b' + packSize + '\\\\s*(?:pack|pk|x)\\\\b|\\\\bpack\\\\s*of\\\\s*' + packSize + '\\\\b)', 'i');
        if (packPattern.test(text)) score += 40;
      }

      const wantedMeasure = requestedMeasure(item);
      const actualMeasure = productMeasure(product);
      if (wantedMeasure && actualMeasure) {
        const wantedBase = toBaseMeasure(wantedMeasure.value, wantedMeasure.unit);
        if (wantedBase && actualMeasure.base) {
          const ratio = actualMeasure.base / wantedBase;
          if (ratio >= 0.92 && ratio <= 1.08) score += 75;
          else if (ratio >= 0.75 && ratio <= 1.25) score += 30;
          else if (ratio < 0.55 || ratio > 1.8) score -= 35;
        }
      }

      if (isLargePreference(item) && actualMeasure?.base) {
        const name = cleanQuery(item.name).toLowerCase();
        if (/weet[- ]?bix|weetabix/.test(name)) {
          if (actualMeasure.base >= 1000 && actualMeasure.unit !== 'ml' && actualMeasure.unit !== 'l') score += 55;
          else if (actualMeasure.base >= 700) score += 25;
          else score -= 18;
        } else {
          score += Math.min(25, actualMeasure.base / 100);
        }
      }

      const explicitlyWantsSpecial = /special|sale/i.test(item.name || '') || /special|sale/i.test(unit);
      if (product.IsOnSpecial) score += explicitlyWantsSpecial ? 30 : 8;
      else if (explicitlyWantsSpecial) score -= 8;
      if (product.IsAvailable === false || product.IsInStock === false) score -= 200;

      return { product, score, matchedWords, wantedWords };
    }

    function confidentMatch(ranked) {
      if (!ranked) return false;
      const count = ranked.wantedWords.length;
      if (!count) return false;
      const needed = count === 1 ? 1 : Math.min(2, count);
      return ranked.matchedWords >= needed && ranked.score >= 20;
    }

    async function searchProducts(item) {
      const query = buildSearchQuery(item);
      const response = await fetch('/apis/ui/Search/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/plain, */*' },
        credentials: 'same-origin',
        body: JSON.stringify({
          Filters: [],
          IsSpecial: false,
          Location: '/shop/search/products?searchTerm=' + encodeURIComponent(query),
          PageNumber: 1,
          PageSize: 18,
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
      if (!response.ok) throw new Error('Search failed (' + response.status + ')');
      const data = await response.json();
      const products = [];
      for (const group of data?.Products || []) {
        for (const product of group?.Products || []) products.push(product);
      }
      return products;
    }

    function safeQuantity(item, product) {
      let wanted = Number(item.qty ?? item.quantity ?? 1);
      if (!Number.isFinite(wanted) || wanted <= 0) wanted = 1;
      const unit = normaliseUnit(item.unit);
      const text = productText(product).toLowerCase();
      if (requestedMeasure(item)) return 1;
      if (wanted > 12) return 1;
      if (/^(pack|packet|box|bag|carton|bottle|tin|can|loaf|jar)/.test(unit)) return Math.max(1, Math.min(6, Math.round(wanted)));
      if (wanted > 1 && /(roll|muffin|fillet|piece|item)s?/.test(unit)) {
        const exactPack = new RegExp('(?:\\\\b' + wanted + '\\\\s*(?:pack|pk|x)\\\\b|\\\\bpack\\\\s*of\\\\s*' + wanted + '\\\\b)', 'i');
        if (exactPack.test(text)) return 1;
        return Math.max(1, Math.min(12, Math.round(wanted)));
      }
      if (wanted > 6) return 1;
      return Math.max(1, Math.min(6, Math.round(wanted)));
    }

    try {
      if (!Array.isArray(items) || !items.length) {
        setProgress('There is nothing to add.');
        post('WOOLIES_DONE', 'Nothing to add.', { success: false });
        return true;
      }

      const selected = [];
      const unmatched = [];
      const usedStockcodes = new Map();

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        setProgress('Matching ' + (index + 1) + ' of ' + items.length + ': ' + item.name);
        const products = await searchProducts(item);
        const ranked = products
          .map(product => rankProduct(item, product))
          .sort((a, b) => b.score - a.score || Number(a.product.Price || 9999) - Number(b.product.Price || 9999));

        const best = ranked[0];
        if (!confidentMatch(best) || !best.product.Stockcode) {
          unmatched.push(item.name);
          await sleep(150);
          continue;
        }

        const stockcode = String(best.product.Stockcode);
        if (usedStockcodes.has(stockcode)) {
          unmatched.push(item.name);
          await sleep(150);
          continue;
        }

        usedStockcodes.set(stockcode, item.name);
        selected.push({ item, product: best.product, quantity: safeQuantity(item, best.product) });
        await sleep(150);
      }

      let added = 0;
      let failed = 0;
      for (let i = 0; i < selected.length; i += 10) {
        const batchRows = selected.slice(i, i + 10);
        setProgress('Adding ' + Math.min(i + 10, selected.length) + ' of ' + selected.length + ' matched products…');
        const body = {
          items: batchRows.map(row => ({
            stockcode: Number(row.product.Stockcode),
            quantity: Math.max(1, Math.min(12, Number(row.quantity) || 1)),
            source: 'SearchResults',
            diagnostics: '0',
            searchTerm: buildSearchQuery(row.item),
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

      const parts = [String(added) + ' products added.'];
      if (unmatched.length) parts.push('Skipped because David was not confident: ' + unmatched.join(', ') + '.');
      if (failed) parts.push(String(failed) + ' matched products failed to add.');
      parts.push('Review your cart before checkout.');
      const summary = parts.join(' ');
      setProgress(summary);
      post('WOOLIES_DONE', summary, { success: failed === 0, added, failed, unmatched });

      if (!failed) {
        await sleep(1000);
        location.href = '/shop/cart';
      }
    } catch (error) {
      const message = 'Could not finish the Woolies shop: ' + (error?.message || 'unknown error') + '.';
      console.error('Hello David mobile Woolies automation failed', error);
      setProgress(message);
      post('WOOLIES_DONE', message, { success: false });
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
  const awaitingLoginRef = useRef(false);
  const [url, setUrl] = useState(DAVID_URL);
  const [status, setStatus] = useState('David');

  const isWoolies = useMemo(() => url.includes('woolworths.com.au'), [url]);

  function goDavid() {
    pendingItemsRef.current = null;
    injectedForRunRef.current = false;
    awaitingLoginRef.current = false;
    setStatus('David');
    setUrl(DAVID_URL + '&t=' + Date.now());
  }

  function goWoolies() {
    pendingItemsRef.current = null;
    injectedForRunRef.current = false;
    awaitingLoginRef.current = false;
    setStatus('Woolies');
    setUrl(WOOLIES_URL + '?helloDavid=' + Date.now());
  }

  function startPendingShop() {
    if (!pendingItemsRef.current || injectedForRunRef.current) return;
    awaitingLoginRef.current = false;
    injectedForRunRef.current = true;
    setStatus('Matching your Woolies products…');
    webRef.current?.injectJavaScript(buildWooliesScript(pendingItemsRef.current));
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
      if (!items.length) return;
      pendingItemsRef.current = items;
      injectedForRunRef.current = false;
      awaitingLoginRef.current = true;
      setStatus('Checking your Woolies login…');
      setUrl(WOOLIES_URL + '?helloDavid=' + Date.now());
      return;
    }

    if (message?.type === 'WOOLIES_AUTH_STATE') {
      if (!pendingItemsRef.current || injectedForRunRef.current) return;
      if (message.loggedIn) startPendingShop();
      else {
        awaitingLoginRef.current = true;
        setStatus('Log in to Woolies — David will continue automatically');
      }
      return;
    }

    if (message?.type === 'WOOLIES_STATUS') {
      setStatus(message.message || 'Building Woolies cart…');
      return;
    }

    if (message?.type === 'WOOLIES_DONE') {
      pendingItemsRef.current = null;
      injectedForRunRef.current = true;
      awaitingLoginRef.current = false;
      setStatus(message.message || 'Cart ready to review');
    }
  }

  function handleLoadEnd(event) {
    const loadedUrl = event.nativeEvent.url || '';
    if (!loadedUrl.includes('woolworths.com.au')) return;
    if (!pendingItemsRef.current || injectedForRunRef.current) return;
    setStatus(awaitingLoginRef.current ? 'Checking your Woolies login…' : 'Opening Woolies…');
    webRef.current?.injectJavaScript(buildWooliesAuthCheckScript());
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
          <TouchableOpacity style={[styles.navButton, !isWoolies && styles.navActive]} onPress={goDavid}>
            <Text style={styles.navText}>David</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navButton, isWoolies && styles.navActive]} onPress={goWoolies}>
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
  brand: { fontSize: 13, fontWeight: '800', letterSpacing: 0.7, color: '#50514F' },
  status: { fontSize: 11, marginTop: 2, color: '#737470' },
  nav: { flexDirection: 'row', gap: 6 },
  navButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#efefe9' },
  navActive: { backgroundColor: '#B4ADEA' },
  navText: { fontSize: 12, fontWeight: '700', color: '#292a28' },
  webview: { flex: 1, backgroundColor: '#fff' },
});
