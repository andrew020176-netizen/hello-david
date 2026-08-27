const React = require('react');
const WebViewModule = require('react-native-webview');

const OriginalWebView = WebViewModule.WebView;

function patchMatcherScript(script) {
  let out = String(script || '');
  if (!out.includes('Matching your groceries')) return out;

  // Woolworths and everyday Australian grocery language do not always use the
  // same words. Expand searches without weakening the product safety checks.
  out = out.replace(
    "if(/\\\\bavocados?\\\\b/.test(r))out.push('fresh avocado');",
    "if(/\\\\bavocados?\\\\b/.test(r)){out.push('fresh avocado');out.push('avocado each');out.push('hass avocado')}"
  );
  out = out.replace(
    "if(r.includes('chicken breast'))out.push('chicken breast');",
    "if(r.includes('chicken breast')){out.push('chicken breast');out.push('chicken breast fillets')}"
  );
  out = out.replace(
    "if(r.includes('cheddar'))out.push('cheddar cheese');",
    "if(r.includes('cheddar')){out.push('cheddar cheese');out.push('tasty cheese')}"
  );
  out = out.replace(
    "if(r.includes('chocolate muffin'))out.push('chocolate muffins');",
    "if(r.includes('chocolate muffin')){out.push('chocolate muffins');out.push('choc muffins');out.push('double choc muffins')}"
  );

  // Treat common Woolworths wording as equivalent to the shopper's wording.
  out = out.replace(
    "if(r.includes('chocolate muffin'))return t.includes('muffin')&&t.includes('chocolate');",
    "if(r.includes('chocolate muffin'))return t.includes('muffin')&&(t.includes('chocolate')||/\\\\bchoc\\\\b/.test(t));"
  );
  out = out.replace(
    "if(r.includes('cheddar'))return t.includes('cheddar')&&t.includes('cheese');",
    "if(r.includes('cheddar'))return (t.includes('cheddar')||t.includes('tasty'))&&t.includes('cheese');"
  );

  // Human grocery requests must never resolve into pet food/treats simply
  // because the product title contains words such as chicken + breast.
  const badNeedle = "const bad=(i,p)=>{const r=req(i),t=txt(p),u=unitText(i);if(!coreValid(i,p))return true;";
  const badReplacement = "const bad=(i,p)=>{const r=req(i),t=txt(p),u=unitText(i);const petRequest=/(dog|cat|pet|puppy|kitten)/.test(r);if(!petRequest&&/(dog|cat|pet|puppy|kitten|treats?|chews?|dental chew|pet food)/.test(t))return true;if(!coreValid(i,p))return true;";
  out = out.replace(badNeedle, badReplacement);

  // The current matcher requires lexical hits as a confidence safeguard. Keep
  // that safeguard, but recognise singular/plural and common grocery aliases.
  const oldRank = "const ws=words(query(i)),needed=ws.length===1?1:Math.min(2,ws.length);let ranked=ps.map(p=>({p,s:score(i,p),hits:ws.filter(w=>txt(p).includes(w)).length,price:+(p.Price||999)}))";
  const newRank = "const ws=words(query(i)),needed=ws.length===1?1:Math.min(2,ws.length);const wordHit=(t,w)=>t.includes(w)||(w==='avocados'&&t.includes('avocado'))||(w==='avocado'&&t.includes('avocados'))||(w==='muffins'&&t.includes('muffin'))||(w==='muffin'&&t.includes('muffins'))||(w==='chocolate'&&(t.includes('chocolate')||/\\\\bchoc\\\\b/.test(t)))||(w==='cheddar'&&(t.includes('cheddar')||t.includes('tasty')));let ranked=ps.map(p=>({p,s:score(i,p),hits:ws.filter(w=>wordHit(txt(p),w)).length,price:+(p.Price||999)}))";
  out = out.replace(oldRank, newRank);

  return out;
}

if (OriginalWebView && !OriginalWebView.__stuffMatcherGuardWrapped) {
  const WrappedWebView = React.forwardRef((props, forwardedRef) => {
    const innerRef = React.useRef(null);
    const exposedRef = React.useRef(null);

    const setRef = React.useCallback(node => {
      innerRef.current = node;
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

      // A product Stuff chose is not automatically a household preference.
      // We will only build preference learning from an explicit/reliable signal.
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
