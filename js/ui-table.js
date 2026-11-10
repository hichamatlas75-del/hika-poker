/**
 * Hika-Poker - Rendu Visuel de la Table de Poker (UI Table)
 * Sièges, cartes 3D, animations de distribution, jetons volants et timer circulaire.
 */

class TableUI {
  constructor() {
    this.tableEl = null;
    this.boardEl = null;
    this.potEl = null;
    this.seatsContainer = null;
    this.timerInterval = null;
    this.currentTimerSeat = null;
    this.lastBoardCards = [];
    this.seatLayout = [
      { id: 0, posClass: 'seat-bottom-center' },
      { id: 1, posClass: 'seat-bottom-left' },
      { id: 2, posClass: 'seat-top-left' },
      { id: 3, posClass: 'seat-top-center' },
      { id: 4, posClass: 'seat-top-right' },
      { id: 5, posClass: 'seat-bottom-right' }
    ];
  }

  init() {
    this.tableEl = document.getElementById('poker-table');
    this.boardEl = document.getElementById('community-cards');
    this.potEl = document.getElementById('table-pot-container');
    this.seatsContainer = document.getElementById('seats-container');
  }

  // Création du HTML pour une carte
  createCardHTML(cardStr, isFlipped = false, isWinning = false) {
    if (!cardStr) {
      // Dos de la carte
      return `
        <div class="poker-card ${isWinning ? 'card-winning-glow' : ''}">
          <div class="card-inner">
            <div class="card-back"></div>
            <div class="card-front"></div>
          </div>
        </div>
      `;
    }

    const info = window.PokerEngine ? window.PokerEngine.cardInfo(cardStr) : {
      rankChar: cardStr[0],
      symbol: cardStr[1],
      color: (cardStr[1] === 'h' || cardStr[1] === 'd') ? 'red' : 'black'
    };

    const isRed = info.color === 'red';
    const suitClass = isRed ? 'suit-red' : 'suit-black';

    return `
      <div class="poker-card ${isWinning ? 'card-winning-glow' : ''}" data-card="${cardStr}">
        <div class="card-inner ${isFlipped ? 'flipped' : ''}">
          <div class="card-back"></div>
          <div class="card-front ${suitClass}">
            <div class="flex flex-col items-center leading-none text-left self-start">
              <span class="text-xs md:text-sm font-black">${info.rankChar}</span>
              <span class="text-xs md:text-sm -mt-0.5">${info.symbol}</span>
            </div>
            <div class="text-xl md:text-2xl self-center font-bold">
              ${info.symbol}
            </div>
            <div class="flex flex-col items-center leading-none text-right self-end transform rotate-180">
              <span class="text-xs md:text-sm font-black">${info.rankChar}</span>
              <span class="text-xs md:text-sm -mt-0.5">${info.symbol}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Rendu des cartes du board (Flop, Turn, River) avec effet de retournement 3D
  renderBoard(boardCards, winningCards = []) {
    if (!this.boardEl) return;
    this.boardEl.innerHTML = '';

    boardCards.forEach((cStr, idx) => {
      const isNew = !this.lastBoardCards.includes(cStr);
      const isWinning = winningCards.includes(cStr);
      const cardWrapper = document.createElement('div');
      cardWrapper.innerHTML = this.createCardHTML(cStr, !isNew, isWinning);
      const cardEl = cardWrapper.firstElementChild;
      this.boardEl.appendChild(cardEl);

      // Si c'est une nouvelle carte, déclencher le flip 3D avec un léger délai séquentiel
      if (isNew) {
        setTimeout(() => {
          const inner = cardEl.querySelector('.card-inner');
          if (inner) inner.classList.add('flipped');
          if (window.soundFX) window.soundFX.playCardDeal();
        }, idx * 120 + 50);
      }
    });

    this.lastBoardCards = boardCards.slice();
  }

  // Rendu du Pot (Principal + Annexes)
  renderPot(potTotal, potsList = []) {
    if (!this.potEl) return;
    const potBadge = document.getElementById('pot-amount-text');
    if (potBadge) {
      potBadge.textContent = potTotal > 0 ? potTotal.toLocaleString() : '0';
    }

    const sidePotsEl = document.getElementById('side-pots-container');
    if (sidePotsEl) {
      if (potsList && potsList.length > 1) {
        sidePotsEl.innerHTML = potsList.map((p, i) => `
          <div class="px-2 py-0.5 bg-black/60 border border-amber-500/40 rounded-full text-[10px] text-amber-200 font-bold">
            Pot ${i + 1}: ${p.amount.toLocaleString()}
          </div>
        `).join('');
      } else {
        sidePotsEl.innerHTML = '';
      }
    }
  }

  // Rendu complet des sièges joueurs
  renderSeats(engineState, humanPlayerId = 'player_user', winningCards = []) {
    if (!this.seatsContainer) return;
    this.seatsContainer.innerHTML = '';

    const players = engineState.players || [];
    const humanSeat = players.findIndex((p) => p && p.id === humanPlayerId);
    const numSeats = 6;

    for (let uiIdx = 0; uiIdx < numSeats; uiIdx++) {
      // Rotation relative pour que le joueur humain soit toujours au siège 0 (Bas Centre)
      let engineSeatIdx = humanSeat >= 0 ? (uiIdx + humanSeat) % numSeats : uiIdx;
      const p = players[engineSeatIdx];

      const seatDiv = document.createElement('div');
      seatDiv.className = `player-seat seat-pos-${uiIdx} absolute transition-all duration-300`;
      seatDiv.id = `seat-ui-${uiIdx}`;
      seatDiv.dataset.engineSeat = engineSeatIdx;

      if (!p) {
        // Siège vide
        seatDiv.innerHTML = `
          <div class="flex flex-col items-center opacity-30">
            <div class="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-dashed border-slate-500 flex items-center justify-center">
              <span class="text-xs text-slate-400 font-bold">VIDE</span>
            </div>
          </div>
        `;
        this.seatsContainer.appendChild(seatDiv);
        continue;
      }

      // Siège occupé
      const isCurrentTurn = p.isCurrent;
      const isHuman = p.id === humanPlayerId;
      const isFolded = p.folded;
      const isBusted = p.busted;

      // Cartes du joueur
      let cardsHTML = '';
      if (p.inHand && !isFolded) {
        if (p.hole && p.hole.length === 2) {
          // Cartes visibles (joueur humain ou showdown)
          const c1Winning = winningCards.includes(p.hole[0]);
          const c2Winning = winningCards.includes(p.hole[1]);
          cardsHTML = `
            <div class="flex -space-x-4 md:-space-x-5 mb-1 transition-transform ${isHuman ? 'hover:-translate-y-1' : ''}">
              <div class="transform -rotate-6 origin-bottom-right">
                ${this.createCardHTML(p.hole[0], true, c1Winning)}
              </div>
              <div class="transform rotate-6 origin-bottom-left">
                ${this.createCardHTML(p.hole[1], true, c2Winning)}
              </div>
            </div>
          `;
        } else if (p.holeCount === 2) {
          // Cartes fermées des bots
          cardsHTML = `
            <div class="flex -space-x-5 mb-1">
              <div class="transform -rotate-6 origin-bottom-right">
                ${this.createCardHTML(null)}
              </div>
              <div class="transform rotate-6 origin-bottom-left">
                ${this.createCardHTML(null)}
              </div>
            </div>
          `;
        }
      }

      // Badge du Dealer
      const dealerBadge = p.isDealer ? `
        <div class="dealer-btn absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center font-black text-xs z-20">
          D
        </div>
      ` : '';

      // Badges Blinds
      const blindBadge = p.isSmallBlind ? `
        <div class="blind-badge absolute -top-1 -left-1 px-1.5 py-0.2 rounded-full font-bold text-[9px] z-20">
          SB
        </div>
      ` : p.isBigBlind ? `
        <div class="blind-badge absolute -top-1 -left-1 px-1.5 py-0.2 rounded-full font-bold text-[9px] z-20">
          BB
        </div>
      ` : '';

      // Statut d'action récente
      let statusBadge = '';
      if (p.lastAction) {
        const actionLabels = {
          fold: 'FOLD',
          check: 'CHECK',
          call: 'CALL',
          bet: 'BET',
          raise: 'RAISE',
          allin: 'ALL-IN'
        };
        const actionBg = {
          fold: 'bg-red-800 text-red-200 border-red-500',
          check: 'bg-emerald-800 text-emerald-200 border-emerald-500',
          call: 'bg-blue-800 text-blue-200 border-blue-500',
          bet: 'bg-amber-800 text-amber-200 border-amber-500',
          raise: 'bg-amber-600 text-yellow-100 border-yellow-400',
          allin: 'bg-pink-700 text-pink-100 border-pink-400 animate-pulse'
        };
        const lbl = actionLabels[p.lastAction] || p.lastAction.toUpperCase();
        const cls = actionBg[p.lastAction] || 'bg-slate-800 text-white border-slate-600';
        statusBadge = `
          <div class="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border shadow-md z-20 ${cls}">
            ${lbl}
          </div>
        `;
      }

      // Jeton de mise en cours sur la table
      const betChip = p.bet > 0 ? `
        <div class="player-bet-chip absolute ${this.getBetPositionClass(uiIdx)} flex items-center gap-1 bg-black/70 px-2 py-0.5 rounded-full border border-amber-400/60 shadow-lg z-10 animate-fade-in">
          <div class="w-3.5 h-3.5 rounded-full poker-chip chip-gold text-[8px]">★</div>
          <span class="text-xs font-black text-amber-300">${p.bet.toLocaleString()}</span>
        </div>
      ` : '';

      // Avatar
      const avatarIcon = p.avatar || (isHuman ? '👤' : '🤖');
      const avatarBg = p.isBot ? (p.meta && p.meta.avatarBg ? p.meta.avatarBg : 'from-indigo-600 to-slate-800') : 'from-amber-500 to-yellow-600';

      seatDiv.innerHTML = `
        <div class="flex flex-col items-center relative ${isFolded ? 'opacity-40 grayscale' : ''}">
          <!-- Cartes du joueur -->
          <div class="player-cards-wrapper z-10">
            ${cardsHTML}
          </div>

          <!-- Avatar & Timer -->
          <div class="relative w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br ${avatarBg} p-0.5 shadow-xl flex items-center justify-center border-2 ${isCurrentTurn ? 'border-yellow-400 shadow-yellow-500/50 shadow-lg' : 'border-slate-700'}">
            <!-- Timer circulaire SVG -->
            <div class="timer-container" id="timer-ui-${uiIdx}" style="display: ${isCurrentTurn ? 'block' : 'none'};">
              <svg class="timer-svg" viewBox="0 0 100 100">
                <circle class="timer-track" cx="50" cy="50" r="46"></circle>
                <circle class="timer-bar" id="timer-bar-${uiIdx}" cx="50" cy="50" r="46"></circle>
              </svg>
            </div>

            <!-- Icône / Emoji Avatar -->
            <span class="text-2xl md:text-3xl select-none">${avatarIcon}</span>

            ${dealerBadge}
            ${blindBadge}
            ${statusBadge}
          </div>

          <!-- Info Joueur : Nom & Solde -->
          <div class="mt-1 flex flex-col items-center bg-slate-900/90 backdrop-blur-sm px-2.5 py-0.5 rounded-lg border border-slate-700 shadow-md min-w-[70px] md:min-w-[85px]">
            <span class="text-[11px] font-bold text-slate-200 truncate max-w-[80px]">${p.name}</span>
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-amber-400 font-extrabold">🪙</span>
              <span class="text-[11px] font-black text-amber-300">${isBusted ? 'ÉLIMINÉ' : p.chips.toLocaleString()}</span>
            </div>
          </div>

          ${betChip}
        </div>
      `;

      this.seatsContainer.appendChild(seatDiv);
    }
  }

  getBetPositionClass(uiIdx) {
    switch (uiIdx) {
      case 0: return '-top-7 left-1/2 -translate-x-1/2'; // Bas centre vers le pot
      case 1: return '-top-2 -right-8';                  // Bas gauche vers le centre
      case 2: return '-bottom-2 -right-8';               // Haut gauche vers le centre
      case 3: return '-bottom-7 left-1/2 -translate-x-1/2'; // Haut centre vers le pot
      case 4: return '-bottom-2 -left-8';                // Haut droite vers le centre
      case 5: return '-top-2 -left-8';                   // Bas droite vers le centre
      default: return '-top-6 left-1/2';
    }
  }

  // Animation de Timer circulaire avec avertissement audio
  startTurnTimer(uiSeatIdx, durationMs = 15000, onTimeout = null) {
    this.stopTurnTimer();
    this.currentTimerSeat = uiSeatIdx;

    const timerContainer = document.getElementById(`timer-ui-${uiSeatIdx}`);
    const timerBar = document.getElementById(`timer-bar-${uiSeatIdx}`);
    if (!timerContainer || !timerBar) return;

    timerContainer.style.display = 'block';
    timerBar.classList.remove('urgent');

    const totalCircumference = 289; // 2 * PI * 46
    const startTime = Date.now();
    let lastSecondTicked = -1;

    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, durationMs - elapsed);
      const ratio = remaining / durationMs;
      const offset = totalCircumference * (1 - ratio);

      timerBar.style.strokeDashoffset = offset;

      // Moins de 3 secondes restantes : mode urgent
      if (remaining <= 3500) {
        timerBar.classList.add('urgent');
        const sec = Math.ceil(remaining / 1000);
        if (sec !== lastSecondTicked && sec > 0) {
          lastSecondTicked = sec;
          if (window.soundFX) window.soundFX.playTimerTick(true);
        }
      }

      if (remaining <= 0) {
        this.stopTurnTimer();
        if (typeof onTimeout === 'function') onTimeout();
      }
    }, 100);
  }

  stopTurnTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.currentTimerSeat !== null) {
      const timerContainer = document.getElementById(`timer-ui-${this.currentTimerSeat}`);
      if (timerContainer) timerContainer.style.display = 'none';
      this.currentTimerSeat = null;
    }
  }

  // Animation de jetons volants (mise vers pot ou pot vers joueur)
  flyChips(fromEl, toEl, onComplete = null) {
    if (!fromEl || !toEl) {
      if (onComplete) onComplete();
      return;
    }

    const rFrom = fromEl.getBoundingClientRect();
    const rTo = toEl.getBoundingClientRect();

    const startX = rFrom.left + rFrom.width / 2;
    const startY = rFrom.top + rFrom.height / 2;
    const endX = rTo.left + rTo.width / 2;
    const endY = rTo.top + rTo.height / 2;

    const chip = document.createElement('div');
    chip.className = 'flying-chip poker-chip chip-gold w-6 h-6 text-[10px]';
    chip.innerHTML = '★';
    chip.style.left = `${startX}px`;
    chip.style.top = `${startY}px`;
    document.body.appendChild(chip);

    if (window.soundFX) window.soundFX.playChip();

    // Force reflow
    void chip.offsetWidth;

    chip.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(1.2)`;
    chip.style.opacity = '0.9';

    setTimeout(() => {
      chip.remove();
      if (onComplete) onComplete();
    }, 550);
  }

  // Affichage de la bannière de victoire au Showdown
  showWinnerBanner(winnerName, handLabel, amountWon) {
    const banner = document.getElementById('winner-banner');
    if (!banner) return;

    banner.innerHTML = `
      <div class="winner-banner-anim bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-slate-900 px-6 py-3 rounded-2xl shadow-2xl border-2 border-yellow-200 flex flex-col items-center">
        <span class="text-xs font-black tracking-widest uppercase text-amber-950">🏆 VAINQUEUR DU POT 🏆</span>
        <span class="text-xl md:text-2xl font-black text-white drop-shadow">${winnerName}</span>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-xs font-bold text-amber-950 bg-yellow-300/80 px-2 py-0.5 rounded-full">${handLabel}</span>
          <span class="text-sm font-black text-white drop-shadow">+${amountWon.toLocaleString()} 🪙</span>
        </div>
      </div>
    `;
    banner.classList.remove('hidden');

    setTimeout(() => {
      banner.classList.add('hidden');
    }, 4500);
  }
}

window.tableUI = new TableUI();
