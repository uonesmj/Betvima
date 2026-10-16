/* Synthesis-only original sound design. No remote audio, recordings or licensed samples. */
export type PharaohSound = 'tap' | 'spin' | 'reel' | 'stop' | 'win' | 'big' | 'scatter' | 'error' | 'bonus';
export class PharaohAudio {
  private context: AudioContext | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private soundVolume = 0.42;
  private musicVolume = 0.11;
  private contextReady() {
    if (typeof window === 'undefined') return null;
    if (!this.context) this.context = new window.AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }
  setSoundVolume(value: number) { this.soundVolume = Math.max(0, Math.min(1, value)); }
  setMusicVolume(value: number) { this.musicVolume = Math.max(0, Math.min(1, value)); }
  private tone(frequency: number, duration: number, gain: number, when = 0, shape: OscillatorType = 'sine', endFreq?: number) {
    const ctx = this.contextReady();
    if (!ctx || gain <= 0) return;
    const now = ctx.currentTime + when;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFreq) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + Math.min(0.03, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
  play(effect: PharaohSound) {
    const v = this.soundVolume;
    if (v === 0) return;
    if (effect === 'tap') this.tone(760, 0.09, v * 0.075, 0, 'sine', 470);
    if (effect === 'spin') {
      this.tone(140, 0.45, v * 0.14, 0, 'triangle', 45);
      this.tone(320, 0.27, v * 0.05, 0.10, 'sawtooth', 100);
    }
    if (effect === 'reel') {
      this.tone(145, 0.17, v * 0.15, 0, 'triangle', 82);
      this.tone(380, 0.085, v * 0.052, 0.025, 'sine', 290);
      this.tone(660, 0.12, v * 0.032, 0.09, 'sine', 510);
    }
    if (effect === 'stop') { this.tone(210, 0.13, v * 0.20, 0, 'triangle', 80); this.tone(780, 0.12, v * 0.035, 0.04); }
    if (effect === 'error') { this.tone(245, 0.32, v * 0.10, 0, 'triangle', 135); }
    if (effect === 'scatter') [680,870,1100].forEach((n,i) => this.tone(n, 0.24, v * 0.12, i * 0.11));
    if (effect === 'win') [523,659,784,1046].forEach((n,i) => this.tone(n, 0.37, v * 0.16, i * 0.1, 'triangle'));
    if (effect === 'big') {
      [262,330,392,523,659,784,1046,1319].forEach((n,i) => this.tone(n, 0.52, v * 0.17, i * 0.12, 'triangle'));
      this.tone(110, 1.2, v * 0.11, 0, 'sawtooth', 65);
    }
    if (effect === 'bonus') {
      [392,523,659,784,1046,1319].forEach((n,i) => this.tone(n, 0.7, v * 0.14, i * 0.15, 'sine'));
      this.tone(180, 1.5, v * 0.13, 0, 'triangle', 75);
    }
  }
  startMusic() {
    this.contextReady();
    if (this.musicTimer) return;
    const notes = [110, 164.81, 196, 220, 164.81, 146.83, 196, 164.81];
    const tick = () => {
      const note = notes[this.step % notes.length]!;
      this.tone(note, 1.15, this.musicVolume * 0.29, 0, 'triangle');
      this.tone(note * 2, 0.7, this.musicVolume * 0.075, 0.18, 'sine');
      if (this.step % 4 === 0) this.tone(55, 1.9, this.musicVolume * 0.27, 0, 'sine');
      this.step++;
    };
    tick();
    this.musicTimer = setInterval(tick, 950);
  }
  stopMusic() { if (this.musicTimer) clearInterval(this.musicTimer); this.musicTimer = null; }
  dispose() {
    this.stopMusic();
    if (this.context) void this.context.close();
    this.context = null;
  }
}
