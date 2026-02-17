# IMG to R2

Raycast extension for personal use to upload the current clipboard image to Cloudflare R2, copy the public URL, and browse previously uploaded URLs in a local gallery.

## Features

- Hotkey-friendly `no-view` upload command
- Uses Raycast extension preferences for R2 configuration
- Uploads only when clipboard currently contains an image file
- Copies uploaded image URL to clipboard automatically
- Local gallery with image previews and keyboard navigation
- Grid/List toggle persisted in local Raycast storage
- Settings action inside gallery to open extension preferences anytime
- Remove individual items or clear entire local gallery history

## Setup

1. Install dependencies:
   - `pnpm install`
2. Open Raycast extension preferences for `IMG to R2` and fill:
   - `R2 Endpoint` (e.g. `https://<accountid>.r2.cloudflarestorage.com`)
   - `R2 Bucket`
   - `R2 Access Key ID`
   - `R2 Secret Access Key`
   - `Public Base URL` (your public custom domain)
   - `Object Prefix` (optional)
3. Save preferences.

## Commands

- `Upload Clipboard Image to R2` (`no-view`):
  - Checks Raycast preferences and opens extension preferences if missing/invalid
  - Reads `Clipboard.read()`
  - Rejects non-image clipboard with toast
  - Uploads image to R2
  - Copies resulting URL to clipboard
  - Stores URL metadata locally

- `Images R2 Gallery` (`view`):
  - Opens extension preferences if required settings are missing
  - Shows locally stored upload URLs
  - Supports Grid and List views
  - Actions: Open Extension Preferences, Copy URL, Open in Browser, Remove from History, Clear Gallery History

## Notes

- Gallery stores only metadata (`url`, `key`, `timestamp`) in Raycast LocalStorage.
- R2 credentials are stored in Raycast extension preferences.
- No remote listing/import sync in v1.
- Clearing extension local data removes gallery history.
