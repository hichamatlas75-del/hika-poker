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
    this.pendingTurnEvent = null;
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

    // Gestion de la Vitesse du Tournoi & Revue de Main & Bonus Quotidien
    this.selectedTourneySpeed = 'normal';
    this.lastHandSummary = null;
    this.dailyBonusTimerInterval = null;

    // Hand Replayer Interactif Carte par Carte & Galerie Avatars VIP
    this.replayerCurrentStep = 0;
    this.replayerAutoPlayTimer = null;
    this.replayerSpeed = 900;
    this.currentAvatarTab = 'vip';
    this.currentGuestAvatarTab = 'vip';
  }

  init() {
    // 0. Initialiser le client Supabase et écouter les changements d'authentification
    if (window.supabaseClient) {
      window.supabaseClient.init();
      window.supabaseClient.onAuthChange(() => {
        this.updateUserHeader();
      });
    }

    // 1. Initialiser les modules graphiques et sonores
    window.tableUI.init();
    window.playerControlsUI.init((action) => this.handlePlayerAction(action));
    try {
      if (window.luckyWheel) window.luckyWheel.init();
    } catch (err) {
      console.warn('[Hika-Poker] Initialisation LuckyWheel ignorée:', err);
    }

    // 2. Initialiser les écouteurs d'interface (Navbar, Lobby, Modals)
    this.bindGlobalEvents();

    // 3. Charger le profil et afficher le solde
    this.updateUserHeader();

    // 4. Appliquer le thème sauvegardé
    const settings = window.storageManager.getSettings();
    this.applyTheme(settings.theme || 'green');

    // 5. Exposer les fonctions globales utiles
    window.updatePlayerChipsDisplay = (chips) => this.updateChipsDisplay(chips);

    // 6. Écouter la visibilité d'onglet pour synchronisation instantanée mobile <-> desktop
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && window.storageManager) {
          console.log('[Hika-Poker] Onglet actif détecté -> rafraîchissement cloud');
          window.storageManager.refreshFromCloud();
        }
      });
      window.addEventListener('focus', () => {
        if (window.storageManager) {
          window.storageManager.refreshFromCloud();
        }
      });
    }

    // 7. Vérifier et afficher si un tournoi est en cours
    this.checkAndShowActiveTournament();

    // 8. Initialiser le badge de notification du bonus quotidien et le sélecteur de vitesse
    this.updateDailyBonusNotificationBadge();
    this.setTournamentSpeed('normal');

    // 9. Initialiser l'état visuel du bouton son
    this.updateSoundButtonUI();

    // 10. Vérifier automatiquement l'éligibilité au Bonus Quotidien au lancement
    setTimeout(() => {
      const dailyStatus = window.storageManager.getDailyBonusStatus();
      if (dailyStatus.canClaim) {
        this.openDailyBonusModal();
      }
    }, 1200);

    console.log('[Hika-Poker] Initialisation terminée.');
  }

  bindGlobalEvents() {
    // Navigation Lobby -> Mode Cash
    const cashTables = document.querySelectorAll('.btn-select-cash-table');
    cashTables.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (window.soundFX) window.soundFX.playBtnClick();
        const stakes = e.currentTarget.dataset.stakes; // 'micro', 'low', 'high'
        this.startCashGame(stakes);
      });
    });

    // Navigation Lobby -> Mode Tournoi Sit & Go
    const btnTourney = document.getElementById('btn-start-tournament');
    if (btnTourney) {
      btnTourney.addEventListener('click', () => {
        if (window.soundFX) window.soundFX.playBtnClick();
        this.startTournamentGame();
      });
    }

    // Boutons de la bannière Tournoi en cours
    const btnResumeTourney = document.getElementById('btn-resume-active-tournament');
    if (btnResumeTourney) {
      btnResumeTourney.addEventListener('click', () => {
        if (window.soundFX) window.soundFX.playBtnClick();
        this.resumeActiveTournament();
      });
    }

    const btnDiscardTourney = document.getElementById('btn-discard-active-tournament');
    if (btnDiscardTourney) {
      btnDiscardTourney.addEventListener('click', () => {
        this.discardActiveTournament();
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

    // Boutons Reprendre dans le bandeau flottant ou modal de pause
    const btnResumeBanner = document.getElementById('btn-resume-banner');
    if (btnResumeBanner) {
      btnResumeBanner.addEventListener('click', () => {
        this.resumeGame();
      });
    }

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

    // Raccourcis clavier complets Casino : P (Pause), F (Fold), Espace/C (Check/Call), R (Raise), A (All-in), Echap (Fermer)
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      // Echap : Ferme les tiroirs ou fenêtres modales ouvertes
      if (e.key === 'Escape') {
        const slider = document.getElementById('raise-slider-container');
        if (slider && !slider.classList.contains('hidden')) {
          window.playerControlsUI.hideRaiseSlider();
          return;
        }
        ['rebuy-modal', 'stats-modal', 'auth-modal', 'wheel-modal', 'daily-bonus-modal', 'hand-replayer-modal'].forEach((id) => {
          const m = document.getElementById(id);
          if (m && !m.classList.contains('hidden')) {
            m.classList.add('hidden');
            m.classList.remove('flex');
          }
        });
        return;
      }

      // 'P' : Mettre en pause ou reprendre
      if (e.key === 'p' || e.key === 'P') {
        const tableView = document.getElementById('table-view');
        if (tableView && !tableView.classList.contains('hidden') && this.engine) {
          this.togglePause();
          return;
        }
      }

      // Raccourcis d'action de jeu au tour du joueur humain
      if (!this.engine || this.isPaused) return;
      const curSeat = this.engine.seats[this.engine.currentSeat];
      if (!curSeat || curSeat.id !== this.humanId) return;

      const legal = this.engine.getLegalActions(this.humanId);
      if (!legal) return;

      const key = e.key.toLowerCase();
      if (key === 'f') {
        // Fold
        e.preventDefault();
        if (window.soundFX) window.soundFX.playFold();
        this.handlePlayerAction({ type: 'fold' });
      } else if (key === 'c' || e.code === 'Space') {
        // Check ou Call
        e.preventDefault();
        if (legal.canCheck) {
          if (window.soundFX) window.soundFX.playCheck();
          this.handlePlayerAction({ type: 'check' });
        } else if (legal.canCall) {
          if (window.soundFX) window.soundFX.playChip();
          this.handlePlayerAction({ type: 'call' });
        }
      } else if (key === 'r') {
        // Raise / Miser
        e.preventDefault();
        const slider = document.getElementById('raise-slider-container');
        if (slider && !slider.classList.contains('hidden')) {
          const val = parseInt(document.getElementById('raise-range-slider')?.value, 10);
          if (window.soundFX) window.soundFX.playChip();
          const isBet = legal.canBet;
          this.handlePlayerAction({ type: isBet ? 'bet' : 'raise', amount: val });
          window.playerControlsUI.hideRaiseSlider();
        } else if (legal.canRaise) {
          window.playerControlsUI.toggleRaiseSlider();
        }
      } else if (key === 'a') {
        // All-in
        e.preventDefault();
        if (legal.canAllIn) {
          if (window.soundFX) window.soundFX.playAllIn();
          this.handlePlayerAction({ type: 'allin' });
        }
      } else if (key === 'm' && !['input', 'textarea'].includes(e.target?.tagName?.toLowerCase())) {
        // Raccourci Mute / Unmute
        e.preventDefault();
        if (window.soundFX) {
          const isMuted = window.soundFX.toggleMute();
          this.updateSoundButtonUI();
          this.showToast(isMuted ? 'Son désactivé' : 'Son activé', isMuted ? '🔇' : '🔊');
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

    // Toggle Son (Mute) - Lobby & Table
    const soundToggleHandler = () => {
      if (window.soundFX) {
        const isMuted = window.soundFX.toggleMute();
        this.updateSoundButtonUI();
        this.showToast(isMuted ? 'Son désactivé' : 'Son activé', isMuted ? '🔇' : '🔊');
      }
    };
    const btnToggleSound = document.getElementById('btn-toggle-sound');
    if (btnToggleSound) btnToggleSound.addEventListener('click', soundToggleHandler);
    const btnTableToggleSound = document.getElementById('btn-table-toggle-sound');
    if (btnTableToggleSound) btnTableToggleSound.addEventListener('click', soundToggleHandler);

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

    // Onglets de Navigation dans le Profil / Stats Modal
    const tabStatsOverview = document.getElementById('tab-stats-overview');
    if (tabStatsOverview) tabStatsOverview.addEventListener('click', () => this.switchStatsTab('overview'));
    const tabStatsHands = document.getElementById('tab-stats-hands');
    if (tabStatsHands) tabStatsHands.addEventListener('click', () => this.switchStatsTab('hands'));
    const tabStatsLeader = document.getElementById('tab-stats-leaderboard');
    if (tabStatsLeader) tabStatsLeader.addEventListener('click', () => this.switchStatsTab('leaderboard'));
    const tabStatsSettings = document.getElementById('tab-stats-settings');
    if (tabStatsSettings) tabStatsSettings.addEventListener('click', () => this.switchStatsTab('settings'));

    // Sélecteur de Thème du Feutre
    const themeSelect = document.getElementById('table-theme-select');
    const settingsThemeSelect = document.getElementById('settings-theme-select');
    const applyThemeChange = (val) => {
      this.applyTheme(val);
      window.storageManager.updateSettings({ theme: val });
      if (themeSelect) themeSelect.value = val;
      if (settingsThemeSelect) settingsThemeSelect.value = val;
    };
    if (themeSelect) themeSelect.addEventListener('change', (e) => applyThemeChange(e.target.value));
    if (settingsThemeSelect) settingsThemeSelect.addEventListener('change', (e) => applyThemeChange(e.target.value));

    // Synchronisation Cartes 4 Couleurs Optionnelles (Table HUD & Modal Paramètres)
    const toggle4C = document.getElementById('toggle-four-color-deck');
    const setting4C = document.getElementById('setting-four-color-deck');
    const current4CSettings = window.storageManager.getSettings();
    if (toggle4C) toggle4C.checked = !!current4CSettings.fourColorDeck;
    if (setting4C) setting4C.checked = !!current4CSettings.fourColorDeck;

    const apply4Color = (enabled) => {
      window.storageManager.updateSettings({ fourColorDeck: enabled });
      if (toggle4C) toggle4C.checked = enabled;
      if (setting4C) setting4C.checked = enabled;
      if (this.engine) {
        const state = this.engine.getState(this.humanId);
        window.tableUI.renderSeats(state, this.humanId, this.winningCards || []);
        window.tableUI.renderBoard(state.board || [], this.winningCards || []);
      }
      const replayerModal = document.getElementById('hand-replayer-modal');
      if (replayerModal && !replayerModal.classList.contains('hidden')) {
        this.renderHandReplayerStep(this.replayerCurrentStep);
      }
      this.showToast(enabled ? "Jeu 4 Couleurs Activé (♠ Noir, ♥ Rouge, ♦ Bleu, ♣ Vert)" : "Jeu Standard 2 Couleurs Activé", "🃏");
    };
    if (toggle4C) toggle4C.addEventListener('change', (e) => apply4Color(e.target.checked));
    if (setting4C) setting4C.addEventListener('change', (e) => apply4Color(e.target.checked));

    // Contrôles Audio & Volume dans les Paramètres
    const settingsSoundToggle = document.getElementById('settings-btn-toggle-sound');
    if (settingsSoundToggle) {
      settingsSoundToggle.addEventListener('click', () => {
        soundToggleHandler();
        const isMuted = !!(window.soundFX && window.soundFX.muted);
        settingsSoundToggle.textContent = isMuted ? '🔇 Désactivé' : '🔊 Activé';
        settingsSoundToggle.classList.toggle('text-rose-400', isMuted);
      });
    }

    const settingsVol = document.getElementById('settings-sound-volume');
    const settingsVolVal = document.getElementById('settings-sound-volume-val');
    if (settingsVol) {
      settingsVol.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) / 100;
        if (window.soundFX && typeof window.soundFX.setVolume === 'function') {
          window.soundFX.setVolume(val);
        } else if (window.soundFX) {
          window.soundFX.volume = val;
          if (window.soundFX.masterGain && window.soundFX.ctx) {
            window.soundFX.masterGain.gain.setValueAtTime(val, window.soundFX.ctx.currentTime);
          }
        }
        if (settingsVolVal) settingsVolVal.textContent = `${e.target.value}%`;
      });
    }

    const settingsHaptics = document.getElementById('settings-toggle-haptics');
    if (settingsHaptics) {
      settingsHaptics.addEventListener('change', (e) => {
        if (window.soundFX) window.soundFX.hapticsEnabled = e.target.checked;
        this.showToast(e.target.checked ? "Vibrations haptiques activées" : "Vibrations désactivées", "📳");
      });
    }

    // Sous-onglets de sélection d'Avatar (VIP Zynga vs Émojis)
    const tabAvVip = document.getElementById('tab-avatar-vip');
    const tabAvEmoji = document.getElementById('tab-avatar-emoji');
    if (tabAvVip && tabAvEmoji) {
      tabAvVip.addEventListener('click', () => {
        this.currentAvatarTab = 'vip';
        tabAvVip.className = 'flex-1 py-1 rounded bg-amber-500 text-slate-950 font-black shadow transition-all';
        tabAvEmoji.className = 'flex-1 py-1 rounded text-slate-400 hover:text-white transition-all';
        this.populateAvatarPickers();
      });
      tabAvEmoji.addEventListener('click', () => {
        this.currentAvatarTab = 'emoji';
        tabAvEmoji.className = 'flex-1 py-1 rounded bg-amber-500 text-slate-950 font-black shadow transition-all';
        tabAvVip.className = 'flex-1 py-1 rounded text-slate-400 hover:text-white transition-all';
        this.populateAvatarPickers();
      });
    }

    const tabGuestAvVip = document.getElementById('tab-guest-avatar-vip');
    const tabGuestAvEmoji = document.getElementById('tab-guest-avatar-emoji');
    if (tabGuestAvVip && tabGuestAvEmoji) {
      tabGuestAvVip.addEventListener('click', () => {
        this.currentGuestAvatarTab = 'vip';
        tabGuestAvVip.className = 'flex-1 py-1 rounded bg-amber-500 text-slate-950 font-black shadow transition-all';
        tabGuestAvEmoji.className = 'flex-1 py-1 rounded text-slate-400 hover:text-white transition-all';
        this.populateAvatarPickers();
      });
      tabGuestAvEmoji.addEventListener('click', () => {
        this.currentGuestAvatarTab = 'emoji';
        tabGuestAvEmoji.className = 'flex-1 py-1 rounded bg-amber-500 text-slate-950 font-black shadow transition-all';
        tabGuestAvVip.className = 'flex-1 py-1 rounded text-slate-400 hover:text-white transition-all';
        this.populateAvatarPickers();
      });
    }

    // Boutons de Vitesse du Tournoi (Sit & Go Championship)
    const speedButtons = document.querySelectorAll('.btn-tourney-speed');
    speedButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const speed = e.currentTarget.dataset.speed;
        this.setTournamentSpeed(speed);
      });
    });

    // Bouton et Modal Revoir la dernière main (Hand Replayer Interactif Carte par Carte)
    const btnReplayer = document.getElementById('btn-hand-replayer');
    if (btnReplayer) {
      btnReplayer.addEventListener('click', () => this.openHandReplayerModal());
    }
    const btnCloseReplayer = document.getElementById('btn-close-hand-replayer');
    if (btnCloseReplayer) {
      btnCloseReplayer.addEventListener('click', () => this.closeHandReplayerModal());
    }
    const btnCloseReplayerBottom = document.getElementById('btn-replayer-close-bottom');
    if (btnCloseReplayerBottom) {
      btnCloseReplayerBottom.addEventListener('click', () => this.closeHandReplayerModal());
    }

    const btnRepFirst = document.getElementById('btn-replayer-first');
    if (btnRepFirst) btnRepFirst.addEventListener('click', () => this.setReplayerStep(0));

    const btnRepPrev = document.getElementById('btn-replayer-prev');
    if (btnRepPrev) btnRepPrev.addEventListener('click', () => this.setReplayerStep(this.replayerCurrentStep - 1));

    const btnRepPlay = document.getElementById('btn-replayer-play');
    if (btnRepPlay) btnRepPlay.addEventListener('click', () => this.toggleReplayerAutoPlay());

    const btnRepNext = document.getElementById('btn-replayer-next');
    if (btnRepNext) btnRepNext.addEventListener('click', () => this.setReplayerStep(this.replayerCurrentStep + 1));

    const btnRepLast = document.getElementById('btn-replayer-last');
    if (btnRepLast) btnRepLast.addEventListener('click', () => this.setReplayerStep(5));

    const repSpeed = document.getElementById('replayer-speed-select');
    if (repSpeed) {
      repSpeed.addEventListener('change', (e) => {
        this.replayerSpeed = parseInt(e.target.value, 10) || 900;
        if (this.replayerAutoPlayTimer) {
          this.toggleReplayerAutoPlay();
          this.toggleReplayerAutoPlay();
        }
      });
    }

    const stepBtns = document.querySelectorAll('.replayer-step-btn');
    stepBtns.forEach((b) => {
      b.addEventListener('click', (e) => {
        const s = parseInt(e.currentTarget.dataset.step, 10);
        if (!isNaN(s)) this.setReplayerStep(s);
      });
    });

    // Bouton et Modal Daily Login Bonus 7 Jours
    const btnOpenDaily = document.getElementById('btn-open-daily-bonus');
    if (btnOpenDaily) {
      btnOpenDaily.addEventListener('click', () => this.openDailyBonusModal());
    }
    const btnCloseDaily = document.getElementById('btn-close-daily-bonus');
    if (btnCloseDaily) {
      btnCloseDaily.addEventListener('click', () => this.closeDailyBonusModal());
    }
    const btnClaimDaily = document.getElementById('btn-claim-daily-bonus');
    if (btnClaimDaily) {
      btnClaimDaily.addEventListener('click', () => this.claimDailyBonus());
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

    // Bouton Profil dans le Header -> Ouvre le Modal de Compte / Connexion
    const btnProfileHeader = document.getElementById('user-header-profile-btn');
    if (btnProfileHeader) {
      btnProfileHeader.addEventListener('click', (e) => {
        if (e.target.closest('#btn-rebuy-chips')) return;
        this.openAuthModal();
      });
    }

    // Modal Authentification
    const btnAuthClose = document.getElementById('auth-close-btn');
    if (btnAuthClose) {
      btnAuthClose.addEventListener('click', () => this.closeAuthModal());
    }

    const tabAuthLogin = document.getElementById('tab-auth-login');
    if (tabAuthLogin) {
      tabAuthLogin.addEventListener('click', () => this.switchAuthTab('login'));
    }
    const tabAuthReg = document.getElementById('tab-auth-register');
    if (tabAuthReg) {
      tabAuthReg.addEventListener('click', () => this.switchAuthTab('register'));
    }

    const formLogin = document.getElementById('form-auth-login');
    if (formLogin) {
      formLogin.addEventListener('submit', (e) => this.handleAuthLogin(e));
    }
    const formReg = document.getElementById('form-auth-register');
    if (formReg) {
      formReg.addEventListener('submit', (e) => this.handleAuthRegister(e));
    }

    const btnAuthGuest = document.getElementById('btn-auth-guest');
    if (btnAuthGuest) {
      btnAuthGuest.addEventListener('click', () => this.closeAuthModal());
    }

    const btnAuthLogout = document.getElementById('btn-auth-logout');
    if (btnAuthLogout) {
      btnAuthLogout.addEventListener('click', () => this.handleAuthLogout());
    }

    const btnToggleCfg = document.getElementById('auth-toggle-config-btn');
    const panelCfg = document.getElementById('auth-config-panel');
    if (btnToggleCfg && panelCfg) {
      btnToggleCfg.addEventListener('click', () => {
        panelCfg.classList.toggle('hidden');
      });
    }

    const btnSaveCfg = document.getElementById('btn-save-supabase-config');
    if (btnSaveCfg) {
      btnSaveCfg.addEventListener('click', () => {
        const url = document.getElementById('cfg-supabase-url')?.value;
        const key = document.getElementById('cfg-supabase-key')?.value;
        if (window.supabaseClient && window.supabaseClient.saveCustomConfig(url, key)) {
          this.showToast('Clés Supabase enregistrées avec succès !', '⚙️');
          if (panelCfg) panelCfg.classList.add('hidden');
          this.openAuthModal();
        } else {
          alert('Veuillez saisir une URL valide et une clé anonyme Supabase.');
        }
      });
    }

    // Onglets du Modal de Statistiques (Stats / Mes Mains / Leaderboard)
    const tabStatsOverview = document.getElementById('tab-stats-overview');
    if (tabStatsOverview) {
      tabStatsOverview.addEventListener('click', () => this.switchStatsTab('overview'));
    }
    const tabStatsHands = document.getElementById('tab-stats-hands');
    if (tabStatsHands) {
      tabStatsHands.addEventListener('click', () => this.switchStatsTab('hands'));
    }
    const tabStatsLeader = document.getElementById('tab-stats-leaderboard');
    if (tabStatsLeader) {
      tabStatsLeader.addEventListener('click', () => this.switchStatsTab('leaderboard'));
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
    if (avatarEl) {
      if (window.HikaAvatars && typeof window.HikaAvatars.renderAvatarHTML === 'function') {
        avatarEl.innerHTML = window.HikaAvatars.renderAvatarHTML(prof.avatar, 'w-full h-full text-sm');
      } else {
        avatarEl.textContent = prof.avatar || '👑';
      }
    }
    const tableChipsEl = document.getElementById('table-hud-chips-text');
    if (tableChipsEl) tableChipsEl.textContent = prof.chips.toLocaleString();

    if (window.storageManager && typeof window.storageManager.updateCloudStatusIndicator === 'function') {
      const isCloud = window.supabaseClient && window.supabaseClient.isReady() && !!window.supabaseClient.getCurrentUser();
      window.storageManager.updateCloudStatusIndicator(isCloud);
    }
  }

  updateChipsDisplay(newChips) {
    const chipsEl = document.getElementById('user-header-chips');
    if (chipsEl) chipsEl.textContent = newChips.toLocaleString();
    const tableChipsEl = document.getElementById('table-hud-chips-text');
    if (tableChipsEl) tableChipsEl.textContent = newChips.toLocaleString();
  }

  updateSoundButtonUI() {
    const isMuted = !!(window.soundFX && window.soundFX.muted);
    const btns = [
      document.getElementById('btn-toggle-sound'),
      document.getElementById('btn-table-toggle-sound')
    ];
    btns.forEach((btn) => {
      if (!btn) return;
      btn.innerHTML = isMuted ? '🔇' : '🔊';
      btn.title = isMuted ? 'Activer le son (Raccourci M)' : 'Couper le son (Raccourci M)';
      btn.setAttribute('aria-label', isMuted ? 'Activer le son' : 'Couper le son');
      btn.classList.toggle('text-rose-400', isMuted);
      btn.classList.toggle('border-rose-500/50', isMuted);
      btn.classList.toggle('bg-rose-950/40', isMuted);
    });
  }

  // =========================================================================
  // GESTION DU MODAL STATS, MAINS & LEADERBOARD (AVEC ONGLETS)
  // =========================================================================

  openStatsModal() {
    this.switchStatsTab('overview');

    const modal = document.getElementById('stats-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  switchStatsTab(tabName) {
    const tabOverview = document.getElementById('tab-stats-overview');
    const tabHands = document.getElementById('tab-stats-hands');
    const tabLeaderboard = document.getElementById('tab-stats-leaderboard');
    const tabSettings = document.getElementById('tab-stats-settings');

    const panelOverview = document.getElementById('stats-panel-overview');
    const panelHands = document.getElementById('stats-panel-hands');
    const panelLeaderboard = document.getElementById('stats-panel-leaderboard');
    const panelSettings = document.getElementById('stats-panel-settings');

    const tabs = [tabOverview, tabHands, tabLeaderboard, tabSettings];
    const panels = [panelOverview, panelHands, panelLeaderboard, panelSettings];

    tabs.forEach((t) => {
      if (t) {
        t.classList.remove('bg-amber-500', 'text-slate-950', 'shadow');
        t.classList.add('text-slate-400');
      }
    });
    panels.forEach((p) => {
      if (p) p.classList.add('hidden');
    });

    if (tabName === 'overview') {
      if (tabOverview) {
        tabOverview.classList.add('bg-amber-500', 'text-slate-950', 'shadow');
        tabOverview.classList.remove('text-slate-400');
      }
      if (panelOverview) panelOverview.classList.remove('hidden');

      const stats = window.storageManager.getStats();
      const elPlayed = document.getElementById('stat-hands-played');
      const elWon = document.getElementById('stat-hands-won');
      const elWinRate = document.getElementById('stat-win-rate');
      const elPot = document.getElementById('stat-biggest-pot');
      const elBest = document.getElementById('stat-best-hand');
      const elTourney = document.getElementById('stat-tourney-won');
      const elTotal = document.getElementById('stat-total-won');

      if (elPlayed) elPlayed.textContent = stats.handsPlayed;
      if (elWon) elWon.textContent = stats.handsWon;
      const winRate = stats.handsPlayed > 0 ? Math.round((stats.handsWon / stats.handsPlayed) * 100) : 0;
      if (elWinRate) elWinRate.textContent = `${winRate}%`;
      if (elPot) elPot.textContent = stats.biggestPot.toLocaleString();
      if (elBest) elBest.textContent = stats.bestHand || 'Aucune';
      if (elTourney) elTourney.textContent = `${stats.tournamentsWon} / ${stats.tournamentsPlayed}`;
      if (elTotal) elTotal.textContent = `${stats.totalWon.toLocaleString()} 🪙`;

    } else if (tabName === 'hands') {
      if (tabHands) {
        tabHands.classList.add('bg-amber-500', 'text-slate-950', 'shadow');
        tabHands.classList.remove('text-slate-400');
      }
      if (panelHands) panelHands.classList.remove('hidden');
      this.renderRecentHands();

    } else if (tabName === 'leaderboard') {
      if (tabLeaderboard) {
        tabLeaderboard.classList.add('bg-amber-500', 'text-slate-950', 'shadow');
        tabLeaderboard.classList.remove('text-slate-400');
      }
      if (panelLeaderboard) panelLeaderboard.classList.remove('hidden');
      this.renderLeaderboard();

    } else if (tabName === 'settings') {
      if (tabSettings) {
        tabSettings.classList.add('bg-amber-500', 'text-slate-950', 'shadow');
        tabSettings.classList.remove('text-slate-400');
      }
      if (panelSettings) panelSettings.classList.remove('hidden');

      // Synchroniser les contrôles des paramètres
      const s = window.storageManager.getSettings();
      const check4C = document.getElementById('setting-four-color-deck');
      if (check4C) check4C.checked = !!s.fourColorDeck;

      const themeSel = document.getElementById('settings-theme-select');
      if (themeSel) themeSel.value = s.theme || 'green';

      const volSlider = document.getElementById('settings-sound-volume');
      const volVal = document.getElementById('settings-sound-volume-val');
      const currentVol = window.soundFX ? window.soundFX.volume : 0.8;
      const pct = Math.round(currentVol * 100);
      if (volSlider) volSlider.value = pct;
      if (volVal) volVal.textContent = `${pct}%`;

      const soundBtn = document.getElementById('settings-btn-toggle-sound');
      const isMuted = !!(window.soundFX && window.soundFX.muted);
      if (soundBtn) {
        soundBtn.textContent = isMuted ? '🔇 Désactivé' : '🔊 Activé';
        soundBtn.classList.toggle('text-rose-400', isMuted);
      }

      const hapticsToggle = document.getElementById('settings-toggle-haptics');
      if (hapticsToggle && window.soundFX) {
        hapticsToggle.checked = window.soundFX.hapticsEnabled !== false;
      }
    }
  }

  async renderRecentHands() {
    const listEl = document.getElementById('stats-hands-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-center py-6 text-xs text-slate-400 animate-pulse">Chargement de l\'historique des mains...</div>';

    const hands = await window.storageManager.getRecentHands(10);
    if (!hands || hands.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-8 text-xs text-slate-400 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
          <span class="text-2xl block mb-2">🃏</span>
          <p class="font-bold text-slate-300">Aucune main enregistrée</p>
          <p class="text-[10px] text-slate-500 mt-1">Lancez une partie Cash Game ou Tournoi pour voir vos mains ici !</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = hands.map((h) => {
      const isWin = !!h.won;
      const chipBadge = isWin
        ? `<span class="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-black text-xs">+${Number(h.potAmount || 0).toLocaleString()} 🪙</span>`
        : `<span class="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-400 font-bold text-xs">Perdu / Fold</span>`;

      const comboText = h.handLabel || (isWin ? 'Main gagnante' : 'Couché');
      const modeText = h.gameMode === 'tournament' ? '🏆 Tournoi' : '🎰 Cash';

      let timeText = '';
      if (h.createdAt) {
        try {
          const d = new Date(h.createdAt);
          timeText = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
          timeText = '';
        }
      }

      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg ${isWin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'} flex items-center justify-center text-sm font-black">
              ${isWin ? '★' : '•'}
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-black text-white">${comboText}</span>
                <span class="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">${modeText}</span>
              </div>
              <span class="text-[10px] text-slate-500">${timeText}</span>
            </div>
          </div>
          <div>
            ${chipBadge}
          </div>
        </div>
      `;
    }).join('');
  }

  async renderLeaderboard() {
    const listEl = document.getElementById('stats-leaderboard-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-center py-6 text-xs text-slate-400 animate-pulse">Chargement du classement mondial...</div>';

    const topPlayers = await window.storageManager.getLeaderboard(10);
    if (!topPlayers || topPlayers.length === 0) {
      listEl.innerHTML = '<div class="text-center py-6 text-xs text-slate-400">Classement temporairement indisponible.</div>';
      return;
    }

    const currentUserId = window.supabaseClient && window.supabaseClient.getCurrentUser()?.id;

    listEl.innerHTML = topPlayers.map((p, idx) => {
      const rank = idx + 1;
      let medal = `<span class="font-bold text-slate-400 text-xs w-5 text-center">${rank}.</span>`;
      if (rank === 1) medal = `<span class="text-base w-5 text-center">🥇</span>`;
      else if (rank === 2) medal = `<span class="text-base w-5 text-center">🥈</span>`;
      else if (rank === 3) medal = `<span class="text-base w-5 text-center">🥉</span>`;

      const isMe = p.isCurrentUser || (currentUserId && p.id === currentUserId);
      const rowClass = isMe
        ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700';

      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl border ${rowClass} transition-colors">
          <div class="flex items-center gap-2.5">
            ${medal}
            <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm shadow">
              ${p.avatar || '👑'}
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-black text-white truncate max-w-[120px] sm:max-w-[160px]">${p.name}</span>
                ${isMe ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black">VOUS</span>' : ''}
              </div>
              <span class="text-[10px] text-slate-400">${Number(p.handsWon || 0).toLocaleString()} victoires</span>
            </div>
          </div>
          <div class="text-right">
            <span class="text-xs font-black text-amber-300">${Number(p.chips || 0).toLocaleString()} 🪙</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // GESTION DU MODAL AUTHENTIFICATION & COMPTE SUPABASE
  // =========================================================================

  openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    const loggedView = document.getElementById('auth-view-logged');
    const guestView = document.getElementById('auth-view-guest');
    const feedback = document.getElementById('auth-feedback');
    if (feedback) feedback.className = 'hidden';

    const user = window.supabaseClient && window.supabaseClient.getCurrentUser();
    if (user) {
      if (loggedView) loggedView.classList.remove('hidden');
      if (guestView) guestView.classList.add('hidden');

      const prof = window.storageManager.getProfile();
      const stats = window.storageManager.getStats();

      const nameEl = document.getElementById('auth-user-card-name');
      const avatarEl = document.getElementById('auth-user-card-avatar');
      const chipsEl = document.getElementById('auth-user-card-chips');
      const wonEl = document.getElementById('auth-user-card-won');

      if (nameEl) nameEl.textContent = prof.name;
      if (avatarEl) {
        if (window.HikaAvatars && typeof window.HikaAvatars.renderAvatarHTML === 'function') {
          avatarEl.innerHTML = window.HikaAvatars.renderAvatarHTML(prof.avatar, 'w-full h-full text-3xl');
        } else {
          avatarEl.textContent = prof.avatar || '👑';
        }
      }
      if (chipsEl) chipsEl.textContent = `${prof.chips.toLocaleString()} 🪙`;
      if (wonEl) wonEl.textContent = stats.handsWon.toLocaleString();

    } else {
      if (loggedView) loggedView.classList.add('hidden');
      if (guestView) guestView.classList.remove('hidden');

      this.populateAuthAvatarPicker();
      this.switchAuthTab('login');

      const urlInput = document.getElementById('cfg-supabase-url');
      const keyInput = document.getElementById('cfg-supabase-key');
      if (urlInput && window.supabaseClient) urlInput.value = window.supabaseClient.url || '';
      if (keyInput && window.supabaseClient) keyInput.value = window.supabaseClient.anonKey || '';
    }

    this.populateAvatarPickers();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  populateAvatarPickers() {
    const isVip = this.currentAvatarTab !== 'emoji';
    const isGuestVip = this.currentGuestAvatarTab !== 'emoji';
    const currentAvatar = window.storageManager.getProfile().avatar || '👑';

    // 1. Profil connecté
    const profGrid = document.getElementById('profile-avatar-grid');
    if (profGrid) {
      this._renderAvatarGrid(profGrid, isVip, currentAvatar, (avId) => this.selectAvatar(avId));
    }

    // 2. Profil invité
    const guestGrid = document.getElementById('guest-avatar-grid');
    if (guestGrid) {
      this._renderAvatarGrid(guestGrid, isGuestVip, currentAvatar, (avId) => this.selectAvatar(avId));
    }

    // 3. Formulaire d'inscription
    const regGrid = document.getElementById('auth-avatar-grid');
    if (regGrid && regGrid.children.length === 0) {
      const presets = (window.HikaAvatars && window.HikaAvatars.AVATAR_PRESETS) || [];
      const emojis = (window.HikaAvatars && window.HikaAvatars.CLASSIC_EMOJIS) || ['👑', '🤠', '🦁', '🦈', '🕶️'];
      const combined = presets.slice(0, 5).concat(emojis.slice(0, 5).map(e => ({ id: e, isEmoji: true })));
      const hiddenRegInput = document.getElementById('auth-register-avatar');

      combined.forEach((item, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `h-10 rounded-xl flex items-center justify-center transition-all bg-slate-900 border ${i === 0 ? 'border-amber-400 bg-amber-500/20 scale-105 shadow' : 'border-slate-800 hover:border-slate-700'} cursor-pointer p-1`;
        if (item.isEmoji) {
          btn.innerHTML = `<span class="text-xl">${item.id}</span>`;
        } else {
          btn.innerHTML = `<div class="w-8 h-8 rounded-full overflow-hidden">${item.svg}</div>`;
        }
        btn.addEventListener('click', () => {
          Array.from(regGrid.children).forEach((b) => {
            b.className = 'h-10 rounded-xl flex items-center justify-center transition-all bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer p-1';
          });
          btn.className = 'h-10 rounded-xl flex items-center justify-center transition-all bg-amber-500/25 border-2 border-amber-400 scale-105 shadow cursor-pointer p-1';
          if (hiddenRegInput) hiddenRegInput.value = item.id;
        });
        regGrid.appendChild(btn);
      });
    }

    this.updateAvatarPreviewLabels(currentAvatar);
  }

  _renderAvatarGrid(container, isVip, currentAvatar, onSelect) {
    container.innerHTML = '';
    if (isVip && window.HikaAvatars) {
      container.className = 'grid grid-cols-2 sm:grid-cols-5 gap-2 max-h-[165px] overflow-y-auto pr-0.5';
      window.HikaAvatars.AVATAR_PRESETS.forEach((preset) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isSel = preset.id === currentAvatar;
        btn.className = `vip-avatar-card relative p-2 rounded-xl flex flex-col items-center gap-1 border transition-all ${isSel ? 'avatar-selected border-amber-400 bg-amber-500/25 shadow-lg' : 'border-slate-800 bg-slate-900/80 hover:border-amber-500/50'} cursor-pointer text-left`;
        btn.innerHTML = `
          <div class="w-10 h-10 rounded-full overflow-hidden p-0.5 shadow-md flex items-center justify-center bg-slate-950">
            ${preset.svg}
          </div>
          <span class="text-[10px] font-black text-slate-200 truncate max-w-full leading-tight">${preset.name}</span>
          <span class="text-[8px] font-bold px-1.5 py-0.2 rounded ${preset.badgeColor || 'bg-amber-500 text-slate-950'} uppercase">${preset.tag || 'VIP'}</span>
          ${isSel ? '<span class="absolute top-1 right-1 text-xs text-amber-400 font-black">✓</span>' : ''}
        `;
        btn.addEventListener('click', () => onSelect(preset.id));
        container.appendChild(btn);
      });
    } else {
      container.className = 'grid grid-cols-8 gap-1.5 max-h-[160px] overflow-y-auto pr-0.5';
      const emojis = (window.HikaAvatars && window.HikaAvatars.CLASSIC_EMOJIS) || ['👑', '🤠', '🦁', '🦈', '🕶️', '🎩', '💎', '🦊', '🤖', '🧙', '🐺', '🚀', '🔥', '🐯', '⚡', '🐉'];
      emojis.forEach((emoji) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isSel = emoji === currentAvatar;
        btn.className = `h-9 w-9 sm:h-10 sm:w-10 rounded-xl text-lg flex items-center justify-center transition-all bg-slate-900 border ${isSel ? 'border-amber-400 bg-amber-500/25 scale-110 shadow-lg' : 'border-slate-800 hover:border-slate-600'} cursor-pointer`;
        btn.textContent = emoji;
        btn.addEventListener('click', () => onSelect(emoji));
        container.appendChild(btn);
      });
    }
  }

  updateAvatarPreviewLabels(currentAvatar) {
    const meta = window.HikaAvatars ? window.HikaAvatars.getAvatarMeta(currentAvatar) : null;
    const displayText = meta ? `${meta.name} (${meta.tag})` : currentAvatar;
    const prevSel = document.getElementById('auth-selected-avatar-preview');
    if (prevSel) prevSel.textContent = `Actuel : ${displayText}`;
    const guestPrevSel = document.getElementById('guest-selected-avatar-preview');
    if (guestPrevSel) guestPrevSel.textContent = `Actuel : ${displayText}`;
  }

  selectAvatar(avatarId) {
    window.storageManager.setAvatar(avatarId);
    this.updateUserHeader();
    if (this.engine) {
      const hp = this.engine.getPlayer(this.humanId);
      if (hp) hp.avatar = avatarId;
      window.tableUI.renderSeats(this.engine.getState(this.humanId), this.humanId, this.winningCards || []);
    }
    this.populateAvatarPickers();
    const meta = window.HikaAvatars ? window.HikaAvatars.getAvatarMeta(avatarId) : null;
    const toastLabel = meta ? meta.name : avatarId;
    this.showToast(`Avatar sélectionné : ${toastLabel}`, meta ? '👑' : avatarId);
  }

  switchAuthTab(tab) {
    const tabLogin = document.getElementById('tab-auth-login');
    const tabRegister = document.getElementById('tab-auth-register');
    const formLogin = document.getElementById('form-auth-login');
    const formRegister = document.getElementById('form-auth-register');
    const feedback = document.getElementById('auth-feedback');
    if (feedback) feedback.className = 'hidden';

    if (tab === 'login') {
      if (tabLogin) {
        tabLogin.classList.add('bg-amber-500', 'text-slate-950', 'shadow');
        tabLogin.classList.remove('text-slate-400');
      }
      if (tabRegister) {
        tabRegister.classList.remove('bg-amber-500', 'text-slate-950', 'shadow');
        tabRegister.classList.add('text-slate-400');
      }
      if (formLogin) formLogin.classList.remove('hidden');
      if (formRegister) formRegister.classList.add('hidden');
    } else {
      if (tabRegister) {
        tabRegister.classList.add('bg-amber-500', 'text-slate-950', 'shadow');
        tabRegister.classList.remove('text-slate-400');
      }
      if (tabLogin) {
        tabLogin.classList.remove('bg-amber-500', 'text-slate-950', 'shadow');
        tabLogin.classList.add('text-slate-400');
      }
      if (formRegister) formRegister.classList.remove('hidden');
      if (formLogin) formLogin.classList.add('hidden');
    }
  }

  async handleAuthLogin(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('auth-login-username');
    const passwordInput = document.getElementById('auth-login-password');
    const feedback = document.getElementById('auth-feedback');
    const submitBtn = document.getElementById('btn-auth-login-submit');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) return;

    if (feedback) {
      feedback.className = 'mt-3 p-2.5 rounded-xl text-xs font-semibold text-center bg-blue-950/60 text-blue-300 border border-blue-500/40 block animate-pulse';
      feedback.textContent = 'Connexion à votre compte en cours...';
    }
    if (submitBtn) submitBtn.disabled = true;

    try {
      await window.supabaseClient.signIn(username, password);
      if (feedback) {
        feedback.className = 'mt-3 p-2.5 rounded-xl text-xs font-semibold text-center bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 block';
        feedback.textContent = `✅ Bienvenue, ${username} ! Synchronisation active.`;
      }
      this.updateUserHeader();
      this.showToast(`Connecté avec succès en tant que ${username}`, '👑');
      setTimeout(() => this.closeAuthModal(), 800);
    } catch (err) {
      if (feedback) {
        feedback.className = 'mt-3 p-2.5 rounded-xl text-xs font-semibold text-center bg-red-950/60 text-red-300 border border-red-500/40 block';
        feedback.textContent = err.message || 'Erreur lors de la connexion.';
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async handleAuthRegister(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('auth-register-username');
    const passwordInput = document.getElementById('auth-register-password');
    const avatarInput = document.getElementById('auth-register-avatar');
    const feedback = document.getElementById('auth-feedback');
    const submitBtn = document.getElementById('btn-auth-register-submit');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    const avatar = avatarInput ? avatarInput.value : '👑';

    if (!username || !password) return;

    if (feedback) {
      feedback.className = 'mt-3 p-2.5 rounded-xl text-xs font-semibold text-center bg-blue-950/60 text-blue-300 border border-blue-500/40 block animate-pulse';
      feedback.textContent = 'Création de votre compte et crédit des 20 000 jetons...';
    }
    if (submitBtn) submitBtn.disabled = true;

    try {
      await window.supabaseClient.signUp(username, password, avatar);
      if (feedback) {
        feedback.className = 'mt-3 p-2.5 rounded-xl text-xs font-semibold text-center bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 block';
        feedback.textContent = `🎉 Compte créé avec succès ! +20,000 🪙 offerts !`;
      }
      this.updateUserHeader();
      this.showToast(`Bienvenue sur Hika-Poker, ${username} ! +20,000 🪙`, '🎁');
      if (window.soundFX) window.soundFX.playWin();
      setTimeout(() => this.closeAuthModal(), 1000);
    } catch (err) {
      if (feedback) {
        feedback.className = 'mt-3 p-2.5 rounded-xl text-xs font-semibold text-center bg-red-950/60 text-red-300 border border-red-500/40 block';
        feedback.textContent = err.message || "Erreur lors de l'inscription.";
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async handleAuthLogout() {
    if (window.supabaseClient) {
      await window.supabaseClient.signOut();
      this.updateUserHeader();
      this.showToast('Déconnecté. Mode Invité local réactivé.', '👤');
      this.closeAuthModal();
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
      avatar: profile.avatar || '👑'
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

  startTournamentGame(speedKey = null) {
    const speed = speedKey || this.selectedTourneySpeed || 'normal';
    const speedCfg = (window.TOURNAMENT_SPEEDS && window.TOURNAMENT_SPEEDS[speed]) || { startingChips: 3000, handsPerLevel: 4, name: 'Normal', icon: '⚖️' };
    const startingChips = speedCfg.startingChips;
    const handsPerLevel = speedCfg.handsPerLevel;

    // Vérifier si un tournoi est déjà en cours
    const existing = window.storageManager ? window.storageManager.getActiveTournament() : null;
    if (existing && existing.active) {
      if (confirm("Un tournoi Sit & Go est déjà en cours sur votre compte !\n\nCliquez sur [OK] pour le reprendre exactement où vous l'avez laissé.\nCliquez sur [Annuler] pour abandonner l'ancien et en commencer un nouveau.")) {
        this.resumeTournamentGame(existing);
        return;
      } else {
        if (window.storageManager) window.storageManager.clearActiveTournament();
      }
    }

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

    // Créer le moteur PokerEngine en mode tournoi avec les paramètres de vitesse
    this.engine = new window.PokerEngine({
      maxSeats: 6,
      smallBlind: tourneyCfg.levels[0].smallBlind,
      bigBlind: tourneyCfg.levels[0].bigBlind,
      startingChips: startingChips,
      blindLevels: tourneyCfg.levels,
      handsPerLevel: handsPerLevel,
      autoRebuy: false,
      turnTimeMs: 15000
    });

    this.bindEngineEvents();

    // Joueur humain
    this.engine.addPlayer({
      id: this.humanId,
      name: profile.name,
      chips: startingChips,
      isBot: false,
      avatar: profile.avatar || '👑'
    }, 0);

    // Bots de tournoi
    const bots = window.getRandomBots(5);
    bots.forEach((b, idx) => {
      this.engine.addPlayer({
        id: b.id,
        name: b.name,
        chips: startingChips,
        isBot: true,
        botLevel: b.botLevel,
        avatar: b.avatar,
        meta: { avatarBg: b.avatarBg, title: b.title }
      }, idx + 1);
    });

    window.tournamentManager.start({ id: this.humanId, name: profile.name }, bots, speed);

    // Sauvegarder l'état initial du tournoi pour synchronisation cross-device
    this.saveActiveTournamentState();

    this.showTableScreen(`Sit & Go ${speedCfg.name} 6-Max`);

    setTimeout(() => {
      this.startNextHand();
    }, 800);
  }

  // Sauvegarde instantanée de l'état du tournoi en local et sur Supabase Cloud
  saveActiveTournamentState() {
    if (this.gameMode !== 'tournament' || !this.engine || !window.tournamentManager || !window.tournamentManager.active) {
      return;
    }

    const humanPlayer = this.engine.getPlayer(this.humanId);
    const humanChips = humanPlayer ? humanPlayer.chips : 0;
    const remainingCount = this.engine.seats.filter((p) => p && !p.busted && p.chips > 0).length;

    const snapshot = {
      active: true,
      updatedAt: Date.now(),
      gameMode: 'tournament',
      humanId: this.humanId,
      tableName: 'Sit & Go Tournoi 6-Max',
      humanChips: humanChips,
      level: (this.engine.levelIndex || 0) + 1,
      blinds: Object.assign({}, this.engine.blinds),
      playersRemaining: remainingCount,
      tournament: window.tournamentManager.toJSON(),
      engine: this.engine.toJSON()
    };

    if (window.storageManager) {
      window.storageManager.saveActiveTournament(snapshot);
    }
  }

  // Vérifie si un tournoi est actif et affiche la bannière de reprise dans le Lobby
  checkAndShowActiveTournament() {
    const banner = document.getElementById('active-tournament-banner');
    if (!banner) return;

    // Ne pas afficher la bannière si l'utilisateur est déjà assis à une table
    if (this.engine) {
      banner.classList.add('hidden');
      return;
    }

    const snap = window.storageManager ? window.storageManager.getActiveTournament() : null;
    if (snap && snap.active) {
      const descEl = document.getElementById('active-tourney-desc');
      const timeEl = document.getElementById('active-tourney-sync-time');

      const level = snap.level || snap.tournament?.currentLevel || 1;
      const sb = snap.blinds?.smallBlind || 25;
      const bb = snap.blinds?.bigBlind || 50;
      const chips = (snap.humanChips !== undefined ? snap.humanChips : (snap.engine?.seats?.find((p) => p && p.id === this.humanId)?.chips || 5000)).toLocaleString();
      const remaining = snap.playersRemaining || snap.engine?.seats?.filter((p) => p && !p.busted && p.chips > 0).length || 6;

      if (descEl) {
        descEl.textContent = `Niveau ${level} | Blinds ${sb}/${bb} | Vos jetons : ${chips} 🪙 | ${remaining} joueurs restants`;
      }
      if (timeEl && snap.updatedAt) {
        try {
          const d = new Date(snap.updatedAt);
          timeEl.textContent = `• Sync ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        } catch (e) {
          timeEl.textContent = '';
        }
      }

      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  // Reprendre le tournoi actif depuis la bannière
  resumeActiveTournament() {
    const snap = window.storageManager ? window.storageManager.getActiveTournament() : null;
    if (!snap || !snap.active || !snap.engine) {
      this.showToast("Aucun tournoi actif trouvé.", "⚠️");
      return;
    }

    this.resumeTournamentGame(snap);
  }

  // Restauration complète du tournoi (moteur PokerEngine + TournamentManager)
  resumeTournamentGame(snap) {
    this.gameMode = 'tournament';

    try {
      // 1. Restaurer le moteur PokerEngine
      this.engine = window.PokerEngine.fromJSON(snap.engine);
      this.bindEngineEvents();

      // 2. Restaurer le TournamentManager
      if (window.tournamentManager && snap.tournament) {
        window.tournamentManager.fromJSON(snap.tournament);
      }

      // Appliquer l'avatar actuel du joueur
      const prof = window.storageManager.getProfile();
      const hp = this.engine.getPlayer(this.humanId);
      if (hp && prof.avatar) hp.avatar = prof.avatar;

      // 3. Masquer le lobby et afficher la table de jeu
      const speedName = (snap.tournament && snap.tournament.speed && window.TOURNAMENT_SPEEDS && window.TOURNAMENT_SPEEDS[snap.tournament.speed]) ? window.TOURNAMENT_SPEEDS[snap.tournament.speed].name : 'Tournoi';
      this.showTableScreen(`Sit & Go ${speedName} 6-Max`);
      this.checkAndShowActiveTournament(); // Masquer la bannière lobby

      // 4. Rendu immédiat des sièges, du tapis et du pot
      const state = this.engine.getState(this.humanId);
      window.tableUI.renderSeats(state, this.humanId);
      window.tableUI.renderBoard(state.board || [], []);
      window.tableUI.renderPot(state.pot || 0);
      this.updateHeroWinChance();

      if (window.tournamentManager) {
        window.tournamentManager.updateHUD(snap.level || snap.tournament?.currentLevel || 1, snap.blinds);
      }

      if (window.soundFX) {
        window.soundFX.playCardDeal();
      }

      this.showToast("Tournoi repris avec succès !", "🏆");

      // 5. Continuer la partie là où elle s'était arrêtée
      setTimeout(() => {
        if (!this.engine) return;

        // Si la main était terminée ou prête pour la suivante
        if (this.engine.phase === 'handOver' || !this.isHandRunning) {
          this.isHandRunning = false;
          if (this.engine.canStartHand()) {
            this.startNextHand();
          } else {
            window.tournamentManager.onTournamentEnd();
          }
        } else if (this.engine._bettingOpen && this.engine._bettingOpen()) {
          // Si une main est en cours, relancer l'action du joueur ou bot actif
          this.handleTurn({
            seat: this.engine.currentSeat,
            playerId: this.engine.seats[this.engine.currentSeat]?.id
          });
        } else {
          if (this.engine.canStartHand()) {
            this.startNextHand();
          }
        }
      }, 700);

    } catch (err) {
      console.error('[App] Erreur lors de la restauration du tournoi:', err);
      this.showToast("Erreur lors de la reprise du tournoi.", "❌");
    }
  }

  // Abandonner le tournoi en cours
  discardActiveTournament() {
    if (confirm("Voulez-vous vraiment abandonner ce tournoi ? Votre inscription et vos jetons de tournoi seront perdus.")) {
      if (window.storageManager) {
        window.storageManager.clearActiveTournament();
      }
      this.checkAndShowActiveTournament();
      this.showToast("Tournoi abandonné.", "ℹ️");
    }
  }

  // Calcul et affichage de la prédiction de chance de remporter le pot (Style Zynga Poker)
  updateHeroWinChance() {
    if (!this.engine || !this.humanId) {
      if (window.tableUI) window.tableUI.clearHeroWinChance();
      return;
    }

    const p = this.engine.getPlayer(this.humanId);
    if (!p || p.folded || p.busted || !p.inHand || !p.hole || p.hole.length < 2) {
      if (window.tableUI) window.tableUI.clearHeroWinChance();
      return;
    }

    // Nombre d'adversaires encore actifs dans le coup (non couchés)
    const activeOpponents = this.engine.seats.filter(
      (s) => s && s.id !== this.humanId && s.inHand && !s.folded && !s.busted
    ).length;

    if (activeOpponents <= 0) {
      if (window.tableUI) window.tableUI.renderHeroWinChance(100, 0, false);
      return;
    }

    const board = (this.engine.board || []).slice();
    const hole = p.hole.slice();

    try {
      if (window.PokerEngine && typeof window.PokerEngine.equity === 'function') {
        const equity = window.PokerEngine.equity(hole, board, activeOpponents, 250);
        const winPct = Math.round(equity * 100);
        if (window.tableUI) {
          window.tableUI.renderHeroWinChance(winPct, activeOpponents, false);
        }
      }
    } catch (err) {
      console.warn('[App] Erreur calcul equity hero:', err);
    }
  }

  showTableScreen(tableName) {
    this.isPaused = false;
    this.botStepRemaining = 0;
    this.nextHandRemaining = 0;
    this.updatePauseUI(false);
    document.body.classList.add('in-table-view');
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

    // Effacer le cercle de probabilités de victoire
    if (window.tableUI) {
      window.tableUI.clearHeroWinChance();
    }

    // Si tournoi en cours, sauvegarder son état pour reprise ultérieure (sur mobile ou PC)
    if (this.gameMode === 'tournament' && window.tournamentManager && window.tournamentManager.active) {
      this.saveActiveTournamentState();
    }

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

    document.body.classList.remove('in-table-view');
    document.getElementById('table-view').classList.add('hidden');
    document.getElementById('lobby-view').classList.remove('hidden');
    this.updateUserHeader();
    this.checkAndShowActiveTournament();
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

    // 1. Masquer l'indicateur de pause et réinitialiser l'état du bouton
    this.updatePauseUI(false);

    // 2. Si un événement de tour était arrivé pendant la pause, le traiter immédiatement
    if (this.pendingTurnEvent) {
      const pendingEvt = this.pendingTurnEvent;
      this.pendingTurnEvent = null;
      this.handleTurn(pendingEvt);
      return;
    }

    // 3. Reprendre le timer de tour (humain ou bot)
    if (window.tableUI) {
      window.tableUI.resumeTurnTimer();
    }

    // 4. Reprendre la réflexion du bot si elle était en cours
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

    // 5. Reprendre le délai vers la main suivante si elle était en attente
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
    const pauseBanner = document.getElementById('pause-banner');
    const pauseOverlay = document.getElementById('pause-overlay');
    const pauseBtnIcon = document.getElementById('pause-btn-icon');
    const pauseBtnText = document.getElementById('pause-btn-text');
    const btnPause = document.getElementById('btn-toggle-pause');
    const tableView = document.getElementById('table-view');

    if (pauseBanner) {
      if (isPaused) {
        pauseBanner.classList.remove('hidden');
        pauseBanner.classList.add('flex');
      } else {
        pauseBanner.classList.add('hidden');
        pauseBanner.classList.remove('flex');
      }
    }

    if (pauseOverlay) {
      if (isPaused) {
        pauseOverlay.classList.remove('hidden');
        pauseOverlay.classList.add('flex');
      } else {
        pauseOverlay.classList.add('hidden');
        pauseOverlay.classList.remove('flex');
      }
    }

    if (tableView) {
      if (isPaused) {
        tableView.classList.add('game-paused');
      } else {
        tableView.classList.remove('game-paused');
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
        btnPause.classList.remove('bg-amber-600/25', 'text-amber-300', 'border-amber-500/50', 'bg-amber-600/20', 'border-amber-500/40');
        btnPause.classList.add('bg-gradient-to-r', 'from-emerald-600', 'to-teal-600', 'text-white', 'border-emerald-400', 'shadow-emerald-900/40', 'animate-pulse');
        btnPause.title = "Reprendre la partie (Raccourci: P)";
      } else {
        btnPause.classList.remove('bg-gradient-to-r', 'from-emerald-600', 'to-teal-600', 'text-white', 'border-emerald-400', 'shadow-emerald-900/40', 'animate-pulse');
        btnPause.classList.add('bg-amber-600/25', 'text-amber-300', 'border-amber-500/50');
        btnPause.title = "Mettre en pause la partie (Raccourci: P)";
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
        this.updateHeroWinChance();
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
      const actType = e.type || e.action;

      // Animation jetons volants depuis le siège du joueur vers le pot central
      if (['bet', 'raise', 'call', 'allin'].includes(actType)) {
        const seatEl = window.tableUI.getSeatElement(e.playerId);
        if (seatEl && window.tableUI.potEl) {
          window.tableUI.flyChips(seatEl, window.tableUI.potEl);
        }
      }

      // Son dramatique All-In quand un adversaire fait tapis
      if (actType === 'allin' && e.playerId !== this.humanId && window.soundFX) {
        window.soundFX.playAllIn();
      }

      const state = this.engine.getState(this.humanId);
      window.tableUI.renderSeats(state, this.humanId, this.winningCards);
      window.tableUI.renderPot(state.pot, state.pots);
      this.updateHeroWinChance();
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
      this.updateHeroWinChance();
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
        this.saveActiveTournamentState();
      } else if (e.playerId === this.humanId) {
        setTimeout(() => this.promptRebuy(), 1200);
      }
    });

    // Passage au niveau de blinds supérieur (tournoi)
    this.engine.on('levelUp', (e) => {
      if (this.gameMode === 'tournament') {
        window.tournamentManager.updateHUD(e.level, e.blinds);
        this.saveActiveTournamentState();
      }
    });

    // Fin de main (handEnd)
    this.engine.on('handEnd', (result) => {
      window.tableUI.stopTurnTimer();
      window.playerControlsUI.hideAll();
      if (window.tableUI) window.tableUI.clearHeroWinChance();

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

      // Particules de feux d'artifice de jetons dorés si gros pot (> 50x Big Blind)
      const currentBB = (this.engine && this.engine.blinds && this.engine.blinds.bigBlind) || (this.currentTableConfig && this.currentTableConfig.bb) || 50;
      if (totalPot >= currentBB * 50 && window.HikaFireworks && typeof window.HikaFireworks.launch === 'function') {
        window.HikaFireworks.launch(totalPot, currentBB);
      }
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
          handLabel: (humanResult.hand && humanResult.hand.label) || 'Main gagnante',
          handScore: (humanResult.hand && humanResult.hand.score) || 0
        });
      } else if (!humanResult.folded) {
        window.storageManager.recordHand({
          won: false,
          pot: 0,
          handLabel: null
        });
      }
    }

    if (this.gameMode === 'tournament') {
      this.saveActiveTournamentState();
    }

    // Enregistrement de la synthèse de la main pour le Hand Replayer
    try {
      const allPlayers = (this.engine ? this.engine.seats : []).filter(Boolean).map((p) => {
        const pRes = result.players ? result.players.find((r) => r.id === p.id) : null;
        const isWinner = pRes && pRes.won > 0;
        let showCards = false;
        let holeCards = [];
        if (p.id === this.humanId || (result.showdown && !p.folded && p.hole && p.hole.length > 0) || isWinner) {
          showCards = true;
          holeCards = (p.hole || []).map((c) => typeof c === 'string' ? c : (window.PokerEngine ? window.PokerEngine.cardToString(c) : c));
        }
        return {
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          isHuman: p.id === this.humanId,
          folded: !!p.folded,
          showCards: showCards,
          hole: holeCards,
          won: pRes ? pRes.won : 0,
          handLabel: (pRes && pRes.hand && pRes.hand.label) || (p.folded ? 'Couché' : (isWinner ? 'Vainqueur' : ''))
        };
      });

      this.lastHandSummary = {
        tableName: this.currentTableConfig?.name || (this.gameMode === 'tournament' ? 'Tournoi Sit & Go 6-Max' : 'Table'),
        gameMode: this.gameMode,
        board: (this.engine && this.engine.board) ? this.engine.board.map((c) => typeof c === 'string' ? c : (window.PokerEngine ? window.PokerEngine.cardToString(c) : c)) : [],
        pot: totalPot,
        winners: winners.map((w) => {
          const pObj = this.engine ? this.engine.getPlayer(w.id) : null;
          return {
            id: w.id,
            name: pObj ? pObj.name : 'Joueur',
            avatar: pObj ? pObj.avatar : '👤',
            won: w.won,
            handLabel: (w.hand && w.hand.label) || 'Main gagnante'
          };
        }),
        players: allPlayers,
        winningCards: this.winningCards ? this.winningCards.slice() : [],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
    } catch (err) {
      console.warn('[Hika-Poker] Erreur snapshot Hand Replayer:', err);
    }
  }

  // =========================================================================
  // GESTION DU TOUR ET DES BOTS
  // =========================================================================

  handleTurn(e) {
    if (this.isPaused) {
      this.pendingTurnEvent = e;
      return;
    }

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

    if (action.type === 'fold') {
      if (window.tableUI) window.tableUI.clearHeroWinChance();
    }

    const res = this.engine.act(this.humanId, action);
    if (!res.ok) {
      console.warn('Action refusée par le moteur:', res);
      // Réactualiser l'état légal
      const legal = this.engine.getLegalActions(this.humanId);
      window.playerControlsUI.updateState(legal, true, this.engine.blinds.bigBlind);
    } else {
      if (action.type !== 'fold') {
        this.updateHeroWinChance();
      }
    }
  }

  startNextHand() {
    if (!this.engine || this.isPaused) return;
    this.stopAllTimers();
    this.requestWakeLock();
    if (window.tableUI) window.tableUI.clearHeroWinChance();

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
    // Si le joueur est à une table de cash game sans jeton et n'a pas programmé de recharge
    if (this.engine && this.gameMode === 'cash' && this.pendingRebuyAmount <= 0) {
      const p = this.engine.getPlayer(this.humanId);
      if (p && (p.chips === 0 || p.busted)) {
        this.showToast("Plus de jetons sur la table. Retour au Lobby.", "ℹ️");
        this.leaveTable();
      }
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

  // =========================================================================
  // VITESSE & STRUCTURE DE TOURNOI SIT & GO
  // =========================================================================

  setTournamentSpeed(speedKey) {
    const speeds = window.TOURNAMENT_SPEEDS || {};
    const cfg = speeds[speedKey] || speeds.normal || { name: 'Normal', icon: '⚖️', startingChips: 3000, desc: '4 mains / niveau' };
    this.selectedTourneySpeed = cfg.key || speedKey;

    document.querySelectorAll('.btn-tourney-speed').forEach((btn) => {
      const isSelected = btn.dataset.speed === this.selectedTourneySpeed;
      if (isSelected) {
        btn.className = 'btn-tourney-speed py-1 rounded-lg text-[10px] font-black bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow transition-all flex items-center justify-center gap-0.5 cursor-pointer';
      } else {
        btn.className = 'btn-tourney-speed py-1 rounded-lg text-[10px] font-black text-slate-400 hover:text-white transition-all flex items-center justify-center gap-0.5 cursor-pointer';
      }
    });

    const badge = document.getElementById('tourney-speed-badge');
    if (badge) badge.textContent = `${cfg.icon} ${cfg.name} (${cfg.startingChips.toLocaleString()} 🪙)`;

    const desc = document.getElementById('tourney-speed-desc');
    if (desc) desc.textContent = `${cfg.desc} • ${cfg.startingChips.toLocaleString()} jetons départ`;
  }

  // =========================================================================
  // REVUE INTERACTIVE DE LA DERNIÈRE MAIN (HAND REPLAYER CARTE PAR CARTE)
  // =========================================================================

  openHandReplayerModal() {
    this.replayerCurrentStep = 0;
    if (this.replayerAutoPlayTimer) {
      clearInterval(this.replayerAutoPlayTimer);
      this.replayerAutoPlayTimer = null;
    }
    const playIcon = document.getElementById('replayer-play-icon');
    const playLbl = document.getElementById('replayer-play-label');
    if (playIcon) playIcon.textContent = '▶';
    if (playLbl) playLbl.textContent = 'LECTURE';

    const modal = document.getElementById('hand-replayer-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    this.renderHandReplayerStep(0);
  }

  closeHandReplayerModal() {
    if (this.replayerAutoPlayTimer) {
      clearInterval(this.replayerAutoPlayTimer);
      this.replayerAutoPlayTimer = null;
    }
    const playIcon = document.getElementById('replayer-play-icon');
    const playLbl = document.getElementById('replayer-play-label');
    if (playIcon) playIcon.textContent = '▶';
    if (playLbl) playLbl.textContent = 'LECTURE';

    const modal = document.getElementById('hand-replayer-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  toggleReplayerAutoPlay() {
    const playIcon = document.getElementById('replayer-play-icon');
    const playLbl = document.getElementById('replayer-play-label');

    if (this.replayerAutoPlayTimer) {
      clearInterval(this.replayerAutoPlayTimer);
      this.replayerAutoPlayTimer = null;
      if (playIcon) playIcon.textContent = '▶';
      if (playLbl) playLbl.textContent = 'LECTURE';
      return;
    }

    if (!this.lastHandSummary) {
      this.showToast('Aucune main enregistrée à rejouer', '👁️');
      return;
    }

    // Si on est déjà à l'étape finale, repartir du début
    if (this.replayerCurrentStep >= 5) {
      this.setReplayerStep(0);
    }

    if (playIcon) playIcon.textContent = '⏸';
    if (playLbl) playLbl.textContent = 'PAUSE';

    this.replayerAutoPlayTimer = setInterval(() => {
      if (this.replayerCurrentStep < 5) {
        this.setReplayerStep(this.replayerCurrentStep + 1);
      } else {
        clearInterval(this.replayerAutoPlayTimer);
        this.replayerAutoPlayTimer = null;
        if (playIcon) playIcon.textContent = '▶';
        if (playLbl) playLbl.textContent = 'LECTURE';
      }
    }, this.replayerSpeed || 900);
  }

  setReplayerStep(stepIdx) {
    const summary = this.lastHandSummary;
    if (!summary) return;
    const maxStep = (summary.board && summary.board.length > 0) ? 5 : 1;
    this.replayerCurrentStep = Math.max(0, Math.min(maxStep, stepIdx));
    this.renderHandReplayerStep(this.replayerCurrentStep);
  }

  renderHandReplayerStep(step) {
    const summary = this.lastHandSummary;
    const titleEl = document.getElementById('replayer-table-name');
    const boardEl = document.getElementById('replayer-board-cards');
    const potTextEl = document.getElementById('replayer-pot-text');
    const commTextEl = document.getElementById('replayer-commentary-text');
    const commIconEl = document.getElementById('replayer-comment-icon');
    const playersListEl = document.getElementById('replayer-players-list');
    const stepBtns = document.querySelectorAll('.replayer-step-btn');

    if (!summary) {
      if (titleEl) titleEl.textContent = "Aucune main précédente enregistrée";
      if (boardEl) boardEl.innerHTML = '<span class="text-xs text-slate-500 italic py-2">Jouez une première main pour la revoir ici !</span>';
      if (playersListEl) playersListEl.innerHTML = '<div class="text-center py-6 text-xs text-slate-400">Aucune donnée de coup disponible pour le moment.</div>';
      if (potTextEl) potTextEl.textContent = 'Pot : 0 🪙';
      if (commTextEl) commTextEl.textContent = 'En attente d\'une main terminée.';
      return;
    }

    if (titleEl) {
      titleEl.textContent = `${summary.tableName} • Pot Total : ${summary.pot.toLocaleString()} 🪙 (${summary.time || ''})`;
    }

    // 1. Mettre à jour les boutons du Stepper
    stepBtns.forEach((btn) => {
      const bStep = parseInt(btn.dataset.step, 10);
      btn.classList.remove('step-active', 'step-completed', 'bg-amber-500', 'text-slate-950', 'shadow');
      if (bStep === step) {
        btn.classList.add('step-active', 'bg-amber-500', 'text-slate-950', 'shadow');
        btn.classList.remove('text-slate-400');
      } else if (bStep < step) {
        btn.classList.add('step-completed');
        btn.classList.remove('text-slate-400');
      } else {
        btn.classList.add('text-slate-400');
      }
    });

    // 2. Déterminer les cartes du board à afficher selon l'étape
    // Étape 0 : Pré-flop (0 carte)
    // Étape 1 : Flop (1 carte)
    // Étape 2 : Flop complet (3 cartes)
    // Étape 3 : Turn (4 cartes)
    // Étape 4 : River (5 cartes)
    // Étape 5 : Showdown (5 cartes + surbrillance gagnante)
    const board = summary.board || [];
    let visibleCount = 0;
    if (board.length > 0) {
      if (step === 1) visibleCount = 1;
      else if (step === 2) visibleCount = Math.min(3, board.length);
      else if (step === 3) visibleCount = Math.min(4, board.length);
      else if (step >= 4) visibleCount = board.length;
    }

    if (boardEl) {
      boardEl.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        if (i < visibleCount && board[i]) {
          const cStr = board[i];
          const isWinning = (step === 5) && summary.winningCards && summary.winningCards.includes(cStr);
          const cardHtml = window.tableUI.createCardHTML(cStr, true, isWinning, 'board');
          boardEl.insertAdjacentHTML('beforeend', cardHtml);
        } else {
          // Emplacement vide avec contour en pointillés stylisé
          boardEl.insertAdjacentHTML('beforeend', `
            <div class="replayer-card-slot rounded-lg border-2 border-dashed border-emerald-500/35 bg-slate-950/40 flex items-center justify-center text-emerald-400/30 text-xs font-bold select-none">
              🂠
            </div>
          `);
        }
      }
    }

    // 3. Calcul du pot progressif selon l'étape
    let currentPot = summary.pot;
    if (step === 0) currentPot = Math.max(10, Math.round(summary.pot * 0.25));
    else if (step === 1) currentPot = Math.max(20, Math.round(summary.pot * 0.45));
    else if (step === 2) currentPot = Math.max(30, Math.round(summary.pot * 0.65));
    else if (step === 3) currentPot = Math.max(40, Math.round(summary.pot * 0.85));
    if (potTextEl) potTextEl.textContent = `Pot : ${currentPot.toLocaleString()} 🪙`;

    // 4. Commentaire de l'étape & Sons
    if (commTextEl) {
      if (step === 0) {
        if (commIconEl) commIconEl.textContent = '🃏';
        commTextEl.textContent = 'Pré-flop : Cartes privées distribuées aux joueurs. Blindes et mises engagées.';
      } else if (step === 1) {
        if (commIconEl) commIconEl.textContent = '🂡';
        commTextEl.textContent = `Flop (1ère carte) : ${board[0] || ''} dévoilée sur le feutre vert.`;
        if (window.soundFX) window.soundFX.playCardFlip();
      } else if (step === 2) {
        if (commIconEl) commIconEl.textContent = '🂢';
        const flopCards = board.slice(0, 3).join(' ');
        commTextEl.textContent = `Flop complet : ${flopCards} sur le tapis. Tour d'enchères au Flop.`;
        if (window.soundFX) window.soundFX.playCardFlip();
      } else if (step === 3) {
        if (commIconEl) commIconEl.textContent = '🂣';
        commTextEl.textContent = `Turn (4ème carte) : ${board[3] || ''} apparaît sur la table. Le coup monte en intensité !`;
        if (window.soundFX) window.soundFX.playCardFlip();
      } else if (step === 4) {
        if (commIconEl) commIconEl.textContent = '🂤';
        commTextEl.textContent = `River (5ème carte) : ${board[4] || ''} distribuée. Fin du tableau communautaire !`;
        if (window.soundFX) window.soundFX.playCardFlip();
      } else if (step === 5) {
        if (commIconEl) commIconEl.textContent = '🏆';
        const winNames = summary.winners && summary.winners.length > 0 ? summary.winners.map(w => w.name).join(' & ') : 'Vainqueur';
        const winCombo = summary.winners && summary.winners[0] ? summary.winners[0].handLabel : 'Meilleure main';
        commTextEl.textContent = `Showdown : ${winNames} remporte le pot final de ${summary.pot.toLocaleString()} 🪙 avec ${winCombo} !`;
        if (window.soundFX) {
          window.soundFX.playWin();
          if (window.soundFX.playApplause) window.soundFX.playApplause();
        }
      }
    }

    // 5. Rendu des Joueurs et Mains
    if (playersListEl) {
      playersListEl.innerHTML = summary.players.map((p) => {
        const isWinner = (step === 5) && p.won > 0;
        let cardHTML = '';

        // Révélation des cartes : l'humain voit toujours ses cartes ; les adversaires les voient au Showdown (step 5) s'ils ne se sont pas couchés
        const shouldShowHole = p.isHuman || (step === 5 && !p.folded && p.hole && p.hole.length === 2);
        if (shouldShowHole && p.hole && p.hole.length === 2) {
          const c1Win = (step === 5) && summary.winningCards && summary.winningCards.includes(p.hole[0]);
          const c2Win = (step === 5) && summary.winningCards && summary.winningCards.includes(p.hole[1]);
          cardHTML = `
            <div class="flex gap-1">
              ${window.tableUI.createCardHTML(p.hole[0], true, c1Win, 'bot')}
              ${window.tableUI.createCardHTML(p.hole[1], true, c2Win, 'bot')}
            </div>
          `;
        } else if (p.folded) {
          cardHTML = '<span class="text-[10px] text-slate-500 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">Couché</span>';
        } else {
          // Dos de cartes fermées
          cardHTML = `
            <div class="flex -space-x-1.5">
              <div class="w-5 h-7 rounded bg-gradient-to-br from-blue-900 to-indigo-950 border border-blue-400/40 shadow"></div>
              <div class="w-5 h-7 rounded bg-gradient-to-br from-blue-900 to-indigo-950 border border-blue-400/40 shadow"></div>
            </div>
          `;
        }

        const borderClass = isWinner ? 'border-amber-400/90 bg-amber-950/40 shadow-amber-950/60 shadow-md' : 'border-slate-800 bg-slate-950/70';
        const gainBadge = isWinner
          ? `<span class="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-black text-xs animate-pulse">+${p.won.toLocaleString()} 🪙</span>`
          : (p.folded ? `<span class="text-[9px] text-slate-500 italic">Fold</span>` : '');

        const renderedAv = (window.HikaAvatars && typeof window.HikaAvatars.renderAvatarHTML === 'function')
          ? window.HikaAvatars.renderAvatarHTML(p.avatar, 'w-8 h-8')
          : `<span class="text-base">${p.avatar || '👤'}</span>`;

        return `
          <div class="flex items-center justify-between p-2 rounded-xl border ${borderClass} transition-all">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-full bg-slate-900 border ${isWinner ? 'border-amber-400' : 'border-slate-700'} flex items-center justify-center shadow overflow-hidden">
                ${renderedAv}
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-black ${p.isHuman ? 'text-amber-300' : 'text-white'}">${p.name} ${p.isHuman ? '(Vous)' : ''}</span>
                  ${isWinner ? '<span class="text-[8px] px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black uppercase">Vainqueur</span>' : ''}
                </div>
                <span class="text-[9px] text-slate-400 block">${(step === 5 && p.handLabel) ? p.handLabel : (p.folded ? 'Couché' : 'En jeu')}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              ${cardHTML}
              ${gainBadge}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // =========================================================================
  // BONUS QUOTIDIEN DE CONNEXION SUR 7 JOURS
  // =========================================================================

  openDailyBonusModal() {
    this.renderDailyBonusModal();
    const modal = document.getElementById('daily-bonus-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    this.startDailyBonusCountdown();
  }

  closeDailyBonusModal() {
    if (this.dailyBonusTimerInterval) {
      clearInterval(this.dailyBonusTimerInterval);
      this.dailyBonusTimerInterval = null;
    }
    const modal = document.getElementById('daily-bonus-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  updateDailyBonusNotificationBadge() {
    const status = window.storageManager.getDailyBonusStatus();
    const pingEl = document.getElementById('daily-bonus-ping');
    const dotEl = document.getElementById('daily-bonus-dot');
    if (pingEl && dotEl) {
      if (status.canClaim) {
        pingEl.classList.remove('hidden');
        dotEl.classList.remove('hidden');
      } else {
        pingEl.classList.add('hidden');
        dotEl.classList.add('hidden');
      }
    }
  }

  renderDailyBonusModal() {
    const status = window.storageManager.getDailyBonusStatus();
    const grid = document.getElementById('daily-bonus-days-grid');
    const streakTag = document.getElementById('daily-bonus-streak-tag');
    const statusText = document.getElementById('daily-bonus-status-text');
    const claimBtn = document.getElementById('btn-claim-daily-bonus');
    const claimBtnLabel = document.getElementById('btn-claim-daily-bonus-label');

    if (streakTag) {
      streakTag.textContent = `Série en cours : ${status.streak} jour${status.streak > 1 ? 's' : ''}`;
    }

    if (grid) {
      grid.innerHTML = status.rewards.map((rew, idx) => {
        const dayNum = idx + 1;
        const isDay7 = dayNum === 7;
        const isCurrentTarget = dayNum === status.dayToClaim;

        let borderClass = 'border-slate-800 bg-slate-950/70 text-slate-400';
        let badgeIcon = '🔒';
        let badgeText = 'Verrouillé';
        let rewardColor = 'text-slate-400';

        if (dayNum <= status.streak) {
          borderClass = 'border-emerald-500/70 bg-emerald-950/40 text-emerald-300';
          badgeIcon = '✅';
          badgeText = 'Reçu';
          rewardColor = 'text-emerald-400';
        } else if (isCurrentTarget && status.canClaim) {
          borderClass = 'border-yellow-400 bg-gradient-to-b from-amber-950/80 to-slate-950 text-yellow-200 ring-2 ring-yellow-400 animate-pulse';
          badgeIcon = '🎁';
          badgeText = 'Disponible';
          rewardColor = 'text-yellow-300 font-black';
        } else if (isDay7) {
          borderClass = 'border-purple-500/50 bg-purple-950/30 text-purple-300';
          badgeIcon = '👑';
          badgeText = 'Jackpot';
          rewardColor = 'text-purple-300';
        }

        return `
          <div class="flex flex-col items-center p-2 rounded-2xl border ${borderClass} relative transition-all">
            <span class="text-[9px] font-bold uppercase tracking-wider mb-1">Jour ${dayNum}</span>
            <div class="w-8 h-8 rounded-full bg-slate-900/90 flex items-center justify-center text-sm shadow mb-1">
              ${badgeIcon}
            </div>
            <span class="text-[10px] font-black ${rewardColor} leading-tight text-center">
              +${(rew / 1000)}k 🪙
            </span>
            <span class="text-[8px] font-semibold opacity-75 mt-0.5">${badgeText}</span>
          </div>
        `;
      }).join('');
    }

    if (claimBtn && claimBtnLabel) {
      if (status.canClaim) {
        claimBtn.disabled = false;
        claimBtn.className = 'w-full py-3.5 rounded-xl font-black text-xs sm:text-sm tracking-wide uppercase bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 hover:from-emerald-500 hover:to-teal-400 text-white shadow-xl shadow-emerald-900/40 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer';
        claimBtnLabel.textContent = `RÉCUPÉRER MON CADEAU DU JOUR ${status.dayToClaim} (+${status.reward.toLocaleString()} 🪙)`;
        if (statusText) statusText.textContent = `Votre cadeau de Jour ${status.dayToClaim} est prêt à être récupéré !`;
      } else {
        claimBtn.disabled = true;
        claimBtn.className = 'w-full py-3 rounded-xl font-bold text-xs sm:text-sm tracking-wide uppercase bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed flex items-center justify-center gap-2';
        claimBtnLabel.textContent = `CADEAU DÉJÀ RÉCUPÉRÉ AUJOURD'HUI`;
        if (statusText) statusText.textContent = `Vous avez déjà récupéré votre bonus aujourd'hui. Rendez-vous demain !`;
      }
    }

    this.updateDailyBonusTimerVisual();
    this.updateDailyBonusNotificationBadge();
  }

  startDailyBonusCountdown() {
    if (this.dailyBonusTimerInterval) clearInterval(this.dailyBonusTimerInterval);
    this.dailyBonusTimerInterval = setInterval(() => {
      this.updateDailyBonusTimerVisual();
    }, 1000);
  }

  updateDailyBonusTimerVisual() {
    const timerEl = document.getElementById('daily-bonus-timer-text');
    if (!timerEl) return;
    const status = window.storageManager.getDailyBonusStatus();
    if (status.canClaim) {
      timerEl.textContent = '⚡ Prêt à être récupéré maintenant !';
      timerEl.className = 'text-[11px] text-emerald-400 font-bold block';
    } else {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      const diffSec = Math.max(0, Math.floor((tomorrow - now) / 1000));
      const h = String(Math.floor(diffSec / 3600)).padStart(2, '0');
      const m = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
      const s = String(diffSec % 60).padStart(2, '0');
      timerEl.textContent = `⏳ Prochain bonus disponible dans : ${h}h ${m}m ${s}s`;
      timerEl.className = 'text-[11px] text-amber-300 font-mono block';
    }
  }

  claimDailyBonus() {
    const res = window.storageManager.claimDailyBonus();
    if (!res.success) {
      this.showToast("Vous avez déjà récupéré votre bonus aujourd'hui !", "⚠️");
      return;
    }

    if (window.soundFX) {
      window.soundFX.playWin();
      window.soundFX.playApplause();
    }
    this.launchConfetti();
    this.updateUserHeader();
    this.showToast(`🎉 Jour ${res.streak} validé ! +${res.reward.toLocaleString()} 🪙 ajoutés !`, "🎁");
    this.renderDailyBonusModal();
    this.updateDailyBonusNotificationBadge();
  }

  launchConfetti() {
    if (window.luckyWheel && typeof window.luckyWheel.launchConfetti === 'function') {
      window.luckyWheel.launchConfetti();
      return;
    }

    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#eab308', '#ffffff'];
    const particles = [];
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() * 200 - 100),
        y: canvas.height / 2 + (Math.random() * 100 - 50),
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 12 - 4,
        size: Math.random() * 7 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    let frame = 0;
    const render = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravité
        p.rotation += p.rotSpeed;
        p.opacity -= 0.008;

        if (p.opacity > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      if (alive && frame < 180) {
        requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    render();
  }

  stopAllTimers() {
    this.pendingTurnEvent = null;
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
