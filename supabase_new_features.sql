-- =====================================================
-- NOUVELLES TABLES POUR MINIMEET (VERSION SAFE)
-- =====================================================

-- 1. Ajouter avatar_url à profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Table pour les signalements
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('message', 'room', 'live', 'comment')),
  target_id TEXT NOT NULL,
  room_id TEXT,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Users can view own reports" ON reports;

-- Recréer les politiques
CREATE POLICY "Users can create reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view own reports" ON reports FOR SELECT USING (auth.uid() = reporter_id);

-- 3. Table pour les lives
CREATE TABLE IF NOT EXISTS public.lives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  viewer_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lives_host ON lives(host_id);
CREATE INDEX IF NOT EXISTS idx_lives_status ON lives(status);

ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view lives" ON lives;
DROP POLICY IF EXISTS "Hosts can create lives" ON lives;
DROP POLICY IF EXISTS "Hosts can update own lives" ON lives;
DROP POLICY IF EXISTS "Hosts can delete own lives" ON lives;

CREATE POLICY "Anyone can view lives" ON lives FOR SELECT USING (true);
CREATE POLICY "Hosts can create lives" ON lives FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts can update own lives" ON lives FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Hosts can delete own lives" ON lives FOR DELETE USING (auth.uid() = host_id);

-- 4. Table pour les invités des lives
CREATE TABLE IF NOT EXISTS public.live_guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  live_id UUID NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'joined')),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(live_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_guests_live ON live_guests(live_id);
CREATE INDEX IF NOT EXISTS idx_live_guests_user ON live_guests(user_id);

ALTER TABLE public.live_guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view guests" ON live_guests;
DROP POLICY IF EXISTS "Hosts can manage guests" ON live_guests;
DROP POLICY IF EXISTS "Users can update own guest status" ON live_guests;

CREATE POLICY "Anyone can view guests" ON live_guests FOR SELECT USING (true);
CREATE POLICY "Hosts can manage guests" ON live_guests FOR ALL USING (
  EXISTS (SELECT 1 FROM lives WHERE lives.id = live_guests.live_id AND lives.host_id = auth.uid())
);
CREATE POLICY "Users can update own guest status" ON live_guests FOR UPDATE USING (auth.uid() = user_id);

-- 5. Table pour les commentaires des lives
CREATE TABLE IF NOT EXISTS public.live_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  live_id UUID NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_comments_live ON live_comments(live_id);

ALTER TABLE public.live_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view comments" ON live_comments;
DROP POLICY IF EXISTS "Users can create comments" ON live_comments;

CREATE POLICY "Anyone can view comments" ON live_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON live_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Table pour les réactions des lives
CREATE TABLE IF NOT EXISTS public.live_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  live_id UUID NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'wow', 'clap', 'fire')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_reactions_live ON live_reactions(live_id);

ALTER TABLE public.live_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reactions" ON live_reactions;
DROP POLICY IF EXISTS "Users can create reactions" ON live_reactions;

CREATE POLICY "Anyone can view reactions" ON live_reactions FOR SELECT USING (true);
CREATE POLICY "Users can create reactions" ON live_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. Table pour les spectateurs des lives
CREATE TABLE IF NOT EXISTS public.live_viewers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  live_id UUID NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(live_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_viewers_live ON live_viewers(live_id);

ALTER TABLE public.live_viewers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view viewers" ON live_viewers;
DROP POLICY IF EXISTS "Users can manage own viewer status" ON live_viewers;

CREATE POLICY "Anyone can view viewers" ON live_viewers FOR SELECT USING (true);
CREATE POLICY "Users can manage own viewer status" ON live_viewers FOR ALL USING (auth.uid() = user_id);
