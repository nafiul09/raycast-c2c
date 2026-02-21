# Clipboard to Cloud (C2C) Changelog

## [Unreleased]

- Rebranded extension from IMG to R2 to Clipboard to Cloud (C2C)
- Renamed commands to `Upload Clipboard File to Cloud` and `C2C File Library`
- Added cloud provider preference with Cloudflare R2 option
- Added allowed file type category settings (Images, Videos, Documents, Archives, Audios, Others)
- Added max upload size setting (MB) with validation
- Added local history limit setting (50, 100, 200, 500, Unlimited)
- Switched upload flow from image-only logic to generic clipboard file uploads
- Added category-based object key pathing in R2 (`<category>/<mm-yyyy>/<file>`)
- Upgraded local history schema to typed records (`history.v2`)
- Updated file library UI with category filtering and file metadata
- Removed unused in-command R2 configuration form
