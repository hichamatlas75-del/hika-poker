/**
 * Hika-Poker - Gestionnaire de Persistance Locale & Synchronisation Cloud Supabase
 * Fournit un cache synchrone instantané et une synchronisation cloud asynchrone transparente.
 */

const STORAGE_KEYS = {
  PROFILE: 'hika_poker_profile',
  STATS: 'hika_poker_stats',
  SETTINGS: 'hika_poker_settings',
  WHEEL: 'hika_poker_wheel',
  HAND_HISTORY: 'hika_poker_hand_history',
  AUTH_MODE: 'hika_poker_auth_mode' // 'cloud' | 'guest'
};

const DEFAULT_PROFILE = {
  id: 'player_guest',
  name: 'Hika Champion',
  avatar: '👑',
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
  animationSpeed: 'normal',
  autoCheck: false
};

class StorageManager {
  constructor() {
    this.profile = this.load(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE);
    this.stats = this.load(STORAGE_KEYS.STATS, DEFAULT_STATS);
    this.settings = this.load(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    this.localHands = this.load(STORAGE_KEYS.HAND_HISTORY, []);
    this.syncTimeout = null;
    this.pendingSyncFields = {};
  }

  load(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? Object.assign({}, fallback, JSON.parse(data)) : (Array.isArray(fallback) ? [] : Object.assign({}, fallback));
    } catch (e) {
      console.warn('Erreur lecture localStorage:', key, e);
      return Array.isArray(fallback) ? [] : Object.assign({}, fallback);
    }
  }

  save(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn('Erreur écriture localStorage:', key, e);
    }
  }

  // =========================================================================
  // MÉTHODES SYNCHRONES DE GESTION DU PROFIL
  // =========================================================================

  getProfile() {
    return Object.assign({}, this.profile);
  }

  setChips(amount) {
    this.profile.chips = Math.max(0, Math.floor(amount));
    this.save(STORAGE_KEYS.PROFILE, this.profile);
    this.queueCloudSync({ chips: this.profile.chips });
    return this.profile.chips;
  }

  addChips(delta) {
    this.profile.chips = Math.max(0, this.profile.chips + Math.floor(delta));
    if (delta > 0) {
      this.stats.totalWon += Math.floor(delta);
    }
    this.save(STORAGE_KEYS.PROFILE, this.profile);
    this.save(STORAGE_KEYS.STATS, this.stats);
    
    // Déclenchement de la synchronisation cloud en tâche de fond
    this.queueCloudSync({ 
      chips: this.profile.chips, 
      total_won: this.stats.totalWon 
    });

    return this.profile.chips;
  }

  setName(name) {
    if (name && typeof name === 'string') {
      this.profile.name = name.trim().slice(0, 16);
      this.save(STORAGE_KEYS.PROFILE, this.profile);
      this.queueCloudSync({ username: this.profile.name });
    }
  }

  setAvatar(avatar) {
    this.profile.avatar = avatar || '👑';
    this.save(STORAGE_KEYS.PROFILE, this.profile);
    this.queueCloudSync({ avatar: this.profile.avatar });
  }

  addXP(amount) {
    this.profile.xp += amount;
    const required = this.profile.level * 500;
    let leveledUp = false;
    if (this.profile.xp >= required) {
      this.profile.xp -= required;
      this.profile.level++;
      leveledUp = true;
    }
    this.save(STORAGE_KEYS.PROFILE, this.profile);
    return { levelUp: leveledUp, level: this.profile.level };
  }

  // =========================================================================
  // MÉTHODES SYNCHRONES DE GESTION DES STATS & MAINS
  // =========================================================================

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

    // 1. Enregistrement local de la main (pour historique immédiat et mode invité)
    const handEntry = {
      id: Date.now(),
      gameMode: (window.app && window.app.gameMode) || 'cash',
      won: !!won,
      potAmount: pot || 0,
      handLabel: handLabel || null,
      createdAt: new Date().toISOString()
    };
    this.saveLocalHand(handEntry);

    // 2. Synchronisation Cloud Supabase en arrière-plan
    this.queueCloudSync({
      hands_played: this.stats.handsPlayed,
      hands_won: this.stats.handsWon,
      biggest_pot: this.stats.biggestPot,
      best_hand: this.stats.bestHand
    });

    this.insertCloudHandHistory(handEntry);
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

    this.queueCloudSync({
      tournaments_played: this.stats.tournamentsPlayed,
      tournaments_won: this.stats.tournamentsWon,
      chips: this.profile.chips
    });
  }

  // =========================================================================
  // ROUE DE LA FORTUNE (COOLDOWN CLOUD & LOCAL)
  // =========================================================================

  getWheelState() {
    const data = this.load(STORAGE_KEYS.WHEEL, { lastSpin: 0 });
    const now = Date.now();
    const cooldownMs = 4 * 60 * 1000; // 4 minutes
    const diff = now - (data.lastSpin || 0);
    const canSpin = diff >= cooldownMs;
    const timeLeft = Math.max(0, cooldownMs - diff);
    return { canSpin, timeLeft, lastSpin: data.lastSpin };
  }

  recordWheelSpin() {
    const now = Date.now();
    this.save(STORAGE_KEYS.WHEEL, { lastSpin: now });
    this.queueCloudSync({ wheel_last_spin: new Date(now).toISOString() });
  }

  // =========================================================================
  // HISTORIQUE LOCAL DES MAINS
  // =========================================================================

  saveLocalHand(handEntry) {
    if (!Array.isArray(this.localHands)) this.localHands = [];
    this.localHands.unshift(handEntry);
    if (this.localHands.length > 30) {
      this.localHands = this.localHands.slice(0, 30);
    }
    this.save(STORAGE_KEYS.HAND_HISTORY, this.localHands);
  }

  getLocalHandHistory() {
    return Array.isArray(this.localHands) ? this.localHands : [];
  }

  // =========================================================================
  // SYNCHRONISATION CLOUD SUPABASE (ASYNC EN ARRIÈRE-PLAN)
  // =========================================================================

  queueCloudSync(fields) {
    Object.assign(this.pendingSyncFields, fields);

    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.syncPendingToCloud();
    }, 400); // Débounce de 400ms pour regrouper les écritures rapprochées
  }

  async syncPendingToCloud() {
    if (!window.supabaseClient || !window.supabaseClient.isReady()) return;
    const user = window.supabaseClient.getCurrentUser();
    if (!user) return;

    const payload = Object.assign({}, this.pendingSyncFields, {
      updated_at: new Date().toISOString()
    });
    this.pendingSyncFields = {};

    try {
      const { error } = await window.supabaseClient.client
        .from('profiles')
        .update(payload)
        .eq('id', user.id);

      if (error) {
        console.warn('[StorageManager] Erreur sync Supabase profiles:', error);
      } else {
        this.updateCloudStatusIndicator(true);
      }
    } catch (err) {
      console.warn('[StorageManager] Exception sync Supabase:', err);
    }
  }

  async insertCloudHandHistory(handEntry) {
    if (!window.supabaseClient || !window.supabaseClient.isReady()) return;
    const user = window.supabaseClient.getCurrentUser();
    if (!user) return;

    try {
      await window.supabaseClient.client
        .from('hand_history')
        .insert([{
          user_id: user.id,
          game_mode: handEntry.gameMode || 'cash',
          won: !!handEntry.won,
          pot_amount: handEntry.potAmount || 0,
          hand_label: handEntry.handLabel || null
        }]);
    } catch (err) {
      console.warn('[StorageManager] Erreur insertion hand_history Supabase:', err);
    }
  }

  // Chargement complet du profil depuis la table 'profiles' de Supabase
  async loadFromCloud(user) {
    if (!window.supabaseClient || !window.supabaseClient.isReady() || !user) return;

    try {
      const { data, error } = await window.supabaseClient.client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        console.log('[StorageManager] Profil Cloud chargé avec succès:', data.username);

        this.profile.id = data.id;
        this.profile.name = data.username || this.profile.name;
        this.profile.avatar = data.avatar || this.profile.avatar || '👑';
        this.profile.chips = Number(data.chips !== undefined ? data.chips : this.profile.chips);

        this.stats.handsPlayed = Number(data.hands_played || 0);
        this.stats.handsWon = Number(data.hands_won || 0);
        this.stats.biggestPot = Number(data.biggest_pot || 0);
        this.stats.bestHand = data.best_hand || 'Aucune';
        this.stats.tournamentsPlayed = Number(data.tournaments_played || 0);
        this.stats.tournamentsWon = Number(data.tournaments_won || 0);
        this.stats.totalWon = Number(data.total_won || 0);

        if (data.wheel_last_spin) {
          const cloudSpin = new Date(data.wheel_last_spin).getTime();
          const currentWheel = this.load(STORAGE_KEYS.WHEEL, { lastSpin: 0 });
          const mergedSpin = Math.max(cloudSpin, currentWheel.lastSpin || 0);
          this.save(STORAGE_KEYS.WHEEL, { lastSpin: mergedSpin });
        }

        // Sauvegarder dans le cache local
        this.save(STORAGE_KEYS.PROFILE, this.profile);
        this.save(STORAGE_KEYS.STATS, this.stats);
        localStorage.setItem(STORAGE_KEYS.AUTH_MODE, 'cloud');

        // Mettre à jour l'interface utilisateur
        if (window.app && typeof window.app.updateUserHeader === 'function') {
          window.app.updateUserHeader();
        }
        if (window.luckyWheel && typeof window.luckyWheel.updateStatus === 'function') {
          window.luckyWheel.updateStatus();
        }

        this.updateCloudStatusIndicator(true);
      }
    } catch (err) {
      console.warn('[StorageManager] Erreur loadFromCloud:', err);
    }
  }

  // Récupérer les 10 dernières mains (depuis Supabase si connecté, sinon fallback local)
  async getRecentHands(limit = 10) {
    if (window.supabaseClient && window.supabaseClient.isReady() && window.supabaseClient.getCurrentUser()) {
      try {
        const user = window.supabaseClient.getCurrentUser();
        const { data, error } = await window.supabaseClient.client
          .from('hand_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            gameMode: d.game_mode,
            won: d.won,
            potAmount: Number(d.pot_amount || 0),
            handLabel: d.hand_label,
            createdAt: d.created_at
          }));
        }
      } catch (e) {
        console.warn('Erreur récupération mains Supabase:', e);
      }
    }

    return this.getLocalHandHistory().slice(0, limit);
  }

  // Récupérer le Top 10 des joueurs les plus riches (Leaderboard)
  async getLeaderboard(limit = 10) {
    if (window.supabaseClient && window.supabaseClient.isReady()) {
      try {
        const { data, error } = await window.supabaseClient.client
          .from('profiles')
          .select('id, username, avatar, chips, hands_won, hands_played')
          .order('chips', { ascending: false })
          .limit(limit);

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((row) => ({
            id: row.id,
            name: row.username,
            avatar: row.avatar || '👑',
            chips: Number(row.chips || 0),
            handsWon: Number(row.hands_won || 0),
            handsPlayed: Number(row.hands_played || 0)
          }));
        }
      } catch (err) {
        console.warn('Erreur chargement Leaderboard Supabase:', err);
      }
    }

    // Fallback élégant si Supabase n'est pas configuré ou hors-ligne
    return this.getFallbackLeaderboard();
  }

  getFallbackLeaderboard() {
    const list = [
      { name: 'Viktor "Isildur"', avatar: '🦈', chips: 2500000, handsWon: 1420 },
      { name: 'Phil Ivey', avatar: '🦁', chips: 1850000, handsWon: 980 },
      { name: 'Daniel Negreanu', avatar: '🎩', chips: 1200000, handsWon: 850 },
      { name: 'Doyle Brunson', avatar: '🤠', chips: 750000, handsWon: 620 },
      { name: 'Fedor Holz', avatar: '💎', chips: 450000, handsWon: 390 }
    ];

    // Insérer le joueur courant
    const me = {
      name: this.profile.name + ' (Vous)',
      avatar: this.profile.avatar || '👑',
      chips: this.profile.chips,
      handsWon: this.stats.handsWon,
      isCurrentUser: true
    };
    list.push(me);
    list.sort((a, b) => b.chips - a.chips);
    return list.slice(0, 10);
  }

  revertToGuest() {
    localStorage.setItem(STORAGE_KEYS.AUTH_MODE, 'guest');
    this.profile.id = 'player_guest';
    this.save(STORAGE_KEYS.PROFILE, this.profile);
    this.updateCloudStatusIndicator(false);
    if (window.app && typeof window.app.updateUserHeader === 'function') {
      window.app.updateUserHeader();
    }
  }

  updateCloudStatusIndicator(isConnected) {
    const badge = document.getElementById('user-header-cloud-badge');
    if (badge) {
      if (isConnected) {
        badge.classList.remove('bg-slate-500', 'bg-red-400');
        badge.classList.add('bg-emerald-400');
        badge.title = 'Synchronisation Cloud Supabase Active';
      } else {
        badge.classList.remove('bg-emerald-400');
        badge.classList.add('bg-slate-500');
        badge.title = 'Mode Invité (Sauvegarde locale)';
      }
    }
  }

  // =========================================================================
  // PARAMÈTRES DU JEU
  // =========================================================================

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
