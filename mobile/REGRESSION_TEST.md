# Stuff retailer regression test

Use the same test shop after every meaningful change to voice parsing, matching, pricing or retailer handoff.

Fixture: `test-fixtures/regression-shop-v1.json`

## Run 1 — voice

Read the fixture's `spoken_script` naturally in one recording. Do not over-enunciate.

Pass if:
- the list contains the intended groceries without inventions;
- 3 L milk remains one 3 L product rather than three milks;
- pack sizes such as 6 rolls, 12 eggs, 24 cans and 4 muffins remain pack sizes;
- baby tomatoes stay distinct from diced/tinned tomatoes;
- brand/variant requests such as Weet-Bix, Coca-Cola Zero and Arnott's BBQ Shapes survive;
- the bottle of wine remains visible on the Stuff list but is never sent into automated retailer matching.

## Run 2 — Woolworths / Best match

Settings:
- Preferred supermarket: Woolworths
- Product matching: Best match
- Prefer specials: On
- Allow close alternatives: On

Record for each line: requested item, selected product, size, unit price, line price, special yes/no, correct yes/no.

## Run 3 — Woolworths / Cheapest suitable

Change only:
- Product matching: Cheapest suitable
- Prefer specials: Off

The chosen products may change, but obvious semantic errors are still failures. Cheapest does not mean 'any cheap product'.

## Run 4 — Coles / Best match

Use the same settings as Run 2, with Coles selected. Check the matched-product screen and basket estimate, then test the trolley beta.

## Run 5 — Coles / Cheapest suitable

Use the same settings as Run 3. Compare both product choices and estimated basket total.

## Failure / resilience checks

Test these deliberately at least once:
- retailer signed out;
- bad or slow network;
- retailer WebView load error;
- retailer security/challenge page;
- one product no longer exists;
- one deliberately obscure grocery that should be left unmatched;
- leave the app and return during retailer handoff.

Expected behaviour: Stuff must stop cleanly or leave the user in the retailer experience with a useful explanation. It must not loop, spam requests or attempt to bypass a retailer security check.

## Scorecard

For each retailer run record:

| Measure | Score |
| --- | --- |
| Correct product family | /22 |
| Correct variant/brand where requested | /22 |
| Correct size/pack/quantity | /22 |
| Reasonable price choice | /22 |
| Restricted item excluded from automation | Pass/Fail |
| Retailer cart/trolley handoff | Pass/Fail |
| Checkout remained user controlled | Pass/Fail |
| Failure handling understandable | Pass/Fail |

Do not tune matching to make only this fixture pass. Any change prompted by a regression result should be phrased as a general matching rule and then re-run across both retailers.
