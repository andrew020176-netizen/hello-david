# Stuff the Shopping — App Store Connect copy/paste

Use this alongside `APP_STORE_LAUNCH_PACK.md` when entering the first iOS release.

## App record
- Name: Stuff the Shopping
- Primary language: English (Australia)
- Bundle ID: au.com.stufftheshopping.app
- SKU suggestion: STUFF-IOS-001
- User access: Full Access

## Version
- Version: 1.0.0
- Copyright: enter the current operator copyright in App Store Connect
- Primary category: Shopping
- Secondary category: Lifestyle
- Price: Free
- Availability: Australia only
- Release: Manually release this version

## Subtitle
Say it. We’ll shop it.

## Promotional text
Tell Stuff what you need. It builds the list, keeps the household in sync, learns what you usually choose and gets the shop ready at your supermarket.

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

Stuff is an independent shopping assistant. It is not affiliated with, endorsed by or sponsored by retailers unless expressly stated. Checkout and payment are completed with the retailer.

## Keywords
shopping,grocery,list,groceries,household,voice,supermarket,shopping list,shared list,groceries app

## URLs
- Support URL: https://stufftheshopping.com.au/
- Marketing URL: https://stufftheshopping.com.au/
- Privacy Policy URL: https://stufftheshopping.com.au/privacy.html

Do not submit until all three resolve publicly and the Support URL contains a working contact route.

## App Review notes
Stuff the Shopping is an independent grocery-list and retailer-handoff assistant.

Core list functionality can be reviewed without a Stuff account. A reviewer Stuff account will be supplied in App Review Information so household sync, saved preferences and learned usuals can also be reviewed.

The app uses microphone access only after the user taps the voice control. Voice input is sent for transcription and grocery-list interpretation.

Retailer login occurs directly within the retailer web experience. Stuff does not collect retailer passwords or payment details and does not complete checkout or payment. The user reviews and completes any order directly with the retailer.

If “Remember usual brands” is enabled, successful retailer handoffs can increment household product memory. A product is not treated as a learned usual until the same household choice has been repeated. Explicit shopping instructions such as “cheapest” or “on special” take priority over learned usual products.

Age-restricted products are excluded from automated retailer handoff. Stuff stops rather than attempts to bypass retailer security or challenge pages.

## Reviewer credentials
Enter these only in App Store Connect — never commit them to GitHub.
- Username/email: [create tomorrow]
- Password: [create tomorrow]
- Notes: reviewer household should contain a short sample list and at least one learned usual if practical

## Screenshot captions
1. Say what you need.
2. Your shop, already sorted.
3. One list for the household.
4. Stuff learns your usuals.
5. Review it with your supermarket.

## App Privacy working position
- Tracking: No
- Third-party advertising: No
- Developer advertising/marketing: No
- Payment information collected by Stuff: No
- Precise location: No
- Contacts/address book: No
- Name: Yes, if supplied; linked; App Functionality
- Email address: Yes; linked; App Functionality
- Phone number: Yes, if supplied; linked; App Functionality
- User ID: Yes; linked; App Functionality
- User content / shopping list: Yes; linked when signed in; App Functionality / Product Personalization
- Customer support content: Yes; linked; App Functionality
- Audio data: transmitted for App Functionality; not used for tracking; confirm final OpenAI retention configuration before answering the label
- Learned product choices: linked household preference data; App Functionality / Product Personalization

## Export compliance
Current iOS config declares `ITSAppUsesNonExemptEncryption = false`.

## Account deletion
Account creation is supported, and in-app account deletion must be tested successfully before submission.

## Final gate before Submit for Review
- exact TestFlight build tested on iPhone
- voice works
- household sync works
- invite code works
- usuals learning works
- Woolworths/Coles handoff behaviour reviewed
- restricted items remain out of automated handoff
- account deletion works
- support report works
- domain + privacy + terms + support route live
- reviewer account works
- App Privacy completed against final build
- age rating completed
- screenshots captured from final build
- retailer/content-rights questions answered truthfully
