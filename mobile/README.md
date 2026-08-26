# Stuff the Shopping mobile

Native Expo MVP for Stuff the Shopping.

## What it currently does

1. Captures a grocery list by voice.
2. Keeps one household shopping list, with signed-in household sync through Supabase.
3. Lets the user review, edit, remove and share items before sending anything to a retailer.
4. Opens Woolworths in an embedded retailer session without storing the user's Woolworths password or payment details in Stuff.
5. Searches Woolworths and only sends confident product matches to the cart.
6. Applies saved shopping preferences to matching:
   - **Best match** prioritises the strongest product match.
   - **Cheapest suitable** picks the lowest-priced option from products that remain close enough to the strongest match.
   - **Prefer specials** gives suitable on-special products a meaningful ranking boost.
   - **Allow close alternatives** controls how wide the acceptable match set can be.
7. Leaves final product review, checkout and payment entirely with Woolworths.

Usual-brand learning is stored as a user preference but is not yet active in matching.

## Fast phone test with Expo Go

The app targets Expo SDK 54.

On the laptop:

```bash
cd mobile
npm install
npx expo start --lan --clear
```

Then scan the new QR code with Expo Go.

## Safety rails

- no checkout/payment automation
- suspicious quantities are capped/defaulted
- low-confidence product matches are skipped rather than guessed
- two different list lines cannot silently collapse into the same Woolworths stockcode
- Woolworths credentials/cookies remain in the retailer WebView
- Stuff account and household data use Supabase authentication and row-level access controls

## Important

This is an MVP using Woolworths website behaviour, not a retailer-approved public integration. Website endpoints and behaviour can change before an official retailer integration is available.
