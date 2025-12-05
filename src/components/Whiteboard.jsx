import { useRef, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  Pencil, Eraser, Square, Circle as CircleIcon, Minus,
  Trash2, Download, Undo, Redo, Palette, MousePointer
} from 'lucide-react';

const Whiteboard = ({ roomId }) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const syncTimeoutRef = useRef(null);
  const isRemoteUpdateRef = useRef(false);

  const colors = ['#000000', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF'];
  const sizes = [2, 4, 6, 10, 16];

  // Synchroniser le canvas avec un debounce pour éviter trop de requêtes
  const syncCanvas = useCallback(async () => {
    if (!roomId || !canvasRef.current || isRemoteUpdateRef.current) {
      if (import.meta.env.DEV) console.log('Whiteboard: Sync skipped - missing requirements');
      return;
    }
    
    const canvasData = canvasRef.current.toDataURL();
    try {
      if (import.meta.env.DEV) console.log('Whiteboard: Syncing canvas data to database');
      const { error } = await supabase
        .from('room_whiteboard')
        .upsert({
          room_id: roomId,
          canvas_data: canvasData,
          updated_at: new Date().toISOString(),
          is_active: true
        }, { onConflict: 'room_id' });
      
      if (error) {
        console.error('Whiteboard: Sync error:', error);
      } else {
        if (import.meta.env.DEV) console.log('Whiteboard: Canvas synced successfully');
      }
    } catch (e) {
      console.error('Whiteboard: Sync exception:', e);
    }
  }, [roomId]);

  const debouncedSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      syncCanvas();
    }, 500); // Sync toutes les 500ms max pendant le dessin (réduit la charge)
  }, [syncCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    canvas.style.width = `${canvas.offsetWidth}px`;
    canvas.style.height = `${canvas.offsetHeight}px`;

    const context = canvas.getContext('2d');
    context.scale(2, 2);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    contextRef.current = context;

    // Fill with white background
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  }, []);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
      contextRef.current.lineWidth = tool === 'eraser' ? lineWidth * 3 : lineWidth;
    }
  }, [color, lineWidth, tool]);

  const saveState = async (broadcast = true) => {
    if (!canvasRef.current) {
      console.log('Whiteboard: Cannot save state - canvas not ready');
      return;
    }

    const canvas = canvasRef.current;
    const newHistory = history.slice(0, historyIndex + 1);
    const canvasData = canvas.toDataURL();
    newHistory.push(canvasData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    // Sauvegarder dans Supabase pour synchronisation
    if (roomId && broadcast && !isRemoteUpdateRef.current) {
      try {
        console.log('Whiteboard: Saving state to database');
        const { error } = await supabase
          .from('room_whiteboard')
          .upsert({
            room_id: roomId,
            canvas_data: canvasData,
            updated_at: new Date().toISOString(),
            is_active: true
          }, { onConflict: 'room_id' });
        
        if (error) {
          console.error('Whiteboard: Save error:', error);
        } else {
          console.log('Whiteboard: State saved successfully');
        }
      } catch (e) {
        console.error('Whiteboard: Save exception:', e);
      }
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      loadState(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      loadState(history[newIndex]);
    }
  };

  const loadState = (dataUrl, fromRemote = false) => {
    if (!canvasRef.current || !contextRef.current) {
      console.log('Whiteboard: Cannot load state - canvas not ready');
      return;
    }

    const canvas = canvasRef.current;
    const context = contextRef.current;
    const img = new Image();
    
    img.onload = () => {
      try {
        // Marquer comme mise à jour distante pour éviter de re-synchroniser
        if (fromRemote) {
          console.log('Whiteboard: Loading remote canvas state');
          isRemoteUpdateRef.current = true;
        }
        
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
        
        // Réinitialiser après un court délai
        if (fromRemote) {
          setTimeout(() => {
            isRemoteUpdateRef.current = false;
            console.log('Whiteboard: Remote update flag cleared');
          }, 100);
        }
      } catch (e) {
        console.error('Whiteboard: Error loading canvas state:', e);
        if (fromRemote) {
          isRemoteUpdateRef.current = false;
        }
      }
    };
    
    img.onerror = (e) => {
      console.error('Whiteboard: Error loading image:', e);
      if (fromRemote) {
        isRemoteUpdateRef.current = false;
      }
    };
    
    img.src = dataUrl;
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    setStartPos({ x, y });
    setIsDrawing(true);

    if (tool === 'pencil' || tool === 'eraser') {
      contextRef.current.beginPath();
      contextRef.current.moveTo(x, y);
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);

    if (tool === 'pencil' || tool === 'eraser') {
      contextRef.current.lineTo(x, y);
      contextRef.current.stroke();
      // Synchroniser pendant le dessin
      debouncedSync();
    }
  };

  const finishDrawing = (e) => {
    if (!isDrawing) return;
    e?.preventDefault();
    const { x, y } = e ? getCoordinates(e) : startPos;

    if (tool === 'rectangle') {
      contextRef.current.strokeRect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
    } else if (tool === 'circle') {
      const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
      contextRef.current.beginPath();
      contextRef.current.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
      contextRef.current.stroke();
    } else if (tool === 'line') {
      contextRef.current.beginPath();
      contextRef.current.moveTo(startPos.x, startPos.y);
      contextRef.current.lineTo(x, y);
      contextRef.current.stroke();
    }

    setIsDrawing(false);
    contextRef.current.closePath();
    saveState();
  };

  const clearCanvas = async () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    await saveState();
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `whiteboard-${roomId}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Subscribe to canvas changes from other users
  useEffect(() => {
    if (!roomId) return;

    let isInitialLoad = true;

    // Charger les données initiales du canvas
    const loadInitialCanvas = async () => {
      try {
        console.log('Whiteboard: Loading initial canvas data for room:', roomId);
        const { data, error } = await supabase
          .from('room_whiteboard')
          .select('canvas_data, updated_at')
          .eq('room_id', roomId)
          .eq('is_active', true)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
          console.error('Whiteboard: Error loading initial canvas:', error);
          return;
        }

        if (data?.canvas_data) {
          console.log('Whiteboard: Loading initial canvas data');
          loadState(data.canvas_data, true);
        } else {
          console.log('Whiteboard: No initial canvas data found');
        }
      } catch (e) {
        console.error('Whiteboard: Exception loading initial canvas:', e);
      } finally {
        isInitialLoad = false;
      }
    };

    loadInitialCanvas();

    // Écouter les changements INSERT et UPDATE avec un canal unique
    const channelName = `whiteboard-${roomId}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('Whiteboard: Creating subscription channel:', channelName);
    
    const canvasSub = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_whiteboard',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        console.log('Whiteboard: Received payload:', payload.eventType, payload);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          if (payload.new?.canvas_data && !isRemoteUpdateRef.current && !isInitialLoad) {
            console.log('Whiteboard: Applying remote canvas update');
            loadState(payload.new.canvas_data, true);
          }
        }
      })
      .subscribe((status, err) => {
        console.log('Whiteboard subscription status:', status, err);
        if (status === 'SUBSCRIBED') {
          console.log('Whiteboard: Successfully subscribed to real-time updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Whiteboard: Channel subscription error:', err);
        }
      });

    return () => { 
      console.log('Whiteboard: Cleaning up subscription');
      supabase.removeChannel(canvasSub); 
    };
  }, [roomId]);

  const tools = [
    { id: 'select', icon: MousePointer, label: 'Sélection' },
    { id: 'pencil', icon: Pencil, label: 'Crayon' },
    { id: 'eraser', icon: Eraser, label: 'Gomme' },
    { id: 'line', icon: Minus, label: 'Ligne' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: CircleIcon, label: 'Cercle' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-1">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={t.label}
                className={`p-2 rounded-lg transition-all ${tool === t.id
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <Icon size={18} />
              </button>
            );
          })}

          <div className="w-px h-6 bg-gray-200 mx-2" />

          {/* Color picker */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-2 rounded-lg hover:bg-gray-100 flex items-center space-x-1"
            >
              <div className="w-5 h-5 rounded-full border-2 border-gray-300" style={{ backgroundColor: color }} />
              <Palette size={14} className="text-gray-500" />
            </button>
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-xl shadow-xl border border-gray-200 z-10">
                <div className="grid grid-cols-4 gap-1">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setColor(c); setShowColorPicker(false); }}
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-blue-500 scale-110' : 'border-gray-200'
                        }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Line width */}
          <div className="flex items-center space-x-1 ml-2">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => setLineWidth(s)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${lineWidth === s ? 'bg-blue-100' : 'hover:bg-gray-100'
                  }`}
              >
                <div
                  className="rounded-full bg-gray-800"
                  style={{ width: s + 2, height: s + 2 }}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Annuler"
          >
            <Undo size={18} />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Rétablir"
          >
            <Redo size={18} />
          </button>
          <div className="w-px h-6 bg-gray-200 mx-2" />
          <button
            onClick={clearCanvas}
            className="p-2 rounded-lg text-red-500 hover:bg-red-50"
            title="Effacer tout"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={downloadCanvas}
            className="p-2 rounded-lg text-green-600 hover:bg-green-50"
            title="Télécharger"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={finishDrawing}
          onMouseLeave={finishDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={finishDrawing}
          className="absolute inset-0 w-full h-full cursor-crosshair bg-white"
          style={{ touchAction: 'none' }}
        />
      </div>
    </div>
  );
};

export default Whiteboard;
