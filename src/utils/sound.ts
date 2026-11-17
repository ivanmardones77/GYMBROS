class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.12,
    delay = 0,
    endFreq?: number
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playTap() {
    this.tone(420, 0.06, 'triangle', 0.08, 0, 280);
  }

  public playHit() {
    this.tone(520, 0.09, 'triangle', 0.12, 0, 680);
  }

  public playPerfect() {
    this.tone(587.33, 0.09, 'sine', 0.14, 0);
    this.tone(880, 0.14, 'sine', 0.14, 0.06);
  }

  public playMiss() {
    this.tone(170, 0.18, 'sawtooth', 0.09, 0, 95);
  }

  public playPunch() {
    this.tone(140, 0.09, 'square', 0.14, 0, 52);
    this.tone(320, 0.05, 'triangle', 0.08, 0, 110);
  }

  public playStep(isLeft: boolean) {
    this.tone(isLeft ? 210 : 250, 0.05, 'triangle', 0.09, 0, 120);
  }

  public playJump() {
    this.tone(240, 0.15, 'sine', 0.11, 0, 560);
  }

  public playCoin() {
    this.tone(987.77, 0.07, 'sine', 0.11, 0);
    this.tone(1318.51, 0.14, 'sine', 0.11, 0.07);
  }

  public playLevelUp() {
    this.tone(440, 0.1, 'triangle', 0.12, 0);
    this.tone(554.37, 0.1, 'triangle', 0.12, 0.09);
    this.tone(659.25, 0.12, 'triangle', 0.13, 0.18);
    this.tone(880, 0.25, 'sine', 0.15, 0.28);
  }

  public playPushChime() {
    this.tone(659.25, 0.08, 'sine', 0.09, 0);
    this.tone(987.77, 0.15, 'sine', 0.09, 0.09);
  }
}

export const sound = new SoundEngine();
