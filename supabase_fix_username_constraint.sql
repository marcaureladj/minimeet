-- =====================================================
-- CORRECTION DE LA CONTRAINTE USERNAME
-- =====================================================

-- Le problème: On ne peut pas supprimer l'index directement car il est lié à une contrainte UNIQUE
-- Solution: Supprimer la contrainte, puis la recréer si nécessaire

-- Étape 1: Supprimer la contrainte UNIQUE sur username (cela supprimera aussi l'index)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;

-- Étape 2: Recréer la contrainte UNIQUE si tu veux garder l'unicité du username
-- (Cela créera automatiquement un nouvel index)
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);

-- Alternative: Si tu ne veux PAS que username soit unique, ne fais que l'étape 1
-- et commente l'étape 2

-- Vérification: Afficher les contraintes sur la table profiles
SELECT 
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass;
