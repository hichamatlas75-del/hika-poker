/**
 * Hika-Poker - Galerie d'Avatars VIP & Croupiers Style Zynga Poker
 * Avatars vectoriels SVG animés haute définition, sans aucune dépendance externe.
 * Prise en charge des avatars VIP animés et des 16 émojis classiques.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HikaAvatars = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const CLASSIC_EMOJIS = ['👑', '🤠', '🦁', '🦈', '🕶️', '🎩', '💎', '🦊', '🤖', '🧙', '🐺', '🚀', '🔥', '🐯', '⚡', '🐉'];

  const AVATAR_PRESETS = [
    {
      id: 'vip-croupier',
      name: 'Croupier Pro',
      tag: 'CROUPIER',
      title: 'Maître de Table VIP',
      bgGradient: 'from-amber-600 via-yellow-500 to-amber-700',
      badgeColor: 'bg-emerald-500 text-slate-950',
      svg: `<svg viewBox="0 0 64 64" class="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cr-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stop-color="#064e3b"/>
            <stop offset="1" stop-color="#022c22"/>
          </linearGradient>
          <linearGradient id="cr-vest" x1="16" y1="36" x2="48" y2="60" gradientUnits="userSpaceOnUse">
            <stop stop-color="#1e293b"/>
            <stop offset="1" stop-color="#0f172a"/>
          </linearGradient>
          <linearGradient id="cr-gold" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#fef08a"/>
            <stop offset="0.5" stop-color="#eab308"/>
            <stop offset="1" stop-color="#ca8a04"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#cr-bg)" stroke="url(#cr-gold)" stroke-width="2.5"/>
        <!-- Chemise et col -->
        <path d="M22 62 L22 44 L32 50 L42 44 L42 62 Z" fill="#f8fafc"/>
        <path d="M26 42 L32 49 L38 42 L32 37 Z" fill="#e2e8f0"/>
        <!-- Noeud papillon carmin -->
        <path d="M27 42 L32 45 L27 48 Z M37 42 L32 45 L37 48 Z" fill="#dc2626"/>
        <circle cx="32" cy="45" r="2" fill="#991b1b"/>
        <!-- Gilet noir de croupier -->
        <path d="M14 62 L22 44 L29 55 L29 62 Z" fill="url(#cr-vest)"/>
        <path d="M50 62 L42 44 L35 55 L35 62 Z" fill="url(#cr-vest)"/>
        <!-- Boutons dorés -->
        <circle cx="32" cy="54" r="1.5" fill="url(#cr-gold)"/>
        <circle cx="32" cy="59" r="1.5" fill="url(#cr-gold)"/>
        <!-- Tête & Cou -->
        <path d="M29 38 L29 44 L35 44 L35 38 Z" fill="#fbcfe8"/>
        <circle cx="32" cy="27" r="13" fill="#fbcfe8"/>
        <!-- Cheveux gominés -->
        <path d="M19 24 C20 15 28 12 36 13 C43 14 45 19 45 23 C42 20 37 19 32 19 C25 19 21 21 19 24 Z" fill="#1e1b4b"/>
        <!-- Yeux & Sourcils -->
        <ellipse cx="27" cy="26" rx="2" ry="2.2" fill="#1e293b"/>
        <ellipse cx="37" cy="26" rx="2" ry="2.2" fill="#1e293b"/>
        <circle cx="26.5" cy="25.5" r="0.7" fill="#fff"/>
        <circle cx="36.5" cy="25.5" r="0.7" fill="#fff"/>
        <path d="M25 22 Q27 21 29 22" stroke="#0f172a" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M35 22 Q37 21 39 22" stroke="#0f172a" stroke-width="1.2" stroke-linecap="round"/>
        <!-- Sourire confiant -->
        <path d="M29 32 Q32 35 35 32" stroke="#9f1239" stroke-width="1.4" stroke-linecap="round" fill="none"/>
        <!-- Cartes en éventail tenu en main gauche -->
        <g transform="translate(42, 38) rotate(15)">
          <rect x="0" y="0" width="11" height="15" rx="1.5" fill="#fff" stroke="#cbd5e1" stroke-width="0.8"/>
          <text x="2" y="5" font-size="4" font-weight="900" fill="#dc2626">A</text>
          <text x="5.5" y="10" font-size="6" fill="#dc2626" text-anchor="middle">♥</text>
        </g>
      </svg>`
    },
    {
      id: 'vip-lady-poker',
      name: 'Lady Poker VIP',
      tag: 'VIP GOLD',
      title: 'Reine des High Stakes',
      bgGradient: 'from-pink-600 via-purple-600 to-indigo-800',
      badgeColor: 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black',
      svg: `<svg viewBox="0 0 64 64" class="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lp-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stop-color="#581c87"/>
            <stop offset="1" stop-color="#1e1b4b"/>
          </linearGradient>
          <linearGradient id="lp-gold" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#fef08a"/>
            <stop offset="0.5" stop-color="#f59e0b"/>
            <stop offset="1" stop-color="#b45309"/>
          </linearGradient>
          <linearGradient id="lp-hair" x1="16" y1="12" x2="48" y2="50" gradientUnits="userSpaceOnUse">
            <stop stop-color="#9a3412"/>
            <stop offset="0.7" stop-color="#7c2d12"/>
            <stop offset="1" stop-color="#431407"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#lp-bg)" stroke="url(#lp-gold)" stroke-width="2.5"/>
        <!-- Robe de soirée échancrée -->
        <path d="M12 62 C16 48 24 44 26 44 L32 52 L38 44 C40 44 48 48 52 62 Z" fill="#831843"/>
        <!-- Collier diamant scintillant -->
        <path d="M26 44 Q32 50 38 44" stroke="url(#lp-gold)" stroke-width="1.5" fill="none"/>
        <polygon points="32,49 34.5,52 32,55 29.5,52" fill="#38bdf8">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="1.8s" repeatCount="indefinite"/>
        </polygon>
        <!-- Cheveux volumineux auburn -->
        <path d="M17 38 C15 22 18 12 32 12 C46 12 49 22 47 38 C44 46 41 54 44 60 C38 60 38 48 38 42 C38 34 26 34 26 42 C26 48 26 60 20 60 C23 54 20 46 17 38 Z" fill="url(#lp-hair)"/>
        <!-- Visage -->
        <circle cx="32" cy="28" r="11" fill="#fde2e4"/>
        <!-- Diadème d'Or Royal avec Rubis -->
        <path d="M23 18 L26 13 L32 17 L38 13 L41 18 Z" fill="url(#lp-gold)"/>
        <circle cx="32" cy="15" r="1.5" fill="#e11d48"/>
        <circle cx="26" cy="14" r="1" fill="#38bdf8"/>
        <circle cx="38" cy="14" r="1" fill="#38bdf8"/>
        <!-- Regard charmeur & Fard à paupières -->
        <ellipse cx="28" cy="27" rx="2.5" ry="1.8" fill="#581c87" opacity="0.3"/>
        <ellipse cx="36" cy="27" rx="2.5" ry="1.8" fill="#581c87" opacity="0.3"/>
        <ellipse cx="28" cy="27.5" rx="1.8" ry="1.8" fill="#0284c7"/>
        <ellipse cx="36" cy="27.5" rx="1.8" ry="1.8" fill="#0284c7"/>
        <circle cx="27.5" cy="27" r="0.6" fill="#fff"/>
        <circle cx="35.5" cy="27" r="0.6" fill="#fff"/>
        <path d="M26 24.5 Q28 23 30 25" stroke="#18181b" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M34 25 Q36 23 38 24.5" stroke="#18181b" stroke-width="1.2" stroke-linecap="round"/>
        <!-- Lèvres carmin séduisantes -->
        <path d="M29 33 Q32 36 35 33 Q32 34 29 33" fill="#be123c"/>
        <!-- Boucle d'oreille saphir -->
        <circle cx="21" cy="32" r="1.8" fill="#0284c7" stroke="url(#lp-gold)" stroke-width="0.8"/>
        <circle cx="43" cy="32" r="1.8" fill="#0284c7" stroke="url(#lp-gold)" stroke-width="0.8"/>
      </svg>`
    },
    {
      id: 'vip-high-roller',
      name: 'High Roller',
      tag: 'MACAU VIP',
      title: 'Magnat des Hautes Limites',
      bgGradient: 'from-amber-700 via-slate-900 to-black',
      badgeColor: 'bg-amber-400 text-slate-950 font-black',
      svg: `<svg viewBox="0 0 64 64" class="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hr-bg" x1="0" y1="0" x2="64" y2="64">
            <stop stop-color="#18181b"/>
            <stop offset="1" stop-color="#09090b"/>
          </linearGradient>
          <linearGradient id="hr-gold" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#fde047"/>
            <stop offset="0.5" stop-color="#eab308"/>
            <stop offset="1" stop-color="#854d0e"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#hr-bg)" stroke="url(#hr-gold)" stroke-width="2.5"/>
        <!-- Smoking noir satiné -->
        <path d="M12 62 L20 42 L32 54 L44 42 L52 62 Z" fill="#09090b"/>
        <path d="M20 42 L26 62 L38 62 L44 42 L32 50 Z" fill="#f8fafc"/>
        <!-- Cravate dorée en soie -->
        <path d="M30 45 L34 45 L33 58 L32 60 L31 58 Z" fill="url(#hr-gold)"/>
        <!-- Rose rouge au revers du veston -->
        <circle cx="21" cy="48" r="2.5" fill="#b91c1c"/>
        <circle cx="21" cy="48" r="1.2" fill="#ef4444"/>
        <!-- Tête & Nuque -->
        <circle cx="32" cy="27" r="12" fill="#fed7aa"/>
        <!-- Coupe courte gominée slick-back -->
        <path d="M20 22 C21 13 30 11 38 12 C44 13 45 18 45 23 C40 18 30 17 20 22 Z" fill="#27272a"/>
        <!-- Lunettes de soleil dorées aviateur VIP avec reflets de poker -->
        <rect x="22" y="24" width="9" height="7" rx="2" fill="#0f172a" stroke="url(#hr-gold)" stroke-width="1.2"/>
        <rect x="33" y="24" width="9" height="7" rx="2" fill="#0f172a" stroke="url(#hr-gold)" stroke-width="1.2"/>
        <line x1="31" y1="26" x2="33" y2="26" stroke="url(#hr-gold)" stroke-width="1.5"/>
        <!-- Reflet néon doré dans les verres -->
        <path d="M23 29 L29 25" stroke="#fef08a" stroke-width="1" stroke-linecap="round" opacity="0.8"/>
        <path d="M34 29 L40 25" stroke="#fef08a" stroke-width="1" stroke-linecap="round" opacity="0.8"/>
        <!-- Barbe de 3 jours soignée -->
        <path d="M25 31 Q32 38 39 31 Q32 40 25 31" fill="#713f12" opacity="0.4"/>
        <line x1="29" y1="34" x2="35" y2="34" stroke="#451a03" stroke-width="1.2" stroke-linecap="round"/>
        <!-- Cigare cubain fumant -->
        <g transform="translate(35, 34) rotate(-15)">
          <rect x="0" y="0" width="10" height="2.5" rx="0.5" fill="#78350f"/>
          <rect x="0" y="0" width="3" height="2.5" fill="url(#hr-gold)"/>
          <circle cx="10" cy="1.25" r="1.2" fill="#ef4444">
            <animate attributeName="fill" values="#ef4444;#f97316;#ef4444" dur="1.2s" repeatCount="indefinite"/>
          </circle>
        </g>
      </svg>`
    },
    {
      id: 'vip-golden-shark',
      name: 'Requin VIP',
      tag: 'SHARK',
      title: 'Terreur des Tournois',
      bgGradient: 'from-cyan-900 via-blue-950 to-slate-950',
      badgeColor: 'bg-cyan-400 text-slate-950 font-black',
      svg: `<svg viewBox="0 0 64 64" class="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sh-bg" x1="0" y1="0" x2="64" y2="64">
            <stop stop-color="#083344"/>
            <stop offset="1" stop-color="#020617"/>
          </linearGradient>
          <linearGradient id="sh-body" x1="16" y1="12" x2="48" y2="40">
            <stop stop-color="#38bdf8"/>
            <stop offset="0.6" stop-color="#0284c7"/>
            <stop offset="1" stop-color="#0369a1"/>
          </linearGradient>
          <linearGradient id="sh-gold" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#fde047"/>
            <stop offset="0.5" stop-color="#eab308"/>
            <stop offset="1" stop-color="#a16207"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#sh-bg)" stroke="url(#sh-gold)" stroke-width="2.5"/>
        <!-- Costume d'homme d'affaires rayé -->
        <path d="M14 62 L22 42 L32 52 L42 42 L50 62 Z" fill="#0f172a"/>
        <path d="M24 42 L28 62 L36 62 L40 42 L32 48 Z" fill="#f8fafc"/>
        <path d="M30 46 L34 46 L33 60 L31 60 Z" fill="#0284c7"/>
        <!-- Tête de requin affûtée -->
        <path d="M32 10 C22 16 20 28 20 38 C26 38 28 40 32 40 C36 40 38 38 44 38 C44 28 42 16 32 10 Z" fill="url(#sh-body)"/>
        <!-- Ventre blanc requin -->
        <path d="M27 34 C27 26 32 20 32 20 C32 20 37 26 37 34 C37 38 34 39 32 39 C30 39 27 38 27 34 Z" fill="#f0f9ff"/>
        <!-- Aileron dorsal supérieur -->
        <path d="M32 8 L29 18 L35 18 Z" fill="#0369a1"/>
        <!-- Lunettes de soleil requin -->
        <path d="M21 24 Q32 21 43 24 L42 30 Q32 27 22 30 Z" fill="#020617" stroke="url(#sh-gold)" stroke-width="1.2"/>
        <circle cx="27" cy="27" r="1" fill="#38bdf8"/>
        <circle cx="37" cy="27" r="1" fill="#38bdf8"/>
        <!-- Dents en or acérées étincelantes -->
        <path d="M24 35 Q32 38 40 35" stroke="#020617" stroke-width="1.5" fill="none"/>
        <polygon points="26,35 28,38 27,35" fill="url(#sh-gold)"/>
        <polygon points="29,36 31,39 30,36" fill="#fff"/>
        <polygon points="32,36 34,40 33,36" fill="url(#sh-gold)"/>
        <polygon points="35,36 37,39 36,36" fill="#fff"/>
        <polygon points="38,35 40,38 39,35" fill="url(#sh-gold)"/>
        <!-- Étincelle sur la dent en or -->
        <circle cx="33" cy="38" r="1" fill="#ffffff">
          <animate attributeName="r" values="0.5;1.5;0.5" dur="1.5s" repeatCount="indefinite"/>
        </circle>
      </svg>`
    },
    {
      id: 'vip-cyborg-dealer',
      name: 'Cyborg 2077',
      tag: 'CYBER VIP',
      title: 'IA Dealer Imbattable',
      bgGradient: 'from-cyan-500 via-indigo-900 to-black',
      badgeColor: 'bg-gradient-to-r from-cyan-400 to-teal-300 text-slate-950 font-black',
      svg: `<svg viewBox="0 0 64 64" class="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cy-bg" x1="0" y1="0" x2="64" y2="64">
            <stop stop-color="#020617"/>
            <stop offset="0.6" stop-color="#0f172a"/>
            <stop offset="1" stop-color="#083344"/>
          </linearGradient>
          <linearGradient id="cy-neon" x1="0" y1="0" x2="1" y2="0">
            <stop stop-color="#06b6d4"/>
            <stop offset="0.5" stop-color="#22d3ee"/>
            <stop offset="1" stop-color="#a855f7"/>
          </linearGradient>
          <linearGradient id="cy-metal" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#94a3b8"/>
            <stop offset="0.5" stop-color="#64748b"/>
            <stop offset="1" stop-color="#334155"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#cy-bg)" stroke="url(#cy-neon)" stroke-width="2.5"/>
        <!-- Armure cybernétique col haut -->
        <path d="M14 62 L22 46 L32 52 L42 46 L50 62 Z" fill="#0f172a" stroke="#06b6d4" stroke-width="1"/>
        <line x1="32" y1="52" x2="32" y2="62" stroke="#22d3ee" stroke-width="1.5"/>
        <!-- Tête cybernétique argentée -->
        <circle cx="32" cy="28" r="12" fill="url(#cy-metal)"/>
        <!-- Circuits électroniques dorés sur la tempe -->
        <path d="M22 25 L26 25 L28 22 L30 22" stroke="#facc15" stroke-width="1" fill="none"/>
        <circle cx="22" cy="25" r="1" fill="#facc15"/>
        <path d="M42 25 L38 25 L36 22 L34 22" stroke="#facc15" stroke-width="1" fill="none"/>
        <circle cx="42" cy="25" r="1" fill="#facc15"/>
        <!-- Visière néon cyberpunk cyan pulsante -->
        <rect x="21" y="24" width="22" height="6.5" rx="2" fill="#083344" stroke="#22d3ee" stroke-width="1.5"/>
        <rect x="23" y="26" width="18" height="2.5" rx="1" fill="url(#cy-neon)">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="1s" repeatCount="indefinite"/>
        </rect>
        <!-- Casque audio / émetteur VIP -->
        <rect x="18" y="24" width="3" height="9" rx="1.5" fill="#06b6d4"/>
        <rect x="43" y="24" width="3" height="9" rx="1.5" fill="#06b6d4"/>
        <!-- Symbole As holographique sur le front -->
        <text x="32" y="20" font-size="5" font-weight="900" fill="#22d3ee" text-anchor="middle">♠</text>
      </svg>`
    },
    {
      id: 'vip-el-padrino',
      name: 'El Padrino',
      tag: 'MAFIA',
      title: 'Parrain de Las Vegas',
      bgGradient: 'from-red-950 via-zinc-900 to-black',
      badgeColor: 'bg-red-600 text-white font-black',
      svg: `<svg viewBox="0 0 64 64" class="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ep-bg" x1="0" y1="0" x2="64" y2="64">
            <stop stop-color="#450a0a"/>
            <stop offset="1" stop-color="#09090b"/>
          </linearGradient>
          <linearGradient id="ep-gold" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#fef08a"/>
            <stop offset="0.5" stop-color="#eab308"/>
            <stop offset="1" stop-color="#854d0e"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#ep-bg)" stroke="url(#ep-gold)" stroke-width="2.5"/>
        <!-- Veston à rayures mafia -->
        <path d="M12 62 L20 44 L32 54 L44 44 L52 62 Z" fill="#18181b"/>
        <line x1="16" y1="62" x2="22" y2="48" stroke="#3f3f46" stroke-width="0.8"/>
        <line x1="48" y1="62" x2="42" y2="48" stroke="#3f3f46" stroke-width="0.8"/>
        <!-- Chemise rouge & cravate noire -->
        <path d="M22 44 L32 52 L42 44 Z" fill="#991b1b"/>
        <path d="M31 48 L33 48 L32 62 Z" fill="#09090b"/>
        <!-- Tête & Joues carrées -->
        <circle cx="32" cy="30" r="11" fill="#fed7aa"/>
        <!-- Moustache italienne sculptée -->
        <path d="M26 35 Q29 33 32 35 Q35 33 38 35 Q32 37 26 35 Z" fill="#1c1917"/>
        <!-- Yeux perçants sous le chapeau -->
        <ellipse cx="28" cy="29" rx="1.5" ry="1.2" fill="#1c1917"/>
        <ellipse cx="36" cy="29" rx="1.5" ry="1.2" fill="#1c1917"/>
        <!-- Chapeau Fedora feutre noir à ruban pourpre -->
        <path d="M18 24 Q32 20 46 24 L48 26 Q32 23 16 26 Z" fill="#09090b"/>
        <path d="M22 24 C22 14 26 12 32 12 C38 12 42 14 42 24 Z" fill="#18181b"/>
        <rect x="22" y="21" width="20" height="3" fill="#dc2626"/>
        <circle cx="23" cy="22.5" r="1" fill="url(#ep-gold)"/>
      </svg>`
    },
    {
      id: 'vip-vegas-magician',
      name: 'Magicien Vegas',
      tag: 'MAGIE',
      title: 'Illusionniste des Piques',
      bgGradient: 'from-purple-900 via-indigo-950 to-black',
      badgeColor: 'bg-purple-500 text-white font-black',
      svg: `<svg viewBox="0 0 64 64" class="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="vm-bg" x1="0" y1="0" x2="64" y2="64">
            <stop stop-color="#3b0764"/>
            <stop offset="1" stop-color="#030712"/>
          </linearGradient>
          <linearGradient id="vm-gold" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#fef08a"/>
            <stop offset="0.5" stop-color="#eab308"/>
            <stop offset="1" stop-color="#a16207"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#vm-bg)" stroke="url(#vm-gold)" stroke-width="2.5"/>
        <!-- Cape pourpre royale à revers or -->
        <path d="M12 62 C16 46 22 42 26 42 L32 50 L38 42 C42 42 48 46 52 62 Z" fill="#4c1d95"/>
        <path d="M26 42 L32 49 L38 42 Z" fill="#faf5ff"/>
        <path d="M30 45 L34 45 L32 55 Z" fill="#e11d48"/>
        <!-- Tête -->
        <circle cx="32" cy="29" r="10.5" fill="#fde2e4"/>
        <!-- Yeux mystérieux violets -->
        <ellipse cx="28" cy="28" rx="1.8" ry="1.5" fill="#9333ea"/>
        <ellipse cx="36" cy="28" rx="1.8" ry="1.5" fill="#9333ea"/>
        <circle cx="27.5" cy="27.5" r="0.6" fill="#fff"/>
        <circle cx="35.5" cy="27.5" r="0.6" fill="#fff"/>
        <!-- Haut-de-forme géant magique -->
        <ellipse cx="32" cy="22" rx="16" ry="3" fill="#09090b"/>
        <path d="M22 22 L23 8 L41 8 L42 22 Z" fill="#18181b"/>
        <rect x="22.5" y="18" width="19" height="3" fill="url(#vm-gold)"/>
        <!-- As de Pique magique coincé dans le ruban -->
        <g transform="translate(37, 10) rotate(18)">
          <rect x="0" y="0" width="7" height="10" rx="1" fill="#fff" stroke="#9333ea" stroke-width="0.8"/>
          <text x="3.5" y="7" font-size="5" fill="#0f172a" text-anchor="middle">♠</text>
        </g>
        <!-- Étoile magique étincelante -->
        <polygon points="16,16 17.5,19 20,20 17.5,21 16,24 14.5,21 12,20 14.5,19" fill="#fde047">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" repeatCount="indefinite"/>
        </polygon>
      </svg>`
    },
    {
      id: 'vip-queen-hearts',
      name: 'Reine des Cœurs',
      tag: 'ROYAL',
      title: 'Monarque du Flop',
      bgGradient: 'from-rose-600 via-red-900 to-black',
      badgeColor: 'bg-rose-500 text-white font-black',
      svg: `<svg viewBox="0 0 64 64" class="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="qh-bg" x1="0" y1="0" x2="64" y2="64">
            <stop stop-color="#881337"/>
            <stop offset="1" stop-color="#1f0208"/>
          </linearGradient>
          <linearGradient id="qh-gold" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#fef08a"/>
            <stop offset="0.5" stop-color="#f59e0b"/>
            <stop offset="1" stop-color="#b45309"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#qh-bg)" stroke="url(#qh-gold)" stroke-width="2.5"/>
        <!-- Robe royale velours rouge -->
        <path d="M14 62 C16 46 22 42 26 42 L32 50 L38 42 C42 42 48 46 50 62 Z" fill="#9f1239"/>
        <!-- Col d'hermine blanc à mouchetures -->
        <path d="M24 42 C26 46 32 50 32 50 C32 50 38 46 40 42 C42 46 42 54 38 58 C32 60 26 58 24 42 Z" fill="#fff1f2"/>
        <!-- Cœur rubis central -->
        <path d="M32 46 C30 43 27 44 27 47 C27 50 32 53 32 53 C32 53 37 50 37 47 C37 44 34 43 32 46 Z" fill="#e11d48"/>
        <!-- Cheveux noirs lisses royaux -->
        <circle cx="32" cy="27" r="11" fill="#ffe4e6"/>
        <path d="M21 28 C20 16 26 13 32 13 C38 13 44 16 43 28 C41 38 40 44 42 48 C38 48 37 38 37 34 C37 28 27 28 27 34 C27 38 26 48 22 48 C24 44 23 38 21 28 Z" fill="#0f172a"/>
        <!-- Couronne dorée royale ornée de cœurs -->
        <path d="M23 16 L25 9 L32 14 L39 9 L41 16 Z" fill="url(#qh-gold)"/>
        <circle cx="32" cy="11" r="1.5" fill="#e11d48"/>
        <!-- Yeux doux & Grain de beauté -->
        <ellipse cx="28" cy="26" rx="1.8" ry="1.5" fill="#0f172a"/>
        <ellipse cx="36" cy="26" rx="1.8" ry="1.5" fill="#0f172a"/>
        <circle cx="29" cy="30" r="0.7" fill="#0f172a"/>
        <!-- Bouche en cœur -->
        <path d="M30 32 Q32 35 34 32" stroke="#be123c" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`
    },
    {
      id: 'vip-texas-cowboy',
      name: 'Texas Cowboy',
      tag: 'LEGEND',
      title: 'Pionnier du Hold\'em',
      bgGradient: 'from-amber-800 via-yellow-900 to-stone-900',
      badgeColor: 'bg-amber-600 text-white font-black',
      svg: `<svg viewBox="0 0 64 64" class="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="tc-bg" x1="0" y1="0" x2="64" y2="64">
            <stop stop-color="#451a03"/>
            <stop offset="1" stop-color="#1c1917"/>
          </linearGradient>
          <linearGradient id="tc-gold" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#fde047"/>
            <stop offset="0.5" stop-color="#eab308"/>
            <stop offset="1" stop-color="#a16207"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#tc-bg)" stroke="url(#tc-gold)" stroke-width="2.5"/>
        <!-- Chemise de cowboy & Veste en cuir -->
        <path d="M12 62 L20 44 L32 52 L44 44 L52 62 Z" fill="#78350f"/>
        <path d="M22 44 L32 52 L42 44 Z" fill="#fef3c7"/>
        <!-- Bandana rouge bandana noué -->
        <path d="M26 42 Q32 47 38 42 L32 50 Z" fill="#dc2626"/>
        <!-- Étoile de shérif dorée 6 branches -->
        <polygon points="21,48 23,49.5 22.5,52 24.5,50.5 26.5,52 26,49.5 28,48 25.5,48 24.5,45.5 23.5,48" fill="url(#tc-gold)"/>
        <!-- Visage hâlé -->
        <circle cx="32" cy="30" r="11" fill="#fed7aa"/>
        <path d="M27 34 Q32 37 37 34" stroke="#78350f" stroke-width="2" stroke-linecap="round"/>
        <!-- Chapeau de cowboy Stetson cuir brun -->
        <path d="M14 26 C22 22 42 22 50 26 C46 22 40 21 32 21 C24 21 18 22 14 26 Z" fill="#451a03"/>
        <path d="M22 22 C22 13 27 10 32 10 C37 10 42 13 42 22 Z" fill="#78350f"/>
        <path d="M22 19 Q32 21 42 19" stroke="url(#tc-gold)" stroke-width="1.5" fill="none"/>
        <!-- Regard perçant de pistolero -->
        <ellipse cx="28" cy="28" rx="1.6" ry="1.2" fill="#1c1917"/>
        <ellipse cx="36" cy="28" rx="1.6" ry="1.2" fill="#1c1917"/>
      </svg>`
    },
    {
      id: 'vip-king-spades',
      name: 'Roi des As',
      tag: 'MASTER',
      title: 'Légende Texas Hold\'em',
      bgGradient: 'from-amber-500 via-yellow-600 to-amber-900',
      badgeColor: 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 text-slate-950 font-black',
      svg: `<svg viewBox="0 0 64 64" class="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ks-bg" x1="0" y1="0" x2="64" y2="64">
            <stop stop-color="#1e1b4b"/>
            <stop offset="0.7" stop-color="#0f172a"/>
            <stop offset="1" stop-color="#020617"/>
          </linearGradient>
          <linearGradient id="ks-gold" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#fef08a"/>
            <stop offset="0.4" stop-color="#eab308"/>
            <stop offset="1" stop-color="#ca8a04"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#ks-bg)" stroke="url(#ks-gold)" stroke-width="2.5"/>
        <!-- Cape royale pourpre et or -->
        <path d="M12 62 C16 44 24 40 26 40 L32 48 L38 40 C40 40 48 44 52 62 Z" fill="#1e1b4b"/>
        <path d="M26 40 L32 46 L38 40 Z" fill="url(#ks-gold)"/>
        <!-- Barbe et visage de roi -->
        <circle cx="32" cy="28" r="11" fill="#fed7aa"/>
        <!-- Barbe sculptée blonde/grise royale -->
        <path d="M24 28 C24 38 28 44 32 44 C36 44 40 38 40 28 C38 31 36 33 32 33 C28 33 26 31 24 28 Z" fill="#e2e8f0"/>
        <path d="M28 32 Q32 35 36 32" stroke="#475569" stroke-width="1.2" stroke-linecap="round"/>
        <!-- Yeux bienveillants et déterminés -->
        <ellipse cx="28" cy="26" rx="1.8" ry="1.5" fill="#0284c7"/>
        <ellipse cx="36" cy="26" rx="1.8" ry="1.5" fill="#0284c7"/>
        <circle cx="27.5" cy="25.5" r="0.6" fill="#fff"/>
        <circle cx="35.5" cy="25.5" r="0.6" fill="#fff"/>
        <!-- Grande Couronne Impériale dorée avec Émeraudes et Pique -->
        <path d="M21 17 L23 8 L28 13 L32 7 L36 13 L41 8 L43 17 Z" fill="url(#ks-gold)"/>
        <circle cx="32" cy="11" r="1.5" fill="#10b981"/>
        <circle cx="25" cy="11" r="1.2" fill="#ef4444"/>
        <circle cx="39" cy="11" r="1.2" fill="#ef4444"/>
        <!-- Sceau de pique central sur la couronne -->
        <text x="32" y="16.5" font-size="4" font-weight="900" fill="#020617" text-anchor="middle">♠</text>
      </svg>`
    }
  ];

  const PRESET_MAP = {};
  AVATAR_PRESETS.forEach((p) => { PRESET_MAP[p.id] = p; });

  return {
    CLASSIC_EMOJIS,
    AVATAR_PRESETS,
    PRESET_MAP,

    isVipAvatar(avatarId) {
      if (!avatarId) return false;
      return !!PRESET_MAP[avatarId];
    },

    getAvatarMeta(avatarId) {
      return PRESET_MAP[avatarId] || null;
    },

    /**
     * Rendu HTML universel d'un avatar (SVG VIP animé ou Emoji classique)
     * Compatible avec tous les éléments du lobby, de la table, des tournois et du classement.
     */
    renderAvatarHTML(avatarIdOrEmoji, sizeClass = '', extraClass = '') {
      const val = avatarIdOrEmoji || '👑';
      const preset = PRESET_MAP[val];

      if (preset) {
        return `
          <div class="inline-flex items-center justify-center relative overflow-hidden rounded-full ${sizeClass} ${extraClass}" data-avatar-id="${preset.id}" title="${preset.name} (${preset.title})">
            ${preset.svg}
          </div>
        `;
      }

      // Si c'est déjà un snippet SVG injecté directement
      if (typeof val === 'string' && val.trim().startsWith('<svg')) {
        return `
          <div class="inline-flex items-center justify-center relative overflow-hidden rounded-full ${sizeClass} ${extraClass}">
            ${val}
          </div>
        `;
      }

      // Émoji standard
      return `<span class="emoji-avatar select-none ${extraClass}">${val}</span>`;
    }
  };
});
