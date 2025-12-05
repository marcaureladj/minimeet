import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { getDisplayName } from '../services/userUtils';
import {
  Radio, Plus, Calendar, Eye, Play, Trash2, Search, X, Clock, Menu
} from 'lucide-react';
import Sidebar from '../components/Sidebar';

const LivePage = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lives, setLives] = useState([]);
  const [myLives, setMyLives] = useState([]);
  const [activeTab, setActiveTab] = useState('discover');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        fetchLives();
        fetchMyLives(session.user.id);
      } else {
        navigate('/login');
      }
    };
    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) navigate('/login');
    });

    const liveSub = supabase.channel('lives-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lives' }, () => {
        fetchLives();
        if (currentUser) fetchMyLives(currentUser.id);
      }).subscribe();

    return () => {
      authListener?.subscription?.unsubscribe();
      supabase.removeChannel(liveSub);
    };
  }, [navigate]);

  const fetchLives = async () => {
    setIsLoading(true);
    try {
      const { data: livesData } = await supabase.from('lives').select('*')
        .in('status', ['scheduled', 'live']).order('scheduled_at', { ascending: true });

      if (livesData?.length > 0) {
        const hostIds = [...new Set(livesData.map(l => l.host_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', hostIds);
        const map = {}; profiles?.forEach(p => { map[p.id] = p; });
        setLives(livesData.map(l => ({ ...l, profiles: map[l.host_id] })));
      } else {
        setLives([]);
      }
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyLives = async (userId) => {
    const { data } = await supabase.from('lives').select('*').eq('host_id', userId).order('created_at', { ascending: false });
    setMyLives(data || []);
  };

  const deleteLive = async (liveId, e) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce live ?')) return;
    await supabase.from('lives').delete().eq('id', liveId);
    fetchMyLives(currentUser.id);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const filteredLives = lives.filter(l =>
    l.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-gray-100 to-gray-200">
        <Sidebar user={currentUser} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-100 to-gray-200">
      <Sidebar user={currentUser} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 p-3 md:p-5 overflow-hidden">
        <div className="h-full bg-white rounded-2xl md:rounded-3xl shadow-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 md:px-8 pt-4 md:pt-6 pb-4 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
                  <Menu size={24} className="text-gray-600" />
                </button>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <Radio size={20} className="text-red-600" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">Lives</h1>
                  <p className="text-xs md:text-sm text-gray-500 hidden sm:block">Diffusez ou regardez en direct</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 flex items-center justify-center gap-2 text-sm">
                <Plus size={18} />
                <span>Créer un live</span>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-4">
              {[
                { id: 'discover', label: 'Découvrir' },
                { id: 'my-lives', label: 'Mes lives' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 md:p-8 overflow-y-auto">
            {activeTab === 'discover' && (
              <>
                {/* Search */}
                <div className="mb-6">
                  <div className="relative max-w-md">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher..." className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                  </div>
                </div>

                {filteredLives.length === 0 ? (
                  <EmptyState message="Aucun live disponible" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredLives.map(live => (
                      <LiveCard key={live.id} live={live} onClick={() => navigate(`/live/${live.id}`)} formatDate={formatDate} />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'my-lives' && (
              <>
                {myLives.length === 0 ? (
                  <EmptyState message="Vous n'avez pas encore créé de live" action={() => setShowCreateModal(true)} actionLabel="Créer mon premier live" />
                ) : (
                  <div className="space-y-3">
                    {myLives.map(live => (
                      <MyLiveCard key={live.id} live={live} onDelete={(e) => deleteLive(live.id, e)}
                        onClick={() => navigate(`/live/${live.id}`)} formatDate={formatDate} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateLiveModal currentUser={currentUser} onClose={() => setShowCreateModal(false)}
          onCreated={() => { fetchMyLives(currentUser.id); setShowCreateModal(false); }} />
      )}
    </div>
  );
};

// Components
const EmptyState = ({ message, action, actionLabel }) => (
  <div className="text-center py-16">
    <Radio size={48} className="mx-auto text-gray-300 mb-4" />
    <p className="text-gray-500 mb-4">{message}</p>
    {action && (
      <button onClick={action} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">
        {actionLabel}
      </button>
    )}
  </div>
);

const LiveCard = ({ live, onClick, formatDate }) => (
  <div onClick={onClick} className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all cursor-pointer group">
    <div className="aspect-video bg-gradient-to-br from-red-500 to-pink-500 relative">
      {live.thumbnail_url ? (
        <img src={live.thumbnail_url} alt={live.title} className="w-full h-full object-cover" />
      ) : (
        <div className="flex items-center justify-center h-full">
          <Radio size={40} className="text-white/40" />
        </div>
      )}
      {live.status === 'live' && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          LIVE
        </div>
      )}
      {live.status === 'scheduled' && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg">
          Programmé
        </div>
      )}
      <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded-lg flex items-center gap-1">
        <Eye size={12} /> {live.viewer_count || 0}
      </div>
    </div>
    <div className="p-3">
      <h3 className="font-semibold text-gray-900 text-sm truncate">{live.title}</h3>
      <div className="flex items-center gap-2 mt-1">
        <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-semibold">
          {live.profiles?.full_name?.charAt(0) || 'U'}
        </div>
        <span className="text-xs text-gray-500 truncate">{live.profiles?.full_name || 'Utilisateur'}</span>
      </div>
      {live.scheduled_at && (
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
          <Calendar size={12} /> {formatDate(live.scheduled_at)}
        </p>
      )}
    </div>
  </div>
);

const MyLiveCard = ({ live, onDelete, onClick, formatDate }) => (
  <div onClick={onClick} className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between gap-4 hover:shadow-md transition-all cursor-pointer">
    <div className="flex items-center gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${live.status === 'live' ? 'bg-red-100' : live.status === 'scheduled' ? 'bg-blue-100' : 'bg-gray-200'
        }`}>
        <Radio size={18} className={live.status === 'live' ? 'text-red-600' : live.status === 'scheduled' ? 'text-blue-600' : 'text-gray-500'} />
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-gray-900 text-sm truncate">{live.title}</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className={`px-2 py-0.5 rounded-full font-medium ${live.status === 'live' ? 'bg-red-100 text-red-700' : live.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
            }`}>
            {live.status === 'live' ? 'En direct' : live.status === 'scheduled' ? 'Programmé' : 'Terminé'}
          </span>
          {live.scheduled_at && <span className="hidden sm:inline">{formatDate(live.scheduled_at)}</span>}
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {live.status !== 'live' && (
        <button onClick={onDelete} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
          <Trash2 size={16} />
        </button>
      )}
      <button className="px-3 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 flex items-center gap-1">
        <Play size={14} />
        <span className="hidden sm:inline">{live.status === 'live' ? 'Rejoindre' : 'Lancer'}</span>
      </button>
    </div>
  </div>
);

const CreateLiveModal = ({ currentUser, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      await supabase.from('lives').insert({
        host_id: currentUser.id,
        title: title.trim(),
        description: description.trim(),
        status: 'scheduled',
        scheduled_at: isScheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null
      });
      onCreated();
    } catch (e) {
      alert('Erreur: ' + e.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Créer un live</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Ex: Discussion tech" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              placeholder="De quoi allez-vous parler ?" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded" />
            <span className="text-sm text-gray-700">Programmer pour plus tard</span>
          </label>

          {isScheduled && (
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent" />
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium text-sm">
            Annuler
          </button>
          <button onClick={handleCreate} disabled={!title.trim() || isCreating}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium text-sm hover:bg-red-700 disabled:opacity-50">
            {isCreating ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LivePage;
