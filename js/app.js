/**
 * Hika-Poker - Chef d'Orchestre Principal (Application Controller)
 * Découplage strict UI / Engine, boucle d'interaction événementielle, bots locaux et modes de jeu.
 */

class HikaPokerApp {
  constructor() {
    this.engine = null;
    this.humanId = 'player_user';
    this.gameMode = 'cash'; // 'cash' | 'tournament'
    this.currentTableConfig = null;
    this.botStepTimeout = null;
    this.nextHandTimeout = null;
    this.isHandRunning = false;
    this.winningCards = [];
  }

  init() {
    // 1. Initialiser les modules graphiques et sonores
    window.tableUI.init();
    window.playerControlsUI.init((action) => this.handlePlayerAction(action));
    window.luckyWheel.init();

    // 2. Initialiser les écouteurs d'interface (Navbar, Lobby, Modals)
    this.bindGlobalEvents();

    // 3. Charger le profil et afficher le solde
    this.updateUserHeader();

    // 4. Appliquer le thème sauvegardé
    const settings = window.storageManager.getSettings();
    this.applyTheme(settings.theme || 'green');

    // 5. Exposer les fonctions globales utiles
    window.updatePlayerChipsDisplay = (chips) => this.updateChipsDisplay(chips);

    console.log('[Hika-Poker] Initialisation terminée.');
  }

  bindGlobalEvents() {
    // Navigation Lobby -> Mode Cash
    const cashTables = document.querySelectorAll('.btn-select-cash-table');
    cashTables.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const stakes = e.currentTarget.dataset.stakes; // 'micro', 'low', 'high'
        this.startCashGame(stakes);
      });
    });

    // Navigation Lobby -> Mode Tournoi Sit & Go
    const btnTourney = document.getElementById('btn-start-tournament');
    if (btnTourney) {
      btnTourney.addEventListener('click', () => {
        this.startTournamentGame();
      });
    }

    // Bouton Quitter la table vers le Lobby
    const btnLeaveTable = document.getElementById('btn-leave-table');
    if (btnLeaveTable) {
      btnLeaveTable.addEventListener('click', () => {
        if (confirm('Voulez-vous vraiment quitter la table ?')) {
          this.leaveTable();
        }
      });
    }

    // Bouton Roue de la fortune
    const btnLuckyWheel = document.getElementById('btn-open-lucky-wheel');
    if (btnLuckyWheel) {
      btnLuckyWheel.addEventListener('click', () => {
        if (window.soundFX) window.soundFX.playBtnClick();
        window.luckyWheel.open();
      });
    }

    // Toggle Son (Mute)
    const btnToggleSound = document.getElementById('btn-toggle-sound');
    if (btnToggleSound) {
      btnToggleSound.addEventListener('click', () => {
        const isMuted = window.soundFX.toggleMute();
        btnToggleSound.innerHTML = isMuted ? '🔇' : '🔊';
        btnToggleSound.title = isMuted ? 'Activer le son' : 'Couper le son';
      });
    }

    // Bouton Profil / Stats Modal
    const btnOpenStats = document.getElementById('btn-open-stats');
    if (btnOpenStats) {
      btnOpenStats.addEventListener('click', () => {
        this.openStatsModal();
      });
    }

    const btnCloseStats = document.getElementById('btn-close-stats');
    if (btnCloseStats) {
      btnCloseStats.addEventListener('click', () => {
        document.getElementById('stats-modal').classList.add('hidden');
        document.getElementById('stats-modal').classList.remove('flex');
      });
    }

    // Sélecteur de Thème
    const themeSelect = document.getElementById('table-theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        this.applyTheme(e.target.value);
        window.storageManager.updateSettings({ theme: e.target.value });
      });
    }

    // Rebuy / Recharge manuelle
    const btnRebuy = document.getElementById('btn-rebuy-chips');
    if (btnRebuy) {
      btnRebuy.addEventListener('click', () => {
        this.promptRebuy();
      });
    }

    // Fermer le modal de résultat de tournoi
    const btnCloseTourneyRes = document.getElementById('btn-close-tourney-result');
    if (btnCloseTourneyRes) {
      btnCloseTourneyRes.addEventListener('click', () => {
        document.getElementById('tournament-result-modal').classList.add('hidden');
        document.getElementById('tournament-result-modal').classList.remove('flex');
        this.leaveTable();
      });
    }
  }

  applyTheme(theme) {
    const tableEl = document.getElementById('poker-table');
    if (!tableEl) return;
    tableEl.classList.remove('felt-green', 'felt-blue', 'felt-red');
    if (theme === 'blue') tableEl.classList.add('felt-blue');
    else if (theme === 'red') tableEl.classList.add('felt-red');
    else tableEl.classList.add('felt-green');
  }

  updateUserHeader() {
    const prof = window.storageManager.getProfile();
    const nameEl = document.getElementById('user-header-name');
    const chipsEl = document.getElementById('user-header-chips');
    const avatarEl = document.getElementById('user-header-avatar');

    if (nameEl) nameEl.textContent = prof.name;
    if (chipsEl) chipsEl.textContent = prof.chips.toLocaleString();
    if (avatarEl) avatarEl.textContent = '👑';
  }

  updateChipsDisplay(newChips) {
    const chipsEl = document.getElementById('user-header-chips');
    if (chipsEl) chipsEl.textContent = newChips.toLocaleString();
  }

  openStatsModal() {
    const stats = window.storageManager.getStats();
    const prof = window.storageManager.getProfile();

    document.getElementById('stat-hands-played').textContent = stats.handsPlayed;
    document.getElementById('stat-hands-won').textContent = stats.handsWon;
    const winRate = stats.handsPlayed > 0 ? Math.round((stats.handsWon / stats.handsPlayed) * 100) : 0;
    document.getElementById('stat-win-rate').textContent = `${winRate}%`;
    document.getElementById('stat-biggest-pot').textContent = stats.biggestPot.toLocaleString();
    document.getElementById('stat-best-hand').textContent = stats.bestHand || 'Aucune';
    document.getElementById('stat-tourney-won').textContent = `${stats.tournamentsWon} / ${stats.tournamentsPlayed}`;
    document.getElementById('stat-total-won').textContent = stats.totalWon.toLocaleString();

    const modal = document.getElementById('stats-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  // =========================================================================
  // DÉMARRAGE DES MODES DE JEU
  // =========================================================================

  startCashGame(stakes = 'micro') {
    this.gameMode = 'cash';
    let config = { sb: 10, bb: 20, buyIn: 1000, name: 'Table Amateur' };
    if (stakes === 'low') config = { sb: 50, bb: 100, buyIn: 5000, name: 'Table Vegas' };
    if (stakes === 'high') config = { sb: 500, bb: 1000, buyIn: 50000, name: 'Table VIP High Roller' };

    const profile = window.storageManager.getProfile();
    if (profile.chips < config.buyIn) {
      // Proposer un bonus immédiat si pas assez de jetons
      if (confirm(`Vous avez besoin d'au moins ${config.buyIn.toLocaleString()} jetons pour rejoindre cette table. Souhaitez-vous recharger votre solde gratuitement (+10,000 jetons) ?`)) {
        window.storageManager.addChips(10000);
        this.updateUserHeader();
      } else {
        return;
      }
    }

    this.currentTableConfig = config;

    // Déduire le buy-in de la bankroll du joueur
    window.storageManager.addChips(-config.buyIn);
    this.updateUserHeader();

    // Créer le moteur PokerEngine
    this.engine = new window.PokerEngine({
      maxSeats: 6,
      smallBlind: config.sb,
      bigBlind: config.bb,
      startingChips: config.buyIn,
      autoRebuy: true,
      rebuyChips: config.buyIn,
      turnTimeMs: 15000
    });

    // Brancher les événements du moteur
    this.bindEngineEvents();

    // Ajouter le joueur humain
    this.engine.addPlayer({
      id: this.humanId,
      name: profile.name,
      chips: config.buyIn,
      isBot: false,
      avatar: '👤'
    }, 0);

    // Ajouter 5 bots locaux avec personnalités distinctes
    const bots = window.getRandomBots(5);
    bots.forEach((b, idx) => {
      this.engine.addPlayer({
        id: b.id,
        name: b.name,
        chips: config.buyIn,
        isBot: true,
        botLevel: b.botLevel,
        avatar: b.avatar,
        meta: { avatarBg: b.avatarBg, title: b.title }
      }, idx + 1);
    });

    // Basculer l'écran vers la table
    this.showTableScreen(config.name);

    // Lancer la première main après un léger délai visuel
    setTimeout(() => {
      this.startNextHand();
    }, 800);
  }

  startTournamentGame() {
    this.gameMode = 'tournament';
    const tourneyCfg = window.TOURNAMENT_CONFIGS;
    const profile = window.storageManager.getProfile();

    if (profile.chips < tourneyCfg.buyIn) {
      if (confirm(`Buy-in du tournoi : ${tourneyCfg.buyIn.toLocaleString()} jetons. Souhaitez-vous recharger votre solde gratuitement (+10,000 jetons) ?`)) {
        window.storageManager.addChips(10000);
        this.updateUserHeader();
      } else {
        return;
      }
    }

    // Déduire le buy-in
    window.storageManager.addChips(-tourneyCfg.buyIn);
    this.updateUserHeader();

    // Créer le moteur PokerEngine en mode tournoi
    this.engine = new window.PokerEngine({
      maxSeats: 6,
      smallBlind: tourneyCfg.levels[0].smallBlind,
      bigBlind: tourneyCfg.levels[0].bigBlind,
      startingChips: tourneyCfg.startingChips,
      blindLevels: tourneyCfg.levels,
      handsPerLevel: tourneyCfg.handsPerLevel,
      autoRebuy: false,
      turnTimeMs: 15000
    });

    this.bindEngineEvents();

    // Joueur humain
    this.engine.addPlayer({
      id: this.humanId,
      name: profile.name,
      chips: tourneyCfg.startingChips,
      isBot: false,
      avatar: '👤'
    }, 0);

    // Bots de tournoi
    const bots = window.getRandomBots(5);
    bots.forEach((b, idx) => {
      this.engine.addPlayer({
        id: b.id,
        name: b.name,
        chips: tourneyCfg.startingChips,
        isBot: true,
        botLevel: b.botLevel,
        avatar: b.avatar,
        meta: { avatarBg: b.avatarBg, title: b.title }
      }, idx + 1);
    });

    window.tournamentManager.start({ id: this.humanId, name: profile.name }, bots);

    this.showTableScreen('Sit & Go Tournoi 6-Max');

    setTimeout(() => {
      this.startNextHand();
    }, 800);
  }

  showTableScreen(tableName) {
    document.getElementById('lobby-view').classList.add('hidden');
    document.getElementById('table-view').classList.remove('hidden');
    document.getElementById('current-table-title').textContent = tableName;
  }

  leaveTable() {
    this.stopAllTimers();

    // Si partie de cash game, recréditer les jetons restants du joueur sur son compte principal
    if (this.gameMode === 'cash' && this.engine) {
      const p = this.engine.getPlayer(this.humanId);
      if (p && p.chips > 0) {
        window.storageManager.addChips(p.chips);
        this.updateUserHeader();
      }
    }

    this.engine = null;
    this.isHandRunning = false;
    window.tableUI.stopTurnTimer();
    window.playerControlsUI.hideAll();

    document.getElementById('table-view').classList.add('hidden');
    document.getElementById('lobby-view').classList.remove('hidden');
    this.updateUserHeader();
  }

  // =========================================================================
  // ÉVÉNEMENTS DU MOTEUR (ENGINE -> UI BRIDGE)
  // =========================================================================

  bindEngineEvents() {
    if (!this.engine) return;

    // Début de main
    this.engine.on('handStart', (e) => {
      this.isHandRunning = true;
      this.winningCards = [];
      window.tableUI.lastBoardCards = [];
      if (window.soundFX) window.soundFX.playCardDeal();

      const state = this.engine.getState(this.humanId);
      window.tableUI.renderSeats(state, this.humanId);
      window.tableUI.renderBoard([], []);
      window.tableUI.renderPot(0);

      // Info main
      const handInfoEl = document.getElementById('my-hand-rank-text');
      if (handInfoEl) handInfoEl.textContent = 'En attente des cartes...';

      if (this.gameMode === 'tournament') {
        window.tournamentManager.updateHUD(state.level, state.blinds);
      }
    });

    // Cartes privées distribuées
    this.engine.on('holeCards', (e) => {
      if (e.playerId === this.humanId) {
        const state = this.engine.getState(this.humanId);
        window.tableUI.renderSeats(state, this.humanId);
        const handInfoEl = document.getElementById('my-hand-rank-text');
        if (handInfoEl && state.myHand) {
          handInfoEl.textContent = state.myHand;
        }
      }
    });

    // Blinds & antes déduites
    this.engine.on('blinds', (e) => {
      if (window.soundFX) window.soundFX.playChip();
      const state = this.engine.getState(this.humanId);
      window.tableUI.renderSeats(state, this.humanId);
      window.tableUI.renderPot(state.pot, state.pots);
    });

    // Action d'un joueur (fold, check, call, raise, allin)
    this.engine.on('action', (e) => {
      const state = this.engine.getState(this.humanId);
      window.tableUI.renderSeats(state, this.humanId, this.winningCards);
      window.tableUI.renderPot(state.pot, state.pots);
    });

    // Changement de tour
    this.engine.on('turn', (e) => {
      this.handleTurn(e);
    });

    // Nouvelle carte sur le board (Flop, Turn, River)
    this.engine.on('street', (e) => {
      window.tableUI.renderBoard(e.board, this.winningCards);
      const state = this.engine.getState(this.humanId);
      window.tableUI.renderSeats(state, this.humanId, this.winningCards);
      window.tableUI.renderPot(state.pot, state.pots);

      const handInfoEl = document.getElementById('my-hand-rank-text');
      if (handInfoEl && state.myHand) {
        handInfoEl.textContent = state.myHand;
      }
    });

    // All-in runout
    this.engine.on('runout', (e) => {
      const state = this.engine.getState(this.humanId, { revealAll: true });
      window.tableUI.renderSeats(state, this.humanId);
    });

    // Remboursement d'une mise non suivie
    this.engine.on('refund', (e) => {
      const state = this.engine.getState(this.humanId);
      window.tableUI.renderSeats(state, this.humanId);
      window.tableUI.renderPot(state.pot, state.pots);
    });

    // Pot attribué
    this.engine.on('potAwarded', (e) => {
      const p = this.engine.getPlayer(e.playerId);
      const winnerName = p ? p.name : 'Joueur';
      const handDesc = e.hand || (e.uncontested ? 'Adversaires couchés' : 'Meilleure main');

      window.tableUI.showWinnerBanner(winnerName, handDesc, e.amount);

      if (e.playerId === this.humanId) {
        if (window.soundFX) window.soundFX.playWin();
        window.storageManager.recordHand({ won: true, pot: e.amount, handLabel: handDesc });
      } else {
        const humanP = this.engine.getPlayer(this.humanId);
        if (humanP && humanP.inHand && !humanP.folded) {
          window.storageManager.recordHand({ won: false, pot: e.amount, handLabel: null });
        }
      }
    });

    // Showdown complet
    this.engine.on('showdown', (result) => {
      // Trouver les cartes gagnantes pour les illuminer
      const winningCardsSet = new Set();
      result.players.forEach((p) => {
        if (p.won > 0 && p.hand && p.hand.cards) {
          p.hand.cards.forEach((c) => winningCardsSet.add(c));
        }
      });
      this.winningCards = Array.from(winningCardsSet);

      const state = this.engine.getState(this.humanId, { revealAll: true });
      window.tableUI.renderSeats(state, this.humanId, this.winningCards);
      window.tableUI.renderBoard(state.board, this.winningCards);
    });

    // Élimination d'un joueur
    this.engine.on('bust', (e) => {
      const p = this.engine.getPlayer(e.playerId);
      if (this.gameMode === 'tournament') {
        window.tournamentManager.onPlayerBust(e.playerId, p ? p.name : 'Bot');
      } else if (e.playerId === this.humanId) {
        setTimeout(() => this.promptRebuy(), 1200);
      }
    });

    // Passage au niveau de blinds supérieur (tournoi)
    this.engine.on('levelUp', (e) => {
      if (this.gameMode === 'tournament') {
        window.tournamentManager.updateHUD(e.level, e.blinds);
      }
    });

    // Fin de main (handEnd)
    this.engine.on('handEnd', (result) => {
      this.isHandRunning = false;
      window.tableUI.stopTurnTimer();
      window.playerControlsUI.hideAll();

      // Pause de 3.5 secondes pour admirer le dénouement, puis main suivante
      this.nextHandTimeout = setTimeout(() => {
        this.startNextHand();
      }, 3500);
    });
  }

  // =========================================================================
  // GESTION DU TOUR ET DES BOTS
  // =========================================================================

  handleTurn(e) {
    const isHuman = e.playerId === this.humanId;
    const state = this.engine.getState(this.humanId);

    // Mettre à jour l'affichage des sièges pour illuminer le joueur actif
    window.tableUI.renderSeats(state, this.humanId, this.winningCards);

    // Calculer l'index du siège UI
    const humanSeat = state.players.findIndex((p) => p && p.id === this.humanId);
    const uiSeatIdx = humanSeat >= 0 ? (e.seat - humanSeat + 6) % 6 : e.seat;

    if (isHuman) {
      // Tour du joueur humain
      const legal = this.engine.getLegalActions(this.humanId);
      window.playerControlsUI.updateState(legal, true, this.engine.blinds.bigBlind);

      // Démarrer le timer de 15s
      window.tableUI.startTurnTimer(uiSeatIdx, 15000, () => {
        // Auto-action en cas d'expiration du temps
        this.engine.autoAct(this.humanId);
      });
    } else {
      // Tour d'un bot
      window.playerControlsUI.updateState(null, false, this.engine.blinds.bigBlind);

      // Délai de réflexion réaliste (800ms à 1600ms) pour une immersion parfaite
      const thinkingTime = 700 + Math.floor(Math.random() * 900);
      window.tableUI.startTurnTimer(uiSeatIdx, thinkingTime);

      this.botStepTimeout = setTimeout(() => {
        window.tableUI.stopTurnTimer();
        if (this.engine && this.engine.phase !== 'handOver') {
          this.engine.stepBot();
        }
      }, thinkingTime);
    }
  }

  handlePlayerAction(action) {
    if (!this.engine) return;
    window.tableUI.stopTurnTimer();

    const res = this.engine.act(this.humanId, action);
    if (!res.ok) {
      console.warn('Action refusée par le moteur:', res);
      // Réactualiser l'état légal
      const legal = this.engine.getLegalActions(this.humanId);
      window.playerControlsUI.updateState(legal, true, this.engine.blinds.bigBlind);
    }
  }

  startNextHand() {
    if (!this.engine) return;
    this.stopAllTimers();

    // Vérifier si le joueur humain a encore des jetons
    const humanP = this.engine.getPlayer(this.humanId);
    if (!humanP || humanP.chips === 0 || humanP.busted) {
      if (this.gameMode === 'cash') {
        this.promptRebuy();
      }
      return;
    }

    if (this.engine.canStartHand()) {
      this.engine.startHand();
    } else {
      // Pas assez de joueurs actifs
      if (this.gameMode === 'tournament') {
        window.tournamentManager.onTournamentEnd();
      } else {
        // Racheter les bots en cash game
        this.engine.seats.forEach((p) => {
          if (p && (p.chips === 0 || p.busted)) {
            this.engine.rebuy(p.id, this.currentTableConfig.buyIn);
          }
        });
        if (this.engine.canStartHand()) {
          this.engine.startHand();
        }
      }
    }
  }

  promptRebuy() {
    const buyIn = this.currentTableConfig ? this.currentTableConfig.buyIn : 2000;
    const profile = window.storageManager.getProfile();

    if (profile.chips >= buyIn) {
      if (confirm(`Voulez-vous recharger votre stack de table avec ${buyIn.toLocaleString()} jetons de votre compte ?`)) {
        window.storageManager.addChips(-buyIn);
        this.updateUserHeader();
        this.engine.rebuy(this.humanId, buyIn);
        this.startNextHand();
      }
    } else {
      if (confirm(`Votre solde est épuisé ! Voulez-vous recevoir un cadeau de bienvenue de 10,000 jetons gratuits ?`)) {
        window.storageManager.addChips(10000);
        this.updateUserHeader();
        this.engine.rebuy(this.humanId, buyIn);
        this.startNextHand();
      }
    }
  }

  stopAllTimers() {
    if (this.botStepTimeout) {
      clearTimeout(this.botStepTimeout);
      this.botStepTimeout = null;
    }
    if (this.nextHandTimeout) {
      clearTimeout(this.nextHandTimeout);
      this.nextHandTimeout = null;
    }
  }
}

// Initialiser l'application au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  window.app = new HikaPokerApp();
  window.app.init();
});
