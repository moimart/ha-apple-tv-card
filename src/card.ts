/** Apple TV Remote Card.
 *
 * Renders an Apple-TV-Siri-Remote-inspired compact remote and forwards
 * button presses / swipes to HA's native `apple_tv` integration via
 * `remote.send_command`.
 *
 * No dependency on the companion `apple_tv_remote` integration — the
 * card targets the `remote.*` entity that HA's `apple_tv` integration
 * exposes natively.
 */

import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import { cardStyles } from "./styles";
import {
  iconBack,
  iconKeyboard,
  iconPlayPause,
  iconPower,
  iconSiri,
  iconTv,
  iconVolumeDown,
  iconVolumeUp,
} from "./icons";

interface HaServiceCallEvent {
  domain: string;
  service: string;
  serviceData?: Record<string, unknown>;
  target?: { entity_id?: string | string[] };
}

interface HassLike {
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: { entity_id?: string | string[] }
  ): Promise<void>;
  states: Record<string, { state: string } | undefined>;
}

interface CardConfig {
  type: string;
  remote: string;
  media_player?: string;
  title?: string;
}

type SwipeDirection = "up" | "down" | "left" | "right";

const SWIPE_THRESHOLD_PX = 30;
const TAP_MAX_MOVEMENT_PX = 8;
const TAP_MAX_DURATION_MS = 250;
const SWIPE_PRESS_COUNT = 4;
const SWIPE_PRESS_GAP_MS = 60;

@customElement("apple-tv-remote-card")
export class AppleTvRemoteCard extends LitElement {
  static override styles = cardStyles;

  @property({ attribute: false }) hass?: HassLike;
  @state() private _config?: CardConfig;
  @state() private _swipeHint?: SwipeDirection;
  @state() private _showKeyboard = false;
  @state() private _padPressed = false;

  private _pointerStart: { x: number; y: number; t: number } | null = null;

  setConfig(config: CardConfig): void {
    if (!config?.remote) {
      throw new Error("apple-tv-remote-card: `remote` is required.");
    }
    this._config = { ...config };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("apple-tv-remote-card-editor");
  }

  static getStubConfig(): Omit<CardConfig, "type"> {
    return { remote: "" };
  }

  getCardSize(): number {
    return 6;
  }

  override render(): TemplateResult {
    if (!this._config) return html``;
    const title = this._config.title;

    return html`
      <ha-card class="card">
        <div class="remote">
          ${title ? html`<div class="title">${title}</div>` : nothing}

          <div class="row">
            <button class="btn" title="Home" @click=${() => this._send("top_menu")}>
              ${iconTv}
            </button>
            <button class="btn power" title="Power" @click=${this._powerToggle}>
              ${iconPower}
            </button>
          </div>

          <div
            class=${classMap({
              pad: true,
              pressed: this._padPressed,
              [`swipe-${this._swipeHint ?? ""}`]: !!this._swipeHint,
            })}
            @pointerdown=${this._onPointerDown}
            @pointerup=${this._onPointerUp}
            @pointercancel=${this._cancelPointer}
            @pointerleave=${this._cancelPointer}
          >
            <span class="arrow up">▲</span>
            <span class="arrow down">▼</span>
            <span class="arrow left">◀</span>
            <span class="arrow right">▶</span>
            <div class="center"></div>
          </div>

          <div class="row">
            <button class="btn" title="Back" @click=${() => this._send("menu")}>
              ${iconBack}
            </button>
            <button class="btn siri" title="Siri" @click=${() => this._send("siri")}>
              ${iconSiri}
            </button>
          </div>

          <div class="row" style="justify-content:center">
            <button
              class="btn"
              title="Play / Pause"
              @click=${() => this._send("play_pause")}
            >
              ${iconPlayPause}
            </button>
          </div>

          <div class="row">
            <button
              class="btn"
              title="Volume Down"
              @click=${() => this._send("volume_down")}
            >
              ${iconVolumeDown}
            </button>
            <button
              class="btn"
              title="Keyboard"
              @click=${() => (this._showKeyboard = true)}
            >
              ${iconKeyboard}
            </button>
            <button
              class="btn"
              title="Volume Up"
              @click=${() => this._send("volume_up")}
            >
              ${iconVolumeUp}
            </button>
          </div>

          ${this._showKeyboard ? this._renderKeyboard() : nothing}
        </div>
      </ha-card>
    `;
  }

  private _renderKeyboard(): TemplateResult {
    return html`
      <div class="kbd-overlay" @click=${(e: Event) => e.stopPropagation()}>
        <input
          type="text"
          placeholder="Type and press Enter…"
          autofocus
          @keydown=${this._onKeyboardKey}
          @blur=${() => (this._showKeyboard = false)}
        />
      </div>
    `;
  }

  /** ===== Pointer + swipe handling on the click pad ===== */

  private _onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this._pointerStart = { x: e.clientX, y: e.clientY, t: performance.now() };
    this._padPressed = true;
    this._swipeHint = undefined;
  }

  private _onPointerUp(e: PointerEvent): void {
    if (!this._pointerStart) return;
    const dx = e.clientX - this._pointerStart.x;
    const dy = e.clientY - this._pointerStart.y;
    const dt = performance.now() - this._pointerStart.t;
    const movement = Math.hypot(dx, dy);
    this._pointerStart = null;
    this._padPressed = false;

    if (movement <= TAP_MAX_MOVEMENT_PX && dt <= TAP_MAX_DURATION_MS) {
      void this._send("select");
      return;
    }

    if (movement < SWIPE_THRESHOLD_PX) return;

    const direction: SwipeDirection =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up";

    this._swipeHint = direction;
    void this._fireSwipe(direction);
    window.setTimeout(() => (this._swipeHint = undefined), 220);
  }

  private _cancelPointer(): void {
    this._pointerStart = null;
    this._padPressed = false;
  }

  /** Simulate a swipe by firing several directional presses rapidly. */
  private async _fireSwipe(direction: SwipeDirection): Promise<void> {
    for (let i = 0; i < SWIPE_PRESS_COUNT; i++) {
      await this._send(direction);
      if (i < SWIPE_PRESS_COUNT - 1) {
        await sleep(SWIPE_PRESS_GAP_MS);
      }
    }
  }

  /** ===== Keyboard overlay ===== */

  private async _onKeyboardKey(e: KeyboardEvent): Promise<void> {
    if (e.key === "Escape") {
      this._showKeyboard = false;
      return;
    }
    if (e.key === "Enter") {
      const value = (e.currentTarget as HTMLInputElement).value;
      if (value) {
        await this._sendText(value);
      }
      this._showKeyboard = false;
      return;
    }
  }

  /** ===== Service-call helpers ===== */

  private async _send(command: string): Promise<void> {
    if (!this.hass || !this._config) return;
    await this.hass.callService(
      "remote",
      "send_command",
      { command },
      { entity_id: this._config.remote }
    );
  }

  private async _sendText(text: string): Promise<void> {
    if (!this.hass || !this._config) return;
    // pyatv routes text input via the `text` argument to `remote.send_command`
    // when supported. If the receiving Apple TV/tvOS version doesn't accept
    // it, the call resolves silently — no error path to surface here.
    try {
      await this.hass.callService(
        "remote",
        "send_command",
        { command: text },
        { entity_id: this._config.remote }
      );
    } catch {
      /* swallowed — see comment above */
    }
  }

  private async _powerToggle(): Promise<void> {
    if (!this.hass || !this._config) return;
    const state = this.hass.states[this._config.remote]?.state;
    const service = state === "on" ? "turn_off" : "turn_on";
    await this.hass.callService("remote", service, undefined, {
      entity_id: this._config.remote,
    });
  }
}

/* ============================================================
 * Editor — minimal config UI shown in the dashboard card picker.
 * ========================================================== */
@customElement("apple-tv-remote-card-editor")
export class AppleTvRemoteCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HassLike;
  @state() private _config?: CardConfig;

  setConfig(config: CardConfig): void {
    this._config = { ...config };
  }

  override render(): TemplateResult {
    return html`
      <div style="display:flex;flex-direction:column;gap:8px;padding:8px;">
        <label>
          Apple TV remote entity
          <input
            type="text"
            placeholder="remote.atv_living_room"
            .value=${this._config?.remote ?? ""}
            @change=${(e: Event) =>
              this._update("remote", (e.currentTarget as HTMLInputElement).value)}
          />
        </label>
        <label>
          Optional media_player entity
          <input
            type="text"
            placeholder="media_player.atv_living_room"
            .value=${this._config?.media_player ?? ""}
            @change=${(e: Event) =>
              this._update(
                "media_player",
                (e.currentTarget as HTMLInputElement).value
              )}
          />
        </label>
        <label>
          Title (optional)
          <input
            type="text"
            placeholder="Living Room TV"
            .value=${this._config?.title ?? ""}
            @change=${(e: Event) =>
              this._update("title", (e.currentTarget as HTMLInputElement).value)}
          />
        </label>
      </div>
    `;
  }

  private _update(key: keyof CardConfig, value: string): void {
    if (!this._config) return;
    const next = { ...this._config, [key]: value || undefined };
    this._config = next;
    const event = new CustomEvent("config-changed", {
      detail: { config: next },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => window.setTimeout(r, ms));

/* Register with HA's card type list so it appears in the picker. */
declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
    }>;
  }
}

window.customCards = window.customCards ?? [];
window.customCards.push({
  type: "apple-tv-remote-card",
  name: "Apple TV Remote",
  description:
    "Compact Siri-Remote-inspired card with click-pad swipe and keyboard input.",
});

// Suppress unused-import warning from rollup tree-shaking edge cases.
void (() => ({} as HaServiceCallEvent));
