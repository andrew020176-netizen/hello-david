# Stuff the Shopping

Stuff is a voice-first grocery assistant that turns natural speech into an editable household shopping list, learns repeated household product choices, and helps hand the shop off to supported retailers for final review and checkout.

## Mobile app

The current product lives in `mobile/` and is built with Expo / React Native.

Current MVP capabilities include:

- voice-to-list grocery capture
- editable shopping list
- household accounts and shared realtime lists
- shopping preferences including best match, cheapest, specials and alternatives
- household-level usual-product learning
- Woolworths cart handoff
- Coles trolley beta
- restricted-product guardrails
- in-app support, privacy and terms
- fixed regression shop for development testing

See `mobile/README.md` and `mobile/REGRESSION_TEST.md` for the current run and test flow.

## Public pages

`index.html`, `privacy.html` and `terms.html` provide the lightweight public landing/support and legal pages used by Stuff.

Stuff is an independent service and is not affiliated with or endorsed by Woolworths, Coles or other retailers unless expressly stated.
