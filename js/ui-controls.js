/**
 * Hika-Poker - Panneau de Contrôle Joueur & Pré-actions Zynga (UI Controls)
 * Gestion contextuelle des boutons, Raise Slider, raccourcis et automatisation.
 */

class PlayerControlsUI {
  constructor() {
    this.actionBarEl = null;
    this.preActionBarEl = null;
    this.sliderContainerEl = null;
    this.raiseSliderEl = null;
    this.sliderValueDisplayEl = null;
    this.btnConfirmRaise = null;

    this.onActionCallback = null;
    this.currentLegal = null;
    this.currentBigBlind = 20;

    // État des pré-actions
    this.preAction = null; // 'checkFold' | 'autoCheck' | 'callAny' | null
  }

  init(onAction) {
    this.onActionCallback = onAction;
    this.actionBarEl = document.getElementById('action-bar');
    this.preActionBarEl = document.getElementById('pre-action-bar');
    this.sliderContainerEl = document.getElementById('raise-slider-container');
    this.raiseSliderEl = document.getElementById('raise-range-slider');
    this.sliderValueDisplayEl = document.getElementById('slider-raise-value');
    this.btnConfirmRaise = document.getElementById('btn-confirm-raise');

    this.bindEvents();
  }

  bindEvents() {
    // Bouton Fold
    const btnFold = document.getElementById('btn-fold');
    if (btnFold) {
      btnFold.addEventListener('click', () => {
        if (window.soundFX) window.soundFX.playFold();
        this.emitAction({ type: 'fold' });
      });
    }

    // Bouton Check
    const btnCheck = document.getElementById('btn-check');
    if (btnCheck) {
      btnCheck.addEventListener('click', () => {
        if (window.soundFX) window.soundFX.playCheck();
        this.emitAction({ type: 'check' });
      });
    }

    // Bouton Call
    const btnCall = document.getElementById('btn-call');
    if (btnCall) {
      btnCall.addEventListener('click', () => {
        if (window.soundFX) window.soundFX.playChip();
        this.emitAction({ type: 'call' });
      });
    }

    // Bouton Open Raise Modal / Slider
    const btnOpenRaise = document.getElementById('btn-open-raise');
    if (btnOpenRaise) {
      btnOpenRaise.addEventListener('click', () => {
        this.toggleRaiseSlider();
      });
    }

    // Bouton All-in
    const btnAllIn = document.getElementById('btn-all-in');
    if (btnAllIn) {
      btnAllIn.addEventListener('click', () => {
        if (window.soundFX) window.soundFX.playAllIn();
        this.emitAction({ type: 'allin' });
      });
    }

    // Confirm Raise
    if (this.btnConfirmRaise) {
      this.btnConfirmRaise.addEventListener('click', () => {
        const val = parseInt(this.raiseSliderEl.value, 10);
        if (window.soundFX) window.soundFX.playChip();
        const isBet = this.currentLegal && this.currentLegal.canBet;
        this.emitAction({ type: isBet ? 'bet' : 'raise', amount: val });
        this.hideRaiseSlider();
      });
    }

    // Fermer le slider
    const btnCloseSlider = document.getElementById('btn-close-slider');
    if (btnCloseSlider) {
      btnCloseSlider.addEventListener('click', () => this.hideRaiseSlider());
    }

    // Slider input change
    if (this.raiseSliderEl) {
      this.raiseSliderEl.addEventListener('input', () => {
        this.updateSliderValueDisplay();
      });
    }

    // Raccourcis slider : Min, 1/2 Pot, Pot, All-in
    const btnQuickMin = document.getElementById('btn-quick-min');
    if (btnQuickMin) {
      btnQuickMin.addEventListener('click', () => {
        if (!this.currentLegal) return;
        this.setSliderValue(this.currentLegal.minRaiseTo);
      });
    }

    const btnQuickHalfPot = document.getElementById('btn-quick-half-pot');
    if (btnQuickHalfPot) {
      btnQuickHalfPot.addEventListener('click', () => {
        if (!this.currentLegal) return;
        const curBet = this.currentLegal.currentBet || 0;
        const pot = this.currentLegal.potSize || 0;
        const toCall = this.currentLegal.toCall || 0;
        const to = curBet + Math.round((pot + toCall) * 0.5);
        this.setSliderValue(to);
      });
    }

    const btnQuickPot = document.getElementById('btn-quick-pot');
    if (btnQuickPot) {
      btnQuickPot.addEventListener('click', () => {
        if (!this.currentLegal) return;
        const curBet = this.currentLegal.currentBet || 0;
        const pot = this.currentLegal.potSize || 0;
        const toCall = this.currentLegal.toCall || 0;
        const to = curBet + pot + toCall;
        this.setSliderValue(to);
      });
    }

    const btnQuickAllIn = document.getElementById('btn-quick-all-in');
    if (btnQuickAllIn) {
      btnQuickAllIn.addEventListener('click', () => {
        if (!this.currentLegal) return;
        this.setSliderValue(this.currentLegal.maxRaiseTo);
      });
    }

    // Boutons + et - pour le slider
    const btnSliderPlus = document.getElementById('btn-slider-plus');
    if (btnSliderPlus) {
      btnSliderPlus.addEventListener('click', () => {
        if (!this.raiseSliderEl || !this.currentLegal) return;
        const step = this.currentBigBlind || 20;
        const current = parseInt(this.raiseSliderEl.value, 10);
        this.setSliderValue(Math.min(this.currentLegal.maxRaiseTo, current + step));
      });
    }

    const btnSliderMinus = document.getElementById('btn-slider-minus');
    if (btnSliderMinus) {
      btnSliderMinus.addEventListener('click', () => {
        if (!this.raiseSliderEl || !this.currentLegal) return;
        const step = this.currentBigBlind || 20;
        const current = parseInt(this.raiseSliderEl.value, 10);
        this.setSliderValue(Math.max(this.currentLegal.minRaiseTo, current - step));
      });
    }

    // Pré-actions
    const preCheckFold = document.getElementById('pre-check-fold');
    const preAutoCheck = document.getElementById('pre-auto-check');
    const preCallAny = document.getElementById('pre-call-any');

    [preCheckFold, preAutoCheck, preCallAny].forEach((el) => {
      if (el) {
        el.addEventListener('change', (e) => {
          if (e.target.checked) {
            // Uncheck les autres
            [preCheckFold, preAutoCheck, preCallAny].forEach((o) => {
              if (o && o !== e.target) o.checked = false;
            });
            this.preAction = e.target.value;
          } else {
            this.preAction = null;
          }
        });
      }
    });
  }

  emitAction(action) {
    this.hideAll();
    if (typeof this.onActionCallback === 'function') {
      this.onActionCallback(action);
    }
  }

  // Mise à jour de l'affichage des contrôles selon la situation légale
  updateState(legal, isMyTurn, bigBlind = 20) {
    this.currentLegal = legal;
    this.currentBigBlind = bigBlind;

    if (!isMyTurn || !legal) {
      // Pas mon tour : masquer la barre d'action, afficher la barre de pré-action
      this.hideActionBar();
      this.showPreActionBar();
      return false;
    }

    // C'est mon tour !
    this.hidePreActionBar();

    // Vérifier si une pré-action peut être exécutée automatiquement
    if (this.preAction) {
      const executed = this.tryExecutePreAction(legal);
      if (executed) return true;
    }

    // Sinon, afficher les boutons d'action appropriés
    this.showActionBar(legal);
    return false;
  }

  tryExecutePreAction(legal) {
    const act = this.preAction;
    this.resetPreActions();

    if (act === 'checkFold') {
      if (legal.canCheck) {
        if (window.soundFX) window.soundFX.playCheck();
        setTimeout(() => this.emitAction({ type: 'check' }), 200);
        return true;
      } else {
        if (window.soundFX) window.soundFX.playFold();
        setTimeout(() => this.emitAction({ type: 'fold' }), 200);
        return true;
      }
    } else if (act === 'autoCheck') {
      if (legal.canCheck) {
        if (window.soundFX) window.soundFX.playCheck();
        setTimeout(() => this.emitAction({ type: 'check' }), 200);
        return true;
      }
    } else if (act === 'callAny') {
      if (legal.canCheck) {
        if (window.soundFX) window.soundFX.playCheck();
        setTimeout(() => this.emitAction({ type: 'check' }), 200);
        return true;
      } else if (legal.canCall) {
        if (window.soundFX) window.soundFX.playChip();
        setTimeout(() => this.emitAction({ type: 'call' }), 200);
        return true;
      }
    }
    return false;
  }

  showActionBar(legal) {
    if (!this.actionBarEl) return;
    this.actionBarEl.classList.remove('hidden');
    this.actionBarEl.classList.add('flex');

    const btnFold = document.getElementById('btn-fold');
    const btnCheck = document.getElementById('btn-check');
    const btnCall = document.getElementById('btn-call');
    const btnOpenRaise = document.getElementById('btn-open-raise');
    const btnAllIn = document.getElementById('btn-all-in');

    // Fold toujours disponible
    if (btnFold) btnFold.style.display = 'block';

    // Check vs Call
    if (legal.canCheck) {
      if (btnCheck) btnCheck.style.display = 'block';
      if (btnCall) btnCall.style.display = 'none';
    } else if (legal.canCall) {
      if (btnCheck) btnCheck.style.display = 'none';
      if (btnCall) {
        btnCall.style.display = 'block';
        const callAmtEl = document.getElementById('call-amount-display');
        if (callAmtEl) callAmtEl.textContent = `(${legal.callAmount.toLocaleString()})`;
      }
    } else {
      if (btnCheck) btnCheck.style.display = 'none';
      if (btnCall) btnCall.style.display = 'none';
    }

    // Raise / Bet
    if (legal.canRaise) {
      if (btnOpenRaise) {
        btnOpenRaise.style.display = 'block';
        const lbl = legal.canBet ? 'MISER' : 'RELANCER';
        btnOpenRaise.querySelector('.raise-btn-label').textContent = lbl;
      }
    } else {
      if (btnOpenRaise) btnOpenRaise.style.display = 'none';
    }

    // All-in
    if (legal.canAllIn) {
      if (btnAllIn) btnAllIn.style.display = 'block';
    } else {
      if (btnAllIn) btnAllIn.style.display = 'none';
    }

    // Setup slider limits
    if (legal.canRaise && this.raiseSliderEl) {
      this.raiseSliderEl.min = legal.minRaiseTo;
      this.raiseSliderEl.max = legal.maxRaiseTo;
      this.raiseSliderEl.step = 1; // Permet d'atteindre toutes les valeurs exactes (dont maxRaiseTo / All-in)
      this.raiseSliderEl.value = legal.minRaiseTo;
      this.updateSliderValueDisplay();
    }
  }

  hideActionBar() {
    if (this.actionBarEl) {
      this.actionBarEl.classList.add('hidden');
      this.actionBarEl.classList.remove('flex');
    }
    this.hideRaiseSlider();
  }

  showPreActionBar() {
    if (this.preActionBarEl) {
      this.preActionBarEl.classList.remove('hidden');
      this.preActionBarEl.classList.add('flex');
    }
  }

  hidePreActionBar() {
    if (this.preActionBarEl) {
      this.preActionBarEl.classList.add('hidden');
      this.preActionBarEl.classList.remove('flex');
    }
  }

  resetPreActions() {
    this.preAction = null;
    ['pre-check-fold', 'pre-auto-check', 'pre-call-any'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });
  }

  toggleRaiseSlider() {
    if (!this.sliderContainerEl) return;
    const isHidden = this.sliderContainerEl.classList.contains('hidden');
    if (isHidden) {
      this.sliderContainerEl.classList.remove('hidden');
      this.sliderContainerEl.classList.add('flex');
      this.updateSliderValueDisplay();
    } else {
      this.hideRaiseSlider();
    }
  }

  hideRaiseSlider() {
    if (this.sliderContainerEl) {
      this.sliderContainerEl.classList.add('hidden');
      this.sliderContainerEl.classList.remove('flex');
    }
  }

  setSliderValue(val) {
    if (!this.raiseSliderEl || !this.currentLegal) return;
    const clamped = Math.max(this.currentLegal.minRaiseTo, Math.min(this.currentLegal.maxRaiseTo, val));
    this.raiseSliderEl.value = clamped;
    this.updateSliderValueDisplay();
  }

  updateSliderValueDisplay() {
    if (!this.raiseSliderEl || !this.sliderValueDisplayEl) return;
    const val = parseInt(this.raiseSliderEl.value, 10);
    this.sliderValueDisplayEl.textContent = val.toLocaleString();

    if (this.btnConfirmRaise) {
      const isBet = this.currentLegal && this.currentLegal.canBet;
      this.btnConfirmRaise.textContent = `${isBet ? 'MISER' : 'RELANCER À'} ${val.toLocaleString()}`;
    }
  }

  hideAll() {
    this.hideActionBar();
    this.hidePreActionBar();
    this.hideRaiseSlider();
  }
}

window.playerControlsUI = new PlayerControlsUI();
