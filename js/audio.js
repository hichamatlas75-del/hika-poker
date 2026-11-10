/**
 * Hika-Poker - Moteur Audio Synthétique (Web Audio API)
 * Aucun fichier externe requis, zéro latence, 100% autonome.
 */

class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.5;
    this.initFromStorage();
  }

  initFromStorage() {
    const saved = localStorage.getItem('hika_sound_muted');
    if (saved !== null) {
      this.muted = saved === 'true';
    }
    const savedVol = localStorage.getItem('hika_sound_volume');
    if (savedVol !== null) {
      this.volume = parseFloat(savedVol) || 0.5;
    }
  }

  _getCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('hika_sound_muted', this.muted);
    return this.muted;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('hika_sound_volume', this.volume);
  }

  // Bruit de carte distribuée (swoosh de glisse)
  playCardDeal() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
    filter.Q.value = 3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25 * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  }

  // Bruit de jeton (impact céramique/métallique cristallin)
  playChip() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const freqs = [1800, 2200, 2600, 3100];
    const baseFreq = freqs[Math.floor(Math.random() * freqs.length)];
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.3 * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  }

  // Jetons multiples (gros pot ou relance)
  playChipsStack() {
    if (this.muted) return;
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.playChip(), i * 40);
    }
  }

  // Knock sur la table (Check)
  playCheck() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    [0, 0.09].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + delay + 0.05);

      gain.gain.setValueAtTime(0.4 * this.volume, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.06);
    });
  }

  // Fold (bruit feutré de retrait de cartes)
  playFold() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.2 * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  }

  // Bip du compte à rebours (dernières secondes)
  playTimerTick(isUrgent = false) {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    const freq = isUrgent ? 880 : 520;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.12 * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  // Fanfare de victoire
  playWin() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // Do, Mi, Sol, Do aigu
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

      gain.gain.setValueAtTime(0.3 * this.volume, ctx.currentTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.1);
      osc.stop(ctx.currentTime + idx * 0.1 + 0.36);
    });
  }

  // Clic de la roue de la fortune
  playWheelClick() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.025);

    gain.gain.setValueAtTime(0.35 * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.025);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  }

  // Clic de bouton interface standard
  playBtnClick() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.03);

    gain.gain.setValueAtTime(0.15 * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.035);
  }
}

window.soundFX = new SoundFX();
