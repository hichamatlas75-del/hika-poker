# Hika-Poker — Clone Zynga Poker 100% Client-Side

**Hika-Poker** est un jeu de Texas Hold'em No-Limit complet, fidèle à l'ergonomie et l'esthétique luxueuse de **Zynga Poker**, fonctionnant à 100% dans le navigateur sans backend requis.

---

## 🌟 Fonctionnalités Clés

### 1. Direction Artistique & Table Style Zynga
- **Tapis de poker ovale feutré** avec 3 thèmes sélectionnables : Feutre Vert Casino classique, Bleu Nuit Vegas Pro, Rouge Velvet Club.
- **Bordure en cuir matelassé** avec surpiqûres et rebord en bois verni acajou aux reflets dorés.
- **Sièges 6-Max dynamiques** : Le joueur humain est toujours centré en bas pour un confort ergonomique optimal sur mobile et desktop.
- **Timer circulaire SVG** : Jauge animée autour de l'avatar du joueur dont c'est le tour, virant au rouge clignotant avec son d'alerte lors des 3 dernières secondes.
- **Animations 3D fluides** :
  - Distribution séquentielle des cartes.
  - Cartes du board (Flop, Turn, River) révélées avec retournement 3D (*flip card*).
  - Jetons glissants vers le pot central lors des mises, puis vers le vainqueur au Showdown.
  - Bannière de victoire au Showdown mettant en valeur la combinaison gagnante et illuminant les cartes concernées.

### 2. Panneau de Contrôle Joueur (Action Bar) & Pré-actions Zynga
- Boutons contextuels automatiques :
  - Situation sans mise : **Check (Parole)** / **Bet (Miser)**
  - Situation avec mise : **Fold (Se Coucher)** / **Call (Suivre)** / **Raise (Relancer)** / **All-In (Tapis)**
- **Raise Slider interactif** avec raccourcis rapides : `Min`, `1/2 Pot`, `Pot`, `All-in`, et boutons d'incrément `+` / `-`.
- **Cases de pré-action typiques de Zynga** : *Check/Fold*, *Auto-Check*, *Suivre Tout* déclenchables avant son tour.

### 3. Modes de Jeu (100% Local)
- **Partie Classique (Cash Game)** : 3 niveaux de table prédéfinis :
  - Table Débutant (10/20 — Buy-in 1,000)
  - Table Vegas (50/100 — Buy-in 5,000)
  - Table VIP High Roller (500/1,000 — Buy-in 50,000)
  - Bots locaux intelligents configurés via évaluation Monte-Carlo (Easy, Medium, Hard).
- **Tournoi Sit & Go (6-Max)** : Table éliminatoire rapide à 6 joueurs avec blinds progressives, HUD en direct et podium de récompenses.

### 4. Mini-Jeu : La "Lucky Wheel" (Roulette à Jetons)
- Roue de la fortune animée en Canvas 2D avec physique d'inertie douce et taquet cliquetant.
- Segments de 1,000 à 100,000 jetons (JACKPOT).
- Pluie de confettis et créditation instantanée sur la bankroll du joueur.

### 5. Sons & Audio Synthétique (Web Audio API)
- Effets sonores intégrés sans fichier externe (bruit de cartes, tintement de jetons, knock check, fanfare de victoire, alertes timer).
- Contrôle Mute instantané depuis la barre supérieure.

### 6. Persistance Locale (localStorage)
- Sauvegarde de la bankroll du joueur, historique des mains, statistiques (mains jouées, mains gagnées, plus gros pot, tournois remportés) et réglages.

---

## 📁 Arborescence des Fichiers

```
hika-poker/
├── index.html              # Interface principale complète (Lobby, Table, Modals)
├── engine.js               # Moteur Texas Hold'em No-Limit complet
├── css/
│   └── style.css           # Direction artistique Zynga, animations 3D, feutre, timer
└── js/
    ├── audio.js            # Moteur sonore synthétique Web Audio API
    ├── storage.js          # Persistance locale (profil, stats, paramètres)
    ├── bot-names.js        # Roster des bots avec avatars et personnalités
    ├── wheel.js            # Mini-jeu Lucky Wheel (Canvas 2D, physique, confettis)
    ├── tournament.js       # Gestionnaire du tournoi Sit & Go 6-Max
    ├── ui-table.js         # Rendu de la table, sièges, cartes 3D, jetons
    ├── ui-controls.js      # Barre d'actions, Raise Slider, pré-actions
    └── app.js              # Chef d'orchestre reliant UI et PokerEngine
```

---

## 🚀 Lancement Direct

Ouvrez simplement `index.html` dans n'importe quel navigateur moderne, ou lancez un serveur local statique :
```bash
python3 -m http.server 8080
```
Puis accédez à `http://localhost:8080`.
