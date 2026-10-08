# CalScape

A Berkeley-themed pixel art world with ambient sounds for studying.

Put it on the TV, add a rain cloud, a bird or the Campanile bell, and let it run
in the background. Every sound belongs to something you can see in the scene.

## Running

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/, no backend needed
```

## Using it

- **Inventory (bottom centre):** click an element to add it to the Glade. Elements
  already in the scene are marked; clicking one opens its controls. The `+` tile
  adds the next element that isn't in the scene yet.
- **Scene objects:** hover a sprite to outline it and show its control bar
  (mute, volume down, level, volume up, remove). Click to pin the bar; click
  elsewhere or press Escape to close it. On touch, tap the sprite.
- **Keyboard:** Tab to a sprite, press Enter to open its controls.
- **Bottom left:** day/night palette. Audio is unaffected.
- **Bottom right:** master volume (click, drag or arrow keys) and fullscreen.
- Controls fade out after five seconds of inactivity; move the pointer or press
  a key to bring them back.

The Campanile chimes once when added, then strikes the hour at the top of each
hour in Berkeley time (America/Los_Angeles).

## Layout

- `src/scene/` — the 320×180 logical scene: palettes, sprites, backdrop layers
  and the `World` renderer, which also owns silhouette masks for outlines and
  hit-testing.
- `src/audio/engine.ts` — Web Audio engine. All sounds are synthesised (rain
  loops, bird chirps, bell partials); `sync()` is idempotent so React rerenders
  cannot start duplicate loops.
- `src/state.ts` — element presence, mute, volume, night mode and master volume.
- `src/ui/` — inventory, corner controls, anchored element bar and pixel icons.
