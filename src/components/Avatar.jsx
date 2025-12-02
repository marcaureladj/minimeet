import React from 'react';
import { getInitials } from '../services/userUtils';

/**
 * Composant Avatar réutilisable
 * Affiche la photo de profil si disponible, sinon les initiales
 * 
 * @param {Object} user - Objet utilisateur avec avatar_url et nom
 * @param {string} size - Taille: 'xs', 'sm', 'md', 'lg', 'xl'
 * @param {string} className - Classes CSS additionnelles
 */
const Avatar = ({ user, size = 'md', className = '' }) => {
    // Déterminer l'URL de l'avatar
    const avatarUrl = user?.avatar_url || user?.profiles?.avatar_url;

    // Déterminer le nom pour les initiales
    const displayName = user?.user_metadata?.full_name ||
        user?.user_metadata?.display_name ||
        user?.profiles?.full_name ||
        user?.email ||
        'U';

    // Tailles prédéfinies
    const sizes = {
        xs: 'w-6 h-6 text-xs',
        sm: 'w-8 h-8 text-sm',
        md: 'w-10 h-10 text-base',
        lg: 'w-12 h-12 text-lg',
        xl: 'w-16 h-16 text-xl',
        '2xl': 'w-20 h-20 text-2xl'
    };

    const sizeClass = sizes[size] || sizes.md;

    // Générer les initiales
    const initials = getInitials({
        user_metadata: { full_name: displayName },
        email: user?.email
    });

    if (avatarUrl) {
        return (
            <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
                <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        // Si l'image ne charge pas, afficher les initiales
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                    }}
                />
                <div
                    className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold"
                    style={{ display: 'none' }}
                >
                    {initials}
                </div>
            </div>
        );
    }

    // Pas d'avatar, afficher les initiales
    return (
        <div className={`${sizeClass} rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}>
            {initials}
        </div>
    );
};

export default Avatar;
