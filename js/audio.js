/**
 * Hika-Poker - Moteur Audio Zynga Poker Clone HD
 * Dossier officiel d'assets audio réels : assets/audio/*.wav
 * Combine le chargement ultra-rapide des vrais fichiers audio WAV haute définition (cartes, jetons, double-knock, cloche)
 * avec un système de secours (fallback) de synthèse Web Audio API pour garantir 100% de disponibilité audio.
 */

const AUDIO_ASSETS = {
  card_deal: 'assets/audio/card_deal.wav',
  card_flip: 'assets/audio/card_flip.wav',
  card_fold: 'assets/audio/card_fold.wav',
  chip_bet: 'assets/audio/chip_bet.wav',
  chips_stack: 'assets/audio/chips_stack.wav',
  all_in: 'assets/audio/all_in.wav',
  check: 'assets/audio/check.wav',
  my_turn: 'assets/audio/my_turn.wav',
  other_turn: 'assets/audio/other_turn.wav',
  timer_tick: 'assets/audio/timer_tick.wav',
  timer_urgent: 'assets/audio/timer_urgent.wav',
  win: 'assets/audio/win.wav',
  applause: 'assets/audio/applause.wav',
  wheel_click: 'assets/audio/wheel_click.wav',
  button_click: 'assets/audio/button_click.wav'
};

class SoundFX {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.pinkNoiseBuffer = null;
    this.whiteNoiseBuffer = null;
    this.applauseBuffer = null;
    this.muted = false;
    this.volume = 0.75;
    this.hapticsEnabled = true;

    this.audioBuffers = {};
    this.loadingPromises = {};

    this.initFromStorage();
    this._setupAutoUnlock();

    // Démarrer le préchargement dès que possible
    if (typeof window !== 'undefined') {
      window.addEventListener('DOMContentLoaded', () => this.preloadAssets());
    }
  }

  initFromStorage() {
    try {
      const savedMuted = localStorage.getItem('hika_sound_muted');
      if (savedMuted !== null) this.muted = savedMuted === 'true';

      const savedVol = localStorage.getItem('hika_sound_volume');
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!Number.isNaN(parsed)) this.volume = Math.max(0, Math.min(1, parsed));
      }
    } catch (e) {
      /* ignore localStorage sandbox restrictions */
    }
  }

  // Déverrouillage automatique de l'AudioContext au premier clic ou toucher (obligatoire sur mobile/iOS)
  _setupAutoUnlock() {
    const unlock = () => {
      const ctx = this._getCtx();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
      this.preloadAssets();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  _getCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();

      // 1. Compresseur Dynamique Master (Mastering type Studio, zéro distorsion à haut volume)
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4.5, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

      // 2. Égaliseur Master (Low shelf propre sous 50Hz)
      const lowFilter = this.ctx.createBiquadFilter();
      lowFilter.type = 'highpass';
      lowFilter.frequency.setValueAtTime(35, this.ctx.currentTime);

      // 3. Réverbération acoustique VIP Lounge
      this._buildReverbBus();

      // 4. Volume global Master
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);

      // Chaînage Master : MasterGain -> LowFilter -> Compressor -> Destination
      this.masterGain.connect(lowFilter);
      lowFilter.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // Pré-génération des buffers de bruit HD pour le fallback
      this._buildNoiseBuffers();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Précharge l'ensemble des fichiers WAV réels du dossier assets/audio/
   */
  async preloadAssets() {
    const ctx = this._getCtx();
    if (!ctx) return;

    for (const [key, path] of Object.entries(AUDIO_ASSETS)) {
      if (this.audioBuffers[key] || this.loadingPromises[key]) continue;
      this.loadingPromises[key] = (async () => {
        try {
          const resp = await fetch(path);
          if (!resp.ok) return;
          const arrayBuf = await resp.arrayBuffer();
          const audioBuf = await ctx.decodeAudioData(arrayBuf);
          this.audioBuffers[key] = audioBuf;
        } catch (e) {
          // Fallback silencieux vers la synthèse si le fetch échoue (ex: protocole file:// ou hors-ligne)
        }
      })();
    }
  }

  /**
   * Joue un fichier audio réel ou bascule sur la synthèse si non chargé
   */
  playAsset(key, options = {}) {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const volume = options.volume !== undefined ? options.volume : 1.0;
    const pan = options.pan || 0;
    const playbackRate = options.playbackRate || 1.0;

    if (!this.audioBuffers[key] && !this.loadingPromises[key]) {
      this.preloadAssets();
    }

    const buffer = this.audioBuffers[key];
    if (buffer) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(playbackRate, ctx.currentTime);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(volume, ctx.currentTime);

        source.connect(gainNode);

        if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
          const panner = ctx.createStereoPanner();
          panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
          gainNode.connect(panner);
          panner.connect(this.masterGain);
        } else {
          gainNode.connect(this.masterGain);
        }

        source.start(0);
        return true;
      } catch (err) {
        console.warn(`[SoundFX] Erreur lecture asset ${key}:`, err);
      }
    }

    // Si le buffer n'est pas prêt, exécuter la fonction de secours
    if (typeof options.fallbackFn === 'function') {
      options.fallbackFn();
    }
    return false;
  }

  _buildReverbBus() {
    if (!this.ctx) return;
    try {
      const rate = this.ctx.sampleRate;
      const length = Math.floor(rate * 0.75);
      const impulse = this.ctx.createBuffer(2, length, rate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const decay = Math.exp(-i / (rate * 0.18));
        left[i] = (Math.random() * 2 - 1) * decay * 0.45;
        right[i] = (Math.random() * 2 - 1) * decay * 0.45;
      }

      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = impulse;

      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

      this.reverbNode.connect(this.reverbGain);
      this.reverbGain.connect(this.masterGain);
    } catch (e) {
      this.reverbNode = null;
    }
  }

  _buildNoiseBuffers() {
    if (!this.ctx) return;
    const rate = this.ctx.sampleRate;
    const len = rate * 2;

    this.pinkNoiseBuffer = this.ctx.createBuffer(1, len, rate);
    const pinkData = this.pinkNoiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.11;
    }

    this.whiteNoiseBuffer = this.ctx.createBuffer(1, len, rate);
    const whiteData = this.whiteNoiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      whiteData[i] = (Math.random() * 2 - 1) * 0.25;
    }

    this._buildApplauseBuffer();
  }

  _buildApplauseBuffer() {
    if (!this.ctx) return;
    try {
      const rate = this.ctx.sampleRate;
      const dur = 3.2;
      const len = Math.floor(rate * dur);
      this.applauseBuffer = this.ctx.createBuffer(2, len, rate);
      const left = this.applauseBuffer.getChannelData(0);
      const right = this.applauseBuffer.getChannelData(1);

      const numClaps = 140;
      for (let c = 0; c < numClaps; c++) {
        const r = Math.random();
        const tFrac = r < 0.25 ? (r / 0.25) * 0.25 : 0.25 + ((r - 0.25) / 0.75) * 0.75;
        const startSample = Math.floor(tFrac * (len - rate * 0.18));

        const pan = Math.random() * 2 - 1;
        const lGain = Math.cos((pan + 1) * Math.PI / 4);
        const rGain = Math.sin((pan + 1) * Math.PI / 4);

        const normT = startSample / len;
        const env = Math.sin(normT * Math.PI) * (0.65 + Math.random() * 0.35);

        const clapLen = Math.floor((0.016 + Math.random() * 0.016) * rate);
        const freq = 750 + Math.random() * 1100;
        const decayConst = 0.005 + Math.random() * 0.005;

        for (let i = 0; i < clapLen && (startSample + i) < len; i++) {
          const t = i / rate;
          const decay = Math.exp(-t / decayConst);
          const noise = (Math.random() * 2 - 1) * 0.65;
          const body = Math.sin(2 * Math.PI * freq * t) * 0.35;
          const sample = (noise + body) * decay * env * 0.28;

          left[startSample + i] += sample * lGain;
          right[startSample + i] += sample * rGain;
        }
      }
    } catch (e) {
      this.applauseBuffer = null;
    }
  }

  _createOutNode(ctx, pan = 0, withReverb = false) {
    let target = this.masterGain;
    if (ctx.createStereoPanner && pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
      panner.connect(this.masterGain);
      target = panner;
    }

    if (withReverb && this.reverbNode) {
      const sendGain = ctx.createGain();
      sendGain.gain.setValueAtTime(0.35, ctx.currentTime);
      sendGain.connect(this.reverbNode);
      return { main: target, reverb: sendGain };
    }

    return { main: target, reverb: null };
  }

  _vibrate(pattern) {
    if (this.hapticsEnabled && !this.muted && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('hika_sound_muted', this.muted); } catch (e) {}
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    try { localStorage.setItem('hika_sound_volume', this.volume); } catch (e) {}
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  // =========================================================================
  // 1. DISTRIBUTION & MANIPULATION DES CARTES
  // =========================================================================

  playCardDeal(pan = 0) {
    this.playAsset('card_deal', {
      volume: 0.92,
      pan: pan || (Math.random() * 0.4 - 0.2),
      playbackRate: 0.96 + Math.random() * 0.08,
      fallbackFn: () => this._synthCardDeal(pan)
    });
  }

  playCardFlip() {
    this.playAsset('card_flip', {
      volume: 0.88,
      playbackRate: 0.97 + Math.random() * 0.06,
      fallbackFn: () => this._synthCardFlip()
    });
  }

  playFold() {
    this._vibrate(12);
    this.playAsset('card_fold', {
      volume: 0.90,
      pan: -0.2,
      playbackRate: 0.98 + Math.random() * 0.05,
      fallbackFn: () => this._synthFold()
    });
  }

  // =========================================================================
  // 2. JETONS & MISES (ZYNGA POKER CLAY CHIPS)
  // =========================================================================

  playChip(pan = 0, pitchShift = 1) {
    this.playAsset('chip_bet', {
      volume: 0.95,
      pan: pan,
      playbackRate: (0.95 + Math.random() * 0.10) * pitchShift,
      fallbackFn: () => this._synthChip(pan, pitchShift)
    });
  }

  playChipsStack(count = 6) {
    this._vibrate([15, 25, 20]);
    // Essayer de jouer le sample réel de cascade de jetons en priorité
    if (this.audioBuffers['chips_stack']) {
      this.playAsset('chips_stack', { volume: 1.0 });
      return;
    }
    // Sinon cascade de jetons unitaires
    for (let i = 0; i < count; i++) {
      const delay = i * 30 + Math.random() * 12;
      const pitch = 0.94 + (i / count) * 0.16;
      const pan = (Math.random() - 0.5) * 0.4;
      setTimeout(() => this.playChip(pan, pitch), delay);
    }
  }

  playAllIn() {
    this._vibrate([35, 45, 70]);
    this.playAsset('all_in', {
      volume: 1.15,
      fallbackFn: () => this._synthAllIn()
    });
  }

  // =========================================================================
  // 3. ACTIONS DE TABLE (Check, Tours, Timers)
  // =========================================================================

  playCheck() {
    this._vibrate([14, 55, 18]);
    this.playAsset('check', {
      volume: 1.05,
      fallbackFn: () => this._synthCheck()
    });
  }

  playMyTurn() {
    this._vibrate(25);
    this.playAsset('my_turn', {
      volume: 0.90,
      fallbackFn: () => this._synthMyTurn()
    });
  }

  playOtherTurn(pan = 0) {
    this.playAsset('other_turn', {
      volume: 0.55,
      pan: pan,
      fallbackFn: () => this._synthOtherTurn(pan)
    });
  }

  playTimerTick(isUrgent = false) {
    const key = isUrgent ? 'timer_urgent' : 'timer_tick';
    if (isUrgent) this._vibrate(18);
    this.playAsset(key, {
      volume: isUrgent ? 0.95 : 0.60,
      fallbackFn: () => this._synthTimerTick(isUrgent)
    });
  }

  // =========================================================================
  // 4. VICTOIRE, OVATION & INTERFACE
  // =========================================================================

  playWin() {
    this._vibrate([45, 50, 90]);
    this.playAsset('win', {
      volume: 1.10,
      fallbackFn: () => this._synthWin()
    });
  }

  playApplause(duration = 3.2) {
    this.playAsset('applause', {
      volume: 0.90,
      fallbackFn: () => this._synthApplause(duration)
    });
  }

  playWheelClick() {
    this.playAsset('wheel_click', {
      volume: 0.80,
      playbackRate: 0.92 + Math.random() * 0.16,
      fallbackFn: () => this._synthWheelClick()
    });
  }

  playBtnClick() {
    this._vibrate(8);
    this.playAsset('button_click', {
      volume: 0.70,
      fallbackFn: () => this._synthBtnClick()
    });
  }

  // =========================================================================
  // MÉTHODES DE SECOURS (FALLBACK DE SYNTHÈSE WEB AUDIO API)
  // =========================================================================

  _synthCardDeal(pan = 0) {
    const ctx = this._getCtx();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;
    const { main } = this._createOutNode(ctx, pan || (Math.random() * 0.4 - 0.2));

    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(340 + Math.random() * 70, now);
    snapOsc.frequency.exponentialRampToValueAtTime(80, now + 0.024);
    snapGain.gain.setValueAtTime(0.24, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    snapOsc.connect(snapGain);
    snapGain.connect(main);
    snapOsc.start(now);
    snapOsc.stop(now + 0.028);

    const noise = ctx.createBufferSource();
    noise.buffer = this.pinkNoiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2600 + Math.random() * 400, now);
    filter.frequency.exponentialRampToValueAtTime(750, now + 0.095);
    filter.Q.setValueAtTime(2.2, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.48, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(main);
    noise.start(now, Math.random() * 0.5, 0.11);
  }

  _synthCardFlip() {
    const ctx = this._getCtx();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;
    const { main, reverb } = this._createOutNode(ctx, 0, true);

    const swoosh = ctx.createBufferSource();
    swoosh.buffer = this.pinkNoiseBuffer;
    const swooshFilter = ctx.createBiquadFilter();
    swooshFilter.type = 'bandpass';
    swooshFilter.frequency.setValueAtTime(800, now);
    swooshFilter.frequency.exponentialRampToValueAtTime(3200, now + 0.05);
    swooshFilter.Q.setValueAtTime(1.8, now);
    const swooshGain = ctx.createGain();
    swooshGain.gain.setValueAtTime(0.02, now);
    swooshGain.gain.linearRampToValueAtTime(0.36, now + 0.035);
    swooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    swoosh.connect(swooshFilter);
    swooshFilter.connect(swooshGain);
    swooshGain.connect(main);
    swoosh.start(now, 0.1, 0.07);

    const slapTime = now + 0.045;
    const slapOsc = ctx.createOscillator();
    const slapGain = ctx.createGain();
    slapOsc.type = 'sine';
    slapOsc.frequency.setValueAtTime(260, slapTime);
    slapOsc.frequency.exponentialRampToValueAtTime(60, slapTime + 0.035);
    slapGain.gain.setValueAtTime(0.22, slapTime);
    slapGain.gain.exponentialRampToValueAtTime(0.001, slapTime + 0.04);
    slapOsc.connect(slapGain);
    slapGain.connect(main);
    if (reverb) slapGain.connect(reverb);
    slapOsc.start(slapTime);
    slapOsc.stop(slapTime + 0.045);
  }

  _synthFold() {
    const ctx = this._getCtx();
    if (!ctx || !this.pinkNoiseBuffer) return;
    const now = ctx.currentTime;
    const { main } = this._createOutNode(ctx, -0.2);

    const noise = ctx.createBufferSource();
    noise.buffer = this.pinkNoiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.16);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.linearRampToValueAtTime(0.34, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(main);
    noise.start(now, 0.25, 0.18);
  }

  _synthChip(pan = 0, pitchShift = 1) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const { main, reverb } = this._createOutNode(ctx, pan, true);
    const randVar = (0.95 + Math.random() * 0.10) * pitchShift;

    const partials = [
      { freq: 2420 * randVar, amp: 0.24, decay: 0.060 },
      { freq: 4180 * randVar, amp: 0.18, decay: 0.045 },
      { freq: 6550 * randVar, amp: 0.10, decay: 0.030 }
    ];

    partials.forEach((p) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(p.amp, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + p.decay);
      osc.connect(gain);
      gain.connect(main);
      if (reverb) gain.connect(reverb);
      osc.start(now);
      osc.stop(now + p.decay + 0.005);
    });

    if (this.whiteNoiseBuffer) {
      const click = ctx.createBufferSource();
      click.buffer = this.whiteNoiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(4800 * randVar, now);
      bp.Q.setValueAtTime(3.2, now);
      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.32, now);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      click.connect(bp);
      bp.connect(cGain);
      cGain.connect(main);
      click.start(now, Math.random() * 0.5, 0.016);
    }
  }

  _synthAllIn() {
    const ctx = this._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const { main, reverb } = this._createOutNode(ctx, 0, true);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(118, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.50);
    subGain.gain.setValueAtTime(0.55, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    sub.connect(subGain);
    subGain.connect(main);
    sub.start(now);
    sub.stop(now + 0.55);

    [523.25, 783.99, 1046.5, 1318.5].forEach((freq) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.09, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.60);
      osc.connect(g);
      g.connect(main);
      if (reverb) g.connect(reverb);
      osc.start(now);
      osc.stop(now + 0.65);
    });
  }

  _synthCheck() {
    const ctx = this._getCtx();
    if (!ctx) return;

    [0, 0.115].forEach((offset, idx) => {
      const t = ctx.currentTime + offset;
      const amp = idx === 0 ? 0.48 : 0.64;

      const bodyOsc = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(idx === 0 ? 138 : 152, t);
      bodyOsc.frequency.exponentialRampToValueAtTime(46, t + 0.07);
      bodyGain.gain.setValueAtTime(amp, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(this.masterGain);
      bodyOsc.start(t);
      bodyOsc.stop(t + 0.08);

      if (this.pinkNoiseBuffer) {
        const thud = ctx.createBufferSource();
        thud.buffer = this.pinkNoiseBuffer;
        const lp = ctx.createBiquadFilter();
        lp.type = 'bandpass';
        lp.frequency.setValueAtTime(340, t);
        lp.Q.setValueAtTime(2.4, t);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(amp * 0.65, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        thud.connect(lp);
        lp.connect(nGain);
        nGain.connect(this.masterGain);
        thud.start(t, 0.1, 0.035);
      }
    });
  }

  _synthMyTurn() {
    const ctx = this._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const { main, reverb } = this._createOutNode(ctx, 0, true);

    [739.99, 1108.73].forEach((freq, i) => {
      const t = now + i * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(main);
      if (reverb) gain.connect(reverb);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  _synthOtherTurn(pan = 0) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const { main } = this._createOutNode(ctx, pan);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.024);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.026);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(main);
    osc.start(now);
    osc.stop(now + 0.030);
  }

  _synthTimerTick(isUrgent = false) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (!isUrgent) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(820, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.016);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.022);
    } else {
      [0, 0.055].forEach((d, idx) => {
        const t = now + d;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(idx === 0 ? 880 : 1174.66, t);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, t);
        gain.gain.setValueAtTime(0.19, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.055);
      });
    }
  }

  _synthWin() {
    const ctx = this._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const { main, reverb } = this._createOutNode(ctx, 0, true);

    const notes = [
      { f: 523.25, t: 0.00, d: 0.48, pan: -0.35 },
      { f: 659.25, t: 0.08, d: 0.48, pan: 0.35 },
      { f: 783.99, t: 0.16, d: 0.52, pan: -0.20 },
      { f: 987.77, t: 0.24, d: 0.58, pan: 0.20 },
      { f: 1174.66, t: 0.32, d: 0.65, pan: -0.10 },
      { f: 1567.98, t: 0.40, d: 0.95, pan: 0.0 }
    ];

    notes.forEach((n) => {
      const start = now + n.t;
      const { main: noteOut } = this._createOutNode(ctx, n.pan);
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(n.f, start);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(n.f * 2, start);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.28, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.26, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + n.d);
      osc1.connect(gain);
      osc2.connect(g2);
      g2.connect(gain);
      gain.connect(noteOut);
      if (reverb) gain.connect(reverb);
      osc1.start(start);
      osc2.start(start);
      osc1.stop(start + n.d + 0.02);
      osc2.stop(start + n.d + 0.02);
    });

    [261.63, 392.00].forEach((bf) => {
      const bOsc = ctx.createOscillator();
      const bGain = ctx.createGain();
      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(bf, now);
      bGain.gain.setValueAtTime(0.16, now);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      bOsc.connect(bGain);
      bGain.connect(main);
      bOsc.start(now);
      bOsc.stop(now + 1.15);
    });
  }

  _synthApplause(duration = 3.2) {
    const ctx = this._getCtx();
    if (!ctx || !this.applauseBuffer) return;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.applauseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.setValueAtTime(0.85, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.72, now + 0.20);
    gain.gain.setValueAtTime(0.68, now + duration - 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    if (this.reverbNode) {
      const revSend = ctx.createGain();
      revSend.gain.setValueAtTime(0.35, now);
      gain.connect(revSend);
      revSend.connect(this.reverbNode);
    }
    source.start(now);
  }

  _synthWheelClick() {
    const ctx = this._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200 + (Math.random() * 90 - 45), now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.022);
    gain.gain.setValueAtTime(0.34, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.026);
  }

  _synthBtnClick() {
    const ctx = this._getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.024);
    gain.gain.setValueAtTime(0.20, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.028);
  }
}

window.soundFX = new SoundFX();