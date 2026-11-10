/**
 * Hika-Poker — Client Supabase & Authentification
 * Gère la connexion, l'inscription par pseudo et la synchronisation cloud.
 */

// Configuration par défaut (remplacer avec vos identifiants Supabase ou configurer depuis le modal du jeu)
const DEFAULT_SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

class HikaSupabaseClient {
  constructor() {
    this.client = null;
    this.currentUser = null;
    this.isConfigured = false;
    this.authListeners = [];

    this.url = localStorage.getItem('hika_supabase_url') || DEFAULT_SUPABASE_URL;
    this.anonKey = localStorage.getItem('hika_supabase_key') || DEFAULT_SUPABASE_ANON_KEY;

    this.setupClient();
  }

  isValidConfig(url, key) {
    if (!url || !key) return false;
    if (!url.startsWith('https://') && !url.startsWith('http://')) return false;
    if (url.includes('YOUR_PROJECT_ID') || url.includes('votre-projet')) return false;
    if (key.includes('YOUR_SUPABASE_ANON_KEY') || key.length < 20) return false;
    return true;
  }

  setupClient() {
    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
      console.warn('[Hika-Supabase] SDK Supabase JS non disponible, mode Invité actif.');
      this.isConfigured = false;
      return;
    }

    if (this.isValidConfig(this.url, this.anonKey)) {
      try {
        this.client = window.supabase.createClient(this.url, this.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
          }
        });
        this.isConfigured = true;
        console.log('[Hika-Supabase] Client Supabase initialisé avec succès.');
      } catch (err) {
        console.warn('[Hika-Supabase] Erreur initialisation client:', err);
        this.isConfigured = false;
      }
    } else {
      console.info('[Hika-Supabase] Clés Supabase non renseignées ou par défaut. Mode Invité local activé.');
      this.isConfigured = false;
    }
  }

  async init() {
    if (!this.isConfigured || !this.client) return;

    try {
      // 1. Récupérer la session persistée existante
      const { data: { session }, error } = await this.client.auth.getSession();
      if (!error && session && session.user) {
        this.currentUser = session.user;
        console.log('[Hika-Supabase] Session active détectée pour:', session.user.id);
        if (window.storageManager) {
          await window.storageManager.loadFromCloud(session.user);
        }
      }

      // 2. Écouter les changements d'état d'authentification
      this.client.auth.onAuthStateChange(async (event, session) => {
        console.log('[Hika-Supabase] Événement Auth:', event);
        if (session && session.user) {
          this.currentUser = session.user;
          if (window.storageManager) {
            await window.storageManager.loadFromCloud(session.user);
          }
        } else {
          this.currentUser = null;
        }
        this.notifyAuthListeners(event, session);
      });
    } catch (err) {
      console.warn('[Hika-Supabase] Erreur vérification session:', err);
    }
  }

  isReady() {
    return this.isConfigured && !!this.client;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  formatEmail(username) {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${clean}@hikapoker.app`;
  }

  // Inscription par Pseudo + Mot de passe + Choix d'avatar
  async signUp(username, password, avatar = '👑') {
    if (!this.isReady()) {
      throw new Error("Supabase n'est pas configuré. Veuillez renseigner l'URL et la clé anonyme dans les paramètres.");
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanUsername.length < 3) {
      throw new Error("Le pseudo doit contenir au moins 3 caractères alphanumériques.");
    }
    if (!password || password.length < 6) {
      throw new Error("Le mot de passe doit comporter au moins 6 caractères.");
    }

    const email = this.formatEmail(username);
    const displayName = username.trim();

    // 1. Inscription dans Supabase Auth
    const { data: authData, error: authError } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          avatar: avatar
        }
      }
    });

    if (authError) throw authError;

    const user = authData.user;
    if (!user) throw new Error("Échec de la création du compte.");

    this.currentUser = user;

    // 2. Création de la ligne dans la table 'profiles' avec les 20 000 jetons offerts
    const initialProfile = {
      id: user.id,
      username: displayName,
      avatar: avatar,
      chips: 20000,
      hands_played: 0,
      hands_won: 0,
      biggest_pot: 0,
      best_hand: 'Aucune',
      tournaments_played: 0,
      tournaments_won: 0,
      total_won: 0,
      wheel_last_spin: null,
      updated_at: new Date().toISOString()
    };

    const { error: profileError } = await this.client
      .from('profiles')
      .upsert(initialProfile, { onConflict: 'id' });

    if (profileError) {
      console.warn('[Hika-Supabase] Avertissement création profil:', profileError);
    }

    // 3. Charger le profil dans le cache local
    if (window.storageManager) {
      await window.storageManager.loadFromCloud(user);
    }

    return { user, session: authData.session };
  }

  // Connexion par Pseudo + Mot de passe
  async signIn(username, password) {
    if (!this.isReady()) {
      throw new Error("Supabase n'est pas configuré. Veuillez renseigner l'URL et la clé anonyme.");
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanUsername.length < 3) {
      throw new Error("Veuillez saisir un pseudo valide.");
    }
    if (!password) {
      throw new Error("Veuillez saisir votre mot de passe.");
    }

    const email = this.formatEmail(username);

    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error("Pseudo ou mot de passe incorrect.");
      }
      throw error;
    }

    this.currentUser = data.user;

    // Charger les données cloud
    if (window.storageManager) {
      await window.storageManager.loadFromCloud(data.user);
    }

    return data;
  }

  // Déconnexion
  async signOut() {
    if (this.isReady()) {
      try {
        await this.client.auth.signOut();
      } catch (e) {
        console.warn('Erreur signOut:', e);
      }
    }
    this.currentUser = null;
    if (window.storageManager) {
      window.storageManager.revertToGuest();
    }
  }

  // Configuration personnalisée des clés Supabase depuis l'interface
  saveCustomConfig(url, anonKey) {
    if (url && anonKey) {
      localStorage.setItem('hika_supabase_url', url.trim());
      localStorage.setItem('hika_supabase_key', anonKey.trim());
      this.url = url.trim();
      this.anonKey = anonKey.trim();
      this.setupClient();
      this.init();
      return true;
    }
    return false;
  }

  onAuthChange(callback) {
    if (typeof callback === 'function') {
      this.authListeners.push(callback);
    }
  }

  notifyAuthListeners(event, session) {
    this.authListeners.forEach((cb) => {
      try {
        cb(event, session);
      } catch (e) {
        console.error('Erreur auth listener:', e);
      }
    });
  }
}

// Instance globale du client Supabase
window.supabaseClient = new HikaSupabaseClient();
