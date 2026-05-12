# Apple TV Remote Card — Home Assistant Lovelace card

A compact, Apple-TV-Siri-Remote-inspired Lovelace card. Click-pad swipes,
volume rocker, keyboard input — all wired to your Apple TV through HA's
native `apple_tv` integration.

Inspired by — not a clone of — Apple's Siri Remote design. The card targets
look-and-feel parity rather than pixel-perfect replication.

If you want individual `button.*` entities for automations, see the
companion integration repo:
[`ha-apple-tv-remote`](https://github.com/moimart/ha-apple-tv-remote).

## Features

- **Tap the click pad center** → Select
- **Drag in any direction on the click pad** → simulated swipe (4 sequential
  directional presses spaced 60 ms apart)
- **Keyboard button** → opens a text-input overlay; pressing Enter sends the
  text to the Apple TV via `remote.send_command`
- **Home / Back / Siri / Play-Pause / Volume +/- / Power**
- **Multi-device** — each card targets one Apple TV; drop several cards for
  multiple Apple TVs
- **Grid-friendly** — fixed compact width, fits any reasonable dashboard column

## Requirements

- Home Assistant Core ≥ 2024.1
- The native `apple_tv` integration paired with the Apple TV(s) you want
  to drive

## Install via HACS

1. HACS → ⋮ → **Custom repositories** → URL: `https://github.com/moimart/ha-apple-tv-card`,
   Type: **Lovelace** → **Add**.
2. Click the new card → **Download** → pick the latest tag.
3. (HACS auto-registers the resource. If it doesn't:
   **Settings → Dashboards → ⋮ → Resources** → add
   `/hacsfiles/ha-apple-tv-card/apple-tv-remote-card.js` as **JavaScript module**.)
4. In a dashboard, **Edit → + Add Card → Custom: Apple TV Remote**.

## YAML config

```yaml
type: custom:apple-tv-remote-card
remote: remote.atv_living_room        # required
media_player: media_player.atv_living_room   # optional, future use
title: Living Room TV                  # optional
```

## Limitations

- **Swipes are simulated**, not native. The HA `apple_tv` integration's
  `remote.send_command` doesn't accept swipe-style payloads, so a swipe
  on this card is implemented as 4 quick directional presses. Works for
  scrolling lists in tvOS apps; not identical to a real Siri Remote's
  inertial scroll.
- **Keyboard input** depends on the focused Apple TV app accepting text
  via `remote.send_command`'s text mode (pyatv-backed). For apps that
  don't, the input is silently dropped — there's no error path.
- **Siri** button availability depends on the tvOS version and Apple TV
  generation. Some setups need an `apple_tv` integration in *Companion*
  protocol mode for it to work.

## Development

```bash
npm install
npm run build       # produces dist/apple-tv-remote-card.js
npm run dev         # rebuild on file changes
```

The bundled JS is committed under `dist/` so HACS can serve it without
a build step on the user's machine.

## License

MIT.
