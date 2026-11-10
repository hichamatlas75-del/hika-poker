/**
 * Hika-Poker - Gestionnaire de Mode Tournoi (Sit & Go 6-Max)
 * Gère les paliers de blinds, l'élimination des joueurs et le podium.
 */

const TOURNAMENT_CONFIGS = {
  buyIn: 2500,
  startingChips: 3000,
  payouts: [0.65, 0.35], // 1er: 65%, 2ème: 35%
  levels: [
    { smallBlind: 25, bigBlind: 50, ante: 0 },
    { smallBlind: 50, bigBlind: 100, ante: 10 },
    { smallBlind: 100, bigBlind: 200, ante: 25 },
    { smallBlind: 200, bigBlind: 400, ante: 50 },
    { smallBlind: 400, bigBlind: 800, ante: 100 },
    { smallBlind: 800, bigBlind: 1600, ante: 200 }
  ],
  handsPerLevel: 3
};

class TournamentManager {
  constructor() {
    this.active = false;
    this.eliminated = []; // Liste chronologique des éliminés: [joueur1_sorti, ...]
    this.totalPlayers = 6;
    this.prizePool = TOURNAMENT_CONFIGS.buyIn * this.totalPlayers;
  }

  start(humanPlayer, botList) {
    this.active = true;
    this.eliminated = [];
    this.totalPlayers = 1 + botList.length;
    this.prizePool = TOURNAMENT_CONFIGS.buyIn * this.totalPlayers;

    this.updateHUD();
  }

  onPlayerBust(playerId, playerName) {
    if (!this.active) return;
    if (this.eliminated.some((e) => e.id === playerId)) return;

    const remaining = this.totalPlayers - this.eliminated.length;
    this.eliminated.push({ id: playerId, name: playerName, rank: remaining });

    this.updateHUD();

    // Si le joueur humain est éliminé
    if (playerId === 'player_user') {
      this.onHumanEliminated(remaining);
    }

    // S'il ne reste plus qu'un seul joueur : c'est le vainqueur !
    if (this.eliminated.length === this.totalPlayers - 1) {
      this.onTournamentEnd();
    }
  }

  onHumanEliminated(rank) {
    const prize = rank === 2 ? Math.round(this.prizePool * TOURNAMENT_CONFIGS.payouts[1]) : 0;
    if (window.storageManager) {
      window.storageManager.recordTournament({ won: false, rank, prize });
    }

    const modal = document.getElementById('tournament-result-modal');
    if (modal) {
      document.getElementById('tournament-result-title').textContent = rank <= 2 ? 'FÉLICITATIONS !' : 'ÉLIMINÉ';
      document.getElementById('tournament-result-rank').textContent = `${rank}e Place`;
      document.getElementById('tournament-result-prize').textContent = prize > 0 ? `+${prize.toLocaleString()} jetons` : 'Aucun gain';
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  onTournamentEnd() {
    const modal = document.getElementById('tournament-result-modal');
    if (modal) {
      const isWinner = !this.eliminated.some((e) => e.id === 'player_user');
      const rank = isWinner ? 1 : 2;
      const prize = isWinner ? Math.round(this.prizePool * TOURNAMENT_CONFIGS.payouts[0]) : 0;

      if (window.storageManager) {
        window.storageManager.recordTournament({ won: isWinner, rank, prize });
      }

      document.getElementById('tournament-result-title').textContent = isWinner ? '🏆 CHAMPION DU TOURNOI ! 🏆' : 'TOURNOI TERMINÉ';
      document.getElementById('tournament-result-rank').textContent = `${rank}ère Place`;
      document.getElementById('tournament-result-prize').textContent = prize > 0 ? `+${prize.toLocaleString()} jetons` : 'Gain déjà crédité';
      modal.classList.remove('hidden');
      modal.classList.add('flex');

      if (isWinner && window.soundFX) {
        window.soundFX.playWin();
      }
    }
    this.active = false;
  }

  updateHUD(level = 1, blinds = null) {
    const hud = document.getElementById('tournament-hud');
    if (!hud) return;

    if (!this.active) {
      hud.classList.add('hidden');
      return;
    }

    hud.classList.remove('hidden');
    const remainingCount = this.totalPlayers - this.eliminated.length;
    const remainingEl = document.getElementById('tourney-remaining');
    if (remainingEl) remainingEl.textContent = `${remainingCount}/${this.totalPlayers}`;

    const levelEl = document.getElementById('tourney-level');
    if (levelEl) levelEl.textContent = `Niveau ${level}`;

    const blindsEl = document.getElementById('tourney-blinds');
    if (blindsEl && blinds) {
      blindsEl.textContent = `${blinds.smallBlind}/${blinds.bigBlind}${blinds.ante ? ' (Ante ' + blinds.ante + ')' : ''}`;
    }
  }
}

window.tournamentManager = new TournamentManager();
window.TOURNAMENT_CONFIGS = TOURNAMENT_CONFIGS;
