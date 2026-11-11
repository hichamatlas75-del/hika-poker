/**
 * Hika-Poker - Moteur de Particules & Feux d'Artifice de Jetons Dorés
 * Déclenché lors des Gros Pots (> 50x la Big Blind) ou des victoires majeures de tournoi.
 * Rendu physique 60fps sur Canvas 2D : pièces d'or 3D en rotation, étoiles étincelantes et traînées pyrotechniques.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HikaFireworks = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  class GoldenChipsFireworks {
    constructor() {
      this.animId = null;
      this.particles = [];
      this.sparks = [];
      this.isRunning = false;
      this.bannerEl = null;
      this.bannerTimeout = null;
    }

    /**
     * Lance l'explosion pyrotechnique de pièces d'or
     * @param {number} totalPot - Montant total du pot
     * @param {number} bb - Valeur de la Big Blind
     */
    launch(totalPot = 0, bb = 50) {
      const canvas = document.getElementById('confetti-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // 1. Déterminer les centres d'explosion (3 à 5 feux d'artifice synchronisés sur la table)
      const w = canvas.width;
      const h = canvas.height;
      const origins = [
        { x: w * 0.50, y: h * 0.40, count: 45 }, // Centre / Pot principal
        { x: w * 0.28, y: h * 0.32, count: 30 }, // Haut gauche table
        { x: w * 0.72, y: h * 0.32, count: 30 }, // Haut droite table
        { x: w * 0.50, y: h * 0.65, count: 35 }  // Joueur humain (Hero)
      ];

      // 2. Générer les pièces d'or 3D
      this.particles = [];
      origins.forEach((orig) => {
        for (let i = 0; i < orig.count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 4 + Math.random() * 14;
          this.particles.push({
            x: orig.x + (Math.random() * 30 - 15),
            y: orig.y + (Math.random() * 30 - 15),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (4 + Math.random() * 6), // propulsion verticale
            radius: 9 + Math.random() * 8, // 9px à 17px de diamètre
            rotX: Math.random() * Math.PI * 2,
            rotY: Math.random() * Math.PI * 2,
            rotSpeedX: (Math.random() - 0.5) * 0.25,
            rotSpeedY: (Math.random() - 0.5) * 0.30,
            opacity: 1,
            gravity: 0.32 + Math.random() * 0.12,
            drag: 0.985,
            bounce: 0.45,
            glow: Math.random() > 0.4,
            star: Math.random() > 0.3
          });
        }
      });

      // 3. Générer les étincelles d'étoiles dorées (Stardust)
      this.sparks = [];
      origins.forEach((orig) => {
        for (let i = 0; i < 50; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 16;
          this.sparks.push({
            x: orig.x,
            y: orig.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            size: 2 + Math.random() * 4,
            color: ['#fef08a', '#fde047', '#fbbf24', '#f59e0b', '#ffffff'][Math.floor(Math.random() * 5)],
            opacity: 1,
            decay: 0.009 + Math.random() * 0.012,
            twinklePhase: Math.random() * Math.PI * 2
          });
        }
      });

      // 4. Sonorisation festive & retour haptique
      if (window.soundFX) {
        window.soundFX.playWin();
        setTimeout(() => {
          if (window.soundFX.playApplause) window.soundFX.playApplause();
          if (window.soundFX.playAsset) window.soundFX.playAsset('chips_stack', { volume: 1.1 });
        }, 180);
        if (window.soundFX._vibrate) {
          window.soundFX._vibrate([70, 40, 70, 40, 140]);
        }
      }

      // 5. Affichage du bandeau de victoire "Gros Pot Remporté"
      this._showBigPotBanner(totalPot, bb);

      // 6. Démarrage de la boucle Canvas
      if (this.animId) cancelAnimationFrame(this.animId);
      this.isRunning = true;
      this._animate(canvas, ctx);
    }

    _showBigPotBanner(pot, bb) {
      if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
      let el = document.getElementById('big-pot-banner');
      if (!el) {
        el = document.createElement('div');
        el.id = 'big-pot-banner';
        el.className = 'fixed top-16 md:top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-500 transform scale-90 opacity-0';
        document.body.appendChild(el);
      }

      const mult = bb > 0 ? Math.round(pot / bb) : 50;
      el.innerHTML = `
        <div class="px-5 py-3 rounded-2xl bg-slate-950/95 border-2 border-yellow-400 text-center shadow-2xl shadow-yellow-500/40 backdrop-blur-md animate-bounce-subtle">
          <div class="flex items-center justify-center gap-2 mb-0.5">
            <span class="text-xl">💥</span>
            <span class="text-xs sm:text-sm font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400">
              GROS POT DE LÉGENDE !
            </span>
            <span class="text-xl">🔥</span>
          </div>
          <div class="text-lg sm:text-2xl font-black text-amber-300 flex items-center justify-center gap-1.5">
            <span>+${pot.toLocaleString()}</span>
            <span class="text-base text-amber-400">🪙</span>
          </div>
          <div class="text-[10px] sm:text-xs font-bold text-emerald-400 mt-0.5">
            Pot exceptionnel : <span class="font-black text-yellow-300">${mult}x la Big Blind</span> !
          </div>
        </div>
      `;

      // Animation d'apparition
      requestAnimationFrame(() => {
        el.classList.remove('opacity-0', 'scale-90');
        el.classList.add('opacity-100', 'scale-100');
      });

      this.bannerTimeout = setTimeout(() => {
        el.classList.remove('opacity-100', 'scale-100');
        el.classList.add('opacity-0', 'scale-90');
      }, 4000);
    }

    _animate(canvas, ctx) {
      const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let aliveCount = 0;

        // 1. Rendu des étincelles (Stardust & Traînées)
        this.sparks.forEach((s) => {
          s.x += s.vx;
          s.y += s.vy;
          s.vy += 0.08; // légère gravité
          s.vx *= 0.98;
          s.opacity -= s.decay;
          s.twinklePhase += 0.2;

          if (s.opacity > 0) {
            aliveCount++;
            ctx.save();
            ctx.globalAlpha = Math.max(0, s.opacity) * (0.6 + 0.4 * Math.sin(s.twinklePhase));
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();

            // Flare en croix pour effet scintillant
            if (s.size > 2.8) {
              ctx.strokeStyle = s.color;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(s.x - s.size * 2, s.y);
              ctx.lineTo(s.x + s.size * 2, s.y);
              ctx.moveTo(s.x, s.y - s.size * 2);
              ctx.lineTo(s.x, s.y + s.size * 2);
              ctx.stroke();
            }
            ctx.restore();
          }
        });

        // 2. Rendu des pièces d'or 3D réalistes
        this.particles.forEach((p) => {
          p.vx *= p.drag;
          p.vy += p.gravity;
          p.x += p.vx;
          p.y += p.vy;

          // Rebond sur le bas de l'écran
          if (p.y + p.radius > canvas.height) {
            p.y = canvas.height - p.radius;
            p.vy = -p.vy * p.bounce;
            p.vx *= 0.88;
          }

          p.rotX += p.rotSpeedX;
          p.rotY += p.rotSpeedY;
          p.opacity -= 0.0055;

          if (p.opacity > 0 && p.y < canvas.height + 50) {
            aliveCount++;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.globalAlpha = Math.max(0, p.opacity);

            // Simulation 3D de rotation de pièce de monnaie
            const cosX = Math.cos(p.rotX);
            const scaleY = Math.max(0.12, Math.abs(Math.sin(p.rotY)));
            ctx.scale(1, scaleY * cosX);

            // Gradient métallique or riche
            const grad = ctx.createRadialGradient(0, 0, p.radius * 0.2, 0, 0, p.radius);
            grad.addColorStop(0, '#fef08a'); // or très clair brillant
            grad.addColorStop(0.5, '#f59e0b'); // or moyen
            grad.addColorStop(0.85, '#d97706'); // or foncé
            grad.addColorStop(1, '#92400e'); // bordure bronze dorée

            // Corps de la pièce
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
            ctx.fill();

            // Bordure extérieure avec relief
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Anneau intérieur de jeton de casino
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(0, 0, p.radius * 0.65, 0, Math.PI * 2);
            ctx.stroke();

            // Étoile / gravure centrale de jeton
            if (p.star && p.radius > 11) {
              ctx.fillStyle = '#78350f';
              ctx.font = `bold ${Math.round(p.radius * 0.65)}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('★', 0, 0);
            }

            ctx.restore();
          }
        });

        if (aliveCount > 0 && this.isRunning) {
          this.animId = requestAnimationFrame(render);
        } else {
          this.isRunning = false;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      };

      this.animId = requestAnimationFrame(render);
    }
  }

  const fireworksInstance = new GoldenChipsFireworks();

  return {
    launch(totalPot, bb) {
      fireworksInstance.launch(totalPot, bb);
    }
  };
});
