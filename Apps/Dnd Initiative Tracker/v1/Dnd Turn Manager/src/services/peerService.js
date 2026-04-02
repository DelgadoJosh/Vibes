import Peer from 'peerjs';

const PEER_PREFIX = 'dnd-turn-mgr-v1-';

export const createHostPeer = (sessionId) => {
  const peerId = `${PEER_PREFIX}${sessionId}`;
  // We use the default free PeerJS cloud server
  return new Peer(peerId, {
    debug: 2,
  });
};

export const createClientPeer = () => {
  return new Peer({
    debug: 2,
  });
};

export const getHostPeerId = (sessionId) => {
  return `${PEER_PREFIX}${sessionId}`;
};
