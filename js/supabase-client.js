/**
 * Hika-Poker — Client Supabase & Authentification
 * Gère la connexion, l'inscription par pseudo et la synchronisation cloud.
 */

// Configuration par défaut connectée au projet Supabase Hika-Poker
const DEFAULT_SUPABASE_URL = 'https://szvdtbzrjmikfnkmvlhf.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6dmR0Ynpyam1pa2Zua212bGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNDMyOTIsImV4cCI6MjEwOTkxOTI5Mn0.7gJDYwtk83pUUTQct7Ib_IQUTwHc5S-IoVJuoKENUJc';

class HikaSupabaseClient {
  constructor() {
    this.client = null;
    this.currentUser = null;
    this.isConfigured = false;
    this.authListeners = [];
    this.realtimeChannel = null;

    const savedUrl = (typeof localStorage !== 'undefined') ? localStorage.getItem('hika_supabase_url') : null;
    const savedKey = (typeof localStorage !== 'undefined') ? localStorage.getItem('hika_supabase_key') : null;

    this.url = (savedUrl && !savedUrl.includes('YOUR_PROJECT_ID')) ? savedUrl : DEFAULT_SUPABASE_URL;
    this.anonKey = (savedKey && !savedKey.includes('YOUR_SUPABASE_ANON_KEY')) ? savedKey : DEFAULT_SUPABASE_ANON_KEY;

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
        // Souscription Realtime instantanée sur le profil
        this.setupRealtimeSubscription(session.user.id);
      }

      // 2. Écouter les changements d'état d'authentification
      this.client.auth.onAuthStateChange(async (event, session) => {
        console.log('[Hika-Supabase] Événement Auth:', event);
        if (session && session.user) {
          this.currentUser = session.user;
          if (window.storageManager) {
            await window.storageManager.loadFromCloud(session.user);
          }
          this.setupRealtimeSubscription(session.user.id);
        } else {
          this.currentUser = null;
          this.cleanupRealtimeSubscription();
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
    const raw = (username || '').trim().toLowerCase();
    if (raw.includes('@') && raw.includes('.')) {
      return raw;
    }
    const clean = raw.replace(/[^a-z0-9]/g, '');
    return `${clean}@hikapoker.com`;
  }

  // Inscription par Pseudo (ou Email) + Mot de passe + Choix d'avatar
  async signUp(username, password, avatar = '👑') {
    if (!this.isReady()) {
      throw new Error("Supabase n'est pas configuré. Veuillez renseigner l'URL et la clé anonyme dans les paramètres.");
    }

    const raw = (username || '').trim();
    const isEmail = raw.includes('@') && raw.includes('.');
    const cleanUsername = isEmail ? raw.split('@')[0].replace(/[^a-z0-9_-]/gi, '') : raw.replace(/[^a-z0-9]/gi, '');
    
    if (cleanUsername.length < 3) {
      throw new Error("Le pseudo doit contenir au moins 3 caractères.");
    }
    if (!password || password.length < 6) {
      throw new Error("Le mot de passe doit comporter au moins 6 caractères.");
    }

    const email = this.formatEmail(raw);
    const displayName = isEmail ? raw.split('@')[0] : raw;

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

    if (authError) {
      if (authError.message && (authError.message.includes('rate limit') || authError.status === 429)) {
        throw new Error("Limite d'envoi d'emails Supabase atteinte. Pour autoriser la connexion directe sans email, désactivez 'Confirm email' dans Supabase Dashboard > Authentication > Providers > Email.");
      }
      throw authError;
    }

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
      console.warn('[Hika-Supabase] Avertissement création profil (avez-vous exécuté supabase-schema.sql ?) :', profileError);
    }

    // 3. Charger le profil dans le cache local
    if (window.storageManager) {
      await window.storageManager.loadFromCloud(user);
    }

    return { user, session: authData.session };
  }

  // Connexion par Pseudo ou Email + Mot de passe
  async signIn(username, password) {
    if (!this.isReady()) {
      throw new Error("Supabase n'est pas configuré. Veuillez renseigner l'URL et la clé anonyme.");
    }

    const raw = (username || '').trim();
    if (raw.length < 3) {
      throw new Error("Veuillez saisir un pseudo ou une adresse email valide.");
    }
    if (!password) {
      throw new Error("Veuillez saisir votre mot de passe.");
    }

    const email = this.formatEmail(raw);

    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error("Pseudo ou mot de passe incorrect.");
      }
      if (error.message.includes('Email not confirmed') || error.error_code === 'email_not_confirmed') {
        throw new Error("Compte en attente de confirmation. Désactivez l'option 'Confirm email' dans Supabase Dashboard > Authentication > Providers > Email pour une connexion immédiate sans email.");
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
    this.cleanupRealtimeSubscription();
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

  // Souscription Realtime WebSocket pour synchronisation instantanée entre appareils
  setupRealtimeSubscription(userId) {
    if (!this.isReady() || !userId) return;

    this.cleanupRealtimeSubscription();

    try {
      this.realtimeChannel = this.client
        .channel(`realtime_profiles_${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userId}`
          },
          (payload) => {
            console.log('[Supabase Realtime] Événement profiles reçu en direct:', payload);
            if (payload && payload.new && window.storageManager) {
              window.storageManager.handleRemoteProfileUpdate(payload.new);
            }
          }
        )
        .subscribe((status) => {
          console.log('[Supabase Realtime] Statut souscription:', status);
        });
    } catch (err) {
      console.warn('[Supabase Realtime] Erreur initialisation channel:', err);
    }
  }

  cleanupRealtimeSubscription() {
    if (this.realtimeChannel && this.client) {
      try {
        this.client.removeChannel(this.realtimeChannel);
      } catch (e) {
        console.warn('[Supabase Realtime] Erreur suppression channel:', e);
      }
      this.realtimeChannel = null;
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
