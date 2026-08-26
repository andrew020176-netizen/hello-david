# Stuff the Shopping — App Store launch pack

Prepared for the first iOS submission.

## Recommended v1 launch settings
- App name: **Stuff the Shopping**
- Subtitle: **Say it. We’ll shop it.**
- Bundle ID: `au.com.stufftheshopping.app`
- Primary category: **Shopping**
- Secondary category: **Lifestyle**
- Price: **Free**
- Initial availability: **Australia only**
- Release: **Manual release after approval**
- Version for the public release: **1.0.0** once the final tested build is selected
- No iPad support in v1

Australia-only is deliberate for the first release: the current retailer proposition is Australian, it avoids presenting unsupported functionality in overseas storefronts, and it reduces launch complexity.

## App Store product-page copy
Use `APP_STORE_DRAFT.md` as the source of truth for name, subtitle, promotional text, description and keywords.

Important: do not use retailer/company names in the App Store keyword field. Apple states that names of other apps or companies are not allowed in keywords. Retailer names may appear in accurate descriptive copy where necessary, but should not imply affiliation or endorsement.

## Screenshot plan
Capture these from the final native build rather than creating fictional UI.

Recommended five-frame story:
1. **Say what you need.** — Home screen with Tap to talk and a short realistic list.
2. **Your shop, already sorted.** — Expanded editable shopping list showing quantities/sizes.
3. **One list for the household.** — Household screen showing shared-list sync.
4. **Stuff learns your usuals.** — Account → Your usuals with a couple of learned products.
5. **Review it with your supermarket.** — Retailer handoff/result screen with a clear reminder that the user reviews before checkout.

For iPhone, prepare the highest-resolution accepted portrait screenshots for the current 6.9-inch class. Apple permits one to ten screenshots and will scale the highest-resolution set to other supported iPhone sizes when appropriate.

Avoid:
- fabricated prices or retailer states
- claims that checkout/payment happens in Stuff
- retailer logos in marketing artwork unless rights are confirmed
- “official”, “partner”, “connected” or similar endorsement language

## App Review information
### Reviewer contact
Complete in App Store Connect with a monitored name, email and phone number.

### Demo account
The app’s basic shopping-list experience works without login, but account-based household functionality exists. Before submission create a stable Stuff reviewer account and place its credentials only in App Store Connect Review Information — never in this public repository.

The reviewer account should have:
- a household already created
- a short sample list
- at least one learned usual if practical
- no personal production-user data

### Review notes
Use the review notes in `APP_STORE_DRAFT.md`. Make the reviewer flow explicit:
1. Launch and continue through the legal acknowledgement.
2. Use Tap to talk or the pre-existing reviewer list to inspect the core list experience.
3. Sign into the supplied Stuff demo account to inspect household sync/preferences/usuals.
4. Retailer login is separate and remains with the retailer; Stuff does not collect retailer passwords or payment details.
5. Checkout/payment are not performed by Stuff.
6. Age-restricted products are not automatically handed to retailer carts/trolleys.
7. Retailer security/challenge pages stop automation rather than being bypassed.

## App privacy questionnaire — conservative working answers
Final answers must match the tested build and third-party provider behaviour at submission time.

Likely data types to declare:
- **Contact Info → Name** — linked to user; App Functionality, when provided
- **Contact Info → Email Address** — linked to user; App Functionality
- **Contact Info → Phone Number** — linked to user; App Functionality, when provided
- **Contact Info → Physical Address** — assess suburb/postcode conservatively here; linked to user; App Functionality/Product Personalization
- **Identifiers → User ID** — linked to user; App Functionality
- **User Content → Other User Content** — shopping lists / grocery requests; linked when signed in; App Functionality/Product Personalization
- **Purchases → Purchase History** — conservative treatment for learned product-choice/purchase tendencies; linked to household/user; Product Personalization/App Functionality
- **User Content → Customer Support** — support reports; linked to user; App Functionality. Apple may permit optional disclosure for infrequent voluntary support data only if every optional-disclosure criterion is met, but conservative disclosure is simpler.
- **User Content → Audio Data** — voice is transmitted for processing. Stuff does not intentionally store audio in its own database, but OpenAI API retention can apply; assess as not used for tracking and for App Functionality. Confirm the final OpenAI project retention configuration before publishing the privacy label.

Current expectation:
- no tracking
- no third-party advertising
- no developer advertising/marketing use of collected data
- no payment information collected by Stuff
- no precise device location collected
- no contacts/address-book access

Apple requires the privacy label to include relevant data practices of third-party partners whose code/services are used by the app.

## Privacy policy
The public privacy policy must be live before submission and must match the label. It already covers account data, household data, voice/OpenAI processing, Supabase, retailer sessions, retention and account deletion.

Before submission verify these public URLs resolve:
- `https://stufftheshopping.com.au/`
- `https://stufftheshopping.com.au/privacy.html`
- `https://stufftheshopping.com.au/terms.html`

## Support URL — launch blocker
Apple requires the Support URL to lead to usable contact information. The current landing page points users back to in-app support but we should add a monitored public support email/contact route before App Review.

Recommended address once configured: `support@stufftheshopping.com.au`.

Do not publish that address as the support contact until the mailbox/forwarder actually works.

## Account deletion
Stuff already offers in-app account deletion. This is important because Apple requires apps that support account creation to also let users initiate account deletion within the app.

Phone-test the complete deletion path before submission and confirm associated Stuff data is removed as intended.

## Sign in with Apple
Not required for the current release because Stuff uses its own email/password account rather than a third-party/social login provider. If Google/Facebook/etc. login is added later, re-check Apple’s login-services rule before shipping it.

## Payments
Stuff does not need Apple In-App Purchase for the retailer grocery transaction. The retailer purchase is for physical goods consumed outside the app, and checkout/payment stay with the retailer.

If Stuff later charges users for digital premium functionality or a Stuff subscription, Apple’s In-App Purchase rules will need to be designed into that monetisation model.

## Age rating
Complete Apple’s current age-rating questionnaire in App Store Connect. Based on the present product there is no intended mature content supplied by Stuff, but do not assume the final rating — use Apple’s questionnaire answers from the tested build.

Do not select **Made for Kids** for this launch.

## Encryption / export compliance
The iOS config now declares `ITSAppUsesNonExemptEncryption = false`, reflecting the current expectation that Stuff does not implement non-exempt proprietary encryption and relies on standard platform/network security. Re-check this if cryptographic functionality is added later.

## Accessibility
During the phone regression, check at minimum:
- readable text at larger iOS text sizes where practical
- tappable controls are understandable without relying only on colour
- microphone status and busy states have visible text
- critical controls have reasonable touch targets

App Store Connect now includes accessibility information, so answer only what the tested build genuinely supports.

## Content rights / retailer integration — material review risk
This is the biggest non-technical App Store risk for the current proposition.

Apple Review Guideline 5.2.2 says that if an app uses, accesses or displays content from a third-party service, the developer must be specifically permitted under that service’s terms and be able to provide authorization if Apple asks.

The current Stuff implementation accesses retailer websites/product data and performs user-initiated retailer handoff. The current public terms located for Woolworths restrict automated retrieval/indexing mechanisms, and Coles states its website/content is for personal use unless it gives express written consent. This means we should **not** tell Apple we have retailer authorization if we do not.

Mitigation for v1:
- keep the Stuff icon/name completely independent
- do not use retailer names in keywords
- do not use official retailer logos in App Store artwork
- keep the native Stuff utility strong: voice, editable list, household sharing, preferences and usuals all exist independently of the retailer WebView
- be explicit that retailer checkout/payment remain with the retailer
- do not bypass retailer security controls
- answer App Store content-rights questions truthfully

Possible App Review outcome: Apple may accept the independent handoff, or it may ask for proof of authorization under 5.2.2. If it asks, the realistic choices are to obtain permission or alter/remove the affected retailer integration for the App Store build. Do not fabricate authorization.

## App completeness
Before submission Apple expects a final, stable build, working URLs, live backend services and enough information for reviewers to test non-obvious features.

Our submission gate is therefore:
- final phone regression passed
- public URLs live
- public support contact works
- reviewer account works
- TestFlight build passes on-device
- App Privacy answers reconciled to final build
- age rating completed
- content-rights declaration answered truthfully
- screenshots captured from that same release candidate

## Tomorrow at the laptop
Once the regression pass is clean:
1. Connect/verify the public domain and support email.
2. Log into Apple Developer/App Store Connect and create the app record using the existing bundle ID.
3. Create/link the Expo EAS project if not already linked.
4. Build the iOS preview/production binary and resolve Apple signing prompts.
5. Upload to TestFlight.
6. Create the reviewer Stuff account.
7. Complete App Privacy, age rating, availability and review information.
8. Capture final screenshots from the tested build.
9. Submit with manual release selected.

Do not submit the first build immediately after it uploads. Test the exact TestFlight build first.
