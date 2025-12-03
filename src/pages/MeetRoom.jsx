import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { initializePeer, getPeer, callPeer, destroyPeer } from '../services/peerClient';
import { getDisplayName } from '../services/userUtils';
import Avatar from '../components/Avatar';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff,
  MessageCircle, Users, ListTodo, Copy, Check, ChevronLeft, ChevronRight,
  Circle, UserPlus, Download, PenTool, Flag, X
} from 'lucide-react';

import VideoPlayer from '../components/VideoPlayer';
import ChatBox from '../components/ChatBox';
import SharedTodoList from '../components/SharedTodoList';
import Whiteboard from '../components/Whiteboard';

const MeetRoomPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [peerInstance, setPeerInstance] = useState(null);
  const [peerError, setPeerError] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const cameraStreamRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [showSidebar, setShowSidebar] = useState(true);
  const [copiedId, setCopiedId] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState({});
  const [roomParticipantsData, setRoomParticipantsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoiningRoom, setIsJoiningRoom] = useState(true);
  const [mainDisplayedStreamInfo, setMainDisplayedStreamInfo] = useState({
    stream: null, id: null, email: null, isLocal: true, fullName: 'Vous'
  });
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [downloadLink, setDownloadLink] = useState('');
  const [recordingFormat, setRecordingFormat] = useState('webm');
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Whiteboard state
  const [isWhiteboardActive, setIsWhiteboardActive] = useState(false);
  const [whiteboardInitiator, setWhiteboardInitiator] = useState(null);

  // Room info
  const [roomName, setRoomName] = useState('');
  const [roomCreatorId, setRoomCreatorId] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [speakingPeers, setSpeakingPeers] = useState({ local: false });

  // Fetch room info
  useEffect(() => {
    const fetchRoomInfo = async () => {
      if (!roomId) return;
      const { data } = await supabase.from('meetings').select('name, user_id').eq('room_id', roomId).single();
      if (data) {
        setRoomName(data.name || '');
        setRoomCreatorId(data.user_id);
      }
    };
    fetchRoomInfo();
  }, [roomId]);

  // Auth Effect
  useEffect(() => {
    const fetchUserSession = async () => {
      setIsLoadingUser(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) { setCurrentUser(session.user); return; }
        const { data: { user } } = await supabase.auth.getUser();
        if (user) { setCurrentUser(user); }
        else { navigate('/login', { replace: true }); }
      } catch (e) { console.error('MeetRoom: Exception:', e); }
      finally { setIsLoadingUser(false); }
    };
    fetchUserSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const userFromSession = session?.user ?? null;
      setCurrentUser(userFromSession);
      setIsLoadingUser(false);
      if (!userFromSession && (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT')) {
        if (getPeer()) { destroyPeer(); setPeerInstance(null); setLocalStream(null); }
        navigate('/login', { replace: true });
      }
    });
    return () => authListener?.subscription?.unsubscribe();
  }, [navigate]);

  // Initialize Speech Recognition for auto-transcription
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'fr-FR';

      recognitionRef.current.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcriptRef.current += event.results[i][0].transcript + ' ';
          }
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Erreur de reconnaissance vocale:', event.error);
        if (event.error === 'not-allowed') {
          console.warn('Microphone non autorisé pour la transcription');
        } else if (event.error === 'no-speech') {
          // Ignore - pas de parole détectée
        } else {
          setIsTranscribing(false);
        }
      };

      recognitionRef.current.onend = () => {
        if (isTranscribing && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.log('Impossible de redémarrer la transcription:', e);
            setIsTranscribing(false);
          }
        }
      };
    } else {
      console.warn('Reconnaissance vocale non supportée par ce navigateur');
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors on cleanup
        }
      }
    };
  }, [isTranscribing]);

  // Start transcription when joining room
  useEffect(() => {
    if (localStream && currentUser && roomId && recognitionRef.current && !isTranscribing) {
      // Check if browser supports speech recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        try {
          recognitionRef.current.start();
          setIsTranscribing(true);
          console.log('Transcription automatique démarrée');
        } catch (e) {
          console.log('Impossible de démarrer la transcription:', e.message);
          setIsTranscribing(false);
        }
      } else {
        console.warn('Reconnaissance vocale non disponible');
      }
    }
  }, [localStream, currentUser, roomId, isTranscribing]);

  // Save transcript when leaving
  const saveTranscript = async () => {
    if (!transcriptRef.current.trim() || !currentUser || !roomId) {
      console.log('Aucune transcription à sauvegarder');
      return;
    }
    try {
      const transcriptText = transcriptRef.current.trim();
      console.log('Sauvegarde de la transcription:', transcriptText.substring(0, 50) + '...');
      const { data, error } = await supabase.from('meeting_transcripts').insert({
        room_id: roomId,
        user_id: currentUser.id,
        transcript: transcriptText,
        duration_seconds: elapsedTime,
        created_at: new Date().toISOString()
      });
      if (error) throw error;
      console.log('Transcription sauvegardée avec succès');
    } catch (e) {
      console.error('Erreur lors de la sauvegarde de la transcription:', e);
    }
  };

  // PeerJS & Media Init
  useEffect(() => {
    if (!currentUser?.id) { if (peerInstance) { destroyPeer(); setPeerInstance(null); } return; }
    setPeerError(null); setIsJoiningRoom(true); setIsLoading(true);
    const peerIdToInitialize = currentUser.id;
    let currentPeer = null;

    try { currentPeer = initializePeer(peerIdToInitialize); }
    catch (initError) { setPeerError({ message: "Exception PeerJS: " + initError.message }); setIsJoiningRoom(false); setIsLoading(false); return; }
    if (!currentPeer) { setPeerError({ message: "PeerJS non initialisé." }); setIsJoiningRoom(false); setIsLoading(false); return; }
    setPeerInstance(currentPeer);

    const onOpenHandler = async () => {
      setPeerError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        cameraStreamRef.current = stream;
        setLocalStream(stream);
        // Utiliser getDisplayName qui prend user_metadata.full_name en priorité
        const userFullName = getDisplayName(currentUser);

        // Charger l'avatar
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', currentUser.id)
          .single();

        const userAvatarUrl = profile?.avatar_url || null;
        setAvatarUrl(userAvatarUrl);

        setMainDisplayedStreamInfo({
          stream,
          id: peerIdToInitialize,
          email: currentUser.email,
          isLocal: true,
          fullName: userFullName,
          avatarUrl: userAvatarUrl
        });
      } catch (err) {
        setPeerError({ message: "Caméra/micro inaccessible: " + err.message });
        setIsJoiningRoom(false); setIsLoading(false); destroyPeer(); setPeerInstance(null);
      }
    };
    const onErrorHandler = (err) => { setPeerError({ message: `Erreur PeerJS: ${err.message}` }); setIsJoiningRoom(false); setIsLoading(false); };
    const onCloseHandler = () => { setPeerError({ message: "Connexion PeerJS fermée." }); setPeerInstance(null); setIsJoiningRoom(false); setIsLoading(false); };

    currentPeer.on('open', onOpenHandler);
    currentPeer.on('error', onErrorHandler);
    currentPeer.on('close', onCloseHandler);
    if (currentPeer.open) onOpenHandler();

    return () => { if (currentPeer) { currentPeer.off('open', onOpenHandler); currentPeer.off('error', onErrorHandler); currentPeer.off('close', onCloseHandler); } };
  }, [currentUser?.id, navigate]);

  // Timer
  useEffect(() => {
    if (localStream && currentUser && roomId && !startTime) setStartTime(Date.now());
    if ((!currentUser || !roomId) && startTime) { setStartTime(null); setElapsedTime(0); }
  }, [localStream, currentUser, roomId, startTime]);

  useEffect(() => {
    if (!startTime) return;
    const intervalId = setInterval(() => setElapsedTime(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(intervalId);
  }, [startTime]);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Peer calls
  const initiateCallToPeer = (remotePeerId, remoteEmail, remoteFullName) => {
    if (!localStream || !peerInstance || connectedPeers[remotePeerId]) return;
    const call = callPeer(remotePeerId, localStream);
    if (!call) return;
    call.on('stream', (remoteStream) => {
      setRemoteStreams(prev => prev.find(s => s.id === remotePeerId) ? prev : [...prev, { stream: remoteStream, id: remotePeerId, email: remoteEmail, fullName: remoteFullName }]);
      setConnectedPeers(prev => ({ ...prev, [remotePeerId]: call }));
    });
    call.on('close', () => {
      setRemoteStreams(prev => prev.filter(s => s.id !== remotePeerId));
      setConnectedPeers(prev => { const n = { ...prev }; delete n[remotePeerId]; return n; });
    });
  };

  useEffect(() => {
    if (!peerInstance || !localStream) return;
    const handleIncomingCall = (call) => {
      call.answer(localStream);
      call.on('stream', (remoteStream) => {
        const remotePeerId = call.peer;
        setRemoteStreams(prev => prev.find(s => s.id === remotePeerId) ? prev : [...prev, { stream: remoteStream, id: remotePeerId, email: '', fullName: 'Participant' }]);
        setConnectedPeers(prev => ({ ...prev, [remotePeerId]: call }));
      });
      call.on('close', () => {
        const remotePeerId = call.peer;
        setRemoteStreams(prev => prev.filter(s => s.id !== remotePeerId));
        setConnectedPeers(prev => { const n = { ...prev }; delete n[remotePeerId]; return n; });
      });
    };
    peerInstance.on('call', handleIncomingCall);
    return () => peerInstance.off('call', handleIncomingCall);
  }, [peerInstance, localStream]);

  // Presence management
  useEffect(() => {
    if (!currentUser || !roomId || !peerInstance?.id || !localStream) return;
    setIsJoiningRoom(true);
    let isMounted = true;

    const managePresence = async () => {
      if (!isMounted) return;
      try {
        await supabase.from('room_participants').delete().match({ peer_id: peerInstance.id });
        // Utiliser getDisplayName qui prend user_metadata.full_name en priorité
        const fullName = getDisplayName(currentUser);

        // Log participant entry
        await supabase.from('meeting_participants_log').insert({
          room_id: roomId, user_id: currentUser.id, user_email: currentUser.email, user_full_name: fullName, joined_at: new Date().toISOString()
        });

        await supabase.from('room_participants').upsert({
          room_id: roomId, user_id: currentUser.id, peer_id: peerInstance.id, user_email: currentUser.email,
          status: 'online', last_seen: new Date().toISOString(), user_full_name: fullName,
        }, { onConflict: 'room_id, user_id' });

        if (!isMounted) return;
        const { data: initialParticipants } = await supabase.from('room_participants')
          .select('*').eq('room_id', roomId).eq('status', 'online').neq('peer_id', peerInstance.id);
        if (initialParticipants) {
          setRoomParticipantsData(initialParticipants);
          initialParticipants.forEach(p => initiateCallToPeer(p.peer_id, p.user_email, p.user_full_name));
        }
      } catch (e) { console.error('Presence error:', e); }
      finally { if (isMounted) { setIsJoiningRoom(false); setIsLoading(false); } }
    };
    managePresence();
    return () => { isMounted = false; };
  }, [currentUser, roomId, peerInstance?.id, localStream]);

  // Realtime participants
  useEffect(() => {
    if (!roomId || !currentUser?.id || !peerInstance?.id || !localStream) return;
    const sub = supabase.channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, (payload) => {
        const { eventType, new: n, old: o } = payload;
        const peerId = n?.peer_id || o?.peer_id;
        if (peerId === peerInstance.id) return;
        if (eventType === 'INSERT' && n?.status === 'online') {
          setRoomParticipantsData(prev => prev.find(p => p.peer_id === peerId) ? prev : [...prev, n]);
          initiateCallToPeer(peerId, n.user_email, n.user_full_name);
        } else if (eventType === 'UPDATE' && n?.status === 'offline') {
          setRoomParticipantsData(prev => prev.filter(p => p.peer_id !== peerId));
          setRemoteStreams(prev => prev.filter(s => s.id !== peerId));
        } else if (eventType === 'DELETE') {
          setRoomParticipantsData(prev => prev.filter(p => p.peer_id !== peerId));
          setRemoteStreams(prev => prev.filter(s => s.id !== peerId));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [roomId, currentUser?.id, peerInstance?.id, localStream]);

  // Whiteboard realtime sync
  useEffect(() => {
    if (!roomId) return;
    const sub = supabase.channel(`whiteboard-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_whiteboard', filter: `room_id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setIsWhiteboardActive(payload.new.is_active);
          setWhiteboardInitiator(payload.new.initiator_id);
        } else if (payload.eventType === 'DELETE') {
          setIsWhiteboardActive(false);
          setWhiteboardInitiator(null);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [roomId]);



  // Leave room
  const performLeaveActions = async () => {
    if (isRecording) stopRecording();
    if (recognitionRef.current) { recognitionRef.current.stop(); setIsTranscribing(false); }
    await saveTranscript();

    // Log participant exit
    if (currentUser?.id && roomId) {
      await supabase.from('meeting_participants_log').update({ left_at: new Date().toISOString() })
        .match({ room_id: roomId, user_id: currentUser.id }).is('left_at', null);
      await supabase.from('room_participants').update({ status: 'offline', last_seen: new Date().toISOString() })
        .match({ room_id: roomId, user_id: currentUser.id });
    }
    if (cameraStreamRef.current) { cameraStreamRef.current.getTracks().forEach(t => t.stop()); cameraStreamRef.current = null; }
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
    setLocalStream(null); destroyPeer(); setPeerInstance(null); setRemoteStreams([]); setConnectedPeers({});
  };

  const handleLeaveRoom = async () => { await performLeaveActions(); navigate('/dashboard'); };

  // Select main stream for display
  // Select main stream for display
  const selectMainStream = (streamInfo) => {
    if (mainDisplayedStreamInfo.id === streamInfo.id && mainDisplayedStreamInfo.isLocal === streamInfo.isLocal) return;
    setMainDisplayedStreamInfo({
      id: streamInfo.id,
      stream: streamInfo.stream,
      isLocal: streamInfo.isLocal,
      fullName: streamInfo.fullName,
      email: streamInfo.email,
      avatarUrl: streamInfo.avatarUrl
    });
  };

  // Media controls
  const toggleMic = () => {
    if (localStream) {
      const track = localStream.getAudioTracks()[0];
      if (track) { track.enabled = !track.enabled; setIsMicMuted(!track.enabled); }
    }
  };

  const toggleCam = () => {
    if (localStream) {
      const track = localStream.getVideoTracks()[0];
      if (track) { track.enabled = !track.enabled; setIsCamOff(!track.enabled); }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
      setIsScreenSharing(false);
      if (cameraStreamRef.current) {
        setLocalStream(cameraStreamRef.current);
        setMainDisplayedStreamInfo(prev => ({ ...prev, stream: cameraStreamRef.current, fullName: prev.fullName.replace(' (Écran)', '') }));

        // Remplacer les tracks vidéo dans toutes les connexions
        Object.values(connectedPeers).forEach(call => {
          const videoTrack = cameraStreamRef.current.getVideoTracks()[0];
          const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender && videoTrack) sender.replaceTrack(videoTrack);
        });
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: true });
        screenStreamRef.current = stream;
        setIsScreenSharing(true);
        setLocalStream(stream);
        setMainDisplayedStreamInfo(prev => ({ ...prev, stream, fullName: prev.fullName + ' (Écran)' }));

        // Remplacer les tracks vidéo dans toutes les connexions
        Object.values(connectedPeers).forEach(call => {
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];
          const senders = call.peerConnection.getSenders();

          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender && videoTrack) videoSender.replaceTrack(videoTrack);

          const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
          if (audioSender && audioTrack) audioSender.replaceTrack(audioTrack);
        });

        stream.getVideoTracks()[0].onended = () => {
          toggleScreenShare(); // Toggle back to camera
        };
      } catch (e) { if (e.name !== 'NotAllowedError') alert("Impossible de partager l'écran."); }
    }
  };

  // Whiteboard toggle
  const toggleWhiteboard = async () => {
    if (isWhiteboardActive) {
      await supabase.from('room_whiteboard').delete().match({ room_id: roomId });
      setIsWhiteboardActive(false);
      setWhiteboardInitiator(null);
    } else {
      await supabase.from('room_whiteboard').upsert({
        room_id: roomId, is_active: true, initiator_id: currentUser.id, updated_at: new Date().toISOString()
      }, { onConflict: 'room_id' });
      setIsWhiteboardActive(true);
      setWhiteboardInitiator(currentUser.id);
    }
  };

  // Recording
  // Recording
  const startRecording = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true
      });

      const audioContext = new AudioContext();
      const dest = audioContext.createMediaStreamDestination();

      if (displayStream.getAudioTracks().length > 0) {
        const sysSource = audioContext.createMediaStreamSource(displayStream);
        sysSource.connect(dest);
      }

      if (localStream && localStream.getAudioTracks().length > 0) {
        const micSource = audioContext.createMediaStreamSource(localStream);
        micSource.connect(dest);
      }

      const mixedTracks = [
        displayStream.getVideoTracks()[0],
        ...dest.stream.getAudioTracks()
      ];
      const combinedStream = new MediaStream(mixedTracks);

      recordedChunksRef.current = [];

      // Try MP4 first, then WebM
      const mimeTypes = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm'
      ];

      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      if (!selectedMimeType) {
        alert('Aucun format d\'enregistrement supporté par ce navigateur.');
        return;
      }

      const ext = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
      setRecordingFormat(ext);

      const recorder = new MediaRecorder(combinedStream, { mimeType: selectedMimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
        const url = URL.createObjectURL(blob);
        setDownloadLink(url);
        combinedStream.getTracks().forEach(track => track.stop());
        displayStream.getTracks().forEach(track => track.stop());
        audioContext.close();
      };

      // Stop recording if user stops screen sharing via browser UI
      displayStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Erreur enregistrement:", err);
      if (err.name !== 'NotAllowedError') {
        alert("Impossible de démarrer l'enregistrement de l'écran.");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const copyRoomId = () => { navigator.clipboard.writeText(roomId); setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); };

  const handleReportRoom = async (reason) => {
    if (!currentUser || !roomId) return;
    try {
      await supabase.from('reports').insert({
        reporter_id: currentUser.id,
        report_type: 'room',
        target_id: roomId,
        room_id: roomId,
        reason
      });
      setShowReportModal(false);
      alert('Salle signalée');
    } catch (e) {
      alert('Erreur: ' + e.message);
    }
  };

  // Loading/Error states
  if (isLoadingUser || isLoading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-gray-100 to-gray-200 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Connexion à la réunion...</p>
        </div>
      </div>
    );
  }

  if (peerError) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-gray-100 to-gray-200 items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <PhoneOff size={32} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Erreur de connexion</h2>
          <p className="text-gray-600 mb-6">{peerError.message}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Combine local and remote streams for display
  // Combine local and remote streams for display
  const localStreamObj = {
    id: currentUser?.id || 'local',
    stream: localStream,
    isLocal: true,
    fullName: 'Vous',
    email: currentUser?.email,
    avatarUrl: avatarUrl,
    isCamOff: isCamOff,
    isSpeaking: speakingPeers.local
  };

  const remoteStreamsObjs = remoteStreams.map(rs => ({
    id: rs.id,
    stream: rs.stream,
    isLocal: false,
    fullName: rs.fullName || 'Participant',
    email: rs.email || '',
    avatarUrl: null,
    isCamOff: !rs.stream?.getVideoTracks()[0]?.enabled,
    isSpeaking: false
  }));

  // All available streams (Local + Remote)
  const allStreams = [localStreamObj, ...remoteStreamsObjs].filter(s => s.stream);

  // Determine which stream to display as main
  // If mainDisplayedStreamInfo.id matches one in allStreams, use it. Otherwise default to local.
  const activeMainStream = allStreams.find(s => s.id === mainDisplayedStreamInfo.id) || localStreamObj;

  // Thumbnails are everyone ELSE
  const thumbnailStreams = allStreams.filter(s => s.id !== activeMainStream.id);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-100 to-gray-200">
      <div className="flex-1 p-2 sm:p-5">
        <div className="h-full bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-3 sm:px-6 pt-3 sm:pt-5 pb-3 sm:pb-4 flex justify-between items-center border-b border-gray-100">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img src="/logo-minimeet.png" alt="MiniMeet" className="h-6 sm:h-8" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 mb-1 hidden sm:block">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">{roomName || 'Réunion'}</h1>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-3">
              {isTranscribing && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-700">Transcription</span>
                </div>
              )}
              <button onClick={copyRoomId} className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl">
                {copiedId ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-gray-500" />}
                <span className="text-sm font-mono text-gray-600">{roomId}</span>
              </button>
              <button onClick={copyRoomId} className="sm:hidden p-2 hover:bg-gray-100 rounded-xl">
                {copiedId ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-gray-500" />}
              </button>
              <button onClick={() => setShowReportModal(true)} className="hidden sm:block p-2 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-red-500" title="Signaler cette salle">
                <Flag size={18} />
              </button>
              <button onClick={() => setShowSidebar(!showSidebar)} className="p-2 hover:bg-gray-100 rounded-xl">
                {showSidebar ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              </button>
            </div>
          </div>

          {/* Video/Whiteboard Area */}
          <div className="flex-1 px-2 sm:px-6 pb-2 sm:pb-4 overflow-hidden flex flex-col">
            {thumbnailStreams.length > 0 && !isWhiteboardActive && (
              <div className="flex gap-2 sm:gap-3 mb-2 sm:mb-3 overflow-x-auto pb-2">
                {thumbnailStreams.map((s) => (
                  <div key={s.id} onClick={() => selectMainStream(s)} className="relative flex-shrink-0 w-32 sm:w-48 h-24 sm:h-32 bg-gray-800 rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500">
                    <VideoPlayer
                      stream={s.stream}
                      isLocal={s.isLocal}
                      muted={s.isLocal}
                      isCamOff={s.isCamOff}
                      user={{
                        avatar_url: s.avatarUrl,
                        user_metadata: { full_name: s.fullName },
                        email: s.email
                      }}
                      isSpeaking={s.isSpeaking}
                    />
                    <div className="absolute bottom-2 left-2 flex items-center space-x-2">
                      <span className="text-xs font-medium text-white drop-shadow-lg truncate max-w-[100px]">{s.isLocal ? 'Vous' : s.fullName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="relative flex-1 bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl overflow-hidden">
              {/* Whiteboard Overlay */}
              {isWhiteboardActive && (
                <div className="absolute inset-0 bg-white z-20">
                  <Whiteboard roomId={roomId} />
                  <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-medium flex items-center space-x-2">
                    <PenTool size={14} />
                    <span>Tableau blanc actif</span>
                  </div>
                </div>
              )}

              {/* Main Video Player (Always rendered to keep audio, but maybe covered) */}
              {activeMainStream.stream ? (
                <div className="absolute inset-0 z-10">
                  <VideoPlayer
                    stream={activeMainStream.stream}
                    isLocal={activeMainStream.isLocal}
                    muted={activeMainStream.isLocal}
                    isCamOff={activeMainStream.isCamOff}
                    user={{
                      avatar_url: activeMainStream.avatarUrl,
                      user_metadata: { full_name: activeMainStream.fullName },
                      email: activeMainStream.email
                    }}
                    isSpeaking={activeMainStream.isSpeaking}
                  />
                  <div className="absolute bottom-4 left-4 flex items-center space-x-2">
                    <div className="w-6 h-6 bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                    </div>
                    <span className="text-sm font-semibold text-white drop-shadow-lg">{activeMainStream.fullName}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <Video size={48} className="opacity-50" />
                </div>
              )}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-500 text-white px-3 py-1.5 rounded-full">
                  <Circle size={8} className="fill-current animate-pulse" />
                  <span className="text-sm font-medium">REC</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="px-2 sm:px-6 pb-3 sm:pb-5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-gray-600">
                <div className="w-5 h-5 border-2 border-gray-400 rounded-full flex items-center justify-center">
                  <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></div>
                </div>
                <span className="font-mono text-sm font-medium">{formatTime(elapsedTime)}</span>
              </div>

              <div className="flex items-center space-x-3 sm:space-x-6">
                <div className="flex flex-col items-center gap-1">
                  <button onClick={toggleMic} className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${isMicMuted ? 'bg-red-100 text-red-500 ring-2 ring-red-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                  <span className="text-[10px] sm:text-xs font-medium text-gray-600">Micro</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button onClick={toggleCam} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105 ${isCamOff ? 'bg-red-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                    {isCamOff ? <VideoOff size={24} /> : <Video size={24} />}
                  </button>
                  <span className="text-[10px] sm:text-xs font-medium text-gray-600">Caméra</span>
                </div>

                <div className="hidden sm:flex flex-col items-center gap-1">
                  <button onClick={toggleScreenShare} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
                  </button>
                  <span className="text-[10px] sm:text-xs font-medium text-gray-600">Partage</span>
                </div>

                <div className="hidden sm:flex flex-col items-center gap-1">
                  <button onClick={toggleWhiteboard} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isWhiteboardActive ? 'bg-purple-100 text-purple-600 ring-2 ring-purple-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} title="Tableau blanc">
                    <PenTool size={20} />
                  </button>
                  <span className="text-[10px] sm:text-xs font-medium text-gray-600">Tableau</span>
                </div>

                <div className="hidden sm:flex flex-col items-center gap-1">
                  <button onClick={isRecording ? stopRecording : startRecording} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    <Circle size={20} className={isRecording ? 'fill-current' : ''} />
                  </button>
                  <span className="text-[10px] sm:text-xs font-medium text-gray-600">Enreg.</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button onClick={handleLeaveRoom} className="w-11 h-11 sm:w-12 sm:h-12 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-lg hover:shadow-red-200">
                    <PhoneOff size={20} className="text-white" />
                  </button>
                  <span className="text-[10px] sm:text-xs font-medium text-gray-600">Quitter</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {downloadLink && (
                  <a href={downloadLink} download={`meeting-${roomId}.${recordingFormat}`} className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-600 rounded-xl hover:bg-green-200">
                    <Download size={16} /><span className="text-sm font-medium">Télécharger ({recordingFormat.toUpperCase()})</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Modal sur mobile, sidebar sur desktop */}
        {showSidebar && (
          <>
            {/* Overlay mobile */}
            <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setShowSidebar(false)} />

            {/* Sidebar content */}
            <div className="fixed lg:relative top-0 right-0 h-full w-full sm:w-96 lg:w-80 bg-white p-4 sm:p-6 flex flex-col shadow-xl z-50 transform transition-transform duration-300 lg:transform-none">
              {/* Close button mobile */}
              <button onClick={() => setShowSidebar(false)} className="lg:hidden absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-600" />
              </button>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Panneau</h2>
              <div className="grid grid-cols-3 gap-1 mb-4 p-1 bg-gray-100 rounded-xl">
                {[
                  { id: 'participants', icon: Users, label: 'Participants' },
                  { id: 'chat', icon: MessageCircle, label: 'Chat' },
                  { id: 'tasks', icon: ListTodo, label: 'Tâches' },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} title={tab.label}
                      className={`p-2.5 rounded-lg flex items-center justify-center ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  {activeTab === 'participants' && `Participants (${allStreams.length})`}
                  {activeTab === 'chat' && 'Chat'}
                  {activeTab === 'tasks' && 'Liste de tâches'}
                </h3>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {activeTab === 'participants' && (
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {allStreams.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100">
                        <div className="flex items-center space-x-3">
                          <Avatar
                            user={{
                              avatar_url: s.avatarUrl,
                              user_metadata: { full_name: s.fullName },
                              email: s.email
                            }}
                            size="md"
                          />
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{s.isLocal ? 'Vous' : s.fullName}</p>
                            <p className="text-xs text-gray-500">{s.email?.split('@')[0] || ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {s.isLocal ? (
                            <>{isMicMuted ? <MicOff size={16} className="text-gray-400" /> : <Mic size={16} className="text-gray-600" />}
                              {isCamOff ? <VideoOff size={16} className="text-gray-400" /> : <Video size={16} className="text-gray-600" />}</>
                          ) : (<><Mic size={16} className="text-gray-600" /><Video size={16} className="text-gray-600" /></>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'chat' && <ChatBox roomId={roomId} />}
                {activeTab === 'tasks' && <SharedTodoList roomId={roomId} currentUser={currentUser} />}
              </div>

              <button onClick={copyRoomId} className="mt-4 w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 flex items-center justify-center space-x-2 shadow-lg">
                <UserPlus size={20} /><span>Inviter des personnes</span>
              </button>
            </div>
          </>
        )}

        {/* Report Room Modal */}
        {showReportModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Signaler cette salle</h3>
                <button onClick={() => setShowReportModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-2">
                {['Contenu inapproprié', 'Spam', 'Harcèlement', 'Activité illégale', 'Autre'].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => handleReportRoom(reason)}
                    className="w-full p-3 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetRoomPage;
