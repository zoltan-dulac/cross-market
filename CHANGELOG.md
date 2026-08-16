# Changelog

## 0.3.2 - 2026-08-16

- Promoted each marketplace’s optional **Ad URL** field into the main marketplace card, with dedicated **Save URL** and **Open saved ad** controls.
- Starting a post with a marketplace **Open** button now arms URL capture for that listing and marketplace.
- The Greasemonkey companion automatically saves the resulting published-ad URL when it recognizes the new listing page.
- Added **Save current ad URL** to the Greasemonkey panel as a manual fallback when a marketplace changes its URL pattern.
- Added server-side marketplace-host validation before companion-captured URLs are stored.

## 0.3.1 - 2026-08-16

- Added a listing-level **Mark as sold** workflow.
- Sale records store the sold date, platform, buyer name, and optional buyer email address.
- Marking a listing sold changes the selected marketplace status to **Sold** while leaving other marketplace statuses unchanged, making remaining live ads easy to find and remove.
- Added a Sale column to the main dashboard and a prominent sale-details shortcut in the listing editor.
- Sale records can be edited or cleared; clearing restores the marketplace status that existed before the sale was recorded when possible.

## 0.3.0 - 2026-08-15

- Added Google Photos support to the Firefox/Greasemonkey companion.
- When a single photo is open in Google Photos, **Add current photo to listing** copies the displayed image into the selected CrossMarket listing and stores it under `data/photos/`.
- Google Photos uses the same active-listing selector as the marketplace companion.
- Still images only; videos are detected and left untouched.
- Increased the local JSON request limit to accommodate larger image transfers.

## 0.2.1 - 2026-08-15

- Opening Kijiji, Facebook Marketplace, Karrot, or Craigslist now automatically marks that marketplace as Live for the current listing.
- The published listing URL remains blank until the user adds it manually.

## 0.2.0 - 2026-08-15

- Renamed the project to CrossMarket.
- Added the Firefox/Greasemonkey companion.
- Added user-triggered visible-field filling for Kijiji, Facebook Marketplace, and Karrot.
- Kept Craigslist copy-only.
- Added active-listing selection shared between the local dashboard and userscript.
- Added Karrot import-source URL helper.
- Added marketplace-specific overrides and status tracking.
- Added GitHub repository metadata and safer runtime-data ignore rules.
