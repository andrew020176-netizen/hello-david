# Hello David mobile transaction proof

This is the no-extension mobile proof for Hello David.

## What it proves

1. Hello David runs inside a native mobile WebView.
2. The existing voice shopping list remains the source of truth.
3. `Send to Woolies` passes the structured list directly to the native shell.
4. The same WebView opens Woolworths and keeps the Woolworths browser session/cookies.
5. Hello David searches Woolworths products and adds confident matches to the cart.
6. The user reviews and completes checkout in Woolworths. Hello David never submits payment.

## Fast phone test with Expo Go

The proof targets Expo SDK 54 because the current App Store / Play Store Expo Go build supports it.

On the laptop:

```bash
cd mobile
npm install
npx expo start --tunnel --go
```

On the phone:

1. Install **Expo Go** from the App Store or Google Play.
2. Scan the QR code shown by Expo on the laptop.
3. In the Hello David app, tap **Woolies** once and sign into Woolworths.
4. Tap **David**, build a short shopping list by voice, then tap **Send to Woolies**.
5. Review the resulting Woolworths cart carefully before checkout.

## Safety rails in this proof

- no checkout/payment automation
- suspicious quantities are capped/defaulted
- low-confidence product matches are skipped rather than guessed
- two different Hello David lines cannot silently collapse into the same Woolworths stockcode
- Woolworths credentials/cookies stay in the WebView; Hello David does not export them

## Important

This is a technical prototype using Woolworths website behaviour, not a retailer-approved public integration. Website endpoints and behaviour can change. Product matching and purchasing-unit intelligence need further refinement before any customer release.
