# Stuff the Shopping — App Store draft

## Name
Stuff the Shopping

## Subtitle
Say it. We’ll shop it.

## Promotional text
Tell Stuff what you need. It builds the list, keeps the household in sync, learns what you usually buy and gets the shop ready at your supermarket.

## Description
Stuff the Shopping takes the admin out of groceries.

Walk around the house and say what you need. Stuff turns what you say into a simple shopping list that you can edit, share and keep synced with your household.

When you’re ready to shop, Stuff helps match the list to products at your preferred supermarket. Choose the best match, cheapest suitable option, specials or close alternatives — and, if you want, Stuff gradually learns the products your household normally chooses.

What Stuff can do:
- build a grocery list from your voice
- edit, remove and share items
- keep one household list synced across signed-in devices
- shop with supported supermarkets
- choose best match or cheapest suitable products
- favour suitable specials
- control whether close alternatives are acceptable
- learn repeated household product choices and favour your usuals next time
- let you review or forget learned usual products at any time

You stay in control. Stuff may get a product match wrong, and retailer prices or availability can change. Review the products, quantities, prices and substitutions with the retailer before checkout.

Stuff is an independent shopping assistant. It is not affiliated with, endorsed by or sponsored by Woolworths, Coles or other retailers. Checkout and payment are always completed with the retailer.

## Keywords
groceries,grocery,shopping,list,household,voice,supermarket,trolley,pantry,food

## Category
Primary: Shopping
Secondary: Lifestyle

## Recommended first-launch availability
Australia only

## Recommended price
Free

## Recommended release setting
Manual release after App Review approval

## Privacy policy
https://stufftheshopping.com.au/privacy.html

## Terms
https://stufftheshopping.com.au/terms.html

## Support URL
https://stufftheshopping.com.au/

## Review notes draft
Stuff the Shopping is an independent grocery-list and retailer-handoff assistant. The core list experience is available without a Stuff account. A Stuff account is used for household sync, invitations, saved preferences and learned usual products.

Retailer login occurs directly within the retailer web experience. Stuff does not collect retailer passwords or payment details and does not complete checkout or payment. The user reviews and completes any grocery order directly with the retailer. Grocery purchases are physical goods, not digital content sold by Stuff.

The app uses microphone access only after the user taps the voice control. Voice input is sent for transcription and grocery-list interpretation.

Signed-in households can sync a shared list. If “Remember usual brands” is enabled, successful retailer handoffs can increment household product memory. A product is not treated as a learned usual until the same household choice has been repeated. Users can forget individual usuals or clear them all from Account.

Explicit shopping instructions such as “cheapest” or “on special” take priority over learned usual products.

Age-restricted products are excluded from automated retailer handoff in this release.

Woolworths and Coles functionality relies on their current web experiences and may vary during review. Stuff stops rather than attempts to bypass retailer security/challenge pages.

For account-based feature review, provide a non-expiring Stuff demo account in App Store Connect Review Information. Do not put demo credentials in this repository.

## App privacy working inventory
Data linked to a Stuff account:
- name, if provided
- email address
- mobile number, if provided
- suburb/postcode, if provided
- Stuff user/account identifier
- household membership and invitations
- shopping list and other user-entered grocery content
- shopping preferences
- learned household product choices / purchase tendencies
- support requests

Voice:
- microphone recording submitted on user action for transcription and grocery-list interpretation
- Stuff does not intentionally retain the audio file in its own database after processing
- OpenAI API retention may apply depending on the API configuration, so Audio Data should be assessed conservatively in App Store Connect

Retailer data:
- Stuff does not ask users to provide retailer passwords or payment-card details to Stuff
- retailer cookies/session data remain in the retailer WebView/device context
- product selections successfully handed to a retailer may be remembered as household shopping preferences when the learning preference is enabled

Tracking / advertising:
- no advertising SDK is currently integrated
- no cross-app tracking is currently intended

This inventory is a working launch checklist and must be reconciled with the final App Store Connect privacy questionnaire and the tested release build before submission.
