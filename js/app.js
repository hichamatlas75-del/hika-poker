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

      // Pause de 3.5 secondes pour admirer le dénouement, puis main suivante
      this.nextHandTimeout = setTimeout(() => {
        this.startNextHand();
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

      // Main suivante après 3.8s
      this.nextHandTimeout = setTimeout(() => {
        this.startNextHand();
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
        if (window.soundFX) window.soundFX.playWin();
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
          // Auto-action en cas d'expiration du temps
          this.engine.autoAct(this.humanId);
        });
      }
    } else {
      // Tour d'un bot
      window.playerControlsUI.updateState(null, false, this.engine.blinds.bigBlind);

      // Délai de réflexion réaliste (700ms à 1600ms) pour une immersion parfaite
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
    // 1. Si on est dans le Lobby (hors partie)
    if (!this.engine) {
      const profile = window.storageManager.getProfile();
      if (profile.chips < 1000) {
        if (confirm("Votre solde est faible ! Voulez-vous recevoir un cadeau de 10,000 jetons gratuits ?")) {
          window.storageManager.addChips(10000);
          this.updateUserHeader();
        }
      } else {
        if (window.luckyWheel) window.luckyWheel.open();
      }
      return;
    }

    // 2. Si on est en mode Tournoi
    if (this.gameMode === 'tournament') {
      alert("Les rachats de jetons (rebuys) sont interdits en mode Tournoi Sit & Go éliminatoire !");
      return;
    }

    // 3. Si une main est en cours
    if (this.isHandRunning) {
      alert("Impossible de recharger vos jetons pendant une main en cours. Attendez la fin de la main.");
      return;
    }

    // 4. En Cash Game hors main
    const buyIn = this.currentTableConfig ? this.currentTableConfig.buyIn : 2000;
    const profile = window.storageManager.getProfile();

    if (profile.chips >= buyIn) {
      if (confirm(`Voulez-vous recharger votre stack de table avec ${buyIn.toLocaleString()} jetons de votre compte ?`)) {
        // Sécurité : vérifier d'abord que le moteur accepte le rachat AVANT de débiter
        const res = this.engine.rebuy(this.humanId, buyIn);
        if (res.ok) {
          window.storageManager.addChips(-buyIn);
          this.updateUserHeader();
          if (this.engine.canStartHand()) {
            this.startNextHand();
          }
        } else {
          alert('Impossible de recharger : ' + res.message);
        }
      }
    } else {
      if (profile.chips < 1000) {
        if (confirm("Votre solde de compte est épuisé ! Voulez-vous recevoir un cadeau de bienvenue de 10,000 jetons gratuits ?")) {
          window.storageManager.addChips(10000);
          this.updateUserHeader();
          const res = this.engine.rebuy(this.humanId, buyIn);
          if (res.ok) {
            window.storageManager.addChips(-buyIn);
            this.updateUserHeader();
            if (this.engine.canStartHand()) {
              this.startNextHand();
            }
          }
        }
      } else {
        if (confirm("Jetons insuffisants sur votre compte principal pour cette cave. Tentez votre chance à la Lucky Wheel pour recharger ?")) {
          if (window.luckyWheel) window.luckyWheel.open();
        }
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
