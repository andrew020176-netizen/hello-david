import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, Share, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';

const AUDIO_URL = 'https://wfhgyunfvdyxwtggntpc.supabase.co/functions/v1/hello-david-process-audio';
const CART_URL = 'https://www.woolworths.com.au/shop/cart';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const norm = v => String(v || '').trim().toLowerCase();
const title = v => { const s = String(v || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : ''; };
const detail = item => {
  const q = Number(item.quantity ?? item.qty ?? 1) || 1;
  const u = String(item.unit || '').trim();
  if (!u) return q === 1 ? '1 item' : `${q} items`;
  if (q === 1 && /^\d/.test(u)) return u;
  return `${q} ${u}`;
};

function mergeItems(current, actions) {
  let next = [...current];
  for (const r of actions?.remove || []) {
    const n = norm(r);
    next = next.filter(x => norm(x.name) !== n);
  }
  for (const a of actions?.add || []) {
    const name = String(a?.name || '').trim();
    if (!name) continue;
    const idx = next.findIndex(x => norm(x.name) === norm(name));
    const row = {
      id: idx >= 0 ? next[idx].id : `${Date.now()}-${Math.random()}`,
      name,
      quantity: Number(a.quantity) || 1,
      unit: String(a.unit || '').trim()
    };
    if (idx >= 0) next[idx] = row;
    else next.push(row);
  }
  return next;
}

function wooliesScript(items) {
  const payload = JSON.stringify(items.slice(0, 60));
  return `
(async()=>{
 const items=${payload},sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const post=(type,message,extra={})=>{try{window.ReactNativeWebView.postMessage(JSON.stringify({type,message,...extra}))}catch(_){}};
 const txt=p=>(String(p.DisplayName||p.Name||'')+' '+String(p.Brand||'')+' '+String(p.PackageSize||'')).toLowerCase();
 const req=i=>(String(i.name||'')+' '+String(i.unit||'')).toLowerCase();
 const unit=v=>String(v||'').toLowerCase().replace(/litres?/g,'l').replace(/millilitres?/g,'ml').replace(/kilograms?/g,'kg').replace(/grams?/g,'g').trim();
 const base=(n,u)=>(u==='kg'||u==='l')?n*1000:(u==='g'||u==='ml')?n:null;
 const measure=i=>{const s=req(i),m=s.match(/\\b(\\d+(?:\\.\\d+)?)\\s*(kg|g|l|ml)\\b/i);if(m)return{n:+m[1],u:m[2],b:base(+m[1],m[2])};const q=+(i.qty??i.quantity??1),u=unit(i.unit);return /^(kg|g|l|ml)$/.test(u)?{n:q,u,b:base(q,u)}:null};
 const pMeasure=p=>{const m=txt(p).match(/\\b(\\d+(?:\\.\\d+)?)\\s*(kg|g|l|ml)\\b/i);return m?{n:+m[1],u:m[2],b:base(+m[1],m[2])}:null};
 const query=i=>{let q=String(i.name||'').replace(/\\b(on special|cheapest|best value|value option)\\b/gi,'').trim().replace(/weet\\s*-?\\s*a?bix|weetbix|weet bix/gi,'Weet-Bix');if(/baby (roma )?tomato/i.test(req(i)))q='cherry tomatoes';const m=measure(i);if(m&&!q.toLowerCase().includes(String(m.n)+m.u))q+=' '+m.n+m.u;return q};
 const words=s=>String(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(w=>w&&!['the','a','an','of','and','for','pack','packet','bag','box','large','small','medium'].includes(w));
 const bad=(i,p)=>{const r=req(i),t=txt(p);if(/baby (roma )?tomato/.test(r)){if(!t.includes('tomato')||!['cherry','grape','cocktail','solanato','mini'].some(x=>t.includes(x)))return true;if(['diced','crushed','peeled','passata','paste','sauce','canned','tinned','mutti'].some(x=>t.includes(x)))return true}if(r.includes('tomato')&&['diced','crushed','peeled','passata','paste','sauce','canned','tinned'].some(x=>t.includes(x)))return true;if(r.includes('carrot')&&!r.includes('baby')&&t.includes('baby carrot'))return true;if(r.includes('bread')&&['bread mix','flour','breadcrumb'].some(x=>t.includes(x)))return true;const a=measure(i),b=pMeasure(p);if(a?.b&&b?.b){const ratio=b.b/a.b;if(ratio<.6||ratio>1.55)return true}return false};
 const score=(i,p)=>{if(bad(i,p))return-9999;const q=query(i),t=txt(p),ws=words(q);let s=ws.filter(w=>t.includes(w)).length*16;if(t.includes(q.toLowerCase()))s+=45;const r=req(i),a=measure(i),b=pMeasure(p);if(a?.b){if(!b?.b)s-=50;else{const x=b.b/a.b;s+=x>=.95&&x<=1.05?140:x>=.85&&x<=1.15?80:x>=.7&&x<=1.3?25:-200}}if(/\\b(large|big|family)\\b/.test(r)&&b?.b)s+=Math.min(70,b.b/20);if(/baby (roma )?tomato/.test(r)&&['cherry','grape','cocktail','mini'].some(x=>t.includes(x)))s+=150;if(r.includes('white bread')&&t.includes('white')&&(t.includes('bread')||t.includes('loaf')))s+=60;if(p.IsOnSpecial)s+=5;if(p.IsAvailable===false||p.IsInStock===false)s-=200;return s};
 async function search(i){const q=query(i),res=await fetch('/apis/ui/Search/products',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/plain, */*'},credentials:'same-origin',body:JSON.stringify({Filters:[],IsSpecial:false,Location:'/shop/search/products?searchTerm='+encodeURIComponent(q),PageNumber:1,PageSize:30,SearchTerm:q,SortType:'TraderRelevance',IsHideEverydayMarketProducts:false,ExcludeSearchTypes:['UntraceableVendors'],GpBoost:0,GroupEdmVariants:false,EnableAdReRanking:false})});if(!res.ok)throw Error('search');const d=await res.json(),out=[];for(const g of d?.Products||[])for(const p of g?.Products||[])out.push(p);return out}
 const cartQty=i=>{const q=+(i.qty??i.quantity??1)||1;if(measure(i))return 1;return Math.max(1,Math.min(6,Math.round(q)))};
 async function add(i,p){const res=await fetch('/api/v3/ui/trolley/update',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/plain, */*'},credentials:'same-origin',body:JSON.stringify({items:[{stockcode:+p.Stockcode,quantity:cartQty(i),source:p.Source||'SearchServiceSearchProducts',diagnostics:p.Diagnostics||'0',searchTerm:query(i),evaluateRewardPoints:false,offerId:p.OfferId??null,profileId:null,priceLevel:null}]})});if(!res.ok)return false;const raw=await res.text();try{const d=raw?JSON.parse(raw):null;if(d&&(d.Success===false||d.success===false))return false}catch(_){}return true}
 try{post('WOOLIES_STATUS','Matching your groceries…');const chosen=[],unmatched=[],used=new Set();for(let n=0;n<items.length;n++){const i=items[n];post('WOOLIES_STATUS','Matching '+(n+1)+' of '+items.length+': '+i.name);let ps=[];try{ps=await search(i)}catch(_){unmatched.push(i.name);continue}ps.sort((a,b)=>score(i,b)-score(i,a)||+(a.Price||999)-+(b.Price||999));const p=ps[0],ws=words(query(i)),hits=p?ws.filter(w=>txt(p).includes(w)).length:0;if(!p||!p.Stockcode||score(i,p)<20||hits<(ws.length===1?1:Math.min(2,ws.length))||used.has(String(p.Stockcode))){unmatched.push(i.name);continue}used.add(String(p.Stockcode));chosen.push([i,p]);await sleep(120)}let added=0,failed=0;for(let n=0;n<chosen.length;n++){post('WOOLIES_STATUS','Adding '+(n+1)+' of '+chosen.length+': '+chosen[n][0].name);(await add(...chosen[n]))?added++:failed++;await sleep(220)}const message=added+' products added.'+(unmatched.length?' Could not confidently match: '+unmatched.join(', ')+'.':'')+(failed?' '+failed+' failed to add.':'');post('WOOLIES_DONE',message,{added,failed,unmatched,success:added>0})}catch(e){post('WOOLIES_DONE','Could not finish the Woolies shop.',{added:0,success:false})}
 return true;
})();true;`;
}

export default function StuffApp() {
  const webRef = useRef(null), pending = useRef([]), injected = useRef(false), retries = useRef(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);
  const [mode,setMode]=useState('shop'),[items,setItems]=useState([]),[open,setOpen]=useState(true),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[cartUrl,setCartUrl]=useState(CART_URL),[webKey,setWebKey]=useState(0);
  const recording=!!recState?.isRecording,count=items.length,canSend=count>0&&!busy&&!recording;
  const listLabel=useMemo(()=>count?`Your list · ${count} ${count===1?'item':'items'}`:'Your list',[count]);

  async function processAudio(uri){
    if(!uri){setStatus("Couldn't save that recording. Try again.");return}
    setBusy(true);
    setStatus('Sorting your groceries…');
    try{
      const form=new FormData();
      form.append('audio',{uri,name:`stuff-shopping-${Date.now()}.m4a`,type:'audio/mp4'});
      form.append('existingShop',JSON.stringify(items));
      const res=await fetch(AUDIO_URL,{method:'POST',body:form}),data=await res.json().catch(()=>({}));
      if(!res.ok||!data?.success)throw Error(data?.error||'Could not process that recording.');
      const next=mergeItems(items,data.actions||{});
      setItems(next);
      setOpen(true);
      setStatus(next.length?'':'Nothing on your list.');
    }catch(e){setStatus(e?.message||'Could not process that recording.')}finally{setBusy(false)}
  }

  async function start(){try{const p=await requestRecordingPermissionsAsync();if(!p.granted){Alert.alert('Microphone access needed','Allow microphone access so you can speak your grocery list.');return}await setAudioModeAsync({playsInSilentMode:true,allowsRecording:true});await recorder.prepareToRecordAsync();recorder.record();setStatus('Listening… tap Stop when you’re finished.')}catch(_){setStatus("Couldn't start the microphone. Try again.")}}
  async function stop(){try{setStatus('Finishing…');await recorder.stop();const uri=recorder.uri||recState?.url;await setAudioModeAsync({allowsRecording:false});await processAudio(uri)}catch(_){setBusy(false);setStatus("Couldn't finish that recording. Try again.")}}
  async function share(){if(!items.length){setStatus('Add some groceries first.');return}try{await Share.share({message:['Our grocery list:',...items.map(i=>`• ${title(i.name)} — ${detail(i)}`)].join('\n')})}catch(_){}}
  function editItem(item){if(!item)return;Alert.prompt('Edit item','Update the item name:',value=>{const name=String(value||'').trim();if(!name)return;setItems(v=>v.map(x=>x.id===item.id?{...x,name}:x));setStatus('');},'plain-text',title(item.name))}
  function clearAll(){if(!items.length)return;Alert.alert('Clear your list?','Remove all groceries from this list?',[{text:'Cancel',style:'cancel'},{text:'Clear all',style:'destructive',onPress:()=>{setItems([]);setOpen(true);setStatus('')}}])}
  function send(){if(!canSend)return;pending.current=items.map(i=>({name:i.name,qty:i.quantity,quantity:i.quantity,unit:i.unit}));injected.current=false;retries.current=0;setStatus('Connecting to Woolies…');setCartUrl('https://www.woolworths.com.au/');setWebKey(k=>k+1);setMode('woolies')}
  function back(){pending.current=[];injected.current=false;retries.current=0;setMode('shop');setStatus('')}
  function openCart(){setStatus('Opening your Woolies cart…');setCartUrl(CART_URL+'?stuffShopping='+Date.now())}
  function onMessage(e){let m;try{m=JSON.parse(e.nativeEvent.data)}catch(_){return}if(m?.type==='WOOLIES_STATUS'){setStatus(m.message||'Building your Woolies cart…');return}if(m?.type==='WOOLIES_DONE'){const added=Number(m.added||0);pending.current=[];setStatus(added?`Done — ${added} ${added===1?'product':'products'} added.`:(m.message||'Nothing was added.'));if(added)setTimeout(openCart,350)}}
  function onLoad(e){
    const u=String(e.nativeEvent.url||'');
    const lower=u.toLowerCase();
    if(!pending.current.length){if(lower.includes('/shop/cart'))setStatus('Cart ready.');return}
    if(injected.current)return;
    if(!lower.includes('woolworths.com.au')){setStatus('Connecting to Woolies…');return}
    if(/login|sign-in|signin|verify|auth/.test(lower)){setStatus('Log in to Woolies — we’ll continue automatically.');return}
    injected.current=true;
    setStatus('Matching your groceries…');
    setTimeout(()=>webRef.current?.injectJavaScript(wooliesScript(pending.current)),1000);
  }

  function future(label){Alert.alert(label,`${label} is the next part of the app we’ll wire up.`)}

  if(mode==='woolies')return <SafeAreaView style={s.safe}><StatusBar barStyle="dark-content"/><View style={s.cartHead}><TouchableOpacity onPress={back} style={s.back}><Text style={s.backText}>‹ Shop</Text></TouchableOpacity><View style={{flex:1}}><Text style={s.cartTitle}>Woolies</Text><Text style={s.cartStatus} numberOfLines={1}>{status}</Text></View></View><WebView key={webKey} ref={webRef} source={{uri:cartUrl}} style={{flex:1}} onMessage={onMessage} onLoadEnd={onLoad} userAgent={UA} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled cacheEnabled incognito={false} setSupportMultipleWindows={false}/></SafeAreaView>;

  return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.screen}>
      <Text style={s.brand}>stuff{`\n`}the{`\n`}shopping<Text style={s.dot}>.</Text></Text>

      <View style={s.intro}>
        <Text style={s.tag}>We’ll do the groceries.</Text>
        <Text style={s.question}>What do you need?</Text>
      </View>

      <TouchableOpacity style={[s.speak,recording&&s.stop,busy&&s.disabled]} onPress={recording?stop:start} disabled={busy}>
        {busy?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.speakIcon}>{recording?'■':'●'}</Text>}
        <Text style={s.speakText}>{busy?'Sorting…':recording?'Stop':'Tap to talk'}</Text>
      </TouchableOpacity>

      {!!status&&<Text style={s.status}>{status}</Text>}

      <View style={s.listBlock}>
        <View style={s.listTop}>
          <TouchableOpacity style={s.listToggle} onPress={()=>setOpen(v=>!v)}>
            <Text style={s.listTitle}>{listLabel}</Text>
            <Text style={s.chev}>{open?'⌃':'⌄'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.share} onPress={share}>
            <Text style={s.shareText}>↗ Share</Text>
          </TouchableOpacity>
        </View>

        {open&&<View style={s.listRows}>
          {!count?<Text style={s.empty}>Nothing here yet.</Text>:items.map(i=><View key={i.id} style={s.row}>
            <View style={{flex:1}}>
              <Text style={s.item}>{title(i.name)}</Text>
              <Text style={s.detail}>{detail(i)}</Text>
            </View>
            <TouchableOpacity style={s.edit} onPress={()=>editItem(i)}>
              <Text style={s.editText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.remove} onPress={()=>setItems(v=>v.filter(x=>x.id!==i.id))}>
              <Text style={s.removeText}>×</Text>
            </TouchableOpacity>
          </View>)}
          {count>0&&<View style={s.clearRow}>
            <TouchableOpacity onPress={clearAll} style={s.clearBottom}><Text style={s.clearBottomText}>Clear list</Text></TouchableOpacity>
            <Text style={s.itemCount}>{count} {count===1?'item':'items'}</Text>
          </View>}
        </View>}
      </View>

      <TouchableOpacity style={[s.send,!canSend&&s.sendOff]} onPress={send} disabled={!canSend}>
        <View style={s.wooliesMark}><Text style={s.wooliesMarkText}>W</Text></View>
        <View style={s.sendCopy}>
          <Text style={s.sendText}>Send to Woolies</Text>
          <Text style={s.sendSub}>Add to your Woolworths cart</Text>
        </View>
        <Text style={s.sendArrow}>›</Text>
      </TouchableOpacity>
      <Text style={s.note}>We’ll build your Woolies cart. You review it before checkout.</Text>
    </ScrollView>

    <View style={s.bottomNav}>
      <TouchableOpacity style={s.navItem}><Text style={s.navIcon}>⌂</Text><Text style={s.navLabelActive}>Home</Text></TouchableOpacity>
      <TouchableOpacity style={s.navItem} onPress={()=>future('Household')}><Text style={s.navIcon}>◫</Text><Text style={s.navLabel}>Household</Text></TouchableOpacity>
      <TouchableOpacity style={s.navItem} onPress={()=>future('Account')}><Text style={s.navIcon}>◎</Text><Text style={s.navLabel}>Account</Text></TouchableOpacity>
      <TouchableOpacity style={s.navItem} onPress={()=>future('More')}><Text style={s.navMore}>•••</Text><Text style={s.navLabel}>More</Text></TouchableOpacity>
    </View>
  </SafeAreaView>;
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F7F1E3'},
  screen:{padding:22,paddingTop:14,paddingBottom:22},
  brand:{color:'#171717',fontSize:29,lineHeight:25,fontWeight:'900',letterSpacing:-1.5},
  dot:{color:'#F4512C'},
  intro:{marginTop:36},
  tag:{fontSize:17,color:'#55514A',fontWeight:'600'},
  question:{marginTop:6,fontSize:33,lineHeight:36,color:'#171717',fontWeight:'900',letterSpacing:-1.2},
  speak:{marginTop:18,minHeight:60,borderRadius:30,backgroundColor:'#F4512C',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
  stop:{backgroundColor:'#F5D95E'},
  disabled:{opacity:.65},
  speakIcon:{fontSize:18,color:'#FFFFFF'},
  speakText:{color:'#FFFFFF',fontSize:19,fontWeight:'900'},
  status:{marginTop:8,color:'#55514A',fontSize:13,lineHeight:18,textAlign:'center'},
  listBlock:{marginTop:6},
  listTop:{minHeight:46,flexDirection:'row',alignItems:'center',gap:10},
  listToggle:{flex:1,flexDirection:'row',alignItems:'center',gap:7,minHeight:42},
  listTitle:{color:'#171717',fontSize:18,fontWeight:'900'},
  chev:{color:'#171717',fontSize:20,fontWeight:'900'},
  share:{minHeight:32,paddingHorizontal:9,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,borderColor:'#BEB6A7',alignItems:'center',justifyContent:'center'},
  shareText:{color:'#55514A',fontSize:12,fontWeight:'800'},
  listRows:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#BEB6A7'},
  empty:{color:'#777169',paddingVertical:12},
  row:{minHeight:54,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#BEB6A7'},
  item:{color:'#171717',fontSize:16,fontWeight:'800'},
  detail:{marginTop:2,color:'#69635A',fontSize:12,fontWeight:'600'},
  edit:{minWidth:44,height:36,alignItems:'center',justifyContent:'center'},
  editText:{color:'#69635A',fontSize:12,fontWeight:'800',textDecorationLine:'underline'},
  remove:{width:34,height:40,alignItems:'center',justifyContent:'center'},
  removeText:{fontSize:24,color:'#69635A'},
  clearRow:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  clearBottom:{paddingVertical:8,paddingRight:10},
  clearBottomText:{color:'#171717',fontSize:13,fontWeight:'800',textDecorationLine:'underline'},
  itemCount:{color:'#69635A',fontSize:12,fontWeight:'700'},
  send:{marginTop:8,minHeight:60,borderRadius:16,backgroundColor:'#006B54',paddingHorizontal:14,flexDirection:'row',alignItems:'center'},
  sendOff:{opacity:.28},
  wooliesMark:{width:38,height:38,borderRadius:19,backgroundColor:'#8CC63F',alignItems:'center',justifyContent:'center',marginRight:12},
  wooliesMarkText:{color:'#FFFFFF',fontSize:20,fontWeight:'900',fontStyle:'italic'},
  sendCopy:{flex:1},
  sendText:{color:'#FFFFFF',fontSize:17,fontWeight:'900'},
  sendSub:{marginTop:2,color:'#E5F1ED',fontSize:11,fontWeight:'600'},
  sendArrow:{color:'#FFFFFF',fontSize:34,lineHeight:36,fontWeight:'300',marginLeft:7},
  note:{marginTop:7,color:'#69635A',fontSize:11,lineHeight:15,textAlign:'center'},
  bottomNav:{minHeight:82,backgroundColor:'#000000',paddingHorizontal:12,paddingTop:10,paddingBottom:10,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},
  navItem:{flex:1,alignItems:'center',justifyContent:'center'},
  navIcon:{color:'#FFFFFF',fontSize:26,lineHeight:28,fontWeight:'700'},
  navMore:{color:'#FFFFFF',fontSize:23,lineHeight:28,fontWeight:'900',letterSpacing:2},
  navLabel:{marginTop:3,color:'#FFFFFF',fontSize:11,fontWeight:'700'},
  navLabelActive:{marginTop:3,color:'#FFFFFF',fontSize:11,fontWeight:'900'},
  cartHead:{minHeight:64,paddingHorizontal:12,paddingVertical:8,backgroundColor:'#F7F1E3',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#C9C1B4',flexDirection:'row',alignItems:'center'},
  back:{padding:10},
  backText:{fontSize:16,fontWeight:'900'},
  cartTitle:{fontSize:15,fontWeight:'900'},
  cartStatus:{marginTop:2,color:'#69635A',fontSize:11}
});