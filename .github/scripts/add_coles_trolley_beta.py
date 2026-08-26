from pathlib import Path
import re

p = Path('mobile/StuffApp.js')
text = p.read_text()

# Add helpers before BottomNav.
marker = "\nfunction BottomNav({tab,onChange}) {"
if marker not in text:
    raise SystemExit('BottomNav marker missing')
helpers = r'''

function colesProductUrl(item={}) {
  const slug=String(item.product||item.request||'product').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'product';
  return `https://www.coles.com.au/product/${slug}-${item.productId}`;
}

function colesAddToTrolleyScript(item={}) {
  const payload=JSON.stringify({
    name:item.request||item.product||'item',
    productId:item.productId,
    quantity:Math.max(1,Math.min(6,Math.round(Number(item.quantity)||1))),
  });
  return `
(async()=>{
 const item=${payload},sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const post=(type,message,extra={})=>{try{window.ReactNativeWebView.postMessage(JSON.stringify({type,message,...extra}))}catch(_){}};
 const visible=el=>!!el&&el.offsetParent!==null&&!el.disabled;
 const buttons=()=>Array.from(document.querySelectorAll('button')).filter(visible);
 const addButton=()=>buttons().find(b=>/^(add|add to trolley)$/i.test(String(b.innerText||b.textContent||'').trim())||/add to trolley/i.test(String(b.getAttribute('aria-label')||'')));
 const plusButton=()=>buttons().find(b=>/increase|increment|add one|increase quantity/i.test(String(b.getAttribute('aria-label')||b.getAttribute('title')||''))||String(b.innerText||b.textContent||'').trim()==='+');
 const body=()=>String(document.body?.innerText||'').toLowerCase();
 const loginPrompt=()=>/log in \/ sign up|log in to coles|sign in to coles/.test(body())||Array.from(document.querySelectorAll('[role="dialog"]')).some(x=>/log in|sign up/i.test(String(x.innerText||'')));
 const inTrolley=()=>/product is in your trolley/.test(body())||buttons().some(b=>/remove from trolley|decrease quantity/i.test(String(b.getAttribute('aria-label')||'')));
 try{
   post('COLES_CART_STATUS','Adding '+item.name+'…');
   let already=inTrolley(),clicked=false;
   if(!already){
     let add=null;
     for(let i=0;i<24&&!add;i++){add=addButton();if(!add)await sleep(250)}
     if(!add){post('COLES_CART_ITEM_DONE','Could not find Coles Add to trolley for '+item.name+'.',{success:false,name:item.name});return true}
     add.click();clicked=true;
     await sleep(900);
     if(loginPrompt()){
       post('COLES_CART_LOGIN','Log in to Coles — we’ll continue automatically.');
       for(let i=0;i<180&&loginPrompt();i++)await sleep(1000);
       if(loginPrompt())return true;
       await sleep(800);
       if(!inTrolley()){
         add=addButton();
         if(add){add.click();clicked=true;await sleep(1000)}
       }
     }
   }
   let actual=1;
   if(item.quantity>1){
     for(let n=1;n<item.quantity;n++){
       let plus=null;
       for(let i=0;i<12&&!plus;i++){plus=plusButton();if(!plus)await sleep(200)}
       if(!plus)break;
       plus.click();actual++;await sleep(450);
     }
   }
   const success=inTrolley()||clicked;
   post('COLES_CART_ITEM_DONE',success?'Added '+item.name+'.':'Could not confirm '+item.name+' was added.',{success,name:item.name,actualQuantity:actual});
 }catch(e){post('COLES_CART_ITEM_DONE','Could not add '+item.name+'.',{success:false,name:item.name,error:String(e?.message||e)})}
 return true;
})();true;`;
}
'''
text = text.replace(marker, helpers + marker, 1)

# Add cart refs.
old_refs = "  const webRef = useRef(null), pending = useRef([]), injected = useRef(false), retries = useRef(0), wooliesReturnTab = useRef('home');\n"
new_refs = old_refs + "  const colesCartQueue=useRef([]),colesCartPos=useRef(0),colesCartAdded=useRef(0),colesCartFailed=useRef([]),colesCartInjected=useRef(false);\n"
if old_refs not in text:
    raise SystemExit('refs anchor missing')
text = text.replace(old_refs,new_refs,1)

old_state = "  const [colesResults,setColesResults]=useState(null);\n"
new_state = old_state + "  const [colesCartUrl,setColesCartUrl]=useState('https://www.coles.com.au/');\n"
if old_state not in text:
    raise SystemExit('Coles state anchor missing')
text = text.replace(old_state,new_state,1)

# Add trolley functions after onColesLoad.
anchor = "  function onColesLoad(e){const u=String(e.nativeEvent.url||'').toLowerCase();if(!u.includes('coles.com.au')||injected.current)return;injected.current=true;setStatus('Matching your groceries at Coles…');setTimeout(()=>webRef.current?.injectJavaScript(colesCompareScript(pending.current,preferences)),1000)}\n"
if anchor not in text:
    raise SystemExit('onColesLoad anchor missing')
funcs = anchor + r'''  function startColesTrolley(){
    const queue=(colesResults?.matches||[]).filter(x=>x?.productId);
    if(!queue.length){Alert.alert('Coles trolley','There are no confident Coles matches to add yet.');return}
    colesCartQueue.current=queue;colesCartPos.current=0;colesCartAdded.current=0;colesCartFailed.current=[];colesCartInjected.current=false;
    setStatus(`Adding 1 of ${queue.length}: ${queue[0].request}`);setColesCartUrl(colesProductUrl(queue[0]));setWebKey(k=>k+1);setMode('colesCart');
  }
  function onColesCartMessage(e){
    let m;try{m=JSON.parse(e.nativeEvent.data)}catch(_){return}
    if(m?.type==='COLES_CART_STATUS'||m?.type==='COLES_CART_LOGIN'){setStatus(m.message||'Working with Coles…');return}
    if(m?.type!=='COLES_CART_ITEM_DONE')return;
    const current=colesCartQueue.current[colesCartPos.current];
    if(m.success)colesCartAdded.current+=1;else colesCartFailed.current.push(current?.request||m.name||'item');
    const next=colesCartPos.current+1;
    if(next>=colesCartQueue.current.length){
      const added=colesCartAdded.current,failed=colesCartFailed.current;
      setStatus(`Done — ${added} ${added===1?'product':'products'} added${failed.length?`, ${failed.length} need review`:''}. Open the Coles trolley at the top right.`);
      setColesCartUrl('https://www.coles.com.au/');
      colesCartQueue.current=[];colesCartInjected.current=false;return;
    }
    colesCartPos.current=next;colesCartInjected.current=false;
    const item=colesCartQueue.current[next];setStatus(`Adding ${next+1} of ${colesCartQueue.current.length}: ${item.request}`);setColesCartUrl(colesProductUrl(item));
  }
  function onColesCartLoad(e){
    if(!colesCartQueue.current.length)return;
    const u=String(e.nativeEvent.url||'').toLowerCase();
    if(/login|sign-in|signin|auth|account/.test(u)){colesCartInjected.current=false;setStatus('Log in to Coles — we’ll continue automatically.');return}
    const item=colesCartQueue.current[colesCartPos.current];
    if(!item||!u.includes('coles.com.au/product/')||colesCartInjected.current)return;
    colesCartInjected.current=true;setStatus(`Adding ${colesCartPos.current+1} of ${colesCartQueue.current.length}: ${item.request}`);
    setTimeout(()=>webRef.current?.injectJavaScript(colesAddToTrolleyScript(item)),850);
  }
'''
text = text.replace(anchor,funcs,1)

# Add beta WebView mode before results screen.
results_marker = "  if(mode==='colesResults')return <SafeAreaView style={s.safe}>\n"
if results_marker not in text:
    raise SystemExit('Coles results render marker missing')
cart_render = r'''  if(mode==='colesCart')return <SafeAreaView style={s.safe}><StatusBar barStyle="dark-content"/><View style={s.cartHead}><TouchableOpacity onPress={()=>setMode('colesResults')} style={s.back}><Text style={s.backText}>‹ Coles matches</Text></TouchableOpacity><View style={{flex:1}}><Text style={s.cartTitle}>Building Coles trolley</Text><Text style={s.cartStatus} numberOfLines={2}>{status}</Text></View></View><WebView key={`coles-cart-${webKey}`} ref={webRef} source={{uri:colesCartUrl}} style={{flex:1}} onMessage={onColesCartMessage} onLoadEnd={onColesCartLoad} userAgent={UA} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled cacheEnabled incognito={false} setSupportMultipleWindows={false}/></SafeAreaView>;

'''
text = text.replace(results_marker,cart_render+results_marker,1)

# Replace results action and note.
old_btn = "      <TouchableOpacity style={s.colesButton} onPress={()=>{wooliesReturnTab.current='home';setWebKey(k=>k+1);setMode('colesSite')}}><Text style={s.colesButtonText}>Open Coles</Text></TouchableOpacity>\n      <Text style={s.formNote}>This is price and product matching only. Stuff is not yet adding these Coles matches directly to the Coles cart.</Text>\n"
new_btn = "      {!!colesResults?.matches?.length&&<TouchableOpacity style={s.colesButton} onPress={startColesTrolley}><Text style={s.colesButtonText}>Build Coles trolley · beta</Text></TouchableOpacity>}\n      <TouchableOpacity style={s.secondaryButton} onPress={()=>{wooliesReturnTab.current='home';setWebKey(k=>k+1);setMode('colesSite')}}><Text style={s.secondaryButtonText}>Open Coles only</Text></TouchableOpacity>\n      <Text style={s.formNote}>Beta trolley handoff uses Coles’s own product pages and Add to trolley controls. If Coles asks you to log in, do that in the Coles screen and Stuff will continue. Always review the trolley before checkout.</Text>\n"
if old_btn not in text:
    raise SystemExit('Coles result button block missing')
text = text.replace(old_btn,new_btn,1)

p.write_text(text)
