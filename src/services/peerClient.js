import { Peer } from 'peerjs';

let peer = null;

// Configuration PeerJS
const peerConfig = {
  // host: 'localhost',
  // port: 9000,
  // path: '/myapp',
  debug: import.meta.env.DEV ? 2 : 0, // Logs seulement en développement
  // secure: true, // Si votre serveur PeerJS utilise HTTPS. Par défaut PeerServer Cloud est sur HTTPS.
  config: {
    iceServers: [
      // Serveurs STUN publics (Google)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },

      // Serveurs Metered.ca
      { urls: "stun:stun.relay.metered.ca:80" }, 
      // TURN avec credentials depuis variables d'environnement
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: import.meta.env.VITE_TURN_USERNAME || "a477d20cd8d0cbaa5c63b536",
        credential: import.meta.env.VITE_TURN_CREDENTIAL || "42OzB3QurL4O5ghA",
      },
      {
        urls: "turn:standard.relay.metered.ca:80?transport=tcp",
        username: import.meta.env.VITE_TURN_USERNAME || "a477d20cd8d0cbaa5c63b536",
        credential: import.meta.env.VITE_TURN_CREDENTIAL || "42OzB3QurL4O5ghA",
      },
      {
        urls: "turn:standard.relay.metered.ca:443",
        username: import.meta.env.VITE_TURN_USERNAME || "a477d20cd8d0cbaa5c63b536",
        credential: import.meta.env.VITE_TURN_CREDENTIAL || "42OzB3QurL4O5ghA",
      },
      {
        urls: "turns:standard.relay.metered.ca:443?transport=tcp",
        username: import.meta.env.VITE_TURN_USERNAME || "a477d20cd8d0cbaa5c63b536",
        credential: import.meta.env.VITE_TURN_CREDENTIAL || "42OzB3QurL4O5ghA",
      },
    ]
  }
};

/**
 * Initialise une instance Peer pour l'utilisateur.
 * Si une instance existe déjà pour cet ID, elle est retournée.
 * @param {string} userId - L'ID unique de l'utilisateur pour PeerJS.
 * @returns {Peer} L'instance Peer.
 */
export const initializePeer = (userId) => {
  console.log(`[PeerJS Client] initializePeer called for userId: ${userId}`);

  if (peer && peer.id === userId && !peer.destroyed && peer.open) {
    console.log(`[PeerJS Client] Returning existing, open, and non-destroyed Peer instance for: ${userId}`);
    return peer;
  }

  // Si une instance existe, mais ne correspond pas à l'ID, est détruite, ou n'est pas ouverte,
  // il faut la détruire proprement avant d'en créer une nouvelle.
  if (peer) {
    console.log(`[PeerJS Client] Existing peer instance found (id: ${peer.id}, destroyed: ${peer.destroyed}, open: ${peer.open}). Requested userId: ${userId}. Destroying old instance.`);
    destroyPeer(); // Appelle peer.destroy() et met peer à null
  }

  console.log(`[PeerJS Client] Initializing new Peer instance for: ${userId} with config:`, JSON.stringify(peerConfig));
  try {
    // @ts-ignore
    peer = new Peer(userId, peerConfig);
    console.log("[PeerJS Client] New Peer instance created, but not yet open.");
  } catch (error) {
    console.error("[PeerJS Client] CRITICAL EXCEPTION during new Peer() instantiation:", error);
    alert("Erreur critique lors de l'initialisation du service de visioconférence (PeerJS Constructeur). Veuillez réessayer.");
    peer = null; // S'assurer que peer est null en cas d'échec du constructeur
    return null;
  }

  // Les gestionnaires d'événements sont importants pour le cycle de vie et le débogage
  peer.on('open', (id) => {
    console.log(`[PeerJS Client] Event 'open': Connection to PeerServer open. My peer ID is ${id}`);
  });

  peer.on('connection', (conn) => {
    console.log(`[PeerJS Client] Event 'connection': Incoming data connection from ${conn.peer}`);
    conn.on('data', (data) => console.log(`[PeerJS Client] Data from ${conn.peer}:`, data));
    conn.on('open', () => console.log(`[PeerJS Client] Data connection with ${conn.peer} opened.`));
    conn.on('close', () => console.log(`[PeerJS Client] Data connection with ${conn.peer} closed.`));
    conn.on('error', (err) => console.error(`[PeerJS Client] Data connection with ${conn.peer} error:`, err));
  });

  peer.on('disconnected', () => {
    console.warn("[PeerJS Client] Event 'disconnected': Disconnected from signaling server. PeerJS will attempt to reconnect automatically.");
  });

  peer.on('close', () => {
    // Cet événement signifie que la connexion Peer est complètement terminée et ne se reconnectera pas.
    // Cela arrive généralement après un appel à peer.destroy() ou si le serveur met fin à la connexion.
    console.log("[PeerJS Client] Event 'close': Peer connection closed. Instance will be set to null.");
    peer = null; // Important pour le nettoyage et pour permettre une nouvelle initialisation correcte.
  });

  peer.on('error', (err) => {
    console.error("[PeerJS Client] Event 'error': General Peer error:", err);
    // L'alerte pour l'erreur d'ouverture initiale est gérée dans MeetRoomPage.
    // Mais d'autres erreurs peuvent survenir.
    if (!peer?.open && err.type !== 'peer-unavailable') { // Si le peer n'est pas encore ouvert et que ce n'est pas une erreur 'peer-unavailable' (qui est gérée spécifiquement)
        // Ces erreurs sont souvent celles qui empêchent 'open' de se produire.
        // L'erreur 'ID is taken' aura le type 'unavailable-id', géré ci-dessous.
    }

    // Gestion spécifique pour les types d'erreurs courants
    switch (err.type) {
      case 'browser-incompatible':
        alert("Erreur PeerJS: Votre navigateur n'est pas compatible avec WebRTC.");
        break;
      case 'disconnected':
        // Déjà géré par l'événement 'disconnected', mais peut aussi apparaître ici.
        console.warn("[PeerJS Client] Error type 'disconnected': Lost connection to signaling server.");
        break;
      case 'network':
        // Souvent une erreur générique pour des problèmes de connectivité.
        // L'alerte dans MeetRoomPage pour l'échec initial de connexion est peut-être suffisante.
        console.error("[PeerJS Client] Error type 'network': Network error or problem connecting to PeerServer.");
        break;
      case 'peer-unavailable':
        // Se produit lorsque l'ID distant n'est pas trouvé lors d'un appel peer.call() ou peer.connect()
        // OU, crucialement, si notre propre ID est déjà pris lors de l'initialisation.
        console.error(`[PeerJS Client] Error type 'peer-unavailable': Peer ID (${err.message.includes('Could not connect to peer') ? 'remote' : peer?.id || 'current'}) is unavailable.`);
        // L'alerte pour "ID is taken" est mieux gérée dans MeetRoomPage car elle a plus de contexte UI.
        break;
      case 'server-error':
        alert("Erreur PeerJS: Problème avec le serveur de signalisation. Veuillez réessayer plus tard.");
        break;
      case 'socket-error':
        console.error("[PeerJS Client] Error type 'socket-error': WebSocket error.");
        break;
      case 'socket-closed':
        console.warn("[PeerJS Client] Error type 'socket-closed': WebSocket connection closed unexpectedly.");
        break;
      case 'unavailable-id':
        // Cette erreur spécifique signifie que l'ID que nous essayons d'utiliser pour NOTRE peer est déjà pris.
        console.error(`[PeerJS Client] Error type 'unavailable-id': The ID (${peer?.id || userId}) is taken or invalid.`);
        // L'alerte est gérée dans MeetRoomPage.
        break;
      case 'webrtc':
        alert("Erreur PeerJS: Problème avec la connexion WebRTC. Vérifiez votre réseau.");
        break;
      default:
        console.error(`[PeerJS Client] Unhandled PeerJS error type: ${err.type}`);
        alert("Une erreur PeerJS inattendue est survenue.");
    }
    // Ne pas détruire le peer ici aveuglément, la logique dans MeetRoomPage ou le cycle de vie des événements s'en chargera peut-être.
  });

  return peer;
};

/**
 * Retourne l'instance Peer actuelle si elle existe et n'est pas détruite.
 * @returns {Peer | null} L'instance Peer ou null.
 */
export const getPeer = () => {
  if (peer && !peer.destroyed) {
    return peer;
  }
  return null;
};

/**
 * Détruit l'instance Peer actuelle si elle existe.
 */
export const destroyPeer = () => {
  if (peer) { // On vérifie juste si peer existe, car peer.destroy() gère déjà le cas où il est déjà détruit.
    console.log(`[PeerJS Client] destroyPeer called. Destroying Peer instance explicitly: ${peer.id}, destroyed: ${peer.destroyed}, open: ${peer.open}`);
    try {
      peer.destroy(); // peer.destroy() déclenchera l'événement 'close', qui mettra peer à null.
    } catch (error) {
      console.error("[PeerJS Client] EXCEPTION during peer.destroy():", error);
      // Forcer peer à null même si destroy() échoue, pour permettre une nouvelle tentative d'initialisation.
      peer = null;
    }
  } else {
    console.log("[PeerJS Client] destroyPeer called, but no active Peer instance to destroy.");
  }
  // S'assurer que peer est null même si l'instance n'existait pas ou si destroy() a échoué et n'a pas déclenché 'close' assez vite.
  peer = null;
};

// Plus de fonctions utilitaires pour PeerJS peuvent être ajoutées ici,
// par exemple pour initier un appel ou une connexion de données.

/**
 * Établit une connexion de données avec un autre pair.
 * @param {string} remotePeerId L'ID du pair distant.
 * @returns {DataConnection | null} L'objet DataConnection ou null si l'instance Peer n'est pas prête.
 */
export const connectToPeerData = (remotePeerId) => {
  const peer = getPeer();
  if (!peer || peer.disconnected || peer.destroyed) {
    console.error('PeerJS: Instance Peer non disponible ou déconnectée pour la connexion de données.');
    return null;
  }
  console.log(`PeerJS: Tentative de connexion de données à ${remotePeerId}`);
  const conn = peer.connect(remotePeerId);
  // Les gestionnaires d'événements pour cette connexion spécifique sont généralement ajoutés ici
  // ou là où la connexion est initiée (ex: dans le composant React)
  return conn; 
};

/**
 * Appelle un pair distant avec un flux média.
 * @param {string} remotePeerId L'ID du pair distant.
 * @param {MediaStream} localStream Le flux média local à envoyer.
 * @returns {MediaConnection | null} L'objet MediaConnection ou null si l'instance Peer n'est pas prête.
 */
export const callPeer = (remotePeerId, localStream) => {
  // Utiliser getPeer() pour s'assurer d'obtenir une instance valide (non détruite)
  const currentValidPeer = getPeer();
  if (!currentValidPeer) {
    console.error("[PeerJS Client] Cannot call, Peer instance not available or destroyed.");
    return null;
  }
  if (!remotePeerId) {
    console.error("[PeerJS Client] Cannot call, remotePeerId is invalid.");
    return null;
  }
  if (!localStream || !localStream.active) {
    console.error("[PeerJS Client] Cannot call, local stream is not available or not active.");
    return null;
  }
  console.log(`[PeerJS Client] Attempting to call ${remotePeerId} with stream id ${localStream.id} and metadata:`, {});
  try {
    return currentValidPeer.call(remotePeerId, localStream, { metadata: {} });
  } catch (error) {
    console.error("[PeerJS Client] EXCEPTION during peer.call():", error);
    return null;
  }
}; 