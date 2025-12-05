import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';

/**
 * Composant VideoPlayer avec overlay pour caméra éteinte
 * Affiche la photo de profil avec effet de flou et ondes sonores
 */
const VideoPlayer = ({ stream, isLocal, muted, isCamOff, user, isSpeaking }) => {
  const videoRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;

      // Vérifier si le stream a une piste vidéo active
      const videoTrack = stream.getVideoTracks()[0];
      setHasVideo(videoTrack && videoTrack.enabled);
    }
  }, [stream]);

  // Vérifier périodiquement si la vidéo est active
  useEffect(() => {
    if (!stream) return;

    const checkVideoStatus = () => {
      const videoTrack = stream.getVideoTracks()[0];
      setHasVideo(videoTrack && videoTrack.enabled);
    };

    const interval = setInterval(checkVideoStatus, 500);
    return () => clearInterval(interval);
  }, [stream]);

  const showOverlay = isCamOff || !hasVideo;

  return (
    <div className="relative w-full h-full bg-gray-900">
      {/* Vidéo */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`w-full h-full object-cover ${showOverlay ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
      />

      {/* Overlay quand caméra éteinte */}
      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          {/* Fond flouté avec gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black backdrop-blur-xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent"></div>
          </div>

          {/* Ondes sonores animées (seulement si l'utilisateur parle) */}
          {isSpeaking && (
            <div className="absolute inset-0 flex items-center justify-center">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="absolute rounded-full border-2 border-blue-400/30 animate-ping"
                  style={{
                    width: `${60 + i * 40}%`,
                    height: `${60 + i * 40}%`,
                    animationDuration: `${2 + i * 0.5}s`,
                    animationDelay: `${i * 0.3}s`
                  }}
                />
              ))}
            </div>
          )}

          {/* Photo de profil / Initiales */}
          <div className="relative z-10">
            <div className={`transform transition-transform duration-300 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
              <Avatar
                user={user}
                size="2xl"
                className={`shadow-2xl ${isSpeaking ? 'ring-4 ring-blue-400/50' : ''}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Indicateur de micro coupé */}
      {muted && (
        <div className="absolute bottom-2 right-2 bg-red-500 rounded-full p-1.5">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;