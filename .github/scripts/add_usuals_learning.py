from pathlib import Path
import re

# ----- data layer -----
data_path = Path('mobile/stuffData.js')
d = data_path.read_text()

old = "  const [profileResult, preferencesResult, householdResult, membersResult, listResult, invitesResult] = await Promise.all([\n"
new = "  const [profileResult, preferencesResult, householdResult, membersResult, listResult, invitesResult, productMemoryResult] = await Promise.all([\n"
if old not in d:
    raise SystemExit('bundle destructure marker missing')
d = d.replace(old, new, 1)

old = "    householdId ? supabase.from('stuff_household_invites').select('*').eq('household_id', householdId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),\n  ]);\n\n  const firstError = [profileResult, preferencesResult, householdResult, membersResult, listResult, invitesResult].find(r => r?.error)?.error;\n"
new = "    householdId ? supabase.from('stuff_household_invites').select('*').eq('household_id', householdId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),\n    householdId ? supabase.from('stuff_household_product_memory').select('*').eq('household_id', householdId).order('last_used_at', { ascending: false }) : Promise.resolve({ data: [] }),\n  ]);\n\n  const firstError = [profileResult, preferencesResult, householdResult, membersResult, listResult, invitesResult, productMemoryResult].find(r => r?.error)?.error;\n"
if old not in d:
    raise SystemExit('bundle promise marker missing')
d = d.replace(old, new, 1)

old = "    invites: invitesResult.data || [],\n  };\n}\n"
new = "    invites: invitesResult.data || [],\n    productMemory: productMemoryResult.data || [],\n  };\n}\n"
if old not in d:
    raise SystemExit('bundle return marker missing')
d = d.replace(old, new, 1)

if 'export async function rememberStuffHouseholdProduct' not in d:
    d += r'''

function stuffMemoryKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(on special|cheapest|best value|value option)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function rememberStuffHouseholdProduct(householdId, retailer, selection) {
  if (!householdId || !selection?.request || !selection?.productId) return null;
  const requestKey = stuffMemoryKey(selection.request);
  if (!requestKey) return null;
  const rpcResult = await supabase.rpc('remember_stuff_household_product', {
    p_household_id: householdId,
    p_retailer: retailer === 'coles' ? 'coles' : 'woolworths',
    p_request_key: requestKey,
    p_product_id: String(selection.productId),
    p_product_name: String(selection.productName || selection.product || '').trim() || null,
    p_brand: String(selection.brand || '').trim() || null,
    p_size: String(selection.size || '').trim() || null,
  });
  throwIfError(rpcResult);
  const rowResult = await supabase
    .from('stuff_household_product_memory')
    .select('*')
    .eq('household_id', householdId)
    .eq('retailer', retailer === 'coles' ? 'coles' : 'woolworths')
    .eq('request_key', requestKey)
    .maybeSingle();
  return throwIfError(rowResult);
}

export async function forgetStuffHouseholdProduct(householdId, retailer, requestKey) {
  if (!householdId) return;
  throwIfError(await supabase
    .from('stuff_household_product_memory')
    .delete()
    .eq('household_id', householdId)
    .eq('retailer', retailer)
    .eq('request_key', String(requestKey || '').trim().toLowerCase()));
}

export async function clearStuffHouseholdProductMemory(householdId) {
  if (!householdId) return;
  throwIfError(await supabase
    .from('stuff_household_product_memory')
    .delete()
    .eq('household_id', householdId));
}
'''

data_path.write_text(d)

# ----- app layer -----
app_path = Path('mobile/StuffApp.js')
t = app_path.read_text()

# imports
old = "  createStuffSupportRequest,\n  deleteStuffAccount,\n  loadStuffBundle,\n"
new = "  createStuffSupportRequest,\n  clearStuffHouseholdProductMemory,\n  deleteStuffAccount,\n  forgetStuffHouseholdProduct,\n  loadStuffBundle,\n  rememberStuffHouseholdProduct,\n"
if old not in t:
    raise SystemExit('import marker missing')
t = t.replace(old, new, 1)

# Woolworths matcher memory support
t = t.replace("function wooliesScript(items, preferences={}) {", "function wooliesScript(items, preferences={}, productMemory=[]) {", 1)
t = t.replace("  const payload = JSON.stringify(items.slice(0, 60));\n  const prefsPayload = JSON.stringify({", "  const payload = JSON.stringify(items.slice(0, 60));\n  const memoryPayload = JSON.stringify((productMemory||[]).slice(0,120));\n  const prefsPayload = JSON.stringify({", 1)

# Coles matcher memory support - second occurrence of payload marker
coles_sig = "function colesCompareScript(items, preferences={}) {"
if coles_sig not in t:
    raise SystemExit('Coles signature missing')
t = t.replace(coles_sig, "function colesCompareScript(items, preferences={}, productMemory=[]) {", 1)
# Insert memoryPayload into Coles section specifically.
idx = t.index("function colesCompareScript(items, preferences={}, productMemory=[])")
sub = t[idx:]
old = "  const payload = JSON.stringify(items.slice(0, 60));\n  const prefsPayload = JSON.stringify({"
if old not in sub:
    raise SystemExit('Coles payload marker missing')
sub = sub.replace(old, "  const payload = JSON.stringify(items.slice(0, 60));\n  const memoryPayload = JSON.stringify((productMemory||[]).slice(0,120));\n  const prefsPayload = JSON.stringify({", 1)
t = t[:idx] + sub

# Both prefs payloads should carry rememberBrands.
t = t.replace("    allowAlternatives: preferences.allowAlternatives!==false,\n  });", "    allowAlternatives: preferences.allowAlternatives!==false,\n    rememberBrands: preferences.rememberBrands!==false,\n  });", 2)

# Inject memories into the retailer scripts.
t = t.replace(" const items=${payload},prefs=${prefsPayload},sleep=ms=>new Promise(r=>setTimeout(r,ms));", " const items=${payload},prefs=${prefsPayload},memories=${memoryPayload},sleep=ms=>new Promise(r=>setTimeout(r,ms));", 1)
t = t.replace(" const items=${payload},prefs=${prefsPayload};", " const items=${payload},prefs=${prefsPayload},memories=${memoryPayload};", 1)

# Add common memory lookup after each req helper.
req_line = " const req=i=>(String(i.name||'')+' '+String(i.unit||'')).toLowerCase();\n"
mem_helpers = req_line + " const memoryKey=v=>String(v||'').toLowerCase().replace(/\\b(on special|cheapest|best value|value option)\\b/g,'').replace(/\\s+/g,' ').trim();\n const memoryFor=i=>memories.find(m=>String(m.request_key||'')===memoryKey(i.name));\n"
if t.count(req_line) < 2:
    raise SystemExit('request helpers missing')
t = t.replace(req_line, mem_helpers, 2)

# Woolworths: explicit special intent and learned exact-product boost.
old = "if(prefs.preferSpecials&&p.IsOnSpecial)s+=35;if(p.IsAvailable===false||p.IsInStock===false)s-=200;return s};"
new = "if((prefs.preferSpecials||/\\bon special\\b/.test(r))&&p.IsOnSpecial)s+=/\\bon special\\b/.test(r)?180:35;const mem=memoryFor(i);if(prefs.rememberBrands&&mem&&+mem.times_used>=2&&String(mem.product_id)===String(p.Stockcode)&&!/\\b(cheapest|best value|value option|on special)\\b/.test(r))s+=Math.min(260,100+(+mem.times_used*35));if(p.IsAvailable===false||p.IsInStock===false)s-=200;return s};"
if old not in t:
    raise SystemExit('Woolworths score marker missing')
t = t.replace(old, new, 1)

# Coles: same learning rule.
old = "if(prefs.preferSpecials&&isSpecial(p))s+=35;if(p?.availability===false)s-=200;return s};"
new = "if((prefs.preferSpecials||/\\bon special\\b/.test(r))&&isSpecial(p))s+=/\\bon special\\b/.test(r)?180:35;const mem=memoryFor(i);if(prefs.rememberBrands&&mem&&+mem.times_used>=2&&String(mem.product_id)===String(p?.id)&&!/\\b(cheapest|best value|value option|on special)\\b/.test(r))s+=Math.min(260,100+(+mem.times_used*35));if(p?.availability===false)s-=200;return s};"
if old not in t:
    raise SystemExit('Coles score marker missing')
t = t.replace(old, new, 1)

# Explicit 'cheapest' voice instructions override remembered usuals / default matching.
sort_old = "ranked.sort((a,b)=>prefs.matchMode==='cheapest'?(a.price-b.price||b.s-a.s):(b.s-a.s||a.price-b.price));"
sort_new = "ranked.sort((a,b)=>(prefs.matchMode==='cheapest'||/\\b(cheapest|best value|value option)\\b/.test(req(i)))?(a.price-b.price||b.s-a.s):(b.s-a.s||a.price-b.price));"
if t.count(sort_old) < 2:
    raise SystemExit('retailer sort markers missing')
t = t.replace(sort_old, sort_new, 2)

# Return successful Woolworths selections to the native app so they can be learned.
old = "let added=0,failed=0;for(let n=0;n<chosen.length;n++){post('WOOLIES_STATUS','Adding '+(n+1)+' of '+chosen.length+': '+chosen[n][0].name);(await add(...chosen[n]))?added++:failed++;await sleep(220)}const message=added+' products added.'+(unmatched.length?' Could not confidently match: '+unmatched.join(', ')+'.':'')+(failed?' '+failed+' failed to add.':'');post('WOOLIES_DONE',message,{added,failed,unmatched,success:added>0})"
new = "let added=0,failed=0,remembered=[];for(let n=0;n<chosen.length;n++){const i=chosen[n][0],p=chosen[n][1];post('WOOLIES_STATUS','Adding '+(n+1)+' of '+chosen.length+': '+i.name);if(await add(i,p)){added++;remembered.push({request:i.name,productId:String(p.Stockcode),productName:p.DisplayName||p.Name||'',brand:p.Brand||'',size:p.PackageSize||''})}else failed++;await sleep(220)}const message=added+' products added.'+(unmatched.length?' Could not confidently match: '+unmatched.join(', ')+'.':'')+(failed?' '+failed+' failed to add.':'');post('WOOLIES_DONE',message,{added,failed,unmatched,remembered,success:added>0})"
if old not in t:
    raise SystemExit('Woolworths add loop marker missing')
t = t.replace(old, new, 1)

# State.
old = "  const [colesResults,setColesResults]=useState(null);\n"
new = old + "  const [productMemory,setProductMemory]=useState([]);\n"
if old not in t:
    raise SystemExit('Coles state marker missing')
if "setProductMemory" not in t:
    t = t.replace(old, new, 1)

# Reset memory when signed out.
old = "      setHouseholdMembers([]);\n      setProfile({firstName:'',lastName:'',email:'',mobile:'',suburb:'',postcode:''});\n"
new = "      setHouseholdMembers([]);\n      setProductMemory([]);\n      setProfile({firstName:'',lastName:'',email:'',mobile:'',suburb:'',postcode:''});\n"
if old not in t:
    raise SystemExit('signed-out reset marker missing')
t = t.replace(old, new, 1)

# Load household usuals.
old = "        setHouseholdId(bundle?.householdId||null);\n        setProfile({\n"
new = "        setHouseholdId(bundle?.householdId||null);\n        setProductMemory(Array.isArray(bundle?.productMemory)?bundle.productMemory:[]);\n        setProfile({\n"
if old not in t:
    raise SystemExit('bundle memory marker missing')
t = t.replace(old, new, 1)

# Learning / forgetting helpers before retailer watchdog functions.
marker = "  function clearRetailerWatchdog(){if(retailerWatchdog.current){clearTimeout(retailerWatchdog.current);retailerWatchdog.current=null}}\n"
helpers = r'''  async function learnProduct(retailer,selection){
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

'''
if marker not in t:
    raise SystemExit('watchdog marker missing')
if "async function learnProduct" not in t:
    t = t.replace(marker, helpers + marker, 1)

# Learn successful Woolworths additions.
old = "if(m?.type==='WOOLIES_DONE'){clearRetailerWatchdog();const added=Number(m.added||0);pending.current=[];setStatus(added?`Done — ${added} ${added===1?'product':'products'} added.`:(m.message||'Nothing was added.'));if(added)setTimeout(openCart,350)}"
new = "if(m?.type==='WOOLIES_DONE'){clearRetailerWatchdog();const added=Number(m.added||0);for(const x of (m.remembered||[]))learnProduct('woolworths',x);pending.current=[];setStatus(added?`Done — ${added} ${added===1?'product':'products'} added.`:(m.message||'Nothing was added.'));if(added)setTimeout(openCart,350)}"
if old not in t:
    raise SystemExit('Woolworths message marker missing')
t = t.replace(old, new, 1)

# Pass household memory into Woolworths script.
old = "wooliesScript(pending.current,preferences)"
new = "wooliesScript(pending.current,preferences,productMemory.filter(x=>x.retailer==='woolworths'))"
if old not in t:
    raise SystemExit('Woolworths injection marker missing')
t = t.replace(old, new, 1)

# Pass household memory into Coles script.
old = "colesCompareScript(pending.current,preferences)"
new = "colesCompareScript(pending.current,preferences,productMemory.filter(x=>x.retailer==='coles'))"
if old not in t:
    raise SystemExit('Coles injection marker missing')
t = t.replace(old, new, 1)

# Learn only once Coles confirms a product was added to the trolley.
old = "    if(m.success)colesCartAdded.current+=1;else colesCartFailed.current.push(current?.request||m.name||'item');\n"
new = "    if(m.success){colesCartAdded.current+=1;learnProduct('coles',current)}else colesCartFailed.current.push(current?.request||m.name||'item');\n"
if old not in t:
    raise SystemExit('Coles cart learning marker missing')
t = t.replace(old, new, 1)

# Fix stale invite copy now that invite sharing and acceptance exist.
t = t.replace("Alert.alert('Invite saved','The invitation is now stored as pending. We’ll add delivery and invite acceptance next.');", "Alert.alert('Invite ready','The iPhone share sheet includes the Stuff invite code and link. The recipient signs in or creates a Stuff account to join your household.');")
t = t.replace("The invite is stored securely as pending. Delivery and acceptance are the next household step.", "The invite is stored securely as pending until the recipient joins with the invite code or link.")
t = t.replace("Multi-person invite acceptance is the next household step.", "Invite someone with a code or link and they can join the same shared household list.")

# Add Your usuals screen immediately before product preferences.
pref_marker = "  if(tab==='account'&&accountView==='preferences')return <SafeAreaView style={s.safe}>"
if pref_marker not in t:
    raise SystemExit('account preferences render marker missing')
usuals_screen = r'''  if(tab==='account'&&accountView==='usuals')return <SafeAreaView style={s.safe}>
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

'''
t = t.replace(pref_marker, usuals_screen + pref_marker, 1)

# Add Your usuals to Account menu after Product preferences.
pattern = re.compile(r'(\s*<MenuRow title="Product preferences"[^\n]*\n)')
m = pattern.search(t)
if not m:
    raise SystemExit('Product preferences menu row missing')
row = m.group(1)
insert = row + "        <MenuRow title=\"Your usuals\" sub={productMemory.filter(x=>+x.times_used>=2).length?`${productMemory.filter(x=>+x.times_used>=2).length} learned household products`:'Stuff learns what your household repeatedly chooses'} right=\"Manage\" onPress={()=>user?setAccountView('usuals'):setAccountView('auth')} />\n"
t = t[:m.start()] + insert + t[m.end():]

app_path.write_text(t)
