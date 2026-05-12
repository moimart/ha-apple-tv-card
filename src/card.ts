/** Apple TV Remote Card.
 *
 * Renders an Apple-TV-Siri-Remote-inspired compact remote and forwards
 * button presses to HA's native `apple_tv` integration via
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
    "Compact Siri-Remote-inspired card. D-pad clicks on the circle, long-press the TV button for Control Centre.",
});

import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import { cardStyles } from "./styles";
import {
  iconBack,
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

type Direction = "up" | "down" | "left" | "right";

/** Fraction of the pad's radius that counts as the centre "select" zone. */
const CENTER_ZONE_FRACTION = 0.42;
/** Long-press dwell time on the TV button to fire Control Centre. */
const LONG_PRESS_MS = 500;

@customElement("apple-tv-remote-card")
export class AppleTvRemoteCard extends LitElement {
  static override styles = cardStyles;

  @property({ attribute: false }) hass?: HassLike;
  @state() private _config?: CardConfig;
  @state() private _flash?: Direction;
  @state() private _tvHeld = false;

  private _tvDownTimer?: number;
  private _tvLongPressFired = false;

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
            <button
              class=${classMap({ btn: true, held: this._tvHeld })}
              title="Home — long-press for Control Centre"
              @pointerdown=${this._onTvDown}
              @pointerup=${this._onTvUp}
              @pointercancel=${this._onTvCancel}
              @pointerleave=${this._onTvCancel}
            >
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
              [`flash-${this._flash ?? ""}`]: !!this._flash,
            })}
            @click=${this._onPadClick}
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
              title="Play / Pause"
              @click=${() => this._send("play_pause")}
            >
              ${iconPlayPause}
            </button>
            <button
              class="btn"
              title="Volume Up"
              @click=${() => this._send("volume_up")}
            >
              ${iconVolumeUp}
            </button>
          </div>
        </div>
      </ha-card>
    `;
  }

  /** ===== Click pad (D-pad behaviour, no swipes) ===== */

  private _onPadClick = (e: MouseEvent): void => {
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

    const direction: Direction =
      Math.abs(relX) > Math.abs(relY)
        ? relX > 0
          ? "right"
          : "left"
        : relY > 0
          ? "down"
          : "up";
    this._flash = direction;
    void this._send(direction);
    window.setTimeout(() => (this._flash = undefined), 180);
  };

  /** ===== TV button (short = home, long = control centre) ===== */

  private _onTvDown = (e: PointerEvent): void => {
    e.preventDefault();
    this._tvLongPressFired = false;
    this._tvHeld = true;
    this._tvDownTimer = window.setTimeout(() => {
      this._tvLongPressFired = true;
      this._tvDownTimer = undefined;
      void this._send("home_hold");
    }, LONG_PRESS_MS);
  };

  private _onTvUp = (): void => {
    this._tvHeld = false;
    if (this._tvDownTimer !== undefined) {
      window.clearTimeout(this._tvDownTimer);
      this._tvDownTimer = undefined;
    }
    if (!this._tvLongPressFired) {
      void this._send("top_menu");
    }
  };

  private _onTvCancel = (): void => {
    this._tvHeld = false;
    if (this._tvDownTimer !== undefined) {
      window.clearTimeout(this._tvDownTimer);
      this._tvDownTimer = undefined;
    }
  };

  /** ===== Service-call helper ===== */

  private async _send(command: string): Promise<void> {
    if (!this.hass || !this._config) return;
    await this.hass.callService(
      "remote",
      "send_command",
      { command },
      { entity_id: this._config.remote }
    );
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
