# CalScape product requirements document

## 1. Objective

Music is too distracting to study with. I want CalScape to play on the TV as a calm background and ambient sound while I study. Keep this purpose central to every design and implementation decision: the scene, sounds, and controls should support sustained concentration.

## 2. Core product requirements

- Each sound belongs to a visible element. Add creates its visual and sound; mute keeps the visual; remove stops the sound and removes the added visual. There is no audio-only element mode.
- The world is the main interface. Use sprite inventory tiles and controls anchored to objects, rather than a list of sound sliders.
- Keep the screen calm and uncluttered. No separate sound indicators are needed; the mute button communicates audio state.

## 3. MVP scope

| Include in MVP | Defer |
| --- | --- |
| One Glade scene facing Doe, with Campanile behind it on the left | Additional scenes and scene switching |
| Rain cloud, bird, Campanile bell, crickets, and breeze elements | Storm, creek, chatter, and more elements |
| Add/remove, mute, and individual volume controls | Free dragging, multiple copies, and advanced placement |
| Day/sunset/night visual switch; master volume; fullscreen | Automatic time transitions and Spotify integration |
| Confirmation for periodic sounds; subtle animation; idle control hiding | Accounts and saved presets |

## 4. Artistic direction

Use a smaller, tile-like world with obvious square pixels, a restrained palette, simple foliage, and broad areas of lawn and sky. Avoid photographic textures, dense grass detail, and a highly rendered illustration. The attached mockups guide composition and controls; their backdrop detail should be reduced.

Everything stays on the pixel grid, including the sky and light. Sky gradients are drawn as solid colour steps on 2 × 2 pixel blocks, never smooth per-pixel blending or checkerboard dithering. Step edges wobble gently so bands read as natural rather than ruled, and they follow the light: at sunset they arc around the low sun, by day they tilt slightly toward it. Glows around the moon and street lamps are a few concentric stepped rings on the same block grid; stars have no halo, and the sun has a subtle stepped glow at midday and sunset.

Three times of day share one composition:

- **Day:** clear blue sky with the sun high on the right. Only a couple of Doe's windows are lit. People play spikeball, picnic, sit together, and read books (held open so the book reads clearly) on the open lawn.
- **Sunset:** a blended periwinkle-to-lavender-to-pink-to-peach sky as in Figure 5, warmest around the low sun on the left, with more pink cloud streaks, lit from below, drifting noticeably faster than clouds at other times. The Glade has sunset activities: a picnic, a small guitar circle, a couple watching the sun go down, and someone lying in the grass.
- **Night:** dark sky, moon, frequently twinkling stars, most of Doe's windows lit, and warm lamp glow in front of Doe. No people on the Glade; spotted does in warm brown tones rest there instead. They stand with heads up between short walks, sometimes lower their heads to graze, and each keeps its own unsynchronised rhythm.

**Rain** changes the weather, not just the foreground: while rain is present, the clear sky gives way to a low, softly billowed cloud deck in each time of day's own cloud colours (grey by day, dusky mauve at sunset, deep blue at night), still stepped on the 2 × 2 grid. The sun, moon, stars and their glows are hidden behind it, and a light tint dims the whole scene. Removing the rain brings the clear sky back.

Foreground trees frame the top corners. The left tree follows Figure 5: a thick trunk rising diagonally, a sturdy branch where the bird perches in open sky, leaves hanging below and to the right of it, and a light crown, with no branch tapering thin. The left canopy keeps clear space around the Campanile's spire.

Face Doe from the Glade at lawn level. Doe must read as a long pale facade with tall repeated windows and a low roofline. Place the Campanile behind and to the left of Doe, following Figure 5. Keep both landmarks recognizable when simplifying them.

## 5. Interface requirements

| Region | Required behavior |
| --- | --- |
| Bottom left | Sun, sunset and moon tiles switch between day, sunset and night. At night the Glade has deer instead of people. Preserve all audio settings and playback. |
| Bottom center | Pixel inventory with one tile per element sprite, and no separate add tile. Select an absent element to add it at a predefined scene position. Mark present elements without duplicating them. |
| Bottom right | Master volume control and adjacent fullscreen tile, matching the nighttime Glade, café, and marina suite. Prefer the shown pixel volume blocks; retain smooth gain internally. |
| Scene objects | Hover gives the physical sprite a clear outline and shows its anchored volume adjustment bar. |
| Top corners | Small CalScape label with a pixel bear, and the scene name with a pixel tree. A clock can be added later if useful. |

All corner menus attach to the visible scene rectangle, not the browser window, so they stay on the scene when the window is taller or wider than it.

### Hover and control behavior

- Outline follows the visible sprite silhouette, not a rectangular bounding box. Use a high-contrast pixel edge; keep it subtle enough for the scene.
- Show a compact anchored bar: mute/unmute, volume minus, level blocks, volume plus, and remove. The bar belongs to the object; do not open a large mixer panel.
- Keep the bar open while the pointer moves from the sprite onto its controls. Click pins the controls; clicking elsewhere or Escape closes them. Only one bar is open at a time.
- On touch, tap opens the same controls. Keyboard focus shows the same outline; Enter opens controls. Give every action a readable accessible label.

### Element state model

| State | Visual | Audio |
| --- | --- | --- |
| Absent | No added sprite or effect | Stopped; no preview |
| Present and unmuted | Sprite and subtle animation visible | Loop or scheduled event at chosen volume |
| Present and muted | Same visible sprite and animation | Silent; retain chosen volume |
| Removed | Added sprite or effect disappears | Stop preview, loop, and scheduled events |

## 6. Audio and implementation requirements

### Sound behavior

- Enable audio through an explicit user interaction. Continuous sounds start normally when added and need no separate preview. For periodic sounds, play one brief confirmation on add: adding the Campanile between hours plays one bell chime, then waits for the next hourly event. Respect mute and master-volume settings.
- Rain loops beneath the cloud; birds chirp intermittently from the bird sprite.
- Crickets: a cricket sits in a tuft of tall grass on the lawn and lifts its wings now and then. The sound is a soft chorus of three crickets chirping at different pitches and rhythms, looping seamlessly with occasional skipped chirps.
- Breeze: a pixel wind curl drifts in the sky. While present, the tree canopies and the perched bird rock by a pixel, and leaves fall more often and drift sideways. The sound is low wind with slow gusts and a faint leaf rustle that rises with each gust. Campanile rings at the top of each hour on the user's local clock, striking the hour on a 12-hour clock (once at 1 PM, twice at 2 AM, twelve times at noon and midnight). The sound is a single isolated strike of the Great Bear Bell. This is app timing, not a promise to reproduce the campus bell schedule.
- Master volume multiplies each element gain, preserving the mix. Final gain = master volume × element volume × mute state. Muting does not erase volume; increasing volume does not automatically unmute.
- Use short fades on gain changes and stops to avoid clicks. Use seamless loops and modest default levels. Keep the sound mix unchanged when switching the time of day.

### Animation and study mode

Use a fixed camera with slow cloud movement, sparse bird motion, gentle rain pixels, occasional leaf movement, a slow spikeball game in daylight, rare star twinkles, and does that mostly graze and only occasionally wander at night. Hover outlines and controls appear only during interaction. Proposed default: hide the menu bars and buttons after five seconds without pointer or keyboard activity when nothing is selected; reveal them on pointer movement or keyboard focus. Keep the scene and sound playing. Never hide controls while someone is adjusting them. Respect reduced-motion preferences.

### Suggested implementation

Use React and TypeScript for application state and accessible controls, plus the Web Audio API for playback and mixing. This is a proposed stack, not a required dependency choice. The MVP needs no backend.

Keep the base scene separate from transparent element sprites and animation layers. The Campanile tower is a removable element sprite, just like the cloud and bird; do not bake it into the backdrop. Store each element's presence, mute flag, volume, and fixed position. Keep audio nodes separate from render state so rerenders cannot start duplicate loops. Use matching sprite masks for silhouette outlines and accurate hit areas.

Proposed art starting point: a 320 × 180 logical scene with 16 × 16 tiles and integer nearest-neighbor scaling. Confirm this with a small art test before drawing the full scene. Use the same pixel grid for backdrop, sprites, and outlines; render interface controls large enough to use on a desktop or TV.

## 7. Delivery checklist

### Build order

1. Assemble the scene and inventory.
2. Implement sprite presence and hover controls.
3. Add periodic sound confirmation, mixing, mute, and cleanup.
4. Add day/sunset/night and subtle animation.
5. Add fullscreen, idle hiding, and keyboard/touch behavior.

### MVP acceptance checks

- Add rain: its cloud appears, the sky turns overcast, and the rain loop starts. Mute: cloud and rain remain visible, audio stops. Remove: both disappear.
- Hover a sprite and move onto its bar: outline is clear and controls remain usable. Clicking empty space closes them.
- Change master volume: relative element levels stay proportional. Switch the time of day: audio does not restart or change.
- Remove and re-add repeatedly: no duplicate loops or leaked timers. Removing the Campanile removes its tower sprite and stops its sound and timers. Adding it plays one confirmation chime; enabled bells then fire once per hour.
- Use fullscreen and study for an hour: motion stays calm, loops have no obvious seams, and controls work with keyboard and touch.

## 8. Interface references

These references establish the menu tiles, corner controls, hover outlines, and bars. Their detailed scenery is not the target pixel granularity.

**Figure 1 — Nighttime Glade.** Carry forward: bottom-left day/night tiles, bottom-center inventory, bottom-right master volume and fullscreen tiles, clear silhouette outline, and anchored adjustment bar. Use its lawn-level framing as inspiration; refine landmark geometry against Figure 5.

**Figure 2 — Rainy café.** Carry forward: physical object interaction, especially the outlined espresso machine and nearby bar. The café is a future scene; preserve the shared control layout when adding it.

## 9. Scene references

**Figure 3 — Berkeley Marina.** Carry forward: shared menu layout and a visible muted element. Muting the seagull retains its sprite. Marina is a future scene, not part of the first build.

**Figure 4 — Open Glade composition.** Carry forward: quiet open lawn, room for sprites, and framing toward Doe. Correct the Campanile from the right to the left, replace the generic library facade, and simplify backdrop detail.

## 10. Doe and Campanile reference

**Figure 5 — Corrected Doe composition.** Use the long facade and Campanile behind it on the left as the architecture direction. Reduce grass, masonry, and foliage detail further for the tile-like world. Retain the earlier suite's outlined inventory and corner tiles rather than adopting every UI variation here.
