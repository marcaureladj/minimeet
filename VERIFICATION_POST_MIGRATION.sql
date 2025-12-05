-- ═══════════════════════════════════════════════════════════════════
-- 🔍 VÉRIFICATION POST-MIGRATION
-- Vérifier que tout a été correctement installé
-- ═══════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 1. CONTRAINTE room_participants                                 │
-- └─────────────────────────────────────────────────────────────────┘
SELECT 
    '1. Contrainte room_participants' as verification,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'room_participants_unique_peer_per_room'
        ) THEN '✅ OK - Multi-réunions possibles'
        ELSE '❌ MANQUANT - Un user ne peut être que dans 1 réunion'
    END as status;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2. INDEXES DE PERFORMANCE                                       │
-- └─────────────────────────────────────────────────────────────────┘
SELECT 
    '2. Indexes de performance' as verification,
    COUNT(*) || ' indexes créés (attendu: ≥25)' as status,
    CASE 
        WHEN COUNT(*) >= 25 THEN '✅'
        ELSE '⚠️'
    END as resultat
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%';

-- Détail des indexes principaux
SELECT 
    '   → ' || tablename as table_name,
    COUNT(*) as nombre_indexes
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%'
GROUP BY tablename
ORDER BY tablename;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 3. COLONNES AJOUTÉES                                            │
-- └─────────────────────────────────────────────────────────────────┘
SELECT 
    '3. Colonnes ajoutées' as verification,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'live_viewers' AND column_name = 'last_active'
        ) THEN '✅ live_viewers.last_active'
        ELSE '❌ live_viewers.last_active MANQUANT'
    END as status_1,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'lives' AND column_name = 'host_reconnected_at'
        ) THEN '✅ lives.host_reconnected_at'
        ELSE '❌ lives.host_reconnected_at MANQUANT'
    END as status_2,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_participants' AND column_name = 'is_mic_muted'
        ) THEN '✅ room_participants.is_mic_muted'
        ELSE '❌ room_participants.is_mic_muted MANQUANT'
    END as status_3;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 4. TRIGGERS                                                      │
-- └─────────────────────────────────────────────────────────────────┘
SELECT 
    '4. Triggers' as verification,
    tgname as trigger_name,
    '✅ sur ' || tgrelid::regclass::text as table_name
FROM pg_trigger 
WHERE tgname IN (
    'live_viewer_count_trigger',
    'report_limit_trigger',
    'auto_end_meeting_trigger'
)
ORDER BY tgname;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 5. FONCTIONS                                                     │
-- └─────────────────────────────────────────────────────────────────┘
SELECT 
    '5. Fonctions' as verification,
    routine_name as fonction,
    '✅' as status
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
    )
ORDER BY routine_name;

-- Vérifier si toutes les fonctions sont présentes
SELECT 
    '   → Total fonctions' as info,
    COUNT(*) || ' / 7' as status,
    CASE 
        WHEN COUNT(*) = 7 THEN '✅ Toutes présentes'
        WHEN COUNT(*) >= 5 THEN '⚠️ Certaines manquantes'
        ELSE '❌ Beaucoup manquantes'
    END as resultat
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

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 6. TABLE live_bans                                              │
-- └─────────────────────────────────────────────────────────────────┘
SELECT 
    '6. Table live_bans' as verification,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'live_bans'
        ) THEN '✅ Table créée'
        ELSE '❌ Table manquante'
    END as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'live_bans'
        ) THEN (
            SELECT COUNT(*) || ' colonnes'
            FROM information_schema.columns 
            WHERE table_name = 'live_bans'
        )
        ELSE NULL
    END as details;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 7. CASCADE CONFIGURÉ                                            │
-- └─────────────────────────────────────────────────────────────────┘
SELECT 
    '7. CASCADE sur FK' as verification,
    conrelid::regclass::text as table_name,
    confrelid::regclass::text as references,
    CASE confdeltype 
        WHEN 'c' THEN '✅ CASCADE'
        WHEN 'a' THEN '⚠️ NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END as on_delete
FROM pg_constraint
WHERE contype = 'f'
    AND connamespace = 'public'::regnamespace
    AND conrelid::regclass::text IN (
        'messages', 
        'todos', 
        'meeting_transcripts', 
        'meeting_summaries',
        'room_whiteboard'
    )
ORDER BY conrelid::regclass::text;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 8. RLS POLICIES                                                  │
-- └─────────────────────────────────────────────────────────────────┘
SELECT 
    '8. RLS Policies' as verification,
    tablename,
    policyname,
    '✅' as status
FROM pg_policies
WHERE policyname IN (
    'Active participants can update todos',
    'Only host can delete viewers',
    'Users can only create own reports',
    'Only host can ban viewers',
    'Anyone can view bans'
)
ORDER BY tablename, policyname;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 9. STATISTIQUES ACTUELLES                                       │
-- └─────────────────────────────────────────────────────────────────┘
SELECT 
    '9. Statistiques actuelles' as section;

SELECT 
    'Meetings actifs' as metrique,
    COUNT(*) as valeur
FROM meetings WHERE ended_at IS NULL
UNION ALL
SELECT 
    'Participants online' as metrique,
    COUNT(*) as valeur
FROM room_participants WHERE status = 'online'
UNION ALL
SELECT 
    'Lives actifs' as metrique,
    COUNT(*) as valeur
FROM lives WHERE status = 'live'
UNION ALL
SELECT 
    'Viewers actifs' as metrique,
    COUNT(*) as valeur
FROM live_viewers WHERE left_at IS NULL;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 10. DÉTECTION ZOMBIES                                           │
-- └─────────────────────────────────────────────────────────────────┘
SELECT 
    '10. Détection zombies' as section;

SELECT 
    'Participants zombies (>30s sans heartbeat)' as type,
    COUNT(*) as nombre,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Aucun'
        WHEN COUNT(*) < 5 THEN '⚠️ Quelques-uns'
        ELSE '❌ Beaucoup'
    END as status
FROM room_participants 
WHERE status = 'online' 
    AND last_seen < NOW() - INTERVAL '30 seconds'
UNION ALL
SELECT 
    'Viewers zombies (>30s sans heartbeat)' as type,
    COUNT(*) as nombre,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Aucun'
        WHEN COUNT(*) < 5 THEN '⚠️ Quelques-uns'
        ELSE '❌ Beaucoup'
    END as status
FROM live_viewers 
WHERE left_at IS NULL 
    AND last_active < NOW() - INTERVAL '30 seconds';

-- ═══════════════════════════════════════════════════════════════════
-- RÉSUMÉ GLOBAL
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
    checks_passed INTEGER := 0;
    total_checks INTEGER := 8;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE NOTICE 'RÉSUMÉ DE LA VÉRIFICATION';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    
    -- Check 1: room_participants constraint
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'room_participants_unique_peer_per_room') THEN
        checks_passed := checks_passed + 1;
        RAISE NOTICE '✅ 1/8 - Contrainte room_participants : OK';
    ELSE
        RAISE NOTICE '❌ 1/8 - Contrainte room_participants : MANQUANT';
    END IF;
    
    -- Check 2: Indexes
    IF (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%') >= 25 THEN
        checks_passed := checks_passed + 1;
        RAISE NOTICE '✅ 2/8 - Indexes de performance : OK';
    ELSE
        RAISE NOTICE '⚠️ 2/8 - Indexes de performance : Incomplets';
    END IF;
    
    -- Check 3: Colonnes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_viewers' AND column_name = 'last_active') THEN
        checks_passed := checks_passed + 1;
        RAISE NOTICE '✅ 3/8 - Nouvelles colonnes : OK';
    ELSE
        RAISE NOTICE '❌ 3/8 - Nouvelles colonnes : MANQUANT';
    END IF;
    
    -- Check 4: Triggers
    IF (SELECT COUNT(*) FROM pg_trigger WHERE tgname IN ('live_viewer_count_trigger', 'report_limit_trigger', 'auto_end_meeting_trigger')) = 3 THEN
        checks_passed := checks_passed + 1;
        RAISE NOTICE '✅ 4/8 - Triggers : OK';
    ELSE
        RAISE NOTICE '⚠️ 4/8 - Triggers : Incomplets';
    END IF;
    
    -- Check 5: Fonctions
    IF (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('update_live_viewer_count', 'cleanup_stale_participants', 'cleanup_stale_live_viewers', 'cleanup_old_data', 'check_report_limit', 'auto_end_meeting', 'check_meeting_end')) >= 6 THEN
        checks_passed := checks_passed + 1;
        RAISE NOTICE '✅ 5/8 - Fonctions : OK';
    ELSE
        RAISE NOTICE '⚠️ 5/8 - Fonctions : Incomplètes';
    END IF;
    
    -- Check 6: Table live_bans
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'live_bans') THEN
        checks_passed := checks_passed + 1;
        RAISE NOTICE '✅ 6/8 - Table live_bans : OK';
    ELSE
        RAISE NOTICE '❌ 6/8 - Table live_bans : MANQUANT';
    END IF;
    
    -- Check 7: CASCADE (au moins 3 tables)
    IF (SELECT COUNT(*) FROM pg_constraint WHERE contype = 'f' AND confdeltype = 'c' AND conrelid::regclass::text IN ('messages', 'todos', 'meeting_transcripts')) >= 3 THEN
        checks_passed := checks_passed + 1;
        RAISE NOTICE '✅ 7/8 - CASCADE sur FK : OK';
    ELSE
        RAISE NOTICE '⚠️ 7/8 - CASCADE sur FK : Incomplet';
    END IF;
    
    -- Check 8: RLS (au moins 2 policies)
    IF (SELECT COUNT(*) FROM pg_policies WHERE policyname IN ('Active participants can update todos', 'Only host can delete viewers', 'Users can only create own reports')) >= 2 THEN
        checks_passed := checks_passed + 1;
        RAISE NOTICE '✅ 8/8 - RLS Policies : OK';
    ELSE
        RAISE NOTICE '⚠️ 8/8 - RLS Policies : Incomplètes';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '───────────────────────────────────────────────────────────────────';
    
    IF checks_passed = total_checks THEN
        RAISE NOTICE '🎉 PARFAIT ! Tous les tests sont passés (%/%) !', checks_passed, total_checks;
    ELSIF checks_passed >= total_checks - 1 THEN
        RAISE NOTICE '✅ TRÈS BIEN ! %/% tests passés', checks_passed, total_checks;
    ELSIF checks_passed >= total_checks - 2 THEN
        RAISE NOTICE '⚠️ CORRECT. %/% tests passés, quelques ajustements recommandés', checks_passed, total_checks;
    ELSE
        RAISE NOTICE '❌ ATTENTION ! Seulement %/% tests passés. Vérifiez les erreurs ci-dessus.', checks_passed, total_checks;
    END IF;
    
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;

