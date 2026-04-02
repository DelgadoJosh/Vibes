import { useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext';

export default function DMBoard({ sessionId, password, playerPassword }) {
  const { status, errorMsg, sessionState, initHost, updateStateAndBroadcast } = useSession();
  const [newChar, setNewChar] = useState({ name: '', initiative: 0, hp: 0, isNpc: false });

  // Initialize peer server on mount if disconnected
  useEffect(() => {
    if (status === 'disconnected') {
      initHost(sessionId, password, playerPassword);
    }
  }, [initHost, sessionId, password, playerPassword, status]);

  const addCharacter = (e) => {
    e.preventDefault();
    if (!newChar.name) return;
    
    const char = {
      id: crypto.randomUUID(),
      name: newChar.name,
      initiative: Number(newChar.initiative),
      hp: Number(newChar.hp),
      maxHp: Number(newChar.hp),
      type: newChar.isNpc ? 'npc' : 'player',
      isVisible: false, // All newly added characters are hidden by default until specifically revealed
      statusEffects: []
    };

    const updatedCombatants = [...sessionState.combatants, char].sort((a, b) => b.initiative - a.initiative);
    updateStateAndBroadcast({ ...sessionState, combatants: updatedCombatants });
    setNewChar({ name: '', initiative: 0, hp: 0, isNpc: false });
  };

  const toggleVisibility = (id) => {
    const updated = sessionState.combatants.map(c => 
      c.id === id ? { ...c, isVisible: !c.isVisible } : c
    );
    updateStateAndBroadcast({ ...sessionState, combatants: updated });
  };

  const removeCharacter = (id) => {
    const updated = sessionState.combatants.filter(c => c.id !== id);
    updateStateAndBroadcast({ ...sessionState, combatants: updated });
  };

  const nextTurn = () => {
    if (sessionState.combatants.length === 0) return;
    
    let nextIndex = 0;
    if (sessionState.activeTurnId) {
      const currentIndex = sessionState.combatants.findIndex(c => c.id === sessionState.activeTurnId);
      nextIndex = (currentIndex + 1) % sessionState.combatants.length;
    }
    
    // If we wrap around to 0, increment round
    const nextRound = (sessionState.activeTurnId && nextIndex === 0) 
      ? sessionState.round + 1 
      : sessionState.round;

    updateStateAndBroadcast({ 
      ...sessionState, 
      activeTurnId: sessionState.combatants[nextIndex].id,
      round: nextRound
    });
  };

  if (status === 'connecting') return <div className="glass-panel" style={{ padding: '2rem' }}>Initializing DM Session on PeerJS...</div>;
  if (status === 'error') {
    return (
      <div className="glass-panel animate-fade" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger-color)', maxWidth: '500px', margin: '2rem auto' }}>
        <h3 style={{ marginBottom: '1rem' }}>Connection Error</h3>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>{errorMsg}</p>
        <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {errorMsg.includes('is taken') && "It looks like someone else is already using this Session ID on the public PeerJS server. Please try a different one!"}
        </p>
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
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>DM Dashboard</h2>
          <p style={{ color: 'var(--success-color)', fontSize: '0.9rem' }}>● Broadcaster Active (Session: {sessionId})</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Round {sessionState.round}</div>
          <button className="btn-primary" style={{ marginTop: '0.5rem' }} onClick={nextTurn}>Next Turn</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
        {/* Controls Column */}
        <div className="glass-panel" style={{ padding: '1.5rem', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '1rem' }}>Add Combatant</h3>
          <form onSubmit={addCharacter} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input placeholder="Name" value={newChar.name} onChange={e => setNewChar({...newChar, name: e.target.value})} required />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input style={{ flex: 1 }} type="number" placeholder="Initiative" value={newChar.initiative || ''} onChange={e => setNewChar({...newChar, initiative: e.target.value})} />
              <input style={{ flex: 1 }} type="number" placeholder="HP" value={newChar.hp || ''} onChange={e => setNewChar({...newChar, hp: e.target.value})} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={newChar.isNpc} onChange={e => setNewChar({...newChar, isNpc: e.target.checked})} />
              Is NPC (Monster)
            </label>
            <button className="btn-primary" type="submit">Add to Tracker</button>
          </form>
        </div>

        {/* Initiative List Column */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Initiative Order</h3>
          {sessionState.combatants.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No combatants added yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sessionState.combatants.map(char => {
                const isActive = char.id === sessionState.activeTurnId;
                return (
                  <div key={char.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '1rem',
                    background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isActive ? 'var(--accent-color)' : 'var(--border-subtle)'}`,
                    borderRadius: '8px',
                    gap: '1rem'
                  }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', width: '40px', textAlign: 'center', color: 'var(--accent-color)' }}>
                      {char.initiative}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: char.type === 'npc' ? 'var(--danger-color)' : 'var(--text-primary)' }}>
                        {char.name} {char.type === 'npc' && '(NPC)'}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        HP: {char.hp} / {char.maxHp}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => toggleVisibility(char.id)}
                        style={{ background: 'rgba(255, 255, 255, 0.1)', color: char.isVisible ? 'var(--success-color)' : 'var(--text-secondary)' }}
                      >
                        {char.isVisible ? 'Visible' : 'Hidden'}
                      </button>
                      <button 
                        onClick={() => removeCharacter(char.id)}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)' }}
                      >
                        X
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
