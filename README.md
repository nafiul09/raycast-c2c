# Clipboard to Cloud (C2C)

Raycast extension to upload copied files from your clipboard to cloud storage, copy the public URL, and manage local upload history by file category.

## Features

- Hotkey-friendly `no-view` upload command
- Provider-ready settings with Cloudflare R2 support
- Upload validation by allowed file categories
- Max upload size enforcement (MB)
- Automatic object key routing: `<category>/<mm-yyyy>/<file>`
- URL copied to clipboard after successful upload
- Local file library with category filter (`All` + category views)
- Grid/List toggle persisted in Raycast LocalStorage
- Remove individual items or clear local library history

## Setup

1. Install dependencies:
   - `pnpm install`
2. Open Raycast extension preferences for `Clipboard to Cloud (C2C)` and configure:
   - `Cloud Provider` (currently `Cloudflare R2`)
   - `R2 Endpoint` (e.g. `https://<accountid>.r2.cloudflarestorage.com`)
   - `R2 Bucket`
   - `R2 Access Key ID`
   - `R2 Secret Access Key`
   - `Public Base URL` (custom public domain)
   - `Allowed File Types` checkboxes
   - `Max Upload Size (MB)` (default `25`)
   - `Library History Limit` (`50` / `100` / `200` / `500` / `Unlimited`)
3. Save preferences.

## Commands

- `Upload Clipboard File to Cloud` (`no-view`):
  - Validates extension preferences and file policy
  - Reads `Clipboard.read()` and accepts either:
    - copied file path
    - clipboard text (uploaded as generated `.txt`)
  - Rejects disallowed category uploads
  - Rejects files over configured max size
  - Uploads to Cloudflare R2
  - Copies resulting public URL
  - Saves typed upload metadata to local history

- `C2C File Library` (`view`):
  - Shows locally stored upload records
  - Filters by `All`, `Images`, `Videos`, `Documents`, `Archives`, `Audios`, `Others`
  - Supports List and Grid views (List default)
  - Actions: Open Preferences, Copy URL, Open in Browser, Remove from History, Clear History

## Notes

- Local history uses `history.v2` schema and starts fresh from previous image-only history.
- `Others` category includes unknown or extensionless files.
- Cloud provider abstraction exists in preferences, but only Cloudflare R2 is implemented in this version.
- The current icon file still fails Raycast lint size validation (not changed in this update).
