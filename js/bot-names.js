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

window.BOT_ROSTER = BOT_ROSTER;
window.getRandomBots = getRandomBots;
