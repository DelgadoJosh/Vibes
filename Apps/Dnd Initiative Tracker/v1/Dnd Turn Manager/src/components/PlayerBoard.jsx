import { useEffect } from 'react';
import { useSession } from '../context/SessionContext';

export default function PlayerBoard({ sessionId, password }) {
  const { status, errorMsg, sessionState, initClient } = useSession();

  // Initialize client peer on mount if disconnected
  useEffect(() => {
    if (status === 'disconnected') {
      initClient(sessionId, password);
    }
  }, [initClient, sessionId, password, status]);

  if (status === 'connecting') return <div className="glass-panel" style={{ padding: '2rem' }}>Connecting to DM Session...</div>;
  if (status === 'error') {
    return (
      <div className="glass-panel animate-fade" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger-color)', maxWidth: '500px', margin: '2rem auto' }}>
        <h3 style={{ marginBottom: '1rem' }}>Connection Error</h3>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>{errorMsg}</p>
        <button 
          onClick={() => window.location.href = '/'}
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
        >
          Go Back and Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Player View</h2>
          <p style={{ color: 'var(--success-color)', fontSize: '0.9rem' }}>● Connected to Session</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Round {sessionState.round}</div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Initiative Tracker</h3>
        {sessionState.combatants.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Waiting for DM to add combatants...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sessionState.combatants.map(char => {
              const isActive = char.id === sessionState.activeTurnId;
              return (
                <div key={char.id} className="animate-fade" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '1rem',
                  background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${isActive ? 'var(--accent-color)' : 'var(--border-subtle)'}`,
                  borderRadius: '8px',
                  gap: '1rem',
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', width: '40px', textAlign: 'center', color: 'var(--accent-color)' }}>
                    {char.initiative}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: char.type === 'npc' ? 'var(--danger-color)' : 'var(--text-primary)' }}>
                      {char.name}
                    </div>
                  </div>
                  {isActive && <div style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>Active Turn</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
