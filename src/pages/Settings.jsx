import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { User, Mail, Lock, Camera, Save, Loader2, Check, ArrowLeft, Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const SettingsPage = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [profile, setProfile] = useState({
    username: '',
    avatar_url: ''
  });
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        setEmail(session.user.email || '');
        setDisplayName(session.user.user_metadata?.full_name || session.user.user_metadata?.display_name || '');
        fetchProfile(session.user.id);
      } else {
        navigate('/login');
      }
    };
    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) navigate('/login');
    });
    return () => authListener?.subscription?.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile({
          username: data.username || '',
          avatar_url: data.avatar_url || ''
        });
        if (data.avatar_url) setAvatarPreview(data.avatar_url);
      }
    } catch (e) {
      console.error('Error fetching profile:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image trop grande (max 2MB)' });
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile || !currentUser) return null;

    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      let avatarUrl = profile.avatar_url;
      if (avatarFile) {
        avatarUrl = await uploadAvatar();
      }

      // Mettre à jour le display name dans auth.users (user_metadata)
      // Sauvegarder à la fois full_name et display_name pour compatibilité
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: displayName.trim(),
          display_name: displayName.trim()
        }
      });
      if (authError) throw authError;

      // Recharger l'utilisateur pour avoir les nouvelles métadonnées
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUser(user);

      // Mettre à jour username, avatar ET full_name dans profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: currentUser.id,
          full_name: displayName,
          username: profile.username,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;
      setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' });
      setAvatarFile(null);
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur: ' + e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!email || email === currentUser.email) return;
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Un email de confirmation a été envoyé.' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur: ' + e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwords.new || passwords.new !== passwords.confirm) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    if (passwords.new.length < 6) {
      setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères.' });
      return;
    }

    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Mot de passe mis à jour avec succès !' });
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur: ' + e.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-gray-100 to-gray-200">
        <Sidebar user={currentUser} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-100 to-gray-200">
      <Sidebar user={currentUser} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 p-3 sm:p-5 overflow-hidden">
        <div className="h-full bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
                <Menu size={24} className="text-gray-600" />
              </button>
              <img src="/logo-minimeet.png" alt="MiniMeet" className="h-6 sm:h-8" />
              <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-xl">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Paramètres</h1>
                <p className="text-xs sm:text-sm text-gray-500">Gérez votre profil et vos préférences</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
            {message.text && (
              <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {message.text}
              </div>
            )}

            <div className="max-w-2xl space-y-8">
              {/* Avatar Section */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Photo de profil</h3>
                <div className="flex items-center space-x-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-3xl font-bold">
                          {displayName?.charAt(0) || currentUser?.email?.charAt(0) || 'U'}
                        </span>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors">
                      <Camera size={16} className="text-white" />
                      <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                    </label>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">JPG, PNG ou GIF. Max 2MB.</p>
                    {avatarFile && <p className="text-sm text-blue-600 mt-1">Nouvelle image sélectionnée</p>}
                  </div>
                </div>
              </div>

              {/* Profile Info */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations personnelles</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom complet</label>
                    <div className="relative">
                      <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Votre nom"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom d'utilisateur</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                      <input
                        type="text"
                        value={profile.username}
                        onChange={(e) => setProfile({ ...profile, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="username"
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  <span>Enregistrer</span>
                </button>
              </div>

              {/* Email */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Adresse email</h3>
                <div className="relative">
                  <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleUpdateEmail}
                  disabled={isSaving || email === currentUser?.email}
                  className="mt-4 px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center space-x-2"
                >
                  <span>Modifier l'email</span>
                </button>
              </div>

              {/* Password */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Mot de passe</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau mot de passe</label>
                    <div className="relative">
                      <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="password"
                        value={passwords.new}
                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Min. 6 caractères"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer le mot de passe</label>
                    <div className="relative">
                      <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="password"
                        value={passwords.confirm}
                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Confirmez"
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleUpdatePassword}
                  disabled={isSaving || !passwords.new}
                  className="mt-4 px-6 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  <Lock size={18} />
                  <span>Changer le mot de passe</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
