# 🚨 CORRECTIFS PRIORITAIRES - À APPLIQUER IMMÉDIATEMENT

## Date : 5 Décembre 2025

---

## 🔴 URGENCES (À faire MAINTENANT)

### 1. ⚠️ Fix contrainte room_participants

**Fichier** : `SOLUTIONS_SQL.sql` (Section 1)

**Commandes SQL** :
```sql
ALTER TABLE room_participants DROP CONSTRAINT IF EXISTS room_participants_peer_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS room_participants_unique_peer_per_room 
  ON room_participants(room_id, peer_id);
```

**Impact** : Sans ce fix, les utilisateurs ne peuvent pas rejoindre plusieurs réunions.

---

### 2. 🧹 Heartbeat pour participants (React)

**Fichier** : `src/pages/MeetRoom.jsx`

**Ajouter ce useEffect** :
```javascript
// Heartbeat pour éviter les participants zombies
useEffect(() => {
  if (!currentUser?.id || !roomId || !peerInstance?.id) return;
  
  const heartbeat = setInterval(async () => {
    await supabase.from('room_participants')
      .update({ last_seen: new Date().toISOString() })
      .match({ room_id: roomId, user_id: currentUser.id });
  }, 10000); // Toutes les 10 secondes
  
  return () => clearInterval(heartbeat);
}, [currentUser, roomId, peerInstance]);
```

---

### 3. 🧹 Heartbeat pour spectateurs (React)

**Fichier** : `src/pages/LiveRoom.jsx`

**Ajouter ce useEffect** :
```javascript
// Heartbeat pour spectateurs
useEffect(() => {
  if (!currentUser?.id || !liveId || isHost || isGuest) return;
  
  const heartbeat = setInterval(async () => {
    await supabase.from('live_viewers')
      .update({ last_active: new Date().toISOString() })
      .match({ live_id: liveId, user_id: currentUser.id });
  }, 10000); // Toutes les 10 secondes
  
  return () => clearInterval(heartbeat);
}, [currentUser, liveId, isHost, isGuest]);
```

**+ beforeunload** :
```javascript
// Nettoyer au départ
useEffect(() => {
  if (!currentUser?.id || !liveId || isHost || isGuest) return;
  
  const cleanup = async () => {
    await supabase.from('live_viewers')
      .update({ left_at: new Date().toISOString() })
      .match({ live_id: liveId, user_id: currentUser.id });
  };
  
  window.addEventListener('beforeunload', cleanup);
  
  return () => {
    window.removeEventListener('beforeunload', cleanup);
    cleanup();
  };
}, [currentUser, liveId, isHost, isGuest]);
```

---

### 4. 📊 Ajouter les indexes

**Fichier** : `SOLUTIONS_SQL.sql` (Section 6)

**Exécuter toutes les commandes CREATE INDEX**

**Impact** : Performance x10 sur les requêtes fréquentes

---

### 5. 🔧 Fix N+1 Queries dans History

**Fichier** : `src/pages/History.jsx`

**Remplacer la fonction `fetchMeetings`** :

```javascript
const fetchMeetings = async () => {
  setIsLoading(true);
  try {
    // 1. Charger les meetings
    const { data: userMeetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (meetingsError) throw meetingsError;
    if (!userMeetings || userMeetings.length === 0) {
      setMeetings([]);
      return;
    }

    const roomIds = userMeetings.map(m => m.room_id);

    // 2. Charger TOUT en parallèle (3 queries au lieu de N*3)
    const [participantsData, transcriptsData, summariesData] = await Promise.all([
      supabase.from('meeting_participants_log')
        .select('*')
        .in('room_id', roomIds),
      
      supabase.from('meeting_transcripts')
        .select('*')
        .in('room_id', roomIds),
      
      supabase.from('meeting_summaries')
        .select('*')
        .in('room_id', roomIds)
    ]);

    // 3. Regrouper par room_id
    const participantsByRoom = {};
    const transcriptsByRoom = {};
    const summariesByRoom = {};

    participantsData.data?.forEach(p => {
      if (!participantsByRoom[p.room_id]) participantsByRoom[p.room_id] = [];
      participantsByRoom[p.room_id].push(p);
    });

    transcriptsData.data?.forEach(t => {
      if (!transcriptsByRoom[t.room_id]) transcriptsByRoom[t.room_id] = [];
      transcriptsByRoom[t.room_id].push(t);
    });

    summariesData.data?.forEach(s => {
      summariesByRoom[s.room_id] = s;
    });

    // 4. Construire le résultat
    const meetingsWithDetails = userMeetings.map(meeting => ({
      ...meeting,
      participants: participantsByRoom[meeting.room_id] || [],
      transcripts: transcriptsByRoom[meeting.room_id] || [],
      summary: summariesByRoom[meeting.room_id]
    }));

    setMeetings(meetingsWithDetails);
  } catch (error) {
    console.error('Error fetching meetings:', error);
  } finally {
    setIsLoading(false);
  }
};
```

---

### 6. 🔧 Ajouter CASCADE aux FK

**Fichier** : `SOLUTIONS_SQL.sql` (Section 5)

**Exécuter toutes les commandes ALTER TABLE ... ON DELETE CASCADE**

**Impact** : Évite les données orphelines

---

### 7. 🔧 Colonne last_active pour live_viewers

**SQL** :
```sql
ALTER TABLE live_viewers ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_live_viewers_last_active ON live_viewers(last_active);
```

---

### 8. 🔧 Trigger compteur de spectateurs

**Fichier** : `SOLUTIONS_SQL.sql` (Section 2)

**Exécuter la fonction + trigger**

**Impact** : Le champ `viewer_count` sera automatiquement mis à jour

---

### 9. 🔧 Fonctions de nettoyage

**Fichier** : `SOLUTIONS_SQL.sql` (Sections 3 et 4)

**Exécuter les fonctions** :
- `cleanup_stale_participants()`
- `cleanup_stale_live_viewers()`

**Puis créer un cron système** (ou utiliser pg_cron si disponible) :
```bash
# Crontab Linux/Mac
*/1 * * * * curl -X POST "https://your-project.supabase.co/rest/v1/rpc/cleanup_stale_participants" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"

*/1 * * * * curl -X POST "https://your-project.supabase.co/rest/v1/rpc/cleanup_stale_live_viewers" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**OU via Supabase Dashboard** :
- Aller dans Database > Functions
- Créer un Edge Function qui appelle ces fonctions toutes les minutes

---

## 🟡 IMPORTANT (À faire dans les 48h)

### 10. 🔒 RLS plus restrictifs

**Fichier** : `SOLUTIONS_SQL.sql` (Section 12)

**Exécuter les policies améliorées**

---

### 11. 🔧 Status 'joined' pour les invités

**Fichier** : `src/pages/LiveRoom.jsx`

**Ajouter après `initializeMedia()`** :
```javascript
const initializeMedia = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true
    });
    setLocalStream(stream);
    
    // ✅ SI INVITÉ, marquer comme 'joined'
    if (isGuest && currentUser?.id && liveId) {
      await supabase.from('live_guests')
        .update({ 
          status: 'joined', 
          joined_at: new Date().toISOString() 
        })
        .match({ live_id: liveId, user_id: currentUser.id });
    }
  } catch (error) {
    console.error('Error accessing media:', error);
    alert('Impossible d\'accéder à la caméra/micro');
  }
};
```

---

### 12. 🔧 Validation 280 caractères pour todos

**Fichier** : `src/components/SharedTodoList.jsx`

**Ajouter** :
```javascript
<input
  type="text"
  value={newTodoContent}
  onChange={(e) => setNewTodoContent(e.target.value)}
  maxLength={280}  // ✅ Ajout
  placeholder="Nouvelle tâche..."
  className="..."
/>
```

---

### 13. 🔧 Empêcher reset du canvas

**Fichier** : `src/pages/MeetRoom.jsx`

**Fonction `toggleWhiteboard`** :
```javascript
const toggleWhiteboard = async () => {
  if (!currentUser?.id || !roomId) {
    console.error('Cannot toggle whiteboard: missing user or room');
    return;
  }

  try {
    if (isWhiteboardActive) {
      if (!window.confirm('Fermer le tableau blanc ? Le contenu sera perdu.')) {
        return;
      }
      
      // ✅ DELETE au lieu d'update
      await supabase.from('room_whiteboard')
        .delete()
        .match({ room_id: roomId });
      
      showNotification('📝 Tableau blanc fermé', 'success');
    } else {
      // ✅ Charger l'ancien canvas_data s'il existe
      const { data: existing } = await supabase
        .from('room_whiteboard')
        .select('canvas_data')
        .eq('room_id', roomId)
        .single();
      
      await supabase.from('room_whiteboard').upsert({
        room_id: roomId, 
        is_active: true, 
        initiator_id: currentUser.id, 
        canvas_data: existing?.canvas_data || null,  // ✅ Ne pas reset
        updated_at: new Date().toISOString()
      }, { onConflict: 'room_id' });
      
      showNotification('📝 Tableau blanc ouvert', 'success');
    }
  } catch (e) {
    console.error('Exception toggle whiteboard:', e);
    showNotification('❌ Erreur inattendue', 'error');
  }
};
```

---

### 14. 🔧 Gérer null sur username

**Fichier** : `src/pages/Settings.jsx`

**Remplacer** :
```javascript
<input
  type="text"
  value={profile.username || ''}  // ✅ Ajout fallback
  onChange={(e) => setProfile({ 
    ...profile, 
    username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
  })}
  ...
/>
```

---

### 15. 🔧 Retries pour création de meeting

**Fichier** : `src/pages/Dashboard.jsx`

**Remplacer `confirmCreateRoom`** :
```javascript
const confirmCreateRoom = async () => {
  if (!meetingName.trim()) {
    alert('Veuillez entrer un nom pour la réunion.');
    return;
  }

  setIsCreatingRoom(true);
  
  try {
    let generatedRoomId;
    let attempts = 0;
    let success = false;
    
    while (!success && attempts < 5) {
      generatedRoomId = uuidv4().substring(0, 12);
      
      const { data, error } = await supabase.from('meetings').insert([{
        room_id: generatedRoomId,
        user_id: currentUser.id,
        name: meetingName.trim()
      }]).select();
      
      if (!error) {
        success = true;
      } else if (error.code === '23505') {
        attempts++;
        console.log(`Collision room_id, tentative ${attempts}/5`);
      } else {
        throw error;
      }
    }
    
    if (!success) {
      throw new Error('Impossible de générer un ID unique après 5 tentatives');
    }
    
    setShowMeetingNameModal(false);
    setMeetingName('');
    navigate(`/meet/${generatedRoomId}`);
  } catch (error) {
    alert('Erreur lors de la création de la réunion : ' + error.message);
    console.error('Error creating room:', error);
  } finally {
    setIsCreatingRoom(false);
  }
};
```

---

## 🟢 AMÉLIORATIONS (À planifier)

### 16. 📦 Cache des profiles

**Créer** : `src/hooks/useProfilesCache.js`

```javascript
import { useState, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

export const useProfilesCache = () => {
  const cacheRef = useRef({});

  const getProfile = useCallback(async (userId) => {
    if (cacheRef.current[userId]) {
      return cacheRef.current[userId];
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, username')
      .eq('id', userId)
      .single();
    
    if (!error && data) {
      cacheRef.current[userId] = data;
      return data;
    }
    
    return null;
  }, []);

  const getProfiles = useCallback(async (userIds) => {
    const uncachedIds = userIds.filter(id => !cacheRef.current[id]);
    
    if (uncachedIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username')
        .in('id', uncachedIds);
      
      data?.forEach(profile => {
        cacheRef.current[profile.id] = profile;
      });
    }
    
    return userIds.map(id => cacheRef.current[id]).filter(Boolean);
  }, []);

  return { getProfile, getProfiles };
};
```

**Utilisation dans LiveRoom.jsx** :
```javascript
import { useProfilesCache } from '../hooks/useProfilesCache';

const { getProfiles } = useProfilesCache();

const fetchComments = async () => {
  const { data } = await supabase.from('live_comments')
    .select('*')
    .eq('live_id', liveId)
    .order('created_at', { ascending: true })
    .limit(100);
  
  if (data?.length > 0) {
    const userIds = [...new Set(data.map(c => c.user_id))];
    const profiles = await getProfiles(userIds);  // ✅ Utilise cache
    
    const profilesMap = {};
    profiles.forEach(p => { profilesMap[p.id] = p; });
    
    setComments(data.map(c => ({ ...c, profiles: profilesMap[c.user_id] })));
  }
};
```

---

### 17. 📦 Compression canvas (whiteboard)

**Fichier** : `src/components/Whiteboard.jsx`

**Modifier `syncCanvas`** :
```javascript
const syncCanvas = useCallback(async () => {
  if (!roomId || !canvasRef.current || isRemoteUpdateRef.current) {
    return;
  }
  
  // ✅ Compression WebP (meilleure que PNG)
  const blob = await new Promise(resolve => 
    canvasRef.current.toBlob(resolve, 'image/webp', 0.8)
  );
  
  // Convertir en base64 pour stockage
  const reader = new FileReader();
  reader.onloadend = async () => {
    const canvasData = reader.result;
    
    try {
      const { error } = await supabase
        .from('room_whiteboard')
        .upsert({
          room_id: roomId,
          canvas_data: canvasData,
          updated_at: new Date().toISOString(),
          is_active: true
        }, { onConflict: 'room_id' });
      
      if (error) {
        console.error('Whiteboard: Sync error:', error);
      }
    } catch (e) {
      console.error('Whiteboard: Sync exception:', e);
    }
  };
  
  reader.readAsDataURL(blob);
}, [roomId]);
```

---

### 18. 🔧 Trigger auto-end meeting

**Fichier** : `SOLUTIONS_SQL.sql` (Section 14)

**Exécuter la fonction + trigger**

---

### 19. 📊 Utiliser les vues SQL

**Fichier** : `SOLUTIONS_SQL.sql` (Section 13)

**Créer les vues**, puis côté React :

```javascript
// Dashboard.jsx
const { data: activeMeetings } = await supabase
  .from('active_meetings')
  .select('*')
  .eq('user_id', currentUser.id);

// Live.jsx
const { data: activeLives } = await supabase
  .from('active_lives')
  .select('*')
  .order('current_viewers', { ascending: false });
```

---

## 📋 CHECKLIST FINALE

### SQL (dans Supabase Dashboard)
- [ ] 1. Fix contrainte room_participants
- [ ] 2. Trigger compteur spectateurs
- [ ] 3. Fonction cleanup participants
- [ ] 4. Fonction cleanup viewers
- [ ] 5. Ajouter CASCADE aux FK
- [ ] 6. Créer tous les indexes
- [ ] 7. Ajouter colonne last_active
- [ ] 8. Contrainte UNIQUE transcripts
- [ ] 9. Table live_bans
- [ ] 10. RLS améliorés
- [ ] 11. Trigger rate limiting reports
- [ ] 12. Trigger auto-end meeting
- [ ] 13. Vues active_meetings et active_lives
- [ ] 14. Fonctions utilitaires

### React
- [ ] 15. Heartbeat participants (MeetRoom)
- [ ] 16. Heartbeat viewers (LiveRoom)
- [ ] 17. Fix N+1 queries (History)
- [ ] 18. Status 'joined' (LiveRoom)
- [ ] 19. Validation 280 caractères (SharedTodoList)
- [ ] 20. Empêcher reset canvas (MeetRoom)
- [ ] 21. Fallback username null (Settings)
- [ ] 22. Retries création meeting (Dashboard)
- [ ] 23. Hook useProfilesCache
- [ ] 24. Compression canvas (Whiteboard)

### Système
- [ ] 25. Configurer cron pour cleanup_stale_participants
- [ ] 26. Configurer cron pour cleanup_stale_live_viewers
- [ ] 27. Configurer cron pour cleanup_old_data (quotidien)

---

## 🎯 ORDRE D'EXÉCUTION RECOMMANDÉ

### Phase 1 - SQL (30 min)
1. Backup de la base de données
2. Exécuter `SOLUTIONS_SQL.sql` section par section
3. Vérifier qu'il n'y a pas d'erreurs

### Phase 2 - React Urgent (1h)
1. Heartbeat participants
2. Heartbeat viewers
3. Fix N+1 queries

### Phase 3 - React Important (1h)
1. Status 'joined'
2. Validation todos
3. Empêcher reset canvas
4. Fallback username

### Phase 4 - Tests (30 min)
1. Tester reconnexion
2. Tester fermeture brutale
3. Tester 2 users simultanés

### Phase 5 - Monitoring (optionnel)
1. Configurer logs
2. Ajouter Sentry
3. Configurer crons système

---

## ⚠️ NOTES IMPORTANTES

1. **Backup** : Toujours faire un backup avant d'exécuter les scripts SQL
2. **Tester** : Tester sur un environnement de dev d'abord
3. **Monitoring** : Surveiller les logs après déploiement
4. **Performance** : Les indexes vont améliorer drastiquement les performances
5. **Scalabilité** : Ces correctifs préparent l'app pour passer à l'échelle

---

## 📞 SUPPORT

Si vous rencontrez des problèmes :
1. Vérifier les logs Supabase
2. Vérifier la console navigateur
3. Vérifier que toutes les dépendances SQL sont créées dans l'ordre
4. Consulter `ANALYSE_LOGIQUE_METIER.md` pour les détails

---

✅ Bonne chance avec les corrections !

