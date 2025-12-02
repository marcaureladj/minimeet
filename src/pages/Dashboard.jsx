import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { Video, Plus, Users, Clock, Trash2, ArrowRight, Calendar, Copy, Check, X, Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Avatar from '../components/Avatar';
import { getDisplayName, getInitials, getDisplayNameWithProfile } from '../services/userUtils';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [pastMeetings, setPastMeetings] = useState([]);
  const [totalMeetingsCount, setTotalMeetingsCount] = useState(0);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [showMeetingNameModal, setShowMeetingNameModal] = useState(false);
  const [meetingName, setMeetingName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchUserSession = async () => {
      setIsLoadingUser(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Recharger l'utilisateur pour avoir les dernières métadonnées
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setCurrentUser(user);
          } else {
            setCurrentUser(session.user);
          }
          setIsLoadingUser(false);
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUser(user);
      } catch (e) {
        console.error('Exception dans fetchUserSession:', e);
      } finally {
        setIsLoadingUser(false);
      }
    };
    fetchUserSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const userFromSession = session?.user ?? null;
      setCurrentUser(userFromSession);
      setIsLoadingUser(false);
      if (event === 'SIGNED_OUT' || (!userFromSession && event === 'INITIAL_SESSION')) {
        navigate('/login');
      }
    });
    return () => authListener?.subscription?.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (currentUser) {
      fetchPastMeetings();
      // Charger le nom depuis profiles si nécessaire
      const loadUserData = async () => {
        const name = await getDisplayNameWithProfile(currentUser);
        setDisplayName(name);

        // Charger l'avatar depuis profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', currentUser.id)
          .single();

        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }
      };
      loadUserData();
    } else {
      setPastMeetings([]);
      setDisplayName('');
      setAvatarUrl(null);
    }
  }, [currentUser]);

  const fetchPastMeetings = async () => {
    if (!currentUser) return;
    setIsLoadingMeetings(true);
    try {
      // Récupérer les 10 dernières réunions pour l'affichage
      const { data, error } = await supabase
        .from('meetings')
        .select('id, room_id, created_at, name')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setPastMeetings(data || []);

      // Récupérer le total de toutes les réunions
      const { count, error: countError } = await supabase
        .from('meetings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);
      if (countError) throw countError;
      setTotalMeetingsCount(count || 0);
    } catch (error) {
      console.error('Erreur fetchPastMeetings:', error.message);
    } finally {
      setIsLoadingMeetings(false);
    }
  };

  const handleDeleteMeeting = async (meetingId) => {
    if (!window.confirm("Supprimer cette réunion de l'historique ?")) return;
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .match({ id: meetingId, user_id: currentUser.id });
      if (error) throw error;
      setPastMeetings(prev => prev.filter(m => m.id !== meetingId));
    } catch (error) {
      alert('Impossible de supprimer: ' + error.message);
    }
  };

  const handleCreateRoom = async () => {
    if (!currentUser) {
      alert('Veuillez vous reconnecter.');
      return;
    }
    setShowMeetingNameModal(true);
  };

  const confirmCreateRoom = async () => {
    if (!meetingName.trim()) {
      alert('Veuillez entrer un nom pour la réunion.');
      return;
    }

    setIsCreatingRoom(true);
    const generatedRoomId = uuidv4().substring(0, 12);
    try {
      await supabase.from('meetings').insert([{
        room_id: generatedRoomId,
        user_id: currentUser.id,
        name: meetingName.trim()
      }]);
      setShowMeetingNameModal(false);
      setMeetingName('');
      navigate(`/meet/${generatedRoomId}`);
    } catch (error) {
      alert('Erreur: ' + error.message);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (joinRoomId.trim()) navigate(`/meet/${joinRoomId.trim()}`);
  };

  const copyToClipboard = (roomId) => {
    navigator.clipboard.writeText(roomId);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoadingUser) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-gray-100 to-gray-200 items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const currentDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-100 to-gray-200">
      <Sidebar user={currentUser} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 p-3 sm:p-5 overflow-hidden">
        <div className="h-full bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-4 border-b border-gray-100">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                {/* Bouton hamburger pour mobile/tablette */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Menu size={24} className="text-gray-600" />
                </button>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 mb-1 capitalize">{currentDate}</p>
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900">
                    Bonjour, {displayName || getDisplayName(currentUser)} 👋
                  </h1>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="hidden sm:block">
                  <Avatar user={{ ...currentUser, avatar_url: avatarUrl }} size="md" />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Actions rapides */}
              <div className="lg:col-span-2 space-y-6">
                {/* Créer une réunion */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold mb-2">Nouvelle réunion</h2>
                      <p className="text-blue-100 text-sm">Créez une réunion instantanée et invitez vos participants</p>
                    </div>
                    <button
                      onClick={handleCreateRoom}
                      className="w-14 h-14 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center justify-center transition-all duration-200 hover:scale-105"
                    >
                      <Plus size={28} />
                    </button>
                  </div>
                  <button
                    onClick={handleCreateRoom}
                    className="mt-4 w-full py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Video size={20} />
                    <span>Démarrer maintenant</span>
                  </button>
                </div>

                {/* Rejoindre une réunion */}
                <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
                    <Users size={20} className="text-gray-500" />
                    <span>Rejoindre une réunion</span>
                  </h3>
                  <form onSubmit={handleJoinRoom} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={joinRoomId}
                      onChange={(e) => setJoinRoomId(e.target.value)}
                      placeholder="Entrez l'ID de la réunion"
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!joinRoomId.trim()}
                      className="w-full sm:w-auto px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                    >
                      <span>Rejoindre</span>
                      <ArrowRight size={18} />
                    </button>
                  </form>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-3xl p-5">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Calendar size={20} className="text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">Total réunions</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{totalMeetingsCount}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-teal-50 border border-green-100 rounded-3xl p-5">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <Clock size={20} className="text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">Statut</span>
                  </div>
                  <p className="text-lg font-bold text-green-600">En ligne</p>
                </div>
              </div>
            </div>

            {/* Réunions récentes */}
            <div className="mt-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <Clock size={20} className="text-gray-500" />
                <span>Réunions récentes</span>
              </h3>

              {isLoadingMeetings ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full"></div>
                </div>
              ) : pastMeetings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pastMeetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="group bg-gray-50 hover:bg-white border border-gray-100 hover:border-gray-200 rounded-2xl p-4 transition-all duration-200 hover:shadow-lg"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                          <Video size={18} className="text-blue-600" />
                        </div>
                        <button
                          onClick={() => handleDeleteMeeting(meeting.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <p className="font-semibold text-gray-900 mb-1 truncate">
                        {meeting.name || `Réunion ${meeting.room_id.substring(0, 8)}...`}
                      </p>
                      <div className="flex items-center space-x-2 mb-3">
                        <code className="text-xs bg-gray-200 px-2 py-1 rounded-md text-gray-600 truncate max-w-[120px]">
                          {meeting.room_id}
                        </code>
                        <button
                          onClick={() => copyToClipboard(meeting.room_id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {copiedId === meeting.room_id ? (
                            <Check size={14} className="text-green-500" />
                          ) : (
                            <Copy size={14} className="text-gray-400" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        {new Date(meeting.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <button
                        onClick={() => navigate(`/meet/${meeting.room_id}`)}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Rejoindre
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl">
                  <Video size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Aucune réunion récente</p>
                  <p className="text-sm text-gray-400 mt-1">Créez votre première réunion pour commencer</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal pour le nom de la réunion */}
      {showMeetingNameModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Nommer la réunion</h3>
              <button
                onClick={() => {
                  setShowMeetingNameModal(false);
                  setMeetingName('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de la réunion
                </label>
                <input
                  type="text"
                  value={meetingName}
                  onChange={(e) => setMeetingName(e.target.value)}
                  placeholder="Ex: Réunion équipe marketing"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && meetingName.trim()) {
                      confirmCreateRoom();
                    }
                  }}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowMeetingNameModal(false);
                    setMeetingName('');
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmCreateRoom}
                  disabled={!meetingName.trim() || isCreatingRoom}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  {isCreatingRoom ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Création...</span>
                    </>
                  ) : (
                    <>
                      <Video size={18} />
                      <span>Créer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
