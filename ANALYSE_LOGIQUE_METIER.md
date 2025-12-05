# 🔍 ANALYSE APPROFONDIE DE LA LOGIQUE MÉTIER - MiniMeet

## Date : 5 Décembre 2025

---

## 📊 MÉTHODOLOGIE

J'ai analysé :
- ✅ Schéma de base de données vs Code
- ✅ Flux de données en temps réel
- ✅ Gestion d'état React
- ✅ Cycles de vie des entités
- ✅ Cas limites et edge cases
- ✅ Race conditions potentielles
- ✅ Cohérence des données

---

## 🔴 PROBLÈMES CRITIQUES DE LOGIQUE

### 1. 💥 INCOHÉRENCE MAJEURE : `room_participants` - Conflit de contraintes

**Base de données** :
```sql
peer_id character varying NOT NULL UNIQUE,  -- ⚠️ UNIQUE
UNIQUE(room_id, user_id)  -- ⚠️ Deuxième contrainte UNIQUE
```

**Code** :
```javascript
.upsert({...}, { onConflict: 'room_id, user_id' })  // ❌ NE CORRESPOND PAS
```

**Problème** :
- La contrainte UNIQUE est sur `peer_id` SEUL
- Mais le onConflict utilise `(room_id, user_id)`
- **RÉSULTAT** : L'upsert peut échouer ou créer des doublons

**Comportement actuel** :
1. User A rejoint Room 1 → peer_id = "abc123"
2. User A rejoint Room 2 → peer_id = "abc123" → **ÉCHEC** (UNIQUE violation sur peer_id)
3. Impossible d'être dans 2 réunions simultanément

**Impact** : 🔴 BLOQUANT
- Un utilisateur ne peut pas être dans 2 réunions en même temps
- Si la connexion est perdue et que l'ancien peer_id n'est pas nettoyé, impossible de rejoindre

**Solution** :
```sql
-- Option 1 : Permettre un user dans plusieurs rooms
ALTER TABLE room_participants DROP CONSTRAINT room_participants_peer_id_key;
CREATE UNIQUE INDEX room_participants_unique_peer_per_room 
  ON room_participants(room_id, peer_id);

-- Option 2 : Empêcher explicitement (1 room à la fois)
-- Garder UNIQUE sur peer_id
-- Ajouter un nettoyage automatique des anciennes entrées
```

---

### 2. 💥 COMPTEUR DE SPECTATEURS NON MIS À JOUR

**Base de données** :
```sql
viewer_count integer DEFAULT 0,  -- ❌ Jamais mis à jour
```

**Code** :
```javascript
// Calcul à la volée
const { data, count } = await supabase.from('live_viewers')
  .select('*', { count: 'exact' })
  .eq('live_id', liveId).is('left_at', null);
setViewerCount(count || 0);
```

**Problème** :
- Le champ `viewer_count` en DB reste toujours à 0
- Le compteur affiché vient d'un calcul côté client
- **INCOHÉRENCE** entre DB et UI

**Impact** : 🟡 MOYEN
- Les statistiques historiques seront fausses
- Impossible de trier les lives par popularité
- Pas d'historique de viewers

**Solution** :
```sql
-- Trigger pour mettre à jour automatiquement
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER live_viewer_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON live_viewers
  FOR EACH ROW EXECUTE FUNCTION update_live_viewer_count();
```

---

### 3. 💥 HÔTE ET INVITÉS NON COMPTÉS COMME VIEWERS

**Code** :
```javascript
// Register as viewer
if (liveData.host_id !== userId) {  // ❌ L'hôte n'est pas compté
  await supabase.from('live_viewers').upsert({...});
}
```

**Problème** :
- L'hôte n'est PAS dans `live_viewers`
- Les invités acceptés ne sont PAS dans `live_viewers`
- Le compteur affiche seulement les "pure spectateurs"

**Incohérence** :
```
UI affiche : "3 spectateurs"
Réalité : 1 hôte + 2 invités + 3 spectateurs = 6 personnes
```

**Impact** : 🟡 MOYEN
- Statistiques trompeuses
- L'hôte ne sait pas combien de personnes regardent vraiment

**Solution** :
```javascript
// Option 1 : Tous sont des viewers
await supabase.from('live_viewers').upsert({
  live_id: liveId, 
  user_id: userId, 
  role: isHost ? 'host' : isGuest ? 'guest' : 'viewer',
  joined_at: new Date().toISOString()
}, { onConflict: 'live_id, user_id' });

// Option 2 : Calculer le total
const totalViewers = viewerCount + (isHost ? 1 : 0) + guests.filter(g => g.status === 'joined').length;
```

---

### 4. 💥 NETTOYAGE AUTOMATIQUE MANQUANT : Participants zombies

**Problème** :
Aucun mécanisme pour nettoyer les anciens participants qui ont crashé/fermé le navigateur sans appeler `performLeaveActions()`

**Scénarios** :
1. User ferme brutalement le navigateur
2. Perte de connexion internet
3. Crash de l'app
4. Kill du processus navigateur

**Résultat** :
```sql
SELECT * FROM room_participants WHERE status = 'online';
-- Plein d'entrées de participants qui ne sont plus là !
```

**Impact** : 🔴 CRITIQUE
- Les nouveaux participants essaient d'appeler des peers qui n'existent plus
- Erreurs "peer-unavailable" en boucle
- Performance dégradée
- Interface affiche des participants fantômes

**Solution** :
```sql
-- Fonction de nettoyage automatique
CREATE OR REPLACE FUNCTION cleanup_stale_participants()
RETURNS void AS $$
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
END;
$$ LANGUAGE plpgsql;

-- Job automatique avec pg_cron (si disponible)
SELECT cron.schedule('cleanup-participants', '*/1 * * * *', 'SELECT cleanup_stale_participants()');
```

**OU côté client** :
```javascript
// Heartbeat toutes les 10 secondes
useEffect(() => {
  if (!currentUser?.id || !roomId) return;
  
  const heartbeat = setInterval(async () => {
    await supabase.from('room_participants')
      .update({ last_seen: new Date().toISOString() })
      .match({ room_id: roomId, user_id: currentUser.id });
  }, 10000);
  
  return () => clearInterval(heartbeat);
}, [currentUser, roomId]);
```

---

### 5. 💥 FOREIGN KEYS MANQUANTES : Données orphelines garanties

**Messages** :
```sql
-- Dans la DB réelle
room_id character varying NOT NULL,  -- ✅ FK existe
CONSTRAINT messages_room_id_fkey FOREIGN KEY (room_id) 
  REFERENCES public.meetings(room_id)
```

**MAIS** :
```sql
-- meetings.room_id est un VARCHAR, pas une PRIMARY KEY
-- room_id est juste UNIQUE, pas PRIMARY
```

**Problèmes** :
1. **meeting_transcripts** et **meeting_summaries** :
```sql
CONSTRAINT meeting_transcripts_room_id_fkey 
  FOREIGN KEY (room_id) REFERENCES public.meetings(room_id)
-- ⚠️ Référence à room_id (UNIQUE) et non à id (PK)
```

2. Si `meetings.room_id` change (impossible normalement, mais en théorie) :
   - Tous les messages deviennent orphelins
   - Toutes les transcriptions deviennent orphelines
   - Tous les summaries deviennent orphelins

**Impact** : 🟡 MOYEN
- Risque théorique faible
- Mais incohérence architecturale

**Solution** :
```sql
-- Option 1 : Utiliser l'id (PK) partout
ALTER TABLE messages DROP CONSTRAINT messages_room_id_fkey;
ALTER TABLE messages ADD COLUMN meeting_id UUID REFERENCES meetings(id);
-- Migrer les données
UPDATE messages m SET meeting_id = (
  SELECT id FROM meetings WHERE room_id = m.room_id
);
-- Supprimer room_id de messages

-- Option 2 : Faire de room_id la PRIMARY KEY
-- (Plus complexe, nécessite refonte)
```

---

### 6. 💥 RACE CONDITION : Tableau blanc - Last Write Wins

**Scénario** :
```
Temps    User A                User B
0ms      Dessine ligne rouge   -
100ms    -                      Dessine ligne bleue
500ms    Sync → DB             -
600ms    -                      Sync → DB
```

**Résultat** :
- User B écrase le dessin de User A
- User A ne voit que la ligne bleue
- La ligne rouge est perdue

**Code actuel** :
```javascript
// Whiteboard.jsx - saveState()
await supabase.from('room_whiteboard').upsert({
  room_id: roomId,
  canvas_data: canvasData,  // ❌ Écrase tout
  ...
}, { onConflict: 'room_id' });
```

**Impact** : 🟡 MOYEN
- Dessins perdus si 2+ utilisateurs dessinent en même temps
- Expérience utilisateur frustrante

**Solutions** :

**Option 1 : Operational Transformation (complexe)**
```javascript
// Sauvegarder les opérations plutôt que l'image
{
  room_id: roomId,
  operations: [
    { type: 'line', from: {x,y}, to: {x,y}, color, width, timestamp },
    { type: 'circle', center: {x,y}, radius, color, timestamp }
  ]
}
```

**Option 2 : Locking (simple)**
```javascript
// Avant de dessiner
const { data } = await supabase.from('room_whiteboard')
  .select('locked_by, locked_at')
  .eq('room_id', roomId).single();

if (data?.locked_by && data.locked_by !== currentUser.id) {
  if (Date.now() - new Date(data.locked_at) < 5000) {
    alert('Un autre utilisateur dessine actuellement');
    return;
  }
}

await supabase.from('room_whiteboard').update({
  locked_by: currentUser.id,
  locked_at: new Date().toISOString()
}).eq('room_id', roomId);
```

**Option 3 : Websocket + CRDT (optimal mais complexe)**
- Utiliser Yjs ou Automerge
- Merge automatique des changements concurrents

---

### 7. 💥 LIVE : Status 'joined' jamais utilisé

**Base de données** :
```sql
status text CHECK (status = ANY (ARRAY[
  'pending'::text, 
  'accepted'::text, 
  'declined'::text, 
  'joined'::text  -- ❌ Jamais défini dans le code
]))
```

**Code** :
```javascript
setIsGuest(!!guestData && guestData.status === 'accepted');
// ❌ On check 'accepted', pas 'joined'
```

**Problème** :
- Un invité accepte → status = 'accepted'
- Il rejoint → status reste 'accepted' (pas 'joined')
- Impossible de savoir qui est vraiment connecté

**Impact** : 🟡 MOYEN
- Impossible de différencier "a accepté" vs "est connecté"
- Statistiques incorrectes

**Solution** :
```javascript
// Dans LiveRoomPage, après initializeMedia
if (isGuest && localStream) {
  await supabase.from('live_guests')
    .update({ 
      status: 'joined', 
      joined_at: new Date().toISOString() 
    })
    .match({ live_id: liveId, user_id: currentUser.id });
}
```

---

### 8. 💥 MEETING : Un user peut "créer" plusieurs fois la même room_id

**Code** :
```javascript
// Dashboard.jsx
const generatedRoomId = uuidv4().substring(0, 12);
await supabase.from('meetings').insert([{
  room_id: generatedRoomId,
  user_id: currentUser.id,
  name: meetingName.trim()
}]);
```

**Problème** :
- Aucun check si `generatedRoomId` existe déjà
- Collision possible (probabilité faible mais non nulle)
- Si collision → **ÉCHEC SILENCIEUX**

**Impact** : 🟡 MOYEN
- Création de réunion échoue sans message d'erreur
- User clique sur "Créer" → rien ne se passe

**Solution** :
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
      }]);
      
      if (!error) {
        success = true;
      } else if (error.code === '23505') { // Duplicate key
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
    alert('Erreur: ' + error.message);
  } finally {
    setIsCreatingRoom(false);
  }
};
```

---

### 9. 💥 MESSAGES : Peuvent devenir orphelins

**Base de données** :
```sql
CONSTRAINT messages_room_id_fkey 
  FOREIGN KEY (room_id) REFERENCES public.meetings(room_id)
-- ❌ Pas de ON DELETE CASCADE
```

**Scénario** :
```sql
-- User supprime la réunion
DELETE FROM meetings WHERE id = 'abc';

-- Les messages restent !
SELECT * FROM messages WHERE room_id = 'room-123';
-- → Messages orphelins (référence à une room qui n'existe plus)
```

**Impact** : 🟡 MOYEN
- Base de données polluée
- Fuite de données
- Confusion si on rejoint une "nouvelle" réunion avec le même room_id

**Solution** :
```sql
-- Ajouter CASCADE
ALTER TABLE messages DROP CONSTRAINT messages_room_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_room_id_fkey 
  FOREIGN KEY (room_id) REFERENCES meetings(room_id) 
  ON DELETE CASCADE;

-- Idem pour tous les autres
ALTER TABLE todos ADD CONSTRAINT todos_room_id_fkey 
  FOREIGN KEY (room_id) REFERENCES meetings(room_id) 
  ON DELETE CASCADE;

ALTER TABLE meeting_transcripts ADD CONSTRAINT ... ON DELETE CASCADE;
ALTER TABLE meeting_summaries ADD CONSTRAINT ... ON DELETE CASCADE;
```

---

### 10. 💥 LIVE : Aucun nettoyage des spectateurs

**Problème** :
Quand un spectateur ferme son navigateur sans cliquer "Quitter", son entrée dans `live_viewers` reste avec `left_at = NULL`

**Code actuel** :
```javascript
const leaveLive = async () => {
  localStream?.getTracks().forEach(t => t.stop());
  await supabase.from('live_viewers').update({ 
    left_at: new Date().toISOString() 
  }).match({ live_id: liveId, user_id: currentUser.id });
  navigate('/live');
};
```

**Mais** :
- Si l'user ferme l'onglet → **leaveLive() n'est PAS appelé**
- `left_at` reste NULL
- **Viewer zombie** dans la base

**Impact** : 🔴 CRITIQUE
- Compteur de spectateurs toujours en augmentation
- Jamais de décrémentation
- Stats complètement fausses

**Solution** :

**Côté client** :
```javascript
useEffect(() => {
  if (!currentUser || !liveId || isHost || isGuest) return;
  
  // Enregistrer comme viewer
  supabase.from('live_viewers').upsert({...});
  
  // Heartbeat toutes les 10s
  const heartbeat = setInterval(async () => {
    await supabase.from('live_viewers')
      .update({ last_active: new Date().toISOString() })
      .match({ live_id: liveId, user_id: currentUser.id });
  }, 10000);
  
  // Cleanup au unmount
  const cleanup = async () => {
    await supabase.from('live_viewers')
      .update({ left_at: new Date().toISOString() })
      .match({ live_id: liveId, user_id: currentUser.id });
  };
  
  window.addEventListener('beforeunload', cleanup);
  
  return () => {
    clearInterval(heartbeat);
    window.removeEventListener('beforeunload', cleanup);
    cleanup();
  };
}, [currentUser, liveId, isHost, isGuest]);
```

**Côté DB** (Trigger automatique) :
```sql
-- Ajouter colonne last_active
ALTER TABLE live_viewers ADD COLUMN last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Fonction de nettoyage
CREATE OR REPLACE FUNCTION cleanup_stale_live_viewers()
RETURNS void AS $$
BEGIN
  UPDATE live_viewers 
  SET left_at = NOW()
  WHERE left_at IS NULL 
    AND last_active < NOW() - INTERVAL '30 seconds';
END;
$$ LANGUAGE plpgsql;

-- Job toutes les minutes
SELECT cron.schedule('cleanup-live-viewers', '*/1 * * * *', 
  'SELECT cleanup_stale_live_viewers()');
```

---

## 🟡 PROBLÈMES MAJEURS DE LOGIQUE

### 11. 🔄 RECONNEXION : User perd ses paramètres

**Scénario** :
```
1. User A partage son écran
2. Perte de connexion internet (5 secondes)
3. Reconnexion automatique
4. is_screen_sharing = false (reset)
5. Les autres ne voient plus son écran
```

**Code actuel** :
```javascript
await supabase.from('room_participants').upsert({
  room_id: roomId, 
  user_id: currentUser.id, 
  peer_id: peerInstance.id, 
  user_email: currentUser.email,
  status: 'online', 
  last_seen: new Date().toISOString(), 
  user_full_name: fullName,
  // ❌ is_screen_sharing n'est pas défini → reset à false
}, { onConflict: 'room_id, user_id' });
```

**Impact** : 🟡 MOYEN
- État perdu lors des reconnexions
- User doit re-activer le partage d'écran

**Solution** :
```javascript
// Sauvegarder l'état dans un ref
const persistedStateRef = useRef({
  isScreenSharing: false,
  isMicMuted: false,
  isCamOff: false
});

// Lors de l'upsert
await supabase.from('room_participants').upsert({
  ...
  is_screen_sharing: persistedStateRef.current.isScreenSharing,
  is_mic_muted: persistedStateRef.current.isMicMuted,
  is_cam_off: persistedStateRef.current.isCamOff
}, { onConflict: 'room_id, user_id' });

// Mettre à jour le ref
useEffect(() => {
  persistedStateRef.current = { isScreenSharing, isMicMuted, isCamOff };
}, [isScreenSharing, isMicMuted, isCamOff]);
```

---

### 12. 🔄 TABLEAU BLANC : Reset au toggle

**Code actuel** :
```javascript
await supabase.from('room_whiteboard').upsert({
  room_id: roomId, 
  is_active: true, 
  initiator_id: currentUser.id, 
  updated_at: new Date().toISOString(),
  canvas_data: null  // ❌ RESET !
}, { onConflict: 'room_id' });
```

**Problème** :
Si quelqu'un ferme puis rouvre le tableau blanc, **tout est perdu** !

**Impact** : 🟡 MOYEN
- Perte de travail
- Frustration utilisateur

**Solution** :
```javascript
// Option 1 : Ne pas reset
canvas_data: null  // → Supprimer cette ligne

// Option 2 : Demander confirmation
const toggleWhiteboard = async () => {
  if (isWhiteboardActive) {
    if (!confirm('Fermer le tableau blanc ? Le contenu sera perdu.')) {
      return;
    }
    // DELETE au lieu d'update
    await supabase.from('room_whiteboard')
      .delete()
      .match({ room_id: roomId });
  } else {
    // Charger l'ancien canvas_data s'il existe
    const { data: existing } = await supabase
      .from('room_whiteboard')
      .select('canvas_data')
      .eq('room_id', roomId)
      .single();
    
    await supabase.from('room_whiteboard').upsert({
      room_id: roomId,
      is_active: true,
      initiator_id: currentUser.id,
      canvas_data: existing?.canvas_data || null,
      ...
    });
  }
};
```

---

### 13. 🔄 MULTIPLE SUBSCRIPTIONS : Memory leak potentiel

**Problème** :
```javascript
// Whiteboard.jsx et MeetRoom.jsx
const channelName = `whiteboard-state-${roomId}-${Math.random().toString(36).substr(2, 9)}`;
```

**Chaque fois que le composant re-render avec les bonnes deps** :
- Nouveau channel créé
- Ancien channel peut rester ouvert
- **Memory leak** si trop de re-renders

**Impact** : 🟢 FAIBLE
- Consommation mémoire augmente
- Peut ralentir après usage prolongé

**Solution** :
```javascript
// Utiliser un canal stable
const channelName = `whiteboard-state-${roomId}`;  // Pas de random

// OU garder une ref
const channelRef = useRef(null);
useEffect(() => {
  if (channelRef.current) {
    supabase.removeChannel(channelRef.current);
  }
  
  const sub = supabase.channel(...);
  channelRef.current = sub;
  
  return () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };
}, [roomId]);
```

---

### 14. 🔄 OPTIMISTIC UPDATES : Peuvent rester en cas d'erreur réseau

**Code** :
```javascript
// LiveRoom.jsx - handleSendComment
const tempComment = {
  id: `temp-${Date.now()}`,
  ...
};
setComments(prev => [...prev, tempComment]);

const { error } = await supabase.from('live_comments').insert(...);

if (error) {
  // ✅ Bien géré
  setComments(prev => prev.filter(c => c.id !== tempComment.id));
}
```

**Mais** :
```javascript
// Si timeout réseau (ni success ni error) ?
// Le commentaire reste en "temp-" indéfiniment !
```

**Solution** :
```javascript
const handleSendComment = async (e) => {
  e.preventDefault();
  if (!newComment.trim() || !currentUser) return;

  const content = newComment.trim();
  setNewComment('');

  const tempId = `temp-${Date.now()}`;
  const tempComment = {
    id: tempId,
    live_id: liveId,
    user_id: currentUser.id,
    content,
    created_at: new Date().toISOString(),
    profiles: { full_name: getDisplayName(currentUser) },
    _isPending: true  // Indicateur visuel
  };
  setComments(prev => [...prev, tempComment]);

  try {
    // Timeout de 10 secondes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const { error } = await supabase.from('live_comments').insert({
      live_id: liveId,
      user_id: currentUser.id,
      content
    });
    
    clearTimeout(timeoutId);

    if (error) throw error;
  } catch (error) {
    // Retirer le commentaire temporaire
    setComments(prev => prev.filter(c => c.id !== tempId));
    
    if (error.name === 'AbortError') {
      alert('⏱️ Délai d\'envoi dépassé. Vérifiez votre connexion.');
    } else {
      alert('❌ Erreur lors de l\'envoi du message.');
    }
    console.error('Error sending comment:', error);
  }
};
```

---

### 15. 🔄 TRANSCRIPTION : Peut créer plusieurs transcripts par session

**Code** :
```javascript
// MeetRoom.jsx - saveTranscript
await supabase.from('meeting_transcripts').insert({
  room_id: roomId,
  user_id: currentUser.id,
  transcript: transcriptText,
  ...
});
```

**Problème** :
- Si l'utilisateur rejoint → quitte → rejoint la même room :
  - **2 transcripts** créés pour le même user/room
- Pas de UNIQUE constraint

**Impact** : 🟢 FAIBLE
- Données dupliquées
- Confusion dans l'historique

**Solution** :
```sql
-- Ajouter contrainte UNIQUE
ALTER TABLE meeting_transcripts 
  ADD CONSTRAINT meeting_transcripts_room_user_unique 
  UNIQUE(room_id, user_id);

-- OU permettre plusieurs transcripts mais avec session_id
ALTER TABLE meeting_transcripts ADD COLUMN session_id UUID DEFAULT gen_random_uuid();
```

**Côté code** :
```javascript
// Upsert au lieu d'insert
await supabase.from('meeting_transcripts').upsert({
  room_id: roomId,
  user_id: currentUser.id,
  transcript: transcriptText,
  ...
}, { onConflict: 'room_id, user_id' });
```

---

## 🟢 PROBLÈMES MINEURS DE LOGIQUE

### 16. ⚠️ REPORTS : Pas de limite par utilisateur

**Problème** :
Un utilisateur malveillant peut spam les reports :
```javascript
// Aucune limite !
await supabase.from('reports').insert({...});
```

**Solution** :
```javascript
// Check avant insert
const { count } = await supabase.from('reports')
  .select('*', { count: 'exact', head: true })
  .eq('reporter_id', currentUser.id)
  .gte('created_at', new Date(Date.now() - 3600000).toISOString()); // 1h

if (count >= 10) {
  alert('Limite de signalements atteinte. Veuillez réessayer plus tard.');
  return;
}
```

---

### 17. ⚠️ TODOS : task_content limité à 280 mais pas validé

**Base de données** :
```sql
CHECK (char_length(task_content) > 0 AND char_length(task_content) <= 280)
```

**Code** :
```javascript
// SharedTodoList.jsx
<input
  type="text"
  value={newTodoContent}
  onChange={(e) => setNewTodoContent(e.target.value)}
  // ❌ Pas de maxLength
/>
```

**Problème** :
- User peut taper 300 caractères
- INSERT échoue silencieusement
- Task n'est pas créée

**Solution** :
```javascript
<input
  type="text"
  value={newTodoContent}
  onChange={(e) => setNewTodoContent(e.target.value)}
  maxLength={280}  // ✅ Validation client
  className="..."
/>

// + Validation avant insert
const handleAddTodo = async (e) => {
  e.preventDefault();
  if (!newTodoContent.trim() || !currentUser || !roomId) return;
  
  const content = newTodoContent.trim();
  
  if (content.length > 280) {
    setError('Tâche trop longue (max 280 caractères)');
    return;
  }
  
  setNewTodoContent('');
  // ...
};
```

---

### 18. ⚠️ USERNAME : Peut être null mais utilisé dans l'UI

**Base de données** :
```sql
username text UNIQUE,  -- ❌ Nullable
```

**Code** :
```javascript
// Settings.jsx
<input
  type="text"
  value={profile.username}  // Peut être null → ❌
  onChange={(e) => setProfile({ 
    ...profile, 
    username: e.target.value.toLowerCase()... 
  })}
/>
```

**Problème** :
- `profile.username` peut être `null`
- `.toLowerCase()` sur null → **CRASH**

**Solution** :
```javascript
<input
  type="text"
  value={profile.username || ''}  // ✅ Fallback
  onChange={(e) => setProfile({ 
    ...profile, 
    username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
  })}
/>
```

---

## 📊 PROBLÈMES D'ARCHITECTURE

### 19. 📦 room_id : TEXT vs UUID

**Incohérence** :
```sql
-- meetings
id uuid PRIMARY KEY,
room_id character varying UNIQUE  -- ❌ VARCHAR

-- Mais utilisé comme FK partout
messages.room_id → meetings.room_id
```

**Problème** :
- Les room_id sont des UUID tronqués : `uuidv4().substring(0, 12)`
- Type TEXT inefficace pour les comparaisons
- Pas de validation de format

**Impact** : 🟢 FAIBLE
- Performance légèrement dégradée
- Possibilité de room_id invalides

**Solution (Refonte majeure)** :
```sql
-- Option 1 : room_id devient PK
ALTER TABLE meetings DROP CONSTRAINT meetings_pkey;
ALTER TABLE meetings ALTER COLUMN room_id TYPE UUID USING room_id::uuid;
ALTER TABLE meetings ADD PRIMARY KEY (room_id);
ALTER TABLE meetings DROP COLUMN id;

-- Option 2 : Utiliser id comme PK partout
-- Changer toutes les FKs pour pointer vers meetings.id au lieu de room_id
```

---

### 20. 📦 MEETINGS : Pas de ended_at automatique

**Base de données** :
```sql
ended_at timestamp with time zone,  -- ❌ Jamais rempli
```

**Code** :
Aucune ligne ne remplit `ended_at` !

**Impact** : 🟢 FAIBLE
- Impossible de calculer la durée d'une réunion
- Stats incomplètes

**Solution** :
```javascript
// MeetRoom.jsx - performLeaveActions
const performLeaveActions = async () => {
  // ...
  
  // Si dernier participant, marquer la réunion comme terminée
  const { data: remainingParticipants } = await supabase
    .from('room_participants')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('status', 'online')
    .neq('user_id', currentUser.id);
  
  if (remainingParticipants === 0) {
    await supabase.from('meetings')
      .update({ ended_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .is('ended_at', null);
  }
};
```

---

### 21. 📦 PROFILES : Deux sources de vérité (auth.users vs profiles)

**Problème** :
- `full_name` existe dans `auth.users.user_metadata.full_name` **ET** `profiles.full_name`
- Synchronisation manuelle nécessaire
- Peut devenir désynchronisé

**Code** :
```javascript
// userUtils.js
if (profile.full_name !== user.user_metadata?.full_name) {
  await supabase.auth.updateUser({
    data: { full_name: profile.full_name }
  });
}
```

**Impact** : 🟡 MOYEN
- Incohérences possibles
- Complexité inutile

**Solution** :
```sql
-- Option 1 : N'utiliser QUE profiles
-- Supprimer la duplication

-- Option 2 : Trigger automatique
CREATE OR REPLACE FUNCTION sync_profile_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Note: Impossible de modifier auth.users directement via trigger
  -- Cette approche n'est pas faisable
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Option 3 : Source unique de vérité = auth.users
-- Supprimer profiles.full_name, utiliser seulement user_metadata
```

**Recommandation** : **Garder profiles.full_name** comme source de vérité, synchroniser vers auth.users seulement pour l'affichage rapide.

---

## 🔄 RACE CONDITIONS IDENTIFIÉES

### 22. ⏱️ RACE : Deux users rejoignent en même temps

**Scénario** :
```
User A: initializePeer('userId-A')  → peer_id = 'userId-A'
User B: initializePeer('userId-B')  → peer_id = 'userId-B'

User A: await supabase.from('room_participants').upsert(...)  ← 500ms
User B: await supabase.from('room_participants').upsert(...)  ← 500ms

User A: fetch initialParticipants  → [] (User B pas encore inséré)
User B: fetch initialParticipants  → [] (User A déjà récupéré)

Résultat : Personne n'appelle personne !
```

**Impact** : 🟡 MOYEN
- Les deux users ne se voient pas
- Doivent refresh pour se connecter

**Solution** :
```javascript
const managePresence = async () => {
  if (!isMounted) return;
  try {
    // 1. Nettoyer
    await supabase.from('room_participants').delete().match({ peer_id: peerInstance.id });
    
    // 2. Insérer
    await supabase.from('room_participants').upsert(...);
    
    // 3. Attendre un peu pour que les autres users soient insérés
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. Récupérer les participants
    const { data: initialParticipants } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'online')
      .neq('peer_id', peerInstance.id);
    
    // 5. Appeler tous les participants
    if (initialParticipants) {
      initialParticipants.forEach(p => initiateCallToPeer(p.peer_id, p.user_email, p.user_full_name));
    }
  } catch (e) { console.error('Presence error:', e); }
};
```

---

### 23. ⏱️ RACE : Meeting créée mais navigation échoue

**Code** :
```javascript
await supabase.from('meetings').insert([{...}]);
setShowMeetingNameModal(false);
setMeetingName('');
navigate(`/meet/${generatedRoomId}`);  // ❌ Pas d'attente de confirmation
```

**Problème** :
Si l'insert est lent (réseau lent), la navigation se fait avant que la meeting soit dans la DB.

**Impact** : 🟢 FAIBLE
- Page MeetRoom charge avant que la meeting existe
- Peut causer des erreurs temporaires

**Solution** :
```javascript
const { data, error } = await supabase.from('meetings').insert([{
  room_id: generatedRoomId,
  user_id: currentUser.id,
  name: meetingName.trim()
}]).select();  // ✅ Attendre la réponse

if (error) throw error;
if (!data || data.length === 0) throw new Error('Meeting non créée');

// Maintenant on est sûr que ça existe
navigate(`/meet/${generatedRoomId}`);
```

---

## 🗑️ PROBLÈMES DE NETTOYAGE DES DONNÉES

### 24. 🧹 Aucun garbage collection

**Problèmes identifiés** :

#### A. `room_participants` zombies
```sql
SELECT * FROM room_participants WHERE status = 'online' AND last_seen < NOW() - INTERVAL '1 hour';
-- → Des centaines d'entrées probablement
```

#### B. `live_reactions` accumulation infinie
```sql
SELECT COUNT(*) FROM live_reactions WHERE live_id = 'xxx';
-- → Peut atteindre des millions d'entrées
```

#### C. `messages` et `todos` jamais supprimés
- Une room active pendant des mois → 100k+ messages
- Performance dégradée

#### D. `meeting_transcripts` de plus en plus gros
```sql
SELECT pg_size_pretty(pg_total_relation_size('meeting_transcripts'));
-- → Peut atteindre des GB
```

**Solution** :

**Stratégie de rétention** :
```sql
-- Fonction de nettoyage globale
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- 1. Nettoyer participants offline > 1 heure
  DELETE FROM room_participants 
  WHERE status = 'offline' 
    AND last_seen < NOW() - INTERVAL '1 hour';
  
  -- 2. Nettoyer viewers qui ont quitté > 7 jours
  DELETE FROM live_viewers 
  WHERE left_at IS NOT NULL 
    AND left_at < NOW() - INTERVAL '7 days';
  
  -- 3. Nettoyer réactions > 30 jours
  DELETE FROM live_reactions 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- 4. Nettoyer lives terminés > 90 jours
  DELETE FROM lives 
  WHERE status = 'ended' 
    AND ended_at < NOW() - INTERVAL '90 days';
  
  -- 5. Nettoyer messages de rooms inactives > 30 jours
  DELETE FROM messages 
  WHERE room_id IN (
    SELECT room_id FROM meetings 
    WHERE created_at < NOW() - INTERVAL '30 days'
      AND ended_at IS NOT NULL
  );
  
  RAISE NOTICE 'Nettoyage terminé';
END;
$$ LANGUAGE plpgsql;

-- Job quotidien
SELECT cron.schedule('daily-cleanup', '0 2 * * *', 'SELECT cleanup_old_data()');
```

---

### 25. 🧹 CASCADE INCOMPLET

**Messages vs Meetings** :
```sql
-- Si user supprimé
meetings.user_id ON DELETE CASCADE  -- ✅ Meeting supprimée
messages.sender_id ON DELETE CASCADE  -- ✅ Message supprimé

-- MAIS si meeting supprimée
messages.room_id → meetings.room_id  -- ❌ Pas de CASCADE
-- → Messages deviennent orphelins !
```

**Solution** : Déjà mentionné au point #9

---

## 🎯 PROBLÈMES DE PERFORMANCE

### 26. 🐌 N+1 Queries

**Code** :
```javascript
// History.jsx - fetchMeetings
const meetingsWithDetails = await Promise.all((userMeetings || []).map(async (meeting) => {
  const { data: participants } = await supabase
    .from('meeting_participants_log')
    .select('*')
    .eq('room_id', meeting.room_id);  // ❌ 1 query par meeting
  
  const { data: transcripts } = await supabase
    .from('meeting_transcripts')
    .select('*')
    .eq('room_id', meeting.room_id);  // ❌ 1 query par meeting
  
  const { data: summary } = await supabase
    .from('meeting_summaries')
    .select('*')
    .eq('room_id', meeting.room_id).single();  // ❌ 1 query par meeting
  
  return { ...meeting, participants, transcripts, summary };
}));
```

**Problème** :
Si 50 meetings → **150 queries** !

**Impact** : 🔴 CRITIQUE pour les utilisateurs actifs
- Page History très lente
- Coûts Supabase élevés

**Solution** :
```javascript
// Charger tout d'un coup
const roomIds = userMeetings.map(m => m.room_id);

const [participantsData, transcriptsData, summariesData] = await Promise.all([
  supabase.from('meeting_participants_log')
    .select('*')
    .in('room_id', roomIds),  // ✅ 1 query
  
  supabase.from('meeting_transcripts')
    .select('*')
    .in('room_id', roomIds),  // ✅ 1 query
  
  supabase.from('meeting_summaries')
    .select('*')
    .in('room_id', roomIds)   // ✅ 1 query
]);

// Regrouper par room_id
const participantsByRoom = {};
const transcriptsByRoom = {};
const summariesByRoom = {};

participantsData.data?.forEach(p => {
  if (!participantsByRoom[p.room_id]) participantsByRoom[p.room_id] = [];
  participantsByRoom[p.room_id].push(p);
});
// Idem pour transcripts et summaries

// Construire le résultat
const meetingsWithDetails = userMeetings.map(meeting => ({
  ...meeting,
  participants: participantsByRoom[meeting.room_id] || [],
  transcripts: transcriptsByRoom[meeting.room_id] || [],
  summary: summariesByRoom[meeting.room_id]
}));

// 50 meetings → 4 queries au lieu de 150 !
```

---

### 27. 🐌 FETCH DE PROFILES RÉPÉTÉ

**Code** :
```javascript
// LiveRoom.jsx - fetchComments
const userIds = [...new Set(data.map(c => c.user_id))];
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, full_name')
  .in('id', userIds);  // ❌ Rechargé à chaque fetchComments
```

**Solution** :
```javascript
// Cache des profiles
const profilesCacheRef = useRef({});

const getProfile = async (userId) => {
  if (profilesCacheRef.current[userId]) {
    return profilesCacheRef.current[userId];
  }
  
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('id', userId)
    .single();
  
  if (data) {
    profilesCacheRef.current[userId] = data;
  }
  
  return data;
};
```

---

## 🔐 PROBLÈMES DE SÉCURITÉ LOGIQUE

### 28. 🔓 N'importe qui peut modifier n'importe quel todo

**RLS actuel** (d'après CONFIGURATION.md) :
```sql
CREATE POLICY "Authenticated users can update todos" 
  ON todos FOR UPDATE 
  USING (auth.role() = 'authenticated');  -- ❌ Trop permissif
```

**Problème** :
User A peut cocher/modifier les todos de User B dans **n'importe quelle room** !

**Solution** :
```sql
-- Plus restrictif
CREATE POLICY "Users can update todos in rooms they participate" 
  ON todos FOR UPDATE 
  USING (
    auth.role() = 'authenticated' 
    AND room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id = auth.uid() AND status = 'online'
    )
  );

-- OU simplement : tous les participants d'une room peuvent modifier
CREATE POLICY "Todos updatable in active rooms" 
  ON todos FOR UPDATE 
  USING (auth.role() = 'authenticated');
-- (Moins sécurisé mais plus simple)
```

---

### 29. 🔓 N'importe qui peut bannir n'importe qui dans un live

**Code** :
```javascript
// LiveRoom.jsx - banViewer
const banViewer = async (viewerId) => {
  if (!window.confirm('Bannir ce spectateur ?')) return;
  await supabase.from('live_viewers')
    .delete()
    .match({ live_id: liveId, user_id: viewerId });
  // ❌ Pas de check si currentUser est l'hôte !
};
```

**Problème** :
Un spectateur peut bannir d'autres spectateurs ou même l'hôte !

**Solution** :
```javascript
const banViewer = async (viewerId) => {
  // ✅ Vérifier qu'on est l'hôte
  if (!isHost) {
    alert('Seul l\'hôte peut bannir des spectateurs');
    return;
  }
  
  if (!window.confirm('Bannir ce spectateur ?')) return;
  
  // ✅ Ajouter à une table de bans
  await supabase.from('live_bans').insert({
    live_id: liveId,
    user_id: viewerId,
    banned_by: currentUser.id,
    banned_at: new Date().toISOString()
  });
  
  // Puis supprimer
  await supabase.from('live_viewers')
    .delete()
    .match({ live_id: liveId, user_id: viewerId });
  
  fetchViewers();
};
```

**+ RLS** :
```sql
CREATE TABLE live_bans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  live_id UUID REFERENCES lives(id),
  user_id UUID REFERENCES auth.users(id),
  banned_by UUID REFERENCES auth.users(id),
  banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Policy : Seul l'hôte peut bannir
CREATE POLICY "Only host can ban" 
  ON live_viewers FOR DELETE 
  USING (
    live_id IN (
      SELECT id FROM lives WHERE host_id = auth.uid()
    )
  );
```

---

### 30. 🔓 Reports sans rate limiting

**Déjà mentionné au #16**, mais ajoutons :

**RLS** :
```sql
CREATE POLICY "Users can only create own reports" 
  ON reports FOR INSERT 
  WITH CHECK (auth.uid() = reporter_id);

-- Trigger pour limiter
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

CREATE TRIGGER report_limit_trigger
  BEFORE INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION check_report_limit();
```

---

## 📈 PROBLÈMES DE SCALABILITÉ

### 31. 📊 STATS : Requêtes lourdes non indexées

**Code** :
```javascript
// Dashboard.jsx
const { count, error: countError } = await supabase
  .from('meetings')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', currentUser.id);  // ❌ Pas d'index sur user_id
```

**Problème** :
Avec 100k meetings, cette requête prend plusieurs secondes.

**Solution** :
```sql
-- Indexes manquants
CREATE INDEX idx_meetings_user_id ON meetings(user_id);
CREATE INDEX idx_meetings_room_id ON meetings(room_id);
CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX idx_room_participants_status ON room_participants(status);
CREATE INDEX idx_room_participants_last_seen ON room_participants(last_seen);
CREATE INDEX idx_live_viewers_live_id_left_at ON live_viewers(live_id, left_at);
CREATE INDEX idx_live_comments_live_id_created_at ON live_comments(live_id, created_at);
CREATE INDEX idx_todos_room_id ON todos(room_id);
```

---

### 32. 📊 CANVAS_DATA : Peut atteindre plusieurs MB

**Problème** :
```javascript
const canvasData = canvasRef.current.toDataURL();  // ❌ Peut faire 5-10 MB !
```

**Base64 d'une image 1920x1080** → 2-5 MB en DB

**Impact** : 🔴 CRITIQUE à long terme
- Coûts Supabase très élevés
- Requêtes lentes
- Limite de 1GB par row dans Postgres

**Solution** :

**Option 1 : Compression**
```javascript
const canvasData = canvasRef.current.toDataURL('image/jpeg', 0.7);  // Qualité 70%
// OU
const canvasData = canvasRef.current.toDataURL('image/webp', 0.8);  // WebP plus efficace
```

**Option 2 : Storage**
```javascript
// Sauvegarder dans Supabase Storage au lieu de la DB
const saveCanvas = async () => {
  const canvas = canvasRef.current;
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.8));
  
  const fileName = `${roomId}-${Date.now()}.webp`;
  const { data, error } = await supabase.storage
    .from('whiteboards')
    .upload(fileName, blob);
  
  if (!error) {
    const { data: { publicUrl } } = supabase.storage
      .from('whiteboards')
      .getPublicUrl(fileName);
    
    await supabase.from('room_whiteboard').update({
      canvas_url: publicUrl,  // URL au lieu de data
      updated_at: new Date().toISOString()
    }).eq('room_id', roomId);
  }
};
```

---

### 33. 📊 LIMIT 100 sur comments - Peut perdre des messages

**Code** :
```javascript
const { data } = await supabase.from('live_comments')
  .select('*')
  .eq('live_id', liveId)
  .order('created_at', { ascending: true })
  .limit(100);  // ❌ Si > 100 messages, les anciens sont perdus
```

**Solution** :
```javascript
// Pagination avec chargement progressif
const [allComments, setAllComments] = useState([]);
const [hasMore, setHasMore] = useState(true);
const COMMENTS_PER_PAGE = 50;

const loadMoreComments = async () => {
  const { data, error } = await supabase
    .from('live_comments')
    .select('*')
    .eq('live_id', liveId)
    .order('created_at', { ascending: true })
    .range(allComments.length, allComments.length + COMMENTS_PER_PAGE - 1);
  
  if (data) {
    setAllComments(prev => [...prev, ...data]);
    setHasMore(data.length === COMMENTS_PER_PAGE);
  }
};

// Bouton "Charger plus" dans l'UI
```

---

## 🔄 PROBLÈMES DE SYNCHRONISATION

### 34. 🔄 WHITEBOARD : Pas de résolution de conflits

**Analyse du flux** :
```
User A dessine  →  Debounce 500ms  →  Sync DB
                                      ↓
User B reçoit   ←  Realtime event   ←  DB

MAIS si User B dessine pendant ce temps ?
User B dessine  →  Debounce 500ms  →  Sync DB  →  Écrase User A
```

**Comportement actuel** : Last write wins

**Solutions possibles** :

**Option 1 : Vector Clocks** (Simple)
```javascript
await supabase.from('room_whiteboard').upsert({
  room_id: roomId,
  canvas_data: canvasData,
  version: currentVersion + 1,  // ✅ Numéro de version
  updated_at: new Date().toISOString()
});

// Côté réception
if (payload.new.version > localVersion) {
  loadState(payload.new.canvas_data, true);
  setLocalVersion(payload.new.version);
} else {
  console.log('Version plus ancienne, ignorée');
}
```

**Option 2 : Event sourcing**
```sql
CREATE TABLE whiteboard_events (
  id UUID PRIMARY KEY,
  room_id TEXT,
  user_id UUID,
  event_type TEXT,  -- line, circle, rect, clear
  event_data JSONB,
  sequence INT,  -- Numéro séquentiel
  created_at TIMESTAMP
);
```

---

### 35. 🔄 CHAT : Optimistic update peut créer des doublons

**Code** :
```javascript
setComments(prev => [...prev, tempComment]);  // Ajout immédiat

// Si la subscription reçoit l'INSERT avant qu'on détecte que c'est nous :
.on('postgres_changes', { event: 'INSERT' }, (payload) => {
  if (payload.new.user_id === currentUser?.id) {
    // ✅ Bien géré
    setComments(prev => prev.map(c => ...));
  }
});
```

**Problème potentiel** :
Si `currentUser` change entre l'envoi et la réception → doublon

**Solution** :
```javascript
// Utiliser un ID unique même pour l'optimistic update
const tempId = `${currentUser.id}-${Date.now()}`;

// Stocker dans un Set les IDs en cours d'envoi
const sendingRef = useRef(new Set());

const handleSendComment = async (e) => {
  // ...
  const tempId = `temp-${Date.now()}`;
  sendingRef.current.add(tempId);
  
  setComments(prev => [...prev, tempComment]);
  
  const { error, data } = await supabase.from('live_comments')
    .insert({...})
    .select()
    .single();
  
  if (!error && data) {
    // Remplacer le temp par le vrai
    setComments(prev => prev.map(c => 
      c.id === tempId ? { ...data, profiles: c.profiles } : c
    ));
  }
  
  sendingRef.current.delete(tempId);
};

// Dans la subscription
if (!sendingRef.current.has(payload.new.id)) {
  setComments(prev => [...prev, payload.new]);
}
```

---

## 💡 PROBLÈMES D'UX/LOGIQUE

### 36. 👤 User peut rejoindre son propre live comme spectateur

**Problème** :
```javascript
// Register as viewer
if (liveData.host_id !== userId) {  // ✅ Check basique
  await supabase.from('live_viewers').upsert({...});
}
```

Mais l'hôte peut ouvrir un autre navigateur et rejoindre son propre live !

**Impact** : 🟢 FAIBLE
- Comportement bizarre mais pas cassé
- Peut être utilisé pour tester

**Solution** (si on veut l'empêcher) :
```javascript
if (liveData.host_id === userId && !isHost) {
  alert('Vous êtes l\'hôte de ce live. Utilisez l\'interface hôte.');
  navigate(`/live/${liveId}?as=host`);
  return;
}
```

---

### 37. 👤 User peut rejoindre une réunion dont il est le créateur

**Aucun problème** ici, c'est normal. Mais il faut s'assurer que :
- Le créateur ne s'appelle pas lui-même via PeerJS ✅ (déjà géré)
- Il ne voit pas son propre stream en double ✅ (déjà géré)

---

### 38. 🎥 PeerJS : Si hôte refresh, tous les spectateurs perdent la connexion

**Problème** :
```
Hôte : F5 (refresh)
  → Peer détruit
  → Nouveau peer créé avec même ID
  → Spectateurs ne savent pas qu'il faut se reconnecter
```

**Impact** : 🔴 CRITIQUE
- Tous les spectateurs voient un écran noir
- Doivent refresh manuellement

**Solution** :
```javascript
// LiveRoom.jsx - Dans subscription live status
useEffect(() => {
  const liveSub = supabase.channel(`live-status-${liveId}`)
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'lives' 
    }, async (payload) => {
      // Si l'hôte a "rebounce" (reconnexion)
      if (payload.new.host_reconnected_at > payload.old.host_reconnected_at) {
        console.log('[Live] Hôte reconnecté, réinitialisation connexion...');
        
        // Détruire l'ancien appel
        activeCalls.forEach(call => call.close());
        setActiveCalls([]);
        setRemoteStreams([]);
        
        // Recréer la connexion après 1s
        setTimeout(() => {
          if (peerInstance && live?.host_id) {
            // Rappeler l'hôte
            const emptyStream = await createEmptyStream();
            const newCall = peerInstance.call(live.host_id, emptyStream);
            // ... setup call handlers
          }
        }, 1000);
      }
    })
    .subscribe();
  
  return () => supabase.removeChannel(liveSub);
}, [liveId, peerInstance, live]);
```

**+ DB** :
```sql
ALTER TABLE lives ADD COLUMN host_reconnected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- L'hôte met à jour au refresh
await supabase.from('lives')
  .update({ host_reconnected_at: new Date().toISOString() })
  .eq('id', liveId);
```

---

## 📱 PROBLÈMES MOBILES

### 39. 📱 Pas de gestion des interruptions (appels téléphoniques)

**Scénario** :
User sur mobile reçoit un appel téléphonique pendant un live

**Comportement actuel** :
- Stream audio/vidéo coupé
- Pas de notification aux autres
- État incohérent

**Solution** :
```javascript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // App en arrière-plan
      console.log('[Mobile] App en arrière-plan');
    } else {
      // App revenue en premier plan
      console.log('[Mobile] App revenue, vérification stream...');
      if (localStream && !localStream.active) {
        alert('Votre caméra/micro ont été désactivés. Veuillez les réactiver.');
      }
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [localStream]);
```

---

## 🎯 SYNTHÈSE PAR PRIORITÉ

### 🔴 URGENT - À corriger IMMÉDIATEMENT

| # | Problème | Impact | Difficulté |
|---|----------|--------|------------|
| 1 | room_participants contrainte UNIQUE incorrecte | BLOQUANT | Moyenne |
| 4 | Nettoyage participants zombies | CRITIQUE | Moyenne |
| 10 | Nettoyage spectateurs zombies | CRITIQUE | Facile |
| 26 | N+1 Queries (History) | CRITIQUE | Facile |
| 38 | Hôte refresh = spectateurs perdus | CRITIQUE | Difficile |

### 🟡 IMPORTANT - À corriger bientôt

| # | Problème | Impact | Difficulté |
|---|----------|--------|------------|
| 2 | viewer_count non mis à jour | Moyen | Facile |
| 3 | Hôte/invités non comptés | Moyen | Facile |
| 5 | Données orphelines (FK) | Moyen | Moyenne |
| 7 | Status 'joined' jamais utilisé | Moyen | Facile |
| 9 | Messages orphelins | Moyen | Facile |
| 11 | Paramètres perdus à la reconnexion | Moyen | Moyenne |
| 12 | Tableau blanc reset | Moyen | Facile |
| 28 | RLS todos trop permissif | Moyen | Facile |
| 29 | Ban sans vérification | Moyen | Facile |

### 🟢 AMÉLIORATIONS - À planifier

| # | Problème | Impact | Difficulté |
|---|----------|--------|------------|
| 6 | Whiteboard conflicts (last write wins) | Moyen | Difficile |
| 8 | Collision room_id | Faible | Facile |
| 13 | Memory leak subscriptions | Faible | Facile |
| 14 | Optimistic updates timeout | Faible | Moyenne |
| 15 | Transcripts dupliqués | Faible | Facile |
| 17 | Validation 280 caractères | Faible | Facile |
| 27 | Cache profiles | Moyen | Facile |
| 31 | Indexes manquants | Moyen | Facile |
| 32 | Canvas data trop gros | Moyen | Moyenne |
| 39 | Interruptions mobiles | Faible | Moyenne |

---

## ✨ RECOMMANDATIONS FINALES

### Architecture
1. **Utiliser un serveur backend** pour la logique critique :
   - Génération de room_id côté serveur
   - Validation des permissions
   - Rate limiting
   - Nettoyage automatique

2. **Implémenter un système de heartbeat** :
   - Participants ping toutes les 10s
   - Viewers ping toutes les 10s
   - Nettoyage automatique des zombies

3. **Ajouter des indexes** (SQL fourni)

4. **Implémenter une stratégie de rétention** :
   - Supprimer les données > 90 jours
   - Archiver si nécessaire

### Monitoring
1. **Ajouter Sentry** pour tracker les erreurs
2. **Logger les événements critiques** :
   - Échecs de connexion PeerJS
   - Timeouts
   - Erreurs de synchronisation

### Tests
1. **Scénarios à tester** :
   - 2 users rejoignent en même temps
   - Hôte refresh pendant un live
   - 2 users dessinent en même temps
   - Fermeture brutale du navigateur
   - Connexion internet instable
   - 100+ spectateurs dans un live

---

## 📊 SCORE DE QUALITÉ ACTUEL

- **Fonctionnalités** : 8/10 ✅
- **Sécurité** : 6/10 ⚠️
- **Performance** : 5/10 ⚠️
- **Robustesse** : 5/10 ⚠️
- **Scalabilité** : 4/10 ❌
- **UX** : 8/10 ✅

**Score global** : **6/10** - Bon projet mais nécessite des améliorations critiques

---

## 🎯 PLAN D'ACTION RECOMMANDÉ

### Phase 1 - Correctifs urgents (1-2 jours)
1. Fix room_participants contrainte
2. Heartbeat + nettoyage zombies
3. Ajouter indexes
4. Fix N+1 queries

### Phase 2 - Améliorations sécurité (2-3 jours)
1. RLS plus restrictifs
2. Rate limiting
3. Validation côté serveur
4. Ban system

### Phase 3 - Robustesse (3-5 jours)
1. Gestion reconnexions
2. Error boundaries
3. Tests automatisés
4. Monitoring

### Phase 4 - Scalabilité (optionnel)
1. Backend dédié
2. CRDT pour whiteboard
3. Compression images
4. CDN pour assets

---

Analyse complète terminée ! 🎉

