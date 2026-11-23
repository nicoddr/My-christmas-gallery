# Hallway Gallery

These settings belong to this downloaded package.

Import options from ./hallway-gallery.options.js and pass them to the component as described in INSTALL.md. The options file is already beside delivery-manifest.json. The surrounding Example website is not included.

## Your images

Preview images are not included. Each image slot shows its own placeholder file from `images/`, as `hallway-gallery.options.js` sets. To use your own image, save it over the placeholder, keeping the file name and format, or change the slot's path in the options file, for example to `/images/hero.jpg` served from your site's public folder. INSTALL.md lists the accepted image paths. For slots with an alt-text setting, describe the image there, in `saved.values` of the options file.

A slot marked Needs CORS uploads its image to WebGL or reads it from a canvas: an image on another domain must be served with an `Access-Control-Allow-Origin` header.

| Slot | Placeholder file | Recommended size | Image key | Alt text | From another domain |
| --- | --- | --- | --- | --- | --- |
| Artwork 1 | `images/artwork-1.png` | 1122 × 1402 px (4:5) | `imageUrls.0` | `imageAlt.0`: describe your image | Needs CORS |
| Artwork 2 | `images/artwork-2.png` | 900 × 1200 px (3:4) | `imageUrls.1` | `imageAlt.1`: describe your image | Needs CORS |
| Artwork 3 | `images/artwork-3.png` | 1536 × 1024 px (3:2) | `imageUrls.2` | `imageAlt.2`: describe your image | Needs CORS |
| Artwork 4 | `images/artwork-4.png` | 900 × 1200 px (3:4) | `imageUrls.3` | `imageAlt.3`: describe your image | Needs CORS |
| Artwork 5 | `images/artwork-5.png` | 1254 × 1254 px (1:1) | `imageUrls.4` | `imageAlt.4`: describe your image | Needs CORS |
| Artwork 6 | `images/artwork-6.png` | 900 × 1200 px (3:4) | `imageUrls.5` | `imageAlt.5`: describe your image | Needs CORS |
| Artwork 7 | `images/artwork-7.png` | 1536 × 1024 px (3:2) | `imageUrls.6` | `imageAlt.6`: describe your image | Needs CORS |
| Artwork 8 | `images/artwork-8.png` | 900 × 1200 px (3:4) | `imageUrls.7` | `imageAlt.7`: describe your image | Needs CORS |
| Artwork 9 | `images/artwork-9.png` | 1122 × 1402 px (4:5) | `imageUrls.8` | `imageAlt.8`: describe your image | Needs CORS |
| Artwork 10 | `images/artwork-10.png` | 900 × 1200 px (3:4) | `imageUrls.9` | `imageAlt.9`: describe your image | Needs CORS |
| Artwork 11 | `images/artwork-11.png` | 1536 × 1024 px (3:2) | `imageUrls.10` | `imageAlt.10`: describe your image | Needs CORS |
| Artwork 12 | `images/artwork-12.png` | 900 × 1200 px (3:4) | `imageUrls.11` | `imageAlt.11`: describe your image | Needs CORS |
| Artwork 13 (not shown with these settings) | `images/artwork-13.png` | 1536 × 1024 px (3:2) | `imageUrls.12` | `imageAlt.12`: describe your image | Needs CORS |
| Artwork 14 (not shown with these settings) | `images/artwork-14.png` | 900 × 1200 px (3:4) | `imageUrls.13` | `imageAlt.13`: describe your image | Needs CORS |
| Artwork 15 (not shown with these settings) | `images/artwork-15.png` | 1122 × 1402 px (4:5) | `imageUrls.14` | `imageAlt.14`: describe your image | Needs CORS |
| Artwork 16 (not shown with these settings) | `images/artwork-16.png` | 900 × 1200 px (3:4) | `imageUrls.15` | `imageAlt.15`: describe your image | Needs CORS |
