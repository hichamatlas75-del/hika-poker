/**
 * Hika-Poker - Moteur Audio Spatial & Synthèse Physique (Web Audio API Pro)
 * Modélisation acoustique Casino (Jetons céramique, cartes plastifiées, table boisée, accords riches)
 * Zéro dépendance externe, compresseur Master, stéréo panoramique & retour haptique PWA.
 */

class SoundFX {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.volume = 0.65;
    this.hapticsEnabled = true;

    this.initFromStorage();
    this._setupAutoUnlock();
  }

  initFromStorage() {
    const savedMuted = localStorage.getItem('hika_sound_muted');
    if (savedMuted !== null) this.muted = savedMuted === 'true';

    const savedVol = localStorage.getItem('hika_sound_volume');
    if (savedVol !== null) {
      const parsed = parseFloat(savedVol);
      if (!Number.isNaN(parsed)) this.volume = Math.max(0, Math.min(1, parsed));
    }
  }

  // Déverrouillage automatique de l'AudioContext au premier clic/toucher (requis sur iOS/Chrome)
  _setupAutoUnlock() {
    const unlock = () => {
      const ctx = this._getCtx();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  _getCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();

      // Compresseur dynamique Master (son punchy type studio, zéro écrêtage)
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

      // Volume global
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // Pré-génération d'un buffer de bruit blanc/rose de 2 secondes (évite de le recréer à chaque carte)
      this._buildNoiseBuffer();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  _buildNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 1.5;
    this.noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const output = this.noiseBuffer.getChannelData(0);

    // Génération d'un bruit légèrement filtré (plus doux et naturel que le bruit blanc brut)
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
    }
  }

  // Utilitaire de spatialisation stéréo (-1 = gauche, 0 = centre, 1 = droite)
  _createOutNode(ctx, pan = 0) {
    if (ctx.createStereoPanner && pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
      panner.connect(this.masterGain);
      return panner;
    }
    return this.masterGain;
  }

  // Retour haptique léger sur mobile/PWA
  _vibrate(pattern) {
    if (this.hapticsEnabled && !this.muted && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('hika_sound_muted', this.muted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('hika_sound_volume', this.volume);
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  // =========================================================================
  // 1. CARTES (DISTRIBUTION, FLIP 3D, FOLD)
  // =========================================================================

  /**
   * Bruit réaliste de carte distribuée (claquement sec du sabot + glissement sur feutre)
   */
  playCardDeal(pan = 0) {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const out = this._createOutNode(ctx, pan || (Math.random() * 0.4 - 0.2));

    // Couche 1 : Snap initial (doigt sur le bord de la carte)
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(320 + Math.random() * 60, now);
    snapOsc.frequency.exponentialRampToValueAtTime(65, now + 0.022);

    snapGain.gain.setValueAtTime(0.18, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

    snapOsc.connect(snapGain);
    snapGain.connect(out);
    snapOsc.start(now);
    snapOsc.stop(now + 0.025);

    // Couche 2 : Frottement aérodynamique sur le tapis (Bandpass dynamique)
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const startFreq = 2400 + Math.random() * 400;
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(650, now + 0.09);
    filter.Q.setValueAtTime(1.8, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(out);

    noise.start(now, Math.random() * 0.5, 0.11);
  }

  /**
   * Retournement d'une carte sur le Board (Flop / Turn / River)
   */
  playCardFlip() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.07);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now, Math.random() * 0.5, 0.08);
  }

  /**
   * Fold : Glissement sourd des cartes jetées dans le muck
   */
  playFold() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx || !this.noiseBuffer) return;

    this._vibrate(15);
    const now = ctx.currentTime;

    // Bruit de glisse feutrée basse fréquence
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.16);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.38, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now, 0.2, 0.18);

    // Corps grave subtil
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.13);

    oscGain.gain.setValueAtTime(0.15, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // =========================================================================
  // 2. JETONS & MISES (MODÉLISATION CÉRAMIQUE / ARGILE)
  // =========================================================================

  /**
   * Jeton individuel : synthèse modale à 3 partiels inharmoniques + clic d'impact
   * Reproduit le "clink" authentique des jetons Paulson / Céramique de casino
   */
  playChip(pan = 0, pitchShift = 1) {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const out = this._createOutNode(ctx, pan);

    // Variation naturelle de hauteur d'un jeton à l'autre
    const randVar = (0.94 + Math.random() * 0.12) * pitchShift;
    // Modes de résonance d'un disque en céramique/composite
    const partials = [
      { freq: 2350 * randVar, amp: 0.22, decay: 0.055 },
      { freq: 3920 * randVar, amp: 0.16, decay: 0.042 },
      { freq: 6280 * randVar, amp: 0.09, decay: 0.028 }
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
      gain.connect(out);

      osc.start(now);
      osc.stop(now + p.decay + 0.005);
    });

    // Impact sec du rebond sur la pile
    if (this.noiseBuffer) {
      const click = ctx.createBufferSource();
      click.buffer = this.noiseBuffer;

      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(4500 * randVar, now);
      hp.Q.setValueAtTime(3.0, now);

      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.28, now);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.014);

      click.connect(hp);
      hp.connect(cGain);
      cGain.connect(out);
      click.start(now, Math.random() * 0.5, 0.016);
    }
  }

  /**
   * Pile de jetons (Relance / All-in / Gain du pot) : cascade rythmique réaliste
   */
  playChipsStack(count = 6) {
    if (this.muted) return;
    this._vibrate([15, 30, 20]);

    for (let i = 0; i < count; i++) {
      // Espacement irrégulier naturel (plus serré au début, décélère à la fin)
      const delay = i * 32 + Math.random() * 14;
      const pitch = 0.95 + (i / count) * 0.15;
      const pan = (Math.random() - 0.5) * 0.35;
      setTimeout(() => this.playChip(pan, pitch), delay);
    }
  }

  /**
   * Effet dramatique spécial All-In (Grave + Cascade de jetons)
   */
  playAllIn() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    this._vibrate([30, 40, 60]);
    const now = ctx.currentTime;

    // Sub-bass impact ("Boom" feutré)
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(35, now + 0.45);

    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.5);

    // Chime métallique de tension
    [523.25, 783.99, 1046.5].forEach((freq) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.6);
    });

    // Cascade de jetons poussés au tapis
    this.playChipsStack(8);
  }

  // =========================================================================
  // 3. ACTIONS DE TABLE (CHECK, TIMER, TOUR DU JOUEUR)
  // =========================================================================

  /**
   * Check : Double "Knock" réaliste de la main sur le rebord boisé de la table
   */
  playCheck() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    this._vibrate([12, 60, 18]);

    [0, 0.115].forEach((offset, idx) => {
      const t = ctx.currentTime + offset;
      const amp = idx === 0 ? 0.45 : 0.6; // Le 2ème coup est légèrement plus appuyé

      // Résonance du bois de la table
      const bodyOsc = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(idx === 0 ? 135 : 148, t);
      bodyOsc.frequency.exponentialRampToValueAtTime(48, t + 0.065);

      bodyGain.gain.setValueAtTime(amp, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(this.masterGain);
      bodyOsc.start(t);
      bodyOsc.stop(t + 0.075);

      // Transitoire d'impact de la phalange
      if (this.noiseBuffer) {
        const thud = ctx.createBufferSource();
        thud.buffer = this.noiseBuffer;

        const lp = ctx.createBiquadFilter();
        lp.type = 'bandpass';
        lp.frequency.setValueAtTime(320, t);
        lp.Q.setValueAtTime(2.2, t);

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(amp * 0.7, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

        thud.connect(lp);
        lp.connect(nGain);
        nGain.connect(this.masterGain);
        thud.start(t, 0.1, 0.03);
      }
    });
  }

  /**
   * Notification douce quand c'est au tour du joueur humain de parler
   */
  playMyTurn() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    this._vibrate(25);
    const now = ctx.currentTime;

    // Double note cristalline style Marimba / Vibraphone (Ré5 -> La5)
    [587.33, 880].forEach((freq, i) => {
      const t = now + i * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  /**
   * Compte à rebours : Tic d'horloge boisé (normal) ou Pulsation tendue (urgent < 3s)
   */
  playTimerTick(isUrgent = false) {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (!isUrgent) {
      // Tic d'horloge mécanique discret
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.018);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.025);
    } else {
      // Double pulsation urgente mais harmonieuse (sans onde carrée agressive)
      this._vibrate(20);
      [0, 0.06].forEach((d, idx) => {
        const t = now + d;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(idx === 0 ? 784 : 1046.5, t); // Sol5 -> Do6

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, t);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.06);
      });
    }
  }

  // =========================================================================
  // 4. VICTOIRE, ROUE DE LA FORTUNE & UI
  // =========================================================================

  /**
   * Fanfare de Victoire Casino (arpège majeur 9ème chaleureux + pluie de jetons)
   */
  playWin() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    this._vibrate([40, 50, 80]);
    const now = ctx.currentTime;

    // Arpège Do Majeur 9 (C5, E5, G5, B5, D6, C6) avec synthèse FM légère type Rhodes/Cloche dorée
    const notes = [
      { f: 523.25, t: 0.00, d: 0.45, pan: -0.3 },
      { f: 659.25, t: 0.08, d: 0.45, pan: 0.3 },
      { f: 783.99, t: 0.16, d: 0.50, pan: -0.2 },
      { f: 987.77, t: 0.24, d: 0.55, pan: 0.2 },
      { f: 1046.50, t: 0.33, d: 0.85, pan: 0.0 }
    ];

    notes.forEach((n) => {
      const start = now + n.t;
      const out = this._createOutNode(ctx, n.pan);

      // Fondamentale chaude
      const osc1 = ctx.createOscillator();
      // Harmonique brillante à l'octave supérieure
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(n.f, start);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(n.f * 2, start);

      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.25, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.24, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + n.d);

      osc1.connect(gain);
      osc2.connect(g2);
      g2.connect(gain);
      gain.connect(out);

      osc1.start(start);
      osc2.start(start);
      osc1.stop(start + n.d + 0.02);
      osc2.stop(start + n.d + 0.02);
    });

    // Accord de basse chaud en soutien (C4 + G4)
    [261.63, 392.00].forEach((bf) => {
      const bOsc = ctx.createOscillator();
      const bGain = ctx.createGain();
      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(bf, now);
      bGain.gain.setValueAtTime(0.15, now);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      bOsc.connect(bGain);
      bGain.connect(this.masterGain);
      bOsc.start(now);
      bOsc.stop(now + 0.95);
    });

    // Pluie de jetons accompagnant le gain
    setTimeout(() => this.playChipsStack(5), 180);
  }

  /**
   * Taquet mécanique en cuir/plastique de la Roue de la Fortune
   */
  playWheelClick() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Claquement boisé résonant (comme les clous d'une vraie roue de casino)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const pitch = 1150 + (Math.random() * 80 - 40);
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.022);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.026);
  }

  /**
   * Clic UI moderne (style iOS / Casino Pop)
   */
  playBtnClick() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    this._vibrate(8);
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.025);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.03);
  }
}

window.soundFX = new SoundFX();