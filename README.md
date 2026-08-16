# CrossMarket

**Write once. Post deliberately.**

CrossMarket is a local, user-controlled cross-listing assistant for **Kijiji**, **Facebook Marketplace**, **Karrot**, and **Craigslist**. It lets you maintain one master listing, track where it has been posted, and use a Firefox/Greasemonkey companion to copy or fill supported listing fields.

CrossMarket deliberately does **not** log into marketplaces, scrape account data, solve CAPTCHAs, or automatically publish listings. You remain in control of the final marketplace-specific choices and the Post/Publish action.

## Features

- One master listing per item
- Title, price, condition, category, location, tags, and description
- Local photo storage
- Per-marketplace title, price, category, location, and description overrides
- Status tracking: Not posted, Draft, Live, Sold, Removed
- Listing-level sale records with sold date, marketplace, buyer name, and optional buyer email
- Marking a listing sold automatically marks the selected marketplace as Sold while leaving other marketplace statuses unchanged
- Opening a marketplace posting page automatically marks that listing as Live on that marketplace
- Store an optional published ad URL for each marketplace, with prominent Save/Open controls
- Automatically capture a newly published ad URL when a posting session was started with CrossMarket’s Open button and the companion recognizes the resulting listing page
- Dashboard showing listing status across all four marketplaces
- Firefox/Greasemonkey companion
- Import the currently displayed photo from Google Photos into the active local listing
- User-triggered filling of recognized visible text fields on Kijiji, Facebook Marketplace, and Karrot
- Copy-only workflow on Craigslist
- Karrot helper for copying an existing Kijiji or Facebook Marketplace listing URL for Karrot's import workflow
- No npm dependencies
- Local-only server bound to `127.0.0.1` by default
- No marketplace passwords, cookies, or sessions stored

## Requirements

- Node.js 18 or newer
- Firefox
- Greasemonkey, if you want the browser companion

CrossMarket has no npm package dependencies, so there is no `npm install` step.

## Install from GitHub

```bash
git clone git@github.com:zoltan-dulac/cross-market.git
cd cross-market
npm start
```

Then open:

```text
http://127.0.0.1:3784
```

Stop the server with `Ctrl+C`.

## Upgrading from MarketCross Assistant

If you have already been using the earlier MarketCross Assistant build, copy its local data directory into the new clone before starting CrossMarket:

```bash
cp -a ../marketcross-assistant/data/. ./data/
```

Your runtime data remains ignored by Git.

## Firefox / Greasemonkey companion

With CrossMarket running, open this URL in Firefox:

```text
http://127.0.0.1:3784/cross-market-companion.user.js
```

Approve the userscript installation in Greasemonkey.

The userscript runs on the supported marketplace pages and on `photos.google.com`. It contacts the local CrossMarket server at `127.0.0.1:3784`; when you explicitly import a Google Photos image, it also reads that currently displayed image so it can make a local copy.

### Typical workflow

1. Create or edit a listing in CrossMarket.
2. Press **Use in Greasemonkey** to make it the default listing.
3. Open Kijiji, Facebook Marketplace, Karrot, or Craigslist in Firefox. CrossMarket marks that marketplace as Live when you use its Open button.
4. Press the floating **CrossMarket** button.
5. Choose a different saved listing if needed.
6. On Kijiji, Facebook Marketplace, and Karrot, press **Fill visible fields** to populate recognized title, price, description, and location fields.
7. Complete category, condition, photos, and marketplace-specific controls manually.
8. Review everything and use the marketplace's own Post/Publish control yourself.
9. If the marketplace opens the newly published ad in the same posting flow, the companion tries to save that ad URL back to the correct CrossMarket listing automatically. You can also press **Save current ad URL** in the companion as a fallback.
10. When the item sells, use the listing's **Sale** section to record the date, platform, buyer, and optional email address.

Craigslist is intentionally copy-only in the userscript.


### Importing from Google Photos

1. In CrossMarket, choose the listing you are working on and press **Use in Greasemonkey**.
2. In Firefox, open `https://photos.google.com/` and open a single photo.
3. Press the floating **CrossMarket** button.
4. Confirm the intended listing in the selector.
5. Press **Add current photo to listing**.
6. CrossMarket reads the currently displayed photo and stores a local copy under `data/photos/`.
7. Move to the next Google Photos image and repeat as needed.

The import is user-triggered and handles still images only. It copies the image currently being displayed by Google Photos; it does not use Google's private APIs or automatically browse your library. The displayed image may be a web-sized rendition rather than the camera's untouched original file.

## Browser companion boundaries

The companion:

- never stores marketplace passwords, cookies, or sessions;
- never reads your marketplace account or existing listing data;
- never clicks Post, Publish, Submit, or Next;
- never solves CAPTCHAs or bypasses verification;
- never publishes listings unattended;
- may automatically record the URL of a published ad only after you explicitly started that marketplace posting session with CrossMarket’s Open button;
- does not manipulate marketplace file-upload controls;
- reads a Google Photos image only after you explicitly press **Add current photo to listing**;
- fills fields only after you explicitly press **Fill visible fields**;
- leaves existing field text unchanged unless you explicitly enable replacement.

Marketplace markup changes frequently. CrossMarket uses labels, ARIA labels, placeholders, names, and other semantic hints rather than depending only on generated CSS class names. If it cannot identify a field with enough confidence, it leaves the field untouched.

### Ad URL capture

Each marketplace card has a visible optional **Ad URL** field. You can paste a URL there manually at any time. When you press a marketplace’s **Open** button, CrossMarket also records that the current listing is waiting for an ad URL from that marketplace. The Greasemonkey companion watches for a recognized published-ad URL during that posting session and, if it finds one, stores it locally and clears the pending capture. Pending automatic capture expires after four hours; the manual **Save current ad URL** action remains available afterward.

The current recognition rules cover Facebook Marketplace item URLs, Craigslist posting URLs, Karrot `/buy-sell/` item URLs, and the established Kijiji `/v-.../` ad URL form. Marketplace URL structures can change, so the companion also provides **Save current ad URL** as a manual fallback. It never presses the marketplace’s final publishing controls.

## Local data and privacy

CrossMarket stores runtime data under:

```text
data/
  listings.json
  settings.json
  photos/
```

These files are ignored by Git, so your listings and uploaded photos are not accidentally committed to the repository.

Back up the `data/` directory separately if the listings matter to you.

The server listens on `127.0.0.1` by default, which makes it accessible only from the local computer.

## Custom port

```bash
PORT=8080 npm start
```

You can change `HOST`, but exposing the application to a network is not recommended unless authentication and other appropriate security controls are added.

## Development

Run the syntax checks with:

```bash
npm test
```

Project layout:

```text
cross-market/
├── data/
│   └── photos/
├── public/
│   ├── app.js
│   ├── cross-market-companion.user.js
│   ├── index.html
│   └── styles.css
├── .gitignore
├── LICENSE
├── package.json
├── README.md
└── server.js
```

## Disclaimer

CrossMarket is an independent project and is not affiliated with, endorsed by, or sponsored by Kijiji, Meta/Facebook, Karrot, or Craigslist. Marketplace interfaces and terms can change, so users are responsible for reviewing and complying with the rules of each service they use.

## License

MIT. See [LICENSE](LICENSE).
