# stufftheshopping.com.au cutover

The repository currently remains on `hellodavid.com.au` so the existing GitHub Pages site is not broken before DNS is ready.

## Target

Primary domain: `stufftheshopping.com.au`

Also support: `www.stufftheshopping.com.au`

## DNS records for GitHub Pages

At the domain registrar/DNS provider, set the apex domain to GitHub Pages using these A records:

- `@` → `185.199.108.153`
- `@` → `185.199.109.153`
- `@` → `185.199.110.153`
- `@` → `185.199.111.153`

Set the www host as:

- `www` CNAME → `andrew020176-netizen.github.io`

Remove conflicting A/AAAA/CNAME records for the same hosts before cutover.

## Repository cutover

Once DNS is present, change the repository `CNAME` file from:

`hellodavid.com.au`

to:

`stufftheshopping.com.au`

Then confirm GitHub Pages issues the HTTPS certificate and that these load:

- `/`
- `/privacy.html`
- `/terms.html`

The mobile app is already configured to use the Stuff domain for the Privacy Policy and Terms links.
