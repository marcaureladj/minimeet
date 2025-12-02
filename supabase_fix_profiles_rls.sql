-- =====================================================
-- CORRECTION COMPLÈTE DES POLITIQUES RLS POUR PROFILES
-- =====================================================

-- Étape 1: Supprimer TOUTES les anciennes politiques
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.profiles';
    END LOOP;
END $$;

-- Étape 2: S'assurer que RLS est activé
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Étape 3: Créer les nouvelles politiques avec des noms uniques
CREATE POLICY "profiles_select_all" 
ON public.profiles 
FOR SELECT 
USING (true);

CREATE POLICY "profiles_insert_own" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);

-- Étape 4: Vérifier que les colonnes existent
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Note: username a déjà une contrainte UNIQUE, pas besoin de la recréer

-- Étape 5: Trigger pour auto-créer les profils
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Étape 6: Créer les profils manquants pour les utilisateurs existants
INSERT INTO public.profiles (id, full_name, updated_at)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', ''),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Étape 7: Vérification finale
-- Afficher le nombre de profils créés
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM public.profiles) as total_profiles;

-- Afficher les politiques actives
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public';
