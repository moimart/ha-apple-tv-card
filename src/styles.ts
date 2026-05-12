/** Card styles — Apple-TV-inspired, compact, theme-aware. */

import { css } from "lit";

export const cardStyles = css`
  :host {
    display: block;
  }

  .remote {
    --bezel: 18px;
    --button-bg: var(--secondary-background-color, #2c2c2e);
    --button-fg: var(--primary-text-color, #f2f2f7);
    --accent: var(--primary-color, #0a84ff);
    --siri: linear-gradient(135deg, #ff375f, #5e5ce6);

    background: linear-gradient(
      155deg,
      var(--card-background-color, #1c1c1e) 0%,
      var(--ha-card-background, #2c2c2e) 100%
    );
    border-radius: var(--ha-card-border-radius, 16px);
    padding: 18px 16px 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 340px;
    margin: 0 auto;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      0 2px 12px rgba(0, 0, 0, 0.18);
  }

  .title {
    color: var(--primary-text-color);
    font-size: 0.8em;
    text-align: center;
    opacity: 0.65;
    margin-bottom: -4px;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  button.btn {
    appearance: none;
    border: none;
    background: var(--button-bg);
    color: var(--button-fg);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.08s ease, background 0.15s ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  button.btn:hover {
    background: color-mix(in srgb, var(--button-bg) 90%, white 10%);
  }
  button.btn:active {
    transform: scale(0.92);
    background: color-mix(in srgb, var(--button-bg) 80%, var(--accent) 20%);
  }
  button.btn svg {
    width: 22px;
    height: 22px;
  }
  button.btn.siri {
    background: var(--siri);
    color: white;
  }
  button.btn.wake {
    color: #30d158;
  }
  button.btn.off {
    color: #ff453a;
    transform: rotate(180deg);
  }

  /* Click pad */
  .pad {
    position: relative;
    width: 200px;
    height: 200px;
    margin: 4px auto 0;
    border-radius: 50%;
    background:
      radial-gradient(
        circle at 50% 38%,
        color-mix(in srgb, var(--button-bg) 60%, white 4%) 0%,
        var(--button-bg) 60%
      );
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -1px 0 rgba(0, 0, 0, 0.4),
      0 2px 6px rgba(0, 0, 0, 0.25);
    cursor: pointer;
    touch-action: none;
    overflow: hidden;
  }
  .pad .arrow {
    position: absolute;
    color: var(--button-fg);
    opacity: 0.7;
    pointer-events: none;
    font-size: 20px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pad .arrow.up    { top: 8px;    left: 50%; transform: translateX(-50%); }
  .pad .arrow.down  { bottom: 8px; left: 50%; transform: translateX(-50%); }
  .pad .arrow.left  { left: 8px;   top: 50%;  transform: translateY(-50%); }
  .pad .arrow.right { right: 8px;  top: 50%;  transform: translateY(-50%); }

  .pad .center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--button-bg) 70%, black 8%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    pointer-events: none;
  }

  .pad.flash-up    { box-shadow: inset 0 18px 32px -16px var(--accent); }
  .pad.flash-down  { box-shadow: inset 0 -18px 32px -16px var(--accent); }
  .pad.flash-left  { box-shadow: inset 18px 0 32px -16px var(--accent); }
  .pad.flash-right { box-shadow: inset -18px 0 32px -16px var(--accent); }

  button.btn.held {
    background: color-mix(in srgb, var(--button-bg) 70%, var(--accent) 30%);
    transform: scale(0.94);
  }
`;
