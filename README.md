# CalScape

A Berkeley-themed pixel art world with ambient sounds for studying.

Put it on the TV, add rain, a bird or the Campanile bell, and let it run in the
background. Every sound belongs to something you can see in the scene.

## Running

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/, no backend needed
```

## Using it

- **Inventory (bottom centre):** click an element to add it to the Glade; click
  it again to remove it. Elements in the scene have a blue outline. The `+`
  tile adds the next element that isn't in the scene yet.
- **Scene objects:** hover a sprite to outline it and show its control bar
  (mute, volume down, level, volume up, remove). Changing the volume plays a
  short sample at the new level. Click to pin the bar; click elsewhere or press
  Escape to close it. On touch, tap the sprite.
- **Keyboard:** Tab to a sprite, press Enter to open its controls.
- **Bottom left:** golden-hour or night palette. Audio is unaffected.
- **Bottom right:** click the speaker to mute everything, the blocks to set the
  master volume (click, drag or arrow keys), and the corner tile for fullscreen.
- Controls fade out after five seconds of inactivity; move the pointer or press
  a key to bring them back.

The Campanile chimes once when added, then tolls the hour on your computer's
clock at the top of every hour: once at 1 o'clock, twice at 2, up to twelve
times at noon and midnight, with strikes 4 seconds apart.

## Sounds

Rain and bird chirps are synthesised in the browser by `src/audio/engine.ts`.

The bell, `public/sounds/campanile.mp3`, is a single strike isolated from a
recording of the Campanile: only the bell's partials are kept, so traffic and
footsteps are removed, and the ring-out is extended from the partials' own
decay. If the file fails to load, a synthesised bell tuned to the Great Bear
Bell's low G plays instead.

## Layout

- `src/scene/` — the 320×180 logical scene: palettes, sprites, people on the
  Glade, the backdrop layers (sky, Doe's north facade, lawn, canopies) and the
  `World` renderer, which also owns silhouette masks for outlines and
  hit-testing. The scene scales to cover the window, cropping at most 20% of
  either axis.
- `src/audio/engine.ts` — Web Audio engine; `sync()` is idempotent so React
  rerenders cannot start duplicate loops.
- `src/state.ts` — element presence, mute, volume, time of day (day, sunset or night) and master volume.
- `src/ui/` — inventory, corner controls, anchored element bar and pixel icons.
- `public/sounds/` — audio recordings (the Campanile bell).
