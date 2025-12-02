-- =====================================================
-- TABLES POUR LES FONCTIONNALITÉS DE RÉUNION MINIMEET
-- =====================================================

-- 1. Table pour les transcriptions automatiques des réunions
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_room_id ON meeting_transcripts(room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_user_id ON meeting_transcripts(user_id);

-- RLS pour meeting_transcripts
ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view transcripts of their rooms" ON meeting_transcripts FOR SELECT USING (true);
CREATE POLICY "Users can insert own transcripts" ON meeting_transcripts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. Table pour les résumés IA des réunions
CREATE TABLE IF NOT EXISTS meeting_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript TEXT,
  summary TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_summaries_room_id ON meeting_summaries(room_id);

-- RLS pour meeting_summaries
ALTER TABLE meeting_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view summaries" ON meeting_summaries FOR SELECT USING (true);
CREATE POLICY "Users can insert summaries" ON meeting_summaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update summaries" ON meeting_summaries FOR UPDATE USING (auth.uid() = user_id);

-- 3. Table pour le log des participants (historique d'entrée/sortie)
CREATE TABLE IF NOT EXISTS meeting_participants_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  user_full_name TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_log_room_id ON meeting_participants_log(room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_log_user_id ON meeting_participants_log(user_id);

-- RLS pour meeting_participants_log
ALTER TABLE meeting_participants_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view participant logs" ON meeting_participants_log FOR SELECT USING (true);
CREATE POLICY "Users can insert own logs" ON meeting_participants_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own logs" ON meeting_participants_log FOR UPDATE USING (auth.uid() = user_id);

-- 4. Table pour l'état du tableau blanc (synchronisation temps réel)
CREATE TABLE IF NOT EXISTS room_whiteboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT false,
  initiator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  canvas_data TEXT, -- JSON stringifié des données du canvas
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_whiteboard_room_id ON room_whiteboard(room_id);

-- RLS pour room_whiteboard
ALTER TABLE room_whiteboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view whiteboard" ON room_whiteboard FOR SELECT USING (true);
CREATE POLICY "Anyone can insert whiteboard" ON room_whiteboard FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update whiteboard" ON room_whiteboard FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete whiteboard" ON room_whiteboard FOR DELETE USING (true);

-- 5. Ajouter colonne 'name' à la table meetings si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'name') THEN
    ALTER TABLE meetings ADD COLUMN name TEXT;
  END IF;
END $$;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_meeting_summaries_updated_at
  BEFORE UPDATE ON meeting_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_room_whiteboard_updated_at
  BEFORE UPDATE ON room_whiteboard
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
