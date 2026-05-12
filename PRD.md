# PRD — Apple TV Remote for Home Assistant

**Status:** v0.1 in progress · author: @moimart · last updated: 2026-05-12

## 1. Problem

Home Assistant ships an excellent `apple_tv` integration (built on
[`pyatv`](https://github.com/postlund/pyatv)) that exposes a `remote.*` and
`media_player.*` entity per Apple TV. But out of the box, controlling the
Apple TV from HA still requires either:

- Calling `remote.send_command` with a string argument (terrible for
  dashboards), or
- Writing scripts/automations per button (tedious for 12+ commands across
  multiple Apple TVs).

There's also no dashboard card that *looks* like an Apple TV remote, which is
the most intuitive UX for ad-hoc control from a phone or wall tablet.

## 2. Goals

- **G1** Ship a Lovelace card that visually resembles the modern Apple TV
  Siri Remote (2021+ aluminum redesign) — compact, fits in a dashboard grid,
  works on touch + click.
- **G2** Every button on the card invokes the right HA service for the
  selected target Apple TV; works against HA's native `apple_tv` integration
  with no companion code required.
- **G3** Support **swipe gestures** on the click pad — drag detection in the
  card simulates rapid sequential directional presses to mimic the real
  remote's scroll behaviour.
- **G4** Support **text input** for tvOS search/login fields via a small
  text overlay that calls the relevant Apple TV service per character.
- **G5** Ship a companion HA integration (`apple_tv_remote`) that exposes
  every remote command as a `button.*` entity, so users can wire individual
  button presses into automations without writing `remote.send_command`
  boilerplate.
- **G6** Multi-device: with seven Apple TVs in the target user's HA
  install, picking which one to drive must be a single dropdown in both the
  card config and the integration config flow.

## 3. Non-goals

- **NG1** Cloning Apple's design pixel-for-pixel. The card is "Siri Remote
  inspired" — same form factor and button placement, distinguishable
  styling. Avoids trademark grey zones for a public HACS repo.
- **NG2** Replacing HA's native `apple_tv` integration. We **build on top
  of it**, not next to it. Users must have the native integration paired
  first.
- **NG3** Real-time Now Playing on the card itself in v0.1. Optional later
  enhancement.
- **NG4** Pairing / setup flow for the Apple TV. HA does this already.
- **NG5** Force-fullscreen card layouts. Card must size cleanly inside any
  reasonable grid column.

## 4. Architecture overview

```
┌──────────────────────────────────────────────────────────────┐
│  HA dashboard                                                 │
│  ┌──────────────────┐    ┌─────────────────────────────────┐ │
│  │ apple-tv-remote- │    │ Any standard card                │ │
│  │ card (custom)    │    │ (button cards, scripts, …)      │ │
│  └─────────┬────────┘    └─────────┬───────────────────────┘ │
│            │ remote.send_command   │ button.press            │
│            ▼                       ▼                          │
│  ┌──────────────────┐    ┌─────────────────────────────────┐ │
│  │ HA core          │    │ apple_tv_remote integration      │ │
│  │ apple_tv         │◄───┤ (custom_components)              │ │
│  │ remote.*         │    │ Creates button.atv_home etc.     │ │
│  └──────────────────┘    └─────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Two artefacts, two repos, both HACS-installable:**

| Repo | Type | Purpose |
|---|---|---|
| `moimart/ha-apple-tv-remote` | Integration | Per-button `button.*` entities |
| `moimart/ha-apple-tv-card` | Lovelace | The visual remote card |

The card **does not depend on** the integration. Either can be installed
independently. The integration just produces button entities that are
addressable in automations; the card calls `remote.send_command` directly
on the native HA entity.

## 5. Functional requirements

### FR-1 — Card layout (compact, Siri-Remote-inspired)

```
┌─────────────────────────┐
│   📺          ⏻         │  Home (top_menu)        Power toggle
│                         │
│         ▲               │
│      ◀  ●  ▶            │  Click pad (drag = swipe)
│         ▼               │
│                         │
│    ↩         🎤         │  Back (menu)            Siri
│                         │
│         ▶❚❚             │  Play/Pause
│                         │
│    Vol −     Vol +      │  Volume rocker
└─────────────────────────┘
```

- Single column, ~280-340 px wide. Aspect ratio ~ 1 : 1.6 (taller than wide).
- Compact enough to share a 4-column grid row with other cards.
- All buttons reachable with a thumb on a phone in portrait.

### FR-2 — Click-pad swipe handling

- Pointer events (`pointerdown`/`pointermove`/`pointerup`) on the click-pad
  element.
- Tap (< 8 px movement, < 250 ms) → `select`.
- Drag (> 30 px movement in dominant axis) → simulate the swipe by sending
  3-5 sequential `up`/`down`/`left`/`right` presses spaced 60 ms apart.
- Pointer cancel / leave the pad area without releasing → no command sent.

### FR-3 — Text input mode

- A small "keyboard" icon button in the card opens an overlay with a single
  `<input>`.
- On each keystroke, send the typed text to the Apple TV via whichever
  pyatv-backed service HA exposes (currently `apple_tv.remote_command` with
  a `text` payload, or fall back to per-character `remote.send_command` if
  unavailable).
- Pressing Enter dismisses the overlay; Esc clears the input.

### FR-4 — Config schema (card)

YAML:

```yaml
type: custom:apple-tv-remote-card
remote: remote.atv_living_room       # required — which apple_tv to drive
media_player: media_player.atv_living_room   # optional — for power-state
title: Living Room TV                # optional
```

Card editor UI generates this YAML behind the scenes — drop-down of all
`remote.*` entities that come from the `apple_tv` integration.

### FR-5 — Integration entities

Per config entry, expose under one device:

| Entity | Calls |
|---|---|
| `button.<name>_home` | `remote.send_command` with `top_menu` |
| `button.<name>_back` | `menu` |
| `button.<name>_up` | `up` |
| `button.<name>_down` | `down` |
| `button.<name>_left` | `left` |
| `button.<name>_right` | `right` |
| `button.<name>_select` | `select` |
| `button.<name>_play_pause` | `play_pause` |
| `button.<name>_volume_up` | `volume_up` |
| `button.<name>_volume_down` | `volume_down` |
| `button.<name>_siri` | `siri` |
| `button.<name>_power_toggle` | `turn_on` if off else `turn_off` |

### FR-6 — Multi-device

- Integration: config flow shows dropdown filtered to `remote.*` entities
  whose source integration is `apple_tv`. User picks one, names the bundle.
  Repeat per Apple TV they want button entities for.
- Card: each card instance targets one `remote.*` entity. Place multiple
  cards in a dashboard for multiple Apple TVs.

## 6. Non-functional requirements

- **NFR-1** Card bundles to a single `.js` file ≤ 80 KB minified.
- **NFR-2** TypeScript strict mode. Lit for templating. No frameworks
  beyond `lit` + `custom-card-helpers`.
- **NFR-3** Card works on Chrome, Safari, Firefox (HA mobile companion app).
- **NFR-4** Integration requires HA core ≥ 2024.1 (any version since the
  `apple_tv` integration stabilised). Compatible with the user's 2026.5.
- **NFR-5** Both artefacts distributed via HACS custom repository.

## 7. Testing approach

- **Integration**: spawn a config entry against a real `remote.atv_*`,
  press each button entity, verify the Apple TV reacts.
- **Card**: install via HACS, drop into a dashboard, exercise every
  button + swipe gesture against a real Apple TV. Test on phone (touch)
  and desktop (mouse).
- **Swipe robustness**: tap-not-swipe should never accidentally trigger a
  direction press; long-press-and-release should not double-count.

## 8. Open questions

- **OQ-1** Does HA's `apple_tv` integration expose a `text` service or
  similar for FR-3? If not, fall back to per-character `remote.send_command`
  with the literal character as the command name (pyatv accepts this for
  some focused text fields). Confirm at first build.
- **OQ-2** Does the `siri` command actually invoke Siri across all tvOS
  versions, or is it model-dependent? Document the constraint in README.
- **OQ-3** Optional Now Playing strip on the card — should it show artwork
  + title, or just text? Deferred to v0.2 either way.

## 9. Risks

- **R-1 — Visual fidelity vs. trademark.** Mitigation: "inspired by" not
  "clone of". README explicitly notes this.
- **R-2 — Swipe gesture latency on slow devices.** Mitigation: use
  `requestAnimationFrame` for pointermove throttling; cap simulated press
  count at 5 to avoid runaway sequences.
- **R-3 — Card bundle bloat from Lit + helpers.** Mitigation: tree-shaking
  via Vite, target ES2022 (no polyfills), inline CSS.
- **R-4 — Multiple cards on one dashboard fighting for input focus.**
  Mitigation: each card instance has its own gesture state; pointer
  capture is scoped to the element.

## 10. Phases

| Phase | Scope | Effort |
|---|---|---|
| **v0.1** | All FR-1, FR-4, FR-5, FR-6. Buttons work. Basic swipes (FR-2). Skeleton text-input UI without backend send. | ~1.5 days |
| **v0.2** | FR-3 fully wired. Refined CSS (aluminum gradient, button-press microanimations). Card editor UI polished. | +1 day |
| **v0.3** | Now Playing strip (artwork + title from `media_player.*`). Long-press support. Theme variable hooks for custom skins. | +2 days |

## 11. Acceptance criteria for v0.1

1. Card installs via HACS custom repo, appears in card picker as "Apple TV Remote".
2. YAML config or editor UI selects one of the user's 7 Apple TVs; buttons drive that specific TV.
3. All 11 button-set commands work end-to-end (excludes Power Toggle since `media_player` is optional).
4. Click-pad swipe in any direction triggers ≥3 directional presses on the Apple TV.
5. Integration installs separately, creates 12 `button.*` entities per config entry, each functional in an automation.
6. Both repos pass HACS validation (correct `hacs.json`, tagged release).
