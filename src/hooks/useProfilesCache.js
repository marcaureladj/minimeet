import { useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * Hook pour mettre en cache les profils utilisateurs
 * Évite les requêtes répétées pour les mêmes profils
 */
export const useProfilesCache = () => {
  const cacheRef = useRef({});

  /**
   * Récupère un seul profil (avec cache)
   */
  const getProfile = useCallback(async (userId) => {
    if (!userId) return null;
    
    // Retourner depuis le cache si disponible
    if (cacheRef.current[userId]) {
      return cacheRef.current[userId];
    }
    
    // Sinon, charger depuis la DB
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        cacheRef.current[userId] = data;
        return data;
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
    
    return null;
  }, []);

  /**
   * Récupère plusieurs profils en une seule requête (avec cache)
   */
  const getProfiles = useCallback(async (userIds) => {
    if (!userIds || userIds.length === 0) return [];
    
    // Filtrer les IDs déjà en cache
    const uncachedIds = userIds.filter(id => !cacheRef.current[id]);
    
    // Si il y a des IDs non cachés, les charger
    if (uncachedIds.length > 0) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username')
          .in('id', uncachedIds);
        
        if (!error && data) {
          // Mettre en cache les nouveaux profils
          data.forEach(profile => {
            cacheRef.current[profile.id] = profile;
          });
        }
      } catch (error) {
        console.error('Error fetching profiles:', error);
      }
    }
    
    // Retourner tous les profils demandés depuis le cache
    return userIds
      .map(id => cacheRef.current[id])
      .filter(Boolean);
  }, []);

  /**
   * Invalider le cache pour un user spécifique
   */
  const invalidate = useCallback((userId) => {
    if (userId) {
      delete cacheRef.current[userId];
    }
  }, []);

  /**
   * Vider tout le cache
   */
  const clear = useCallback(() => {
    cacheRef.current = {};
  }, []);

  /**
   * Mettre à jour manuellement un profil dans le cache
   */
  const setProfile = useCallback((userId, profile) => {
    if (userId && profile) {
      cacheRef.current[userId] = profile;
    }
  }, []);

  return { 
    getProfile, 
    getProfiles, 
    invalidate, 
    clear,
    setProfile
  };
};

export default useProfilesCache;

