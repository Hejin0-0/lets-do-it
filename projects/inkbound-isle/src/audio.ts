import type { Biome } from './world.ts';

export type AudioCue =
  | 'ui' | 'step' | 'gather' | 'eat' | 'craft' | 'build'
  | 'feed' | 'tame' | 'alert' | 'hit' | 'damage' | 'victory';

const MAX_VOICES = 12;

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceFilter: BiquadFilterNode | null = null;
  private readonly voices = new Set<OscillatorNode>();
  private volume = 0.72;
  private muted = false;
  private ambienceKey = '';

  async unlock(): Promise<boolean> {
    if (!this.context) {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) return false;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.context.destination);
      this.createAmbience();
    }
    if (this.context.state === 'suspended') await this.context.resume();
    this.cue('ui');
    return this.context.state === 'running';
  }

  cue(cue: AudioCue): void {
    if (!this.context || !this.master || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (cue === 'step') this.tone(105, 72, 0.07, 0.025, 'triangle', now);
    else if (cue === 'gather') this.tone(210, 120, 0.11, 0.08, 'square', now);
    else if (cue === 'eat') this.tone(260, 340, 0.12, 0.055, 'sine', now);
    else if (cue === 'craft') {
      this.tone(330, 440, 0.12, 0.06, 'triangle', now);
      this.tone(495, 660, 0.16, 0.05, 'triangle', now + 0.09);
    } else if (cue === 'build') this.tone(145, 82, 0.2, 0.09, 'square', now);
    else if (cue === 'feed') this.tone(420, 560, 0.15, 0.05, 'sine', now);
    else if (cue === 'tame') {
      this.tone(360, 540, 0.24, 0.07, 'triangle', now);
      this.tone(540, 810, 0.26, 0.05, 'sine', now + 0.12);
    } else if (cue === 'alert') this.tone(105, 48, 0.42, 0.11, 'sawtooth', now);
    else if (cue === 'hit') this.tone(175, 68, 0.09, 0.095, 'square', now);
    else if (cue === 'damage') this.tone(78, 38, 0.24, 0.12, 'sawtooth', now);
    else if (cue === 'victory') {
      for (const [index, frequency] of [392, 523, 659, 784].entries()) {
        this.tone(frequency, frequency * 1.08, 0.28, 0.055, 'triangle', now + index * 0.13);
      }
    } else this.tone(520, 620, 0.06, 0.035, 'sine', now);
  }

  setAmbience(biome: Biome, night: boolean): void {
    if (!this.context || !this.ambienceFilter || !this.ambienceGain) return;
    const key = `${biome}|${night}`;
    if (key === this.ambienceKey) return;
    this.ambienceKey = key;
    const now = this.context.currentTime;
    const frequency = { coast: 1_450, jungle: 820, plains: 560, highlands: 1_050 }[biome];
    this.ambienceFilter.frequency.setTargetAtTime(frequency, now, 0.6);
    this.ambienceGain.gain.setTargetAtTime(night ? 0.032 : biome === 'coast' ? 0.028 : 0.018, now, 0.8);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyVolume();
    return this.muted;
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : this.volume));
    this.applyVolume();
  }

  getVolume(): number {
    return this.volume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private applyVolume(): void {
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.025);
  }

  private createAmbience(): void {
    if (!this.context || !this.master) return;
    const frameCount = this.context.sampleRate * 2;
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    this.ambienceFilter = this.context.createBiquadFilter();
    this.ambienceFilter.type = 'lowpass';
    this.ambienceFilter.frequency.value = 700;
    this.ambienceGain = this.context.createGain();
    this.ambienceGain.gain.value = 0.018;
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.ambienceFilter).connect(this.ambienceGain).connect(this.master);
    source.start();
  }

  private tone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    gainValue: number,
    type: OscillatorType,
    startTime: number,
  ): void {
    if (!this.context || !this.master || this.voices.size >= MAX_VOICES) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startTime + duration);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainValue, startTime + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.addEventListener('ended', () => this.voices.delete(oscillator), { once: true });
    this.voices.add(oscillator);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }
}
