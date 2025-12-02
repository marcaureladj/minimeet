import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { generateMeetingSummary } from '../services/openRouterClient';
import {
  Clock, Users, Calendar, Sparkles, Loader2, ChevronDown, ChevronUp,
  FileText, Copy, Check, ArrowLeft, Menu
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Avatar from '../components/Avatar';

const HistoryPage = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [meetings, setMeetings] = useState([]);
  const [expandedMeeting, setExpandedMeeting] = useState(null);
  const [generatingSummary, setGeneratingSummary] = useState(null);
  const [copied, setCopied] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        fetchMeetings(session.user.id);
      } else {
        navigate('/login');
      }
    };
    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) navigate('/login');
      else { setCurrentUser(session.user); fetchMeetings(session.user.id); }
    });
    return () => authListener?.subscription?.unsubscribe();
  }, [navigate]);

  const fetchMeetings = async (userId) => {
    setIsLoading(true);
    try {
      // Get meetings created by user
      const { data: userMeetings } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Get participant logs for each meeting
      const meetingsWithDetails = await Promise.all((userMeetings || []).map(async (meeting) => {
        const { data: participants } = await supabase
          .from('meeting_participants_log')
          .select('*')
          .eq('room_id', meeting.room_id)
          .order('joined_at', { ascending: true });

        const { data: transcripts } = await supabase
          .from('meeting_transcripts')
          .select('*')
          .eq('room_id', meeting.room_id);

        const { data: summary } = await supabase
          .from('meeting_summaries')
          .select('*')
          .eq('room_id', meeting.room_id)
          .single();

        return { ...meeting, participants: participants || [], transcripts: transcripts || [], summary };
      }));

      setMeetings(meetingsWithDetails);
    } catch (e) {
      console.error('Error fetching meetings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSummaryForMeeting = async (meeting) => {
    if (!meeting.transcripts.length) {
      alert('Aucune transcription disponible pour cette réunion.');
      return;
    }

    setGeneratingSummary(meeting.id);
    try {
      const fullTranscript = meeting.transcripts.map(t => t.transcript).join('\n\n');
      const totalDuration = meeting.transcripts.reduce((acc, t) => acc + (t.duration_seconds || 0), 0);

      const summaryText = await generateMeetingSummary(fullTranscript, {
        title: meeting.name || `Réunion ${meeting.room_id}`,
        duration: formatDuration(totalDuration)
      });

      // Save summary to database
      await supabase.from('meeting_summaries').upsert({
        room_id: meeting.room_id,
        user_id: currentUser.id,
        summary: summaryText,
        transcript: fullTranscript,
        duration_seconds: totalDuration,
        created_at: new Date().toISOString()
      }, { onConflict: 'room_id' });

      // Refresh meetings
      fetchMeetings(currentUser.id);
    } catch (e) {
      alert('Erreur lors de la génération du résumé: ' + e.message);
    } finally {
      setGeneratingSummary(null);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m} min`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
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
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Historique des réunions</h1>
                <p className="text-xs sm:text-sm text-gray-500">{meetings.length} réunion(s) trouvée(s)</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
            {meetings.length === 0 ? (
              <div className="text-center py-16">
                <Clock size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Aucune réunion dans l'historique</p>
              </div>
            ) : (
              <div className="space-y-4">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
                    {/* Meeting Header */}
                    <div
                      className="p-5 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => setExpandedMeeting(expandedMeeting === meeting.id ? null : meeting.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Calendar size={20} className="text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {meeting.name || `Réunion ${meeting.room_id.substring(0, 8)}...`}
                            </h3>
                            <p className="text-sm text-gray-500">{formatDate(meeting.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2 text-gray-500">
                            <Users size={16} />
                            <span className="text-sm">{meeting.participants.length} participant(s)</span>
                          </div>
                          {meeting.summary && (
                            <div className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                              Résumé disponible
                            </div>
                          )}
                          {expandedMeeting === meeting.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedMeeting === meeting.id && (
                      <div className="px-5 pb-5 border-t border-gray-200">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-5">
                          {/* Meeting Info */}
                          <div className="space-y-4">
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                              <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                                <FileText size={16} />
                                <span>Informations</span>
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">ID de la salle</span>
                                  <div className="flex items-center space-x-2">
                                    <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{meeting.room_id}</code>
                                    <button onClick={() => copyToClipboard(meeting.room_id, `room-${meeting.id}`)}>
                                      {copied === `room-${meeting.id}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400" />}
                                    </button>
                                  </div>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Date de création</span>
                                  <span className="text-gray-900">{formatDate(meeting.created_at)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Transcriptions</span>
                                  <span className="text-gray-900">{meeting.transcripts.length}</span>
                                </div>
                              </div>
                            </div>

                            {/* Participants */}
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                              <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                                <Users size={16} />
                                <span>Participants ({meeting.participants.length})</span>
                              </h4>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {meeting.participants.length === 0 ? (
                                  <p className="text-sm text-gray-400 italic">Aucun participant enregistré</p>
                                ) : (
                                  meeting.participants.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
                                      <div className="flex items-center space-x-2">
                                        <Avatar
                                          user={{
                                            avatar_url: p.user_avatar_url,
                                            user_metadata: { full_name: p.user_full_name },
                                            email: p.user_email
                                          }}
                                          size="sm"
                                        />
                                        <span className="text-gray-900">{p.user_full_name || p.user_email}</span>
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {new Date(p.joined_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        {p.left_at && ` - ${new Date(p.left_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Summary Section */}
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
                                <Sparkles size={16} className="text-purple-500" />
                                <span>Résumé IA</span>
                              </h4>
                              {meeting.summary && (
                                <button onClick={() => copyToClipboard(meeting.summary.summary, `summary-${meeting.id}`)}>
                                  {copied === `summary-${meeting.id}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400" />}
                                </button>
                              )}
                            </div>

                            {meeting.summary ? (
                              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 max-h-64 overflow-y-auto">
                                <div className="prose prose-sm text-gray-700 whitespace-pre-wrap">
                                  {meeting.summary.summary}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <Sparkles size={32} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-gray-500 text-sm mb-4">
                                  {meeting.transcripts.length > 0
                                    ? 'Générez un résumé automatique de cette réunion'
                                    : 'Aucune transcription disponible pour générer un résumé'}
                                </p>
                                <button
                                  onClick={() => generateSummaryForMeeting(meeting)}
                                  disabled={generatingSummary === meeting.id || meeting.transcripts.length === 0}
                                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
                                >
                                  {generatingSummary === meeting.id ? (
                                    <><Loader2 size={16} className="animate-spin" /><span>Génération...</span></>
                                  ) : (
                                    <><Sparkles size={16} /><span>Générer le résumé</span></>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end mt-4 space-x-3">
                          <button
                            onClick={() => navigate(`/meet/${meeting.room_id}`)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                          >
                            Rejoindre cette salle
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
