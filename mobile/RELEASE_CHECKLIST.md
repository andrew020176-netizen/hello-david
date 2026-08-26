# Stuff the Shopping — release checklist

## Already in the repo
- Stuff the Shopping app name, scheme and bundle/package identifiers
- production app icon and Android adaptive icon
- orange launch screen
- microphone permission wording
- first-run legal acknowledgement
- Privacy Policy, Terms and public support landing page
- App Store copy and privacy working inventory
- EAS preview and production build profiles
- CI validation of release assets/config plus iOS Expo export
- fixed 22-item regression shop for development testing
- usual-product settings copy aligned with the live learning behaviour
- household invite links plus a manual invite-code fallback for Expo Go/native testing

## Phone test before external beta
1. Pull `main` and run the app in Expo Go.
2. Confirm icon/launch treatment looks right in a native build when available.
3. Run the 22-item regression shop at Woolworths and Coles.
4. Test voice capture, edit/delete/clear/share and restricted-item handling.
5. Create/sign into a Stuff account and confirm the guest list migrates.
6. Test household sync and both invite-link and manual invite-code joining with a second account/device.
7. Repeat a product choice twice and confirm it appears in **Your usuals** and is favoured next time.
8. Confirm explicit **cheapest** and **on special** instructions override a learned usual.
9. Trigger retailer load/security failures and confirm Stuff stops cleanly without bypass attempts.
10. Test account deletion and support submission.

## Requires account / registrar access
- Point `stufftheshopping.com.au` at the GitHub Pages site and switch the repo CNAME from the old domain only when ready.
- Confirm `https://stufftheshopping.com.au/`, `/privacy.html` and `/terms.html` are publicly reachable before external beta/App Store submission.
- Log into Expo/EAS and initialise/link the project if prompted.
- Create the Apple App Store Connect record and complete signing credentials.
- Complete App Store privacy questionnaire from `APP_STORE_DRAFT.md`.
- Capture final App Store screenshots from the tested native build.
- Create the first internal/TestFlight build, then submit only after the phone regression pass.

## Launch principle
Do not add new product features between the regression pass and the first external beta unless they fix a blocking defect. Fix what the test exposes first.
