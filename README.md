# MarketCross Assistant

A small **local-only Linux cross-listing assistant** for Kijiji, Facebook Marketplace, Karrot and Craigslist.

It deliberately does **not** log into marketplaces, scrape them, bypass CAPTCHAs, or automatically click Publish. Instead, you maintain one master listing, open the official marketplace posting pages, copy the appropriate fields, upload the same photos, then record each published URL/status.

## Requirements

- Node.js 18 or newer
- A modern browser (Firefox or Chromium are fine)

No npm packages are required.

## Run

```bash
cd marketcross-assistant
npm start
```

Then open:

```text
http://127.0.0.1:3784
```

Stop it with `Ctrl+C`.

## Features

- One canonical/master listing per item
- Title, price, condition, category, location, tags and description
- Local photo storage
- One-click Copy Title / Price / Description for each marketplace
- Per-marketplace overrides
- Marketplace status tracking: Not posted, Draft, Live, Sold, Removed
- Store the final marketplace URL
- Karrot helper: copy a live Kijiji or Facebook URL for Karrot's supported Import Listings feature
- Dashboard showing listing status across all four sites
- Local-only server bound to `127.0.0.1` by default
- No dependencies and no marketplace credentials stored

## Data

Everything stays inside:

```text
data/listings.json
data/photos/
```

Back up the `data/` directory if the listings matter to you.

## Suggested workflow

1. Click **New listing**.
2. Enter the master listing and save it.
3. Add photos.
4. For Kijiji, click **Open Kijiji**, choose **Post Ad**, and use the Copy buttons.
5. Paste the resulting Kijiji URL into the Kijiji card and set status to **Live**.
6. Repeat for Facebook Marketplace and Craigslist.
7. For Karrot, either create the listing normally or use **Copy source URL for Karrot import** after Kijiji/Facebook is live.
8. When something sells, mark that marketplace **Sold**, then use the stored URLs to open and remove the duplicates elsewhere.

## Why it does not auto-publish

Marketplace posting interfaces and rules change, and some marketplaces restrict unapproved automated access/posting. Keeping final publication user-controlled makes this tool much less brittle and avoids building around private/internal APIs or automated login/CAPTCHA flows.

## Custom port

```bash
PORT=8080 npm start
```

To expose it beyond the local computer you can change `HOST`, but that is **not recommended** unless you add authentication:

```bash
HOST=0.0.0.0 PORT=3784 npm start
```

## License

MIT
