from pathlib import Path

p=Path('mobile/StuffApp.js')
text=p.read_text()

old="  const colesCartQueue=useRef([]),colesCartPos=useRef(0),colesCartAdded=useRef(0),colesCartFailed=useRef([]),colesCartInjected=useRef(false);\n"
new=old+"  const retailerWatchdog=useRef(null);\n"
if old not in text: raise SystemExit('ref marker missing')
if 'retailerWatchdog' not in text: text=text.replace(old,new,1)

marker="  async function processAudio(uri){\n"
helpers=r'''  function clearRetailerWatchdog(){if(retailerWatchdog.current){clearTimeout(retailerWatchdog.current);retailerWatchdog.current=null}}
  function armRetailerWatchdog(label,ms=90000){
    clearRetailerWatchdog();
    retailerWatchdog.current=setTimeout(()=>{
      pending.current=[];colesCartQueue.current=[];injected.current=false;colesCartInjected.current=false;
      setStatus(`${label} is taking longer than expected. Continue manually with the retailer or go back.`);
    },ms);
  }
  function retailerChallenge(url){return /captcha|challenge|access[-_ ]?denied|blocked|security[-_ ]?check|perimeterx|akamai/.test(String(url||'').toLowerCase())}
  function stopForRetailerChallenge(retailer){
    clearRetailerWatchdog();pending.current=[];colesCartQueue.current=[];injected.current=false;colesCartInjected.current=false;
    setStatus(`${retailer} needs your attention. Stuff won’t try to bypass a retailer security check — continue manually or go back.`);
  }
  function retailerLoadError(retailer,url){
    clearRetailerWatchdog();pending.current=[];colesCartQueue.current=[];injected.current=false;colesCartInjected.current=false;
    setStatus(`${retailer} could not load. You can open the retailer directly or go back to your list.`);
    Alert.alert(`${retailer} could not load`,'Stuff has stopped the handoff. Your shopping list is still safe.',[
      {text:'Back to Stuff',style:'cancel',onPress:back},
      {text:`Open ${retailer}`,onPress:()=>Linking.openURL(url).catch(()=>{})},
    ]);
  }

'''+marker
if marker not in text: raise SystemExit('process marker missing')
if 'function clearRetailerWatchdog' not in text: text=text.replace(marker,helpers,1)

# Woolworths entry, message and load.
old="  function send(){if(!canSend)return;const {allowed,restricted}=splitRetailerItems(items);if(restricted.length)Alert.alert('Some items were not automated',`Stuff leaves age-restricted items on your list for you to handle directly with the retailer: ${restricted.map(x=>title(x.name)).join(', ')}.`);if(!allowed.length)return;wooliesReturnTab.current='home';pending.current=allowed.map(i=>({name:i.name,qty:i.quantity,quantity:i.quantity,unit:i.unit}));injected.current=false;retries.current=0;setStatus('Connecting to Woolies…');setCartUrl('https://www.woolworths.com.au/');setWebKey(k=>k+1);setMode('woolies')}\n"
new="  function send(){if(!canSend)return;const {allowed,restricted}=splitRetailerItems(items);if(restricted.length)Alert.alert('Some items were not automated',`Stuff leaves age-restricted items on your list for you to handle directly with the retailer: ${restricted.map(x=>title(x.name)).join(', ')}.`);if(!allowed.length)return;wooliesReturnTab.current='home';pending.current=allowed.map(i=>({name:i.name,qty:i.quantity,quantity:i.quantity,unit:i.unit}));injected.current=false;retries.current=0;setStatus('Connecting to Woolies…');armRetailerWatchdog('Woolworths');setCartUrl('https://www.woolworths.com.au/');setWebKey(k=>k+1);setMode('woolies')}\n"
if old not in text: raise SystemExit('send missing')
text=text.replace(old,new,1)

old="  function back(){pending.current=[];injected.current=false;retries.current=0;setMode('shop');setTab(wooliesReturnTab.current||'home');setStatus('')}\n"
new="  function back(){clearRetailerWatchdog();pending.current=[];colesCartQueue.current=[];injected.current=false;colesCartInjected.current=false;retries.current=0;setMode('shop');setTab(wooliesReturnTab.current||'home');setStatus('')}\n"
if old not in text: raise SystemExit('back missing')
text=text.replace(old,new,1)

old="  function onMessage(e){let m;try{m=JSON.parse(e.nativeEvent.data)}catch(_){return}if(m?.type==='WOOLIES_STATUS'){setStatus(m.message||'Building your Woolies cart…');return}if(m?.type==='WOOLIES_DONE'){const added=Number(m.added||0);pending.current=[];setStatus(added?`Done — ${added} ${added===1?'product':'products'} added.`:(m.message||'Nothing was added.'));if(added)setTimeout(openCart,350)}}\n"
new="  function onMessage(e){let m;try{m=JSON.parse(e.nativeEvent.data)}catch(_){return}if(m?.type==='WOOLIES_STATUS'){armRetailerWatchdog('Woolworths');setStatus(m.message||'Building your Woolies cart…');return}if(m?.type==='WOOLIES_DONE'){clearRetailerWatchdog();const added=Number(m.added||0);pending.current=[];setStatus(added?`Done — ${added} ${added===1?'product':'products'} added.`:(m.message||'Nothing was added.'));if(added)setTimeout(openCart,350)}}\n"
if old not in text: raise SystemExit('onMessage missing')
text=text.replace(old,new,1)

old="    if(!pending.current.length){if(lower.includes('/shop/cart'))setStatus('Cart ready.');return}\n    if(injected.current)return;\n    if(!lower.includes('woolworths.com.au')){setStatus('Connecting to Woolies…');return}\n    if(/login|sign-in|signin|verify|auth/.test(lower)){setStatus('Log in to Woolies — we’ll continue automatically.');return}\n    injected.current=true;\n    setStatus('Matching your groceries…');\n    setTimeout(()=>webRef.current?.injectJavaScript(wooliesScript(pending.current,preferences)),1000);\n"
new="    if(!pending.current.length){clearRetailerWatchdog();if(lower.includes('/shop/cart'))setStatus('Cart ready.');return}\n    if(retailerChallenge(lower)){stopForRetailerChallenge('Woolworths');return}\n    if(injected.current)return;\n    if(!lower.includes('woolworths.com.au')){setStatus('Connecting to Woolies…');return}\n    if(/login|sign-in|signin|verify|auth/.test(lower)){armRetailerWatchdog('Woolworths',180000);setStatus('Log in to Woolies — we’ll continue automatically.');return}\n    injected.current=true;\n    armRetailerWatchdog('Woolworths');\n    setStatus('Matching your groceries…');\n    setTimeout(()=>webRef.current?.injectJavaScript(wooliesScript(pending.current,preferences)),1000);\n"
if old not in text: raise SystemExit('woolies load block missing')
text=text.replace(old,new,1)

# Coles matching entry and messages.
old="  function compareColes(){if(!canSend)return;const {allowed,restricted}=splitRetailerItems(items);if(restricted.length)Alert.alert('Some items were not automated',`Stuff leaves age-restricted items on your list for you to handle directly with the retailer: ${restricted.map(x=>title(x.name)).join(', ')}.`);if(!allowed.length)return;wooliesReturnTab.current='home';pending.current=allowed.map(i=>({name:i.name,qty:i.quantity,quantity:i.quantity,unit:i.unit}));injected.current=false;setColesResults(null);setStatus('Checking Coles…');setWebKey(k=>k+1);setMode('coles')}\n"
new="  function compareColes(){if(!canSend)return;const {allowed,restricted}=splitRetailerItems(items);if(restricted.length)Alert.alert('Some items were not automated',`Stuff leaves age-restricted items on your list for you to handle directly with the retailer: ${restricted.map(x=>title(x.name)).join(', ')}.`);if(!allowed.length)return;wooliesReturnTab.current='home';pending.current=allowed.map(i=>({name:i.name,qty:i.quantity,quantity:i.quantity,unit:i.unit}));injected.current=false;setColesResults(null);setStatus('Checking Coles…');armRetailerWatchdog('Coles');setWebKey(k=>k+1);setMode('coles')}\n"
if old not in text: raise SystemExit('compare missing')
text=text.replace(old,new,1)

old="  function onColesMessage(e){let m;try{m=JSON.parse(e.nativeEvent.data)}catch(_){return}if(m?.type==='COLES_STATUS'){setStatus(m.message||'Checking Coles…');return}if(m?.type==='COLES_DONE'){pending.current=[];setColesResults(m);setMode('colesResults');setStatus('')}}\n"
new="  function onColesMessage(e){let m;try{m=JSON.parse(e.nativeEvent.data)}catch(_){return}if(m?.type==='COLES_STATUS'){armRetailerWatchdog('Coles');setStatus(m.message||'Checking Coles…');return}if(m?.type==='COLES_DONE'){clearRetailerWatchdog();pending.current=[];setColesResults(m);setMode('colesResults');setStatus('')}}\n"
if old not in text: raise SystemExit('Coles message missing')
text=text.replace(old,new,1)

old="  function onColesLoad(e){const u=String(e.nativeEvent.url||'').toLowerCase();if(!u.includes('coles.com.au')||injected.current)return;injected.current=true;setStatus('Matching your groceries at Coles…');setTimeout(()=>webRef.current?.injectJavaScript(colesCompareScript(pending.current,preferences)),1000)}\n"
new="  function onColesLoad(e){const u=String(e.nativeEvent.url||'').toLowerCase();if(retailerChallenge(u)){stopForRetailerChallenge('Coles');return}if(/login|sign-in|signin|auth/.test(u)&&pending.current.length){armRetailerWatchdog('Coles',180000);setStatus('Log in to Coles if prompted — Stuff will continue when the retailer is ready.');return}if(!u.includes('coles.com.au')||injected.current)return;injected.current=true;armRetailerWatchdog('Coles');setStatus('Matching your groceries at Coles…');setTimeout(()=>webRef.current?.injectJavaScript(colesCompareScript(pending.current,preferences)),1000)}\n"
if old not in text: raise SystemExit('Coles load missing')
text=text.replace(old,new,1)

# Coles trolley watchdog/challenge.
old="    setStatus(`Adding 1 of ${queue.length}: ${queue[0].request}`);setColesCartUrl(colesProductUrl(queue[0]));setWebKey(k=>k+1);setMode('colesCart');\n"
new="    setStatus(`Adding 1 of ${queue.length}: ${queue[0].request}`);armRetailerWatchdog('Coles trolley',120000);setColesCartUrl(colesProductUrl(queue[0]));setWebKey(k=>k+1);setMode('colesCart');\n"
if old not in text: raise SystemExit('trolley start missing')
text=text.replace(old,new,1)

old="      setStatus(`Done — ${added} ${added===1?'product':'products'} added${failed.length?`, ${failed.length} need review`:''}. Open the Coles trolley at the top right.`);\n      setColesCartUrl('https://www.coles.com.au/');\n"
new="      clearRetailerWatchdog();setStatus(`Done — ${added} ${added===1?'product':'products'} added${failed.length?`, ${failed.length} need review`:''}. Open the Coles trolley at the top right.`);\n      setColesCartUrl('https://www.coles.com.au/');\n"
if old not in text: raise SystemExit('trolley done missing')
text=text.replace(old,new,1)

old="    const item=colesCartQueue.current[next];setStatus(`Adding ${next+1} of ${colesCartQueue.current.length}: ${item.request}`);setColesCartUrl(colesProductUrl(item));\n"
new="    const item=colesCartQueue.current[next];armRetailerWatchdog('Coles trolley',45000);setStatus(`Adding ${next+1} of ${colesCartQueue.current.length}: ${item.request}`);setColesCartUrl(colesProductUrl(item));\n"
if old not in text: raise SystemExit('trolley next missing')
text=text.replace(old,new,1)

old="    const u=String(e.nativeEvent.url||'').toLowerCase();\n    if(/login|sign-in|signin|auth|account/.test(u)){colesCartInjected.current=false;setStatus('Log in to Coles — we’ll continue automatically.');return}\n"
new="    const u=String(e.nativeEvent.url||'').toLowerCase();\n    if(retailerChallenge(u)){stopForRetailerChallenge('Coles');return}\n    if(/login|sign-in|signin|auth|account/.test(u)){colesCartInjected.current=false;armRetailerWatchdog('Coles trolley',180000);setStatus('Log in to Coles — we’ll continue automatically.');return}\n"
if old not in text: raise SystemExit('trolley load marker missing')
text=text.replace(old,new,1)

old="    colesCartInjected.current=true;setStatus(`Adding ${colesCartPos.current+1} of ${colesCartQueue.current.length}: ${item.request}`);\n"
new="    colesCartInjected.current=true;armRetailerWatchdog('Coles trolley',45000);setStatus(`Adding ${colesCartPos.current+1} of ${colesCartQueue.current.length}: ${item.request}`);\n"
if old not in text: raise SystemExit('trolley inject missing')
text=text.replace(old,new,1)

# WebView load-error fallbacks.
old="onMessage={onMessage} onLoadEnd={onLoad} userAgent={UA}"
new="onMessage={onMessage} onLoadEnd={onLoad} onError={()=>retailerLoadError('Woolworths','https://www.woolworths.com.au/')} userAgent={UA}"
if old not in text: raise SystemExit('Woolies WebView props missing')
text=text.replace(old,new,1)

old="onMessage={onColesMessage} onLoadEnd={onColesLoad} userAgent={UA}"
new="onMessage={onColesMessage} onLoadEnd={onColesLoad} onError={()=>retailerLoadError('Coles','https://www.coles.com.au/')} userAgent={UA}"
if old not in text: raise SystemExit('Coles match WebView props missing')
text=text.replace(old,new,1)

old="source={{uri:'https://www.coles.com.au/'}} style={{flex:1}} userAgent={UA}"
new="source={{uri:'https://www.coles.com.au/'}} style={{flex:1}} onError={()=>retailerLoadError('Coles','https://www.coles.com.au/')} userAgent={UA}"
if old not in text: raise SystemExit('Coles site WebView props missing')
text=text.replace(old,new,1)

old="onMessage={onColesCartMessage} onLoadEnd={onColesCartLoad} userAgent={UA}"
new="onMessage={onColesCartMessage} onLoadEnd={onColesCartLoad} onError={()=>retailerLoadError('Coles','https://www.coles.com.au/')} userAgent={UA}"
if old not in text: raise SystemExit('Coles cart WebView props missing')
text=text.replace(old,new,1)

p.write_text(text)
