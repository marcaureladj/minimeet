# 📘 Guide d'Installation SQL - MiniMeet

## Date : 5 Décembre 2025

---

## ⚠️ AVANT DE COMMENCER

### Prérequis

1. **Accès Supabase** : Vous devez avoir accès à votre dashboard Supabase
2. **Backup** : IMPÉRATIF - Faites un backup de votre base de données
3. **Temps estimé** : 5-10 minutes
4. **Environnement** : Testez d'abord sur un environnement de développement

---

## 🔄 ÉTAPE 1 : BACKUP

### Via Supabase Dashboard

1. Aller dans **Database** > **Backups**
2. Cliquer sur **Create backup**
3. Attendre la confirmation

### Via CLI (alternative)

```bash
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 🚀 ÉTAPE 2 : EXÉCUTER LE SCRIPT DE MIGRATION

### Méthode 1 : Via Supabase Dashboard (Recommandé)

1. **Ouvrir le SQL Editor**
   - Aller dans votre projet Supabase
   - Cliquer sur **SQL Editor** dans le menu de gauche
   - Cliquer sur **New query**

2. **Copier le script**
   - Ouvrir le fichier `MIGRATION_URGENTE.sql`
   - Copier TOUT le contenu (Ctrl+A, Ctrl+C)

3. **Coller et exécuter**
   - Coller dans l'éditeur SQL
   - Cliquer sur **Run** (ou F5)

4. **Vérifier les résultats**
   - Vérifier qu'il n'y a pas d'erreurs en rouge
   - Vous devriez voir des messages "✓" verts
   - À la fin, un résumé JSON avec les statistiques

### Méthode 2 : Via CLI Supabase

```bash
# Connexion à votre projet
supabase link --project-ref your-project-ref

# Exécuter le script
supabase db execute -f MIGRATION_URGENTE.sql
```

---

## ✅ ÉTAPE 3 : VÉRIFICATION

### Vérifier les contraintes

```sql
-- Vérifier la contrainte room_participants
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'room_participants'::regclass;

-- Devrait afficher : room_participants_unique_peer_per_room
```

### Vérifier les indexes

```sql
-- Lister tous les indexes créés
SELECT 
    tablename, 
    indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Vous devriez voir tous les indexes créés (idx_meetings_user_id, etc.)
```

### Vérifier les triggers

```sql
-- Lister les triggers actifs
SELECT 
    trigger_name, 
    event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- Devrait inclure :
-- - live_viewer_count_trigger sur live_viewers
-- - report_limit_trigger sur reports
-- - auto_end_meeting_trigger sur room_participants
```

### Vérifier les fonctions

```sql
-- Lister les fonctions créées
SELECT 
    routine_name 
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

-- Toutes ces fonctions devraient être listées
```

### Tester les fonctions de nettoyage

```sql
-- Tester cleanup_stale_participants (sans vraiment supprimer si pas de zombies)
SELECT cleanup_stale_participants();

-- Tester cleanup_stale_live_viewers
SELECT cleanup_stale_live_viewers();

-- Voir les statistiques
SELECT 
    'participants online' as metric, 
    COUNT(*) as count 
FROM room_participants 
WHERE status = 'online'
UNION ALL
SELECT 
    'viewers actifs' as metric, 
    COUNT(*) as count 
FROM live_viewers 
WHERE left_at IS NULL;
```

---

## 🔧 ÉTAPE 4 : CONFIGURATION DES CRONS (OPTIONNEL)

Pour que le nettoyage automatique fonctionne, vous avez 2 options :

### Option A : pg_cron (Si disponible)

```sql
-- Vérifier si pg_cron est disponible
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Si oui, activer les crons
SELECT cron.schedule(
    'cleanup-participants', 
    '*/1 * * * *',  -- Toutes les minutes
    'SELECT cleanup_stale_participants()'
);

SELECT cron.schedule(
    'cleanup-live-viewers', 
    '*/1 * * * *',
    'SELECT cleanup_stale_live_viewers()'
);

SELECT cron.schedule(
    'daily-cleanup', 
    '0 2 * * *',  -- Tous les jours à 2h du matin
    'SELECT cleanup_old_data()'
);
```

### Option B : Edge Function (Recommandé pour Supabase)

1. **Créer une Edge Function**

```bash
supabase functions new cleanup-cron
```

2. **Éditer le fichier** `supabase/functions/cleanup-cron/index.ts` :

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Nettoyer les participants zombies
    const { data: participants } = await supabase.rpc('cleanup_stale_participants');
    console.log('Participants nettoyés:', participants);

    // Nettoyer les viewers zombies
    const { data: viewers } = await supabase.rpc('cleanup_stale_live_viewers');
    console.log('Viewers nettoyés:', viewers);

    return new Response(
      JSON.stringify({ 
        success: true, 
        participants, 
        viewers 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

3. **Déployer**

```bash
supabase functions deploy cleanup-cron
```

4. **Configurer un cron externe** (GitHub Actions, cron-job.org, etc.) pour appeler cette fonction toutes les minutes :

```bash
curl -X POST https://your-project.supabase.co/functions/v1/cleanup-cron \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Option C : Cron Système (Si vous avez un serveur)

```bash
# Éditer le crontab
crontab -e

# Ajouter ces lignes
*/1 * * * * curl -X POST "https://your-project.supabase.co/rest/v1/rpc/cleanup_stale_participants" -H "apikey: YOUR_SERVICE_ROLE_KEY" -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
*/1 * * * * curl -X POST "https://your-project.supabase.co/rest/v1/rpc/cleanup_stale_live_viewers" -H "apikey: YOUR_SERVICE_ROLE_KEY" -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
0 2 * * * curl -X POST "https://your-project.supabase.co/rest/v1/rpc/cleanup_old_data" -H "apikey: YOUR_SERVICE_ROLE_KEY" -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

---

## 📊 ÉTAPE 5 : MONITORING

### Créer une vue de monitoring

```sql
CREATE OR REPLACE VIEW monitoring_stats AS
SELECT 
  'Meetings actifs' as metric,
  COUNT(*) as value
FROM meetings WHERE ended_at IS NULL
UNION ALL
SELECT 
  'Participants online' as metric,
  COUNT(*) as value
FROM room_participants WHERE status = 'online'
UNION ALL
SELECT 
  'Participants zombies (>30s)' as metric,
  COUNT(*) as value
FROM room_participants 
WHERE status = 'online' 
  AND last_seen < NOW() - INTERVAL '30 seconds'
UNION ALL
SELECT 
  'Lives actifs' as metric,
  COUNT(*) as value
FROM lives WHERE status = 'live'
UNION ALL
SELECT 
  'Viewers actifs' as metric,
  COUNT(*) as value
FROM live_viewers WHERE left_at IS NULL
UNION ALL
SELECT 
  'Viewers zombies (>30s)' as metric,
  COUNT(*) as value
FROM live_viewers 
WHERE left_at IS NULL 
  AND last_active < NOW() - INTERVAL '30 seconds';
```

### Consulter les stats

```sql
SELECT * FROM monitoring_stats;
```

---

## 🐛 RÉSOLUTION DE PROBLÈMES

### Erreur : "constraint already exists"

C'est normal si vous réexécutez le script. Les contraintes sont créées avec `IF NOT EXISTS`.

### Erreur : "function already exists"

Le script utilise `CREATE OR REPLACE FUNCTION`, donc ça devrait passer. Si erreur, supprimez manuellement :

```sql
DROP FUNCTION IF EXISTS update_live_viewer_count() CASCADE;
-- Puis réexécutez la section concernée
```

### Erreur : "permission denied"

Vous devez utiliser le **Service Role Key** ou être connecté avec un compte ayant les droits d'administration.

### Les triggers ne se déclenchent pas

Vérifier qu'ils sont actifs :

```sql
SELECT * FROM pg_trigger WHERE tgname LIKE '%viewer_count%';
```

Si absents, réexécuter la section triggers du script.

---

## 🧪 TESTS POST-MIGRATION

### Test 1 : Compteur de viewers

```sql
-- Insérer un viewer test
INSERT INTO live_viewers (live_id, user_id) 
VALUES ('test-live-id', 'test-user-id');

-- Vérifier que viewer_count a été mis à jour
SELECT id, viewer_count FROM lives WHERE id = 'test-live-id';

-- Nettoyer
DELETE FROM live_viewers WHERE live_id = 'test-live-id';
```

### Test 2 : Nettoyage zombies

```sql
-- Créer un participant zombie
INSERT INTO room_participants (
  room_id, user_id, peer_id, status, last_seen
) VALUES (
  'test-room', 'test-user', 'test-peer', 'online', NOW() - INTERVAL '1 minute'
);

-- Exécuter le nettoyage
SELECT cleanup_stale_participants();

-- Vérifier qu'il a été marqué offline
SELECT status FROM room_participants WHERE peer_id = 'test-peer';
-- Devrait être 'offline'

-- Nettoyer
DELETE FROM room_participants WHERE peer_id = 'test-peer';
```

### Test 3 : CASCADE

```sql
-- Créer une meeting test
INSERT INTO meetings (room_id, user_id, name) 
VALUES ('test-room-cascade', 'test-user', 'Test');

-- Créer des messages
INSERT INTO messages (room_id, sender_id, content) 
VALUES ('test-room-cascade', 'test-user', 'Test message');

-- Supprimer la meeting
DELETE FROM meetings WHERE room_id = 'test-room-cascade';

-- Vérifier que les messages ont été supprimés (CASCADE)
SELECT COUNT(*) FROM messages WHERE room_id = 'test-room-cascade';
-- Devrait être 0
```

---

## 📝 ROLLBACK (En cas de problème)

Si quelque chose ne va pas :

### 1. Restaurer le backup

Via Supabase Dashboard :
- Database > Backups
- Sélectionner le backup
- Cliquer sur "Restore"

### 2. Supprimer manuellement les changements

```sql
-- Supprimer les triggers
DROP TRIGGER IF EXISTS live_viewer_count_trigger ON live_viewers;
DROP TRIGGER IF EXISTS report_limit_trigger ON reports;
DROP TRIGGER IF EXISTS auto_end_meeting_trigger ON room_participants;

-- Supprimer les fonctions
DROP FUNCTION IF EXISTS update_live_viewer_count() CASCADE;
DROP FUNCTION IF EXISTS cleanup_stale_participants() CASCADE;
DROP FUNCTION IF EXISTS cleanup_stale_live_viewers() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_data() CASCADE;
DROP FUNCTION IF EXISTS check_report_limit() CASCADE;
DROP FUNCTION IF EXISTS auto_end_meeting() CASCADE;
DROP FUNCTION IF EXISTS check_meeting_end() CASCADE;

-- Supprimer les indexes (si nécessaire)
DROP INDEX IF EXISTS idx_meetings_user_id;
-- etc.
```

---

## ✅ CHECKLIST FINALE

- [ ] Backup créé
- [ ] Script `MIGRATION_URGENTE.sql` exécuté sans erreur
- [ ] Contraintes vérifiées
- [ ] Indexes créés
- [ ] Triggers actifs
- [ ] Fonctions disponibles
- [ ] Tests passés
- [ ] Crons configurés (optionnel)
- [ ] Monitoring en place
- [ ] Code React mis à jour (voir `CORRECTIFS_PRIORITAIRES.md`)

---

## 📞 SUPPORT

En cas de problème :

1. Vérifier les logs Supabase
2. Consulter `ANALYSE_LOGIQUE_METIER.md` pour les détails
3. Exécuter `SELECT * FROM monitoring_stats;` pour diagnostiquer

---

**Migration prête ! Passez maintenant aux correctifs React** 🚀

