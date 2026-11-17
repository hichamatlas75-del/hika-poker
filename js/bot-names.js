/**
 * Hika-Poker - Profils et Personnalités des Bots
 */

const BOT_ROSTER = [
  {
    name: 'Viktor "Shark"',
    avatarBg: 'from-amber-600 to-red-600',
    icon: '🦈',
    level: 'hard',
    chipsFactor: 1.0,
    title: 'High Roller'
  },
  {
    name: 'Sofia "Ace"',
    avatarBg: 'from-purple-600 to-indigo-600',
    icon: '👑',
    level: 'medium',
    chipsFactor: 1.0,
    title: 'Vegas Pro'
  },
  {
    name: 'Tony "GTO"',
    avatarBg: 'from-blue-600 to-cyan-600',
    icon: '🎯',
    level: 'hard',
    chipsFactor: 1.0,
    title: 'Math Wizard'
  },
  {
    name: 'Elena "Bluff"',
    avatarBg: 'from-emerald-600 to-teal-600',
    icon: '🦊',
    level: 'medium',
    chipsFactor: 1.0,
    title: 'Trickster'
  },
  {
    name: 'Sammy "Lucky"',
    avatarBg: 'from-pink-600 to-rose-600',
    icon: '🍀',
    level: 'easy',
    chipsFactor: 1.0,
    title: 'Action Player'
  },
  {
    name: 'Doyle "Cowboy"',
    avatarBg: 'from-amber-700 to-yellow-600',
    icon: '🤠',
    level: 'hard',
    chipsFactor: 1.0,
    title: 'Old School'
  },
  {
    name: 'Boris "Rock"',
    avatarBg: 'from-stone-600 to-slate-700',
    icon: '🛡️',
    level: 'medium',
    chipsFactor: 1.0,
    title: 'Tight Solid'
  },
  {
    name: 'Mia "Nitro"',
    avatarBg: 'from-fuchsia-600 to-purple-800',
    icon: '⚡',
    level: 'easy',
    chipsFactor: 1.0,
    title: 'Fast & Furious'
  }
];

const BOT_TAUNTS = {
  'Viktor "Shark"': {
    raise: ["Je sens l'hésitation...", "Tu veux vraiment voir la suite ?", "Une petite relance pour tester..."],
    allin: ["Tout au milieu ! Suis si tu l'oses.", "Le festin commence ! ALL-IN !", "C'est l'heure de payer ! 🦈"],
    fold: ["Je te laisse cette main.", "Bien joué, mais je t'attends au tournant.", "Trop cher pour ce spot."],
    win: ["Les jetons reviennent toujours au requin !", "Merci pour le pourboire !", "Lecture parfaite."],
    badbeat: ["Un coup de chance sur la river !", "Bien chatté celle-là...", "Tu as touché ton 2-outer ?!"]
  },
  'Sofia "Ace"': {
    raise: ["Vegas ne dort jamais !", "On monte les enchères !", "À toi de parler."],
    allin: ["Tapis ! Que la chance soit avec moi.", "Tous mes jetons sur le tapis !", "Rien ne va plus ! 👑"],
    fold: ["Discipline avant tout.", "Je garde mes jetons pour un meilleur spot.", "Je fold sans regret."],
    win: ["L'élégance à Vegas !", "Une main propre et sans bavure.", "C'était écrit."],
    badbeat: ["La variance est cruelle...", "Bien joué tout de même.", "Belle river !"]
  },
  'Tony "GTO"': {
    raise: ["Mathématiquement justifié.", "Les cotes imposent une relance.", "Équité maximale."],
    allin: ["Espérance de gain positive : All-in.", "100% de rentabilité ici !", "Tapis mathématique ! 🎯"],
    fold: ["Les cotes du pot sont insuffisantes.", "Fold théoriquement correct.", "Trop d'asymétrie de risque."],
    win: ["La théorie gagne toujours.", "Calculs exacts.", "Q.E.D."],
    badbeat: ["Statistiquement improbable...", "3% de chance et ça rentre...", "La beauté des probas !"]
  },
  'Elena "Bluff"': {
    raise: ["Tu penses que je bluffe ?", "Ose payer pour voir !", "Juste un petit mensonge... 🦊"],
    allin: ["Tu as le courage de payer ?", "Tout dedans ! Monstre ou bluff ?", "Fais confiance à ton instinct !"],
    fold: ["Tu m'as eue !", "Pas mal, tu as flairé le coup.", "Je reviendrai..."],
    win: ["Tu as payé ? Grosse erreur !", "Le renard a encore frappé !", "C'était un régal !"],
    badbeat: ["Argh, pris à mon propre piège !", "Bien vu !", "Aïe, ça pique !"]
  },
  'Sammy "Lucky"': {
    raise: ["Je le sens super bien !", "Pourquoi pas une relance ?", "Allez, on s'amuse ! 🍀"],
    allin: ["LA ROUE TOURNE ! ALL-IN !", "J'y crois à 100% !", "Tous les jetons sur un coup !"],
    fold: ["Oups, pas de chance là.", "Je passe mon tour !", "Trop cher pour moi."],
    win: ["La chance me sourit encore !", "J'en étais sûr !", "BINGO ! 🪙"],
    badbeat: ["Oh non, mon trèfle m'a lâché...", "Bravo à toi !", "Pas mon jour !"]
  },
  'Doyle "Cowboy"': {
    raise: ["Attache ta ceinture, partenaire !", "Texas Hold'em à l'ancienne !", "On va voir qui a du cran ! 🤠"],
    allin: ["Yee-haw ! TOUT DEDANS !", "Je pousse le saloon entier !", "On met les bottes sur la table !"],
    fold: ["Le vieux cowboy sait quand s'arrêter.", "Pas cette fois l'ami.", "Trop dangereux pour moi."],
    win: ["Comme dans le bon vieux temps !", "Ça c'est du poker texan !", "Merci bien l'ami !"],
    badbeat: ["Sacré coup de fusil !", "Un hold-up en plein jour !", "Bien joué cow-boy."]
  },
  'Boris "Rock"': {
    raise: ["Une relance solide.", "Pas de place pour le hasard.", "Attention aux rochers."],
    allin: ["Mes jetons sont au centre.", "J'ai la main qu'il faut.", "Inébranlable ! 🛡️"],
    fold: ["Je jette sans hésiter.", "Prudence est mère de sûreté.", "Trop d'agression."],
    win: ["La patience paie toujours.", "Solidité récompensée.", "Rien ne traverse ce mur."],
    badbeat: ["Même le roc peut se fendre...", "Coup dur.", "Bien joué."]
  },
  'Mia "Nitro"': {
    raise: ["Plus vite, plus fort !", "On accélère la cadence !", "Plein gaz ! ⚡"],
    allin: ["TURBO ALL-IN !", "Pas de temps à perdre !", "C'est tout ou rien !"],
    fold: ["Next hand !", "Trop lent, je passe.", "On rejoue vite !"],
    win: ["Victoire éclair !", "Trop rapide pour vous !", "Nitro boost !"],
    badbeat: ["Crash à pleine vitesse !", "Ouch, ça décoiffe !", "Revanche immédiate !"]
  }
};

function getRandomBots(count = 5) {
  const shuffled = BOT_ROSTER.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((b, idx) => ({
    id: 'bot_' + (idx + 1),
    name: b.name,
    isBot: true,
    botLevel: b.level,
    avatar: b.icon,
    avatarBg: b.avatarBg,
    title: b.title
  }));
}

function getBotTaunt(botName, eventType = 'raise') {
  const taunts = BOT_TAUNTS[botName];
  if (!taunts || !taunts[eventType] || taunts[eventType].length === 0) {
    const generic = {
      raise: ["Je relance !", "On monte le pot !", "À toi de jouer !"],
      allin: ["TAPIS !", "Tout au milieu !", "All-in !"],
      fold: ["Je me couche.", "Trop cher...", "Passe."],
      win: ["Joli coup pour moi !", "Merci !", "Gagné !"],
      badbeat: ["Incroyable...", "Bien joué !", "Aïe..."]
    };
    const list = generic[eventType] || ["..."];
    return list[Math.floor(Math.random() * list.length)];
  }
  const list = taunts[eventType];
  return list[Math.floor(Math.random() * list.length)];
}

window.BOT_ROSTER = BOT_ROSTER;
window.BOT_TAUNTS = BOT_TAUNTS;
window.getRandomBots = getRandomBots;
window.getBotTaunt = getBotTaunt;

