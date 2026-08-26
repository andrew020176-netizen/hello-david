# Stuff the Shopping mobile

Native Expo MVP for Stuff the Shopping.

## What it currently does

1. Captures a grocery list by voice.
2. Keeps one household shopping list, with signed-in household sync through Supabase.
3. Lets the user review, edit, remove and share items before sending anything to a retailer.
4. Supports retailer sessions inside the app without storing retailer passwords or payment details in Stuff.
5. Woolworths: searches current products, applies Stuff matching preferences and sends confident matches into the Woolworths cart.
6. Coles: matches the same list against current Coles product data, shows an estimated basket, then offers a **Build Coles trolley · beta** handoff that opens the matched Coles product pages and uses Coles's own Add to trolley controls. If Coles requires login, the user signs in directly with Coles inside the retailer WebView.
7. Applies saved shopping preferences to retailer matching:
   - **Preferred supermarket** can be Woolworths or Coles and controls the retailer action shown on Home.
   - **Best match** prioritises the strongest product match.
   - **Cheapest suitable** picks the lowest-priced option from products that remain close enough to the strongest match.
   - **Prefer specials** gives suitable on-special products a meaningful ranking boost.
   - **Allow close alternatives** controls how wide the acceptable match set can be.
   - **Remember usual brands** learns repeated household product choices after successful retailer handoff. After the same product has been chosen more than once for the same request, Stuff favours it on future shops. Explicit requests such as "cheapest" or "on special" override the learned usual.
8. Account includes **Your usuals**, where learned household products can be reviewed, forgotten individually or reset completely.
9. Development builds include **Load regression test shop** under More, which loads the fixed 22-item Woolworths/Coles test list in one tap.
10. Leaves final product review, checkout and payment entirely with the retailer.
11. Uses the Stuff app icon, adaptive Android icon and orange launch screen configured for release builds.

## Fast phone test with Expo Go

The app targets Expo SDK 54.

On the laptop:

```bash
cd mobile
npm install
npx expo start --lan --clear
```

Then scan the new QR code with Expo Go.

## Release builds

`eas.json` includes internal preview and production build profiles. Expo/EAS account setup and Apple/Google signing credentials are still completed interactively when the first store build is created.

## Safety rails

- no checkout/payment automation
- suspicious quantities are capped/defaulted
- low-confidence product matches are skipped rather than guessed
- explicit cheapest/special instructions override learned household usuals
- age-restricted products are not automatically handed into retailer carts/trolleys
- retailer security/challenge pages stop automation rather than being bypassed
- retailer credentials/cookies remain in the retailer WebView
- Stuff account, household and learned-product data use Supabase authentication and row-level access controls
- Coles trolley handoff is explicitly beta because it relies on current Coles website controls rather than an official retailer API

## Important

This is an MVP using current Woolworths and Coles website behaviour, not retailer-approved public integrations. Website endpoints and behaviour can change before official retailer integrations are available.
