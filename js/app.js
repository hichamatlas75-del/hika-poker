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

    // Gestion du suspense All-In Runout & équités en direct
    this.isRunoutPending = false;
    this.runoutStreets = [];
    this.runoutShowdown = null;
    this.runoutHandEnd = null;
    this.runoutTimeouts = [];
    this.runoutContenders = [];

    // Maintien de l'écran allumé (Screen Wake Lock)
    this.wakeLock = null;

    // Gestion du Mode Pause
    this.isPaused = false;
    this.botStepStartTime = null;
    this.botStepDuration = 0;
    this.botStepRemaining = 0;
    this.nextHandStartTime = null;
    this.nextHandDuration = 0;
    this.nextHandRemaining = 0;

    // Gestion de Recharge de Jetons & Notifications Casino
    this.pendingRebuyAmount = 0;
    this.selectedRebuyAmount = 0;
    this.toastTimeout = null;
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

    // Bouton Pause dans le HUD de la table
    const btnPause = document.getElementById('btn-toggle-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        this.togglePause();
      });
    }

    // Bouton Reprendre dans l'overlay de pause
    const btnResume = document.getElementById('btn-resume-game');
    if (btnResume) {
      btnResume.addEventListener('click', () => {
        this.resumeGame();
      });
    }

    // Bouton Quitter la table depuis l'overlay de pause
    const btnPauseLeave = document.getElementById('btn-pause-leave');
    if (btnPauseLeave) {
      btnPauseLeave.addEventListener('click', () => {
        if (confirm('Voulez-vous vraiment quitter la table ?')) {
          this.resumeGame(false);
          this.leaveTable();
        }
      });
    }

    // Raccourci clavier 'P' pour mettre en pause la table
    document.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') {
        const tableView = document.getElementById('table-view');
        if (tableView && !tableView.classList.contains('hidden') && this.engine) {
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
          this.togglePause();
        }
      }
    });

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

    // Modal Rebuy / Recharge Casino
    const btnCloseRebuy = document.getElementById('rebuy-close-btn');
    if (btnCloseRebuy) {
      btnCloseRebuy.addEventListener('click', () => this.closeRebuyModal());
    }

    const btnCancelRebuy = document.getElementById('btn-cancel-rebuy-modal');
    if (btnCancelRebuy) {
      btnCancelRebuy.addEventListener('click', () => this.closeRebuyModal());
    }

    const btnConfirmRebuy = document.getElementById('btn-confirm-rebuy-modal');
    if (btnConfirmRebuy) {
      btnConfirmRebuy.addEventListener('click', () => this.confirmRebuy());
    }

    const btnRebuyBonus = document.getElementById('btn-rebuy-free-bonus');
    if (btnRebuyBonus) {
      btnRebuyBonus.addEventListener('click', () => {
        window.storageManager.addChips(10000);
        this.updateUserHeader();
        if (window.soundFX) window.soundFX.playChipsStack();
        this.showToast("Cadeau VIP de +10,000 jetons crédité !", "🎁");
        this.openRebuyModal();
      });
    }

    const btnRebuyWheel = document.getElementById('btn-rebuy-open-wheel');
    if (btnRebuyWheel) {
      btnRebuyWheel.addEventListener('click', () => {
        this.closeRebuyModal();
        if (window.luckyWheel) window.luckyWheel.open();
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

    // Gestion du maintien de l'écran allumé (Screen Wake Lock) lors du retour au premier plan
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const tableView = document.getElementById('table-view');
        if (tableView && !tableView.classList.contains('hidden') && this.engine) {
          this.requestWakeLock();
        }
      }
    });
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
      this.openRebuyModal();
      this.showToast(`Solde insuffisant pour cette table (${config.buyIn.toLocaleString()} 🪙 requis)`, "⚠️");
      return;
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
      autoRebuy: false,
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
      this.openRebuyModal();
      this.showToast(`Solde insuffisant pour le tournoi (${tourneyCfg.buyIn.toLocaleString()} 🪙 requis)`, "⚠️");
      return;
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
    this.isPaused = false;
    this.botStepRemaining = 0;
    this.nextHandRemaining = 0;
    this.updatePauseUI(false);
    document.getElementById('lobby-view').classList.add('hidden');
    document.getElementById('table-view').classList.remove('hidden');
    document.getElementById('current-table-title').textContent = tableName;
    this.requestWakeLock();
  }

  leaveTable() {
    this.stopAllTimers();
    this.releaseWakeLock();
    this.isPaused = false;
    this.botStepRemaining = 0;
    this.nextHandRemaining = 0;
    this.updatePauseUI(false);

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

  togglePause() {
    if (!this.engine) return;
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  pauseGame() {
    if (!this.engine || this.isPaused) return;
    this.isPaused = true;
    if (window.soundFX) window.soundFX.playBtnClick();

    // 1. Mettre en pause le timer visuel de la table
    if (window.tableUI) {
      window.tableUI.pauseTurnTimer();
    }

    // 2. Mettre en pause la réflexion du bot si active
    if (this.botStepTimeout) {
      clearTimeout(this.botStepTimeout);
      this.botStepTimeout = null;
      const elapsed = Date.now() - (this.botStepStartTime || Date.now());
      this.botStepRemaining = Math.max(150, (this.botStepDuration || 1000) - elapsed);
    }

    // 3. Mettre en pause le passage à la main suivante si actif
    if (this.nextHandTimeout) {
      clearTimeout(this.nextHandTimeout);
      this.nextHandTimeout = null;
      const elapsed = Date.now() - (this.nextHandStartTime || Date.now());
      this.nextHandRemaining = Math.max(200, (this.nextHandDuration || 3500) - elapsed);
    }

    // 4. Mettre à jour l'interface visuelle
    this.updatePauseUI(true);
  }

  resumeGame(playSound = true) {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (playSound && window.soundFX) window.soundFX.playBtnClick();

    // 1. Masquer l'overlay et réinitialiser l'état du bouton
    this.updatePauseUI(false);

    // 2. Reprendre le timer de tour (humain ou bot)
    if (window.tableUI) {
      window.tableUI.resumeTurnTimer();
    }

    // 3. Reprendre la réflexion du bot si elle était en cours
    if (this.botStepRemaining > 0) {
      const remainingTime = this.botStepRemaining;
      this.botStepRemaining = 0;
      this.botStepDuration = remainingTime;
      this.botStepStartTime = Date.now();

      this.botStepTimeout = setTimeout(() => {
        if (window.tableUI) window.tableUI.stopTurnTimer();
        this.botStepTimeout = null;
        if (this.engine && this.engine.phase !== 'handOver' && !this.isPaused) {
          this.engine.stepBot();
        }
      }, remainingTime);
    }

    // 4. Reprendre le délai vers la main suivante si elle était en attente
    if (this.nextHandRemaining > 0) {
      const remainingTime = this.nextHandRemaining;
      this.nextHandRemaining = 0;
      this.nextHandDuration = remainingTime;
      this.nextHandStartTime = Date.now();

      this.nextHandTimeout = setTimeout(() => {
        this.nextHandTimeout = null;
        if (!this.isPaused) {
          this.startNextHand();
        }
      }, remainingTime);
    }
  }

  updatePauseUI(isPaused) {
    const pauseOverlay = document.getElementById('pause-overlay');
    const pauseBtnIcon = document.getElementById('pause-btn-icon');
    const pauseBtnText = document.getElementById('pause-btn-text');
    const btnPause = document.getElementById('btn-toggle-pause');

    if (pauseOverlay) {
      if (isPaused) {
        pauseOverlay.classList.remove('hidden');
        pauseOverlay.classList.add('flex');
      } else {
        pauseOverlay.classList.add('hidden');
        pauseOverlay.classList.remove('flex');
      }
    }

    if (pauseBtnIcon) {
      pauseBtnIcon.textContent = isPaused ? '▶️' : '⏸️';
    }
    if (pauseBtnText) {
      pauseBtnText.textContent = isPaused ? 'Reprendre' : 'Pause';
    }
    if (btnPause) {
      if (isPaused) {
        btnPause.classList.remove('bg-amber-600/20', 'text-amber-300', 'border-amber-500/40');
        btnPause.classList.add('bg-emerald-600/30', 'text-emerald-300', 'border-emerald-500/50');
      } else {
        btnPause.classList.remove('bg-emerald-600/30', 'text-emerald-300', 'border-emerald-500/50');
        btnPause.classList.add('bg-amber-600/20', 'text-amber-300', 'border-amber-500/40');
      }
    }
  }

  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        if (!this.wakeLock) {
          this.wakeLock = await navigator.wakeLock.request('screen');
          this.wakeLock.addEventListener('release', () => {
            this.wakeLock = null;
          });
          console.log('[Hika-Poker] Screen Wake Lock activé.');
        }
      } catch (err) {
        console.warn('[Hika-Poker] Screen Wake Lock non disponible ou refusé:', err);
      }
    }
  }

  async releaseWakeLock() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch (err) {
        // Ignorer si déjà libéré
      }
      this.wakeLock = null;
      console.log('[Hika-Poker] Screen Wake Lock relâché.');
    }
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
      this.isRunoutPending = false;
      this.runoutStreets = [];
      this.runoutShowdown = null;
      this.runoutHandEnd = null;
      this.runoutContenders = [];
      this.runoutTimeouts.forEach((t) => clearTimeout(t));
      this.runoutTimeouts = [];

      window.tableUI.clearEquities();
      window.tableUI.clearWinnerShowcase();
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
      // Animation jetons volants depuis le siège du joueur vers le pot central
      if (['bet', 'raise', 'call', 'allin'].includes(e.action)) {
        const seatEl = window.tableUI.getSeatElement(e.playerId);
        if (seatEl && window.tableUI.potEl) {
          window.tableUI.flyChips(seatEl, window.tableUI.potEl);
        }
      }

      // Son dramatique All-In quand un adversaire fait tapis
      if (e.action === 'allin' && e.playerId !== this.humanId && window.soundFX) {
        window.soundFX.playAllIn();
      }

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
      if (this.isRunoutPending) {
        // En cas de runout All-In, bufferiser les rues pour l'animation à suspense
        this.runoutStreets.push({ phase: e.phase, board: e.board.slice(), cards: e.cards.slice() });
        return;
      }

      window.tableUI.renderBoard(e.board, this.winningCards);
      const state = this.engine.getState(this.humanId);
      window.tableUI.renderSeats(state, this.humanId, this.winningCards);
      window.tableUI.renderPot(state.pot, state.pots);

      const handInfoEl = document.getElementById('my-hand-rank-text');
      if (handInfoEl && state.myHand) {
        handInfoEl.textContent = state.myHand;
      }
    });

    // All-in runout : déclenchement du suspense dramatique
    this.engine.on('runout', (e) => {
      this.isRunoutPending = true;
      this.runoutContenders = e.hands || [];
      this.runoutStreets = [];
      this.runoutTimeouts.forEach((t) => clearTimeout(t));
      this.runoutTimeouts = [];

      window.tableUI.stopTurnTimer();

      // Révéler les cartes privées des joueurs en lice
      const state = this.engine.getState(this.humanId, { revealAll: true });
      window.tableUI.renderSeats(state, this.humanId);

      // Calculer et afficher les cotes en % initiales avant la distribution du board
      const initialEquities = this.calculateEquities(this.runoutContenders, state.board || []);
      window.tableUI.renderEquities(initialEquities);
    });

    // Remboursement d'une mise non suivie
    this.engine.on('refund', (e) => {
      const state = this.engine.getState(this.humanId);
      window.tableUI.renderSeats(state, this.humanId);
      window.tableUI.renderPot(state.pot, state.pots);
    });

    // Pot attribué (animation des jetons du pot vers le joueur)
    this.engine.on('potAwarded', (e) => {
      if (this.isRunoutPending) return; // Sera joué lors du dénouement du runout

      const winnerSeatEl = window.tableUI.getSeatElement(e.playerId);
      if (winnerSeatEl && window.tableUI.potEl) {
        window.tableUI.flyChips(window.tableUI.potEl, winnerSeatEl);
      }
      if (window.soundFX) window.soundFX.playChip();
    });

    // Showdown complet
    this.engine.on('showdown', (result) => {
      if (this.isRunoutPending) {
        this.runoutShowdown = result;
        return;
      }
      this.renderShowdownVisuals(result);
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
      window.tableUI.stopTurnTimer();
      window.playerControlsUI.hideAll();

      if (this.isRunoutPending) {
        this.runoutHandEnd = result;
        this.playRunoutSuspenseSequence();
        return;
      }

      this.isHandRunning = false;
      this.handleHandOutcome(result);
      this.applyPendingRebuy();

      // Pause de 3.5 secondes pour admirer le dénouement, puis main suivante
      this.nextHandDuration = 3500;
      this.nextHandStartTime = Date.now();
      this.nextHandRemaining = 0;
      this.nextHandTimeout = setTimeout(() => {
        this.nextHandTimeout = null;
        if (!this.isPaused) {
          this.startNextHand();
        }
      }, 3500);
    });
  }

  // =========================================================================
  // GESTION DU SUSPENSE RUNOUT ET ÉQUITÉS EN DIRECT
  // =========================================================================

  calculateEquities(contenders, currentBoard) {
    if (!contenders || contenders.length < 2) return {};
    const oppCount = contenders.length - 1;
    const rawEquities = contenders.map((c) => {
      const hole = c.cards || c.hole || [];
      let eq = 0.5;
      if (hole.length === 2 && window.PokerEngine) {
        try {
          eq = window.PokerEngine.equity(hole, currentBoard || [], oppCount, 250);
        } catch (err) {
          eq = 0.5;
        }
      }
      return { playerId: c.playerId || c.id, eq };
    });

    const sum = rawEquities.reduce((s, r) => s + r.eq, 0) || 1;
    const pctMap = {};
    rawEquities.forEach((r) => {
      pctMap[r.playerId] = Math.round((r.eq / sum) * 100);
    });
    return pctMap;
  }

  playRunoutSuspenseSequence() {
    const streets = this.runoutStreets.slice();
    let delay = 900;

    streets.forEach((streetInfo) => {
      const t = setTimeout(() => {
        window.tableUI.renderBoard(streetInfo.board, []);
        if (window.soundFX) window.soundFX.playCardDeal();

        // Calculer et mettre à jour les pourcentages d'équité avec le nouveau board
        const pctMap = this.calculateEquities(this.runoutContenders, streetInfo.board);
        window.tableUI.renderEquities(pctMap);
      }, delay);
      this.runoutTimeouts.push(t);
      delay += 950;
    });

    // À la fin des rues : révéler le showdown, éclairer les combinaisons gagnantes
    const showdownTimer = setTimeout(() => {
      window.tableUI.clearEquities();

      if (this.runoutShowdown) {
        this.renderShowdownVisuals(this.runoutShowdown);
      }

      if (this.runoutHandEnd) {
        this.handleHandOutcome(this.runoutHandEnd);

        // Animation des jetons vers les vainqueurs
        this.runoutHandEnd.pots.forEach((p) => {
          p.winners.forEach((w) => {
            const winnerSeatEl = window.tableUI.getSeatElement(w.playerId);
            if (winnerSeatEl && window.tableUI.potEl) {
              window.tableUI.flyChips(window.tableUI.potEl, winnerSeatEl);
            }
          });
        });
      }

      this.isRunoutPending = false;
      this.isHandRunning = false;
      this.applyPendingRebuy();

      // Main suivante après 3.8s
      this.nextHandDuration = 3800;
      this.nextHandStartTime = Date.now();
      this.nextHandRemaining = 0;
      this.nextHandTimeout = setTimeout(() => {
        this.nextHandTimeout = null;
        if (!this.isPaused) {
          this.startNextHand();
        }
      }, 3800);
    }, delay + 400);

    this.runoutTimeouts.push(showdownTimer);
  }

  renderShowdownVisuals(result) {
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
  }

  handleHandOutcome(result) {
    if (!result || !result.players) return;

    const winners = result.players.filter((p) => p.won > 0);
    const totalPot = result.players.reduce((s, p) => s + p.won, 0);

    if (winners.length > 0) {
      let winnerName = '';
      let handLabel = '';

      if (winners.length === 1) {
        const w = winners[0];
        const pObj = this.engine ? this.engine.getPlayer(w.id) : null;
        winnerName = pObj ? pObj.name : 'Vainqueur';
        handLabel = (w.hand && w.hand.label) || (result.showdown ? 'Meilleure main' : 'Adversaires couchés');

        // Présenter les cartes gagnantes à côté de la suite du board sur la table
        let winningHole = (w.hole && w.hole.length > 0) ? w.hole : null;
        if (!winningHole && pObj && pObj.hole && pObj.hole.length > 0) {
          winningHole = pObj.hole.map((c) => typeof c === 'string' ? c : (window.PokerEngine ? window.PokerEngine.cardToString(c) : c));
        }
        if (winningHole) {
          window.tableUI.showWinnerShowcase(winnerName, winningHole, w.hand ? w.hand.label : '');
        }
      } else {
        winnerName = winners.map((w) => {
          const pObj = this.engine ? this.engine.getPlayer(w.id) : null;
          return pObj ? pObj.name : 'Joueur';
        }).join(' & ');
        handLabel = 'Partage (' + (winners.map((w) => w.hand ? w.hand.label : '').filter(Boolean).join(' / ') || 'Split Pot') + ')';

        // Pour un split pot, afficher la main gagnante
        const firstWithHole = winners.find((w) => w.hole && w.hole.length > 0);
        if (firstWithHole) {
          window.tableUI.showWinnerShowcase(winnerName, firstWithHole.hole, 'Partage');
        }
      }

      window.tableUI.showWinnerBanner(winnerName, handLabel, totalPot);
    }

    // Enregistrement unique de la main pour les statistiques du joueur humain
    const humanResult = result.players.find((p) => p.id === this.humanId);
    if (humanResult) {
      if (humanResult.won > 0) {
        if (window.soundFX) {
          window.soundFX.playWin();
          window.soundFX.playApplause();
        }
        window.storageManager.recordHand({
          won: true,
          pot: humanResult.won,
          handLabel: (humanResult.hand && humanResult.hand.label) || 'Main gagnante'
        });
      } else if (!humanResult.folded) {
        window.storageManager.recordHand({
          won: false,
          pot: 0,
          handLabel: null
        });
      }
    }
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
      if (window.soundFX) window.soundFX.playMyTurn();

      const legal = this.engine.getLegalActions(this.humanId);
      const preActionExecuted = window.playerControlsUI.updateState(legal, true, this.engine.blinds.bigBlind);

      // Si aucune pré-action n'a été exécutée automatiquement, lancer le timer de 15s
      if (!preActionExecuted) {
        window.tableUI.startTurnTimer(uiSeatIdx, 15000, () => {
          // Auto-action en cas d'expiration du temps : Fold systématique demandé
          if (window.soundFX) window.soundFX.playFold();
          this.handlePlayerAction({ type: 'fold' });
        });
      }
    } else {
      // Tour d'un bot : clic doux et discret spatialisé selon le siège
      const panBySeat = [-0.4, -0.3, 0, 0.3, 0.4];
      const botPan = uiSeatIdx > 0 ? (panBySeat[uiSeatIdx - 1] || 0) : 0;
      if (window.soundFX) window.soundFX.playOtherTurn(botPan);

      window.playerControlsUI.updateState(null, false, this.engine.blinds.bigBlind);

      // Délai de réflexion réaliste (700ms à 1600ms) pour une immersion parfaite
      const thinkingTime = 700 + Math.floor(Math.random() * 900);
      this.botStepDuration = thinkingTime;
      this.botStepStartTime = Date.now();
      this.botStepRemaining = 0;
      window.tableUI.startTurnTimer(uiSeatIdx, thinkingTime);

      this.botStepTimeout = setTimeout(() => {
        window.tableUI.stopTurnTimer();
        this.botStepTimeout = null;
        if (this.engine && this.engine.phase !== 'handOver' && !this.isPaused) {
          this.engine.stepBot();
        }
      }, thinkingTime);
    }
  }

  handlePlayerAction(action) {
    if (!this.engine || this.isPaused) return;
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
    if (!this.engine || this.isPaused) return;
    this.stopAllTimers();
    this.requestWakeLock();

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
    this.openRebuyModal();
  }

  openRebuyModal() {
    if (window.soundFX) window.soundFX.playBtnClick();

    const profile = window.storageManager.getProfile();
    const modal = document.getElementById('rebuy-modal');
    const accountChipsEl = document.getElementById('rebuy-account-chips');
    const tableStackBox = document.getElementById('rebuy-table-stack-box');
    const tableStackEl = document.getElementById('rebuy-table-stack');
    const statusNotice = document.getElementById('rebuy-status-notice');
    const optionsContainer = document.getElementById('rebuy-options-container');
    const bonusContainer = document.getElementById('rebuy-bonus-container');
    const amountButtons = document.getElementById('rebuy-amount-buttons');
    const confirmBtn = document.getElementById('btn-confirm-rebuy-modal');
    const confirmLabel = document.getElementById('btn-confirm-rebuy-label');

    if (!modal) return;

    if (accountChipsEl) accountChipsEl.textContent = profile.chips.toLocaleString();

    // 1. Si on est dans le Lobby (hors table de jeu)
    if (!this.engine) {
      if (tableStackBox) tableStackBox.classList.add('hidden');
      if (optionsContainer) optionsContainer.classList.add('hidden');
      if (statusNotice) {
        statusNotice.classList.remove('hidden', 'bg-yellow-950/80', 'border-yellow-500/40', 'text-yellow-200', 'bg-amber-950/70', 'border-amber-500/40', 'text-amber-300');
        statusNotice.classList.add('bg-blue-950/70', 'border', 'border-blue-500/40', 'text-blue-300');
        statusNotice.innerHTML = `ℹ️ Vous êtes dans le Lobby. Rejoignez une table de Cash Game pour engager vos jetons.`;
      }
      if (bonusContainer) bonusContainer.classList.remove('hidden');
      if (confirmBtn) confirmBtn.classList.add('hidden');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      return;
    }

    // 2. Si on est en mode Tournoi
    if (this.gameMode === 'tournament') {
      if (tableStackBox) tableStackBox.classList.remove('hidden');
      const humanP = this.engine.getPlayer(this.humanId);
      if (tableStackEl) tableStackEl.textContent = humanP ? humanP.chips.toLocaleString() : '0';

      if (optionsContainer) optionsContainer.classList.add('hidden');
      if (bonusContainer) bonusContainer.classList.add('hidden');
      if (statusNotice) {
        statusNotice.classList.remove('hidden', 'bg-blue-950/70', 'border-blue-500/40', 'text-blue-300', 'bg-yellow-950/80', 'border-yellow-500/40', 'text-yellow-200');
        statusNotice.classList.add('bg-amber-950/70', 'border', 'border-amber-500/40', 'text-amber-300');
        statusNotice.innerHTML = `🏆 <b>Mode Tournoi Sit & Go :</b> Les rachats de jetons sont désactivés pour préserver l'équité sportive éliminatoire.`;
      }
      if (confirmBtn) confirmBtn.classList.add('hidden');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      return;
    }

    // 3. En mode Cash Game à la table
    if (tableStackBox) tableStackBox.classList.remove('hidden');
    if (optionsContainer) optionsContainer.classList.remove('hidden');
    if (confirmBtn) confirmBtn.classList.remove('hidden');

    const humanP = this.engine.getPlayer(this.humanId);
    const currentStack = humanP ? humanP.chips : 0;
    if (tableStackEl) tableStackEl.textContent = currentStack.toLocaleString();

    const baseBuyIn = this.currentTableConfig ? this.currentTableConfig.buyIn : 1000;
    const options = [
      { label: '1 Cave', amount: baseBuyIn },
      { label: '2 Caves', amount: baseBuyIn * 2 },
      { label: '5 Caves', amount: baseBuyIn * 5 }
    ];

    this.selectedRebuyAmount = baseBuyIn;

    if (amountButtons) {
      amountButtons.innerHTML = options.map((opt, idx) => `
        <button type="button" data-amount="${opt.amount}" class="btn-rebuy-opt p-2.5 rounded-xl border text-center transition-all ${idx === 0 ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-2 ring-amber-400/50 font-black' : 'bg-slate-950/80 border-slate-700 text-slate-300 hover:border-slate-500 font-bold'}">
          <span class="text-[10px] block opacity-80">${opt.label}</span>
          <span class="text-xs font-black block">${opt.amount.toLocaleString()} 🪙</span>
        </button>
      `).join('');

      // Attacher l'écouteur de sélection
      amountButtons.querySelectorAll('.btn-rebuy-opt').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const amt = parseInt(e.currentTarget.dataset.amount, 10);
          this.selectedRebuyAmount = amt;
          amountButtons.querySelectorAll('.btn-rebuy-opt').forEach((b) => {
            b.classList.remove('bg-amber-500/25', 'border-amber-400', 'text-amber-300', 'ring-2', 'ring-amber-400/50', 'font-black');
            b.classList.add('bg-slate-950/80', 'border-slate-700', 'text-slate-300', 'font-bold');
          });
          e.currentTarget.classList.remove('bg-slate-950/80', 'border-slate-700', 'text-slate-300', 'font-bold');
          e.currentTarget.classList.add('bg-amber-500/25', 'border-amber-400', 'text-amber-300', 'ring-2', 'ring-amber-400/50', 'font-black');
        });
      });
    }

    // État de la main
    if (this.isHandRunning) {
      if (statusNotice) {
        statusNotice.classList.remove('hidden', 'bg-blue-950/70', 'border-blue-500/40', 'text-blue-300', 'bg-amber-950/70', 'border-amber-500/40', 'text-amber-300');
        statusNotice.classList.add('bg-yellow-950/80', 'border', 'border-yellow-500/40', 'text-yellow-200');
        statusNotice.innerHTML = `⏳ <b>Main en cours :</b> Votre recharge sera créditée automatiquement sur votre tapis dès la fin de ce coup !`;
      }
      if (confirmLabel) confirmLabel.textContent = 'PROGRAMMER POUR LE PROCHAIN COUP';
    } else {
      if (statusNotice) {
        statusNotice.classList.add('hidden');
      }
      if (confirmLabel) confirmLabel.textContent = 'RECHARGER LE TAPIS IMMÉDIATEMENT';
    }

    // Si le solde en banque est insuffisant pour la cave
    if (profile.chips < baseBuyIn) {
      if (bonusContainer) bonusContainer.classList.remove('hidden');
    } else {
      if (bonusContainer) bonusContainer.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  closeRebuyModal() {
    const modal = document.getElementById('rebuy-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  confirmRebuy() {
    const buyIn = this.selectedRebuyAmount || (this.currentTableConfig ? this.currentTableConfig.buyIn : 1000);
    const profile = window.storageManager.getProfile();

    if (profile.chips < buyIn) {
      this.showToast("Solde insuffisant en banque ! Récupérez vos jetons gratuits.", "⚠️");
      const bonusContainer = document.getElementById('rebuy-bonus-container');
      if (bonusContainer) bonusContainer.classList.remove('hidden');
      return;
    }

    // Si une main est en cours : programmer la recharge pour la fin de la main
    if (this.isHandRunning) {
      this.pendingRebuyAmount = buyIn;
      this.closeRebuyModal();
      if (window.soundFX) window.soundFX.playBtnClick();
      this.showToast(`Recharge de ${buyIn.toLocaleString()} 🪙 programmée pour la fin de la main !`, "⏳");
      return;
    }

    // Recharger immédiatement
    const res = this.engine.rebuy(this.humanId, buyIn);
    if (res.ok) {
      window.storageManager.addChips(-buyIn);
      this.updateUserHeader();
      const state = this.engine.getState(this.humanId);
      window.tableUI.renderSeats(state, this.humanId, this.winningCards);
      this.closeRebuyModal();
      if (window.soundFX) window.soundFX.playChipsStack();
      this.showToast(`Stack rechargé : +${buyIn.toLocaleString()} 🪙 !`, "🎰");

      if (this.engine.canStartHand()) {
        this.startNextHand();
      }
    } else {
      this.showToast(res.message || "Impossible de recharger.", "⚠️");
    }
  }

  applyPendingRebuy() {
    if (this.pendingRebuyAmount > 0 && this.engine) {
      const pendingAmt = this.pendingRebuyAmount;
      this.pendingRebuyAmount = 0;
      const profile = window.storageManager.getProfile();
      if (profile.chips >= pendingAmt) {
        const res = this.engine.rebuy(this.humanId, pendingAmt);
        if (res.ok) {
          window.storageManager.addChips(-pendingAmt);
          this.updateUserHeader();
          const state = this.engine.getState(this.humanId);
          window.tableUI.renderSeats(state, this.humanId);
          if (window.soundFX) window.soundFX.playChipsStack();
          this.showToast(`Recharge automatique appliquée : +${pendingAmt.toLocaleString()} 🪙 !`, "🎰");
        }
      }
    }
  }

  showToast(msg, icon = '🪙', durationMs = 2600) {
    const toast = document.getElementById('casino-toast');
    const toastMsg = document.getElementById('casino-toast-msg');
    const toastIcon = document.getElementById('casino-toast-icon');
    if (!toast) return;

    if (toastMsg) toastMsg.textContent = msg;
    if (toastIcon) toastIcon.textContent = icon;

    toast.classList.remove('opacity-0', '-translate-y-20', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', '-translate-y-20', 'pointer-events-none');
    }, durationMs);
  }

  stopAllTimers() {
    if (this.botStepTimeout) {
      clearTimeout(this.botStepTimeout);
      this.botStepTimeout = null;
    }
    this.botStepRemaining = 0;
    if (this.nextHandTimeout) {
      clearTimeout(this.nextHandTimeout);
      this.nextHandTimeout = null;
    }
    this.nextHandRemaining = 0;
    if (this.runoutTimeouts && this.runoutTimeouts.length) {
      this.runoutTimeouts.forEach((t) => clearTimeout(t));
      this.runoutTimeouts = [];
    }
    this.isRunoutPending = false;
    this.runoutStreets = [];
    this.runoutShowdown = null;
    this.runoutHandEnd = null;
    this.runoutContenders = [];

    if (window.tableUI) {
      window.tableUI.clearEquities();
      window.tableUI.clearWinnerShowcase();
      window.tableUI.stopTurnTimer();
    }
  }
}

// Initialiser l'application au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  window.app = new HikaPokerApp();
  window.app.init();
});
