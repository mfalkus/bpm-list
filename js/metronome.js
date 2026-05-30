/**
 * Web Audio metronome with immediate first-beat playback.
 * Uses lookahead scheduling for stable timing.
 */
export class Metronome {
  #ctx = null;
  #masterGain = null;
  #volume = 0.8;
  #isPlaying = false;
  #bpm = 120;
  #nextBeatTime = 0;
  #beatCount = 0;
  #timerId = null;
  #onStateChange = null;
  #onBeat = null;

  constructor(onStateChange, onBeat) {
    this.#onStateChange = onStateChange;
    this.#onBeat = onBeat;
  }

  get isPlaying() {
    return this.#isPlaying;
  }

  get bpm() {
    return this.#bpm;
  }

  get volume() {
    return this.#volume;
  }

  setVolume(level) {
    this.#volume = Math.max(0, Math.min(1, level));
    if (this.#masterGain) {
      this.#masterGain.gain.value = this.#volume;
    }
  }

  async #ensureContext() {
    if (!this.#ctx) {
      this.#ctx = new AudioContext();
      this.#masterGain = this.#ctx.createGain();
      this.#masterGain.gain.value = this.#volume;
      this.#masterGain.connect(this.#ctx.destination);
    }
    if (this.#ctx.state === "suspended") {
      await this.#ctx.resume();
    }
    return this.#ctx;
  }

  #playClick(time, accent, beatIndex) {
    const ctx = this.#ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = accent ? 1200 : 800;
    gain.gain.setValueAtTime(accent ? 0.9 : 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    osc.connect(gain);
    gain.connect(this.#masterGain);

    osc.start(time);
    osc.stop(time + 0.05);

    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (this.#isPlaying) {
        this.#onBeat?.(beatIndex, accent);
      }
    }, delayMs);
  }

  #schedule() {
    if (!this.#isPlaying || !this.#ctx) return;

    const interval = 60 / this.#bpm;
    const scheduleAhead = 0.1;

    while (this.#nextBeatTime < this.#ctx.currentTime + scheduleAhead) {
      const accent = this.#beatCount % 4 === 0;
      this.#playClick(this.#nextBeatTime, accent, this.#beatCount);
      this.#nextBeatTime += interval;
      this.#beatCount++;
    }

    this.#timerId = setTimeout(() => this.#schedule(), 25);
  }

  async start(bpm) {
    const parsed = Math.round(Number(bpm));
    if (!parsed || parsed < 20 || parsed > 400) {
      return false;
    }

    await this.#ensureContext();
    this.stop();

    this.#bpm = parsed;
    this.#isPlaying = true;
    this.#beatCount = 0;

    // First click fires immediately — no scheduling delay.
    const now = this.#ctx.currentTime;
    this.#playClick(now, true, 0);
    this.#beatCount = 1;
    this.#nextBeatTime = now + 60 / this.#bpm;

    this.#schedule();
    this.#onStateChange?.(true, this.#bpm);
    return true;
  }

  stop() {
    if (!this.#isPlaying && !this.#timerId) return;

    this.#isPlaying = false;
    if (this.#timerId) {
      clearTimeout(this.#timerId);
      this.#timerId = null;
    }
    this.#onStateChange?.(false, this.#bpm);
  }

  toggle(bpm) {
    if (this.#isPlaying) {
      this.stop();
      return false;
    }
    return this.start(bpm);
  }
}
