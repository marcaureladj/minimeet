import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Plus, Trash2, CheckCircle, Circle } from 'lucide-react';

const SharedTodoList = ({ roomId, currentUser }) => {
  const [todos, setTodos] = useState([]);
  const [newTodoContent, setNewTodoContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const listContainerRef = useRef(null);

  useEffect(() => {
    const fetchTodos = async () => {
      if (!roomId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('todos')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true });

        if (fetchError) throw fetchError;
        setTodos(data || []);
      } catch (err) {
        setError('Impossible de charger les tâches.');
        setTodos([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTodos();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const channelName = `todos-${roomId}`;
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'todos',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTodos(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setTodos(prev => prev.map(todo => todo.id === payload.new.id ? payload.new : todo));
        } else if (payload.eventType === 'DELETE') {
          setTodos(prev => prev.filter(todo => todo.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription).catch(console.error);
    };
  }, [roomId]);

  useEffect(() => {
    if (listContainerRef.current && todos.length > 0) {
      setTimeout(() => {
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = listContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [todos]);

  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!newTodoContent.trim() || !currentUser || !roomId) return;
    const content = newTodoContent.trim();
    setNewTodoContent('');

    try {
      const { error: insertError } = await supabase.from('todos').insert({
        room_id: roomId,
        task_content: content,
        created_by_user_id: currentUser.id
      });
      if (insertError) throw insertError;
    } catch (err) {
      setError("Impossible d'ajouter la tâche.");
      setNewTodoContent(content);
    }
  };

  const handleToggleTodo = async (todoId, currentStatus) => {
    if (!currentUser) return;
    try {
      const { error: updateError } = await supabase
        .from('todos')
        .update({ is_completed: !currentStatus })
        .eq('id', todoId);
      if (updateError) throw updateError;
    } catch (err) {
      setError('Impossible de mettre à jour.');
    }
  };

  const handleDeleteTodo = async (todoId) => {
    if (!currentUser || !roomId) return;
    if (!window.confirm("Supprimer cette tâche ?")) return;

    try {
      const { error: deleteError } = await supabase
        .from('todos')
        .delete()
        .eq('id', todoId);
      if (deleteError) throw deleteError;
    } catch (err) {
      setError("Impossible de supprimer.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="p-2 text-sm text-red-600 bg-red-50 rounded-lg mb-2">{error}</div>
      )}

      {/* Todo List */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
        {todos.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            Aucune tâche pour le moment.
          </div>
        ) : (
          todos.map(todo => (
            <div
              key={todo.id}
              className={`group flex items-center p-3 rounded-xl transition-all ${
                todo.is_completed
                  ? 'bg-green-50 border border-green-100'
                  : 'bg-gray-50 hover:bg-gray-100 border border-gray-100'
              }`}
            >
              <button
                onClick={() => handleToggleTodo(todo.id, todo.is_completed)}
                className="flex-shrink-0 mr-3"
              >
                {todo.is_completed ? (
                  <CheckCircle size={22} className="text-green-500" />
                ) : (
                  <Circle size={22} className="text-gray-300 hover:text-blue-500 transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <span className={`text-sm block truncate ${
                  todo.is_completed ? 'line-through text-gray-400' : 'text-gray-900'
                }`}>
                  {todo.task_content}
                </span>
                <span className="text-xs text-gray-400">
                  {todo.created_by_full_name || (todo.created_by_user_id || '').substring(0, 5)}
                </span>
              </div>
              <button
                onClick={() => handleDeleteTodo(todo.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleAddTodo} className="mt-4 flex items-center gap-2">
        <input
          type="text"
          value={newTodoContent}
          onChange={(e) => setNewTodoContent(e.target.value)}
          placeholder="Nouvelle tâche..."
          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        <button
          type="submit"
          disabled={!newTodoContent.trim()}
          className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={18} />
        </button>
      </form>
    </div>
  );
};

export default SharedTodoList;
