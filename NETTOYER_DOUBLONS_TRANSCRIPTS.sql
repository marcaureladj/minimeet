-- ═══════════════════════════════════════════════════════════════════
-- 🧹 NETTOYAGE DES DOUBLONS - meeting_transcripts
-- ═══════════════════════════════════════════════════════════════════
-- 
-- Ce script nettoie les transcripts dupliqués et ajoute la contrainte UNIQUE
-- À exécuter SEULEMENT si vous avez eu l'erreur de doublons
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- Étape 1 : Voir combien de doublons existent
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT room_id, user_id, COUNT(*) as count
    FROM meeting_transcripts
    GROUP BY room_id, user_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  RAISE NOTICE 'Nombre de paires (room_id, user_id) dupliquées : %', duplicate_count;
END $$;

-- Étape 2 : Afficher les doublons (pour info)
SELECT 
  room_id,
  user_id,
  COUNT(*) as nombre_copies,
  MIN(created_at) as premier_transcript,
  MAX(created_at) as dernier_transcript
FROM meeting_transcripts
GROUP BY room_id, user_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Étape 3 : Créer une table temporaire avec les IDs à garder
-- On garde le transcript le plus récent (updated_at le plus grand)
CREATE TEMP TABLE transcripts_to_keep AS
SELECT DISTINCT ON (room_id, user_id) id
FROM meeting_transcripts
ORDER BY room_id, user_id, updated_at DESC NULLS LAST, created_at DESC;

-- Étape 4 : Supprimer les doublons (garder seulement les plus récents)
DELETE FROM meeting_transcripts
WHERE id NOT IN (SELECT id FROM transcripts_to_keep);

-- Étape 5 : Vérifier qu'il n'y a plus de doublons
DO $$
DECLARE
  remaining_duplicates INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_duplicates
  FROM (
    SELECT room_id, user_id, COUNT(*) as count
    FROM meeting_transcripts
    GROUP BY room_id, user_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF remaining_duplicates = 0 THEN
    RAISE NOTICE '✅ Tous les doublons ont été supprimés !';
  ELSE
    RAISE NOTICE '⚠️ Il reste encore % doublons', remaining_duplicates;
  END IF;
END $$;

-- Étape 6 : Ajouter la contrainte UNIQUE
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'meeting_transcripts_room_user_unique'
  ) THEN
    ALTER TABLE meeting_transcripts 
      ADD CONSTRAINT meeting_transcripts_room_user_unique 
      UNIQUE(room_id, user_id);
    RAISE NOTICE '✅ Contrainte UNIQUE ajoutée avec succès !';
  ELSE
    RAISE NOTICE 'ℹ️ Contrainte UNIQUE existe déjà';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Erreur lors de l''ajout de la contrainte : %', SQLERRM;
  RAISE;
END $$;

COMMIT;

-- Afficher le résultat final
SELECT 
  '✅ NETTOYAGE TERMINÉ' as status,
  COUNT(*) as nombre_total_transcripts
FROM meeting_transcripts;

