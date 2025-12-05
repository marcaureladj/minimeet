import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Video, Clock, Radio, Settings, LogOut, X } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { getDisplayName, getInitials, getDisplayNameWithProfile } from '../services/userUtils';
import Avatar from './Avatar';

const Sidebar = ({ user, isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { icon: Home, path: '/dashboard', label: 'Accueil' },
    { icon: Video, path: '/meet', label: 'Réunions', disabled: true },
    { icon: Clock, path: '/history', label: 'Historique' },
    { icon: Radio, path: '/live', label: 'Lives' },
  ];

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleNavigate = (path, disabled) => {
    if (!disabled) {
      navigate(path);
      // Fermer le menu mobile après navigation
      if (setIsOpen) setIsOpen(false);
    }
  };

  useEffect(() => {
    if (user) {
      const loadUserData = async () => {
        // Charger le nom d'affichage
        const name = await getDisplayNameWithProfile(user);
        setDisplayName(name);

        // Charger l'avatar depuis profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();

        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }
      };
      loadUserData();
    } else {
      setDisplayName('');
      setAvatarUrl(null);
    }
  }, [user]);

  // Contenu de la sidebar
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-6 py-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white rounded-xl p-2 shadow-sm">
              <img src="/logo-minimeet.png" alt="MiniMeet" className="h-8" />
            </div>
          </div>
          {/* Bouton fermer sur mobile */}
          {setIsOpen && (
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={24} className="text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path, item.disabled)}
              disabled={item.disabled}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${active
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : item.disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom section */}
      <div className="px-4 py-4 border-t border-gray-100 space-y-1">
        <button
          onClick={() => handleNavigate('/settings', false)}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <Settings size={20} />
          <span className="font-medium">Paramètres</span>
        </button>

        {/* User info */}
        <div className="px-4 py-3 flex items-center space-x-3">
          <div className="relative">
            <Avatar user={{ ...user, avatar_url: avatarUrl }} size="md" />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {displayName || getDisplayName(user)}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.email}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Déconnexion</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Overlay pour mobile/tablette */}
      {isOpen && setIsOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Desktop (toujours visible) */}
      <div className="hidden lg:flex lg:w-64 bg-white flex-col shadow-sm border-r border-gray-100">
        {sidebarContent}
      </div>

      {/* Sidebar Mobile/Tablette (drawer) */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white flex flex-col shadow-xl border-r border-gray-100 z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};

export default Sidebar;
