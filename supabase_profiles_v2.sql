-- =====================================================
-- SOLUTION V2: GARDER full_name DANS PROFILES MAIS SYNCHRONISÉ
-- =====================================================

-- PHILOSOPHIE: 
-- - auth.users.user_metadata.full_name = source de vérité (modifiable via Settings)
-- - profiles.full_name = copie synchronisée pour les JOINs SQL
-- - Trigger pour synchroniser automatiquement

-- Étape 1: Nettoyer les anciennes politiques
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.profiles';
    END LOOP;
END $$;

-- Étape 2: S'assurer que full_name existe dans profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Étape 3: Activer RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Étape 4: Créer les politiques RLS
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
USING (auth.uid() = id);

CREATE POLICY "profiles_delete_own" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);

-- Étape 5: Trigger pour créer profil à l'inscription (SECURITY DEFINER bypass RLS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, updated_at)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Étape 6: Trigger pour synchroniser full_name quand auth.users est mis à jour
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET 
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', profiles.full_name),
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_user_update();

-- Étape 7: Synchroniser les profils existants avec auth.users
DO $$
BEGIN
  -- Désactiver temporairement RLS
  ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
  
  -- Créer les profils manquants
  INSERT INTO public.profiles (id, full_name, updated_at)
  SELECT 
    au.id, 
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    NOW()
  FROM auth.users au
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
  ON CONFLICT (id) DO NOTHING;
  
  -- Mettre à jour les full_name existants depuis auth.users
  UPDATE public.profiles p
  SET full_name = COALESCE(au.raw_user_meta_data->>'full_name', p.full_name, au.email)
  FROM auth.users au
  WHERE p.id = au.id AND (p.full_name IS NULL OR p.full_name = '');
  
  -- Réactiver RLS
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
END $$;

-- Étape 8: Vérification
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM public.profiles) as total_profiles,
  (SELECT COUNT(*) FROM public.profiles WHERE full_name IS NOT NULL AND full_name != '') as profiles_with_name;

SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public';
