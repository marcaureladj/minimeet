import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { initializePeer, getPeer, destroyPeer } from '../services/peerClient';
import { getDisplayName } from '../services/userUtils';
import {
  Radio, Eye, Send, Heart, ThumbsUp, Flame, Star, Sparkles,
  Flag, X, UserPlus, PhoneOff, Mic, MicOff, Video, VideoOff,
  Monitor, MonitorOff, Circle, UserX, MessageCircle, ChevronUp
} from 'lucide-react';
import Avatar from '../components/Avatar';

const LiveRoomPage = () => {
  const { liveId } = useParams();
  const navigate = useNavigate();

  // User & Live state
  const [currentUser, setCurrentUser] = useState(null);
  const [live, setLive] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Chat & Viewers
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [viewers, setViewers] = useState([]);
  const [guests, setGuests] = useState([]);

  // Reactions count
  const [reactionCounts, setReactionCounts] = useState({ like: 0, love: 0, fire: 0, clap: 0, wow: 0 });

  // Media state
  const [localStream, setLocalStream] = useState(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // UI state
  const [showChat, setShowChat] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);

  // PeerJS for live streaming
  const [peerInstance, setPeerInstance] = useState(null);
  const [activeCalls, setActiveCalls] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState([]);

  const commentsEndRef = useRef(null);
  const videoRef = useRef(null);

  // Fetch user on mount
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        fetchLive(session.user.id);
      } else {
        navigate('/login');
      }
    };
    fetchUser();
  }, [navigate, liveId]);

  const fetchLive = async (userId) => {
    setIsLoading(true);
    try {
      const { data: liveData } = await supabase
        .from('lives').select('*').eq('id', liveId).single();

      if (!liveData) { navigate('/live'); return; }

      const { data: hostProfile } = await supabase
        .from('profiles').select('full_name, avatar_url').eq('id', liveData.host_id).single();

      setLive({ ...liveData, profiles: hostProfile });
      setIsHost(liveData.host_id === userId);

      // Check guest status
      const { data: guestData } = await supabase
        .from('live_guests').select('*').eq('live_id', liveId).eq('user_id', userId).single();
      setIsGuest(!!guestData && guestData.status === 'accepted');

      // Fetch all guests
      const { data: guestsData } = await supabase.from('live_guests').select('*').eq('live_id', liveId);
      if (guestsData?.length > 0) {
        const guestIds = guestsData.map(g => g.user_id);
        const { data: guestProfiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', guestIds);
        const profilesMap = {};
        guestProfiles?.forEach(p => { profilesMap[p.id] = p; });
        setGuests(guestsData.map(g => ({ ...g, profiles: profilesMap[g.user_id] })));
      }

      // Register as viewer
      if (liveData.host_id !== userId) {
        await supabase.from('live_viewers').upsert({
          live_id: liveId, user_id: userId, joined_at: new Date().toISOString()
        }, { onConflict: 'live_id, user_id' });
      }

      fetchComments();
      fetchViewers();
      fetchReactionCounts();

      // Init media for host/guest
      if (liveData.host_id === userId || (guestData?.status === 'accepted')) {
        initializeMedia();
      }
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComments = async () => {
    const { data } = await supabase.from('live_comments').select('*')
      .eq('live_id', liveId).order('created_at', { ascending: true }).limit(100);
    if (data?.length > 0) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      const map = {}; profiles?.forEach(p => { map[p.id] = p; });
      setComments(data.map(c => ({ ...c, profiles: map[c.user_id] })));
    } else {
      setComments([]);
    }
  };

  const fetchViewers = async () => {
    // Récupérer les viewers sans JOIN problématique
    const { data, count } = await supabase.from('live_viewers')
      .select('*', { count: 'exact' })
      .eq('live_id', liveId).is('left_at', null);

    if (data?.length > 0) {
      const userIds = data.map(v => v.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      const map = {}; profiles?.forEach(p => { map[p.id] = p; });
      setViewers(data.map(v => ({ ...v, profiles: map[v.user_id] })));
    } else {
      setViewers([]);
    }
    setViewerCount(count || 0);
  };

  const fetchReactionCounts = async () => {
    const { data } = await supabase.from('live_reactions')
      .select('reaction_type')
      .eq('live_id', liveId);

    if (data) {
      const counts = { like: 0, love: 0, fire: 0, clap: 0, wow: 0 };
      data.forEach(r => { if (counts[r.reaction_type] !== undefined) counts[r.reaction_type]++; });
      setReactionCounts(counts);
    }
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      cameraStreamRef.current = stream;
      setLocalStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      console.error('Media error:', e);
    }
  };

  // Initialize PeerJS for host
  useEffect(() => {
    if ((isHost || isGuest) && currentUser && localStream) {
      const peer = initializePeer(currentUser.id);
      setPeerInstance(peer);

      peer.on('call', (call) => {
        // L'hôte répond avec son stream local
        call.answer(localStream);
        console.log(`${isHost ? 'Hôte' : 'Invité'} répond à l'appel d'un spectateur`);
      });

      peer.on('error', (err) => {
        console.error('PeerJS error:', err);
      });

      return () => {
        destroyPeer();
        setPeerInstance(null);
      };
    }
  }, [isHost, isGuest, currentUser, localStream]);

  // For viewers: call the host to receive stream
  useEffect(() => {
    if (!isHost && !isGuest && peerInstance && live?.host_id) {
      console.log(`Spectateur appelle l'hôte ${live.host_id}`);
      const call = peerInstance.call(live.host_id, null); // Spectateur n'envoie pas de stream

      call.on('stream', (remoteStream) => {
        console.log('Spectateur reçoit le stream de l\'hôte');
        // Afficher le stream de l'hôte
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.play().catch(e => console.error('Erreur lecture vidéo:', e));
        }
        setRemoteStreams([remoteStream]);
      });

      call.on('error', (err) => {
        console.error('Erreur lors de l\'appel:', err);
      });

      setActiveCalls([call]);
    }
  }, [isHost, peerInstance, live, isGuest]);

  // Initialize PeerJS for viewers
  useEffect(() => {
    if (!isHost && !isGuest && currentUser && !peerInstance) {
      const peer = initializePeer(currentUser.id);
      setPeerInstance(peer);

      peer.on('error', (err) => {
        console.error('PeerJS error (viewer):', err);
      });

      return () => {
        destroyPeer();
        setPeerInstance(null);
      };
    }
  }, [isHost, isGuest, currentUser, peerInstance]);

  // Realtime subscriptions
  useEffect(() => {
    if (!liveId) return;
    const commentsSub = supabase.channel(`live-comments-${liveId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_comments', filter: `live_id=eq.${liveId}` },
        async (payload) => {
          // Ne pas ajouter si c'est notre propre commentaire (déjà ajouté en optimistic)
          if (payload.new.user_id === currentUser?.id) {
            // Remplacer le commentaire temporaire par le vrai
            setComments(prev => prev.map(c =>
              c.id.toString().startsWith('temp-') && c.user_id === payload.new.user_id && c.content === payload.new.content
                ? { ...payload.new, profiles: c.profiles }
                : c
            ));
            return;
          }
          // Commentaire d'un autre utilisateur
          const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', payload.new.user_id).single();
          setComments(prev => [...prev, { ...payload.new, profiles: profile }]);
        }).subscribe();

    const viewersSub = supabase.channel(`live-viewers-${liveId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_viewers', filter: `live_id=eq.${liveId}` },
        () => fetchViewers()).subscribe();

    const reactionsSub = supabase.channel(`live-reactions-${liveId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_reactions', filter: `live_id=eq.${liveId}` },
        (payload) => {
          showFloatingReaction(payload.new.reaction_type);
          // Mettre à jour le compteur
          setReactionCounts(prev => ({
            ...prev,
            [payload.new.reaction_type]: (prev[payload.new.reaction_type] || 0) + 1
          }));
        }).subscribe();

    return () => {
      supabase.removeChannel(commentsSub);
      supabase.removeChannel(viewersSub);
      supabase.removeChannel(reactionsSub);
    };
  }, [liveId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // Floating reactions animation
  const showFloatingReaction = (type) => {
    const id = Date.now();
    const icons = { like: '👍', love: '❤️', fire: '🔥', clap: '👏', wow: '✨' };
    setFloatingReactions(prev => [...prev, { id, icon: icons[type] || '❤️' }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 2000);
  };

  // Actions
  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;

    const content = newComment.trim();
    setNewComment('');

    // Ajouter immédiatement le commentaire localement (optimistic update)
    const tempComment = {
      id: `temp-${Date.now()}`,
      live_id: liveId,
      user_id: currentUser.id,
      content,
      created_at: new Date().toISOString(),
      profiles: { full_name: getDisplayName(currentUser) }
    };
    setComments(prev => [...prev, tempComment]);

    // Envoyer à la base de données
    const { error } = await supabase.from('live_comments').insert({
      live_id: liveId,
      user_id: currentUser.id,
      content
    });

    if (error) {
      // Retirer le commentaire temporaire en cas d'erreur
      setComments(prev => prev.filter(c => c.id !== tempComment.id));
      console.error('Error sending comment:', error);
    }
  };

  const sendReaction = async (type) => {
    await supabase.from('live_reactions').insert({ live_id: liveId, user_id: currentUser.id, reaction_type: type });
    showFloatingReaction(type);
  };

  const startLive = async () => {
    await supabase.from('lives').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', liveId);
    setLive(prev => ({ ...prev, status: 'live' }));
  };

  const endLive = async () => {
    if (!window.confirm('Terminer le live ?')) return;
    if (isRecording) stopRecording();
    await supabase.from('lives').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', liveId);
    localStream?.getTracks().forEach(t => t.stop());
    navigate('/live');
  };

  const leaveLive = async () => {
    localStream?.getTracks().forEach(t => t.stop());
    await supabase.from('live_viewers').update({ left_at: new Date().toISOString() }).match({ live_id: liveId, user_id: currentUser.id });
    navigate('/live');
  };

  const toggleMic = () => {
    const track = localStream?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMicMuted(!track.enabled); }
  };

  const toggleCam = () => {
    const track = localStream?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsCamOff(!track.enabled); }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      setIsScreenSharing(false);
      if (cameraStreamRef.current) {
        setLocalStream(cameraStreamRef.current);
        if (videoRef.current) videoRef.current.srcObject = cameraStreamRef.current;
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = stream;
        setIsScreenSharing(true);
        setLocalStream(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
        stream.getVideoTracks()[0].onended = () => toggleScreenShare();
      } catch (e) { /* user cancelled */ }
    }
  };

  const startRecording = () => {
    if (!localStream) return;
    recordedChunksRef.current = [];
    try {
      mediaRecorderRef.current = new MediaRecorder(localStream, { mimeType: 'video/webm;codecs=vp9,opus' });
    } catch {
      mediaRecorderRef.current = new MediaRecorder(localStream);
    }
    mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `live-${liveId}.webm`; a.click();
    };
    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const banViewer = async (viewerId) => {
    if (!window.confirm('Bannir ce spectateur ?')) return;
    await supabase.from('live_viewers').delete().match({ live_id: liveId, user_id: viewerId });
    fetchViewers();
  };

  const reportItem = async (type, targetId, reason) => {
    await supabase.from('reports').insert({ reporter_id: currentUser.id, report_type: type, target_id: targetId, room_id: liveId, reason });
    alert('Signalement envoyé');
    setShowReportModal(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-950 items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!live) return null;

  const canStream = isHost || isGuest;
  const isLive = live.status === 'live';

  return (
    <div className="h-screen bg-gray-950 flex flex-col lg:flex-row overflow-hidden">
      {/* Main Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <header className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-gray-900/50 backdrop-blur-sm border-b border-white/5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button onClick={leaveLive} className="p-1.5 sm:p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X size={18} className="text-white/70" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base text-white font-semibold truncate">{live.title}</h1>
              <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-white/50">
                <span className="truncate hidden sm:inline">{live.profiles?.full_name || 'Hôte'}</span>
                <span className="flex items-center gap-1">
                  <Eye size={14} /> {viewerCount}
                </span>
                {isLive && (
                  <span className="flex items-center gap-1 text-red-500">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {isHost && (
              <button onClick={() => setShowViewersModal(true)} className="p-2 hover:bg-white/10 rounded-xl text-white/70">
                <UserPlus size={18} />
              </button>
            )}
            <button onClick={() => { setReportTarget({ type: 'live', id: liveId }); setShowReportModal(true); }}
              className="p-2 hover:bg-white/10 rounded-xl text-white/70 hover:text-red-400">
              <Flag size={18} />
            </button>
            <button onClick={() => setShowChat(!showChat)} className="p-2 hover:bg-white/10 rounded-xl text-white/70 lg:hidden">
              <MessageCircle size={18} />
            </button>
          </div>
        </header>

        {/* Video Area */}
        <div className="flex-1 relative bg-black min-h-0">
          {canStream && localStream ? (
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Radio size={56} className={`mx-auto mb-4 ${isLive ? 'text-red-500 animate-pulse' : 'text-white/20'}`} />
                <p className="text-white/70 text-lg font-medium">
                  {live.status === 'scheduled' ? 'En attente du démarrage' : isLive ? 'En direct' : 'Live terminé'}
                </p>
              </div>
            </div>
          )}

          {/* Floating Reactions */}
          <div className="absolute bottom-20 right-4 pointer-events-none">
            {floatingReactions.map(r => (
              <div key={r.id} className="animate-float-up text-3xl">{r.icon}</div>
            ))}
          </div>

          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full">
              <Circle size={10} className="fill-white text-white animate-pulse" />
              <span className="text-white text-sm font-medium">REC</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-4 py-4 bg-gray-900/50 backdrop-blur-sm border-t border-white/5">
          {/* Host/Guest Controls */}
          {canStream && (
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3">
              <button onClick={toggleMic} className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-colors ${isMicMuted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
                {isMicMuted ? <MicOff size={18} className="text-white" /> : <Mic size={18} className="text-white" />}
              </button>
              <button onClick={toggleCam} className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-colors ${isCamOff ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
                {isCamOff ? <VideoOff size={18} className="text-white" /> : <Video size={18} className="text-white" />}
              </button>

              {isHost && (
                <>
                  <button onClick={toggleScreenShare} className={`hidden sm:flex w-11 h-11 rounded-full items-center justify-center transition-colors ${isScreenSharing ? 'bg-blue-500' : 'bg-white/10 hover:bg-white/20'}`}>
                    {isScreenSharing ? <MonitorOff size={20} className="text-white" /> : <Monitor size={20} className="text-white" />}
                  </button>
                  <button onClick={isRecording ? stopRecording : startRecording} className={`hidden sm:flex w-11 h-11 rounded-full items-center justify-center transition-colors ${isRecording ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
                    <Circle size={20} className={`text-white ${isRecording ? 'fill-white' : ''}`} />
                  </button>

                  {live.status === 'scheduled' && (
                    <button onClick={startLive} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium transition-colors">
                      Démarrer
                    </button>
                  )}
                  {isLive && (
                    <button onClick={endLive} className="w-10 h-10 sm:w-11 sm:h-11 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors">
                      <PhoneOff size={18} className="text-white" />
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Reactions - Everyone */}
          {isLive && (
            <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
              {[
                { type: 'like', icon: ThumbsUp, color: 'hover:bg-blue-500/20 hover:text-blue-400', activeColor: 'text-blue-400' },
                { type: 'love', icon: Heart, color: 'hover:bg-red-500/20 hover:text-red-400', activeColor: 'text-red-400' },
                { type: 'fire', icon: Flame, color: 'hover:bg-orange-500/20 hover:text-orange-400', activeColor: 'text-orange-400' },
                { type: 'clap', icon: Star, color: 'hover:bg-yellow-500/20 hover:text-yellow-400', activeColor: 'text-yellow-400' },
                { type: 'wow', icon: Sparkles, color: 'hover:bg-purple-500/20 hover:text-purple-400', activeColor: 'text-purple-400' },
              ].map(r => (
                <button key={r.type} onClick={() => sendReaction(r.type)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 text-white/60 transition-colors ${r.color}`}>
                  <r.icon size={18} />
                  {reactionCounts[r.type] > 0 && (
                    <span className={`text-xs font-medium ${r.activeColor}`}>
                      {reactionCounts[r.type] > 999 ? `${(reactionCounts[r.type] / 1000).toFixed(1)}k` : reactionCounts[r.type]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Sidebar */}
      <aside className={`${showChat ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-80 bg-gray-900 border-l border-white/5 absolute lg:relative inset-0 lg:inset-auto z-10`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div>
            <h2 className="text-white font-medium">Chat</h2>
            <p className="text-white/40 text-xs">{comments.length} messages</p>
          </div>
          <button onClick={() => setShowChat(false)} className="lg:hidden p-2 hover:bg-white/10 rounded-lg">
            <X size={18} className="text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {comments.length === 0 ? (
            <p className="text-center text-white/30 text-sm py-8">Aucun message</p>
          ) : comments.map(c => (
            <div key={c.id} className="group flex gap-2">
              <Avatar
                user={{
                  avatar_url: c.profiles?.avatar_url,
                  user_metadata: { full_name: c.profiles?.full_name },
                  email: c.profiles?.email
                }}
                size="xs"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-xs font-medium truncate">{c.profiles?.full_name || 'Utilisateur'}</span>
                  <button onClick={() => { setReportTarget({ type: 'comment', id: c.id }); setShowReportModal(true); }}
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400">
                    <Flag size={10} />
                  </button>
                </div>
                <p className="text-white text-sm break-words">{c.content}</p>
              </div>
            </div>
          ))}
          <div ref={commentsEndRef} />
        </div>

        <form onSubmit={handleSendComment} className="p-3 border-t border-white/5">
          <div className="flex gap-2">
            <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
              placeholder="Message..." className="flex-1 px-3 py-2 bg-white/5 text-white text-sm rounded-full placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-red-500" />
            <button type="submit" disabled={!newComment.trim()} className="p-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-full transition-colors">
              <Send size={16} className="text-white" />
            </button>
          </div>
        </form>
      </aside>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-white/10">
            <h3 className="text-white font-semibold mb-4">Signaler</h3>
            <div className="space-y-2">
              {['Contenu inapproprié', 'Spam', 'Harcèlement', 'Autre'].map(reason => (
                <button key={reason} onClick={() => reportItem(reportTarget.type, reportTarget.id, reason)}
                  className="w-full p-3 text-left text-white/80 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                  {reason}
                </button>
              ))}
            </div>
            <button onClick={() => setShowReportModal(false)} className="mt-3 w-full p-3 text-white/50 hover:text-white transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Viewers Modal (Host only) */}
      {showViewersModal && isHost && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-white/10 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Spectateurs ({viewerCount})</h3>
              <button onClick={() => setShowViewersModal(false)} className="p-1 hover:bg-white/10 rounded-lg">
                <X size={18} className="text-white/70" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {viewers.map(v => (
                <div key={v.id} className="flex items-center justify-between p-2 bg-white/5 rounded-xl">
                  <span className="text-white/80 text-sm truncate">{v.profiles?.full_name || 'Utilisateur'}</span>
                  <button onClick={() => banViewer(v.user_id)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg" title="Bannir">
                    <UserX size={16} />
                  </button>
                </div>
              ))}
              {viewers.length === 0 && <p className="text-white/30 text-sm text-center py-4">Aucun spectateur</p>}
            </div>
          </div>
        </div>
      )}

      {/* CSS for floating reactions */}
      <style>{`
        @keyframes float-up {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-100px) scale(1.5); }
        }
        .animate-float-up {
          animation: float-up 2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default LiveRoomPage;


