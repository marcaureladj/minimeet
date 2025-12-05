-- ═══════════════════════════════════════════════════════════════════
-- 🚨 MIGRATION URGENTE - À EXÉCUTER IMMÉDIATEMENT
-- Date : 5 Décembre 2025
-- Durée estimée : 2-3 minutes
-- ═══════════════════════════════════════════════════════════════════
-- 
-- ⚠️ IMPORTANT : Faire un BACKUP avant d'exécuter ce script !
--
-- Ce script corrige les problèmes critiques :
-- 1. Contrainte room_participants incorrecte
-- 2. Compteur viewer_count automatique
-- 3. Nettoyage participants zombies
-- 4. Nettoyage spectateurs zombies
-- 5. CASCADE pour éviter données orphelines
-- 6. Indexes de performance
-- 7. Colonnes manquantes
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 1 : FIX CONTRAINTE room_participants (CRITIQUE)
-- ═══════════════════════════════════════════════════════════════════

DO $$ 
BEGIN
  -- Supprimer la contrainte UNIQUE sur peer_id seul
  ALTER TABLE room_participants DROP CONSTRAINT IF EXISTS room_participants_peer_id_key;
  RAISE NOTICE '✓ Contrainte peer_id_key supprimée';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Info: Contrainte peer_id_key déjà absente ou erreur: %', SQLERRM;
END $$;

-- Créer un index UNIQUE sur (room_id, peer_id)
DO $$ 
BEGIN
  DROP INDEX IF EXISTS room_participants_unique_peer_per_room;
  CREATE UNIQUE INDEX room_participants_unique_peer_per_room 
    ON room_participants(room_id, peer_id);
  RAISE NOTICE '✓ Index unique (room_id, peer_id) créé';
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 2 : COLONNES MANQUANTES
-- ═══════════════════════════════════════════════════════════════════

-- Colonne last_active pour live_viewers
DO $$ 
BEGIN
  ALTER TABLE live_viewers ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  RAISE NOTICE '✓ Colonne last_active ajoutée à live_viewers';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'Info: Colonne last_active existe déjà';
END $$;

-- Colonnes pour gérer les reconnexions d'hôte
DO $$ 
BEGIN
  ALTER TABLE lives ADD COLUMN IF NOT EXISTS host_reconnected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  RAISE NOTICE '✓ Colonne host_reconnected_at ajoutée à lives';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'Info: Colonne host_reconnected_at existe déjà';
END $$;

-- Colonnes pour tracker l'état audio/vidéo
DO $$ 
BEGIN
  ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS is_mic_muted BOOLEAN DEFAULT FALSE;
  ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS is_cam_off BOOLEAN DEFAULT FALSE;
  RAISE NOTICE '✓ Colonnes is_mic_muted et is_cam_off ajoutées';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'Info: Colonnes état média existent déjà';
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 3 : INDEXES DE PERFORMANCE (CRITIQUE)
-- ═══════════════════════════════════════════════════════════════════

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
CREATE INDEX IF NOT EXISTS idx_live_viewers_last_active ON live_viewers(last_active);

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

DO $$ BEGIN RAISE NOTICE '✓ Tous les indexes créés'; END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 4 : CASCADE POUR ÉVITER DONNÉES ORPHELINES
-- ═══════════════════════════════════════════════════════════════════

-- Messages
DO $$ 
BEGIN
  ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_room_id_fkey;
  ALTER TABLE messages ADD CONSTRAINT messages_room_id_fkey 
    FOREIGN KEY (room_id) REFERENCES meetings(room_id) 
    ON DELETE CASCADE;
  RAISE NOTICE '✓ CASCADE ajouté pour messages';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Info: Erreur CASCADE messages: %', SQLERRM;
END $$;

-- Todos
DO $$ 
BEGIN
  ALTER TABLE todos DROP CONSTRAINT IF EXISTS todos_room_id_fkey;
  ALTER TABLE todos ADD CONSTRAINT todos_room_id_fkey 
    FOREIGN KEY (room_id) REFERENCES meetings(room_id) 
    ON DELETE CASCADE;
  RAISE NOTICE '✓ CASCADE ajouté pour todos';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Info: Erreur CASCADE todos: %', SQLERRM;
END $$;

-- Meeting transcripts
DO $$ 
BEGIN
  ALTER TABLE meeting_transcripts DROP CONSTRAINT IF EXISTS meeting_transcripts_room_id_fkey;
  ALTER TABLE meeting_transcripts ADD CONSTRAINT meeting_transcripts_room_id_fkey 
    FOREIGN KEY (room_id) REFERENCES meetings(room_id) 
    ON DELETE CASCADE;
  RAISE NOTICE '✓ CASCADE ajouté pour meeting_transcripts';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Info: Erreur CASCADE transcripts: %', SQLERRM;
END $$;

-- Meeting summaries
DO $$ 
BEGIN
  ALTER TABLE meeting_summaries DROP CONSTRAINT IF EXISTS meeting_summaries_room_id_fkey;
  ALTER TABLE meeting_summaries ADD CONSTRAINT meeting_summaries_room_id_fkey 
    FOREIGN KEY (room_id) REFERENCES meetings(room_id) 
    ON DELETE CASCADE;
  RAISE NOTICE '✓ CASCADE ajouté pour meeting_summaries';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Info: Erreur CASCADE summaries: %', SQLERRM;
END $$;

-- Room whiteboard
DO $$ 
BEGIN
  ALTER TABLE room_whiteboard DROP CONSTRAINT IF EXISTS room_whiteboard_room_id_fkey;
  ALTER TABLE room_whiteboard ADD CONSTRAINT room_whiteboard_room_id_fkey 
    FOREIGN KEY (room_id) REFERENCES meetings(room_id) 
    ON DELETE CASCADE;
  RAISE NOTICE '✓ CASCADE ajouté pour room_whiteboard';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Info: Erreur CASCADE whiteboard: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 5 : CONTRAINTE UNIQUE meeting_transcripts
-- ═══════════════════════════════════════════════════════════════════

DO $$ 
BEGIN
  -- Vérifier si la contrainte existe déjà
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'meeting_transcripts_room_user_unique'
  ) THEN
    ALTER TABLE meeting_transcripts 
      ADD CONSTRAINT meeting_transcripts_room_user_unique 
      UNIQUE(room_id, user_id);
    RAISE NOTICE '✓ Contrainte UNIQUE ajoutée pour meeting_transcripts';
  ELSE
    RAISE NOTICE 'Info: Contrainte UNIQUE existe déjà';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Info: Erreur contrainte UNIQUE: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 6 : TRIGGER COMPTEUR viewer_count AUTOMATIQUE
-- ═══════════════════════════════════════════════════════════════════

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

DO $$ BEGIN RAISE NOTICE '✓ Trigger compteur viewer_count créé'; END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 7 : FONCTION NETTOYAGE PARTICIPANTS ZOMBIES
-- ═══════════════════════════════════════════════════════════════════

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

DO $$ BEGIN RAISE NOTICE '✓ Fonction cleanup_stale_participants créée'; END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 8 : FONCTION NETTOYAGE SPECTATEURS ZOMBIES
-- ═══════════════════════════════════════════════════════════════════

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

DO $$ BEGIN RAISE NOTICE '✓ Fonction cleanup_stale_live_viewers créée'; END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 9 : FONCTION NETTOYAGE GLOBAL DONNÉES ANCIENNES
-- ═══════════════════════════════════════════════════════════════════

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

DO $$ BEGIN RAISE NOTICE '✓ Fonction cleanup_old_data créée'; END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 10 : TABLE live_bans
-- ═══════════════════════════════════════════════════════════════════

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

DO $$ BEGIN RAISE NOTICE '✓ Table live_bans créée'; END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 11 : RLS AMÉLIORÉS
-- ═══════════════════════════════════════════════════════════════════

-- Activer RLS sur live_bans
ALTER TABLE live_bans ENABLE ROW LEVEL SECURITY;

-- Policies pour live_bans
DROP POLICY IF EXISTS "Only host can ban viewers" ON live_bans;
CREATE POLICY "Only host can ban viewers" 
  ON live_bans FOR INSERT 
  WITH CHECK (
    banned_by = auth.uid() 
    AND live_id IN (SELECT id FROM lives WHERE host_id = auth.uid())
  );

DROP POLICY IF EXISTS "Anyone can view bans" ON live_bans;
CREATE POLICY "Anyone can view bans" 
  ON live_bans FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Améliorer RLS pour todos
DROP POLICY IF EXISTS "Authenticated users can update todos" ON todos;
DROP POLICY IF EXISTS "Active participants can update todos" ON todos;
CREATE POLICY "Active participants can update todos" 
  ON todos FOR UPDATE 
  USING (
    auth.role() = 'authenticated' 
    AND room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id = auth.uid() AND status = 'online'
    )
  );

-- Améliorer RLS pour live_viewers (seul l'hôte peut supprimer/bannir)
DROP POLICY IF EXISTS "Anyone can delete viewers" ON live_viewers;
DROP POLICY IF EXISTS "Only host can delete viewers" ON live_viewers;
CREATE POLICY "Only host can delete viewers" 
  ON live_viewers FOR DELETE 
  USING (
    live_id IN (
      SELECT id FROM lives WHERE host_id = auth.uid()
    )
  );

-- RLS pour reports
DROP POLICY IF EXISTS "Anyone can create reports" ON reports;
DROP POLICY IF EXISTS "Users can only create own reports" ON reports;
CREATE POLICY "Users can only create own reports" 
  ON reports FOR INSERT 
  WITH CHECK (
    auth.uid() = reporter_id
    AND auth.role() = 'authenticated'
  );

DO $$ BEGIN RAISE NOTICE '✓ RLS améliorés'; END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 12 : TRIGGER RATE LIMITING REPORTS
-- ═══════════════════════════════════════════════════════════════════

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

DO $$ BEGIN RAISE NOTICE '✓ Trigger rate limiting reports créé'; END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 13 : TRIGGER AUTO-END MEETING
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION auto_end_meeting(p_room_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM room_participants
  WHERE room_id = p_room_id AND status = 'online';
  
  IF remaining_count = 0 THEN
    UPDATE meetings 
    SET ended_at = NOW()
    WHERE room_id = p_room_id AND ended_at IS NULL;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_meeting_end()
RETURNS TRIGGER AS $$
BEGIN
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

DO $$ BEGIN RAISE NOTICE '✓ Trigger auto-end meeting créé'; END $$;

-- ═══════════════════════════════════════════════════════════════════
-- FINALISATION
-- ═══════════════════════════════════════════════════════════════════

COMMIT;

-- Afficher un résumé
DO $$
DECLARE
  v_stats JSON;
BEGIN
  SELECT json_build_object(
    'total_meetings', (SELECT COUNT(*) FROM meetings),
    'active_meetings', (SELECT COUNT(*) FROM meetings WHERE ended_at IS NULL),
    'total_participants', (SELECT COUNT(*) FROM room_participants),
    'online_participants', (SELECT COUNT(*) FROM room_participants WHERE status = 'online'),
    'total_lives', (SELECT COUNT(*) FROM lives),
    'active_lives', (SELECT COUNT(*) FROM lives WHERE status = 'live')
  ) INTO v_stats;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION TERMINÉE AVEC SUCCÈS !';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Statistiques actuelles :';
  RAISE NOTICE '%', v_stats;
  RAISE NOTICE '';
  RAISE NOTICE 'Actions suivantes :';
  RAISE NOTICE '1. Vérifier les logs ci-dessus pour détecter des erreurs';
  RAISE NOTICE '2. Appliquer les correctifs React (voir CORRECTIFS_PRIORITAIRES.md)';
  RAISE NOTICE '3. Configurer un cron pour appeler cleanup_stale_participants()';
  RAISE NOTICE '4. Configurer un cron pour appeler cleanup_stale_live_viewers()';
  RAISE NOTICE '';
END $$;

