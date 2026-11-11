-- =========================================================================
-- HIKA-POKER — Schéma de Base de Données Supabase
-- Exécutez ce script dans l'éditeur SQL de votre Dashboard Supabase
-- =========================================================================

-- 1. Table des Profils Joueurs
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar text default '👑',
  chips bigint default 20000,
  hands_played integer default 0,
  hands_won integer default 0,
  biggest_pot bigint default 0,
  best_hand text default 'Aucune',
  tournaments_played integer default 0,
  tournaments_won integer default 0,
  total_won bigint default 0,
  wheel_last_spin timestamp with time zone,
  active_tournament jsonb default null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Si vous avez déjà créé la table 'profiles' auparavant, exécutez simplement cette ligne :
alter table public.profiles add column if not exists active_tournament jsonb default null;

-- Activer la réplication Realtime pour la synchronisation instantanée entre appareils :
alter publication supabase_realtime add table public.profiles;

-- 2. Table de l'Historique des Mains Jouées
create table if not exists public.hand_history (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  game_mode text default 'cash', -- 'cash' | 'tournament'
  won boolean default false,
  pot_amount bigint default 0,
  hand_label text,
  created_at timestamp with time zone default now()
);

-- 3. Activation de Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.hand_history enable row level security;

-- 4. Politiques RLS pour 'profiles'
-- Tout le monde peut lire les profils (nécessaire pour le Leaderboard / Classement Top 10)
drop policy if exists "Lecture publique des profils" on public.profiles;
create policy "Lecture publique des profils"
  on public.profiles for select
  using (true);

-- Chaque joueur authentifié peut créer son propre profil
drop policy if exists "Insertion du profil par son propriétaire" on public.profiles;
create policy "Insertion du profil par son propriétaire"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Chaque joueur ne peut modifier que son propre profil
drop policy if exists "Mise à jour du profil par son propriétaire" on public.profiles;
create policy "Mise à jour du profil par son propriétaire"
  on public.profiles for update
  using (auth.uid() = id);

-- 5. Politiques RLS pour 'hand_history'
-- Chaque joueur peut lire son propre historique de mains
drop policy if exists "Lecture de l'historique par son propriétaire" on public.hand_history;
create policy "Lecture de l'historique par son propriétaire"
  on public.hand_history for select
  using (auth.uid() = user_id);

-- Chaque joueur peut insérer des mains pour son propre compte
drop policy if exists "Insertion d'historique par son propriétaire" on public.hand_history;
create policy "Insertion d'historique par son propriétaire"
  on public.hand_history for insert
  with check (auth.uid() = user_id);

-- 6. Index de performance
create index if not exists idx_profiles_chips on public.profiles (chips desc);
create index if not exists idx_hand_history_user_id on public.hand_history (user_id, created_at desc);

-- =========================================================================
-- CONSEIL CONFIGURATION SUPABASE AUTHENTICATION :
-- Dans Supabase Dashboard > Authentication > Providers > Email :
-- Désactivez l'option "Confirm email" (Email Confirmation) pour permettre
-- une connexion instantanée par Pseudo sans envoi d'email de confirmation !
-- =========================================================================
