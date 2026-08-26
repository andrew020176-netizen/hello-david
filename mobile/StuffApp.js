import React, { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Alert, Linking, SafeAreaView, ScrollView, Share, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useStuffAuth } from './AuthContext';
import regressionShop from './test-fixtures/regression-shop-v1.json';
import {
  cancelStuffInvite,
  createStuffInvite,
  createStuffSupportRequest,
  clearStuffHouseholdProductMemory,
  deleteStuffAccount,
  forgetStuffHouseholdProduct,
  loadStuffBundle,
  rememberStuffHouseholdProduct,
  removeStuffMember,
  saveStuffHouseholdName,
  saveStuffList,
  saveStuffPreferences,
  saveStuffProfile,
  subscribeStuffList,
} from './stuffData';

const AUDIO_URL = 'https://wfhgyunfvdyxwtggntpc.supabase.co/functions/v1/hello-david-process-audio';
const CART_URL = 'https://www.woolworths.com.au/shop/cart';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const LEGAL_VERSION = '2026-08-26-v1';
const PRIVACY_URL = 'https://stufftheshopping.com.au/privacy.html';
const TERMS_URL = 'https://stufftheshopping.com.au/terms.html';
const RESTRICTED_RE = /\b(alcohol|alcoholic|beer|lager|ale|cider|wine|champagne|prosecco|spirits?|vodka|gin|whisk(?:y|ey)|bourbon|rum|tequila|liqueur|cigarettes?|cigars?|tobacco|nicotine|vapes?|vaping|e[- ]?cigarettes?)\b/i;
const norm = v => String(v || '').trim().toLowerCase();
const title = v => { const s = String(v || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : ''; };
const detail = item => {
  const q = Number(item.quantity ?? item.qty ?? 1) || 1;
  const u = String(item.unit || '').trim();
  if (!u) return q === 1 ? '1 item' : `${q} items`;
  if (q === 1 && /^\d/.test(u)) return u;
  return `${q} ${u}`;
};

function splitRetailerItems(sourceItems) {
  const allowed=[],restricted=[];
  for(const item of sourceItems||[]){(RESTRICTED_RE.test(String(item?.name||''))?restricted:allowed).push(item)}
  return {allowed,restricted};
}

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

function wooliesScript(items, preferences={}, productMemory=[]) {
  const payload = JSON.stringify(items.slice(0, 60));
  const memoryPayload = JSON.stringify((productMemory||[]).slice(0,120));
  const prefsPayload = JSON.stringify({
    matchMode: preferences.matchMode==='cheapest'?'cheapest':'best',
    preferSpecials: preferences.preferSpecials!==false,
    allowAlternatives: preferences.allowAlternatives!==false,
    rememberBrands: preferences.rememberBrands!==false,
  });
  return `
(async()=>{
 const items=${payload},prefs=${prefsPayload},memories=${memoryPayload},sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const post=(type,message,extra={})=>{try{window.ReactNativeWebView.postMessage(JSON.stringify({type,message,...extra}))}catch(_){}};
 const txt=p=>(String(p.DisplayName||p.Name||'')+' '+String(p.Brand||'')+' '+String(p.PackageSize||'')).toLowerCase();
 const req=i=>(String(i.name||'')+' '+String(i.unit||'')).toLowerCase();
 const memoryKey=v=>String(v||'').toLowerCase().replace(/\b(on special|cheapest|best value|value option)\b/g,'').replace(/\s+/g,' ').trim();
 const memoryFor=i=>memories.find(m=>String(m.request_key||'')===memoryKey(i.name));
 const unit=v=>String(v||'').toLowerCase().replace(/litres?/g,'l').replace(/millilitres?/g,'ml').replace(/kilograms?/g,'kg').replace(/grams?/g,'g').trim();
 const base=(n,u)=>(u==='kg'||u==='l')?n*1000:(u==='g'||u==='ml')?n:null;
 const measure=i=>{const s=req(i),m=s.match(/\\b(\\d+(?:\\.\\d+)?)\\s*(kg|g|l|ml)\\b/i);if(m)return{n:+m[1],u:m[2],b:base(+m[1],m[2])};const q=+(i.qty??i.quantity??1),u=unit(i.unit);return /^(kg|g|l|ml)$/.test(u)?{n:q,u,b:base(q,u)}:null};
 const pMeasure=p=>{const m=txt(p).match(/\\b(\\d+(?:\\.\\d+)?)\\s*(kg|g|l|ml)\\b/i);return m?{n:+m[1],u:m[2],b:base(+m[1],m[2])}:null};
 const requestQty=i=>Math.max(1,+(i.qty??i.quantity??1)||1);
 const unitText=i=>String(i.unit||'').toLowerCase();
 const packIntent=i=>{const s=req(i),q=requestQty(i);let m=s.match(/\\bpack of\\s*(\\d+)\\b/i);if(m)return +m[1];m=s.match(/\\b(\\d+)\\s*(?:can\\s*)?pack\\b/i);if(m)return +m[1];m=s.match(/\\b(\\d+)\\s*(?:cans?|rolls?|eggs?|muffins?)\\b/i);if(m)return +m[1];if(/\\beggs?\\b/.test(s)&&q>=6)return q;return null};
 const pPackCount=p=>{const t=txt(p);let m=t.match(/\\b(\\d+)\\s*(?:pack|pk|cans?|rolls?|muffins?)\\b/i);if(m)return +m[1];m=t.match(/\\bpack of\\s*(\\d+)\\b/i);if(m)return +m[1];m=t.match(/\\b(\\d+)\\s+(?:[a-z-]+\\s+){0,6}eggs?\\b/i);if(m)return +m[1];return null};
 const requiresPack=i=>{const r=req(i);return !!packIntent(i)&&/(eggs?|rolls?|toilet|coca|cola|muffins?)/.test(r)};
 const query=i=>{let q=String(i.name||'').replace(/\\b(cheapest suitable|on special|cheapest|best value|value option)\\b/gi,'').replace(/\\s+/g,' ').trim().replace(/weet\\s*-?\\s*a?bix|weetbix|weet bix/gi,'Weet-Bix');const r=req(i);if(/baby (roma )?tomato/i.test(r))q='cherry tomatoes';const m=measure(i);if(m&&!q.toLowerCase().includes(String(m.n)+m.u))q+=' '+m.n+m.u;const pc=packIntent(i);if(pc){if(/coca|cola/.test(r))q+=' '+pc+' can pack';else q+=' '+pc+' pack'}if(/\\bbag\\b/.test(unitText(i))&&!/\\bbag\\b/i.test(q))q+=' bag';if(r.includes('salmon')&&r.includes('fillet')&&requestQty(i)>1)q+=' '+requestQty(i)+' fillets';return q};
 const words=s=>String(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(w=>w&&!['the','a','an','of','and','for','pack','packet','bag','box','large','small','medium','suitable'].includes(w));
 const bad=(i,p)=>{const r=req(i),t=txt(p),u=unitText(i);if(r.includes('muffin')&&/(mould|mold|silicone|baking tray|muffin tray|muffin pan|cupcake case|liner)/.test(t))return true;if(r.includes('chicken breast')&&!/(nugget|crumb|schnitzel|tender|strip|kiev|burger)/.test(r)&&/(nugget|crumbed|schnitzel|tender|strip|kiev|burger)/.test(t))return true;if(r.includes('full cream milk')&&!r.includes('lactose')&&t.includes('lactose'))return true;if(/weet[- ]?bix/.test(r)&&!r.includes('bites')&&t.includes('bites'))return true;if(r.includes('shapes')&&/(cabanossi|trios|salami|ham snack)/.test(t))return true;if(/\\bbag\\b/.test(u)&&/\\beach\\b/.test(t))return true;if(/baby (roma )?tomato/.test(r)){if(!t.includes('tomato')||!['cherry','grape','cocktail','solanato','mini'].some(x=>t.includes(x)))return true;if(['diced','crushed','peeled','passata','paste','sauce','canned','tinned','mutti'].some(x=>t.includes(x)))return true}else if(r.includes('tomato')){const canned=/\\b(diced|crushed|peeled|canned|tinned|tin)\\b/.test(r);if(canned){if(!t.includes('tomato'))return true;if(['cherry','grape','cocktail','fresh punnet'].some(x=>t.includes(x)))return true;if(r.includes('diced')&&!/(diced|chopped)/.test(t))return true}else if(['diced','crushed','peeled','passata','paste','sauce','canned','tinned'].some(x=>t.includes(x)))return true}if(r.includes('carrot')&&!r.includes('baby')&&t.includes('baby carrot'))return true;if(r.includes('bread')&&['bread mix','flour','breadcrumb'].some(x=>t.includes(x)))return true;const pc=packIntent(i),pp=pPackCount(p);if(requiresPack(i)){if(!pp)return true;const ratio=pp/pc;if(ratio<.75||ratio>1.34)return true}const a=measure(i),b=pMeasure(p);if(a?.b&&b?.b){const ratio=b.b/a.b;if(ratio<.6||ratio>1.55)return true}return false};
 const score=(i,p)=>{if(bad(i,p))return-9999;const q=query(i),t=txt(p),ws=words(q);let s=ws.filter(w=>t.includes(w)).length*18;if(t.includes(q.toLowerCase()))s+=60;const r=req(i),a=measure(i),b=pMeasure(p);if(a?.b){if(!b?.b)s-=45;else{const x=b.b/a.b;s+=x>=.95&&x<=1.05?160:x>=.85&&x<=1.15?90:x>=.7&&x<=1.3?30:-220}}const pc=packIntent(i),pp=pPackCount(p);if(pc){if(pp===pc)s+=220;else if(pp){const x=pp/pc;s+=x>=.9&&x<=1.1?120:x>=.75&&x<=1.34?25:-180}else if(requiresPack(i))s-=220}if(/\\b(large|big|family)\\b/.test(r)&&b?.b)s+=Math.min(70,b.b/20);if(/baby (roma )?tomato/.test(r)&&['cherry','grape','cocktail','mini'].some(x=>t.includes(x)))s+=150;if(r.includes('white bread')&&t.includes('white')&&(t.includes('bread')||t.includes('loaf')))s+=60;if(/\\bbag\\b/.test(unitText(i))&&/\\b(bag|pack)\\b/.test(t))s+=90;if((prefs.preferSpecials||/\\bon special\\b/.test(r))&&p.IsOnSpecial)s+=/\\bon special\\b/.test(r)?180:30;const mem=memoryFor(i);if(prefs.rememberBrands&&mem&&+mem.times_used>=2&&String(mem.product_id)===String(p.Stockcode)&&!/\\b(cheapest|best value|value option|on special)\\b/.test(r))s+=Math.min(260,100+(+mem.times_used*35));if(p.IsAvailable===false||p.IsInStock===false)s-=200;return s};
 async function search(i){const q=query(i),res=await fetch('/apis/ui/Search/products',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/plain, */*'},credentials:'same-origin',body:JSON.stringify({Filters:[],IsSpecial:false,Location:'/shop/search/products?searchTerm='+encodeURIComponent(q),PageNumber:1,PageSize:40,SearchTerm:q,SortType:'TraderRelevance',IsHideEverydayMarketProducts:true,ExcludeSearchTypes:['UntraceableVendors'],GpBoost:0,GroupEdmVariants:false,EnableAdReRanking:false})});if(!res.ok)throw Error('search');const d=await res.json(),out=[];for(const g of d?.Products||[])for(const p of g?.Products||[])out.push(p);return out}
 const cartQty=(i,p)=>{const q=requestQty(i),r=req(i),m=measure(i),pc=packIntent(i),pp=pPackCount(p),t=txt(p);if(pc){if(pp)return Math.max(1,Math.min(6,Math.ceil(pc/pp)));return 1}if(r.includes('salmon')&&r.includes('fillet')&&q>1){const wm=t.match(/\\bper\\s*(\\d+(?:\\.\\d+)?)\\s*g\\b/i);if(wm)return Math.max(.2,+(q*(+wm[1])/1000).toFixed(2));return 1}if(m){if(!pMeasure(p)&&r.includes('banana')&&m.u==='kg')return Math.max(1,Math.min(12,Math.round(m.n*6)));return 1}if(/\\b(pack|packet|bag|box|loaf)\\b/.test(unitText(i)))return 1;return Math.max(1,Math.min(6,Math.round(q)))};
 async function add(i,p){const res=await fetch('/api/v3/ui/trolley/update',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/plain, */*'},credentials:'same-origin',body:JSON.stringify({items:[{stockcode:+p.Stockcode,quantity:cartQty(i,p),source:p.Source||'SearchServiceSearchProducts',diagnostics:p.Diagnostics||'0',searchTerm:query(i),evaluateRewardPoints:false,offerId:p.OfferId??null,profileId:null,priceLevel:null}]})});if(!res.ok)return false;const raw=await res.text();try{const d=raw?JSON.parse(raw):null;if(d&&(d.Success===false||d.success===false))return false}catch(_){}return true}
 try{post('WOOLIES_STATUS','Matching your groceries…');const chosen=[],unmatched=[],used=new Set();for(let n=0;n<items.length;n++){const i=items[n];post('WOOLIES_STATUS','Matching '+(n+1)+' of '+items.length+': '+i.name);let ps=[];try{ps=await search(i)}catch(_){unmatched.push(i.name);continue}const ws=words(query(i)),needed=ws.length===1?1:Math.min(2,ws.length);let ranked=ps.map(p=>({p,s:score(i,p),hits:ws.filter(w=>txt(p).includes(w)).length,price:+(p.Price||999)})).filter(x=>x.p?.Stockcode&&x.s>=20&&x.hits>=needed);if(!ranked.length){unmatched.push(i.name);continue}const bestScore=Math.max(...ranked.map(x=>x.s));ranked=ranked.filter(x=>x.s>=bestScore-(prefs.allowAlternatives?35:12));if(!prefs.allowAlternatives){const exactQuery=query(i).toLowerCase();ranked=ranked.filter(x=>x.hits===ws.length||txt(x.p).includes(exactQuery));if(!ranked.length){unmatched.push(i.name);continue}}ranked.sort((a,b)=>(prefs.matchMode==='cheapest'||/\b(cheapest|best value|value option)\b/.test(req(i)))?(a.price-b.price||b.s-a.s):(b.s-a.s||a.price-b.price));const p=ranked[0]?.p;if(!p||used.has(String(p.Stockcode))){unmatched.push(i.name);continue}used.add(String(p.Stockcode));chosen.push([i,p]);await sleep(120)}let added=0,failed=0,remembered=[];for(let n=0;n<chosen.length;n++){const i=chosen[n][0],p=chosen[n][1];post('WOOLIES_STATUS','Adding '+(n+1)+' of '+chosen.length+': '+i.name);if(await add(i,p)){added++;remembered.push({request:i.name,productId:String(p.Stockcode),productName:p.DisplayName||p.Name||'',brand:p.Brand||'',size:p.PackageSize||''})}else failed++;await sleep(220)}const message=added+' products added.'+(unmatched.length?' Could not confidently match: '+unmatched.join(', ')+'.':'')+(failed?' '+failed+' failed to add.':'');post('WOOLIES_DONE',message,{added,failed,unmatched,remembered,success:added>0})}catch(e){post('WOOLIES_DONE','Could not finish the Woolies shop.',{added:0,success:false})}
 return true;
})();true;`;
}


function colesCompareScript(items, preferences={}, productMemory=[]) {
  const payload = JSON.stringify(items.slice(0, 60));
  const memoryPayload = JSON.stringify((productMemory||[]).slice(0,120));
  const prefsPayload = JSON.stringify({
    matchMode: preferences.matchMode==='cheapest'?'cheapest':'best',
    preferSpecials: preferences.preferSpecials!==false,
    allowAlternatives: preferences.allowAlternatives!==false,
    rememberBrands: preferences.rememberBrands!==false,
  });
  return `
(async()=>{
 const items=${payload},prefs=${prefsPayload},memories=${memoryPayload};
 const post=(type,message,extra={})=>{try{window.ReactNativeWebView.postMessage(JSON.stringify({type,message,...extra}))}catch(_){}};
 const nextData=window.__NEXT_DATA__||(()=>{try{return JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent||'{}')}catch(_){return{}}})();
 const buildId=nextData?.buildId;
 if(!buildId){post('COLES_DONE','Could not read Coles product data.',{matches:[],unmatched:items.map(i=>i.name),total:0,error:'build'});return true}
 const req=i=>(String(i.name||'')+' '+String(i.unit||'')).toLowerCase();
 const memoryKey=v=>String(v||'').toLowerCase().replace(/\b(on special|cheapest|best value|value option)\b/g,'').replace(/\s+/g,' ').trim();
 const memoryFor=i=>memories.find(m=>String(m.request_key||'')===memoryKey(i.name));
 const unit=v=>String(v||'').toLowerCase().replace(/litres?/g,'l').replace(/millilitres?/g,'ml').replace(/kilograms?/g,'kg').replace(/grams?/g,'g').trim();
 const base=(n,u)=>(u==='kg'||u==='l')?n*1000:(u==='g'||u==='ml')?n:null;
 const measure=i=>{const s=req(i),m=s.match(/\\b(\\d+(?:\\.\\d+)?)\\s*(kg|g|l|ml)\\b/i);if(m)return{n:+m[1],u:m[2],b:base(+m[1],m[2])};const q=+(i.qty??i.quantity??1),u=unit(i.unit);return /^(kg|g|l|ml)$/.test(u)?{n:q,u,b:base(q,u)}:null};
 const txt=p=>(String(p?.name||'')+' '+String(p?.brand||'')+' '+String(p?.size||'')).toLowerCase();
 const pMeasure=p=>{const m=txt(p).match(/\\b(\\d+(?:\\.\\d+)?)\\s*(kg|g|l|ml)\\b/i);return m?{n:+m[1],u:m[2],b:base(+m[1],m[2])}:null};
 const query=i=>{let q=String(i.name||'').replace(/\\b(on special|cheapest|best value|value option)\\b/gi,'').trim().replace(/weet\\s*-?\\s*a?bix|weetbix|weet bix/gi,'Weet-Bix');if(/baby (roma )?tomato/i.test(req(i)))q='cherry tomatoes';const m=measure(i);if(m&&!q.toLowerCase().includes(String(m.n)+m.u))q+=' '+m.n+m.u;return q};
 const words=s=>String(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(w=>w&&!['the','a','an','of','and','for','pack','packet','bag','box','large','small','medium'].includes(w));
 const pricing=p=>p?.pricing||{};
 const price=p=>Number(pricing(p).now||pricing(p).price||999);
 const isSpecial=p=>{const t=String(pricing(p).promotionType||'').toUpperCase();return !!pricing(p).was||['SPECIAL','DOWN','MULTIBUY','PERCENT_OFF'].includes(t)};
 const bad=(i,p)=>{const r=req(i),t=txt(p);if(/baby (roma )?tomato/.test(r)){if(!t.includes('tomato')||!['cherry','grape','cocktail','solanato','mini'].some(x=>t.includes(x)))return true;if(['diced','crushed','peeled','passata','paste','sauce','canned','tinned','mutti'].some(x=>t.includes(x)))return true}if(r.includes('tomato')&&['diced','crushed','peeled','passata','paste','sauce','canned','tinned'].some(x=>t.includes(x)))return true;if(r.includes('carrot')&&!r.includes('baby')&&t.includes('baby carrot'))return true;if(r.includes('bread')&&['bread mix','flour','breadcrumb'].some(x=>t.includes(x)))return true;const a=measure(i),b=pMeasure(p);if(a?.b&&b?.b){const ratio=b.b/a.b;if(ratio<.6||ratio>1.55)return true}return false};
 const score=(i,p)=>{if(bad(i,p))return-9999;const q=query(i),t=txt(p),ws=words(q);let s=ws.filter(w=>t.includes(w)).length*16;if(t.includes(q.toLowerCase()))s+=45;const a=measure(i),b=pMeasure(p);if(a?.b){if(!b?.b)s-=50;else{const x=b.b/a.b;s+=x>=.95&&x<=1.05?140:x>=.85&&x<=1.15?80:x>=.7&&x<=1.3?25:-200}}if((prefs.preferSpecials||/\bon special\b/.test(r))&&isSpecial(p))s+=/\bon special\b/.test(r)?180:35;const mem=memoryFor(i);if(prefs.rememberBrands&&mem&&+mem.times_used>=2&&String(mem.product_id)===String(p?.id)&&!/\b(cheapest|best value|value option|on special)\b/.test(r))s+=Math.min(260,100+(+mem.times_used*35));if(p?.availability===false)s-=200;return s};
 async function search(i){const q=query(i),url='/_next/data/'+encodeURIComponent(buildId)+'/en/search/products.json?q='+encodeURIComponent(q);const res=await fetch(url,{credentials:'same-origin',headers:{Accept:'application/json'}});if(!res.ok)throw Error('search');const d=await res.json();return d?.pageProps?.searchResults?.results||[]}
 const qty=i=>measure(i)?1:Math.max(1,Math.min(6,Math.round(+(i.qty??i.quantity??1)||1)));
 try{const matches=[],unmatched=[];let total=0;for(let n=0;n<items.length;n++){const i=items[n];post('COLES_STATUS','Checking '+(n+1)+' of '+items.length+': '+i.name);let ps=[];try{ps=await search(i)}catch(_){unmatched.push(i.name);continue}const ws=words(query(i)),needed=ws.length===1?1:Math.min(2,ws.length);let ranked=ps.map(p=>({p,s:score(i,p),hits:ws.filter(w=>txt(p).includes(w)).length,price:price(p)})).filter(x=>x.p?.id&&x.price<999&&x.s>=20&&x.hits>=needed);if(!ranked.length){unmatched.push(i.name);continue}const bestScore=Math.max(...ranked.map(x=>x.s));ranked=ranked.filter(x=>x.s>=bestScore-(prefs.allowAlternatives?35:12));if(!prefs.allowAlternatives){const exact=query(i).toLowerCase();ranked=ranked.filter(x=>x.hits===ws.length||txt(x.p).includes(exact));if(!ranked.length){unmatched.push(i.name);continue}}ranked.sort((a,b)=>(prefs.matchMode==='cheapest'||/\b(cheapest|best value|value option)\b/.test(req(i)))?(a.price-b.price||b.s-a.s):(b.s-a.s||a.price-b.price));const x=ranked[0],p=x.p,mult=qty(i),line=+(x.price*mult).toFixed(2);total+=line;matches.push({request:i.name,product:p.name||i.name,brand:p.brand||'',size:p.size||'',price:x.price,quantity:mult,lineTotal:line,special:isSpecial(p),productId:p.id})}post('COLES_DONE','Coles check complete.',{matches,unmatched,total:+total.toFixed(2)})}catch(e){post('COLES_DONE','Could not finish the Coles check.',{matches:[],unmatched:items.map(i=>i.name),total:0,error:String(e?.message||e)})}
 return true;
})();true;`;
}


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

function BottomNav({tab,onChange}) {
  const labelStyle = key => tab===key ? s.navLabelActive : s.navLabel;
  return <View style={s.bottomNav}>
    <TouchableOpacity style={s.navItem} onPress={()=>onChange('home')}><Text style={s.navIcon}>⌂</Text><Text style={labelStyle('home')}>Home</Text></TouchableOpacity>
    <TouchableOpacity style={s.navItem} onPress={()=>onChange('household')}><Text style={s.navIcon}>◫</Text><Text style={labelStyle('household')}>Household</Text></TouchableOpacity>
    <TouchableOpacity style={s.navItem} onPress={()=>onChange('account')}><Text style={s.navIcon}>◎</Text><Text style={labelStyle('account')}>Account</Text></TouchableOpacity>
    <TouchableOpacity style={s.navItem} onPress={()=>onChange('more')}><Text style={s.navMore}>•••</Text><Text style={labelStyle('more')}>More</Text></TouchableOpacity>
  </View>;
}

function MenuRow({title:rowTitle,sub,right='›',onPress,danger=false}) {
  return <TouchableOpacity style={s.menuRow} onPress={onPress} disabled={!onPress} activeOpacity={onPress ? .7 : 1}>
    <View style={{flex:1,paddingRight:12}}>
      <Text style={[s.menuTitle,danger&&s.danger]}>{rowTitle}</Text>
      {!!sub&&<Text style={s.menuSub}>{sub}</Text>}
    </View>
    {!!right&&<Text style={[s.menuRight,danger&&s.danger]}>{right}</Text>}
  </TouchableOpacity>;
}

function PageHeader({eyebrow,title:pageTitle,lead,onBack,backLabel='Back'}) {
  return <>
    <Text style={s.brand}>stuff{`\n`}the{`\n`}shopping<Text style={s.dot}>.</Text></Text>
    {!!onBack&&<TouchableOpacity onPress={onBack} style={s.inlineBack}><Text style={s.inlineBackText}>‹ {backLabel}</Text></TouchableOpacity>}
    <View style={[s.pageIntro,onBack&&{marginTop:18}]}>
      <Text style={s.pageEyebrow}>{eyebrow}</Text>
      <Text style={s.pageTitle}>{pageTitle}</Text>
      {!!lead&&<Text style={s.pageLead}>{lead}</Text>}
    </View>
  </>;
}

function Field({label,value,onChangeText,keyboardType='default',autoCapitalize='sentences',placeholder='',secureTextEntry=false,editable=true}) {
  return <View style={s.fieldWrap}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TextInput style={[s.field,!editable&&s.fieldDisabled]} value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={autoCapitalize} placeholder={placeholder} placeholderTextColor="#8B8479" secureTextEntry={secureTextEntry} editable={editable} />
  </View>;
}

function ToggleRow({title:rowTitle,sub,value,onValueChange}) {
  return <View style={s.toggleRow}>
    <View style={{flex:1,paddingRight:12}}><Text style={s.menuTitle}>{rowTitle}</Text>{!!sub&&<Text style={s.menuSub}>{sub}</Text>}</View>
    <Switch value={value} onValueChange={onValueChange} />
  </View>;
}

function InfoBlock({title:blockTitle,children}) {
  return <View style={s.infoBlock}><Text style={s.infoTitle}>{blockTitle}</Text><Text style={s.infoCopy}>{children}</Text></View>;
}

export default function StuffApp({onJoinHouseholdCode}) {
  const webRef = useRef(null), pending = useRef([]), injected = useRef(false), retries = useRef(0), wooliesReturnTab = useRef('home');
  const colesCartQueue=useRef([]),colesCartPos=useRef(0),colesCartAdded=useRef(0),colesCartFailed=useRef([]),colesCartInjected=useRef(false);
  const retailerWatchdog=useRef(null);
  const itemsRef = useRef([]), saveTimer = useRef(null), lastSyncedList = useRef('');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);
  const { user, loading:authLoading, signIn, signUp, signOut:stuffSignOut } = useStuffAuth();
  const [mode,setMode]=useState('shop'),[tab,setTab]=useState('home'),[items,setItems]=useState([]),[open,setOpen]=useState(true),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[cartUrl,setCartUrl]=useState(CART_URL),[webKey,setWebKey]=useState(0);
  const [accountView,setAccountView]=useState('main');
  const [profile,setProfile]=useState({firstName:'',lastName:'',email:'',mobile:'',suburb:'',postcode:''});
  const [preferences,setPreferences]=useState({preferredSupermarket:'woolworths',matchMode:'best',preferSpecials:true,allowAlternatives:true,rememberBrands:true});
  const [colesResults,setColesResults]=useState(null);
  const [productMemory,setProductMemory]=useState([]);
  const [colesCartUrl,setColesCartUrl]=useState('https://www.coles.com.au/');
  const [householdView,setHouseholdView]=useState('main');
  const [householdId,setHouseholdId]=useState(null);
  const [householdName,setHouseholdName]=useState('My household');
  const [householdMembers,setHouseholdMembers]=useState([]);
  const [invite,setInvite]=useState({name:'',contact:''});
  const [joinCode,setJoinCode]=useState('');
  const [moreView,setMoreView]=useState('main');
  const [authForm,setAuthForm]=useState({email:'',password:''});
  const [authBusy,setAuthBusy]=useState(false),[dataBusy,setDataBusy]=useState(false),[dataReady,setDataReady]=useState(false);
  const [legalReady,setLegalReady]=useState(false),[legalAccepted,setLegalAccepted]=useState(false);
  const recording=!!recState?.isRecording,count=items.length,canSend=count>0&&!busy&&!recording;
  const listLabel=useMemo(()=>count?`Your list · ${count} ${count===1?'item':'items'}`:'Your list',[count]);
  const activeMemberCount=householdMembers.filter(m=>m.kind==='member').length;

  useEffect(()=>{ itemsRef.current=items; },[items]);

  useEffect(()=>{
    let active=true;
    AsyncStorage.getItem('stuff_legal_version').then(v=>{if(active){setLegalAccepted(v===LEGAL_VERSION);setLegalReady(true)}}).catch(()=>{if(active){setLegalReady(true)}});
    return()=>{active=false};
  },[]);

  async function acceptLegal(){
    try{await AsyncStorage.setItem('stuff_legal_version',LEGAL_VERSION)}catch(_){}
    setLegalAccepted(true);
  }

  useEffect(()=>{
    let cancelled=false;
    if(authLoading)return;

    if(!user){
      setDataReady(false);
      setHouseholdId(null);
      setHouseholdName('My household');
      setHouseholdMembers([]);
      setProductMemory([]);
      setProfile({firstName:'',lastName:'',email:'',mobile:'',suburb:'',postcode:''});
      setPreferences({preferredSupermarket:'woolworths',matchMode:'best',preferSpecials:true,allowAlternatives:true,rememberBrands:true});
      lastSyncedList.current='';
      return;
    }

    (async()=>{
      setDataBusy(true);
      setDataReady(false);
      try{
        const localItems=[...itemsRef.current];
        const bundle=await loadStuffBundle(user);
        if(cancelled)return;
        const p=bundle?.profile||{},pref=bundle?.preferences||{};
        setHouseholdId(bundle?.householdId||null);
        setProductMemory(Array.isArray(bundle?.productMemory)?bundle.productMemory:[]);
        setProfile({
          firstName:p.first_name||'',
          lastName:p.last_name||'',
          email:user.email||'',
          mobile:p.mobile||'',
          suburb:p.suburb||'',
          postcode:p.postcode||'',
        });
        setPreferences({
          preferredSupermarket:pref.preferred_supermarket==='coles'?'coles':'woolworths',
          matchMode:pref.match_mode==='cheapest'?'cheapest':'best',
          preferSpecials:pref.prefer_specials!==false,
          allowAlternatives:pref.allow_alternatives!==false,
          rememberBrands:pref.remember_brands!==false,
        });
        setHouseholdName(bundle?.household?.name||'My household');

        const selfName=[p.first_name,p.last_name].filter(Boolean).join(' ').trim()||'You';
        const memberRows=(bundle?.members||[]).map(m=>({
          id:`member-${m.user_id}`,
          kind:'member',
          dbUserId:m.user_id,
          name:m.user_id===user.id?selfName:'Household member',
          contact:m.user_id===user.id?(user.email||'Your Stuff account'):'Shared household member',
          role:m.role==='owner'?'Owner':'Member',
          status:'Active',
        }));
        const inviteRows=(bundle?.invites||[]).filter(x=>x.status==='pending').map(x=>({
          id:`invite-${x.id}`,
          inviteId:x.id,
          kind:'invite',
          name:x.invitee_name||'Invited member',
          contact:x.contact,
          role:'Member',
          status:'Invite pending',
        }));
        setHouseholdMembers([...memberRows,...inviteRows]);

        const remoteItems=Array.isArray(bundle?.list?.items)?bundle.list.items:[];
        if(remoteItems.length){
          lastSyncedList.current=JSON.stringify(remoteItems);
          setItems(remoteItems);
        }else if(localItems.length&&bundle?.householdId){
          await saveStuffList(bundle.householdId,user.id,localItems);
          lastSyncedList.current=JSON.stringify(localItems);
          if(!cancelled)setItems(localItems);
        }else{
          lastSyncedList.current='[]';
          setItems([]);
        }
        if(!cancelled)setDataReady(true);
      }catch(e){
        if(!cancelled)Alert.alert('Could not load your Stuff account',e?.message||'Please try again.');
      }finally{
        if(!cancelled)setDataBusy(false);
      }
    })();

    return()=>{cancelled=true};
  },[user?.id,authLoading]);

  useEffect(()=>{
    if(!user?.id||!householdId||!dataReady)return;
    const serial=JSON.stringify(items);
    if(serial===lastSyncedList.current)return;
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(async()=>{
      try{
        await saveStuffList(householdId,user.id,itemsRef.current);
        lastSyncedList.current=JSON.stringify(itemsRef.current);
      }catch(e){
        setStatus('Could not sync the shared list.');
      }
    },700);
    return()=>clearTimeout(saveTimer.current);
  },[items,user?.id,householdId,dataReady]);

  useEffect(()=>{
    if(!user?.id||!householdId||!dataReady)return;
    return subscribeStuffList(householdId,next=>{
      const serial=JSON.stringify(next);
      if(serial===JSON.stringify(itemsRef.current))return;
      lastSyncedList.current=serial;
      setItems(next);
    });
  },[user?.id,householdId,dataReady]);

  async function learnProduct(retailer,selection){
    if(!user?.id||!householdId||!preferences.rememberBrands||!selection?.request||!selection?.productId)return;
    try{
      const row=await rememberStuffHouseholdProduct(householdId,retailer,selection);
      if(row)setProductMemory(v=>[row,...v.filter(x=>!(x.retailer===row.retailer&&x.request_key===row.request_key))]);
    }catch(_){}
  }
  async function forgetUsual(row){
    if(!householdId||!row)return;
    try{await forgetStuffHouseholdProduct(householdId,row.retailer,row.request_key);setProductMemory(v=>v.filter(x=>!(x.retailer===row.retailer&&x.request_key===row.request_key)))}catch(e){Alert.alert('Could not forget product',e?.message||'Please try again.')}
  }
  function clearUsuals(){
    if(!householdId||!productMemory.length)return;
    Alert.alert('Forget all usual products?','Stuff will stop using your household’s learned product choices. It can start learning again from future shops.',[
      {text:'Cancel',style:'cancel'},
      {text:'Forget all',style:'destructive',onPress:async()=>{try{await clearStuffHouseholdProductMemory(householdId);setProductMemory([])}catch(e){Alert.alert('Could not clear usuals',e?.message||'Please try again.')}}},
    ]);
  }

  function clearRetailerWatchdog(){if(retailerWatchdog.current){clearTimeout(retailerWatchdog.current);retailerWatchdog.current=null}}
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
  function send(){if(!canSend)return;const {allowed,restricted}=splitRetailerItems(items);if(restricted.length)Alert.alert('Some items were not automated',`Stuff leaves age-restricted items on your list for you to handle directly with the retailer: ${restricted.map(x=>title(x.name)).join(', ')}.`);if(!allowed.length)return;wooliesReturnTab.current='home';pending.current=allowed.map(i=>({name:i.name,qty:i.quantity,quantity:i.quantity,unit:i.unit}));injected.current=false;retries.current=0;setStatus('Connecting to Woolies…');armRetailerWatchdog('Woolworths');setCartUrl('https://www.woolworths.com.au/');setWebKey(k=>k+1);setMode('woolies')}
  function back(){clearRetailerWatchdog();pending.current=[];colesCartQueue.current=[];injected.current=false;colesCartInjected.current=false;retries.current=0;setMode('shop');setTab(wooliesReturnTab.current||'home');setStatus('')}
  function openCart(){setStatus('Opening your Woolies cart…');setCartUrl(CART_URL+'?stuffShopping='+Date.now())}
  function onMessage(e){let m;try{m=JSON.parse(e.nativeEvent.data)}catch(_){return}if(m?.type==='WOOLIES_STATUS'){armRetailerWatchdog('Woolworths');setStatus(m.message||'Building your Woolies cart…');return}if(m?.type==='WOOLIES_DONE'){clearRetailerWatchdog();const added=Number(m.added||0);for(const x of (m.remembered||[]))learnProduct('woolworths',x);pending.current=[];setStatus(added?`Done — ${added} ${added===1?'product':'products'} added.`:(m.message||'Nothing was added.'));if(added)setTimeout(openCart,350)}}
  function onLoad(e){
    const u=String(e.nativeEvent.url||'');
    const lower=u.toLowerCase();
    if(!pending.current.length){clearRetailerWatchdog();if(lower.includes('/shop/cart'))setStatus('Cart ready.');return}
    if(retailerChallenge(lower)){stopForRetailerChallenge('Woolworths');return}
    if(injected.current)return;
    if(!lower.includes('woolworths.com.au')){setStatus('Connecting to Woolies…');return}
    if(/login|sign-in|signin|verify|auth/.test(lower)){armRetailerWatchdog('Woolworths',180000);setStatus('Log in to Woolies — we’ll continue automatically.');return}
    injected.current=true;
    armRetailerWatchdog('Woolworths');
    setStatus('Matching your groceries…');
    setTimeout(()=>webRef.current?.injectJavaScript(wooliesScript(pending.current,preferences,productMemory.filter(x=>x.retailer==='woolworths'))),1000);
  }

  function goTab(next){setTab(next);setAccountView('main');setHouseholdView('main');setMoreView('main');setStatus('')}
  function goToStuffLogin(){setTab('account');setAccountView('auth');setHouseholdView('main')}
  function openWoolworthsFromAccount(){wooliesReturnTab.current='account';pending.current=[];injected.current=false;setStatus('Woolworths on this device');setCartUrl('https://www.woolworths.com.au/');setWebKey(k=>k+1);setMode('woolies')}
  function compareColes(){if(!canSend)return;const {allowed,restricted}=splitRetailerItems(items);if(restricted.length)Alert.alert('Some items were not automated',`Stuff leaves age-restricted items on your list for you to handle directly with the retailer: ${restricted.map(x=>title(x.name)).join(', ')}.`);if(!allowed.length)return;wooliesReturnTab.current='home';pending.current=allowed.map(i=>({name:i.name,qty:i.quantity,quantity:i.quantity,unit:i.unit}));injected.current=false;setColesResults(null);setStatus('Checking Coles…');armRetailerWatchdog('Coles');setWebKey(k=>k+1);setMode('coles')}
  function openColesFromAccount(){wooliesReturnTab.current='account';pending.current=[];injected.current=false;setStatus('Coles on this device');setWebKey(k=>k+1);setMode('colesSite')}
  function onColesMessage(e){let m;try{m=JSON.parse(e.nativeEvent.data)}catch(_){return}if(m?.type==='COLES_STATUS'){armRetailerWatchdog('Coles');setStatus(m.message||'Checking Coles…');return}if(m?.type==='COLES_DONE'){clearRetailerWatchdog();pending.current=[];setColesResults(m);setMode('colesResults');setStatus('')}}
  function onColesLoad(e){const u=String(e.nativeEvent.url||'').toLowerCase();if(retailerChallenge(u)){stopForRetailerChallenge('Coles');return}if(/login|sign-in|signin|auth/.test(u)&&pending.current.length){armRetailerWatchdog('Coles',180000);setStatus('Log in to Coles if prompted — Stuff will continue when the retailer is ready.');return}if(!u.includes('coles.com.au')||injected.current)return;injected.current=true;armRetailerWatchdog('Coles');setStatus('Matching your groceries at Coles…');setTimeout(()=>webRef.current?.injectJavaScript(colesCompareScript(pending.current,preferences,productMemory.filter(x=>x.retailer==='coles'))),1000)}
  function startColesTrolley(){
    const queue=(colesResults?.matches||[]).filter(x=>x?.productId);
    if(!queue.length){Alert.alert('Coles trolley','There are no confident Coles matches to add yet.');return}
    colesCartQueue.current=queue;colesCartPos.current=0;colesCartAdded.current=0;colesCartFailed.current=[];colesCartInjected.current=false;
    setStatus(`Adding 1 of ${queue.length}: ${queue[0].request}`);armRetailerWatchdog('Coles trolley',120000);setColesCartUrl(colesProductUrl(queue[0]));setWebKey(k=>k+1);setMode('colesCart');
  }
  function onColesCartMessage(e){
    let m;try{m=JSON.parse(e.nativeEvent.data)}catch(_){return}
    if(m?.type==='COLES_CART_STATUS'||m?.type==='COLES_CART_LOGIN'){setStatus(m.message||'Working with Coles…');return}
    if(m?.type!=='COLES_CART_ITEM_DONE')return;
    const current=colesCartQueue.current[colesCartPos.current];
    if(m.success){colesCartAdded.current+=1;learnProduct('coles',current)}else colesCartFailed.current.push(current?.request||m.name||'item');
    const next=colesCartPos.current+1;
    if(next>=colesCartQueue.current.length){
      const added=colesCartAdded.current,failed=colesCartFailed.current;
      clearRetailerWatchdog();setStatus(`Done — ${added} ${added===1?'product':'products'} added${failed.length?`, ${failed.length} need review`:''}. Open the Coles trolley at the top right.`);
      setColesCartUrl('https://www.coles.com.au/');
      colesCartQueue.current=[];colesCartInjected.current=false;return;
    }
    colesCartPos.current=next;colesCartInjected.current=false;
    const item=colesCartQueue.current[next];armRetailerWatchdog('Coles trolley',45000);setStatus(`Adding ${next+1} of ${colesCartQueue.current.length}: ${item.request}`);setColesCartUrl(colesProductUrl(item));
  }
  function onColesCartLoad(e){
    if(!colesCartQueue.current.length)return;
    const u=String(e.nativeEvent.url||'').toLowerCase();
    if(retailerChallenge(u)){stopForRetailerChallenge('Coles');return}
    if(/login|sign-in|signin|auth|account/.test(u)){colesCartInjected.current=false;armRetailerWatchdog('Coles trolley',180000);setStatus('Log in to Coles — we’ll continue automatically.');return}
    const item=colesCartQueue.current[colesCartPos.current];
    if(!item||!u.includes('coles.com.au/product/')||colesCartInjected.current)return;
    colesCartInjected.current=true;armRetailerWatchdog('Coles trolley',45000);setStatus(`Adding ${colesCartPos.current+1} of ${colesCartQueue.current.length}: ${item.request}`);
    setTimeout(()=>webRef.current?.injectJavaScript(colesAddToTrolleyScript(item)),850);
  }

  async function handleSignIn(){
    const email=authForm.email.trim(),password=authForm.password;
    if(!email||!password){Alert.alert('Sign in','Enter your email and password.');return}
    setAuthBusy(true);
    try{
      const {error}=await signIn(email,password);
      if(error)throw error;
      setAuthForm({email:'',password:''});
      setAccountView('main');
    }catch(e){Alert.alert('Could not sign in',e?.message||'Check your details and try again.')}finally{setAuthBusy(false)}
  }

  async function handleSignUp(){
    const email=authForm.email.trim(),password=authForm.password;
    if(!email||!password){Alert.alert('Create account','Enter your email and a password.');return}
    if(password.length<8){Alert.alert('Create account','Use a password with at least 8 characters.');return}
    setAuthBusy(true);
    try{
      const {error,needsEmailConfirmation}=await signUp(email,password);
      if(error)throw error;
      if(needsEmailConfirmation){
        Alert.alert('Check your email','We sent you a confirmation link. Confirm the email, then come back here and sign in with the password you just created.');
      }else{
        setAuthForm({email:'',password:''});
        setAccountView('main');
      }
    }catch(e){Alert.alert('Could not create account',e?.message||'Please try again.')}finally{setAuthBusy(false)}
  }

  async function saveProfile(){
    if(!user){goToStuffLogin();return}
    setDataBusy(true);
    try{
      const result=await saveStuffProfile(user.id,profile);
      setAccountView('main');
      Alert.alert('Saved',result?.emailChangeRequested?'Your details are saved. Check your email to confirm the new email address.':'Your account details are saved.');
    }catch(e){Alert.alert('Could not save details',e?.message||'Please try again.')}finally{setDataBusy(false)}
  }

  async function savePreferences(){
    if(!user){goToStuffLogin();return}
    setDataBusy(true);
    try{
      await saveStuffPreferences(user.id,preferences);
      setAccountView('main');
      Alert.alert('Saved','Your shopping preferences are saved.');
    }catch(e){Alert.alert('Could not save preferences',e?.message||'Please try again.')}finally{setDataBusy(false)}
  }

  function signOut(){
    if(!user){goToStuffLogin();return}
    Alert.alert('Sign out?','Your shared household data will stay safely in your Stuff account.',[
      {text:'Cancel',style:'cancel'},
      {text:'Sign out',onPress:async()=>{
        setDataBusy(true);
        try{
          const {error}=await stuffSignOut();
          if(error)throw error;
          setItems([]);
          setTab('home');
          setAccountView('main');
        }catch(e){Alert.alert('Could not sign out',e?.message||'Please try again.')}finally{setDataBusy(false)}
      }}
    ]);
  }

  function deleteAccount(){
    if(!user)return;
    Alert.alert('Delete your Stuff account?','This permanently deletes your Stuff account, household, preferences and stored shopping data. This cannot be undone.',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete account',style:'destructive',onPress:()=>Alert.alert('Are you sure?','Your Stuff account and stored household data will be permanently deleted.',[
        {text:'Cancel',style:'cancel'},
        {text:'Delete permanently',style:'destructive',onPress:async()=>{
          setDataBusy(true);
          try{
            await deleteStuffAccount();
            setItems([]);
            setTab('home');
            setAccountView('main');
            Alert.alert('Account deleted','Your Stuff account has been deleted.');
          }catch(e){Alert.alert('Could not delete account',e?.message||'Please try again.')}finally{setDataBusy(false)}
        }}
      ])}
    ]);
  }

  async function manageMicrophone(){try{await Linking.openSettings()}catch(_){Alert.alert('Settings','Open iPhone Settings and choose Stuff the Shopping to manage microphone access.')}}

  async function saveHouseholdNameAction(){
    const clean=householdName.trim();
    if(!clean){Alert.alert('Household name','Give your household a name first.');return}
    if(!user||!householdId){goToStuffLogin();return}
    setDataBusy(true);
    try{
      await saveStuffHouseholdName(householdId,clean);
      setHouseholdName(clean);
      setHouseholdView('main');
      Alert.alert('Saved','Household name updated.');
    }catch(e){Alert.alert('Could not save household',e?.message||'Please try again.')}finally{setDataBusy(false)}
  }

  async function sendHouseholdInvite(){
    const name=invite.name.trim(),contact=invite.contact.trim();
    if(!name||!contact){Alert.alert('Invite someone','Add their name and email or mobile number.');return}
    if(!user||!householdId){goToStuffLogin();return}
    setDataBusy(true);
    try{
      const row=await createStuffInvite(householdId,user.id,name,contact);
      setHouseholdMembers(v=>[{id:`invite-${row.id}`,inviteId:row.id,kind:'invite',name:row.invitee_name||name,contact:row.contact,role:'Member',status:'Invite pending'},...v]);
      setInvite({name:'',contact:''});
      setHouseholdView('members');
      Alert.alert('Invite ready','The iPhone share sheet includes the Stuff invite code and link. The recipient signs in or creates a Stuff account to join your household.');
    }catch(e){Alert.alert('Could not create invite',e?.message||'Please try again.')}finally{setDataBusy(false)}
  }

  async function joinHouseholdWithCode(){
    const code=joinCode.trim().toUpperCase();
    if(!code){Alert.alert('Invite code','Enter the invite code you were sent.');return}
    if(!user){goToStuffLogin();return}
    if(!onJoinHouseholdCode){Alert.alert('Could not join household','Invite-code joining is unavailable in this build.');return}
    setDataBusy(true);
    try{
      await onJoinHouseholdCode(code);
      setJoinCode('');
    }catch(e){Alert.alert('Could not join household',e?.message||'The invite may be invalid or expired.')}finally{setDataBusy(false)}
  }

  function removeMember(member){
    if(!user||!householdId)return;
    if(member.dbUserId===user.id&&member.role==='Owner')return;
    const label=member.kind==='invite'?'Cancel invite?':'Remove member?';
    const copy=member.kind==='invite'?`Cancel the invitation for ${member.name}?`:`Remove ${member.name} from this household?`;
    Alert.alert(label,copy,[{text:'Cancel',style:'cancel'},{text:member.kind==='invite'?'Cancel invite':'Remove',style:'destructive',onPress:async()=>{
      setDataBusy(true);
      try{
        if(member.kind==='invite')await cancelStuffInvite(member.inviteId);
        else await removeStuffMember(householdId,member.dbUserId);
        setHouseholdMembers(v=>v.filter(x=>x.id!==member.id));
      }catch(e){Alert.alert('Could not update household',e?.message||'Please try again.')}finally{setDataBusy(false)}
    }}]);
  }

  function loadRegressionShop(){
    const rows=(regressionShop?.expected_list||[]).map((x,idx)=>({
      id:`regression-${idx+1}`,
      name:String(x.name||'').trim(),
      quantity:Number(x.quantity)||1,
      unit:String(x.unit||'').trim(),
    })).filter(x=>x.name);
    Alert.alert('Load regression shop?',`Replace the current list with ${rows.length} test items? This is available only in development builds.`,[
      {text:'Cancel',style:'cancel'},
      {text:'Load test shop',onPress:()=>{setItems(rows);setOpen(true);setTab('home');setMoreView('main');setStatus('Regression shop loaded.')}}
    ]);
  }

  function reportProblem(){
    if(!user){Alert.alert('Sign in to contact support','Sign in or create a Stuff account so we can securely attach your support request to your account.',[{text:'Cancel',style:'cancel'},{text:'Sign in',onPress:goToStuffLogin}]);return}
    Alert.prompt('Report a problem','Tell us what happened. Do not include retailer passwords or payment details.',async value=>{const message=String(value||'').trim();if(!message)return;try{await createStuffSupportRequest(user.id,user.email||'',message,'bug');Alert.alert('Sent','Your report has been saved for Stuff support.')}catch(e){Alert.alert('Could not send report',e?.message||'Please try again.')}},'plain-text');
  }

  if(!legalReady)return <SafeAreaView style={s.safe}><StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/><View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color="#F4512C"/></View></SafeAreaView>;

  if(!legalAccepted)return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="WELCOME TO STUFF" title="Groceries, without the admin." lead="One quick acknowledgement before you start shopping." />
      <InfoBlock title="Independent shopping assistant">Stuff is independent and is not affiliated with, endorsed by or sponsored by Woolworths, Coles or other retailers.</InfoBlock>
      <InfoBlock title="Always review the retailer cart">Product matching can be wrong. Prices, availability and quantities can change. You remain in control and complete checkout and payment with the retailer.</InfoBlock>
      <InfoBlock title="Voice processing">When you tap to talk, the recording is sent for AI transcription and grocery-list interpretation. Stuff does not intentionally store the audio file in its database after processing.</InfoBlock>
      <TouchableOpacity style={s.secondaryButton} onPress={()=>Linking.openURL(PRIVACY_URL)}><Text style={s.secondaryButtonText}>Read Privacy Policy</Text></TouchableOpacity>
      <TouchableOpacity style={s.secondaryButton} onPress={()=>Linking.openURL(TERMS_URL)}><Text style={s.secondaryButtonText}>Read Terms of Use</Text></TouchableOpacity>
      <TouchableOpacity style={s.primaryButton} onPress={acceptLegal}><Text style={s.primaryButtonText}>Continue to Stuff</Text></TouchableOpacity>
      <Text style={s.formNote}>By continuing, you agree to the Terms of Use and acknowledge the Privacy Policy.</Text>
    </ScrollView>
  </SafeAreaView>;

  if(mode==='woolies')return <SafeAreaView style={s.safe}><StatusBar barStyle="dark-content"/><View style={s.cartHead}><TouchableOpacity onPress={back} style={s.back}><Text style={s.backText}>‹ {wooliesReturnTab.current==='account'?'Account':'Shop'}</Text></TouchableOpacity><View style={{flex:1}}><Text style={s.cartTitle}>Woolies</Text><Text style={s.cartStatus} numberOfLines={1}>{status}</Text></View></View><WebView key={webKey} ref={webRef} source={{uri:cartUrl}} style={{flex:1}} onMessage={onMessage} onLoadEnd={onLoad} onError={()=>retailerLoadError('Woolworths','https://www.woolworths.com.au/')} userAgent={UA} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled cacheEnabled incognito={false} setSupportMultipleWindows={false}/></SafeAreaView>;


  if(mode==='coles')return <SafeAreaView style={s.safe}><StatusBar barStyle="dark-content"/><View style={s.cartHead}><TouchableOpacity onPress={back} style={s.back}><Text style={s.backText}>‹ Shop</Text></TouchableOpacity><View style={{flex:1}}><Text style={s.cartTitle}>Coles</Text><Text style={s.cartStatus} numberOfLines={1}>{status}</Text></View></View><WebView key={`coles-${webKey}`} ref={webRef} source={{uri:'https://www.coles.com.au/'}} style={{flex:1}} onMessage={onColesMessage} onLoadEnd={onColesLoad} onError={()=>retailerLoadError('Coles','https://www.coles.com.au/')} userAgent={UA} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled cacheEnabled incognito={false} setSupportMultipleWindows={false}/></SafeAreaView>;

  if(mode==='colesSite')return <SafeAreaView style={s.safe}><StatusBar barStyle="dark-content"/><View style={s.cartHead}><TouchableOpacity onPress={back} style={s.back}><Text style={s.backText}>‹ {wooliesReturnTab.current==='account'?'Account':'Shop'}</Text></TouchableOpacity><View style={{flex:1}}><Text style={s.cartTitle}>Coles</Text><Text style={s.cartStatus} numberOfLines={1}>{status}</Text></View></View><WebView key={`coles-site-${webKey}`} ref={webRef} source={{uri:'https://www.coles.com.au/'}} style={{flex:1}} onError={()=>retailerLoadError('Coles','https://www.coles.com.au/')} userAgent={UA} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled cacheEnabled incognito={false} setSupportMultipleWindows={false}/></SafeAreaView>;

  if(mode==='colesCart')return <SafeAreaView style={s.safe}><StatusBar barStyle="dark-content"/><View style={s.cartHead}><TouchableOpacity onPress={()=>setMode('colesResults')} style={s.back}><Text style={s.backText}>‹ Coles matches</Text></TouchableOpacity><View style={{flex:1}}><Text style={s.cartTitle}>Building Coles trolley</Text><Text style={s.cartStatus} numberOfLines={2}>{status}</Text></View></View><WebView key={`coles-cart-${webKey}`} ref={webRef} source={{uri:colesCartUrl}} style={{flex:1}} onMessage={onColesCartMessage} onLoadEnd={onColesCartLoad} onError={()=>retailerLoadError('Coles','https://www.coles.com.au/')} userAgent={UA} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled cacheEnabled incognito={false} setSupportMultipleWindows={false}/></SafeAreaView>;

  if(mode==='colesResults')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="Coles" title="Your Coles estimate." lead="Stuff matched your list against current Coles product data. Prices and availability can still change in Coles." onBack={()=>setMode('shop')} backLabel="Shopping list" />
      <View style={s.colesSummary}><Text style={s.colesSummaryLabel}>ESTIMATED BASKET</Text><Text style={s.colesSummaryTotal}>${Number(colesResults?.total||0).toFixed(2)}</Text><Text style={s.colesSummaryMeta}>{colesResults?.matches?.length||0} of {count} items confidently matched</Text></View>
      <View style={s.colesRows}>{(colesResults?.matches||[]).map((m,idx)=><View key={`${m.productId||idx}`} style={s.colesRow}><View style={{flex:1}}><Text style={s.item}>{title(m.request)}</Text><Text style={s.detail}>{m.product}{m.size?` · ${m.size}`:''}{m.special?' · Special':''}</Text></View><Text style={s.colesPrice}>${Number(m.lineTotal||m.price||0).toFixed(2)}</Text></View>)}</View>
      {!!colesResults?.unmatched?.length&&<InfoBlock title="Couldn’t confidently match">{colesResults.unmatched.join(', ')}</InfoBlock>}
      {!!colesResults?.matches?.length&&<TouchableOpacity style={s.colesButton} onPress={startColesTrolley}><Text style={s.colesButtonText}>Build Coles trolley · beta</Text></TouchableOpacity>}
      <TouchableOpacity style={s.secondaryButton} onPress={()=>{wooliesReturnTab.current='home';setWebKey(k=>k+1);setMode('colesSite')}}><Text style={s.secondaryButtonText}>Open Coles only</Text></TouchableOpacity>
      <Text style={s.formNote}>Beta trolley handoff uses Coles’s own product pages and Add to trolley controls. If Coles asks you to log in, do that in the Coles screen and Stuff will continue. Always review the trolley before checkout.</Text>
    </ScrollView>
  </SafeAreaView>;

  if(tab==='household'&&!user)return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="Household" title="Your household." lead="Create a Stuff account to keep one shared grocery list across devices and people." />
      <View style={s.householdHero}>
        <Text style={s.heroKicker}>YOUR CURRENT LIST</Text>
        <Text style={s.heroNumber}>{count}</Text>
        <Text style={s.heroCopy}>{count===1?'item':'items'} ready to bring into your household</Text>
        <TouchableOpacity style={s.heroButton} onPress={()=>goTab('home')}><Text style={s.heroButtonText}>View shopping list →</Text></TouchableOpacity>
      </View>
      <View style={s.authCard}>
        <Text style={s.authCardTitle}>Save it. Share it. Keep it synced.</Text>
        <Text style={s.authCardCopy}>Sign in or create a Stuff account. Your current list will be brought into your household the first time you sign in.</Text>
        <TouchableOpacity style={s.primaryButton} onPress={goToStuffLogin}><Text style={s.primaryButtonText}>Sign in or create account</Text></TouchableOpacity>
      </View>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='household'&&householdView==='join')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Household" title="Join a household" lead="Use an invite code to switch to the shared household shopping list." onBack={()=>setHouseholdView('main')} backLabel="Household" />
      <View style={s.formBlock}>
        <Field label="Invite code" value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" placeholder="8-character code" />
      </View>
      <TouchableOpacity style={[s.primaryButton,dataBusy&&s.buttonDisabled]} onPress={joinHouseholdWithCode} disabled={dataBusy}>{dataBusy?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryButtonText}>Join household</Text>}</TouchableOpacity>
      <Text style={s.formNote}>Use the code another Stuff household member shared with you. This is also the fallback when an invite link cannot open directly.</Text>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='household'&&householdView==='name')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Household" title="Household name" lead="Give the shared home shopping space a name everyone will recognise." onBack={()=>setHouseholdView('main')} backLabel="Household" />
      <View style={s.formBlock}><Field label="Household name" value={householdName} onChangeText={setHouseholdName} placeholder="My household" /></View>
      <TouchableOpacity style={[s.primaryButton,dataBusy&&s.buttonDisabled]} onPress={saveHouseholdNameAction} disabled={dataBusy}>{dataBusy?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryButtonText}>Save household name</Text>}</TouchableOpacity>
      <Text style={s.formNote}>This name is stored with the shared household.</Text>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='household'&&householdView==='members')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="Household" title="Members" lead="People in this household share the same grocery list." onBack={()=>setHouseholdView('main')} backLabel="Household" />
      <View style={s.memberBlock}>
        {!householdMembers.length&&<Text style={s.empty}>No household members loaded.</Text>}
        {householdMembers.map(member=><View key={member.id} style={s.memberRow}>
          <View style={s.memberAvatar}><Text style={s.memberAvatarText}>{member.name.slice(0,1).toUpperCase()}</Text></View>
          <View style={{flex:1}}><Text style={s.memberName}>{member.name}</Text><Text style={s.memberMeta}>{member.role} · {member.status}</Text><Text style={s.memberContact}>{member.contact}</Text></View>
          {!((member.dbUserId===user?.id)&&member.role==='Owner')&&<TouchableOpacity onPress={()=>removeMember(member)} style={s.memberRemove}><Text style={s.memberRemoveText}>{member.kind==='invite'?'Cancel':'Remove'}</Text></TouchableOpacity>}
        </View>)}
      </View>
      <TouchableOpacity style={s.primaryButton} onPress={()=>setHouseholdView('invite')}><Text style={s.primaryButtonText}>Invite someone</Text></TouchableOpacity>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='household'&&householdView==='invite')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Household" title="Invite someone" lead="Prepare an invitation for another person to use the same household grocery list." onBack={()=>setHouseholdView('members')} backLabel="Members" />
      <View style={s.formBlock}>
        <Field label="Name" value={invite.name} onChangeText={v=>setInvite(x=>({...x,name:v}))} placeholder="Name" />
        <Field label="Email or mobile" value={invite.contact} onChangeText={v=>setInvite(x=>({...x,contact:v}))} autoCapitalize="none" placeholder="Email or mobile" />
      </View>
      <TouchableOpacity style={[s.primaryButton,dataBusy&&s.buttonDisabled]} onPress={sendHouseholdInvite} disabled={dataBusy}>{dataBusy?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryButtonText}>Save invite</Text>}</TouchableOpacity>
      <Text style={s.formNote}>The invite is stored securely as pending until the recipient joins with the invite code or link.</Text>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='household')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="Household" title={householdName} lead="One shared grocery list for the people at home." />

      <View style={s.householdHero}>
        <Text style={s.heroKicker}>SHARED SHOPPING LIST</Text>
        <Text style={s.heroNumber}>{count}</Text>
        <Text style={s.heroCopy}>{count===1?'item':'items'} on the household list</Text>
        <TouchableOpacity style={s.heroButton} onPress={()=>goTab('home')}><Text style={s.heroButtonText}>View shopping list →</Text></TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>Household</Text>
      <View style={s.menuBlock}>
        <MenuRow title="Household name" sub={householdName} onPress={()=>setHouseholdView('name')} />
        <MenuRow title="Members" sub={`${activeMemberCount} ${activeMemberCount===1?'member':'members'}`} onPress={()=>setHouseholdView('members')} />
        <MenuRow title="Invite someone" sub="Add another person to the shared household" onPress={()=>setHouseholdView('invite')} />
        <MenuRow title="Join with invite code" sub="Use a code someone shared with you" onPress={()=>setHouseholdView('join')} />
      </View>

      <View style={s.sharedNote}>
        <Text style={s.sharedNoteTitle}>Your list is now stored with your household.</Text>
        <Text style={s.sharedNoteCopy}>Changes to the list sync through Stuff when you’re signed in. Invite someone with a code or link and they can join the same shared household list.</Text>
      </View>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='account'&&accountView==='auth')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Stuff account" title="Save your household." lead="Sign in to keep your list, preferences and household available across devices." onBack={()=>setAccountView('main')} backLabel="Account" />
      <View style={s.formBlock}>
        <Field label="Email" value={authForm.email} onChangeText={v=>setAuthForm(x=>({...x,email:v}))} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
        <Field label="Password" value={authForm.password} onChangeText={v=>setAuthForm(x=>({...x,password:v}))} autoCapitalize="none" placeholder="At least 8 characters" secureTextEntry />
      </View>
      <TouchableOpacity style={[s.primaryButton,authBusy&&s.buttonDisabled]} onPress={handleSignIn} disabled={authBusy}>{authBusy?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryButtonText}>Sign in</Text>}</TouchableOpacity>
      <TouchableOpacity style={[s.secondaryButton,authBusy&&s.buttonDisabled]} onPress={handleSignUp} disabled={authBusy}><Text style={s.secondaryButtonText}>Create account</Text></TouchableOpacity>
      <Text style={s.formNote}>Your Stuff login is separate from Woolworths. We never ask for your Woolworths password here.</Text>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='account'&&accountView==='details')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Your details" title="Personal details" lead="The basics we use for your Stuff account and local shopping setup." onBack={()=>setAccountView('main')} backLabel="Account" />
      <View style={s.formBlock}>
        <Field label="First name" value={profile.firstName} onChangeText={v=>setProfile(p=>({...p,firstName:v}))} />
        <Field label="Last name" value={profile.lastName} onChangeText={v=>setProfile(p=>({...p,lastName:v}))} />
        <Field label="Email" value={profile.email} onChangeText={v=>setProfile(p=>({...p,email:v}))} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Mobile" value={profile.mobile} onChangeText={v=>setProfile(p=>({...p,mobile:v}))} keyboardType="phone-pad" />
        <Field label="Suburb" value={profile.suburb} onChangeText={v=>setProfile(p=>({...p,suburb:v}))} />
        <Field label="Postcode" value={profile.postcode} onChangeText={v=>setProfile(p=>({...p,postcode:v}))} keyboardType="number-pad" />
      </View>
      <TouchableOpacity style={[s.primaryButton,dataBusy&&s.buttonDisabled]} onPress={saveProfile} disabled={dataBusy}>{dataBusy?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryButtonText}>Save details</Text>}</TouchableOpacity>
      <Text style={s.formNote}>These details are stored against your Stuff account. Changing email may require confirmation.</Text>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='account'&&accountView==='woolworths')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="Shopping service" title="Woolworths" lead="Your Woolworths account stays separate from your Stuff account." onBack={()=>setAccountView('main')} backLabel="Account" />
      <View style={s.wooliesAccountCard}>
        <View style={s.wooliesAccountMark}><Text style={s.wooliesAccountMarkText}>W</Text></View>
        <View style={{flex:1}}><Text style={s.wooliesAccountTitle}>Woolworths on this device</Text><Text style={s.wooliesAccountSub}>Sign in directly with Woolworths when you need to.</Text></View>
      </View>
      <View style={s.securityNote}>
        <Text style={s.securityTitle}>Your Woolworths login stays private.</Text>
        <Text style={s.securityCopy}>Stuff never asks for or stores your Woolworths password or payment details. Checkout remains entirely with Woolworths.</Text>
      </View>
      <TouchableOpacity style={s.primaryButton} onPress={openWoolworthsFromAccount}><Text style={s.primaryButtonText}>Open Woolworths</Text></TouchableOpacity>
      <Text style={s.formNote}>We won’t label Woolworths “connected” until we can reliably verify the retailer session. A proper disconnect control comes with that session-management step.</Text>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='account'&&accountView==='usuals')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="Account" title="Your usuals." lead="Stuff learns repeated household product choices so the next shop gets closer to what you normally buy." onBack={()=>setAccountView('main')} backLabel="Account" />
      {!productMemory.filter(x=>+x.times_used>=2).length?<InfoBlock title="Nothing learned yet">Use Stuff for a couple of shops with “Remember usual brands” switched on. A product becomes a usual after the household chooses the same match more than once.</InfoBlock>:<View style={s.menuBlock}>
        {productMemory.filter(x=>+x.times_used>=2).map(row=><MenuRow key={`${row.retailer}-${row.request_key}`} title={row.product_name||row.request_key} sub={`${title(row.request_key)} · ${row.retailer==='coles'?'Coles':'Woolworths'}${row.size?` · ${row.size}`:''} · chosen ${row.times_used} times`} right="Forget" onPress={()=>forgetUsual(row)} />)}
      </View>}
      {!!productMemory.length&&<TouchableOpacity style={s.secondaryButton} onPress={clearUsuals}><Text style={s.secondaryButtonText}>Forget all learned products</Text></TouchableOpacity>}
      <Text style={s.formNote}>Explicit requests such as “cheapest” or “on special” override a usual product. If a usual is unavailable, Stuff falls back to another suitable match.</Text>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='account'&&accountView==='preferences')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="Shopping preferences" title="Product preferences" lead="Tell Stuff how you generally want products chosen." onBack={()=>setAccountView('main')} backLabel="Account" />

      <Text style={s.sectionTitle}>Preferred supermarket</Text>
      <View style={s.segmentWrap}>
        <TouchableOpacity style={[s.segment,preferences.preferredSupermarket==='woolworths'&&s.segmentActive]} onPress={()=>setPreferences(p=>({...p,preferredSupermarket:'woolworths'}))}><Text style={[s.segmentText,preferences.preferredSupermarket==='woolworths'&&s.segmentTextActive]}>Woolworths</Text></TouchableOpacity>
        <TouchableOpacity style={[s.segment,preferences.preferredSupermarket==='coles'&&s.segmentActive]} onPress={()=>setPreferences(p=>({...p,preferredSupermarket:'coles'}))}><Text style={[s.segmentText,preferences.preferredSupermarket==='coles'&&s.segmentTextActive]}>Coles</Text></TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>Product matching</Text>
      <View style={s.segmentWrap}>
        <TouchableOpacity style={[s.segment,preferences.matchMode==='best'&&s.segmentActive]} onPress={()=>setPreferences(p=>({...p,matchMode:'best'}))}><Text style={[s.segmentText,preferences.matchMode==='best'&&s.segmentTextActive]}>Best match</Text></TouchableOpacity>
        <TouchableOpacity style={[s.segment,preferences.matchMode==='cheapest'&&s.segmentActive]} onPress={()=>setPreferences(p=>({...p,matchMode:'cheapest'}))}><Text style={[s.segmentText,preferences.matchMode==='cheapest'&&s.segmentTextActive]}>Cheapest suitable</Text></TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>Defaults</Text>
      <View style={s.menuBlock}>
        <ToggleRow title="Prefer specials" sub="Choose a special when it’s still a good match" value={preferences.preferSpecials} onValueChange={v=>setPreferences(p=>({...p,preferSpecials:v}))} />
        <ToggleRow title="Allow close alternatives" sub="Use a sensible substitute when the exact item isn’t available" value={preferences.allowAlternatives} onValueChange={v=>setPreferences(p=>({...p,allowAlternatives:v}))} />
        <ToggleRow title="Remember usual brands" sub="Learn repeated household choices and favour them next time" value={preferences.rememberBrands} onValueChange={v=>setPreferences(p=>({...p,rememberBrands:v}))} />
      </View>
      <TouchableOpacity style={[s.primaryButton,dataBusy&&s.buttonDisabled]} onPress={savePreferences} disabled={dataBusy}>{dataBusy?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryButtonText}>Save preferences</Text>}</TouchableOpacity>
      <Text style={s.formNote}>Best match, cheapest suitable, specials and alternative settings change how Stuff chooses products. Learned usuals are used when Remember usual brands is on.</Text>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='account')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="Account" title="Your account." lead="Your details, shopping setup and personal preferences." />

      {!user&&<View style={s.authCard}>
        <Text style={s.authCardTitle}>Save your household.</Text>
        <Text style={s.authCardCopy}>Create a Stuff account to keep your shopping list, household and preferences available across devices.</Text>
        <TouchableOpacity style={s.primaryButton} onPress={()=>setAccountView('auth')}><Text style={s.primaryButtonText}>Sign in or create account</Text></TouchableOpacity>
      </View>}
      {!!user&&<View style={s.signedInCard}>
        <Text style={s.signedInLabel}>SIGNED IN</Text>
        <Text style={s.signedInEmail}>{user.email}</Text>
        {dataBusy&&<Text style={s.signedInSync}>Syncing your Stuff account…</Text>}
        {!dataBusy&&dataReady&&<Text style={s.signedInSync}>Household sync is on</Text>}
      </View>}

      <Text style={s.sectionTitle}>Your details</Text>
      <View style={s.menuBlock}>
        <MenuRow title="Personal details" sub={user?'Name, email, mobile, suburb and postcode':'Sign in to save personal details'} onPress={()=>user?setAccountView('details'):setAccountView('auth')} />
      </View>

      <Text style={s.sectionTitle}>Connected shopping services</Text>
      <View style={s.menuBlock}>
        <MenuRow title="Woolworths" sub="Sign in to Woolworths when you send your shopping" right="Manage" onPress={()=>setAccountView('woolworths')} />
        <MenuRow title="Coles" sub="Coles login stays with Coles on this device" right="Open" onPress={openColesFromAccount} />
      </View>

      <Text style={s.sectionTitle}>Shopping preferences</Text>
      <View style={s.menuBlock}>
        <MenuRow title="Preferred supermarket" sub={preferences.preferredSupermarket==='coles'?'Coles':'Woolworths'} onPress={()=>user?setAccountView('preferences'):setAccountView('auth')} />
        <MenuRow title="Product preferences" sub={user?'Best match, specials, alternatives and usual brands':'Sign in to save product preferences'} onPress={()=>user?setAccountView('preferences'):setAccountView('auth')} />
        <MenuRow title="Your usuals" sub={productMemory.filter(x=>+x.times_used>=2).length?`${productMemory.filter(x=>+x.times_used>=2).length} learned household products`:'Stuff learns what your household repeatedly chooses'} right="Manage" onPress={()=>user?setAccountView('usuals'):setAccountView('auth')} />
      </View>

      <Text style={s.sectionTitle}>Permissions</Text>
      <View style={s.menuBlock}>
        <MenuRow title="Microphone" sub="Used only when you tap to talk" right="Manage" onPress={manageMicrophone} />
      </View>

      <Text style={s.sectionTitle}>Account access</Text>
      <View style={s.menuBlock}>
        {user?<>
          <MenuRow title="Sign out" onPress={signOut} />
          <MenuRow title="Delete account" right="" onPress={deleteAccount} danger />
        </>:<MenuRow title="Sign in or create account" onPress={()=>setAccountView('auth')} />}
      </View>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='more'&&moreView==='how')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="More" title="How it works" lead="From a spoken list to your chosen supermarket, without making grocery shopping another admin job." onBack={()=>setMoreView('main')} backLabel="More" />
      <View style={s.stepsBlock}>
        <View style={s.stepCard}><Text style={s.stepNumber}>1</Text><View style={{flex:1}}><Text style={s.stepTitle}>Say what you need</Text><Text style={s.stepCopy}>Tap to talk and say the groceries naturally. Add more later if you remember something else.</Text></View></View>
        <View style={s.stepCard}><Text style={s.stepNumber}>2</Text><View style={{flex:1}}><Text style={s.stepTitle}>Check the list</Text><Text style={s.stepCopy}>Stuff turns what you said into a simple list you can edit, remove from or share.</Text></View></View>
        <View style={s.stepCard}><Text style={s.stepNumber}>3</Text><View style={{flex:1}}><Text style={s.stepTitle}>Choose where to shop</Text><Text style={s.stepCopy}>Stuff matches the list for your preferred supermarket and hands confident matches into the retailer experience. You review everything before ordering.</Text></View></View>
        <View style={s.stepCard}><Text style={s.stepNumber}>4</Text><View style={{flex:1}}><Text style={s.stepTitle}>You review and checkout</Text><Text style={s.stepCopy}>Check every product, price and quantity with the retailer before completing your order.</Text></View></View>
      </View>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='more'&&moreView==='help')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="More" title="Help & support" lead="If something goes wrong, this is where you’ll get help." onBack={()=>setMoreView('main')} backLabel="More" />
      <View style={s.menuBlockWithTop}>
        <MenuRow title="Report a problem" sub="Tell us what went wrong" onPress={reportProblem} />
        <MenuRow title="Shopping list help" sub="Voice, editing and shared lists" onPress={()=>setMoreView('how')} />
        <MenuRow title="Retailer help" sub="Retailer login, cart and checkout stay with the retailer" onPress={()=>setMoreView('privacy')} />
      </View>
      <InfoBlock title="Support and security">Signed-in users can send a support report from this screen. Never include a Woolworths or Coles password, verification code or payment details in a support report.</InfoBlock>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='more'&&moreView==='privacy')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="More" title="Privacy" lead="A simple view of what Stuff uses and what stays with the retailer." onBack={()=>setMoreView('main')} backLabel="More" />
      <InfoBlock title="Voice and AI">Your microphone is used only when you tap to talk. The recording is sent to Stuff’s backend and OpenAI’s API for transcription and grocery-list interpretation. Stuff does not intentionally store the audio file in its database after processing.</InfoBlock>
      <InfoBlock title="Stuff account">If you create a Stuff account, Stuff stores your account details, household membership, preferences and shared shopping data needed to provide the service.</InfoBlock>
      <InfoBlock title="Retailer accounts">Stuff does not ask for or store your Woolworths or Coles password or payment details. Retailer login, saved payment methods and checkout stay with the retailer.</InfoBlock>
      <InfoBlock title="Household sharing">People who join the same household can see and change the shared grocery list. Household access is protected by signed-in Stuff accounts.</InfoBlock>
      <InfoBlock title="Data hosting">Stuff currently uses Supabase infrastructure hosted in South Korea, and OpenAI API services for voice processing.</InfoBlock>
      <TouchableOpacity style={s.secondaryButton} onPress={()=>Linking.openURL(PRIVACY_URL)}><Text style={s.secondaryButtonText}>Open full Privacy Policy</Text></TouchableOpacity>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='more'&&moreView==='terms')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="More" title="Terms" lead="The important boundaries of the current service." onBack={()=>setMoreView('main')} backLabel="More" />
      <InfoBlock title="Independent service">Stuff is not affiliated with, endorsed by or sponsored by Woolworths, Coles or other retailers unless we expressly say otherwise.</InfoBlock>
      <InfoBlock title="You stay in control">Stuff helps prepare a shopping list and may add suggested products to a retailer cart. Product matching can be wrong, so you must review the retailer cart before ordering.</InfoBlock>
      <InfoBlock title="Prices and availability">Retailer prices, specials, availability, substitutions and delivery options can change. Your chosen retailer remains the source of truth for the final order.</InfoBlock>
      <InfoBlock title="Checkout and payment">Stuff does not submit checkout or payment. Ordering and payment are completed with the retailer.</InfoBlock>
      <InfoBlock title="Restricted products">Stuff does not automatically match or add alcohol, tobacco, nicotine, vaping or other age-restricted products during this release.</InfoBlock>
      <InfoBlock title="Retailer connectivity">Stuff uses current retailer website behaviour. Retailer functionality can change or become unavailable, and Stuff will not bypass retailer security controls.</InfoBlock>
      <TouchableOpacity style={s.secondaryButton} onPress={()=>Linking.openURL(TERMS_URL)}><Text style={s.secondaryButtonText}>Open full Terms of Use</Text></TouchableOpacity>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='more'&&moreView==='about')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="More" title="About Stuff the Shopping" lead="Less grocery admin. More getting it done." onBack={()=>setMoreView('main')} backLabel="More" />
      <View style={s.aboutHero}><Text style={s.aboutBig}>stuff{`\n`}the{`\n`}shopping<Text style={s.dot}>.</Text></Text><Text style={s.aboutTag}>We’ll do the groceries.</Text></View>
      <InfoBlock title="What we’re building">Say what you need, keep one shared household list and move it towards a retailer order without manually searching for every product.</InfoBlock>
      <Text style={s.version}>Stuff the Shopping · MVP</Text>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

  if(tab==='more')return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F7F1E3"/>
    <ScrollView contentContainerStyle={s.pageScreen}>
      <PageHeader eyebrow="More" title="Help, privacy & about." />
      <View style={s.menuBlockWithTop}>
        <MenuRow title="How it works" sub="From voice to your chosen supermarket" onPress={()=>setMoreView('how')} />
        {__DEV__&&<MenuRow title="Load regression test shop" sub="22 deliberately awkward groceries for Woolworths + Coles testing" right="Load" onPress={loadRegressionShop} />}
        <MenuRow title="Help & support" sub="Get help or report a problem" onPress={()=>setMoreView('help')} />
        <MenuRow title="Privacy" sub="Voice, account and retailer data" onPress={()=>setMoreView('privacy')} />
        <MenuRow title="Terms" sub="Terms of use and retailer disclaimer" onPress={()=>setMoreView('terms')} />
        <MenuRow title="About Stuff the Shopping" onPress={()=>setMoreView('about')} />
      </View>
      <Text style={s.version}>Stuff the Shopping · MVP</Text>
    </ScrollView>
    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;

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
      {!!user&&dataReady&&<Text style={s.syncLine}>✓ Shared household list synced</Text>}

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

      {preferences.preferredSupermarket==='coles'?<>
        <TouchableOpacity style={[s.colesButton,!canSend&&s.sendOff]} onPress={compareColes} disabled={!canSend}>
          <View style={s.colesMark}><Text style={s.colesMarkText}>C</Text></View>
          <View style={s.sendCopy}><Text style={s.colesButtonText}>Check at Coles</Text><Text style={s.colesButtonSub}>Match the list and estimate the basket</Text></View>
          <Text style={s.sendArrow}>›</Text>
        </TouchableOpacity>
        <Text style={s.note}>We’ll match your list at Coles. You review everything with Coles before ordering.</Text>
      </>:<>
        <TouchableOpacity style={[s.send,!canSend&&s.sendOff]} onPress={send} disabled={!canSend}>
          <View style={s.wooliesMark}><Text style={s.wooliesMarkText}>W</Text></View>
          <View style={s.sendCopy}>
            <Text style={s.sendText}>Send to Woolies</Text>
            <Text style={s.sendSub}>Add to your Woolworths cart</Text>
          </View>
          <Text style={s.sendArrow}>›</Text>
        </TouchableOpacity>
        <Text style={s.note}>We’ll build your Woolies cart. You review it before checkout.</Text>
      </>}
    </ScrollView>

    <BottomNav tab={tab} onChange={goTab}/>
  </SafeAreaView>;
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F7F1E3'},
  screen:{padding:22,paddingTop:14,paddingBottom:22},
  pageScreen:{padding:22,paddingTop:14,paddingBottom:34},
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
  syncLine:{marginTop:6,color:'#32795C',fontSize:11,fontWeight:'800',textAlign:'center'},
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
  colesButton:{marginTop:10,minHeight:58,borderRadius:16,backgroundColor:'#E01A22',paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'center'},
  colesMark:{width:38,height:38,borderRadius:19,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',marginRight:12},
  colesMarkText:{color:'#E01A22',fontSize:21,fontWeight:'900'},
  colesButtonText:{color:'#FFFFFF',fontSize:16,fontWeight:'900'},
  colesButtonSub:{marginTop:2,color:'#FFE7E8',fontSize:11,fontWeight:'600'},
  colesSummary:{marginTop:24,padding:20,borderRadius:20,backgroundColor:'#E01A22'},
  colesSummaryLabel:{color:'#FFE7E8',fontSize:10,fontWeight:'900',letterSpacing:.8},
  colesSummaryTotal:{marginTop:6,color:'#FFFFFF',fontSize:42,lineHeight:46,fontWeight:'900',letterSpacing:-1.5},
  colesSummaryMeta:{marginTop:4,color:'#FFE7E8',fontSize:12,fontWeight:'700'},
  colesRows:{marginTop:18,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#BEB6A7'},
  colesRow:{minHeight:62,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#BEB6A7'},
  colesPrice:{color:'#171717',fontSize:15,fontWeight:'900',marginLeft:12},
  sendCopy:{flex:1},
  sendText:{color:'#FFFFFF',fontSize:17,fontWeight:'900'},
  sendSub:{marginTop:2,color:'#E5F1ED',fontSize:11,fontWeight:'600'},
  sendArrow:{color:'#FFFFFF',fontSize:34,lineHeight:36,fontWeight:'300',marginLeft:7},
  note:{marginTop:7,color:'#69635A',fontSize:11,lineHeight:15,textAlign:'center'},
  pageIntro:{marginTop:34},
  pageEyebrow:{fontSize:15,color:'#F4512C',fontWeight:'900',textTransform:'uppercase',letterSpacing:.6},
  pageTitle:{marginTop:8,color:'#171717',fontSize:34,lineHeight:37,fontWeight:'900',letterSpacing:-1.2},
  pageLead:{marginTop:10,color:'#55514A',fontSize:15,lineHeight:21,fontWeight:'600',maxWidth:330},
  householdHero:{marginTop:28,backgroundColor:'#F5D95E',borderRadius:22,padding:20},
  heroKicker:{fontSize:11,color:'#5A4B00',fontWeight:'900',letterSpacing:.8},
  heroNumber:{marginTop:8,color:'#171717',fontSize:50,lineHeight:54,fontWeight:'900',letterSpacing:-2},
  heroCopy:{color:'#4F493B',fontSize:14,fontWeight:'700'},
  heroButton:{marginTop:18,alignSelf:'flex-start',backgroundColor:'#171717',borderRadius:18,paddingHorizontal:14,paddingVertical:9},
  heroButtonText:{color:'#FFFFFF',fontSize:13,fontWeight:'900'},
  sectionTitle:{marginTop:28,marginBottom:8,color:'#171717',fontSize:18,fontWeight:'900'},
  menuBlock:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#BEB6A7',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#BEB6A7'},
  menuBlockWithTop:{marginTop:24,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#BEB6A7',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#BEB6A7'},
  menuRow:{minHeight:66,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#D4CCBE'},
  menuTitle:{color:'#171717',fontSize:16,fontWeight:'800'},
  menuSub:{marginTop:4,color:'#69635A',fontSize:12,lineHeight:16,fontWeight:'600'},
  menuRight:{color:'#69635A',fontSize:14,fontWeight:'800'},
  danger:{color:'#C83D24'},
  securityNote:{marginTop:14,padding:14,borderRadius:14,backgroundColor:'#FFF8D9'},
  securityTitle:{color:'#171717',fontSize:13,fontWeight:'900'},
  securityCopy:{marginTop:5,color:'#5D574B',fontSize:12,lineHeight:17,fontWeight:'600'},
  sharedNote:{marginTop:18,padding:16,borderRadius:16,backgroundColor:'#FFF8D9'},
  sharedNoteTitle:{color:'#171717',fontSize:14,fontWeight:'900'},
  sharedNoteCopy:{marginTop:5,color:'#5D574B',fontSize:12,lineHeight:17,fontWeight:'600'},
  authCard:{marginTop:24,padding:18,borderRadius:20,backgroundColor:'#FFF8D9',borderWidth:1,borderColor:'#E5D89C'},
  authCardTitle:{color:'#171717',fontSize:18,fontWeight:'900'},
  authCardCopy:{marginTop:6,color:'#5D574B',fontSize:13,lineHeight:18,fontWeight:'600'},
  signedInCard:{marginTop:24,padding:16,borderRadius:18,backgroundColor:'#FFFDF7',borderWidth:1,borderColor:'#D4CCBE'},
  signedInLabel:{color:'#32795C',fontSize:10,fontWeight:'900',letterSpacing:.8},
  signedInEmail:{marginTop:5,color:'#171717',fontSize:15,fontWeight:'900'},
  signedInSync:{marginTop:5,color:'#69635A',fontSize:11,fontWeight:'700'},
  inlineBack:{marginTop:20,alignSelf:'flex-start',paddingVertical:4,paddingRight:10},
  inlineBackText:{color:'#171717',fontSize:14,fontWeight:'900'},
  formBlock:{marginTop:24},
  fieldWrap:{marginBottom:16},
  fieldLabel:{marginBottom:6,color:'#55514A',fontSize:12,fontWeight:'800'},
  field:{height:50,borderWidth:1,borderColor:'#BEB6A7',borderRadius:14,backgroundColor:'#FFFDF7',paddingHorizontal:14,color:'#171717',fontSize:16,fontWeight:'600'},
  fieldDisabled:{backgroundColor:'#EDE8DC',color:'#777169'},
  primaryButton:{marginTop:20,minHeight:52,borderRadius:26,backgroundColor:'#171717',alignItems:'center',justifyContent:'center',paddingHorizontal:18},
  primaryButtonText:{color:'#FFFFFF',fontSize:15,fontWeight:'900'},
  secondaryButton:{marginTop:10,minHeight:50,borderRadius:25,borderWidth:1,borderColor:'#171717',alignItems:'center',justifyContent:'center',paddingHorizontal:18},
  secondaryButtonText:{color:'#171717',fontSize:14,fontWeight:'900'},
  buttonDisabled:{opacity:.55},
  formNote:{marginTop:12,color:'#777169',fontSize:11,lineHeight:16,textAlign:'center',fontWeight:'600'},
  wooliesAccountCard:{marginTop:26,minHeight:76,borderRadius:18,backgroundColor:'#006B54',padding:15,flexDirection:'row',alignItems:'center'},
  wooliesAccountMark:{width:42,height:42,borderRadius:21,backgroundColor:'#8CC63F',alignItems:'center',justifyContent:'center',marginRight:12},
  wooliesAccountMarkText:{color:'#FFFFFF',fontSize:22,fontWeight:'900',fontStyle:'italic'},
  wooliesAccountTitle:{color:'#FFFFFF',fontSize:16,fontWeight:'900'},
  wooliesAccountSub:{marginTop:4,color:'#E5F1ED',fontSize:11,lineHeight:15,fontWeight:'600'},
  segmentWrap:{flexDirection:'row',borderWidth:1,borderColor:'#BEB6A7',borderRadius:14,overflow:'hidden'},
  segment:{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',paddingHorizontal:8,backgroundColor:'#FFFDF7'},
  segmentActive:{backgroundColor:'#171717'},
  segmentText:{color:'#55514A',fontSize:12,fontWeight:'800',textAlign:'center'},
  segmentTextActive:{color:'#FFFFFF'},
  toggleRow:{minHeight:72,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#D4CCBE'},
  memberBlock:{marginTop:24,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#BEB6A7'},
  memberRow:{minHeight:78,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#D4CCBE'},
  memberAvatar:{width:42,height:42,borderRadius:21,backgroundColor:'#F5D95E',alignItems:'center',justifyContent:'center',marginRight:12},
  memberAvatarText:{color:'#171717',fontSize:17,fontWeight:'900'},
  memberName:{color:'#171717',fontSize:15,fontWeight:'900'},
  memberMeta:{marginTop:3,color:'#69635A',fontSize:11,fontWeight:'700'},
  memberContact:{marginTop:2,color:'#8B8479',fontSize:11,fontWeight:'600'},
  memberRemove:{paddingVertical:8,paddingLeft:10},
  memberRemoveText:{color:'#C83D24',fontSize:11,fontWeight:'800'},
  stepsBlock:{marginTop:24,gap:10},
  stepCard:{padding:16,borderRadius:18,backgroundColor:'#FFFDF7',borderWidth:1,borderColor:'#D4CCBE',flexDirection:'row',gap:14},
  stepNumber:{width:28,height:28,borderRadius:14,backgroundColor:'#F4512C',color:'#FFFFFF',fontSize:14,lineHeight:28,textAlign:'center',fontWeight:'900'},
  stepTitle:{color:'#171717',fontSize:15,fontWeight:'900'},
  stepCopy:{marginTop:5,color:'#69635A',fontSize:12,lineHeight:17,fontWeight:'600'},
  infoBlock:{marginTop:16,padding:16,borderRadius:16,backgroundColor:'#FFFDF7',borderWidth:1,borderColor:'#D4CCBE'},
  infoTitle:{color:'#171717',fontSize:14,fontWeight:'900'},
  infoCopy:{marginTop:6,color:'#5D574B',fontSize:12,lineHeight:18,fontWeight:'600'},
  aboutHero:{marginTop:24,padding:20,borderRadius:22,backgroundColor:'#F5D95E'},
  aboutBig:{color:'#171717',fontSize:38,lineHeight:33,fontWeight:'900',letterSpacing:-2},
  aboutTag:{marginTop:18,color:'#4F493B',fontSize:15,fontWeight:'800'},
  version:{marginTop:28,color:'#8B8479',fontSize:11,textAlign:'center',fontWeight:'700'},
  bottomNav:{minHeight:82,backgroundColor:'#000000',paddingHorizontal:12,paddingTop:10,paddingBottom:10,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},
  navItem:{flex:1,alignItems:'center',justifyContent:'center'},
  navIcon:{color:'#FFFFFF',fontSize:26,lineHeight:28,fontWeight:'700'},
  navMore:{color:'#FFFFFF',fontSize:23,lineHeight:28,fontWeight:'900',letterSpacing:2},
  navLabel:{marginTop:3,color:'#AFAFAF',fontSize:11,fontWeight:'700'},
  navLabelActive:{marginTop:3,color:'#FFFFFF',fontSize:11,fontWeight:'900'},
  cartHead:{minHeight:64,paddingHorizontal:12,paddingVertical:8,backgroundColor:'#F7F1E3',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#C9C1B4',flexDirection:'row',alignItems:'center'},
  back:{padding:10},
  backText:{fontSize:16,fontWeight:'900'},
  cartTitle:{fontSize:15,fontWeight:'900'},
  cartStatus:{marginTop:2,color:'#69635A',fontSize:11}
});