/** Apple TV Remote Card.
 *
 * Renders an Apple-TV-Siri-Remote-inspired compact remote and forwards
 * button presses / swipes to HA's native `apple_tv` integration via
 * `remote.send_command`. No dependency on the companion
 * `apple_tv_remote` custom integration — the card targets the
 * `remote.*` entity that HA's `apple_tv` integration exposes natively.
 */

/* ============================================================
 * Card-picker registration. Runs synchronously at module load so
 * the card always shows up in the dashboard "+ Add card" list, even
 * if anything later in the file throws.
 * ========================================================== */
const w = window as unknown as {
  customCards?: Array<{ type: string; name: string; description: string }>;
};
w.customCards = w.customCards ?? [];
w.customCards.push({
  type: "apple-tv-remote-card",
  name: "Apple TV Remote",
  description:
    "Compact Siri-Remote-inspired card with click-pad swipe and keyboard input.",
});

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
const TAP_MAX_DURATION_MS = 350;
const SWIPE_PRESS_COUNT = 4;
const SWIPE_PRESS_GAP_MS = 60;
/** Fraction of the pad's radius that counts as the centre "select" zone. */
const CENTER_ZONE_FRACTION = 0.42;

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
            <button
              class="btn wake"
              title="Wake"
              @click=${() => this._send("wakeup")}
            >
              ${iconPower}
            </button>
            <button
              class="btn off"
              title="Turn Off"
              @click=${() => this._send("turn_off")}
            >
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

    // 1) Long drag → swipe (multiple directional presses)
    if (movement > SWIPE_THRESHOLD_PX) {
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
      return;
    }

    // 2) Short tap → zone-based: centre = select, edge = single directional
    if (dt > TAP_MAX_DURATION_MS) return;

    const pad = e.currentTarget as HTMLElement;
    const rect = pad.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    const padRadius = rect.width / 2;
    const distFromCenter = Math.hypot(relX, relY);

    if (distFromCenter < padRadius * CENTER_ZONE_FRACTION) {
      void this._send("select");
      return;
    }

    const direction: SwipeDirection =
      Math.abs(relX) > Math.abs(relY)
        ? relX > 0
          ? "right"
          : "left"
        : relY > 0
          ? "down"
          : "up";
    this._swipeHint = direction;
    void this._send(direction);
    window.setTimeout(() => (this._swipeHint = undefined), 180);
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
    // pyatv routes text input via remote.send_command when the Apple TV's
    // active app accepts it. Some tvOS versions / apps don't — they
    // simply ignore the call. We surface a console warning so the
    // failure mode is discoverable in DevTools.
    try {
      await this.hass.callService(
        "remote",
        "send_command",
        { command: text },
        { entity_id: this._config.remote }
      );
    } catch (e) {
      console.warn(
        "[apple-tv-remote-card] text input failed (Apple TV / focused app may not accept text)",
        e
      );
    }
  }
}

/* ============================================================
 * Editor — uses HA's ha-form with selector schema so the user gets
 * proper entity dropdowns filtered to `apple_tv`-platform entities.
 * ========================================================== */
interface HaFormSchemaEntry {
  name: string;
  required?: boolean;
  selector: Record<string, unknown>;
}

const EDITOR_SCHEMA: ReadonlyArray<HaFormSchemaEntry> = [
  {
    name: "remote",
    required: true,
    selector: {
      entity: {
        filter: { domain: "remote", integration: "apple_tv" },
      },
    },
  },
  {
    name: "media_player",
    selector: {
      entity: {
        filter: { domain: "media_player", integration: "apple_tv" },
      },
    },
  },
  {
    name: "title",
    selector: { text: {} },
  },
];

const EDITOR_LABELS: Record<string, string> = {
  remote: "Apple TV remote entity",
  media_player: "Linked media player (optional)",
  title: "Card title (optional)",
};

@customElement("apple-tv-remote-card-editor")
export class AppleTvRemoteCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HassLike;
  @state() private _config?: CardConfig;

  setConfig(config: CardConfig): void {
    this._config = { ...config };
  }

  private _computeLabel = (schema: HaFormSchemaEntry): string =>
    EDITOR_LABELS[schema.name] ?? schema.name;

  override render(): TemplateResult {
    if (!this._config) return html``;
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${EDITOR_SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._onValueChanged}
      ></ha-form>
    `;
  }

  private _onValueChanged(e: CustomEvent<{ value: CardConfig }>): void {
    const next: CardConfig = {
      ...e.detail.value,
      type: "custom:apple-tv-remote-card",
    };
    // Strip empty optional fields so the saved YAML stays tidy.
    if (!next.media_player) delete next.media_player;
    if (!next.title) delete next.title;
    this._config = next;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: next },
        bubbles: true,
        composed: true,
      })
    );
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => window.setTimeout(r, ms));
