# Hallway Gallery

A **Section** for artists and photographers who show and sell their work: a white hallway that bends gently to the left, hung with your artworks. It strolls on by itself, and scrolling, dragging or the arrow keys walk the visitor along it, past arched pools of light. Hovering an artwork lifts it off the wall and names it. Choosing one walks up to it and opens a simple panel beside it: your own words about the work, its price, a row of finishes and an **Add to cart** button. Choosing a finish changes the artwork on the wall, so visitors see it as a canvas, a white canvas, a framed print or in a float frame. The panel is a starting point: put whatever you like in each artwork's words and connect the button to your own shop.

```html
<div id="hallway" style="width: 100%; height: 100vh">
  <article data-artwork data-price="180">
    <h2>Ribbon Flow</h2>
    <p data-artwork-meta>Screen print, 2026 · Edition of 50</p>
    <p>A single striped ribbon falls the length of the sheet.</p>
  </article>
  <article data-artwork data-price="160">
    <h2>Split Sun</h2>
    <p data-artwork-meta>Screen print, 2026 · Edition of 50</p>
    <p>A blue sun sits on the horizon between a red sky and black ground.</p>
  </article>
  <!-- One article per artwork, in the order they hang. -->
</div>
```

```js
import { mountHallwayGallery } from './src/hallway-gallery.js';
import './src/styles.css';

const hallway = mountHallwayGallery(document.querySelector('#hallway'), {
  artworkCount: 12,
  imageUrls: ['./art/ribbon-flow.jpg', './art/split-sun.jpg'],
  display: 'framed',
  frameColor: '#22201d',
}, {
  currency: 'EUR',
});

document.querySelector('#hallway').addEventListener('hallway-gallery:add', event => {
  // event.detail: { index, title, finish, price, currency }
  myCart.add(event.detail);
});

await hallway.ready;
await hallway.update({ bend: 70, wallColor: '#efe9df' });
hallway.open(3);
hallway.choose({ finish: 'canvas' });
hallway.close();
// Draw the current view now, for example when capturing video frame by frame.
hallway.render();
// Release listeners, observers and graphics memory; return the articles to the host.
hallway.destroy();
```

Give the host an explicit width and height, for example `width:100%;height:100vh`. The hallway fills it and the panel opens over its right side, or rises from the bottom on hosts narrower than 720 px.

**Your words.** Each direct child of the host marked `data-artwork` belongs to one artwork, in hanging order. Its first heading is the artwork's title, used in the panel, in the label on the wall, in the hover label and for assistive technology. The element marked `data-artwork-meta` (or else the first paragraph) is the second line of the wall label. Everything in the article is shown at the top of the panel when the artwork is chosen; `destroy()` puts the articles back in the host. `data-price` is the price shown under the words; leave it out to show none.

**Images.** Each artwork keeps its own proportions, fitted inside the artwork width and height, frame included. Use JPEG, PNG or WebP at least 1600 px on the long side; larger images are scaled to 2048 px. With `imageFit: 'fill'` every artwork is cropped to the same rectangle around `focalX` and `focalY` (0 to 100 %). Images from another site must allow cross-origin use, because they are drawn with WebGL. The download ships a placeholder for each artwork; replace the files under `demo/media/` or set `imageUrls`.

**The hallway.** It is a ring: walking on past the last artwork brings the visitor back to the first. `bend` sets how tightly it curves, and the artworks repeat around the ring so the spacing you set stays exact. With `walls: 'both'` they alternate between the outer and inner wall.

**The panel.** The finishes offered are the one on the wall plus every finish switched on with `offerCanvas`, `offerWhiteCanvas`, `offerFramed` and `offerFloat`; with only one, the row is hidden. The third argument of `mountHallwayGallery`, and the second of `update`, sets:

- `currency` (default `USD`) and `locale` (default: the visitor's browser), which format the price.
- `labels`: every word the panel shows, for other languages: `finish`, `add`, `added`, `close`, `previous`, `next`, `view`, `gallery` and `finishes: { canvas, 'white-canvas', framed, float }`.

**Add to cart** dispatches `hallway-gallery:add` on the host with the artwork, the chosen finish and the price, and the button confirms for a moment. Connect it to your shop's cart, a checkout link or an enquiry form. The component itself keeps no cart and takes no payment.

**Walking.** Pointer drag and horizontal touch swipe walk along the hallway; vertical touch movement still scrolls the page. With `wheel` on (the default), scrolling over the hallway walks it instead of scrolling the page. `autoWalk` keeps walking on by itself at an easy pace while nobody is scrolling, eases to a stop while the pointer is over an artwork and picks up again when it leaves. `lookAround` turns the view a little toward the pointer.

**Choosing.** A click, a tap, Enter on an artwork's button or `open(index)` walks up to the artwork and opens the panel. The previous and next buttons walk to the neighbouring artworks. Escape, the close button, a click on the wall or `close()` walks back into the hallway. The finish a visitor chose stays on that artwork after the panel closes, until the settings change.

**Events.** The host receives `hallway-gallery:change` when another artwork comes up ahead, `hallway-gallery:open` and `hallway-gallery:close`, each with `detail.index`, and `hallway-gallery:add`.

**Keyboard and assistive technology.** Each artwork has a button named after its title; Tab reaches them and the arrow keys move between them, walking the hallway to each one. The finishes are a radio group that the arrow keys change. The hallway is drawn on a canvas hidden from assistive technology, and the chosen artwork and additions to the cart are announced.

Reduced motion stops the stroll, and walking, opening and closing happen without glides. Without WebGL the artworks are listed as buttons that open the same panel; `getState().renderer` reports `webgl` or `flat`.

`ready` resolves when the images have loaded and rejects if one cannot load. `getState()` returns the normalized configuration, the hallway's layout, where the visitor stands, the artwork ahead, the open artwork with its chosen finish and price, and the on-screen box of each artwork in view.

React and Next.js: `adapters/react/HallwayGallery.js` mounts the same runtime. It accepts `options`, `shop`, `artworks` (an array of `{ title, meta, description, price }` that it writes as the articles), host props, `style` (default height `100svh`), `onReady`, `onError`, `onOpen`, `onClose`, `onChange` and `onAdd`, and its ref exposes `getState()`, `walk()`, `goTo()`, `open()`, `close()`, `next()`, `previous()`, `choose()`, `setPaused()`, `render()` and `reset()`.

Three.js 0.181.0 is included in `src/vendor/`; see `THIRD_PARTY_NOTICES.md`.
