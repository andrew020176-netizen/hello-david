# Hello David — prototype 01

A deliberately thin grocery-agent prototype:

- voice or typed grocery input
- converts rough requirements into an editable household shop
- adds simple meal ingredients
- deduplicates overlapping requirements
- compares demo Woolworths / Coles / Aldi baskets
- optional spoken responses from "David"

## Run it

The simplest option is to open `index.html` in a browser.

For a local web server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Important

Retailer prices in this prototype are DEMO DATA only. The next technical step is to replace `catalogues` in `app.js` with a live retailer product/pricing data source.

## Suggested GitHub repo name

`hello-david`
