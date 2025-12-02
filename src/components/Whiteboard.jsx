import React, { useRef, useState, useEffect } from 'react';
import { 
  Pencil, Eraser, Square, Circle as CircleIcon, Minus, Type, 
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

  const colors = ['#000000', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF'];
  const sizes = [2, 4, 6, 10, 16];

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

  const saveState = () => {
    const canvas = canvasRef.current;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(canvas.toDataURL());
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
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

  const loadState = (dataUrl) => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    const img = new Image();
    img.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
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

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    saveState();
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `whiteboard-${roomId}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

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
                className={`p-2 rounded-lg transition-all ${
                  tool === t.id
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
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                        color === c ? 'border-blue-500 scale-110' : 'border-gray-200'
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
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  lineWidth === s ? 'bg-blue-100' : 'hover:bg-gray-100'
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
