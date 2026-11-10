/**
 * Hika-Poker - Mini-jeu Lucky Wheel (Roue de la Fortune)
 * Canvas 2D avec inertie physique, taquet réactif, confettis et sonorisation.
 */

class LuckyWheel {
  constructor() {
    this.modal = null;
    this.canvas = null;
    this.ctx = null;
    this.isSpinning = false;
    this.angle = 0;
    this.angularVelocity = 0;
    this.friction = 0.984; // Décélération progressive douce
    this.lastPegPassed = -1;
    this.confettiParticles = [];
    this.animId = null;

    // Segments de la roue : valeur, libellé, couleur, rareté
    this.segments = [
      { value: 1000, label: '1,000', color: '#10b981', textColor: '#ffffff' },
      { value: 5000, label: '5,000', color: '#3b82f6', textColor: '#ffffff' },
      { value: 2500, label: '2,500', color: '#8b5cf6', textColor: '#ffffff' },
      { value: 10000, label: '10,000', color: '#f59e0b', textColor: '#ffffff' },
      { value: 1000, label: '1,000', color: '#059669', textColor: '#ffffff' },
      { value: 25000, label: '25,000', color: '#ec4899', textColor: '#ffffff' },
      { value: 5000, label: '5,000', color: '#6366f1', textColor: '#ffffff' },
      { value: 50000, label: '50,000', color: '#06b6d4', textColor: '#ffffff' },
      { value: 2500, label: '2,500', color: '#d97706', textColor: '#ffffff' },
      { value: 100000, label: '★ JACKPOT ★\n100K', color: '#eab308', textColor: '#78350f', isJackpot: true }
    ];

    this.numSegments = this.segments.length;
    this.arc = (2 * Math.PI) / this.numSegments;
    this.flapperAngle = 0;
  }

  init() {
    this.modal = document.getElementById('wheel-modal');
    this.canvas = document.getElementById('wheel-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // Adapter la résolution retina
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.min(360, window.innerWidth - 60);
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';
    this.ctx.scale(dpr, dpr);
    this.size = size;

    this.draw();

    // Boutons
    const spinBtn = document.getElementById('wheel-spin-btn');
    if (spinBtn) {
      spinBtn.addEventListener('click', () => this.spin());
    }

    const closeBtn = document.getElementById('wheel-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    this.updateStatus();
  }

  open() {
    if (!this.modal) this.init();
    if (this.modal) {
      this.modal.classList.remove('hidden');
      this.modal.classList.add('flex');
      this.updateStatus();
      this.draw();
    }
  }

  close() {
    if (this.isSpinning) return;
    if (this.modal) {
      this.modal.classList.add('hidden');
      this.modal.classList.remove('flex');
    }
  }

  updateStatus() {
    const statusEl = document.getElementById('wheel-timer-status');
    const spinBtn = document.getElementById('wheel-spin-btn');
    if (!statusEl || !spinBtn) return;

    const { canSpin, timeLeft } = window.storageManager.getWheelState();
    if (canSpin) {
      statusEl.innerHTML = '<span class="text-emerald-400 font-bold">LANCER GRATUIT DISPONIBLE !</span>';
      spinBtn.disabled = false;
      spinBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      spinBtn.classList.add('animate-pulse');
    } else {
      const mins = Math.floor(timeLeft / 60000);
      const secs = Math.floor((timeLeft % 60000) / 1000);
      statusEl.innerHTML = `<span class="text-amber-400">Prochain tour gratuit dans : ${mins}m ${secs < 10 ? '0' : ''}${secs}s</span>`;
      spinBtn.disabled = true;
      spinBtn.classList.add('opacity-50', 'cursor-not-allowed');
      spinBtn.classList.remove('animate-pulse');
    }
  }

  spin() {
    if (this.isSpinning) return;
    const { canSpin } = window.storageManager.getWheelState();
    if (!canSpin) {
      alert('Veuillez patienter avant votre prochain lancer gratuit !');
      return;
    }

    this.isSpinning = true;
    const spinBtn = document.getElementById('wheel-spin-btn');
    if (spinBtn) {
      spinBtn.disabled = true;
      spinBtn.classList.remove('animate-pulse');
    }

    // Impulsion initiale aléatoire (vitesse angulaire entre 0.35 et 0.48 rad/frame)
    this.angularVelocity = 0.38 + Math.random() * 0.12;
    this.lastPegPassed = -1;

    window.storageManager.recordWheelSpin();
    this.animate();
  }

  animate() {
    if (!this.isSpinning) return;

    this.angle += this.angularVelocity;
    this.angularVelocity *= this.friction;

    // Détection du passage de peg sous le taquet (en haut, angle -PI/2)
    // L'angle effectif au taquet :
    const currentPeg = Math.floor(((this.angle % (2 * Math.PI)) + 2 * Math.PI) / this.arc);
    if (currentPeg !== this.lastPegPassed) {
      this.lastPegPassed = currentPeg;
      this.flapperAngle = 0.3; // Choc sur le cliquet
      if (window.soundFX) window.soundFX.playWheelClick();
    } else {
      this.flapperAngle *= 0.8; // Retour élastique du cliquet
    }

    this.draw();

    // Arrêt quand la vitesse est très basse
    if (this.angularVelocity < 0.0012) {
      this.isSpinning = false;
      this.angularVelocity = 0;
      this.flapperAngle = 0;
      this.draw();
      this.onSpinComplete();
      return;
    }

    requestAnimationFrame(() => this.animate());
  }

  getCurrentWinningSegment() {
    // Le taquet pointe vers le haut : angle = -PI/2 (ou 3*PI/2)
    // Calcul de l'index du segment situé sous l'aiguille haute
    const normalizedAngle = (this.angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    // Comme la roue tourne dans le sens horaire, le segment sous l'aiguille haute (à -PI/2) :
    let pointerAngle = (3 * Math.PI / 2 - normalizedAngle) % (2 * Math.PI);
    if (pointerAngle < 0) pointerAngle += 2 * Math.PI;
    const index = Math.floor(pointerAngle / this.arc) % this.numSegments;
    return this.segments[index];
  }

  onSpinComplete() {
    const winner = this.getCurrentWinningSegment();
    if (window.soundFX) {
      window.soundFX.playWin();
      window.soundFX.playApplause();
    }

    // Ajouter les jetons
    const newTotal = window.storageManager.addChips(winner.value);

    // Mettre à jour l'UI globale
    if (window.updatePlayerChipsDisplay) {
      window.updatePlayerChipsDisplay(newTotal);
    }

    // Afficher la récompense
    const resultEl = document.getElementById('wheel-result-banner');
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="animate-bounce text-xl font-extrabold text-yellow-300 drop-shadow-md">
          🎉 FÉLICITATIONS ! 🎉
        </div>
        <div class="text-2xl font-black text-white mt-1">
          +${winner.label.replace('\n', ' ')} JETONS
        </div>
      `;
      resultEl.classList.remove('hidden');
    }

    // Lancer les confettis
    this.launchConfetti();
    this.updateStatus();
  }

  launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#eab308', '#ffffff'];
    const particles = [];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() * 200 - 100),
        y: canvas.height / 2 + (Math.random() * 100 - 50),
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 14 - 4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.2,
        life: 1
      });
    }

    let frame = 0;
    const run = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravité
        p.rotation += p.vRot;
        p.life -= 0.009;

        if (p.life > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });
      frame++;
      if (alive && frame < 180) {
        requestAnimationFrame(run);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    run();
  }

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const s = this.size;
    const cx = s / 2;
    const cy = s / 2;
    const radius = s / 2 - 16;

    ctx.clearRect(0, 0, s, s);

    // 1. Cercle extérieur doré luxueux
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 12, 0, 2 * Math.PI);
    const gradRim = ctx.createLinearGradient(0, 0, s, s);
    gradRim.addColorStop(0, '#fef08a');
    gradRim.addColorStop(0.3, '#ca8a04');
    gradRim.addColorStop(0.7, '#eab308');
    gradRim.addColorStop(1, '#854d0e');
    ctx.fillStyle = gradRim;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 15;
    ctx.fill();

    // Rebord intérieur sombre
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e293b';
    ctx.shadowBlur = 0;
    ctx.fill();
    ctx.restore();

    // 2. Segments de la roue
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.angle);

    for (let i = 0; i < this.numSegments; i++) {
      const seg = this.segments[i];
      const startAngle = i * this.arc;
      const endAngle = (i + 1) * this.arc;

      // Tranche
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      // Dégradé pour chaque tranche
      const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, radius);
      grad.addColorStop(0, '#ffffff44');
      grad.addColorStop(0.4, seg.color);
      grad.addColorStop(1, '#00000055');
      ctx.fillStyle = grad;
      ctx.fill();

      // Ligne séparatrice dorée
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fef08a';
      ctx.stroke();

      // Texte du segment
      ctx.save();
      ctx.rotate(startAngle + this.arc / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = seg.textColor;
      ctx.font = seg.isJackpot ? 'bold 12px sans-serif' : 'bold 13px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;

      const lines = seg.label.split('\n');
      if (lines.length > 1) {
        ctx.fillText(lines[0], radius - 15, -6);
        ctx.fillText(lines[1], radius - 15, 8);
      } else {
        ctx.fillText(seg.label, radius - 20, 0);
      }
      ctx.restore();
    }

    // Rivets / Pegs autour du bord de la roue
    for (let i = 0; i < this.numSegments; i++) {
      const a = i * this.arc;
      const px = Math.cos(a) * (radius - 4);
      const py = Math.sin(a) * (radius - 4);

      ctx.beginPath();
      ctx.arc(px, py, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 4;
      ctx.fill();
    }
    ctx.restore();

    // 3. Moyeu central doré
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, 2 * Math.PI);
    const gradHub = ctx.createRadialGradient(cx, cy, 5, cx, cy, 26);
    gradHub.addColorStop(0, '#fef9c3');
    gradHub.addColorStop(0.6, '#eab308');
    gradHub.addColorStop(1, '#713f12');
    ctx.fillStyle = gradHub;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.fill();

    // Étoile au centre du moyeu
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', cx, cy);
    ctx.restore();

    // 4. Taquet / Aiguille fléchée en haut (Pointer)
    ctx.save();
    ctx.translate(cx, 10);
    ctx.rotate(this.flapperAngle);

    ctx.beginPath();
    ctx.moveTo(-10, -2);
    ctx.lineTo(10, -2);
    ctx.lineTo(0, 22);
    ctx.closePath();

    ctx.fillStyle = '#dc2626'; // Rouge vif
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();

    // Petit boulon de fixation de l'aiguille
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    ctx.restore();
  }
}

window.luckyWheel = new LuckyWheel();
