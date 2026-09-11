# VEER 5 — Open-World City Sandbox 🌆

A **playable 3D open-world city sandbox game** starring **Veer** as the only main character.
Completely **free-roam** — no fixed story or campaign. Spawn as Veer and do anything:
explore the city, use super abilities, drive cars/SUVs/bikes/trucks/buses, fight thugs,
dodge the cops, race on the circuit, hit stunt ramps, run parkour, collect orbs and
find hidden spots.

Built with [Three.js](https://threejs.org/) — 100% original city and procedural assets,
no downloads needed besides the Three.js CDN.

## ▶ Play

The game needs to be served over HTTP (ES modules don't work on `file://`):

```bash
cd Veer5
python3 -m http.server 8000
# then open http://localhost:8000
```

Or with Node: `npx serve .` — any static server works.
> The served game loads Three.js from the local `js/vendor/` folder first
> (fully offline), with CDN mirrors as fallback.

## 📦 Offline masterfile (single file, no server, no internet)

**`Veer5-offline.html`** is the whole game in ONE file (~1.4 MB): engine + city +
code + styles, zero network requests. Copy it to any PC/phone and double-click
to play — no server, no internet needed.

Regenerate it after any code change with:

```bash
npm run build-offline
```

Low-end device? Pick **LOW** graphics on the title screen (auto-selected on mobile).

## 📷 Veer's photo (his real face in-game)

Veer is styled after his photo — face, warm skin tone, black-and-white hero outfit
and cat-ear headband. You can also put his **exact real face** on the character:

1. Start the game → title screen (or pause menu) → **📷 VEER'S PHOTO**
2. Pick any clear front-facing photo of Veer — it's instantly mapped onto the
   3D character's face (and the title-screen portrait).

Or bundle it with the game: save the photo as `assets/veer-face.jpg` — the game
auto-loads it at boot if present.

## 🎮 Controls

### PC (keyboard + mouse)
| Action | Key |
|---|---|
| Move / Sprint | WASD + SHIFT |
| Camera | Mouse (click game to lock) |
| Jump / **Super Jump** (mid-air) | SPACE, SPACE again |
| Melee attack | F or Left-click |
| **Dash** | Q |
| **Energy blast** | R or Right-click |
| **Shield** | C |
| Enter / exit vehicle | E |
| Drive | W/S gas & brake, A/D steer, SPACE handbrake |
| Headlights / Reset car / Quit race | L / T / X |
| Time trial (at track, in car) | T |
| Camera view / Pause / Mute | 📷 button / P / M |

### Gamepad
Left stick move · Right stick camera · A jump · X melee · B dash · RB blast ·
LB shield · Y enter/exit · RT/LT drive · Start pause.

### Mobile (touch)
Left virtual joystick to move (push full-tilt to sprint) · drag right side of
screen for camera · on-screen buttons: **JUMP, PUNCH, DASH, BLAST, SHIELD, ENTER** —
in vehicles: **GAS, BRK, ◀ ▶, HB (handbrake), EXIT**.

## 🌆 What's in the game

- **Open city**: 7×7 blocks, ~170 buildings with lit windows at night, traffic
  lights, street lamps, park, beach, docks, lighthouse, forest shrine
- **Third-person** walking, sprinting, jumping
- **Vehicles**: sedans, SUVs, muscle cars, taxis, **motorcycles, trucks, buses**,
  police cruisers, race cars — parked, in traffic, or steal a cop car (wanted!)
- **Traffic AI** + wandering **pedestrians** (they flee danger)
- **Thugs** in the Badlands + **police & 5-star wanted system** (chasers, foot
  cops, tasers, bust meter, cooldown escape)
- **Day/night cycle** + **weather** (clear / cloudy / rain / fog)
- **Health & energy** systems, fall damage, respawns
- **Abilities with cooldowns**: super jump, dash (i-frames), melee combo,
  energy blast (AOE), 6s shield bubble
- **Race track** with laps, checkpoints, timer, positions + **3 AI rivals**,
  **street races**, **time trials** (best saved), **7 stunt ramps** with air-time
  scoring, **parkour course** with rings + timer, **target range** challenge,
  **60+ collectible orbs**, **5 hidden locations**
- HUD: health/energy, wanted stars, cash, score, live **minimap**, clock,
  speedometer, ability cooldowns, race panel
- **Low / Medium / High** graphics settings, procedural sound + engine + sirens

## 🗂 Project layout

```
index.html        game shell + HUD/menus + Three.js CDN boot loader
css/style.css     all UI styling (HUD, menus, touch controls)
js/main.js        boot, settings, game loop, pause / busted / wasted flow
js/world.js       city, collisions, sky/day-night/weather, track, venues
js/character.js   Veer model + photo face, controller, abilities, camera
js/vehicles.js    vehicle models, driving, traffic AI, police, race AI
js/peds.js        pedestrians, thugs, cops, wanted system
js/activities.js  races, parkour, target range, orbs, hidden spots
js/ui.js          HUD, minimap, menus, touch buttons
js/input.js       keyboard / mouse / touch / gamepad
js/audio.js       procedural WebAudio SFX, engine, siren
assets/           optional bundled veer-face.jpg (see above)
```

## ✅ Syntax check

```bash
npm run check
```
