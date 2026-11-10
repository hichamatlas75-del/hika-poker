/**
 * Hika-Poker - Gestionnaire de Persistance Locale (localStorage)
 * Gère le profil joueur, les jetons, l'historique et les statistiques.
 */

const STORAGE_KEYS = {
  PROFILE: 'hika_poker_profile',
  STATS: 'hika_poker_stats',
  SETTINGS: 'hika_poker_settings',
  WHEEL: 'hika_poker_wheel'
};

const DEFAULT_PROFILE = {
  id: 'player_user',
  name: 'Hika Champion',
  avatar: 'avatar_hero',
  chips: 20000,
  level: 1,
  xp: 0
};

const DEFAULT_STATS = {
  handsPlayed: 0,
  handsWon: 0,
  biggestPot: 0,
  bestHand: 'Aucune',
  tournamentsPlayed: 0,
  tournamentsWon: 0,
  totalWon: 0
};

const DEFAULT_SETTINGS = {
  soundEnabled: true,
  theme: 'green', // 'green' | 'blue' | 'red'
  animationSpeed: 'normal', // 'normal' | 'fast'
  autoCheck: false
};

class StorageManager {
  constructor() {
    this.profile = this.load(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE);
    this.stats = this.load(STORAGE_KEYS.STATS, DEFAULT_STATS);
    this.settings = this.load(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }

  load(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? Object.assign({}, fallback, JSON.parse(data)) : Object.assign({}, fallback);
    } catch (e) {
      console.warn('Erreur lecture localStorage:', key, e);
      return Object.assign({}, fallback);
    }
  }

  save(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn('Erreur écriture localStorage:', key, e);
    }
  }

  // Profil
  getProfile() {
    return Object.assign({}, this.profile);
  }

  setChips(amount) {
    this.profile.chips = Math.max(0, Math.floor(amount));
    this.save(STORAGE_KEYS.PROFILE, this.profile);
    return this.profile.chips;
  }

  addChips(delta) {
    this.profile.chips = Math.max(0, this.profile.chips + Math.floor(delta));
    if (delta > 0) {
      this.stats.totalWon += Math.floor(delta);
    }
    this.save(STORAGE_KEYS.PROFILE, this.profile);
    this.save(STORAGE_KEYS.STATS, this.stats);
    return this.profile.chips;
  }

  setName(name) {
    if (name && typeof name === 'string') {
      this.profile.name = name.trim().slice(0, 16);
      this.save(STORAGE_KEYS.PROFILE, this.profile);
    }
  }

  setAvatar(avatar) {
    this.profile.avatar = avatar;
    this.save(STORAGE_KEYS.PROFILE, this.profile);
  }

  addXP(amount) {
    this.profile.xp += amount;
    const required = this.profile.level * 500;
    if (this.profile.xp >= required) {
      this.profile.xp -= required;
      this.profile.level++;
      return { levelUp: true, level: this.profile.level };
    }
    this.save(STORAGE_KEYS.PROFILE, this.profile);
    return { levelUp: false, level: this.profile.level };
  }

  // Statistiques
  getStats() {
    return Object.assign({}, this.stats);
  }

  recordHand({ won, pot, handLabel }) {
    this.stats.handsPlayed++;
    if (won) {
      this.stats.handsWon++;
      if (pot > this.stats.biggestPot) {
        this.stats.biggestPot = pot;
      }
    }
    if (handLabel && (!this.stats.bestHand || this.stats.bestHand === 'Aucune')) {
      this.stats.bestHand = handLabel;
    }
    this.save(STORAGE_KEYS.STATS, this.stats);
  }

  recordTournament({ won, rank, prize }) {
    this.stats.tournamentsPlayed++;
    if (won || rank === 1) {
      this.stats.tournamentsWon++;
    }
    if (prize > 0) {
      this.addChips(prize);
    }
    this.save(STORAGE_KEYS.STATS, this.stats);
  }

  // Roue de la fortune
  getWheelState() {
    const data = this.load(STORAGE_KEYS.WHEEL, { lastSpin: 0 });
    const now = Date.now();
    const cooldownMs = 4 * 60 * 1000; // 4 minutes pour les tests confortables
    const diff = now - (data.lastSpin || 0);
    const canSpin = diff >= cooldownMs;
    const timeLeft = Math.max(0, cooldownMs - diff);
    return { canSpin, timeLeft, lastSpin: data.lastSpin };
  }

  recordWheelSpin() {
    this.save(STORAGE_KEYS.WHEEL, { lastSpin: Date.now() });
  }

  // Paramètres
  getSettings() {
    return Object.assign({}, this.settings);
  }

  updateSettings(newSettings) {
    Object.assign(this.settings, newSettings);
    this.save(STORAGE_KEYS.SETTINGS, this.settings);
    return this.settings;
  }
}

window.storageManager = new StorageManager();
