/**
 * Hika-Poker - Moteur Audio Haute Définition (HD Studio Casino)
 * Synthèse acoustique modale physique (Jetons céramique Paulson 14g, cartes plastifiées KEM, table feutrée)
 * Reverb algorithmique de salle VIP, compresseur multibande Master, spatialisation stéréo & haptique.
 * Zéro fichier MP3 externe lourd : 100% autonome, ultra-rapide et instantané en Web Audio API Pro.
 */

class SoundFX {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.dryGain = null;
    this.pinkNoiseBuffer = null;
    this.whiteNoiseBuffer = null;
    this.applauseBuffer = null;
    this.muted = false;
    this.volume = 0.70;
    this.hapticsEnabled = true;

    this.initFromStorage();
    this._setupAutoUnlock();
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

      // 2. Égaliseur Master (Low shelf propre sous 50Hz + Présence à 2.8kHz)
      const lowFilter = this.ctx.createBiquadFilter();
      lowFilter.type = 'highpass';
      lowFilter.frequency.setValueAtTime(35, this.ctx.currentTime);

      // 3. Réverbération acoustique VIP Lounge (Convolver procédural doux)
      this._buildReverbBus();

      // 4. Volume global Master
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);

      // Chaînage Master : MasterGain -> LowFilter -> Compressor -> Destination
      this.masterGain.connect(lowFilter);
      lowFilter.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // Pré-génération des buffers de bruit HD
      this._buildNoiseBuffers();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Synthèse d'une réponse impulsionnelle de pièce feutrée (Salle de casino VIP luxueuse)
   * Évite les sons secs et synthétiques, apporte une profondeur acoustique chaleureuse.
   */
  _buildReverbBus() {
    if (!this.ctx) return;
    try {
      const rate = this.ctx.sampleRate;
      const length = Math.floor(rate * 0.75); // 750ms de decay naturel
      const impulse = this.ctx.createBuffer(2, length, rate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const decay = Math.exp(-i / (rate * 0.18));
        // Légère diffusion stéréo feutrée
        left[i] = (Math.random() * 2 - 1) * decay * 0.45;
        right[i] = (Math.random() * 2 - 1) * decay * 0.45;
      }

      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = impulse;

      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.setValueAtTime(0.18, this.ctx.currentTime); // 18% wet pour un rendu soyeux

      this.reverbNode.connect(this.reverbGain);
      this.reverbGain.connect(this.masterGain);
    } catch (e) {
      this.reverbNode = null;
    }
  }

  /**
   * Buffers de bruit haute définition (Rose velouté pour les cartes, Blanc pour les transitoires)
   */
  _buildNoiseBuffers() {
    if (!this.ctx) return;
    const rate = this.ctx.sampleRate;
    const len = rate * 2;

    // Buffer de bruit rose velouté (glissement de cartes et de feutre)
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

    // Buffer de bruit blanc filtré pour clics d'impact
    this.whiteNoiseBuffer = this.ctx.createBuffer(1, len, rate);
    const whiteData = this.whiteNoiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      whiteData[i] = (Math.random() * 2 - 1) * 0.25;
    }

    // Pré-génération des applaudissements du casino
    this._buildApplauseBuffer();
  }

  /**
   * Synthèse procédurale d'applaudissements de casino (foule enthousiaste en stéréo)
   * Génère ~140 claquements de mains individuels superposés avec résonances de paumes
   */
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
        // Distribution temporelle : crescendo rapide (0-0.3s) puis acclamation soutenue et decrescendo doux
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

  // Nœud de sortie stéréo panoramique spatialisé
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

  // Retour haptique doux sur mobile PWA
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
  // 1. CARTES HAUTE DÉFINITION (Copag / KEM Plastifiées)
  // =========================================================================

  /**
   * Distribution de carte : claquement de sabot net + glissement soyeux sur le feutre
   */
  playCardDeal(pan = 0) {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx || !this.pinkNoiseBuffer) return;

    const now = ctx.currentTime;
    const { main } = this._createOutNode(ctx, pan || (Math.random() * 0.4 - 0.2));

    // Couche 1 : Snap d'extraction du sabot (transitoire vif)
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'triangle';
    const snapFreq = 340 + Math.random() * 70;
    snapOsc.frequency.setValueAtTime(snapFreq, now);
    snapOsc.frequency.exponentialRampToValueAtTime(80, now + 0.024);

    snapGain.gain.setValueAtTime(0.24, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    snapOsc.connect(snapGain);
    snapGain.connect(main);
    snapOsc.start(now);
    snapOsc.stop(now + 0.028);

    // Couche 2 : Glissement aérodynamique sur feutre vert (filtre passe-bande dynamique)
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

  /**
   * Retournement 3D (Flop / Turn / River) : Swoosh d'air soyeux + "Slap" feutré de la carte qui retombe
   */
  playCardFlip() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx || !this.pinkNoiseBuffer) return;

    const now = ctx.currentTime;
    const { main, reverb } = this._createOutNode(ctx, 0, true);

    // 1. Swoosh d'air ascendant (la carte s'élève et tourne)
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

    // 2. Slap d'atterrissage sur la table (la carte retombe à plat sur le feutre)
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

  /**
   * Fold : Glissement discret vers le sabot des cartes couchées
   */
  playFold() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx || !this.pinkNoiseBuffer) return;

    this._vibrate(12);
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

  // =========================================================================
  // 2. JETONS CÉRAMIQUE HD (Paulson 14g Pro Casino Chips)
  // =========================================================================

  /**
   * Jeton individuel : Synthèse modale haute fidélité (3 harmoniques de disque + impact sec)
   * Reproduit avec exactitude le tintement cristallin et feutré d'un vrai jeton de casino.
   */
  playChip(pan = 0, pitchShift = 1) {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const { main, reverb } = this._createOutNode(ctx, pan, true);

    const randVar = (0.95 + Math.random() * 0.10) * pitchShift;
    
    // Partiels de vibration d'un disque céramique lourd
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

    // Transitoire d'impact sec
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

  /**
   * Cascade de jetons (Mise conséquente / Relance / Pot Showdown)
   */
  playChipsStack(count = 6) {
    if (this.muted) return;
    this._vibrate([15, 25, 20]);

    for (let i = 0; i < count; i++) {
      const delay = i * 30 + Math.random() * 12;
      const pitch = 0.94 + (i / count) * 0.16;
      const pan = (Math.random() - 0.5) * 0.4;
      setTimeout(() => this.playChip(pan, pitch), delay);
    }
  }

  /**
   * Effet Cinématique All-In : Sub-bass boom percutant + Shimmer métallique + gerbe de jetons
   */
  playAllIn() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    this._vibrate([35, 45, 70]);
    const now = ctx.currentTime;
    const { main, reverb } = this._createOutNode(ctx, 0, true);

    // 1. Sub-bass Drop cinématographique (120 Hz -> 32 Hz)
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

    // 2. Cloche dorée de tension (accord en suspension brillant)
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

    // 3. Cascade de jetons poussés en bloc
    this.playChipsStack(9);
  }

  // =========================================================================
  // 3. ACTIONS DE TABLE (Check, Tour du Joueur, Timer)
  // =========================================================================

  /**
   * Check : Double "Knock" de la phalange sur le rebord boisé & cuir de la table
   */
  playCheck() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    this._vibrate([14, 55, 18]);

    [0, 0.115].forEach((offset, idx) => {
      const t = ctx.currentTime + offset;
      const amp = idx === 0 ? 0.48 : 0.64;

      // Résonance chaude du bois
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

      // Transitoire d'impact feutré
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

  /**
   * Notification VIP "À votre tour" : Double carillon de vibraphone cristallin
   */
  playMyTurn() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    this._vibrate(25);
    const now = ctx.currentTime;
    const { main, reverb } = this._createOutNode(ctx, 0, true);

    // Carillon de luxe F#5 -> C#6 chaleureux
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

  /**
   * Clic doux pour le tour des autres joueurs (soft, feutré, chaleureux et non intrusif)
   */
  playOtherTurn(pan = 0) {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const { main } = this._createOutNode(ctx, pan);

    // Ton chaud et doux (sinusoïde feutrée 280Hz -> 130Hz)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.024);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now); // Coupe les fréquences aiguës pour un son très soft

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.003); // Volume doux
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.026);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(main);

    osc.start(now);
    osc.stop(now + 0.030);

    // Léger frottement de feutrine d'accompagnement
    if (this.pinkNoiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.pinkNoiseBuffer;

      const nFilter = ctx.createBiquadFilter();
      nFilter.type = 'lowpass';
      nFilter.frequency.setValueAtTime(500, now);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.04, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

      noise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(main);
      noise.start(now, Math.random() * 0.5, 0.025);
    }
  }

  /**
   * Compte à rebours du tour
   * - Normal : tic discret de montre suisse
   * - Urgent (< 3s) : double pulsation rythmée avec montée de tension
   */
  playTimerTick(isUrgent = false) {
    if (this.muted) return;
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
      this._vibrate(18);
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

  // =========================================================================
  // 4. FANFARES DE VICTOIRE, ROUE DE LA FORTUNE & UI HD
  // =========================================================================

  /**
   * Fanfare de Victoire Casino (Arpège C Maj9 triomphal, carillons dorés et gerbe de jetons)
   */
  playWin() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    this._vibrate([45, 50, 90]);
    const now = ctx.currentTime;
    const { main, reverb } = this._createOutNode(ctx, 0, true);

    // Arpège Do Majeur 9ème étagé en stéréo (C5, E5, G5, B5, D6, G6)
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

    // Nappe de basse chaleureuse en soutien (C4 + G4)
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

    // Cascade de jetons célébrant la victoire
    setTimeout(() => this.playChipsStack(6), 200);
  }

  /**
   * Applaudissements du public de casino (Ovation chaleureuse lors d'une victoire)
   */
  playApplause(duration = 3.2) {
    if (this.muted) return;
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

  /**
   * Taquet mécanique de la Roue de la Fortune (Impact laiton / cuir réaliste)
   */
  playWheelClick() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const pitch = 1200 + (Math.random() * 90 - 45);
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.022);

    gain.gain.setValueAtTime(0.34, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.026);
  }

  /**
   * Clic UI tactile moderne (Pop doux et feutré style iOS)
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