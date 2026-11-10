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

  // Création du HTML pour une carte (supporte human, board, bot)
  createCardHTML(cardStr, isFlipped = false, isWinning = false, cardType = 'board') {
    const cardClass = cardType === 'human' ? 'poker-card-human' : cardType === 'bot' ? 'poker-card-bot' : 'poker-card-board';

    if (!cardStr) {
      // Dos de la carte
      return `
        <div class="poker-card ${cardClass} ${isWinning ? 'card-winning-glow' : ''}">
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

    // Tailles typographiques adaptées selon le type de carte
    let rankTextSize = 'text-[11px] md:text-sm';
    let centerSuitSize = 'text-base md:text-2xl';
    if (cardType === 'bot') {
      rankTextSize = 'text-[8px] sm:text-[9px]';
      centerSuitSize = 'text-[10px] sm:text-xs';
    } else if (cardType === 'human') {
      rankTextSize = 'text-xs sm:text-sm md:text-base';
      centerSuitSize = 'text-lg sm:text-2xl md:text-3xl';
    }

    return `
      <div class="poker-card ${cardClass} ${isWinning ? 'card-winning-glow' : ''}" data-card="${cardStr}">
        <div class="card-inner ${isFlipped ? 'flipped' : ''}">
          <div class="card-back"></div>
          <div class="card-front ${suitClass}">
            <div class="flex flex-col items-center leading-none text-left self-start">
              <span class="${rankTextSize} font-black">${info.rankChar}</span>
              <span class="${rankTextSize} -mt-0.5">${info.symbol}</span>
            </div>
            <div class="${centerSuitSize} self-center font-bold">
              ${info.symbol}
            </div>
            <div class="flex flex-col items-center leading-none text-right self-end transform rotate-180">
              <span class="${rankTextSize} font-black">${info.rankChar}</span>
              <span class="${rankTextSize} -mt-0.5">${info.symbol}</span>
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
      cardWrapper.innerHTML = this.createCardHTML(cStr, !isNew, isWinning, 'board');
      const cardEl = cardWrapper.firstElementChild;
      this.boardEl.appendChild(cardEl);

      // Si c'est une nouvelle carte, déclencher le flip 3D avec un léger délai séquentiel
      if (isNew) {
        setTimeout(() => {
          const inner = cardEl.querySelector('.card-inner');
          if (inner) inner.classList.add('flipped');
          if (window.soundFX) window.soundFX.playCardFlip();
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
          <div class="px-2 py-0.5 bg-black/60 border border-amber-500/40 rounded-full text-[9px] sm:text-[10px] text-amber-200 font-bold">
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
            <div class="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full border-2 border-dashed border-slate-500 flex items-center justify-center">
              <span class="text-[10px] text-slate-400 font-bold">VIDE</span>
            </div>
          </div>
        `;
        this.seatsContainer.appendChild(seatDiv);
        continue;
      // Siège occupé
      seatDiv.dataset.playerId = p.id;
      const isCurrentTurn = p.isCurrent;
      const isHuman = p.id === humanPlayerId;
      const isFolded = p.folded;
      const isBusted = p.busted;

      // Cartes du joueur
      let cardsHTML = '';
      if (p.inHand && !isFolded) {
        if (isHuman) {
          // Joueur humain : cartes toujours visibles
          if (p.hole && p.hole.length === 2) {
            const c1Winning = winningCards.includes(p.hole[0]);
            const c2Winning = winningCards.includes(p.hole[1]);
            cardsHTML = `
              <div class="transform -rotate-6 origin-bottom-right transition-transform hover:-translate-y-1">
                ${this.createCardHTML(p.hole[0], true, c1Winning, 'human')}
              </div>
              <div class="transform rotate-6 origin-bottom-left transition-transform hover:-translate-y-1">
                ${this.createCardHTML(p.hole[1], true, c2Winning, 'human')}
              </div>
            `;
          }
        } else {
          // Bots : mini-cartes
          if (p.hole && p.hole.length === 2) {
            // Cartes révélées (showdown / all-in)
            const c1Winning = winningCards.includes(p.hole[0]);
            const c2Winning = winningCards.includes(p.hole[1]);
            cardsHTML = `
              <div class="transform -rotate-6 origin-bottom-right">
                ${this.createCardHTML(p.hole[0], true, c1Winning, 'bot')}
              </div>
              <div class="transform rotate-6 origin-bottom-left">
                ${this.createCardHTML(p.hole[1], true, c2Winning, 'bot')}
              </div>
            `;
          } else if (p.holeCount === 2) {
            // Dos de mini-cartes pour les bots actifs
            cardsHTML = `
              <div class="transform -rotate-6 origin-bottom-right">
                ${this.createCardHTML(null, false, false, 'bot')}
              </div>
              <div class="transform rotate-6 origin-bottom-left">
                ${this.createCardHTML(null, false, false, 'bot')}
              </div>
            `;
          }
        }
      }

      // Badge du Dealer
      const dealerBadge = p.isDealer ? `
        <div class="dealer-btn absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center font-black text-[10px] sm:text-xs z-20">
          D
        </div>
      ` : '';

      // Badges Blinds
      const blindBadge = p.isSmallBlind ? `
        <div class="blind-badge absolute -top-1 -left-1 px-1 py-0.2 rounded-full font-bold text-[8px] sm:text-[9px] z-20">
          SB
        </div>
      ` : p.isBigBlind ? `
        <div class="blind-badge absolute -top-1 -left-1 px-1 py-0.2 rounded-full font-bold text-[8px] sm:text-[9px] z-20">
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
          <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 px-1.5 py-0.2 rounded-full text-[8px] sm:text-[9px] font-black tracking-wider uppercase border shadow-md z-20 ${cls}">
            ${lbl}
          </div>
        `;
      }

      // Jeton de mise en cours sur la table
      const betChip = p.bet > 0 ? `
        <div class="player-bet-chip absolute ${this.getBetPositionClass(uiIdx)} flex items-center gap-1 bg-black/75 px-1.5 sm:px-2 py-0.5 rounded-full border border-amber-400/60 shadow-lg z-25 animate-fade-in pointer-events-none">
          <div class="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full poker-chip chip-gold text-[7px] sm:text-[8px]">★</div>
          <span class="text-[10px] sm:text-xs font-black text-amber-300">${p.bet.toLocaleString()}</span>
        </div>
      ` : '';

      // Avatar
      const avatarIcon = p.avatar || (isHuman ? '👤' : '🤖');
      const avatarBg = p.isBot ? (p.meta && p.meta.avatarBg ? p.meta.avatarBg : 'from-indigo-600 to-slate-800') : 'from-amber-500 to-yellow-600';

      if (isHuman) {
        // Layout Joueur Humain (Hero Pod compact côte-à-côte pour zéro collision)
        seatDiv.innerHTML = `
          <div class="hero-seat-pod flex items-center gap-1.5 sm:gap-2.5 bg-slate-950/85 backdrop-blur-md px-2 py-1 rounded-2xl border-2 ${isCurrentTurn ? 'border-yellow-400 shadow-yellow-500/50 shadow-lg' : 'border-amber-500/40'} shadow-2xl relative ${isFolded ? 'opacity-40 grayscale' : ''}">
            <!-- Avatar & Infos Joueur -->
            <div class="flex flex-col items-center">
              <div class="relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 p-0.5 shadow-md flex items-center justify-center">
                <div class="timer-container" id="timer-ui-${uiIdx}" style="display: ${isCurrentTurn ? 'block' : 'none'};">
                  <svg class="timer-svg" viewBox="0 0 100 100">
                    <circle class="timer-track" cx="50" cy="50" r="46"></circle>
                    <circle class="timer-bar" id="timer-bar-${uiIdx}" cx="50" cy="50" r="46"></circle>
                  </svg>
                </div>
                <span class="text-xl sm:text-2xl">${avatarIcon}</span>
                ${dealerBadge}
                ${blindBadge}
                ${statusBadge}
              </div>
              
              <div class="mt-0.5 flex flex-col items-center">
                <span class="text-[9px] sm:text-[10px] md:text-[11px] font-bold text-slate-200 truncate max-w-[65px] sm:max-w-[75px]">${p.name}</span>
                <div class="flex items-center gap-0.5">
                  <span class="text-[8px] sm:text-[9px]">🪙</span>
                  <span class="text-[9px] sm:text-[10px] md:text-[11px] font-black text-amber-300">${isBusted ? 'OUT' : p.chips.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <!-- Cartes Privées Humain -->
            ${!isFolded && cardsHTML ? `
              <div class="hero-hole-cards flex -space-x-3 sm:-space-x-4 pl-0.5">
                ${cardsHTML}
              </div>
            ` : ''}

            ${betChip}
          </div>
        `;
      } else {
        // Layout Bots (Compact vertical, mini-cartes non encombrantes)
        seatDiv.innerHTML = `
          <div class="bot-seat-pod flex flex-col items-center relative ${isFolded ? 'opacity-35 grayscale' : ''}">
            <!-- Mini Cartes du Bot (seulement si en jeu et non couché) -->
            ${!isFolded && cardsHTML ? `
              <div class="bot-cards-wrapper absolute -top-3.5 z-10 flex -space-x-2">
                ${cardsHTML}
              </div>
            ` : ''}

            <!-- Avatar & Timer -->
            <div class="relative w-9 h-9 sm:w-11 sm:h-11 md:w-13 md:h-13 rounded-full bg-gradient-to-br ${avatarBg} p-0.5 shadow-xl flex items-center justify-center border-2 ${isCurrentTurn ? 'border-yellow-400 shadow-yellow-500/50 shadow-lg' : 'border-slate-700'}">
              <div class="timer-container" id="timer-ui-${uiIdx}" style="display: ${isCurrentTurn ? 'block' : 'none'};">
                <svg class="timer-svg" viewBox="0 0 100 100">
                  <circle class="timer-track" cx="50" cy="50" r="46"></circle>
                  <circle class="timer-bar" id="timer-bar-${uiIdx}" cx="50" cy="50" r="46"></circle>
                </svg>
              </div>

              <span class="text-lg sm:text-xl md:text-2xl select-none">${avatarIcon}</span>
              ${dealerBadge}
              ${blindBadge}
              ${statusBadge}
            </div>

            <!-- Info Joueur : Nom & Solde -->
            <div class="mt-0.5 flex flex-col items-center bg-slate-900/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md border border-slate-700 shadow-md">
              <span class="text-[8px] sm:text-[9px] md:text-[10px] font-bold text-slate-200 truncate max-w-[55px] sm:max-w-[70px]">${p.name}</span>
              <div class="flex items-center gap-0.5">
                <span class="text-[8px]">🪙</span>
                <span class="text-[8px] sm:text-[9px] md:text-[10px] font-black text-amber-300">${isBusted ? 'OUT' : p.chips.toLocaleString()}</span>
              </div>
            </div>

            ${betChip}
          </div>
        `;
      }

      this.seatsContainer.appendChild(seatDiv);
    }

    if (this.currentEquities) {
      this.renderEquities(this.currentEquities);
    }
  }

  getBetPositionClass(uiIdx) {
    switch (uiIdx) {
      case 0: return '-top-6 left-1/2 -translate-x-1/2'; // Bas centre vers le pot
      case 1: return '-right-6 top-1/2 -translate-y-1/2'; // Bas gauche vers le centre
      case 2: return '-right-6 top-1/2 -translate-y-1/2'; // Haut gauche vers le centre
      case 3: return '-bottom-6 left-1/2 -translate-x-1/2'; // Haut centre vers le pot
      case 4: return '-left-6 top-1/2 -translate-y-1/2';  // Haut droite vers le centre
      case 5: return '-left-6 top-1/2 -translate-y-1/2';  // Bas droite vers le centre
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

  // Trouver l'élément DOM du siège d'un joueur
  getSeatElement(playerId) {
    if (!playerId || !this.seatsContainer) return null;
    return this.seatsContainer.querySelector(`[data-player-id="${playerId}"]`);
  }

  // Animation de jetons volants (mise vers pot ou pot vers joueur)
  flyChips(fromEl, toEl, onComplete = null) {
    if (!fromEl || !toEl) {
      if (onComplete) onComplete();
      return;
    }

    const rFrom = fromEl.getBoundingClientRect();
    const rTo = toEl.getBoundingClientRect();

    if (rFrom.width === 0 || rTo.width === 0) {
      if (onComplete) onComplete();
      return;
    }

    const startX = rFrom.left + rFrom.width / 2;
    const startY = rFrom.top + rFrom.height / 2;
    const endX = rTo.left + rTo.width / 2;
    const endY = rTo.top + rTo.height / 2;

    const chip = document.createElement('div');
    chip.className = 'flying-chip poker-chip chip-gold w-6 h-6 text-[10px] fixed z-50 pointer-events-none transition-all duration-500 ease-out flex items-center justify-center shadow-lg';
    chip.innerHTML = '★';
    chip.style.left = `${startX - 12}px`;
    chip.style.top = `${startY - 12}px`;
    document.body.appendChild(chip);

    if (window.soundFX) window.soundFX.playChip();

    // Force reflow
    void chip.offsetWidth;

    chip.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(1.15)`;
    chip.style.opacity = '1';

    setTimeout(() => {
      chip.remove();
      if (onComplete) onComplete();
    }, 520);
  }

  // Affichage des probabilités (%) All-In sur chaque joueur en lice
  renderEquities(equitiesMap) {
    this.currentEquities = equitiesMap;
    if (!equitiesMap) return;

    Object.keys(equitiesMap).forEach((pId) => {
      const pct = equitiesMap[pId];
      const seatEl = this.getSeatElement(pId);
      if (!seatEl) return;

      let badge = seatEl.querySelector('.equity-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'equity-badge absolute -top-3.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black tracking-wide bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 border border-yellow-200 shadow-lg shadow-yellow-500/50 z-30 animate-pulse transition-all duration-300';
        const targetPod = seatEl.querySelector('.hero-seat-pod') || seatEl.querySelector('.bot-seat-pod') || seatEl;
        targetPod.appendChild(badge);
      }
      badge.textContent = `${pct}%`;
      badge.style.display = 'block';
    });
  }

  clearEquities() {
    this.currentEquities = null;
    if (this.seatsContainer) {
      this.seatsContainer.querySelectorAll('.equity-badge').forEach((b) => b.remove());
    }
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

  // Présentation des cartes gagnantes à côté de la suite du board sur la table
  showWinnerShowcase(winnerName, holeCards = [], winningCombination = '') {
    const container = document.getElementById('winner-showcase-container');
    const labelEl = document.getElementById('winner-showcase-label');
    const cardsEl = document.getElementById('winner-showcase-cards');
    if (!container || !cardsEl || !holeCards || holeCards.length === 0) return;

    if (labelEl) {
      const desc = winningCombination ? `👑 ${winnerName} (${winningCombination})` : `👑 ${winnerName}`;
      labelEl.textContent = desc;
    }

    cardsEl.innerHTML = holeCards.map((cStr) => {
      return this.createCardHTML(cStr, true, true, 'board');
    }).join('');

    container.classList.remove('hidden');
    container.classList.add('flex');
  }

  clearWinnerShowcase() {
    const container = document.getElementById('winner-showcase-container');
    const cardsEl = document.getElementById('winner-showcase-cards');
    if (container) {
      container.classList.add('hidden');
      container.classList.remove('flex');
    }
    if (cardsEl) {
      cardsEl.innerHTML = '';
    }
  }
}

window.tableUI = new TableUI();
