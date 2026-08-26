from pathlib import Path

path = Path('mobile/StuffApp.js')
text = path.read_text()

old_home = '''      <TouchableOpacity style={[s.send,!canSend&&s.sendOff]} onPress={send} disabled={!canSend}>
        <View style={s.wooliesMark}><Text style={s.wooliesMarkText}>W</Text></View>
        <View style={s.sendCopy}>
          <Text style={s.sendText}>Send to Woolies</Text>
          <Text style={s.sendSub}>Add to your Woolworths cart</Text>
        </View>
        <Text style={s.sendArrow}>›</Text>
      </TouchableOpacity>
      <Text style={s.note}>We’ll build your Woolies cart. You review it before checkout.</Text>
      <TouchableOpacity style={[s.colesButton,!canSend&&s.sendOff]} onPress={compareColes} disabled={!canSend}>
        <View style={s.colesMark}><Text style={s.colesMarkText}>C</Text></View>
        <View style={s.sendCopy}><Text style={s.colesButtonText}>Check at Coles</Text><Text style={s.colesButtonSub}>Match the list and estimate the basket</Text></View>
        <Text style={s.sendArrow}>›</Text>
      </TouchableOpacity>
'''
new_home = '''      {preferences.preferredSupermarket==='coles'?<>
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
'''
if old_home not in text:
    raise SystemExit('home retailer block missing')
text = text.replace(old_home, new_home, 1)

replacements = {
    'From a spoken list to a Woolworths cart, without making grocery shopping another admin job.': 'From a spoken list to your chosen supermarket, without making grocery shopping another admin job.',
    '<Text style={s.stepTitle}>Send to Woolies</Text><Text style={s.stepCopy}>Stuff finds confident product matches and adds them to your Woolworths cart.</Text>': '<Text style={s.stepTitle}>Choose where to shop</Text><Text style={s.stepCopy}>Stuff matches the list for your preferred supermarket. Woolworths can be sent into the cart; Coles currently shows matched products and an estimated basket.</Text>',
    '<Text style={s.stepTitle}>You review and checkout</Text><Text style={s.stepCopy}>Check every product, price and quantity inside Woolworths before completing your order.</Text>': '<Text style={s.stepTitle}>You review and checkout</Text><Text style={s.stepCopy}>Check every product, price and quantity with the retailer before completing your order.</Text>',
    '<MenuRow title="Woolworths help" sub="Login, cart and checkout remain with Woolworths" onPress={()=>setMoreView(\'privacy\')} />': '<MenuRow title="Retailer help" sub="Retailer login, cart and checkout stay with the retailer" onPress={()=>setMoreView(\'privacy\')} />',
    '<InfoBlock title="Woolworths">Stuff does not ask for or store your Woolworths password or payment details. Retailer login, saved payment methods and checkout stay with Woolworths.</InfoBlock>': '<InfoBlock title="Retailer accounts">Stuff does not ask for or store your Woolworths or Coles password or payment details. Retailer login, saved payment methods and checkout stay with the retailer.</InfoBlock>',
    'Retailer prices, specials, availability, substitutions and delivery options can change. Woolworths remains the source of truth for the final order.': 'Retailer prices, specials, availability, substitutions and delivery options can change. Your chosen retailer remains the source of truth for the final order.',
    'Stuff does not submit checkout or payment. Ordering and payment are completed with Woolworths.': 'Stuff does not submit checkout or payment. Ordering and payment are completed with the retailer.',
    'This MVP uses Woolworths website behaviour and is not an official Woolworths integration. Website behaviour may change before a retailer-approved integration is available.': 'This MVP uses current Woolworths and Coles website behaviour and is not an official retailer integration. Website behaviour may change before retailer-approved integrations are available.',
    'Say what you need, keep one shared household list and move it into a retailer cart without manually searching for every product.': 'Say what you need, keep one shared household list and move it towards a retailer order without manually searching for every product.',
    '<MenuRow title="How it works" sub="From voice to Woolies cart" onPress={()=>setMoreView(\'how\')} />': '<MenuRow title="How it works" sub="From voice to your chosen supermarket" onPress={()=>setMoreView(\'how\')} />',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'missing content string: {old[:50]}')
    text = text.replace(old, new, 1)

path.write_text(text)
