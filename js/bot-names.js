/**
 * Hika-Poker - Profils et Personnalités des Bots
 */

const BOT_ROSTER = [
  {
    name: 'Boris "T-Rex"',
    avatarBg: 'from-blue-900 via-indigo-950 to-slate-950',
    icon: 'vip-zynga-trex',
    level: 'hard',
    chipsFactor: 1.0,
    title: 'Jurassic Roar'
  },
  {
    name: 'Mia "Eagle"',
    avatarBg: 'from-amber-600 via-emerald-800 to-slate-950',
    icon: 'vip-zynga-eagle',
    level: 'hard',
    chipsFactor: 1.0,
    title: 'American Eagle'
  },
  {
    name: 'Tony "Shadow"',
    avatarBg: 'from-slate-900 via-teal-950 to-cyan-950',
    icon: 'vip-zynga-noir-lady',
    level: 'hard',
    chipsFactor: 1.0,
    title: 'Noir Fedora'
  },
  {
    name: 'Sofia "Dealer"',
    avatarBg: 'from-emerald-700 via-teal-900 to-slate-950',
    icon: 'vip-zynga-dealer',
    level: 'medium',
    chipsFactor: 1.0,
    title: 'Croupière VIP'
  },
  {
    name: 'Sammy "Pumpkin"',
    avatarBg: 'from-amber-600 via-orange-700 to-slate-950',
    icon: 'vip-zynga-pumpkin',
    level: 'easy',
    chipsFactor: 1.0,
    title: 'Jack-o-Lantern'
  },
  {
    name: 'Elena "Witch"',
    avatarBg: 'from-purple-900 via-violet-950 to-slate-950',
    icon: 'vip-zynga-witch',
    level: 'medium',
    chipsFactor: 1.0,
    title: 'Sorcière Gothique'
  },
  {
    name: 'Viktor "Shark"',
    avatarBg: 'from-amber-600 via-blue-900 to-slate-950',
    icon: 'vip-golden-shark',
    level: 'hard',
    chipsFactor: 1.0,
    title: 'Golden Shark'
  },
  {
    name: 'Doyle "Cowboy"',
    avatarBg: 'from-amber-700 via-yellow-700 to-slate-950',
    icon: 'vip-texas-cowboy',
    level: 'hard',
    chipsFactor: 1.0,
    title: 'Texas Legend'
  }
];

const BOT_TAUNTS = {
  'Boris "T-Rex"': {
    raise: ["ROOOAAAR ! Mes jetons sont au centre.", "La mâchoire du T-Rex se referme !", "Tu penses intimider un dinosaure ? 🦖"],
    allin: ["IMPACT JURASSIQUE ! ALL-IN !", "Un séisme de jetons ! Suis si tu l'oses !", "EXTINCTION IMMINENTE ! 🦖"],
    fold: ["Le prédateur temporise.", "Même le T-Rex sait quand chasser ailleurs.", "Je reviendrai rugir !"],
    win: ["ROAAAAR ! Le roi du Crétacé dévore le pot !", "Aucun adversaire ne survit à mes crocs !", "Un festin royal ! 🦖"],
    badbeat: ["Un météore sur la river ?!", "Incroyable coup de chance...", "Le dinosaure n'a pas dit son dernier mot !"]
  },
  'Mia "Eagle"': {
    raise: ["L'aigle fond sur sa proie !", "Vision perçante, aucun bluff ne m'échappe !", "Une relance digne des sommets ! 🦅"],
    allin: ["Vol en piqué ! ALL-IN !", "Mon envergure couvre tout le tapis !", "Tu n'échapperas pas aux serres de l'aigle ! 🦅"],
    fold: ["L'aigle plane et attend son heure.", "Pas de proie facile ici, je replie mes ailes.", "Trop de turbulences."],
    win: ["Le maître des cieux rafle la mise !", "Une prise magistrale !", "L'aigle règne sur la table ! 🦅"],
    badbeat: ["Une rafale de vent contraire !", "Bien esquivé...", "Tu as eu chaud aux plumes !"]
  },
  'Tony "Shadow"': {
    raise: ["L'ombre de Vegas s'étend...", "Mon feutre cache mon regard, mais mes jetons parlent !", "Relance millimétrée. 🕶️"],
    allin: ["Dans la nuit noire, tapis !", "Pas de témoin, tout au milieu !", "Dénouement sous les néons ! 🎯"],
    fold: ["Je me retire dans l'obscurité.", "Discipline de l'ombre.", "Rendez-vous à la prochaine main."],
    win: ["La nuit appartient à ceux qui savent attendre.", "Un hold-up parfait.", "Le casino s'incline. ♠️"],
    badbeat: ["Un coup dans le dos sur la river...", "Bien joué, tu as de la chance.", "La nuit sera longue..."]
  },
  'Sofia "Dealer"': {
    raise: ["La croupière monte les enchères ! 💖", "Vegas ne dort jamais !", "À vous de jouer, messieurs dames !"],
    allin: ["Faites vos jeux, rien ne va plus ! ALL-IN !", "Tout le casino retient son souffle !", "La chance sourit aux audacieux ! ✨"],
    fold: ["Discipline et sourire, je fold.", "Je préserve mes jetons pour un coup parfait.", "Passe avec élégance."],
    win: ["L'élégance du casino triomphe !", "Merci pour cette belle main !", "Une distribution parfaite ! 💖"],
    badbeat: ["La variance fait le charme du jeu !", "Superbe coup de votre part !", "Bien joué !"]
  },
  'Sammy "Pumpkin"': {
    raise: ["La flamme d'Halloween s'embrase ! 🎃", "Frissons garantis sur cette relance !", "Un bonbon ou un mauvais tour ?"],
    allin: ["FESTIVAL DE L'ÉPOUVANTE ! ALL-IN !", "Flammes bleues au milieu !", "Es-tu prêt à affronter Jack-o'-Lantern ?! 🎃"],
    fold: ["La flamme vacille... je passe.", "Pas d'esprit farceur sur ce coup.", "Je me terre dans mon potager."],
    win: ["Bouh ! Le pot est pour Jack ! 🎃", "Une citrouille remplie de jetons d'or !", "Régal d'Halloween !"],
    badbeat: ["Ma citrouille s'est écrasée !", "Quel coup diabolique !", "Bien chatté petit monstre !"]
  },
  'Elena "Witch"': {
    raise: ["Un sortilège sur le flop... 🧙‍♀️", "Tu as le courage de défier mes maléfices ?", "Mes potions sont infusées de jetons !"],
    allin: ["ABRACADABRA ! ALL-IN !", "Magie noire au milieu de la table !", "Tous tes jetons vont disparaître dans mon chaudron ! 🔮"],
    fold: ["Mes cartes murmurent de la prudence.", "La pleine lune n'est pas encore là.", "Je disparais dans la brume..."],
    win: ["La sorcellerie opère à merveille !", "Tous tes jetons sont envoûtés !", "Rire démoniaque... C'était écrit ! 🔮"],
    badbeat: ["Mon miroir magique m'a menti !", "Un contre-sort bien placé...", "Aïe, ça pique ma magie !"]
  },
  'Viktor "Shark"': {
    raise: ["Je sens l'hésitation...", "Tu veux vraiment voir la suite ?", "Une petite relance pour tester..."],
    allin: ["Tout au milieu ! Suis si tu l'oses.", "Le festin commence ! ALL-IN !", "C'est l'heure de payer ! 🦈"],
    fold: ["Je te laisse cette main.", "Bien joué, mais je t'attends au tournant.", "Trop cher pour ce spot."],
    win: ["Les jetons reviennent toujours au requin !", "Merci pour le pourboire !", "Lecture parfaite. 🦈"],
    badbeat: ["Un coup de chance sur la river !", "Bien chatté celle-là...", "Tu as touché ton 2-outer ?!"]
  },
  'Doyle "Cowboy"': {
    raise: ["Attache ta ceinture, partenaire !", "Texas Hold'em à l'ancienne !", "On va voir qui a du cran ! 🤠"],
    allin: ["Yee-haw ! TOUT DEDANS !", "Je pousse le saloon entier !", "On met les bottes sur la table ! 🤠"],
    fold: ["Le vieux cowboy sait quand s'arrêter.", "Pas cette fois l'ami.", "Trop dangereux pour moi."],
    win: ["Comme dans le bon vieux temps !", "Ça c'est du poker texan !", "Merci bien l'ami !"],
    badbeat: ["Sacré coup de fusil !", "Un hold-up en plein jour !", "Bien joué cow-boy."]
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

