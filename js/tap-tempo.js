const MAX_TAPS = 8;
const RESET_GAP_MS = 2000;

/**
 * Tap tempo detector — average interval from recent taps.
 */
export class TapTempo {
  #taps = [];
  #onBpm = null;

  constructor(onBpm) {
    this.#onBpm = onBpm;
  }

  reset() {
    this.#taps = [];
  }

  tap() {
    const now = performance.now();

    if (
      this.#taps.length > 0 &&
      now - this.#taps[this.#taps.length - 1] > RESET_GAP_MS
    ) {
      this.#taps = [];
    }

    this.#taps.push(now);

    if (this.#taps.length > MAX_TAPS) {
      this.#taps.shift();
    }

    if (this.#taps.length < 2) {
      return null;
    }

    let totalInterval = 0;
    for (let i = 1; i < this.#taps.length; i++) {
      totalInterval += this.#taps[i] - this.#taps[i - 1];
    }

    const avgInterval = totalInterval / (this.#taps.length - 1);
    const bpm = Math.round(60000 / avgInterval);
    const clamped = Math.min(400, Math.max(20, bpm));

    this.#onBpm?.(clamped);
    return clamped;
  }
}
