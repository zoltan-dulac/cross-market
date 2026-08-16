# Changelog

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
