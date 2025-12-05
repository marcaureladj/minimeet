# ⚙️ Guide de Configuration - MiniMeet

## 📋 Prérequis

- Node.js 16.x ou supérieur
- npm ou yarn
- Un compte [Supabase](https://supabase.com)
- (Optionnel) Un compte [OpenRouter](https://openrouter.ai) pour les résumés IA
- (Optionnel) Un compte [Metered.ca](https://metered.ca) pour les serveurs TURN personnalisés

---

## 🚀 Installation Rapide

### 1. Cloner le projet
```bash
git clone https://github.com/marcaureladj/minimeet.git
cd minimeet
```

### 2. Installer les dépendances
```bash
npm install
# ou
yarn install
```

### 3. Configuration des variables d'environnement

Créer un fichier `.env` à la racine du projet :

```env
# Supabase Configuration (OBLIGATOIRE)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# OpenRouter API pour résumés IA (OPTIONNEL)
VITE_OPENROUTER_API_KEY=your-openrouter-api-key-here

# TURN Server Configuration (OPTIONNEL)
# Si non configuré, les credentials par défaut seront utilisés
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-credential
```

### 4. Configuration Supabase

#### A. Créer un projet Supabase
1. Aller sur [supabase.com](https://supabase.com)
2. Créer un nouveau projet
3. Noter l'URL du projet et la clé anonyme (anon key)

#### B. Activer l'authentification
1. Aller dans `Authentication` > `Providers`
2. Activer `Email`
3. Configurer les redirections si nécessaire

#### C. Créer les tables

Exécuter les requêtes SQL suivantes dans l'éditeur SQL de Supabase :

```sql
-- Table profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table meetings
CREATE TABLE meetings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table room_participants
CREATE TABLE room_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  peer_id TEXT NOT NULL,
  user_email TEXT,
  user_full_name TEXT,
  status TEXT DEFAULT 'online',
  is_screen_sharing BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Table messages
CREATE TABLE messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_full_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table todos
CREATE TABLE todos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id TEXT NOT NULL,
  task_content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table room_whiteboard
CREATE TABLE room_whiteboard (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id TEXT UNIQUE NOT NULL,
  canvas_data TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  initiator_id UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table lives
CREATE TABLE lives (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'scheduled', -- scheduled, live, ended
  thumbnail_url TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  viewer_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table live_viewers
CREATE TABLE live_viewers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  live_id UUID REFERENCES lives(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(live_id, user_id)
);

-- Table live_comments
CREATE TABLE live_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  live_id UUID REFERENCES lives(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table live_reactions
CREATE TABLE live_reactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  live_id UUID REFERENCES lives(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL, -- like, love, fire, clap, wow
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table live_guests
CREATE TABLE live_guests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  live_id UUID REFERENCES lives(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'invited', -- invited, accepted, joined, declined
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(live_id, user_id)
);

-- Table meeting_participants_log
CREATE TABLE meeting_participants_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  user_full_name TEXT,
  user_avatar_url TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE
);

-- Table meeting_transcripts
CREATE TABLE meeting_transcripts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table meeting_summaries
CREATE TABLE meeting_summaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  summary TEXT,
  key_points JSONB,
  decisions JSONB,
  action_items JSONB,
  next_steps JSONB,
  transcript TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table reports
CREATE TABLE reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL, -- message, comment, live, user
  target_id UUID NOT NULL,
  room_id TEXT,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, reviewed, resolved
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### D. Configurer les RLS (Row Level Security)

```sql
-- Activer RLS sur toutes les tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_whiteboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE lives ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policies pour profiles
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies pour meetings
CREATE POLICY "Users can view own meetings" ON meetings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create meetings" ON meetings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own meetings" ON meetings FOR DELETE USING (auth.uid() = user_id);

-- Policies pour room_participants (lecture publique, écriture authentifiée)
CREATE POLICY "Room participants are viewable by everyone" ON room_participants FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert room participants" ON room_participants FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own participant status" ON room_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own participant status" ON room_participants FOR DELETE USING (auth.uid() = user_id);

-- Policies pour messages
CREATE POLICY "Messages are viewable by everyone in room" ON messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create messages" ON messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies pour todos
CREATE POLICY "Todos are viewable by everyone in room" ON todos FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create todos" ON todos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update todos" ON todos FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete own todos" ON todos FOR DELETE USING (auth.uid() = created_by_user_id);

-- Policies pour room_whiteboard
CREATE POLICY "Whiteboard is viewable by everyone in room" ON room_whiteboard FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage whiteboard" ON room_whiteboard FOR ALL USING (auth.role() = 'authenticated');

-- Policies pour lives
CREATE POLICY "Lives are viewable by everyone" ON lives FOR SELECT USING (true);
CREATE POLICY "Users can create lives" ON lives FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts can update own lives" ON lives FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Hosts can delete own lives" ON lives FOR DELETE USING (auth.uid() = host_id);

-- Policies pour live_viewers
CREATE POLICY "Live viewers are viewable by everyone" ON live_viewers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join as viewers" ON live_viewers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own viewer status" ON live_viewers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own viewer status" ON live_viewers FOR DELETE USING (auth.uid() = user_id);

-- Policies pour live_comments
CREATE POLICY "Live comments are viewable by everyone" ON live_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON live_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies pour live_reactions
CREATE POLICY "Live reactions are viewable by everyone" ON live_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create reactions" ON live_reactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies pour live_guests
CREATE POLICY "Live guests are viewable by everyone" ON live_guests FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage guests" ON live_guests FOR ALL USING (auth.role() = 'authenticated');

-- Policies pour les autres tables (logging, summaries, reports)
CREATE POLICY "Logs viewable by authenticated users" ON meeting_participants_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can create logs" ON meeting_participants_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Transcripts viewable by authenticated users" ON meeting_transcripts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can create transcripts" ON meeting_transcripts FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Summaries viewable by authenticated users" ON meeting_summaries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage summaries" ON meeting_summaries FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view own reports" ON reports FOR SELECT USING (auth.uid() = reporter_id);
```

#### E. Activer Realtime

1. Aller dans `Database` > `Replication`
2. Activer la réplication pour les tables suivantes :
   - `room_participants`
   - `messages`
   - `todos`
   - `room_whiteboard`
   - `lives`
   - `live_viewers`
   - `live_comments`
   - `live_reactions`
   - `live_guests`

#### F. Configurer Storage (pour les avatars)

1. Aller dans `Storage`
2. Créer un bucket nommé `avatars`
3. Configurer comme public ou avec RLS appropriée

---

## 🔐 Configuration OpenRouter (Optionnel)

Pour activer les résumés IA :

1. Créer un compte sur [OpenRouter](https://openrouter.ai)
2. Générer une clé API
3. Ajouter la clé dans `.env` : `VITE_OPENROUTER_API_KEY=...`

---

## 🌐 Configuration TURN Server (Optionnel)

Pour une meilleure connectivité WebRTC en production :

1. Créer un compte sur [Metered.ca](https://metered.ca)
2. Créer un nouveau serveur TURN
3. Noter le username et credential
4. Ajouter dans `.env` :
```env
VITE_TURN_USERNAME=your-username
VITE_TURN_CREDENTIAL=your-credential
```

---

## 🏃 Lancer le Projet

### Mode Développement
```bash
npm run dev
# ou
yarn dev
```

L'application sera accessible sur `http://localhost:5173`

### Mode Production
```bash
npm run build
npm run preview
# ou
yarn build
yarn preview
```

---

## 🧪 Tests

### Tester l'authentification
1. Créer un compte
2. Se connecter
3. Vérifier que le dashboard s'affiche

### Tester une réunion
1. Créer une nouvelle réunion
2. Ouvrir un autre navigateur/onglet privé
3. Rejoindre la réunion avec l'ID
4. Tester :
   - Vidéo/audio
   - Chat
   - Partage d'écran
   - Tableau blanc
   - Liste de tâches

### Tester un live
1. Créer un live
2. Démarrer le live
3. Ouvrir un autre navigateur
4. Rejoindre comme spectateur
5. Tester :
   - Voir/entendre l'hôte
   - Chat
   - Réactions
   - Compteur de spectateurs

---

## 🐛 Troubleshooting

### Problème : "Supabase client not initialized"
**Solution** : Vérifier que les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont dans `.env`

### Problème : "PeerJS connection failed"
**Solution** : 
1. Vérifier la connexion internet
2. Désactiver les bloqueurs de publicités
3. Vérifier que le port 443 n'est pas bloqué
4. Configurer des serveurs TURN

### Problème : "Row Level Security" errors
**Solution** : Vérifier que les policies RLS sont correctement configurées sur Supabase

### Problème : Realtime ne fonctionne pas
**Solution** : 
1. Vérifier que la réplication est activée
2. Vérifier les policies RLS
3. Regarder les logs dans la console du navigateur

---

## 📞 Support

Pour toute question ou problème :
- Email : marcaureladj@gmail.com
- Téléphone : +229 01 95 41 34 47

---

## 🎉 C'est parti !

Une fois configuré, vous pouvez commencer à utiliser MiniMeet !

Bonnes réunions ! 🚀

