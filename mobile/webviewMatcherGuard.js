const React = require('react');
const WebViewModule = require('react-native-webview');

const OriginalWebView = WebViewModule.WebView;

function patchMatcherScript(script) {
  let out = String(script || '');
  if (!out.includes('Matching your groceries')) return out;

  // Canonicalise retailer wording before the matcher scores anything.
  // Woolworths currently uses "Avocadoes" on its main Hass produce listing,
  // while shoppers commonly say avocado/avocados. Treat all three as avocado.
  out = out.replace(
    "const txt=p=>(String(p.DisplayName||p.Name||'')+' '+String(p.Brand||'')+' '+String(p.PackageSize||'')).toLowerCase();\n const req=i=>(String(i.name||'')+' '+String(i.unit||'')).toLowerCase();",
    "const canon=v=>String(v||'').toLowerCase().replace(/\\bavocado(?:es|s)?\\b/g,'avocado');\n const txt=p=>canon(String(p.DisplayName||p.Name||'')+' '+String(p.Brand||'')+' '+String(p.PackageSize||''));\n const req=i=>canon(String(i.name||'')+' '+String(i.unit||''));"
  );

  // Make the actual search query canonical too, otherwise the final lexical
  // confidence gate can still compare plural shopper wording with singular retail wording.
  out = out.replace(
    "const baseQuery=i=>String(i.name||'')",
    "const baseQuery=i=>String(i.name||'').replace(/\\bavocado(?:es|s)?\\b/gi,'avocado')"
  );

  // Expand ordinary Woolworths search language.
  out = out.replace(
    "out.push('fresh avocado')",
    "out.push('fresh avocado');out.push('hass avocado');out.push('avocado each')"
  );
  out = out.replace(
    "out.push('cheddar cheese')",
    "out.push('cheddar cheese');out.push('tasty cheese');out.push('cheese block')"
  );
  out = out.replace(
    "out.push('chocolate muffins')",
    "out.push('chocolate muffins');out.push('choc muffins');out.push('double choc muffins')"
  );
  out = out.replace(
    "out.push('chicken breast')",
    "out.push('chicken breast');out.push('chicken breast fillets')"
  );

  // Woolworths search also returns non-food products whose titles contain
  // "avocado". Explicitly keep produce and reject those false positives.
  out = out.replace(
    "storage|keeper|saver|holder|container|gadget|tool|slicer|cutter|oil|dip|spread|seasoning|flavour|flavor",
    "storage|keeper|saver|holder|container|gadget|tool|slicer|cutter|oil|dip|spread|seasoning|flavour|flavor|solar|garden|gardener|metal|bobbing|fairy|light|decoration|decor|ornament"
  );

  // Accept common Australian retailer wording as equivalent to shopper wording.
  out = out.replace(
    "return t.includes('cheddar')&&t.includes('cheese')",
    "return (t.includes('cheddar')||t.includes('tasty'))&&t.includes('cheese')"
  );
  out = out.replace(
    "return t.includes('muffin')&&t.includes('chocolate')",
    "return t.includes('muffin')&&(t.includes('chocolate')||t.includes('choc'))"
  );

  // Hard category safety: a normal grocery request must never become pet food.
  out = out.replace(
    "if(!coreValid(i,p))return true;",
    "const petRequest=/(dog|cat|pet|puppy|kitten)/.test(r);if(!petRequest&&/(dog|cat|pet|puppy|kitten|treat|chew|dental)/.test(t))return true;if(!coreValid(i,p))return true;"
  );

  // Keep the lexical confidence gate, but recognise common equivalents.
  const rankNeedle = "const ws=words(query(i)),needed=ws.length===1?1:Math.min(2,ws.length);let ranked=";
  const rankReplacement = "const ws=words(query(i)),needed=ws.length===1?1:Math.min(2,ws.length);const wordHit=(t,w)=>t.includes(w)||(w==='cheddar'&&t.includes('tasty'))||(w==='chocolate'&&t.includes('choc'))||(w==='muffins'&&t.includes('muffin'))||(w==='muffin'&&t.includes('muffins'));let ranked=";
  out = out.replace(rankNeedle, rankReplacement);
  out = out.replace(
    "hits:ws.filter(w=>txt(p).includes(w)).length",
    "hits:ws.filter(w=>wordHit(txt(p),w)).length"
  );

  return out;
}

if (OriginalWebView && !OriginalWebView.__stuffMatcherGuardWrapped) {
  const WrappedWebView = React.forwardRef((props, forwardedRef) => {
    const exposedRef = React.useRef(null);

    const setRef = React.useCallback(node => {
      if (node) {
        exposedRef.current = new Proxy(node, {
          get(target, prop) {
            if (prop === 'injectJavaScript') {
              return script => target.injectJavaScript(patchMatcherScript(script));
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

      // Do not treat Stuff's own first guess as a learned household preference.
      if (parsed?.type === 'WOOLIES_DONE' && props.onMessage) {
        const sanitized = { ...parsed, remembered: [] };
        props.onMessage({
          ...event,
          nativeEvent: { ...event.nativeEvent, data: JSON.stringify(sanitized) }
        });
        return;
      }

      props.onMessage && props.onMessage(event);
    }, [props.onMessage]);

    return React.createElement(OriginalWebView, {
      ...props,
      ref: setRef,
      onMessage,
    });
  });

  WrappedWebView.__stuffMatcherGuardWrapped = true;
  WebViewModule.WebView = WrappedWebView;
}
