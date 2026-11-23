# Install Hallway Gallery for Vanilla

Keep this extracted asset folder intact so relative runtime, media, and dependency paths continue to resolve.
The surrounding Example website HTML, CSS and JavaScript are not included.

Read `README.md` and `CUSTOMIZATION.md` for the asset's supported options, required host markup or content props, sizing, fallbacks, and lifecycle.

## Your images

Downloads include no images from the storefront preview, whether defaults, uploads or library choices. Essential model and support resources remain included.

Every image slot has its own placeholder file in `images/`, labelled with the slot's name and recommended size. A customized download contains `hallway-gallery.options.js` beside `delivery-manifest.json`, and `YOUR-SETTINGS.md`. Import the options file's default export as the runtime or adapter options: it points each slot at its placeholder, so the item works as installed.

Replace an image in either of two ways:

- Save your image over the slot's placeholder file, keeping its file name and format.
- Or change the slot's path in `hallway-gallery.options.js` to your own image.

An image path is one of:

- a project path that starts with `./`, `../` or `/`, kept as written. `/images/hero.jpg` is served from your site's public folder; `./` and `../` resolve against the page that shows the item;
- an `http:` or `https:` URL without a user name or password;
- a JPEG, PNG or WebP data URL of at most 2,000,000 characters.

Paths and URLs are limited to 2,048 characters and cannot contain spaces (write `%20`), `<`, `>`, `\` or control characters. Protocol-relative (`//`) and other kinds of URL are refused: the slot then shows its built-in placeholder and the browser console shows a warning.

This item uploads its images to WebGL or reads them from a canvas, so an image on another domain must be served with an `Access-Control-Allow-Origin` header; without one, the image does not load.

For slots with an alt-text setting, describe the new image there, in `saved.values` of the options file.

| Slot | Placeholder file | Recommended size | Image key | Alt-text key | From another domain |
| --- | --- | --- | --- | --- | --- |
| Artwork 1 | `images/artwork-1.png` | 1122 × 1402 px (4:5) | `imageUrls.0` | `imageAlt.0` | Needs CORS |
| Artwork 2 | `images/artwork-2.png` | 900 × 1200 px (3:4) | `imageUrls.1` | `imageAlt.1` | Needs CORS |
| Artwork 3 | `images/artwork-3.png` | 1536 × 1024 px (3:2) | `imageUrls.2` | `imageAlt.2` | Needs CORS |
| Artwork 4 | `images/artwork-4.png` | 900 × 1200 px (3:4) | `imageUrls.3` | `imageAlt.3` | Needs CORS |
| Artwork 5 | `images/artwork-5.png` | 1254 × 1254 px (1:1) | `imageUrls.4` | `imageAlt.4` | Needs CORS |
| Artwork 6 | `images/artwork-6.png` | 900 × 1200 px (3:4) | `imageUrls.5` | `imageAlt.5` | Needs CORS |
| Artwork 7 | `images/artwork-7.png` | 1536 × 1024 px (3:2) | `imageUrls.6` | `imageAlt.6` | Needs CORS |
| Artwork 8 | `images/artwork-8.png` | 900 × 1200 px (3:4) | `imageUrls.7` | `imageAlt.7` | Needs CORS |
| Artwork 9 | `images/artwork-9.png` | 1122 × 1402 px (4:5) | `imageUrls.8` | `imageAlt.8` | Needs CORS |
| Artwork 10 | `images/artwork-10.png` | 900 × 1200 px (3:4) | `imageUrls.9` | `imageAlt.9` | Needs CORS |
| Artwork 11 | `images/artwork-11.png` | 1536 × 1024 px (3:2) | `imageUrls.10` | `imageAlt.10` | Needs CORS |
| Artwork 12 | `images/artwork-12.png` | 900 × 1200 px (3:4) | `imageUrls.11` | `imageAlt.11` | Needs CORS |
| Artwork 13 | `images/artwork-13.png` | 1536 × 1024 px (3:2) | `imageUrls.12` | `imageAlt.12` | Needs CORS |
| Artwork 14 | `images/artwork-14.png` | 900 × 1200 px (3:4) | `imageUrls.13` | `imageAlt.13` | Needs CORS |
| Artwork 15 | `images/artwork-15.png` | 1122 × 1402 px (4:5) | `imageUrls.14` | `imageAlt.14` | Needs CORS |
| Artwork 16 | `images/artwork-16.png` | 900 × 1200 px (3:4) | `imageUrls.15` | `imageAlt.15` | Needs CORS |

Without the options file, the configuration defaults show the generic placeholders `demo/media/crate-arc-stack.webp`, `demo/media/crate-blue-bars.webp`, `demo/media/crate-chrome-band.webp`, `demo/media/crate-halftone-knot.webp`, `demo/media/crate-offset-target.webp`, `demo/media/crate-paper-fan-cut.webp`, `demo/media/crate-red-orbit.webp`, `demo/media/crate-split-sun.webp`, `demo/media/print-checker-lens.webp`, `demo/media/print-contour-pair.webp`, `demo/media/print-folded-shards.webp`, `demo/media/print-halftone-cut.webp`, `demo/media/print-line-fan.webp`, `demo/media/print-radial-pulse.webp`, `demo/media/print-ribbon-flow.webp`, `demo/media/print-stepped-rhythm.webp`. See `src/configuration.js` and `CUSTOMIZATION.md` for the image fields.

## Vanilla setup

Load `src/styles.css` once, then import the canonical mount function from `src/hallway-gallery.js`:

```js
import { mountHallwayGallery } from "./src/hallway-gallery.js";
import options from "./hallway-gallery.options.js";

const root = document.querySelector("[data-asset]");
const controller = mountHallwayGallery(root, options);

// Later: controller.update(nextOptions);
// Teardown: controller.destroy();
```

Use a stylesheet import or a `<link>` that points to `src/styles.css`.

## Package boundary

Read `WEBSITE-USE.md` for permission to use, modify and reuse this item and its bundled media in personal, commercial and client websites.
Bundled third-party software remains under its own license; retain the applicable notices and license files. See `THIRD_PARTY_NOTICES.md`. Declared local runtime dependencies and media remain in their original relative paths.

