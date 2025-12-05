import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Send, Flag, X } from 'lucide-react';
import { getDisplayName } from '../services/userUtils';

const ChatBox = ({ roomId }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingMessage, setReportingMessage] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setIsLoadingUser(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setCurrentUser(session.user);
      setIsLoadingUser(false);
    }).catch(() => setIsLoadingUser(false));

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ?? null);
      setIsLoadingUser(false);
    });
    return () => authListener?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!roomId) return;
      const { data, error } = await supabase
        .from('messages')
        .select('id, room_id, sender_id, content, created_at, sender_full_name')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) {
        setError('Impossible de charger les messages.');
        setMessages([]);
      } else {
        const transformedData = data.map(msg => ({
          ...msg,
          sender: { fullName: msg.sender_full_name || msg.sender_id }
        }));
        setMessages(transformedData || []);
      }
    };
    fetchMessages();
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !currentUser) return;
    const channelName = `chat-${roomId}`;
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const newMessageData = {
          ...payload.new,
          sender: { fullName: payload.new.sender_full_name || payload.new.sender_id }
        };
        setMessages(prev => [...prev, newMessageData]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription).catch(console.error);
    };
  }, [roomId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleReportMessage = async (reason) => {
    if (!reportingMessage || !currentUser) return;
    try {
      await supabase.from('reports').insert({
        reporter_id: currentUser.id,
        report_type: 'message',
        target_id: reportingMessage.id,
        room_id: roomId,
        reason
      });
      setShowReportModal(false);
      setReportingMessage(null);
      alert('Message signalé');
    } catch (e) {
      setError('Erreur lors du signalement');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    // Utiliser le display name de auth.users
    const senderFullName = getDisplayName(currentUser);

    const messageToSend = {
      room_id: roomId,
      sender_id: currentUser.id,
      content: newMessage.trim(),
      sender_full_name: senderFullName
    };

    const { error: insertError } = await supabase.from('messages').insert([messageToSend]);
    if (insertError) {
      setError("Erreur lors de l'envoi.");
    } else {
      setNewMessage('');
      setError(null);
    }
  };

  if (isLoadingUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Connectez-vous pour voir le chat.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="p-2 text-sm text-red-600 bg-red-50 rounded-lg mb-2">{error}</div>
      )}
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            Aucun message. Soyez le premier !
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUser.id;
            return (
              <div key={msg.id} className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${isMe ? 'order-2' : 'order-1'} relative`}>
                  {!isMe && (
                    <button
                      onClick={() => { setReportingMessage(msg); setShowReportModal(true); }}
                      className="absolute -right-6 top-1 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                      title="Signaler"
                    >
                      <Flag size={12} />
                    </button>
                  )}
                  <div
                    className={`px-4 py-2.5 rounded-2xl ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}
                  >
                    {!isMe && (
                      <p className="text-xs font-semibold mb-1 text-gray-600">
                        {msg.sender?.fullName || 'Anonyme'}
                      </p>
                    )}
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  <p className={`text-xs mt-1 ${isMe ? 'text-right' : 'text-left'} text-gray-400`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="mt-4 flex items-center gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Tapez votre message..."
          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={18} />
        </button>
      </form>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Signaler ce message</h3>
              <button onClick={() => { setShowReportModal(false); setReportingMessage(null); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              {['Contenu inapproprié', 'Spam', 'Harcèlement', 'Autre'].map((reason) => (
                <button
                  key={reason}
                  onClick={() => handleReportMessage(reason)}
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
  );
};

export default ChatBox;
