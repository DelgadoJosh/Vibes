import { useState } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { SessionProvider, useSession } from './context/SessionContext';
import DMBoard from './components/DMBoard';
import PlayerBoard from './components/PlayerBoard';
import './App.css';

function Landing() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState('');
  const [password, setPassword] = useState('');
  const [playerPassword, setPlayerPassword] = useState(''); // New distinct player password
  const [mode, setMode] = useState(null); // 'dm' or 'player'

  const handleAction = () => {
    if (!sessionId || !password) return alert('Session ID and Password required!');
    if (mode === 'dm') navigate(`/dm/${sessionId}`, { state: { password, playerPassword } });
    else navigate(`/player/${sessionId}`, { state: { password } });
  };

  if (!mode) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Start your adventure</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button className="btn-primary" onClick={() => setMode('dm')}>Create / Resume Session (DM)</button>
          <button className="btn-primary" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} onClick={() => setMode('player')}>Join as Player</button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel animate-fade" style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>{mode === 'dm' ? 'Host Session' : 'Join Session'}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input 
          placeholder="Session ID (e.g. dragons-lair)" 
          value={sessionId} 
          onChange={e => setSessionId(e.target.value)} 
        />
        
        {mode === 'dm' && (
          <>
            <input 
              placeholder="DM Password (to resume later)" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              type="password"
            />
            <input 
              placeholder="Player Password (leave empty to resume previous)" 
              value={playerPassword} 
              onChange={e => setPlayerPassword(e.target.value)} 
              type="password"
            />
          </>
        )}

        {mode === 'player' && (
          <input 
            placeholder="Player Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            type="password"
          />
        )}
        
        <button className="btn-primary" onClick={handleAction}>
          {mode === 'dm' ? 'Initialize Hub' : 'Connect to Session'}
        </button>
        <button style={{ backgroundColor: 'transparent', color: 'var(--text-secondary)' }} onClick={() => setMode(null)}>
          Back
        </button>
      </div>
    </div>
  );
}

function DMView() {
  const { sessionId } = useParams();
  const location = useLocation();
  const password = location.state?.password || '';
  const playerPassword = location.state?.playerPassword || '';
  
  return <DMBoard sessionId={sessionId} password={password} playerPassword={playerPassword} />;
}

function PlayerView() {
  const { sessionId } = useParams();
  const location = useLocation();
  const password = location.state?.password || '';
  
  return <PlayerBoard sessionId={sessionId} password={password} />;
}

function App() {
  return (
    <SessionProvider>
      <Router>
        <div className="app-container animate-fade">
          <header className="header">
            <h1 className="title">DnD Turn Manager</h1>
            <p className="subtitle">Real-time Initiative & State Sync</p>
          </header>

          <main>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dm/:sessionId" element={<DMView />} />
              <Route path="/player/:sessionId" element={<PlayerView />} />
            </Routes>
          </main>
        </div>
      </Router>
    </SessionProvider>
  );
}

export default App;
