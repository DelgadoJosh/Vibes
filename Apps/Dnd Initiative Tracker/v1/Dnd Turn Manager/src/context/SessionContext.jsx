import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createHostPeer, createClientPeer, getHostPeerId } from '../services/peerService';

const SessionContext = createContext();

export const useSession = () => useContext(SessionContext);

export const SessionProvider = ({ children }) => {
  const [peer, setPeer] = useState(null);
  const [connections, setConnections] = useState([]); // For DM: list of connected players
  const [connection, setConnection] = useState(null); // For Player: connection to DM
  
  const [role, setRole] = useState(null); // 'dm' or 'player'
  const [sessionState, setSessionState] = useState({
    combatants: [],
    activeTurnId: null,
    round: 1,
  });
  
  // Track fresh session state in a ref so late-joining players get the latest data immediately
  const sessionStateRef = useRef(sessionState);
  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);
  
  const [status, setStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected', 'error'
  const [errorMsg, setErrorMsg] = useState('');
  
  // Ref to prevent double-initialization in React 18 StrictMode
  const isInitializing = useRef(false);
  const currentSessionIdRef = useRef(null);

  // -------------------------
  // DM Functions
  // -------------------------
  const initHost = useCallback((sessionId, dmPassword, playerPassword) => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    
    // Check localStorage for resuming session
    const storageKey = `dnd_session_${sessionId}`;
    const storedStr = localStorage.getItem(storageKey);
    let initialSessionState = { combatants: [], activeTurnId: null, round: 1 };
    let currentPlayerPassword = playerPassword;
    
    if (storedStr) {
      try {
        const stored = JSON.parse(storedStr);
        if (stored.dmPassword && stored.dmPassword !== dmPassword) {
           setStatus('error');
           setErrorMsg('Incorrect DM Password for this local session. (Cannot resume)');
           isInitializing.current = false;
           return;
        }
        if (stored.sessionState) {
          initialSessionState = stored.sessionState;
        }
        if (stored.playerPassword && !playerPassword) {
           currentPlayerPassword = stored.playerPassword;
        }
      } catch (e) {
         console.error('Failed to parse previous session state');
      }
    } 
    
    // Save/Update config in localStorage
    localStorage.setItem(storageKey, JSON.stringify({ 
      dmPassword, 
      playerPassword: currentPlayerPassword, 
      sessionState: initialSessionState 
    }));
    
    currentSessionIdRef.current = sessionId;
    setSessionState(initialSessionState);
    
    setStatus('connecting');
    const newPeer = createHostPeer(sessionId);
    
    newPeer.on('open', (id) => {
      console.log('Host peer opened with ID:', id);
      setRole('dm');
      setPeer(newPeer);
      setStatus('connected');
      isInitializing.current = false;
    });

    newPeer.on('connection', (conn) => {
      conn.on('data', (data) => {
        if (data.type === 'auth') {
          // Compare against the active playerPassword from state
          if (data.password === currentPlayerPassword) {
            conn.send({ type: 'auth_success' });
            setConnections((prev) => [...prev, conn]);
            // Send the most up-to-date state (stored in ref) to the new player
            conn.send({ type: 'state_update', payload: sessionStateRef.current });
          } else {
            conn.send({ type: 'auth_fail' });
            setTimeout(() => conn.close(), 500);
          }
        }
      });
      
      conn.on('close', () => {
        setConnections((prev) => prev.filter((c) => c.peer !== conn.peer));
      });
    });

    newPeer.on('error', (err) => {
      console.error('Peer error:', err);
      setStatus('error');
      setErrorMsg(err.message || 'Connection error');
      isInitializing.current = false;
    });
  }, []);

  // When DM updates state, broadcast to players and save to localStorage
  const updateStateAndBroadcast = useCallback((newState) => {
    setSessionState(newState);
    
    if (currentSessionIdRef.current) {
        const storageKey = `dnd_session_${currentSessionIdRef.current}`;
        try {
           const storedStr = localStorage.getItem(storageKey);
           if (storedStr) {
               const stored = JSON.parse(storedStr);
               stored.sessionState = newState;
               localStorage.setItem(storageKey, JSON.stringify(stored));
           }
        } catch (e) {
           console.error('Failed to sync to local storage');
        }
    }
    
    const filteredState = {
      ...newState,
      combatants: newState.combatants
        .filter(c => c.isVisible)
        .map(c => {
          const { hp, maxHp, statusEffects, ...publicData } = c;
          return publicData;
        })
    };

    connections.forEach(conn => {
      if (conn.open) {
        conn.send({ type: 'state_update', payload: filteredState });
      }
    });
  }, [connections]);

  // -------------------------
  // Player Functions
  // -------------------------
  const initClient = useCallback((sessionId, password) => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    
    setStatus('connecting');
    const newPeer = createClientPeer();
    
    newPeer.on('open', (id) => {
      console.log('Client peer opened with ID:', id);
      setRole('player');
      setPeer(newPeer);
      
      const hostId = getHostPeerId(sessionId);
      const conn = newPeer.connect(hostId, { reliable: true });
      
      conn.on('open', () => {
        conn.send({ type: 'auth', password });
      });
      
      conn.on('data', (data) => {
        if (data.type === 'auth_success') {
          setStatus('connected');
          setConnection(conn);
          isInitializing.current = false;
        } else if (data.type === 'auth_fail') {
          setStatus('error');
          setErrorMsg('Incorrect Password');
          conn.close();
          isInitializing.current = false;
        } else if (data.type === 'state_update') {
          setSessionState(data.payload);
        }
      });

      conn.on('close', () => {
        setStatus('disconnected');
        setConnection(null);
      });
    });

    newPeer.on('error', (err) => {
      console.error('Peer error:', err);
      setStatus('error');
      setErrorMsg(err.message || 'Connection error');
      isInitializing.current = false;
    });
  }, []);

  return (
    <SessionContext.Provider value={{
      role,
      status,
      errorMsg,
      sessionState,
      initHost,
      initClient,
      updateStateAndBroadcast
    }}>
      {children}
    </SessionContext.Provider>
  );
};
