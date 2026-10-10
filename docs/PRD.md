# CalScape product requirements document

## 1. Objective

Music is too distracting to study with. I want CalScape to play on the TV as a calm background and ambient sound while I study. Keep this purpose central to every design and implementation decision: the scene, sounds, and controls should support sustained concentration.

## 2. Core product requirements

- Each sound belongs to a visible element. Add creates its visual and sound; mute keeps the visual; remove stops the sound and removes the added visual. There is no audio-only element mode.
- The world is the main interface. Use sprite inventory tiles and controls anchored to objects, rather than a list of sound sliders.
- Keep the screen calm and uncluttered. No separate sound indicators are needed; the mute button communicates audio state.

## 3. Scope

Everything in the first column is built; the second column lists what is not yet built. Screenshots of each scene and time of day, rain and the controls are in `docs/screenshots/` and shown in the README.

| Built | Not yet built |
| --- | --- |
| Three scenes: the Glade facing Doe, the Caffè Strada patio and the Berkeley Marina shore, switched from the top-right label | More scenes |
| Four elements per scene and time of day | Storm, creek, and more elements |
| Add/remove, mute, and individual volume controls | Free dragging, multiple copies, and advanced placement |
| Day/sunset/night visual switch; master volume; fullscreen | Automatic time transitions and Spotify integration |
| Confirmation for periodic sounds; subtle animation; idle control hiding | Accounts and saved presets |

## 4. Artistic direction

Use a smaller, tile-like world with obvious square pixels, a restrained palette, simple foliage, and broad areas of lawn and sky. Avoid photographic textures, dense grass detail, and a highly rendered illustration.

Everything stays on the pixel grid, including the sky and light. Sky gradients are drawn as solid colour steps on 2 × 2 pixel blocks, never smooth per-pixel blending or checkerboard dithering. Step edges wobble gently so bands read as natural rather than ruled, and they follow the light: at sunset they arc around the low sun, by day they tilt slightly toward it. Glows around the moon and street lamps are a few concentric stepped rings on the same block grid; stars have no halo, and the sun has a subtle stepped glow at midday and sunset.

Three times of day share one composition:

- **Day:** clear blue sky with the sun high on the right. Only a couple of Doe's windows are lit. People play spikeball, picnic, sit together, and read books (held open so the book reads clearly) on the open lawn.
- **Sunset:** a blended periwinkle-to-lavender-to-pink-to-peach sky, warmest around the low sun on the left, with more pink cloud streaks, lit from below, drifting noticeably faster than clouds at other times. The Glade has sunset activities: a picnic, a small guitar circle, a couple watching the sun go down, and someone lying in the grass.
- **Night:** dark sky, moon, frequently twinkling stars, nearly all of Doe's windows lit (about nine in ten, against three in ten at sunset), the two smaller buildings to its left only partly lit (under half their windows), and warm lamp glow in front of Doe. No people on the Glade; spotted does in warm brown tones rest there instead. They stand with heads up between short walks, sometimes lower their heads to graze, and each keeps its own unsynchronised rhythm.

**Rain** changes the weather, not just the foreground: while rain is present, the clear sky gives way to a low, softly billowed cloud deck in each time of day's own cloud colours (grey by day, dusky mauve at sunset, deep blue at night), still stepped on the 2 × 2 grid. The sun, moon, stars and their glows are hidden behind it, and a light tint dims the whole scene. Removing the rain brings the clear sky back.

Foreground trees frame the top corners. The left tree has a thick trunk rising diagonally, a sturdy branch where the bird perches in open sky, leaves hanging below and to the right of it, and a light crown, with no branch tapering thin. The left canopy keeps clear space around the Campanile's spire.

Face Doe from the Glade at lawn level. Doe must read as a long pale facade with tall repeated windows and a low roofline. Place the Campanile behind and to the left of Doe. Keep both landmarks recognizable when simplifying them.

### Caffè Strada

The patio of the real café at College Avenue and Bancroft Way at dusk, seen from among the tables. It is the Strada reference mockup brought down to 320 × 180 pixels, one colour per pixel with no smoothing or dithering, so every person, chair, bulb and railing stays crisp; it is stored as palette colour codes (`src/scene/strada/art.ts`). On the left, the sunset shows through the café's stucco arch, behind a plum trunk and a long hedge, with a tall patio heater in front whose conical cap is shaded light to dark and outlined so it stands out from the stonework. Overhead, plum branches and leaves frame a peach-and-lilac sky, with string lights strung across the gap; the strands carry on through the leaves on both sides, fainter where leaves cover them. A white railing runs across the middle, with a smaller heater and a street lamp with a Cal navy (#003262) banner carrying the Cal script logo (a looping capital C, a small a, and a tall l whose tail sweeps back under the whole word, with a clear row between the letters and the swash) in California Gold (#FDB515) behind it; beyond it is the campus plaza with its trees, lanterns and lit windows. The big plum's twisting trunk rises from the paving right of centre, and white railings with ball-topped posts frame the front right, ending in a low shrub. The nearest railing slopes down slightly toward the right rather than running perfectly level, over a row of turned balusters spaced a little wider as they come closer. Every table and chair reads as its own object: each sits on a soft contact shadow, tabletops have a lit top edge and a dark underside, chairs have a dark rim on their shaded side, and the far railing behind them is slightly hazier and cooler. A woman sits over coffee at the left table and more patrons sit along the far railing. The man in a hoodie typing alone at the centre table has the only laptop on the patio, drawn side-on with its lid tilted toward him and its screen lighting the inside of the lid. While he is there after dark, the screen face is the brightest cool light on the patio and casts a stepped glow back over his hands and face, softer at sunset; the couple at the table behind the right-hand railing lean in and talk across the table.

The open sky has a single colour per five-row band at every time of day, twenty bands from top to horizon. The colours change evenly from band to band and run uniformly right across the picture, with no patches or blocks, so it reads as one smooth blend while staying stepped pixels without dithering. At sunset each band is the mockup's average colour for those rows, smoothed. Only the sun's window in the arch keeps its own glow. Nothing stands against the sky above the right-hand trees: the far violet building in the mockup is left out, so the crowns meet open sky. Day and night are the same picture with their own palettes. By day the sky runs from deep blue at the top to pale blue at the horizon, the scene loses its warm cast and the bulbs, lanterns and lamp go dark. At night the sky turns navy with stars, the rest dims to blue, and the lamp, bulbs, lanterns, windows and heater burners stay lit with stepped halos. Rain brings the same overcast deck as the Glade over the open sky, in this scene's colours. Its rain clouds are strewn unevenly rather than grouped in the middle. One runs off the left edge behind the arch, and others peek between the crowns at different heights. Each is partly hidden behind leaves, branches or the loggia, the way real clouds show through gaps in a canopy.

The couple are the café chatter and the man at the centre table is the laptop typing. They appear only while their element plays: when it stops they disappear, leaving a bare table behind the right-hand railing, or empty chairs at the centre table (his laptop goes with him). While playing they move a pixel at a time, and hovering outlines them. The man moves only while keys are actually heard. Only his forearms and hands move, never his upper arm: fingers lift and press, the far hand alternates with the near one, and his forearm slides a pixel along the keys. The couple take turns talking: the talker's head bobs in short phrases and sometimes leans in, while the listener stays still, nods or leans in. Who talks changes every few seconds.

The scene keeps a little motion going at all times, all of it scenery without sound:

- Thin clouds drift across the open sky between the crowns (except in rain).
- Every 7–16 seconds (more often in rain), a gust breaks over the plum crowns as a scatter of puffs over 1.5–4 seconds, never as a uniform sweep. Each puff stirs its own uneven patch of leaves at a random spot in either crown. The leaves inside it shove a pixel the way it blows and flicker back, and the crown's edges toss against the sky. Each puff drifts loosely from top left toward bottom right, varying widely in angle, then dies away. Strong puffs tear off a leaf that tumbles down with them. Between gusts, an occasional single puff stirs one branch.
- Now and then a cyclist rides across the plaza.
- The Cal banner, 15 × 17 pixels with a 12 × 9 logo whose swash is a single pixel thick, hangs between two thin bracket arms on the lamp post, with gold stripes near the top and bottom and no dark outline: the fabric's edges are plain navy, with a slightly lighter left edge. It sways in the wind by bellying out downwind: the middle rows bow up to about 2 pixels toward the right while the rows at the brackets stay put. A light breeze nudges the middle a pixel now and then between gusts. In a gust it billows further, a flutter runs down the cloth, and soft folds run across it in the wind's direction: a lit crest followed by a shaded trough. It settles back over a second or two once the gust passes. It keeps its navy and California Gold at every time of day, only darker at night.
- The other patrons drawn into the picture move their heads a pixel at a time, each on their own rhythm. The woman at the left table reads, looking down for long stretches and glancing up or aside. The man in teal at the back talks with short nods and leans. The two patrons beyond the trunk mostly sit still, with an occasional nod or glance.

### Berkeley Marina

The grassy shore beside the Berkeley Marina pier, looking west across the bay. Nature leads and the boardwalk stays secondary: open grass with wildflowers, a curving path, reeds, riprap rocks along the water, and open sky above with no tree framing the corner. The pier runs out on the left with a few people fishing; their rods twitch now and then and their lines hang down to the water. San Francisco's skyline, Alcatraz and the Golden Gate Bridge are visible in the distance. At sunset the sun sets between the bridge towers; at night the bridge and city lights glow and the moon lays a path on the water. Small sailboats ride on the bay except at night, each swaying slowly back and forth and bobbing a pixel on the swell.

## 5. Interface requirements

| Region | Required behavior |
| --- | --- |
| Bottom left | Sun, sunset and moon tiles switch between day, sunset and night. At night the Glade has deer instead of people. Preserve all audio settings and playback. |
| Bottom center | Pixel inventory with one tile per element sprite, and no separate add tile. Each time of day offers its own four elements (see below). Select an absent element to add it at a predefined scene position. Mark present elements without duplicating them. |
| Bottom right | Master volume control as pixel volume blocks, with an adjacent fullscreen tile. Retain smooth gain internally. |
| Scene objects | Hover gives the physical sprite a clear outline and shows its anchored volume adjustment bar. Bars are nudged to stay fully inside the visible scene. |
| Top corners | Small CalScape label with a pixel bear on the left. On the right, three scene icons with no scene name (a pine for the Glade, a coffee cup for Caffè Strada, a sailboat for the Marina); the current scene's icon is in full colour and the others are dimmed. Clicking an icon switches scenes. The icons are about the height of the CalScape text, so the two labels are the same height. A clock can be added later if useful. |

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
- Every sound is ambient background, in level and in pattern. Defaults are low and balanced so no single element pulls focus: beds (rain, breeze, crickets) are soft and even, and animals call rarely and quietly.
- Each scene offers four elements per time of day, suited to that time. One element changes between day, sunset and night; it is always the third slot:

  | Scene | Day | Sunset | Night |
  | --- | --- | --- | --- |
  | Glade | Rain, Campanile bell, songbird, squirrel | Rain, Campanile bell, mourning dove, breeze | Rain, Campanile bell, owl, crickets |
  | Caffè Strada | Rain, café chatter, house sparrow, laptop typing | Rain, café chatter, crow, laptop typing | Rain, café chatter, crickets, laptop typing |
  | Berkeley Marina | Waves, foghorn, western gull, sea lions | Waves, foghorn, Canada geese, sea lions | Waves, foghorn, night heron, sea lions |

- Each scene keeps its own elements, mute and volume. Switching scenes fades out the old scene's sounds and starts the new scene's; an element both scenes share (rain, crickets) keeps playing without restarting if it is present in both.

  Adding an animal (songbird, squirrel, dove or owl) plays its call straight away as confirmation, then it calls every so often.

  An element added at one time of day keeps its place, mute and volume when the time changes. If the new time doesn't offer it, its sound fades out and its sprite hides; both come back when you switch back.
- Rain loops beneath the cloud.
- Songbird (Glade, day): one scrub jay perches on the low left branch, but the sound is many birds singing in the trees around the Glade, kept in the background. Every so often a chorus of six to eleven songs plays, loosely overlapping, from about six birds, each with its own voice and song (a wandering warble, a quick even trill, or clear slurred "fee-bee" whistles) and its own place in the stereo field. Most are distant: quieter, softened and with more reverb. The perched bird is the nearest singer and sings once in each chorus, opening its beak as it does.
- Café chatter (Strada): an ambient murmur from the couple at the table behind the right-hand railing, who take turns talking. It is a 90-second loop layering three stretches of one real café recording, so voices blur into a crowd rather than single conversations. Sharp high-frequency spikes (recorded clinks and close consonants) are pulled down toward the running level, and the top end is rolled off above about 7 kHz. Faint cup clinks sink into it every 4–13 seconds, mostly a spoon tapping a rim, now and then a stir or a cup set on its saucer. They are quiet and muffled, mostly from tables further off, and never stand out from the murmur.
- Laptop typing (Strada): an ambient bed of several keyboards across the patio. The man working on his laptop at the centre table types loudest. Five more keyboards at other tables are each panned to their own spot, slightly higher or lower in pitch, quieter and more muffled with distance. Every keyboard plays in bursts cut from random stretches of the recording, with pauses of every length between them, so the bed never sounds even or mechanical. The others start within a few seconds, so several are always going. At the default four bars it is as loud as seven bars of the previous level.
- House sparrow (Strada, day): three sparrows hop between spots on the front railing, never two on one spot, and chirp in turn.
- Crow (Strada, sunset): two crows, one on the bannered street lamp and one on a plum limb against the sky, caw in turn now and then, standing in for Berkeley's evening crow flights.
- Crickets (Strada, night): a cricket on the shrub at the end of the front railing, the same periodic chorus as the Glade.
- Waves (Marina): a loop of real surf, waves breaking and washing back every ten seconds or so; its sprite is the foam riding up and slipping back along the shore.
- Foghorn (Marina): a distant diaphone from the bay's own East Brother lighthouse every one to two minutes; its sprite is a ferry in front of a low fog bank under the Marin Headlands. The fog stays low and thin so the ferry, the bridge's north end and Mount Tamalpais remain clear, and the ferry drifts slowly back and forth. After dark its windows are lit.
- Western gull (Marina, day), Canada geese (sunset) and black-crowned night heron (night): two gulls stand on the pilings and two more wheel over the bay, the geese graze on the grass, and the heron stands alone on the tallest piling. Gulls call often, a few at a time from different birds; the geese and heron call every so often. The geese honk clearly over the surf, never buried under it.
- Sea lions (Marina): sea lions hauled out on a float break into runs of short, honking barks like the Pier 39 colony, several voices barking over each other, the one propped up lifting its head. Use a clean recording; no crowd, wind or engine noise under the barks.
- Groups sound like groups: gulls, geese, sea lions, sparrows and crows call in bursts of a few calls from several individuals, each with its own pitch, loudness and stereo position, spread out and sometimes overlapping. The Glade's songbird is heard as a background chorus of many birds (above). Lone animals (the squirrel, dove, owl and heron) and the foghorn call singly.
- The Strada and Marina sounds are real recordings, credited in the README, apart from the café's extra cup clinks. Those are synthesised from the ringing partials of a china cup and saucer. They have no synthesised stand-in and stay silent if a file fails to load. Looped recordings carry a short copy of their own end before the start and of their start after the end, and loop between those points, so encoder padding never lands on the loop point.
- Squirrel (day): a fox squirrel on the songbird's branch flicks its tail and chitters now and then, with a rustle of leaves.
- Mourning dove (sunset): a dove the songbird's size, on the same branch, lowers its head and puffs its breast as it gives a soft "oo-WOO-oo... oo... oo" every so often. The call is a real recording, `src/audio/sounds/dove.mp3`: one perch-coo from xeno-canto XC128006 (CC BY-SA 3.0, credited in the README). The background noise is removed entirely: only the coo's own pitch and harmonics are kept, so the gaps between notes are silent. A synthesised coo plays if it fails to load.
- Breeze (sunset): low, even wind with only gentle swells. There is no sprite in the sky; the breeze is the trees themselves. Its target and outline are the left tree, and its tile is a tree with wind lines. While present, the canopies and the perched bird rock by a pixel, and leaves fall more often and drift sideways. 
- Crickets (night): a tiny cricket on the lawn beside the path lifts its wings now and then. The sound is periodic, like real field crickets: a few nearby crickets each chirp on a steady beat (three or four quick pulses every half-second to a second, now and then pausing for a few beats), over fainter distant crickets on their own steady beats and a hush of tree-cricket trill.
- Owl (night): a small great horned owl on the bird's branch blinks, and puffs its white throat as it gives a soft, distant "hoo, hoo-hoo, hoo, hoo" every so often. The call is a real recording, `src/audio/sounds/owl.mp3`: one territorial hoot near 315 Hz from xeno-canto XC450919 (CC BY-SA 4.0, credited in the README), cleaned the same way as the dove so only the hoots remain. A synthesised hoot, about two seconds long, plays if it fails to load.
- Owl, dove and bell calls use recordings in `src/audio/sounds` (`owl.mp3`, `dove.mp3`, `campanile.mp3`), imported by the audio engine, and fall back to a synthesised call if one fails to load. Recordings must be licensed for reuse.
- Campanile rings at the top of each hour on the user's local clock, striking the hour on a 12-hour clock (once at 1 PM, twice at 2 AM, twelve times at noon and midnight). The sound is a single isolated strike of the Great Bear Bell. This is app timing, not a promise to reproduce the campus bell schedule.
- Each element's volume has eight levels and starts at the middle one (four bars), half its full gain, so it can be turned up to twice its starting level or well down. Each element's full gain is tuned so that four bars is a comfortable ambient level for that sound: the songbirds, rain and the squirrel sit low, the Campanile, breeze and geese a little higher, and the sea lions in between. Master volume multiplies each element gain, preserving the mix. Final gain = master volume × element volume × mute state. Muting does not erase volume; increasing volume does not automatically unmute.
- Use short fades on gain changes and stops to avoid clicks. Use seamless loops and modest default levels. Switching the time of day leaves elements offered at both times playing untouched; only elements the new time doesn't offer fade out.

### Animation and study mode

Use a fixed camera with slow cloud movement, sparse bird motion, gentle rain pixels, occasional leaf movement, a slow spikeball game in daylight, rare star twinkles, and does that mostly graze and only occasionally wander at night. Hover outlines and controls appear only during interaction. The menu bars and buttons hide after five seconds without pointer or keyboard activity when nothing is selected; reveal them on pointer movement or keyboard focus. Keep the scene and sound playing. Never hide controls while someone is adjusting them. Respect reduced-motion preferences.

### Implementation

Use React and TypeScript for application state and accessible controls, plus the Web Audio API for playback and mixing. The app needs no backend.

Keep the base scene separate from transparent element sprites and animation layers. The Campanile tower is a removable element sprite, just like the cloud and bird; do not bake it into the backdrop. Store each element's presence, mute flag, volume, and fixed position. Keep audio nodes separate from render state so rerenders cannot start duplicate loops. Use matching sprite masks for silhouette outlines and accurate hit areas.

The scene is a 320 × 180 logical canvas with 16 × 16 tiles, scaled with nearest-neighbour sampling. Use the same pixel grid for backdrop, sprites, and outlines; render interface controls large enough to use on a desktop or TV.

## 7. Delivery checklist

### Build order

1. Assemble the scene and inventory.
2. Implement sprite presence and hover controls.
3. Add periodic sound confirmation, mixing, mute, and cleanup.
4. Add day/sunset/night and subtle animation.
5. Add fullscreen, idle hiding, and keyboard/touch behavior.

### Acceptance checks

- Add rain: its cloud appears, the sky turns overcast, and the rain loop starts. Mute: cloud and rain remain visible, audio stops. Remove: both disappear.
- Hover a sprite and move onto its bar: outline is clear and controls remain usable. Clicking empty space closes them.
- Change master volume: relative element levels stay proportional. Switch the time of day: elements offered at both times keep playing without restarting.
- Switch away from a time that offers an element and back: its sound fades out and returns, with no duplicate loops.
- Switch scenes: the old scene's sounds fade out and its controls close; switching back finds its elements, mute and volume as they were. Rain present in both scenes keeps playing without restarting.
- Remove and re-add repeatedly: no duplicate loops or leaked timers. Removing the Campanile removes its tower sprite and stops its sound and timers. Adding it plays one confirmation chime; enabled bells then fire once per hour.
- Use fullscreen and study for an hour: motion stays calm, loops have no obvious seams, and controls work with keyboard and touch.
