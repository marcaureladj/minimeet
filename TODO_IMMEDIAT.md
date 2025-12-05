# ⚡ ACTIONS IMMÉDIATES - À FAIRE MAINTENANT

## 🎯 Étape 1 : Créer le fichier .env

Créer un fichier `.env` à la racine du projet avec ce contenu :

```env
# Supabase (OBLIGATOIRE - Remplacer par vos vraies valeurs)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# OpenRouter pour IA (OPTIONNEL)
VITE_OPENROUTER_API_KEY=your-openrouter-key

# TURN Server (OPTIONNEL - Laisser vide pour utiliser les valeurs par défaut)
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

**Comment obtenir vos credentials Supabase** :
1. Aller sur https://supabase.com
2. Ouvrir votre projet
3. Aller dans `Settings` > `API`
4. Copier `Project URL` → `VITE_SUPABASE_URL`
5. Copier `anon public` key → `VITE_SUPABASE_ANON_KEY`

---

## 🎯 Étape 2 : Configurer la base de données Supabase

### Option A : Exécution SQL directe (RECOMMANDÉ)

1. Aller sur https://supabase.com
2. Ouvrir votre projet
3. Aller dans `SQL Editor`
4. Créer une nouvelle query
5. Copier-coller **TOUT** le contenu de la section "Créer les tables" dans `CONFIGURATION.md`
6. Cliquer sur `Run`
7. Attendre que ça finisse (peut prendre 30-60s)

### Option B : Migration (si vous utilisez déjà des migrations)

Voir `CONFIGURATION.md` pour les détails

---

## 🎯 Étape 3 : Activer Realtime sur Supabase

1. Aller dans `Database` > `Replication`
2. Cocher ces tables :
   - ✅ `room_participants`
   - ✅ `messages`
   - ✅ `todos`
   - ✅ `room_whiteboard`
   - ✅ `lives`
   - ✅ `live_viewers`
   - ✅ `live_comments`
   - ✅ `live_reactions`
   - ✅ `live_guests`
3. Sauvegarder

---

## 🎯 Étape 4 : Lancer l'application

```bash
npm run dev
```

Ou si vous utilisez yarn :
```bash
yarn dev
```

L'application devrait s'ouvrir sur `http://localhost:5173`

---

## 🎯 Étape 5 : Premier test

### Test 1 - Authentification
1. Créer un compte
2. Vérifier que vous êtes redirigé vers le dashboard

### Test 2 - Réunion
1. Cliquer sur "Nouvelle réunion"
2. Autoriser caméra/micro
3. Ouvrir un onglet privé
4. Rejoindre avec l'ID de la réunion
5. ✅ Les deux utilisateurs doivent se voir/entendre

### Test 3 - Live (LE PLUS IMPORTANT)
1. Aller dans "Lives"
2. Créer un live
3. Démarrer le live
4. **Ouvrir la console du navigateur** (F12)
5. Vérifier : `[Live PeerJS] Hôte peer ouvert`
6. Ouvrir un autre navigateur
7. Rejoindre le live comme spectateur
8. **Ouvrir la console**
9. Vérifier : `[Live PeerJS] Spectateur peer ouvert`
10. Après 1-2 secondes : `✅ Spectateur reçoit stream hôte!`
11. ✅ Le spectateur doit voir/entendre l'hôte

---

## 🐛 En cas de problème

### Problème : "Cannot read properties of undefined"
**Solution** : Vérifier que le `.env` est bien créé et contient vos credentials

### Problème : "Error: Invalid Supabase URL"
**Solution** : Vérifier l'URL dans `.env` (doit commencer par `https://`)

### Problème : Spectateurs ne voient pas l'hôte
**Solution** :
1. Ouvrir la console (F12)
2. Chercher les logs `[Live PeerJS]`
3. S'il y a des erreurs rouges, me les envoyer
4. Vérifier que l'hôte a bien autorisé caméra/micro

### Problème : "Row Level Security policy violation"
**Solution** :
1. Aller sur Supabase
2. SQL Editor
3. Copier-coller la section "RLS" de `CONFIGURATION.md`
4. Exécuter

### Problème : Temps réel ne fonctionne pas
**Solution** :
1. Vérifier que Realtime est activé (Étape 3)
2. Vérifier les RLS policies
3. Recharger la page

---

## 📞 Besoin d'aide ?

Si vous rencontrez un problème :

1. **Ouvrir la console** (F12)
2. Copier les messages d'erreur
3. Me contacter avec :
   - Le message d'erreur
   - Ce que vous essayiez de faire
   - Dans quelle partie de l'app (Login, Dashboard, Live, etc.)

Email : marcaureladj@gmail.com

---

## ✅ Checklist finale

Avant de me contacter, vérifier que :
- [ ] Le fichier `.env` existe et contient vos vraies credentials
- [ ] Les tables Supabase sont créées (vérifier dans Database > Tables)
- [ ] Les RLS policies sont configurées
- [ ] Realtime est activé sur les bonnes tables
- [ ] `npm run dev` fonctionne sans erreur
- [ ] J'ai testé l'authentification (créer compte + login)

---

## 🎉 C'est tout !

Une fois ces 5 étapes complétées, tout devrait fonctionner parfaitement !

Les fichiers suivants contiennent plus de détails si besoin :
- 📘 `RESUME_CORRECTIONS.md` - Vue d'ensemble des corrections
- 📗 `CORRECTIONS.md` - Détails techniques complets
- 📙 `CONFIGURATION.md` - Guide de configuration détaillé

**Bonne chance ! 🚀**

