from pathlib import Path

app = Path('mobile/StuffApp.js')
text = app.read_text()

# AsyncStorage for one-time legal acknowledgement.
old = "import React, { useEffect, useMemo, useRef, useState } from 'react';\n"
new = old + "import AsyncStorage from '@react-native-async-storage/async-storage';\n"
if old not in text:
    raise SystemExit('React import marker missing')
if "import AsyncStorage" not in text:
    text = text.replace(old, new, 1)

# Support function import.
old = "  createStuffInvite,\n"
new = old + "  createStuffSupportRequest,\n"
if old not in text:
    raise SystemExit('stuffData import marker missing')
if "createStuffSupportRequest" not in text:
    text = text.replace(old, new, 1)

# Legal URLs and restricted-product filter.
marker = "const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';\n"
addition = marker + "const LEGAL_VERSION = '2026-08-26-v1';\nconst PRIVACY_URL = 'https://stufftheshopping.com.au/privacy.html';\nconst TERMS_URL = 'https://stufftheshopping.com.au/terms.html';\nconst RESTRICTED_RE = /\\b(alcohol|alcoholic|beer|lager|ale|cider|wine|champagne|prosecco|spirits?|vodka|gin|whisk(?:y|ey)|bourbon|rum|tequila|liqueur|cigarettes?|cigars?|tobacco|nicotine|vapes?|vaping|e[- ]?cigarettes?)\\b/i;\n"
if marker not in text:
    raise SystemExit('UA marker missing')
if "LEGAL_VERSION" not in text:
    text = text.replace(marker, addition, 1)

# Helper before mergeItems.
marker = "function mergeItems(current, actions) {\n"
helper = "function splitRetailerItems(sourceItems) {\n  const allowed=[],restricted=[];\n  for(const item of sourceItems||[]){(RESTRICTED_RE.test(String(item?.name||''))?restricted:allowed).push(item)}\n  return {allowed,restricted};\n}\n\n" + marker
if marker not in text:
    raise SystemExit('mergeItems marker missing')
if "function splitRetailerItems" not in text:
    text = text.replace(marker, helper, 1)

# Legal states.
marker = "  const [authBusy,setAuthBusy]=useState(false),[dataBusy,setDataBusy]=useState(false),[dataReady,setDataReady]=useState(false);\n"
replacement = marker + "  const [legalReady,setLegalReady]=useState(false),[legalAccepted,setLegalAccepted]=useState(false);\n"
if marker not in text:
    raise SystemExit('busy state marker missing')
if "legalReady" not in text:
    text = text.replace(marker, replacement, 1)

# Legal bootstrap effect.
marker = "  useEffect(()=>{ itemsRef.current=items; },[items]);\n"
effect = marker + "\n  useEffect(()=>{\n    let active=true;\n    AsyncStorage.getItem('stuff_legal_version').then(v=>{if(active){setLegalAccepted(v===LEGAL_VERSION);setLegalReady(true)}}).catch(()=>{if(active){setLegalReady(true)}});\n    return()=>{active=false};\n  },[]);\n\n  async function acceptLegal(){\n    try{await AsyncStorage.setItem('stuff_legal_version',LEGAL_VERSION)}catch(_){}\n    setLegalAccepted(true);\n  }\n"
if marker not in text:
    raise SystemExit('items effect marker missing')
if "async function acceptLegal" not in text:
    text = text.replace(marker, effect, 1)

# Replace retailer entry functions with restricted-product aware versions.
old = "  function send(){if(!canSend)return;wooliesReturnTab.current='home';pending.current=items.map(i=>({name:i.name,qty:i.quantity,quantity:i.quantity,unit:i.unit}));injected.current=false;retries.current=0;setStatus('Connecting to Woolies…');setCartUrl('https://www.woolworths.com.au/');setWebKey(k=>k+1);setMode('woolies')}\n"
new = "  function send(){if(!canSend)return;const {allowed,restricted}=splitRetailerItems(items);if(restricted.length)Alert.alert('Some items were not automated',`Stuff leaves age-restricted items on your list for you to handle directly with the retailer: ${restricted.map(x=>title(x.name)).join(', ')}.`);if(!allowed.length)return;wooliesReturnTab.current='home';pending.current=allowed.map(i=>({name:i.name,qty:i.quantity,quantity:i.quantity,unit:i.unit}));injected.current=false;retries.current=0;setStatus('Connecting to Woolies…');setCartUrl('https://www.woolworths.com.au/');setWebKey(k=>k+1);setMode('woolies')}\n"
if old not in text:
    raise SystemExit('send function marker missing')
text = text.replace(old, new, 1)

old = "  function compareColes(){if(!canSend)return;wooliesReturnTab.current='home';pending.current=items.map(i=>({name:i.name,qty:i.quantity,quantity:i.quantity,unit:i.unit}));injected.current=false;setColesResults(null);setStatus('Checking Coles…');setWebKey(k=>k+1);setMode('coles')}\n"
new = "  function compareColes(){if(!canSend)return;const {allowed,restricted}=splitRetailerItems(items);if(restricted.length)Alert.alert('Some items were not automated',`Stuff leaves age-restricted items on your list for you to handle directly with the retailer: ${restricted.map(x=>title(x.name)).join(', ')}.`);if(!allowed.length)return;wooliesReturnTab.current='home';pending.current=allowed.map(i=>({name:i.name,qty:i.quantity,quantity:i.quantity,unit:i.unit}));injected.current=false;setColesResults(null);setStatus('Checking Coles…');setWebKey(k=>k+1);setMode('coles')}\n"
if old not in text:
    raise SystemExit('compareColes function marker missing')
text = text.replace(old, new, 1)

# Real support request via the user's Stuff account.
old = "  function reportProblem(){Alert.alert('Report a problem','We’ll connect this to a support channel before release. For now this confirms where problem reporting will live.')}\n"
new = "  function reportProblem(){\n    if(!user){Alert.alert('Sign in to contact support','Sign in or create a Stuff account so we can securely attach your support request to your account.',[{text:'Cancel',style:'cancel'},{text:'Sign in',onPress:goToStuffLogin}]);return}\n    Alert.prompt('Report a problem','Tell us what happened. Do not include retailer passwords or payment details.',async value=>{const message=String(value||'').trim();if(!message)return;try{await createStuffSupportRequest(user.id,user.email||'',message,'bug');Alert.alert('Sent','Your report has been saved for Stuff support.')}catch(e){Alert.alert('Could not send report',e?.message||'Please try again.')}},'plain-text');\n  }\n"
if old not in text:
    raise SystemExit('reportProblem marker missing')
text = text.replace(old, new, 1)

# First-run legal acknowledgement before retailer/account screens.
marker = "  if(mode==='woolies')return <SafeAreaView style={s.safe}>"
legal = "  if(!legalReady)return <SafeAreaView style={s.safe}><StatusBar barStyle=\"dark-content\" backgroundColor=\"#F7F1E3\"/><View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color=\"#F4512C\"/></View></SafeAreaView>;\n\n  if(!legalAccepted)return <SafeAreaView style={s.safe}>\n    <StatusBar barStyle=\"dark-content\" backgroundColor=\"#F7F1E3\"/>\n    <ScrollView contentContainerStyle={s.pageScreen}>\n      <PageHeader eyebrow=\"WELCOME TO STUFF\" title=\"Groceries, without the admin.\" lead=\"One quick acknowledgement before you start shopping.\" />\n      <InfoBlock title=\"Independent shopping assistant\">Stuff is independent and is not affiliated with, endorsed by or sponsored by Woolworths, Coles or other retailers.</InfoBlock>\n      <InfoBlock title=\"Always review the retailer cart\">Product matching can be wrong. Prices, availability and quantities can change. You remain in control and complete checkout and payment with the retailer.</InfoBlock>\n      <InfoBlock title=\"Voice processing\">When you tap to talk, the recording is sent for AI transcription and grocery-list interpretation. Stuff does not intentionally store the audio file in its database after processing.</InfoBlock>\n      <TouchableOpacity style={s.secondaryButton} onPress={()=>Linking.openURL(PRIVACY_URL)}><Text style={s.secondaryButtonText}>Read Privacy Policy</Text></TouchableOpacity>\n      <TouchableOpacity style={s.secondaryButton} onPress={()=>Linking.openURL(TERMS_URL)}><Text style={s.secondaryButtonText}>Read Terms of Use</Text></TouchableOpacity>\n      <TouchableOpacity style={s.primaryButton} onPress={acceptLegal}><Text style={s.primaryButtonText}>Continue to Stuff</Text></TouchableOpacity>\n      <Text style={s.formNote}>By continuing, you agree to the Terms of Use and acknowledge the Privacy Policy.</Text>\n    </ScrollView>\n  </SafeAreaView>;\n\n" + marker
if marker not in text:
    raise SystemExit('first render marker missing')
if "Continue to Stuff" not in text:
    text = text.replace(marker, legal, 1)

# Help copy: real support exists.
text = text.replace("      <InfoBlock title=\"Before release\">We’ll add a real support channel and diagnostic information here. The app should never ask you to send a Woolworths password or payment details to Stuff support.</InfoBlock>", "      <InfoBlock title=\"Support and security\">Signed-in users can send a support report from this screen. Never include a Woolworths or Coles password, verification code or payment details in a support report.</InfoBlock>")

# Privacy screen expanded and linked to public policy.
old = "      <InfoBlock title=\"Voice\">Your microphone is used only when you tap to talk. The recording is sent for processing so Stuff can turn it into grocery items.</InfoBlock>\n      <InfoBlock title=\"Stuff account\">If you create a Stuff account, Stuff stores your account details, household membership, preferences and shared shopping data needed to provide the service.</InfoBlock>\n      <InfoBlock title=\"Retailer accounts\">Stuff does not ask for or store your Woolworths or Coles password or payment details. Retailer login, saved payment methods and checkout stay with the retailer.</InfoBlock>\n      <InfoBlock title=\"Household sharing\">People who join the same household can see and change the shared grocery list. Household access is protected by signed-in Stuff accounts.</InfoBlock>"
new = "      <InfoBlock title=\"Voice and AI\">Your microphone is used only when you tap to talk. The recording is sent to Stuff’s backend and OpenAI’s API for transcription and grocery-list interpretation. Stuff does not intentionally store the audio file in its database after processing.</InfoBlock>\n      <InfoBlock title=\"Stuff account\">If you create a Stuff account, Stuff stores your account details, household membership, preferences and shared shopping data needed to provide the service.</InfoBlock>\n      <InfoBlock title=\"Retailer accounts\">Stuff does not ask for or store your Woolworths or Coles password or payment details. Retailer login, saved payment methods and checkout stay with the retailer.</InfoBlock>\n      <InfoBlock title=\"Household sharing\">People who join the same household can see and change the shared grocery list. Household access is protected by signed-in Stuff accounts.</InfoBlock>\n      <InfoBlock title=\"Data hosting\">Stuff currently uses Supabase infrastructure hosted in South Korea, and OpenAI API services for voice processing.</InfoBlock>\n      <TouchableOpacity style={s.secondaryButton} onPress={()=>Linking.openURL(PRIVACY_URL)}><Text style={s.secondaryButtonText}>Open full Privacy Policy</Text></TouchableOpacity>"
if old not in text:
    raise SystemExit('privacy block marker missing')
text = text.replace(old, new, 1)

# Terms screen: independence + restricted products + public link.
old = "      <InfoBlock title=\"You stay in control\">Stuff helps prepare a shopping list and may add suggested products to a retailer cart. You must review the retailer cart before ordering.</InfoBlock>\n      <InfoBlock title=\"Prices and availability\">Retailer prices, specials, availability, substitutions and delivery options can change. Your chosen retailer remains the source of truth for the final order.</InfoBlock>\n      <InfoBlock title=\"Checkout and payment\">Stuff does not submit checkout or payment. Ordering and payment are completed with the retailer.</InfoBlock>\n      <InfoBlock title=\"Current integration\">This MVP uses current Woolworths and Coles website behaviour and is not an official retailer integration. Website behaviour may change before retailer-approved integrations are available.</InfoBlock>"
new = "      <InfoBlock title=\"Independent service\">Stuff is not affiliated with, endorsed by or sponsored by Woolworths, Coles or other retailers unless we expressly say otherwise.</InfoBlock>\n      <InfoBlock title=\"You stay in control\">Stuff helps prepare a shopping list and may add suggested products to a retailer cart. Product matching can be wrong, so you must review the retailer cart before ordering.</InfoBlock>\n      <InfoBlock title=\"Prices and availability\">Retailer prices, specials, availability, substitutions and delivery options can change. Your chosen retailer remains the source of truth for the final order.</InfoBlock>\n      <InfoBlock title=\"Checkout and payment\">Stuff does not submit checkout or payment. Ordering and payment are completed with the retailer.</InfoBlock>\n      <InfoBlock title=\"Restricted products\">Stuff does not automatically match or add alcohol, tobacco, nicotine, vaping or other age-restricted products during this release.</InfoBlock>\n      <InfoBlock title=\"Retailer connectivity\">Stuff uses current retailer website behaviour. Retailer functionality can change or become unavailable, and Stuff will not bypass retailer security controls.</InfoBlock>\n      <TouchableOpacity style={s.secondaryButton} onPress={()=>Linking.openURL(TERMS_URL)}><Text style={s.secondaryButtonText}>Open full Terms of Use</Text></TouchableOpacity>"
if old not in text:
    raise SystemExit('terms block marker missing')
text = text.replace(old, new, 1)

# Update How it works now that Coles trolley beta exists.
text = text.replace("<Text style={s.stepTitle}>Choose where to shop</Text><Text style={s.stepCopy}>Stuff matches the list for your preferred supermarket. Woolworths can be sent into the cart; Coles currently shows matched products and an estimated basket.</Text>", "<Text style={s.stepTitle}>Choose where to shop</Text><Text style={s.stepCopy}>Stuff matches the list for your preferred supermarket and hands confident matches into the retailer experience. You review everything before ordering.</Text>")

app.write_text(text)

# Add support request function to data layer.
data = Path('mobile/stuffData.js')
d = data.read_text()
if 'export async function createStuffSupportRequest' not in d:
    d += "\n\nexport async function createStuffSupportRequest(userId, email, message, category='support') {\n  const clean=String(message||'').trim();\n  if(!userId)throw new Error('Sign in to contact support.');\n  if(!clean)throw new Error('Tell us what happened first.');\n  const result=await supabase.from('stuff_support_requests').insert({\n    user_id:userId,\n    email:String(email||'').trim()||null,\n    category,\n    message:clean.slice(0,5000),\n    app_version:'0.1.0',\n  }).select('id').single();\n  return throwIfError(result);\n}\n"
data.write_text(d)
