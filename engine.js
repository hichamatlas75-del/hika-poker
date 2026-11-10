/*!
 * PokerEngine — moteur Texas Hold'em (style Zynga Poker), 100 % local, sans backend.
 * JS vanilla, aucune dépendance. Fonctionne dans le navigateur (window.PokerEngine) et Node (module.exports).
 *
 * Fonctionnalités :
 *  - Texas Hold'em No-Limit (ou Pot-Limit), 2 à 10 places, heads-up géré (règles officielles)
 *  - Blinds, antes, niveaux de blinds progressifs (mode tournoi), rachat automatique (mode cash)
 *  - Évaluateur de mains fiable (roue A-2-3-4-5, kickers, quinte flush royale)
 *  - Relances minimales, relances incomplètes (all-in court) qui ne rouvrent pas l'action
 *  - Pots annexes (side pots), mise non suivie remboursée, jetons impairs distribués selon les règles
 *  - Runout automatique quand tout le monde est all-in, révélation des mains
 *  - Bots (easy / medium / hard) basés sur l'équité Monte-Carlo + cotes du pot
 *  - Aléatoire sécurisé (crypto) ou seedé (reproductible), sauvegarde/restauration JSON
 *  - Vue publique filtrée par joueur (les cartes cachées restent cachées)
 *  - selfTest() : tests de l'évaluateur + simulation avec vérification de conservation des jetons
 *
 * Exemple rapide :
 *   const game = new PokerEngine({ smallBlind: 10, bigBlind: 20 });
 *   game.addPlayer({ id: 'me', name: 'Hicham', chips: 2000 });
 *   game.addPlayer({ id: 'b1', name: 'Karim', chips: 2000, isBot: true, botLevel: 'medium' });
 *   game.on('turn', e => console.log('Au tour de', e.playerId));
 *   game.startHand();
 *   game.act('me', { type: 'raise', amount: 60 });   // amount = "relancer À" (total misé sur le tour)
 *   game.stepBot();                                   // joue 1 action de bot si c'est son tour
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PokerEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ======================================================================
   * 1. CARTES
   * id = suit*13 + (rank-2)   → rank 2..14 (14 = As), suit 0..3 (s,h,d,c)
   * ==================================================================== */
  const RANK_CHARS = '23456789TJQKA';
  const SUIT_CHARS = 'shdc';
  const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const rankOf = (id) => (id % 13) + 2;
  const suitOf = (id) => (id / 13) | 0;

  function cardToString(id) { return RANK_CHARS[id % 13] + SUIT_CHARS[(id / 13) | 0]; }
  function parseCard(str) {
    if (typeof str !== 'string' || str.length !== 2) throw new Error('Carte invalide: ' + str);
    const r = RANK_CHARS.indexOf(str[0].toUpperCase());
    const s = SUIT_CHARS.indexOf(str[1].toLowerCase());
    if (r < 0 || s < 0) throw new Error('Carte invalide: ' + str);
    return s * 13 + r;
  }
  function cardInfo(c) {
    const id = typeof c === 'string' ? parseCard(c) : c;
    const suit = SUIT_CHARS[suitOf(id)];
    const rankChar = RANK_CHARS[id % 13];
    return {
      id, code: rankChar + suit, rank: rankOf(id), rankChar: rankChar === 'T' ? '10' : rankChar,
      suit, symbol: SUIT_SYMBOLS[suit], color: (suit === 'h' || suit === 'd') ? 'red' : 'black'
    };
  }
  const newDeck = () => Array.from({ length: 52 }, (_, i) => i);

  /* ======================================================================
   * 2. ALÉATOIRE
   * ==================================================================== */
  function hashSeed(seed) {
    if (typeof seed === 'number') return seed | 0;
    let h = 2166136261;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h | 0;
  }
  function createRng(seed) {
    if (seed === null || seed === undefined) {
      const g = typeof globalThis !== 'undefined' ? globalThis : {};
      if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
        const buf = new Uint32Array(1);
        return { next() { g.crypto.getRandomValues(buf); return buf[0] / 4294967296; }, getState: () => null, setState() {} };
      }
      return { next: () => Math.random(), getState: () => null, setState() {} };
    }
    let a = hashSeed(seed) >>> 0; // mulberry32
    return {
      next() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      getState: () => a,
      setState: (s) => { a = s >>> 0; }
    };
  }
  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ======================================================================
   * 3. ÉVALUATEUR DE MAINS
   * score = catégorie<<20 | 5 rangs de 4 bits  → comparaison numérique directe
   * ==================================================================== */
  const CATEGORIES = [
    { key: 'high-card', fr: 'Carte haute' },
    { key: 'pair', fr: 'Paire' },
    { key: 'two-pair', fr: 'Double paire' },
    { key: 'three-of-a-kind', fr: 'Brelan' },
    { key: 'straight', fr: 'Quinte' },
    { key: 'flush', fr: 'Couleur' },
    { key: 'full-house', fr: 'Full' },
    { key: 'four-of-a-kind', fr: 'Carré' },
    { key: 'straight-flush', fr: 'Quinte flush' }
  ];
  const RANK_FR = { 1: 'As', 2: 'Deux', 3: 'Trois', 4: 'Quatre', 5: 'Cinq', 6: 'Six', 7: 'Sept', 8: 'Huit', 9: 'Neuf', 10: 'Dix', 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As' };
  const RANK_FR_PL = { 1: 'As', 2: 'Deux', 3: 'Trois', 4: 'Quatre', 5: 'Cinq', 6: 'Six', 7: 'Sept', 8: 'Huit', 9: 'Neuf', 10: 'Dix', 11: 'Valets', 12: 'Dames', 13: 'Rois', 14: 'As' };
  const aLeLa = (r) => (r === 14 || r === 1) ? 'à l’As' : r === 12 ? 'à la Dame' : 'au ' + RANK_FR[r];

  function eval5(cs) {
    const r = [0, 0, 0, 0, 0];
    const s0 = (cs[0] / 13) | 0;
    let flush = true;
    for (let i = 0; i < 5; i++) {
      r[i] = (cs[i] % 13) + 2;
      if (((cs[i] / 13) | 0) !== s0) flush = false;
    }
    r.sort((x, y) => y - x);
    const groups = [];
    for (let i = 0; i < 5; i++) {
      const last = groups[groups.length - 1];
      if (last && last.rank === r[i]) last.count++;
      else groups.push({ rank: r[i], count: 1 });
    }
    groups.sort((a, b) => (b.count - a.count) || (b.rank - a.rank));
    let g = groups.map((x) => x.rank);
    let straight = false;
    if (groups.length === 5) {
      if (r[0] - r[4] === 4) straight = true;
      else if (r[0] === 14 && r[1] === 5 && r[4] === 2) { straight = true; g = [5, 4, 3, 2, 1]; }
    }
    let cat;
    if (straight && flush) cat = 8;
    else if (groups[0].count === 4) cat = 7;
    else if (groups[0].count === 3 && groups[1].count === 2) cat = 6;
    else if (flush) cat = 5;
    else if (straight) cat = 4;
    else if (groups[0].count === 3) cat = 3;
    else if (groups[0].count === 2 && groups[1].count === 2) cat = 2;
    else if (groups[0].count === 2) cat = 1;
    else cat = 0;
    while (g.length < 5) g.push(0);
    return (cat << 20) | (g[0] << 16) | (g[1] << 12) | (g[2] << 8) | (g[3] << 4) | g[4];
  }

  function describeScore(score) {
    const cat = score >> 20;
    const g = [(score >> 16) & 15, (score >> 12) & 15, (score >> 8) & 15, (score >> 4) & 15, score & 15];
    let label;
    switch (cat) {
      case 0: label = 'Carte haute ' + RANK_FR[g[0]]; break;
      case 1: label = 'Paire de ' + RANK_FR_PL[g[0]]; break;
      case 2: label = 'Double paire ' + RANK_FR_PL[g[0]] + ' et ' + RANK_FR_PL[g[1]]; break;
      case 3: label = 'Brelan de ' + RANK_FR_PL[g[0]]; break;
      case 4: label = 'Quinte ' + aLeLa(g[0]); break;
      case 5: label = 'Couleur ' + aLeLa(g[0]); break;
      case 6: label = 'Full aux ' + RANK_FR_PL[g[0]] + ' et ' + RANK_FR_PL[g[1]]; break;
      case 7: label = 'Carré de ' + RANK_FR_PL[g[0]]; break;
      default: label = g[0] === 14 ? 'Quinte flush royale' : 'Quinte flush ' + aLeLa(g[0]);
    }
    return { category: cat, key: CATEGORIES[cat].key, label, ranks: g, royal: cat === 8 && g[0] === 14 };
  }

  /** Meilleure main de 5 cartes parmi 5 à 7 (ids). */
  function evaluateBest(cards) {
    const n = cards.length;
    if (n < 5) throw new Error('evaluateBest: au moins 5 cartes requises');
    let bestScore = -1, best = null;
    const idx = [0, 1, 2, 3, 4];
    const buf = [0, 0, 0, 0, 0];
    for (;;) {
      for (let i = 0; i < 5; i++) buf[i] = cards[idx[i]];
      const sc = eval5(buf);
      if (sc > bestScore) { bestScore = sc; best = buf.slice(); }
      let i = 4;
      while (i >= 0 && idx[i] === n - 5 + i) i--;
      if (i < 0) break;
      idx[i]++;
      for (let j = i + 1; j < 5; j++) idx[j] = idx[j - 1] + 1;
    }
    return Object.assign({ score: bestScore, cards: best }, describeScore(bestScore));
  }

  /** Libellé de main partielle (2 à 4 cartes : paire, brelan...) ou complète (5+). */
  function describeHand(cards) {
    if (cards.length >= 5) return evaluateBest(cards);
    const counts = {};
    cards.forEach((c) => { const r = rankOf(c); counts[r] = (counts[r] || 0) + 1; });
    const groups = Object.keys(counts).map((r) => ({ rank: +r, count: counts[r] }))
      .sort((a, b) => (b.count - a.count) || (b.rank - a.rank));
    let cat = 0;
    if (groups[0].count === 4) cat = 7;
    else if (groups[0].count === 3) cat = 3;
    else if (groups[0].count === 2 && groups[1] && groups[1].count === 2) cat = 2;
    else if (groups[0].count === 2) cat = 1;
    const g = groups.map((x) => x.rank);
    while (g.length < 5) g.push(0);
    const score = (cat << 20) | (g[0] << 16) | (g[1] << 12) | (g[2] << 8) | (g[3] << 4) | g[4];
    return Object.assign({ score, cards: cards.slice() }, describeScore(score));
  }

  /** Équité Monte-Carlo (0..1) contre numOpp mains aléatoires. */
  function estimateEquity(hole, board, numOpp, samples, rng) {
    if (numOpp <= 0) return 1;
    const known = new Set(hole.concat(board));
    const rest = [];
    for (let i = 0; i < 52; i++) if (!known.has(i)) rest.push(i);
    const need = 5 - board.length;
    const draws = need + numOpp * 2;
    if (draws > rest.length) return 0.5;
    let total = 0;
    for (let s = 0; s < samples; s++) {
      for (let i = 0; i < draws; i++) {
        const j = i + Math.floor(rng.next() * (rest.length - i));
        const t = rest[i]; rest[i] = rest[j]; rest[j] = t;
      }
      const fullBoard = need > 0 ? board.concat(rest.slice(0, need)) : board;
      const mine = evaluateBest(hole.concat(fullBoard)).score;
      let beaten = false, ties = 0;
      for (let o = 0; o < numOpp; o++) {
        const a = rest[need + o * 2], b = rest[need + o * 2 + 1];
        const sc = evaluateBest([a, b].concat(fullBoard)).score;
        if (sc > mine) { beaten = true; break; }
        if (sc === mine) ties++;
      }
      if (!beaten) total += 1 / (ties + 1);
    }
    return total / samples;
  }

  /* ======================================================================
   * 4. UTILITAIRES
   * ==================================================================== */
  class PokerError extends Error {
    constructor(code, message, extra) { super(message); this.name = 'PokerError'; this.code = code; if (extra) Object.assign(this, extra); }
  }
  const fail = (code, message, extra) => Object.assign({ ok: false, code, message }, extra || {});
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  class Emitter {
    constructor() { this._h = {}; }
    on(evt, fn) { (this._h[evt] || (this._h[evt] = [])).push(fn); return () => this.off(evt, fn); }
    off(evt, fn) { const l = this._h[evt]; if (l) this._h[evt] = l.filter((f) => f !== fn); }
    once(evt, fn) { const off = this.on(evt, (e) => { off(); fn(e); }); return off; }
    emit(evt, data) {
      const l = this._h[evt];
      if (l) l.slice().forEach((fn) => { try { fn(data); } catch (err) { if (typeof console !== 'undefined') console.error('[PokerEngine] listener error', evt, err); } });
      if (evt !== '*') { const all = this._h['*']; if (all) all.slice().forEach((fn) => { try { fn(evt, data); } catch (e) { /* ignore */ } }); }
    }
  }

  /** Construit les pots (principal + annexes) à partir des contributions. */
  function buildPots(players) {
    const contenders = players.filter((p) => !p.folded && p.totalBet > 0);
    const levels = Array.from(new Set(contenders.map((p) => p.totalBet))).sort((a, b) => a - b);
    const pots = [];
    let prev = 0, assigned = 0;
    for (const lvl of levels) {
      let amount = 0;
      for (const p of players) amount += Math.max(0, Math.min(p.totalBet, lvl) - prev);
      const eligible = contenders.filter((p) => p.totalBet >= lvl).map((p) => p.id);
      const last = pots[pots.length - 1];
      if (last && last.eligible.length === eligible.length && last.eligible.every((id, i) => id === eligible[i])) last.amount += amount;
      else pots.push({ amount, eligible });
      prev = lvl; assigned += amount;
    }
    const total = players.reduce((s, p) => s + p.totalBet, 0);
    const leftover = total - assigned;
    if (leftover > 0 && pots.length) pots[pots.length - 1].amount += leftover;
    return pots.filter((p) => p.amount > 0);
  }

  /* ======================================================================
   * 5. BOTS
   * ==================================================================== */
  const BOT_LEVELS = {
    easy:   { samples: 80,  noise: 0.14, bluff: 0.03, aggr: 0.35, callBias: 0.06 },
    medium: { samples: 200, noise: 0.07, bluff: 0.07, aggr: 0.55, callBias: 0.02 },
    hard:   { samples: 450, noise: 0.03, bluff: 0.12, aggr: 0.75, callBias: 0.0 }
  };

  function botDecide(engine, p, levelName) {
    const L = BOT_LEVELS[levelName] || BOT_LEVELS.medium;
    const legal = engine._legalFor(p);
    const rng = engine._botRng;
    const opps = engine._players().filter((o) => o.inHand && !o.folded && o.id !== p.id).length;
    const eq = estimateEquity(p.hole, engine.board, opps, L.samples, rng);
    const pot = engine._potTotal();
    const toCall = legal.callAmount;
    let adj = eq + (rng.next() * 2 - 1) * L.noise;
    if (levelName === 'hard' && opps >= 1) {
      // bonus de position léger : plus on parle tard, plus on peut jouer large
      const order = engine._players().filter((o) => o.inHand && !o.folded);
      const pos = order.findIndex((o) => o.id === p.id);
      adj += (pos / Math.max(1, order.length - 1)) * 0.03;
    }
    if (toCall > 0) adj -= Math.min(0.12, (toCall / (pot + 1)) * 0.12) * (opps > 1 ? 1 : 0.7);
    const potOdds = toCall / (pot + toCall || 1);
    const stack = p.chips;
    const sizeTo = (frac) => clamp(engine.currentBet + Math.round((pot + toCall) * frac), legal.minRaiseTo, legal.maxRaiseTo);
    const raiseOrShove = (to) => {
      if (to >= legal.maxRaiseTo || (to - p.bet) >= stack * 0.6) return { type: 'allin' };
      return { type: engine.currentBet === 0 ? 'bet' : 'raise', amount: to };
    };
    if (toCall === 0) {
      if (legal.canRaise) {
        if (adj > 0.72 && rng.next() < L.aggr + 0.2) return raiseOrShove(sizeTo(0.6 + rng.next() * 0.4));
        if (adj > 0.55 && rng.next() < L.aggr) return raiseOrShove(sizeTo(0.4 + rng.next() * 0.3));
        if (adj < 0.4 && opps <= 2 && rng.next() < L.bluff) return raiseOrShove(sizeTo(0.5));
      }
      return { type: 'check' };
    }
    if (legal.canRaise && adj > 0.78 && rng.next() < L.aggr) return raiseOrShove(sizeTo(0.7 + rng.next() * 0.5));
    if (legal.canRaise && adj > 0.35 && toCall < pot * 0.5 && rng.next() < L.bluff * 0.5) return raiseOrShove(sizeTo(0.7));
    if (adj > potOdds + 0.03 - L.callBias) return { type: 'call' };
    if (toCall <= Math.max(1, stack * 0.03) && adj > potOdds - 0.08) return { type: 'call' };
    return { type: 'fold' };
  }

  /* ======================================================================
   * 6. MOTEUR
   * ==================================================================== */
  const BETTING_PHASES = ['preflop', 'flop', 'turn', 'river'];

  class PokerEngine extends Emitter {
    constructor(config) {
      super();
      const c = this.config = Object.assign({
        maxSeats: 9,
        smallBlind: 10,
        bigBlind: 20,
        ante: 0,
        startingChips: 1000,
        structure: 'nolimit',        // 'nolimit' | 'potlimit'
        seed: null,                  // null = aléatoire sécurisé ; sinon reproductible
        autoRebuy: false,            // mode cash : racheter automatiquement les joueurs à 0
        rebuyChips: null,            // défaut = startingChips
        blindLevels: null,           // [{smallBlind,bigBlind,ante}] pour le mode tournoi
        handsPerLevel: 10,
        burnCards: true,
        revealOnUncontested: false,  // montrer les cartes du gagnant si tout le monde s'est couché
        turnTimeMs: 0,               // 0 = pas de limite (le chrono est géré par l'UI via turnDeadline)
        historySize: 20,
        now: null
      }, config || {});
      if (!Number.isInteger(c.maxSeats) || c.maxSeats < 2 || c.maxSeats > 10) throw new PokerError('BAD_CONFIG', 'maxSeats doit être entre 2 et 10');
      if (!(c.bigBlind > 0) || !(c.smallBlind > 0) || c.smallBlind > c.bigBlind) throw new PokerError('BAD_CONFIG', 'Blinds invalides');
      if (c.structure !== 'nolimit' && c.structure !== 'potlimit') throw new PokerError('BAD_CONFIG', 'structure inconnue');
      this._now = typeof c.now === 'function' ? c.now : Date.now;
      this.rng = createRng(c.seed);
      this._botRng = createRng(c.seed === null || c.seed === undefined ? null : (hashSeed(c.seed) ^ 0x9e3779b9));
      this.seats = new Array(c.maxSeats).fill(null);
      this.phase = 'waiting';       // waiting | preflop | flop | turn | river | showdown | handOver
      this.handNumber = 0;
      this.levelIndex = 0;
      this.dealerSeat = -1; this.sbSeat = -1; this.bbSeat = -1; this.currentSeat = -1;
      this.board = []; this.deck = [];
      this.collected = 0; this.currentBet = 0; this.minRaise = c.bigBlind;
      this.blinds = this._levelBlinds(0);
      this.lastResult = null; this.history = []; this._log = null;
      this.turnStartedAt = null; this.allInRunout = false;
    }

    /* ---------------- Joueurs ---------------- */
    addPlayer(opts, seat) {
      if (!opts || opts.id === undefined || opts.id === null) throw new PokerError('BAD_PLAYER', 'id requis');
      if (this._byId(opts.id)) throw new PokerError('DUPLICATE_ID', 'id déjà utilisé: ' + opts.id);
      const chips = opts.chips === undefined ? this.config.startingChips : opts.chips;
      if (!Number.isInteger(chips) || chips <= 0) throw new PokerError('BAD_CHIPS', 'chips doit être un entier > 0');
      if (seat === undefined || seat === null) seat = this.seats.findIndex((s) => s === null);
      if (!Number.isInteger(seat) || seat < 0 || seat >= this.seats.length) throw new PokerError('NO_SEAT', 'Aucune place libre');
      if (this.seats[seat]) throw new PokerError('SEAT_TAKEN', 'Place occupée: ' + seat);
      const p = {
        id: opts.id, name: opts.name || String(opts.id), seat, chips,
        isBot: !!opts.isBot, botLevel: opts.botLevel || 'medium', avatar: opts.avatar || null, meta: opts.meta || null,
        sittingOut: false, busted: false, leaving: false, rebuys: 0,
        inHand: false, hole: [], bet: 0, totalBet: 0, folded: false, allIn: false,
        hasActed: false, lastCB: null, lastAction: null, revealed: false
      };
      this.seats[seat] = p;
      this.emit('playerJoin', { playerId: p.id, seat });
      this.emit('update', null);
      return this._publicPlayer(p, null, {});
    }

    removePlayer(id) {
      const p = this._byId(id);
      if (!p) return fail('UNKNOWN_PLAYER', 'Joueur inconnu');
      if (this._handRunning() && p.inHand) {
        p.leaving = true;
        if (!p.folded) {
          if (this.currentSeat === p.seat) this.act(id, { type: 'fold' });
          else {
            p.folded = true; p.lastAction = 'fold';
            this._logAction(p, { type: 'fold', amount: 0 });
            this.emit('action', { playerId: p.id, type: 'fold', amount: 0, phase: this.phase });
            const live = this._contenders();
            if (live.length === 1) this._awardUncontested(live[0]);
          }
        }
        return { ok: true, deferred: true };
      }
      this.seats[p.seat] = null;
      this.emit('playerLeave', { playerId: id, seat: p.seat });
      this.emit('update', null);
      return { ok: true };
    }

    sitOut(id, value) {
      const p = this._byId(id);
      if (!p) return fail('UNKNOWN_PLAYER', 'Joueur inconnu');
      p.sittingOut = value === undefined ? true : !!value;
      this.emit('update', null);
      return { ok: true };
    }

    /** Ajoute des jetons / rachète un joueur (hors main en cours pour ce joueur). */
    rebuy(id, amount) {
      const p = this._byId(id);
      if (!p) return fail('UNKNOWN_PLAYER', 'Joueur inconnu');
      if (this._handRunning() && p.inHand) return fail('IN_HAND', 'Impossible pendant la main');
      const a = amount === undefined ? (this.config.rebuyChips || this.config.startingChips) : amount;
      if (!Number.isInteger(a) || a <= 0) return fail('INVALID_AMOUNT', 'Montant invalide');
      p.chips += a; p.rebuys++; p.busted = false;
      this.emit('rebuy', { playerId: id, amount: a });
      this.emit('update', null);
      return { ok: true, chips: p.chips };
    }

    canStartHand() {
      return !this._handRunning() && this._players().filter((p) => !p.sittingOut && !p.busted && p.chips > 0).length >= 2;
    }

    /* ---------------- Démarrage d'une main ---------------- */
    startHand() {
      if (this._handRunning()) return fail('HAND_IN_PROGRESS', 'Une main est déjà en cours');
      const elig = this._players().filter((p) => !p.sittingOut && !p.busted && p.chips > 0);
      if (elig.length < 2) return fail('NOT_ENOUGH_PLAYERS', 'Il faut au moins 2 joueurs avec des jetons');

      const levels = this.config.blindLevels;
      if (levels && levels.length && this.handNumber > 0 && this.handNumber % this.config.handsPerLevel === 0) {
        const next = Math.min(levels.length - 1, this.levelIndex + 1);
        if (next !== this.levelIndex) { this.levelIndex = next; this.blinds = this._levelBlinds(next); this.emit('levelUp', { level: next + 1, blinds: Object.assign({}, this.blinds) }); }
      }
      this.handNumber++;
      this._players().forEach((p) => {
        p.hole = []; p.bet = 0; p.totalBet = 0; p.folded = false; p.allIn = false; p.hasActed = false;
        p.lastCB = null; p.lastAction = null; p.revealed = false; p.inHand = false;
      });
      elig.forEach((p) => { p.inHand = true; });
      this.board = []; this.collected = 0; this.currentBet = 0; this.minRaise = this.blinds.bigBlind;
      this.allInRunout = false; this.lastResult = null; this.currentSeat = -1;

      // bouton
      if (this.dealerSeat < 0 || !this.seats[this.dealerSeat]) this.dealerSeat = elig[Math.floor(this.rng.next() * elig.length)].seat;
      else this.dealerSeat = this._nextSeat(this.dealerSeat, (p) => p.inHand);
      if (this.dealerSeat < 0) this.dealerSeat = elig[0].seat;
      if (elig.length === 2) { this.sbSeat = this.dealerSeat; this.bbSeat = this._nextSeat(this.dealerSeat, (p) => p.inHand); }
      else { this.sbSeat = this._nextSeat(this.dealerSeat, (p) => p.inHand); this.bbSeat = this._nextSeat(this.sbSeat, (p) => p.inHand); }

      this.deck = shuffle(newDeck(), this.rng);
      this._log = {
        handNumber: this.handNumber, dealerSeat: this.dealerSeat, sbSeat: this.sbSeat, bbSeat: this.bbSeat,
        blinds: Object.assign({}, this.blinds),
        players: elig.map((p) => ({ id: p.id, name: p.name, seat: p.seat, startChips: p.chips })),
        actions: [], board: [], result: null
      };
      this.phase = 'preflop';
      this.emit('handStart', { handNumber: this.handNumber, dealerSeat: this.dealerSeat, sbSeat: this.sbSeat, bbSeat: this.bbSeat, blinds: Object.assign({}, this.blinds) });

      // antes (argent mort)
      if (this.blinds.ante > 0) {
        elig.forEach((p) => {
          const a = Math.min(this.blinds.ante, p.chips);
          p.chips -= a; p.totalBet += a; this.collected += a;
          if (p.chips === 0) p.allIn = true;
        });
      }
      // blinds
      const sb = this.seats[this.sbSeat], bb = this.seats[this.bbSeat];
      const sbAmt = Math.min(this.blinds.smallBlind, sb.chips);
      const bbAmt = Math.min(this.blinds.bigBlind, bb.chips);
      this._commit(sb, sbAmt); this._commit(bb, bbAmt);
      this.currentBet = Math.max(sbAmt, bbAmt);
      this.emit('blinds', { smallBlind: { playerId: sb.id, amount: sbAmt }, bigBlind: { playerId: bb.id, amount: bbAmt }, ante: this.blinds.ante });

      // distribution (2 tours, à partir de la gauche du bouton)
      for (let round = 0; round < 2; round++) {
        let s = this.dealerSeat;
        for (let i = 0; i < this.seats.length; i++) {
          s = (s + 1) % this.seats.length;
          const p = this.seats[s];
          if (p && p.inHand) p.hole.push(this._draw());
        }
      }
      elig.forEach((p) => this.emit('holeCards', { playerId: p.id, cards: p.hole.map(cardToString) }));
      this._beginAction(this.bbSeat);
      this.emit('update', null);
      return { ok: true, handNumber: this.handNumber };
    }

    /* ---------------- Actions ---------------- */
    /**
     * @param {*} id  id du joueur
     * @param {{type:'fold'|'check'|'call'|'bet'|'raise'|'allin', amount?:number}} action
     *   amount = total "relancer À" sur le tour de mise courant (pas l'incrément).
     */
    act(id, action) {
      const p = this._byId(id);
      if (!p) return fail('UNKNOWN_PLAYER', 'Joueur inconnu');
      if (!this._bettingOpen()) return fail('NO_BETTING', 'Aucun tour de mise en cours');
      if (this.currentSeat !== p.seat) return fail('NOT_YOUR_TURN', 'Ce n’est pas votre tour');
      if (!action || typeof action !== 'object') return fail('INVALID_ACTION', 'Action invalide');
      const L = this._legalFor(p);
      const type = String(action.type || '').toLowerCase();
      let rec;
      if (type === 'fold') {
        p.folded = true; rec = { type: 'fold', amount: 0 };
      } else if (type === 'check') {
        if (!L.canCheck) return fail('CANNOT_CHECK', 'Impossible de checker : il faut suivre ou se coucher');
        rec = { type: 'check', amount: 0 };
      } else if (type === 'call') {
        if (!L.canCall) return fail('NOTHING_TO_CALL', 'Rien à suivre');
        this._commit(p, L.callAmount);
        rec = { type: 'call', amount: L.callAmount, allIn: p.allIn };
      } else if (type === 'bet' || type === 'raise' || type === 'allin') {
        let to;
        if (type === 'allin') {
          if (!L.canAllIn) return fail('CANNOT_ALL_IN', 'All-in impossible (relance non rouverte)');
          if (!L.canRaise) { this._commit(p, L.callAmount); rec = { type: 'call', amount: L.callAmount, allIn: true }; }
          else to = L.maxRaiseTo;
        } else {
          to = Number(action.amount);
          if (!Number.isInteger(to)) return fail('INVALID_AMOUNT', 'Montant invalide (entier requis)');
        }
        if (!rec) {
          if (!L.canRaise) return fail('RAISE_NOT_ALLOWED', 'Relance impossible (jetons insuffisants ou action non rouverte)');
          if (to > L.maxRaiseTo) return fail('RAISE_TOO_LARGE', 'Mise trop élevée (max ' + L.maxRaiseTo + ')', { max: L.maxRaiseTo });
          if (to < L.minRaiseTo) return fail('RAISE_TOO_SMALL', 'Mise trop faible (min ' + L.minRaiseTo + ')', { min: L.minRaiseTo });
          const raiseSize = to - this.currentBet;
          const wasBet = this.currentBet === 0;
          this._commit(p, to - p.bet);
          const full = raiseSize >= this.minRaise;
          if (full) this.minRaise = raiseSize;
          this.currentBet = to;
          rec = { type: wasBet ? 'bet' : 'raise', amount: to, allIn: p.allIn, full };
        }
      } else {
        return fail('UNKNOWN_ACTION', 'Action inconnue: ' + type);
      }
      p.hasActed = true;
      p.lastCB = this.currentBet;
      p.lastAction = rec.type;
      this._logAction(p, rec);
      this.emit('action', Object.assign({ playerId: p.id, phase: this.phase }, rec));
      this._advance(p.seat);
      this.emit('update', null);
      return { ok: true, action: rec };
    }

    /** Action automatique (timeout) : check si possible, sinon fold. */
    autoAct(id) {
      const p = this._byId(id);
      if (!p) return fail('UNKNOWN_PLAYER', 'Joueur inconnu');
      if (this.currentSeat !== p.seat) return fail('NOT_YOUR_TURN', 'Ce n’est pas votre tour');
      return this.act(id, { type: this._legalFor(p).canCheck ? 'check' : 'fold' });
    }

    /** Actions légales pour le joueur dont c'est le tour (sinon null). */
    getLegalActions(id) {
      const p = this._byId(id);
      if (!p || !this._bettingOpen() || this.currentSeat !== p.seat) return null;
      return this._legalFor(p);
    }

    /* ---------------- Bots ---------------- */
    /** Calcule (sans l'appliquer) l'action du bot. */
    getBotAction(id) {
      const p = this._byId(id);
      if (!p || !this._bettingOpen() || this.currentSeat !== p.seat) return null;
      return botDecide(this, p, p.botLevel);
    }
    /** Joue une action pour le joueur courant s'il est un bot. */
    stepBot() {
      const p = this.seats[this.currentSeat];
      if (!p || !p.isBot || !this._bettingOpen()) return null;
      let a = botDecide(this, p, p.botLevel);
      let r = this.act(p.id, a);
      if (!r.ok) r = this.autoAct(p.id); // filet de sécurité
      return r.ok ? Object.assign({ playerId: p.id }, r.action) : r;
    }
    /** Joue tous les bots consécutifs (synchrone). Pour l'UI, préférer stepBot() avec un délai. */
    runBots(maxSteps) {
      const out = [];
      for (let i = 0; i < (maxSteps || 200); i++) { const r = this.stepBot(); if (!r) break; out.push(r); }
      return out;
    }

    /* ---------------- Vue / état ---------------- */
    getState(viewerId, opts) {
      opts = opts || {};
      const L = (viewerId !== undefined && viewerId !== null) ? this.getLegalActions(viewerId) : null;
      const cur = this.seats[this.currentSeat];
      return {
        phase: this.phase, handNumber: this.handNumber, level: this.levelIndex + 1,
        blinds: Object.assign({}, this.blinds),
        dealerSeat: this.dealerSeat, smallBlindSeat: this.sbSeat, bigBlindSeat: this.bbSeat,
        currentSeat: this.currentSeat, currentPlayerId: cur ? cur.id : null,
        board: this.board.map(cardToString),
        pot: this._potTotal(), pots: this._livePots(),
        currentBet: this.currentBet, minRaise: this.minRaise,
        players: this.seats.map((p) => (p ? this._publicPlayer(p, viewerId, opts) : null)),
        legal: L,
        myHand: this._myHandLabel(viewerId),
        result: this.phase === 'handOver' ? this.lastResult : null,
        turnDeadline: (this.config.turnTimeMs > 0 && this.turnStartedAt && this._bettingOpen()) ? this.turnStartedAt + this.config.turnTimeMs : null,
        allInRunout: this.allInRunout
      };
    }
    getPlayer(id) { const p = this._byId(id); return p ? this._publicPlayer(p, id, {}) : null; }
    getHistory() { return this.history.slice(); }
    getCurrentHandLog() { return this._log ? JSON.parse(JSON.stringify(this._log)) : null; }

    /* ---------------- Sauvegarde / restauration ---------------- */
    toJSON() {
      const cfg = Object.assign({}, this.config); delete cfg.now;
      return {
        v: 1, config: cfg,
        seats: this.seats.map((p) => (p ? Object.assign({}, p, { hole: p.hole.slice() }) : null)),
        phase: this.phase, handNumber: this.handNumber, levelIndex: this.levelIndex,
        dealerSeat: this.dealerSeat, sbSeat: this.sbSeat, bbSeat: this.bbSeat, currentSeat: this.currentSeat,
        board: this.board.slice(), deck: this.deck.slice(), collected: this.collected,
        currentBet: this.currentBet, minRaise: this.minRaise, blinds: Object.assign({}, this.blinds),
        lastResult: this.lastResult, history: this.history, log: this._log, allInRunout: this.allInRunout,
        rngState: this.rng.getState()
      };
    }
    static fromJSON(data, overrides) {
      const d = typeof data === 'string' ? JSON.parse(data) : data;
      if (!d || d.v !== 1) throw new PokerError('BAD_SNAPSHOT', 'Snapshot invalide');
      const e = new PokerEngine(Object.assign({}, d.config, overrides || {}));
      e.seats = d.seats.map((p) => (p ? Object.assign({}, p, { hole: p.hole.slice() }) : null));
      ['phase', 'handNumber', 'levelIndex', 'dealerSeat', 'sbSeat', 'bbSeat', 'currentSeat', 'collected', 'currentBet', 'minRaise', 'lastResult', 'history', 'allInRunout']
        .forEach((k) => { e[k] = d[k]; });
      e.board = d.board.slice(); e.deck = d.deck.slice(); e.blinds = Object.assign({}, d.blinds); e._log = d.log;
      if (d.rngState !== null && d.rngState !== undefined && e.config.seed !== null && e.config.seed !== undefined) e.rng.setState(d.rngState);
      e.turnStartedAt = e._bettingOpen() ? e._now() : null;
      return e;
    }

    /* ======================================================================
     * Interne
     * ==================================================================== */
    _levelBlinds(i) {
      const lv = this.config.blindLevels && this.config.blindLevels[i];
      return lv ? { smallBlind: lv.smallBlind, bigBlind: lv.bigBlind, ante: lv.ante || 0 }
                : { smallBlind: this.config.smallBlind, bigBlind: this.config.bigBlind, ante: this.config.ante || 0 };
    }
    _players() { return this.seats.filter(Boolean); }
    _byId(id) { return this.seats.find((p) => p && p.id === id) || null; }
    _handRunning() { return BETTING_PHASES.indexOf(this.phase) >= 0 || this.phase === 'showdown'; }
    _bettingOpen() { return BETTING_PHASES.indexOf(this.phase) >= 0 && this.currentSeat >= 0; }
    _contenders() { return this._players().filter((p) => p.inHand && !p.folded); }
    _potTotal() { return this.collected + this._players().reduce((s, p) => s + p.bet, 0); }
    _livePots() { return buildPots(this._players().filter((p) => p.inHand)); }
    _draw() { if (!this.deck.length) throw new PokerError('DECK_EMPTY', 'Paquet vide'); return this.deck.pop(); }
    _nextSeat(from, pred) {
      const n = this.seats.length;
      for (let i = 1; i <= n; i++) { const s = (from + i) % n; const p = this.seats[s]; if (p && pred(p)) return s; }
      return -1;
    }
    _commit(p, amount) {
      amount = Math.min(amount, p.chips);
      p.chips -= amount; p.bet += amount; p.totalBet += amount;
      if (p.chips === 0) p.allIn = true;
    }
    _needsToAct(p) { return p.inHand && !p.folded && !p.allIn && (!p.hasActed || p.bet < this.currentBet); }
    _nextToAct(from) {
      const ablers = this._players().filter((p) => p.inHand && !p.folded && !p.allIn);
      if (ablers.length === 0) return -1;
      if (ablers.length === 1 && ablers[0].bet >= this.currentBet) return -1; // plus personne contre qui miser
      return this._nextSeat(from, (p) => this._needsToAct(p));
    }

    _legalFor(p) {
      const toCall = Math.max(0, this.currentBet - p.bet);
      const callAmount = Math.min(toCall, p.chips);
      const maxTo = p.bet + p.chips;
      const othersCanAct = this._players().some((o) => o.id !== p.id && o.inHand && !o.folded && !o.allIn);
      const reopened = p.lastCB === null || (this.currentBet - p.lastCB) >= this.minRaise;
      const canRaise = p.chips > toCall && othersCanAct && reopened;
      let maxRaiseTo = maxTo;
      if (this.config.structure === 'potlimit') maxRaiseTo = Math.min(maxTo, this.currentBet + this._potTotal() + toCall);
      const minRaiseTo = Math.min(this.currentBet + this.minRaise, maxRaiseTo);
      const canAllIn = p.chips > 0 && (p.chips <= toCall || canRaise);
      const actions = ['fold'];
      if (toCall === 0) actions.push('check');
      if (toCall > 0 && p.chips > 0) actions.push('call');
      if (canRaise) actions.push(this.currentBet === 0 ? 'bet' : 'raise');
      if (canAllIn) actions.push('allin');
      return {
        playerId: p.id, actions, toCall, callAmount,
        canCheck: toCall === 0, canCall: toCall > 0 && p.chips > 0,
        canRaise, canBet: canRaise && this.currentBet === 0, canAllIn,
        minRaiseTo: canRaise ? minRaiseTo : null, maxRaiseTo: canRaise ? maxRaiseTo : null,
        allInAmount: maxTo, potSize: this._potTotal(),
        currentBet: this.currentBet, playerBet: p.bet
      };
    }

    _beginAction(fromSeat) {
      const next = this._nextToAct(fromSeat);
      if (next < 0) { this._endBettingRound(); return; }
      this.currentSeat = next;
      this.turnStartedAt = this._now();
      const p = this.seats[next];
      this.emit('turn', { playerId: p.id, seat: next, phase: this.phase, deadline: this.config.turnTimeMs > 0 ? this.turnStartedAt + this.config.turnTimeMs : null });
    }

    _advance(fromSeat) {
      const live = this._contenders();
      if (live.length === 1) { this._awardUncontested(live[0]); return; }
      this._beginAction(fromSeat);
    }

    _refundUncalled() {
      const withBets = this._players().filter((p) => p.bet > 0).sort((a, b) => b.bet - a.bet);
      if (!withBets.length) return;
      const top = withBets[0];
      const second = withBets[1] ? withBets[1].bet : 0;
      if (top.bet > second) {
        const diff = top.bet - second;
        top.chips += diff; top.bet -= diff; top.totalBet -= diff;
        this.emit('refund', { playerId: top.id, amount: diff });
      }
    }

    _endBettingRound() {
      this.currentSeat = -1;
      this._refundUncalled();
      this._players().forEach((p) => { this.collected += p.bet; p.bet = 0; p.hasActed = false; p.lastCB = null; });
      this.currentBet = 0; this.minRaise = this.blinds.bigBlind;
      if (this.phase === 'river') { this._showdown(); return; }
      const ablers = this._contenders().filter((p) => !p.allIn).length;
      if (ablers <= 1) { this._runout(); return; }
      this._dealStreet();
      this._beginAction(this.dealerSeat);
    }

    _dealStreet() {
      if (this.config.burnCards) this._draw();
      const count = this.phase === 'preflop' ? 3 : 1;
      const cards = [];
      for (let i = 0; i < count; i++) cards.push(this._draw());
      this.board = this.board.concat(cards);
      this.phase = this.board.length === 3 ? 'flop' : this.board.length === 4 ? 'turn' : 'river';
      if (this._log) this._log.board = this.board.map(cardToString);
      this.emit('street', { phase: this.phase, cards: cards.map(cardToString), board: this.board.map(cardToString) });
    }

    _runout() {
      this.allInRunout = true;
      this._contenders().forEach((p) => { p.revealed = true; });
      this.emit('runout', { hands: this._contenders().map((p) => ({ playerId: p.id, cards: p.hole.map(cardToString) })) });
      while (this.phase !== 'river') this._dealStreet();
      this._showdown();
    }

    _awardUncontested(winner) {
      const all = this._players().filter((p) => p.inHand);
      const total = all.reduce((s, p) => s + p.totalBet, 0);
      winner.chips += total;
      all.forEach((p) => { p.bet = 0; });
      this.collected = 0; this.currentSeat = -1;
      if (this.config.revealOnUncontested) winner.revealed = true;
      const result = {
        handNumber: this.handNumber, showdown: false, board: this.board.map(cardToString),
        pots: [{ amount: total, eligible: [winner.id], winners: [{ playerId: winner.id, amount: total }], hand: null }],
        players: all.map((p) => ({ id: p.id, folded: p.folded, hole: p.revealed ? p.hole.map(cardToString) : null, hand: null, won: p.id === winner.id ? total : 0, net: (p.id === winner.id ? total : 0) - p.totalBet }))
      };
      this.emit('potAwarded', { playerId: winner.id, amount: total, uncontested: true });
      this._finishHand(result);
    }

    _showdown() {
      this.phase = 'showdown';
      this.currentSeat = -1;
      const all = this._players().filter((p) => p.inHand);
      const contenders = all.filter((p) => !p.folded);
      contenders.forEach((p) => { p.revealed = true; });
      const evals = {};
      contenders.forEach((p) => { evals[p.id] = evaluateBest(p.hole.concat(this.board)); });
      const pots = buildPots(all);
      const winnings = {};
      const potResults = pots.map((pot) => {
        const elig = contenders.filter((p) => pot.eligible.indexOf(p.id) >= 0);
        let best = -1;
        elig.forEach((p) => { if (evals[p.id].score > best) best = evals[p.id].score; });
        const winners = elig.filter((p) => evals[p.id].score === best);
        const n = this.seats.length;
        winners.sort((a, b) => (((a.seat - this.dealerSeat - 1) + n) % n) - (((b.seat - this.dealerSeat - 1) + n) % n));
        const share = Math.floor(pot.amount / winners.length);
        const rem = pot.amount - share * winners.length;
        const wl = winners.map((p, i) => {
          const amt = share + (i < rem ? 1 : 0);
          winnings[p.id] = (winnings[p.id] || 0) + amt;
          return { playerId: p.id, amount: amt };
        });
        return { amount: pot.amount, eligible: pot.eligible.slice(), winners: wl, hand: evals[winners[0].id].label };
      });
      all.forEach((p) => { if (winnings[p.id]) p.chips += winnings[p.id]; p.bet = 0; });
      this.collected = 0;
      const result = {
        handNumber: this.handNumber, showdown: true, board: this.board.map(cardToString), pots: potResults,
        players: all.map((p) => ({
          id: p.id, folded: p.folded,
          hole: p.revealed ? p.hole.map(cardToString) : null,
          hand: evals[p.id] ? { label: evals[p.id].label, key: evals[p.id].key, cards: evals[p.id].cards.map(cardToString), royal: evals[p.id].royal } : null,
          won: winnings[p.id] || 0, net: (winnings[p.id] || 0) - p.totalBet
        }))
      };
      potResults.forEach((pr) => pr.winners.forEach((w) => this.emit('potAwarded', { playerId: w.playerId, amount: w.amount, hand: pr.hand, uncontested: false })));
      this.emit('showdown', result);
      this._finishHand(result);
    }

    _finishHand(result) {
      this.phase = 'handOver';
      this.currentSeat = -1;
      this.lastResult = result;
      if (this._log) {
        this._log.result = JSON.parse(JSON.stringify(result));
        this.history.push(this._log);
        while (this.history.length > this.config.historySize) this.history.shift();
      }
      this._players().forEach((p) => {
        if (p.inHand && p.chips === 0) {
          if (this.config.autoRebuy && !p.leaving) {
            const a = this.config.rebuyChips || this.config.startingChips;
            p.chips = a; p.rebuys++;
            this.emit('rebuy', { playerId: p.id, amount: a, auto: true });
          } else { p.busted = true; this.emit('bust', { playerId: p.id }); }
        }
      });
      this._players().forEach((p) => {
        if (p.leaving) { this.seats[p.seat] = null; this.emit('playerLeave', { playerId: p.id, seat: p.seat }); }
      });
      this.emit('handEnd', result);
      this.emit('update', null);
    }

    _logAction(p, rec) {
      if (!this._log) return;
      this._log.actions.push({ phase: this.phase, playerId: p.id, type: rec.type, amount: rec.amount || 0, allIn: !!rec.allIn });
    }

    _myHandLabel(viewerId) {
      if (viewerId === undefined || viewerId === null) return null;
      const p = this._byId(viewerId);
      if (!p || !p.inHand || p.folded || p.hole.length < 2) return null;
      return describeHand(p.hole.concat(this.board)).label;
    }

    _publicPlayer(p, viewerId, opts) {
      const mine = viewerId !== undefined && viewerId !== null && p.id === viewerId;
      const show = mine || p.revealed || opts.revealAll === true;
      return {
        id: p.id, name: p.name, seat: p.seat, avatar: p.avatar, meta: p.meta,
        chips: p.chips, bet: p.bet, totalBet: p.totalBet,
        isBot: p.isBot, botLevel: p.isBot ? p.botLevel : null,
        inHand: p.inHand, folded: p.folded, allIn: p.allIn, sittingOut: p.sittingOut, busted: p.busted, rebuys: p.rebuys,
        isDealer: p.seat === this.dealerSeat && this.handNumber > 0,
        isSmallBlind: p.inHand && p.seat === this.sbSeat, isBigBlind: p.inHand && p.seat === this.bbSeat,
        isCurrent: p.seat === this.currentSeat,
        lastAction: p.lastAction,
        holeCount: p.hole.length,
        hole: show && p.hole.length ? p.hole.map(cardToString) : null,
        revealed: p.revealed
      };
    }
  }

  /* ======================================================================
   * 7. API STATIQUE
   * ==================================================================== */
  PokerEngine.PokerError = PokerError;
  PokerEngine.cardToString = cardToString;
  PokerEngine.parseCard = parseCard;
  PokerEngine.cardInfo = cardInfo;
  PokerEngine.newDeck = newDeck;
  PokerEngine.evaluate = (cards) => evaluateBest(cards.map((c) => (typeof c === 'string' ? parseCard(c) : c)));
  PokerEngine.compareHands = (a, b) => PokerEngine.evaluate(a).score - PokerEngine.evaluate(b).score;
  PokerEngine.describeHand = (cards) => describeHand(cards.map((c) => (typeof c === 'string' ? parseCard(c) : c)));
  PokerEngine.equity = (hole, board, opponents, samples) => estimateEquity(
    hole.map((c) => (typeof c === 'string' ? parseCard(c) : c)),
    (board || []).map((c) => (typeof c === 'string' ? parseCard(c) : c)),
    opponents === undefined ? 1 : opponents, samples || 1000, createRng(null));
  PokerEngine.buildPots = buildPots;
  PokerEngine.BOT_LEVELS = BOT_LEVELS;
  PokerEngine.CATEGORIES = CATEGORIES;

  /**
   * Auto-test : évaluateur + simulation aléatoire avec contrôle de conservation des jetons.
   * @returns {{ok:boolean, errors:string[], hands:number}}
   */
  PokerEngine.selfTest = function (o) {
    o = o || {};
    const errors = [];
    const T = (c, m) => { if (!c) errors.push(m); };
    const ev = (s) => PokerEngine.evaluate(s.split(' '));

    T(ev('As Ks Qs Js Ts 2d 3c').royal, 'quinte flush royale');
    T(ev('As 2d 3c 4h 5s 9d Kc').key === 'straight' && ev('As 2d 3c 4h 5s 9d Kc').ranks[0] === 5, 'roue A-5');
    T(ev('As 2d 3c 4h 5s 9d Kc').score < ev('2d 3c 4h 5s 6s 9d Kc').score, 'roue < quinte au 6');
    T(ev('Ks Kd Kc 2s 2d 2h 9c').label === 'Full aux Rois et Deux', 'deux brelans → full');
    T(ev('9s 9d 9c 9h As 2d 3c').key === 'four-of-a-kind', 'carré');
    T(ev('As Ad Ks Kd Qs Qd 2c').label === 'Double paire As et Rois', '3 paires → top 2');
    T(ev('As Ad Ks Kd Qs Qd 2c').ranks[2] === 12, 'kicker dame');
    T(ev('2s 7s 9s Js Ks 3d 4c').key === 'flush', 'couleur');
    T(ev('2s 7s 9s Js Ks 8d Tc').key === 'flush', 'couleur vs quinte (7-8-9-T-J existe mais couleur gagne)');
    T(ev('As Kd 9c 7h 5s 3d 2c').key === 'high-card', 'carte haute');
    T(PokerEngine.compareHands(['As', 'Kd', '2c', '2h', '9s', '9d', '4c'], ['Qs', 'Qd', '2c', '2h', '9s', '9d', '4c']) === 0 ? false : true, 'kickers départagent');
    T(PokerEngine.compareHands(['Ah', '2d', 'Ks', 'Kd', '5c', '5h', '9s'], ['Qh', 'Jd', 'Ks', 'Kd', '5c', '5h', '9s']) > 0, 'kicker A > Q (double paire)');

    // pots annexes
    const bp = buildPots([
      { id: 'a', totalBet: 100, folded: false }, { id: 'b', totalBet: 300, folded: false },
      { id: 'c', totalBet: 300, folded: false }, { id: 'd', totalBet: 50, folded: true }]);
    T(bp.length === 2 && bp[0].amount === 350 && bp[1].amount === 400, 'side pots: ' + JSON.stringify(bp));

    // simulation
    const hands = o.hands || 300;
    const eng = new PokerEngine({ seed: o.seed === undefined ? 12345 : o.seed, smallBlind: 5, bigBlind: 10, ante: o.ante || 0, maxSeats: 9, structure: o.structure || 'nolimit' });
    const N = 6;
    for (let i = 0; i < N; i++) eng.addPlayer({ id: 'p' + i, chips: 100 + i * 137 });
    let expected = eng.seats.reduce((s, p) => s + (p ? p.chips : 0), 0);
    const rnd = createRng(o.seed === undefined ? 777 : o.seed + 1);
    let played = 0;
    for (let h = 0; h < hands; h++) {
      if (!eng.canStartHand()) {
        eng._players().forEach((p) => { if (p.chips === 0 || p.busted) { eng.rebuy(p.id, 250); expected += 250; } });
        if (!eng.canStartHand()) break;
      }
      const r = eng.startHand();
      if (!r.ok) { errors.push('startHand: ' + r.code); break; }
      played++;
      let guard = 0;
      while (eng.phase !== 'handOver' && guard++ < 500) {
        const cur = eng.seats[eng.currentSeat];
        if (!cur) { errors.push('phase ' + eng.phase + ' sans joueur courant'); break; }
        const L = eng.getLegalActions(cur.id);
        let res;
        const x = rnd.next();
        if (cur.isBot || x < 0.1) res = eng.stepBot ? eng.autoAct(cur.id) : null;
        else if (x < 0.25 && L.canAllIn) res = eng.act(cur.id, { type: 'allin' });
        else if (x < 0.5 && L.canRaise) res = eng.act(cur.id, { type: L.canBet ? 'bet' : 'raise', amount: L.minRaiseTo + Math.floor(rnd.next() * (L.maxRaiseTo - L.minRaiseTo + 1)) });
        else if (L.canCheck) res = eng.act(cur.id, { type: 'check' });
        else if (L.canCall) res = eng.act(cur.id, { type: x < 0.9 ? 'call' : 'fold' });
        else res = eng.act(cur.id, { type: 'fold' });
        if (!res.ok) { errors.push('action refusée: ' + res.code + ' ' + res.message); break; }
        const live = eng._players().reduce((s, p) => s + p.chips, 0) + eng._potTotal();
        if (live !== expected) { errors.push('chips non conservés en main ' + eng.handNumber + ': ' + live + ' vs ' + expected); break; }
      }
      if (guard >= 500) { errors.push('boucle infinie main ' + eng.handNumber); break; }
      const total = eng._players().reduce((s, p) => s + p.chips, 0);
      if (total !== expected) { errors.push('chips non conservés fin de main ' + eng.handNumber + ': ' + total + ' vs ' + expected); break; }
      if (eng._players().some((p) => p.chips < 0)) { errors.push('chips négatifs'); break; }
      if (errors.length) break;
    }
    // restauration
    const snap = JSON.stringify(eng);
    const e2 = PokerEngine.fromJSON(snap);
    T(JSON.stringify(e2) === snap, 'sérialisation stable');
    return { ok: errors.length === 0, errors, hands: played };
  };

  return PokerEngine;
});