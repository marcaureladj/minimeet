import { supabase } from './supabaseClient';

// Utilitaire pour obtenir le nom d'affichage de l'utilisateur
// Priorité: user_metadata.full_name > user_metadata.display_name > profiles.full_name > email username > 'Utilisateur'

// Version synchrone pour l'affichage immédiat (utilise user_metadata uniquement)
export const getDisplayName = (user) => {
  if (!user) return 'Utilisateur';

  // 1. Essayer user_metadata.full_name (Supabase Auth - source de vérité)
  if (user.user_metadata?.full_name) {
    return user.user_metadata.full_name;
  }

  // 2. Essayer user_metadata.display_name (alternative)
  if (user.user_metadata?.display_name) {
    return user.user_metadata.display_name;
  }

  // 3. Fallback sur la partie avant @ de l'email
  if (user.email) {
    return user.email.split('@')[0];
  }

  return 'Utilisateur';
};

// Version asynchrone qui charge depuis profiles si user_metadata n'a pas le nom
export const getDisplayNameWithProfile = async (user) => {
  if (!user) {
    return 'Utilisateur';
  }

  // 1. Essayer user_metadata.full_name (depuis auth.users via user_metadata)
  if (user.user_metadata?.full_name) {
    return user.user_metadata.full_name;
  }

  // 2. Essayer user_metadata.display_name (depuis auth.users via user_metadata)
  if (user.user_metadata?.display_name) {
    return user.user_metadata.display_name;
  }

  // 3. Si pas dans user_metadata, récupérer depuis la table profiles
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    if (!error && profile?.full_name) {
      // Synchroniser avec user_metadata pour les prochaines fois
      if (profile.full_name !== user.user_metadata?.full_name) {
        await supabase.auth.updateUser({
          data: { full_name: profile.full_name }
        });
      }
      return profile.full_name;
    }
  } catch (e) {
    console.error('Erreur lors de la récupération du profil:', e);
  }

  // 4. Fallback sur la partie avant @ de l'email
  if (user.email) {
    return user.email.split('@')[0];
  }

  return 'Utilisateur';
};

export const getInitials = (user) => {
  const name = getDisplayName(user);
  if (!name) return 'U';

  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
};

// Pour les données venant de profiles (JOINs SQL)
export const getProfileDisplayName = (profile, fallbackEmail) => {
  if (profile?.full_name) return profile.full_name;
  if (fallbackEmail) return fallbackEmail.split('@')[0];
  return 'Utilisateur';
};
