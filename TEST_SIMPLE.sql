-- ═══════════════════════════════════════════════════════════════════
-- 🧪 TEST RAPIDE - Vérifier que tout fonctionne
-- ═══════════════════════════════════════════════════════════════════

-- Test 1 : Vérifier la contrainte room_participants
SELECT 
    'Test 1: Contrainte room_participants' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'room_participants_unique_peer_per_room'
        ) THEN '✅ OK'
        ELSE '❌ MANQUANT'
    END as resultat;

-- Test 2 : Vérifier les indexes
SELECT 
    'Test 2: Indexes créés' as test,
    COUNT(*) || ' indexes trouvés (attendu: ~30)' as resultat
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%';

-- Test 3 : Vérifier le trigger viewer_count
SELECT 
    'Test 3: Trigger viewer_count' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger 
            WHERE tgname = 'live_viewer_count_trigger'
        ) THEN '✅ OK'
        ELSE '❌ MANQUANT'
    END as resultat;

-- Test 4 : Vérifier les fonctions
SELECT 
    'Test 4: Fonctions créées' as test,
    COUNT(*) || ' fonctions (attendu: 6)' as resultat
FROM information_schema.routines 
WHERE routine_schema = 'public'
    AND routine_name IN (
        'update_live_viewer_count',
        'cleanup_stale_participants',
        'cleanup_stale_live_viewers',
        'cleanup_old_data',
        'check_report_limit',
        'auto_end_meeting',
        'check_meeting_end'
    );

-- Test 5 : Vérifier la colonne last_active
SELECT 
    'Test 5: Colonne last_active' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'live_viewers' 
                AND column_name = 'last_active'
        ) THEN '✅ OK'
        ELSE '❌ MANQUANT'
    END as resultat;

-- Test 6 : Vérifier la table live_bans
SELECT 
    'Test 6: Table live_bans' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'live_bans'
        ) THEN '✅ OK'
        ELSE '❌ MANQUANT'
    END as resultat;

-- Résumé global
SELECT 
    '═══════════════════════════════════════' as separation,
    'RÉSUMÉ' as titre;

SELECT 
    CASE 
        WHEN COUNT(*) = 6 THEN '✅ TOUS LES TESTS PASSÉS !'
        ELSE '⚠️ Certains tests ont échoué'
    END as resultat_final
FROM (
    SELECT 1 WHERE EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'room_participants_unique_peer_per_room')
    UNION ALL SELECT 1 WHERE EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'live_viewer_count_trigger')
    UNION ALL SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_viewers' AND column_name = 'last_active')
    UNION ALL SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'live_bans')
    UNION ALL SELECT 1 WHERE (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%') >= 25
    UNION ALL SELECT 1 WHERE (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('update_live_viewer_count', 'cleanup_stale_participants', 'cleanup_stale_live_viewers', 'cleanup_old_data', 'check_report_limit', 'auto_end_meeting', 'check_meeting_end')) >= 6
) tests;

