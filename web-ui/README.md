# web-ui

Vite + React UI for calling `POST /remove-background` and showing the Base64 image result.

## Quick start

1. Open a terminal in `web-ui`.
2. Install dependencies:
   - `npm install`
3. Run:
   - `npm run dev`

## How it works

1. User selects an image file.
2. The app converts it to Base64 data URL in browser.
3. Sends JSON payload:
   ```json
   {
     "image_base64": "data:image/png;base64,..."
   }
   ```
4. Renders backend response `cleaned_image` field:
   ```json
   {
     "cleaned_image": "data:image/png;base64,...",
     "engine": "BiRefNet:..."
   }
   ```
