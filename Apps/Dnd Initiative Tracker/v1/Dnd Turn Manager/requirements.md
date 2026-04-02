# DnD 5e Turn Manager - Requirements Document

## 1. Overview
A web application (potentially a Progressive Web App - PWA) designed to manage turn order (initiative) for Dungeons & Dragons 5e sessions. It provides synchronized, role-based views for both the Dungeon Master (DM) and the players.

## 2. Core Features

### 2.1 Session Management
- **Shared Sessions:** DMs and players can join the same realtime "session" (likely via a unique room code or link).
- **DM Authentication:** The DM view is password-protected to prevent players from accessing hidden session data or DM controls.
- **Player Authentication:** Players must enter a session password (provided verbally by the DM) to join the session. This acts as a safeguard against anyone finding leaked room URLs.

### 2.2 Dungeon Master (DM) View
- **Full Initiative Board:** Can view both player and NPC/monster turn orders.
- **Initiative & Data Entry:** DM handles all input for initiative rolls to prevent players from tampering with values.
- **Visibility Toggles:** Can toggle individual NPCs/monsters to be visible or hidden from the players' view (allows monsters to lie in wait or remain undiscovered).
- **Advanced Tracking:** Option to track HP and Status Effects (e.g., Poisoned, Prone) for characters and monsters. **These details are strictly hidden from the players.**
- **Turn Control:** Can advance the turn order (next turn, previous turn, round counter).

### 2.3 Player View
- **Limited Initiative Board:** Can only see players and the specific NPCs/monsters that the DM has toggled as visible.
- **Read-Only:** Cannot edit initiative values, advance the turn order, or see HP/Status effects.
- **Real-time Updates:** Automatically updates as the DM makes changes or advances turns.

## 3. Technical Considerations & Architecture
- **Hosting:** Free static hosting (e.g., GitHub Pages, Vercel, Netlify). The source code can be public without risk.
- **Backend / Real-Time Sync Approach:** 
  - *Proposed Solution:* **WebRTC (via PeerJS)**. This allows the application to be a purely static site with **zero backend server costs** and **zero database API keys to protect**. The DM's browser acts as the "host" server, and player browsers connect directly to the DM peer-to-peer. Session data only exists while the DM's tab is open (though the DM can export/save it locally).
  - *Alternative:* A free tier BaaS like Firebase or Supabase, secured by Row Level Security (RLS) to ensure data can only be accessed with the correct session password.
- **Web App / PWA:** Accessible via mobile and desktop browsers, with potential offline/app-like capabilities.
