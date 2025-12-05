-- ═══════════════════════════════════════════════════════════════════
-- 🔧 SOLUTIONS SQL POUR MINIMEET
-- Date : 5 Décembre 2025
-- ═══════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 1. FIX CONTRAINTE room_participants                             │
-- └─────────────────────────────────────────────────────────────────┘

-- Problème : peer_id UNIQUE empêche un user d'être dans 2 rooms
-- Solution : UNIQUE sur (room_id, peer_id)

ALTER TABLE room_participants DROP CONSTRAINT IF EXISTS room_participants_peer_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS room_participants_unique_peer_per_room 
  ON room_participants(room_id, peer_id);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2. TRIGGER : Compteur de spectateurs automatique               │
-- └─────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION update_live_viewer_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE lives SET viewer_count = (
      SELECT COUNT(*) FROM live_viewers 
      WHERE live_id = NEW.live_id AND left_at IS NULL
    ) WHERE id = NEW.live_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE lives SET viewer_count = (
      SELECT COUNT(*) FROM live_viewers 
      WHERE live_id = OLD.live_id AND left_at IS NULL
    ) WHERE id = OLD.live_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_viewer_count_trigger ON live_viewers;
CREATE TRIGGER live_viewer_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON live_viewers
  FOR EACH ROW EXECUTE FUNCTION update_live_viewer_count();

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 3. NETTOYAGE AUTOMATIQUE : Participants zombies                │
-- └─────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION cleanup_stale_participants()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Marquer comme offline si last_seen > 30 secondes
  UPDATE room_participants 
  SET status = 'offline'
  WHERE status = 'online' 
    AND last_seen < NOW() - INTERVAL '30 seconds';
  
  -- Supprimer si offline depuis plus de 5 minutes
  DELETE FROM room_participants
  WHERE status = 'offline'
    AND last_seen < NOW() - INTERVAL '5 minutes';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Si pg_cron est disponible
-- SELECT cron.schedule('cleanup-participants', '*/1 * * * *', 'SELECT cleanup_stale_participants()');

-- Sinon, appeler manuellement ou via un cron externe

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 4. NETTOYAGE AUTOMATIQUE : Spectateurs zombies                 │
-- └─────────────────────────────────────────────────────────────────┘

-- Ajouter colonne last_active
ALTER TABLE live_viewers ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_live_viewers_last_active ON live_viewers(last_active);

CREATE OR REPLACE FUNCTION cleanup_stale_live_viewers()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE live_viewers 
  SET left_at = NOW()
  WHERE left_at IS NULL 
    AND last_active < NOW() - INTERVAL '30 seconds';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Si pg_cron disponible
-- SELECT cron.schedule('cleanup-live-viewers', '*/1 * * * *', 'SELECT cleanup_stale_live_viewers()');

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 5. CASCADE CORRECT : Supprimer données orphelines              │
-- └─────────────────────────────────────────────────────────────────┘

-- Messages
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_room_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_room_id_fkey 
  FOREIGN KEY (room_id) REFERENCES meetings(room_id) 
  ON DELETE CASCADE;

-- Todos
ALTER TABLE todos DROP CONSTRAINT IF EXISTS todos_room_id_fkey;
ALTER TABLE todos ADD CONSTRAINT todos_room_id_fkey 
  FOREIGN KEY (room_id) REFERENCES meetings(room_id) 
  ON DELETE CASCADE;

-- Meeting transcripts
ALTER TABLE meeting_transcripts DROP CONSTRAINT IF EXISTS meeting_transcripts_room_id_fkey;
ALTER TABLE meeting_transcripts ADD CONSTRAINT meeting_transcripts_room_id_fkey 
  FOREIGN KEY (room_id) REFERENCES meetings(room_id) 
  ON DELETE CASCADE;

-- Meeting summaries
ALTER TABLE meeting_summaries DROP CONSTRAINT IF EXISTS meeting_summaries_room_id_fkey;
ALTER TABLE meeting_summaries ADD CONSTRAINT meeting_summaries_room_id_fkey 
  FOREIGN KEY (room_id) REFERENCES meetings(room_id) 
  ON DELETE CASCADE;

-- Room whiteboard (pas de FK actuellement, en ajouter une)
ALTER TABLE room_whiteboard DROP CONSTRAINT IF EXISTS room_whiteboard_room_id_fkey;
ALTER TABLE room_whiteboard ADD CONSTRAINT room_whiteboard_room_id_fkey 
  FOREIGN KEY (room_id) REFERENCES meetings(room_id) 
  ON DELETE CASCADE;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 6. INDEXES DE PERFORMANCE                                      │
-- └─────────────────────────────────────────────────────────────────┘

-- Meetings
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_room_id ON meetings(room_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at);

-- Room participants
CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_status ON room_participants(status);
CREATE INDEX IF NOT EXISTS idx_room_participants_last_seen ON room_participants(last_seen);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Todos
CREATE INDEX IF NOT EXISTS idx_todos_room_id ON todos(room_id);
CREATE INDEX IF NOT EXISTS idx_todos_is_completed ON todos(is_completed);

-- Lives
CREATE INDEX IF NOT EXISTS idx_lives_host_id ON lives(host_id);
CREATE INDEX IF NOT EXISTS idx_lives_status ON lives(status);
CREATE INDEX IF NOT EXISTS idx_lives_created_at ON lives(created_at);

-- Live viewers
CREATE INDEX IF NOT EXISTS idx_live_viewers_live_id_left_at ON live_viewers(live_id, left_at);
CREATE INDEX IF NOT EXISTS idx_live_viewers_user_id ON live_viewers(user_id);

-- Live comments
CREATE INDEX IF NOT EXISTS idx_live_comments_live_id ON live_comments(live_id);
CREATE INDEX IF NOT EXISTS idx_live_comments_created_at ON live_comments(created_at);

-- Live reactions
CREATE INDEX IF NOT EXISTS idx_live_reactions_live_id ON live_reactions(live_id);
CREATE INDEX IF NOT EXISTS idx_live_reactions_user_id ON live_reactions(user_id);

-- Live guests
CREATE INDEX IF NOT EXISTS idx_live_guests_live_id ON live_guests(live_id);
CREATE INDEX IF NOT EXISTS idx_live_guests_user_id ON live_guests(user_id);
CREATE INDEX IF NOT EXISTS idx_live_guests_status ON live_guests(status);

-- Meeting participants log
CREATE INDEX IF NOT EXISTS idx_meeting_participants_log_room_id ON meeting_participants_log(room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_log_user_id ON meeting_participants_log(user_id);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 7. CONTRAINTE UNIQUE : meeting_transcripts                     │
-- └─────────────────────────────────────────────────────────────────┘

-- Éviter plusieurs transcripts pour le même user/room
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'meeting_transcripts_room_user_unique'
  ) THEN
    ALTER TABLE meeting_transcripts 
      ADD CONSTRAINT meeting_transcripts_room_user_unique 
      UNIQUE(room_id, user_id);
  END IF;
END $$;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 8. FONCTION : Nettoyage global des anciennes données          │
-- └─────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE(
  entity TEXT,
  deleted_count INTEGER
) AS $$
DECLARE
  count_participants INTEGER;
  count_viewers INTEGER;
  count_reactions INTEGER;
  count_lives INTEGER;
  count_messages INTEGER;
BEGIN
  -- 1. Nettoyer participants offline > 1 heure
  DELETE FROM room_participants 
  WHERE status = 'offline' 
    AND last_seen < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS count_participants = ROW_COUNT;
  
  -- 2. Nettoyer viewers qui ont quitté > 7 jours
  DELETE FROM live_viewers 
  WHERE left_at IS NOT NULL 
    AND left_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS count_viewers = ROW_COUNT;
  
  -- 3. Nettoyer réactions > 30 jours
  DELETE FROM live_reactions 
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS count_reactions = ROW_COUNT;
  
  -- 4. Nettoyer lives terminés > 90 jours
  DELETE FROM lives 
  WHERE status = 'ended' 
    AND ended_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS count_lives = ROW_COUNT;
  
  -- 5. Nettoyer messages de rooms inactives > 30 jours
  DELETE FROM messages 
  WHERE room_id IN (
    SELECT room_id FROM meetings 
    WHERE created_at < NOW() - INTERVAL '30 days'
      AND (ended_at IS NOT NULL OR ended_at < NOW() - INTERVAL '30 days')
  );
  GET DIAGNOSTICS count_messages = ROW_COUNT;
  
  -- Retourner les résultats
  RETURN QUERY SELECT 'participants'::TEXT, count_participants;
  RETURN QUERY SELECT 'viewers'::TEXT, count_viewers;
  RETURN QUERY SELECT 'reactions'::TEXT, count_reactions;
  RETURN QUERY SELECT 'lives'::TEXT, count_lives;
  RETURN QUERY SELECT 'messages'::TEXT, count_messages;
END;
$$ LANGUAGE plpgsql;

-- Job quotidien à 2h du matin
-- SELECT cron.schedule('daily-cleanup', '0 2 * * *', 'SELECT cleanup_old_data()');

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 9. AJOUTS DE COLONNES UTILES                                   │
-- └─────────────────────────────────────────────────────────────────┘

-- Pour gérer les reconnexions d'hôte
ALTER TABLE lives 
  ADD COLUMN IF NOT EXISTS host_reconnected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Pour tracker l'état audio/vidéo des participants
ALTER TABLE room_participants 
  ADD COLUMN IF NOT EXISTS is_mic_muted BOOLEAN DEFAULT FALSE;

ALTER TABLE room_participants 
  ADD COLUMN IF NOT EXISTS is_cam_off BOOLEAN DEFAULT FALSE;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 10. TABLE : live_bans (pour bannir des spectateurs)           │
-- └─────────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS live_bans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  live_id UUID REFERENCES lives(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  banned_by UUID REFERENCES auth.users(id) NOT NULL,
  reason TEXT,
  banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(live_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_bans_live_id ON live_bans(live_id);
CREATE INDEX IF NOT EXISTS idx_live_bans_user_id ON live_bans(user_id);

-- RLS pour live_bans
ALTER TABLE live_bans ENABLE ROW LEVEL SECURITY;

-- Seul l'hôte peut bannir
CREATE POLICY "Only host can ban viewers" 
  ON live_bans FOR INSERT 
  WITH CHECK (
    banned_by = auth.uid() 
    AND live_id IN (SELECT id FROM lives WHERE host_id = auth.uid())
  );

-- Tous peuvent voir les bans (pour vérifier si un user est banni)
CREATE POLICY "Anyone can view bans" 
  ON live_bans FOR SELECT 
  USING (auth.role() = 'authenticated');

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 11. TRIGGER : Rate limiting sur reports                        │
-- └─────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION check_report_limit()
RETURNS TRIGGER AS $$
DECLARE
  report_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO report_count
  FROM reports
  WHERE reporter_id = NEW.reporter_id
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF report_count >= 10 THEN
    RAISE EXCEPTION 'Limite de signalements atteinte (10/heure)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS report_limit_trigger ON reports;
CREATE TRIGGER report_limit_trigger
  BEFORE INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION check_report_limit();

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 12. RLS AMÉLIORÉS                                              │
-- └─────────────────────────────────────────────────────────────────┘

-- Todos : Seulement les participants actifs peuvent modifier
DROP POLICY IF EXISTS "Authenticated users can update todos" ON todos;
CREATE POLICY "Active participants can update todos" 
  ON todos FOR UPDATE 
  USING (
    auth.role() = 'authenticated' 
    AND room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id = auth.uid() AND status = 'online'
    )
  );

-- Live viewers : Seulement l'hôte peut supprimer (ban)
DROP POLICY IF EXISTS "Anyone can delete viewers" ON live_viewers;
CREATE POLICY "Only host can delete viewers" 
  ON live_viewers FOR DELETE 
  USING (
    live_id IN (
      SELECT id FROM lives WHERE host_id = auth.uid()
    )
  );

-- Reports : Limiter les INSERT
DROP POLICY IF EXISTS "Anyone can create reports" ON reports;
CREATE POLICY "Users can only create own reports" 
  ON reports FOR INSERT 
  WITH CHECK (
    auth.uid() = reporter_id
    AND auth.role() = 'authenticated'
  );

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 13. VUES UTILES POUR LES STATS                                 │
-- └─────────────────────────────────────────────────────────────────┘

-- Vue : Meetings actifs avec compteur de participants
CREATE OR REPLACE VIEW active_meetings AS
SELECT 
  m.*,
  COUNT(DISTINCT rp.user_id) as active_participants,
  ARRAY_AGG(DISTINCT rp.user_full_name) FILTER (WHERE rp.status = 'online') as participant_names
FROM meetings m
LEFT JOIN room_participants rp ON m.room_id = rp.room_id AND rp.status = 'online'
WHERE m.ended_at IS NULL
GROUP BY m.id;

-- Vue : Lives actifs avec stats
CREATE OR REPLACE VIEW active_lives AS
SELECT 
  l.*,
  COUNT(DISTINCT lv.user_id) FILTER (WHERE lv.left_at IS NULL) as current_viewers,
  COUNT(DISTINCT lg.user_id) FILTER (WHERE lg.status = 'joined') as active_guests,
  p.full_name as host_name,
  p.avatar_url as host_avatar
FROM lives l
LEFT JOIN live_viewers lv ON l.id = lv.live_id
LEFT JOIN live_guests lg ON l.id = lg.live_id
LEFT JOIN profiles p ON l.host_id = p.id
WHERE l.status = 'live'
GROUP BY l.id, p.full_name, p.avatar_url;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 14. FONCTION : Marquer réunion comme terminée                  │
-- └─────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION auto_end_meeting(p_room_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  remaining_count INTEGER;
BEGIN
  -- Compter les participants encore online
  SELECT COUNT(*) INTO remaining_count
  FROM room_participants
  WHERE room_id = p_room_id AND status = 'online';
  
  -- Si aucun participant, marquer comme terminée
  IF remaining_count = 0 THEN
    UPDATE meetings 
    SET ended_at = NOW()
    WHERE room_id = p_room_id AND ended_at IS NULL;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Trigger automatique quand un participant part
CREATE OR REPLACE FUNCTION check_meeting_end()
RETURNS TRIGGER AS $$
BEGIN
  -- Si status passe à offline, vérifier si c'était le dernier
  IF NEW.status = 'offline' OR TG_OP = 'DELETE' THEN
    PERFORM auto_end_meeting(COALESCE(NEW.room_id, OLD.room_id));
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_end_meeting_trigger ON room_participants;
CREATE TRIGGER auto_end_meeting_trigger
  AFTER UPDATE OR DELETE ON room_participants
  FOR EACH ROW EXECUTE FUNCTION check_meeting_end();

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 15. FONCTION UTILITAIRE : Statistiques globales               │
-- └─────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION get_global_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_meetings', (SELECT COUNT(*) FROM meetings),
    'active_meetings', (SELECT COUNT(*) FROM meetings WHERE ended_at IS NULL),
    'total_users', (SELECT COUNT(*) FROM profiles),
    'active_lives', (SELECT COUNT(*) FROM lives WHERE status = 'live'),
    'total_messages', (SELECT COUNT(*) FROM messages),
    'zombies', json_build_object(
      'stale_participants', (SELECT COUNT(*) FROM room_participants WHERE status = 'online' AND last_seen < NOW() - INTERVAL '30 seconds'),
      'stale_viewers', (SELECT COUNT(*) FROM live_viewers WHERE left_at IS NULL AND last_active < NOW() - INTERVAL '30 seconds')
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Utilisation : SELECT get_global_stats();

-- ═══════════════════════════════════════════════════════════════════
-- ✅ FIN DES SOLUTIONS SQL
-- ═══════════════════════════════════════════════════════════════════

-- Pour appliquer ce script :
-- 1. Sauvegarder votre base de données
-- 2. Tester sur un environnement de développement d'abord
-- 3. Exécuter ce script via l'éditeur SQL de Supabase
-- 4. Vérifier les logs pour détecter les erreurs

-- Note : Certaines fonctionnalités (pg_cron) nécessitent une extension.
-- Si pg_cron n'est pas disponible, utilisez un cron externe pour appeler les fonctions.

