import type { KeySetting, PerformanceState } from '@laptop-orchestra/shared';
import type React from 'react';
import { createContext, useEffect, useRef } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom';
import { ConductorControls } from './components/ConductorControls';
import { MarimbaView } from './components/MarimbaView';
import { SignIn } from './components/SignIn';
import { TransportDisplay } from './components/TransportDisplay';
import { UserList } from './components/UserList';
import { usePerformanceTransport } from './hooks/usePerformanceTransport';
import { useSocket } from './hooks/useSocket';
import { radius, spacing } from './theme';

interface PerformanceContextValue {
  performanceState: PerformanceState;
  conductorBpm: number | null;
  conductorKey: KeySetting | null;
  /** True when at least one conductor is in the roster. */
  hasConductor: boolean;
  setTempo: (bpm: number) => void;
  setKey: (key: KeySetting) => void;
  startPerformance: () => void;
  stopPerformance: () => void;
}

export const PerformanceContext = createContext<PerformanceContextValue>({
  performanceState: { active: false },
  conductorBpm: null,
  conductorKey: null,
  hasConductor: false,
  setTempo: () => {},
  setKey: () => {},
  startPerformance: () => {},
  stopPerformance: () => {},
});

function Reconnecting({ centered }: { centered?: boolean }) {
  const wrap = centered ? styles.centered : undefined;
  return (
    <div style={wrap}>
      <div style={styles.reconnectingContainer}>
        <p style={styles.reconnectingText}>Reconnecting…</p>
      </div>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const location = useLocation();
  const pathname = location.pathname;

  const {
    status,
    error,
    self,
    users,
    conductorBpm,
    conductorKey,
    performanceState,
    serverClockOffsetMs,
    connect,
    disconnect,
    setTempo,
    setKey,
    startPerformance,
    stopPerformance,
  } = useSocket();

  /** Push when user submits SignIn form; replace for implicit join (auto-connect). */
  const joinNavModeRef = useRef<'push' | 'replace'>('replace');
  const prevPathRef = useRef<string | null>(null);
  /** After `/room` → `/` via browser Back (POP): block stale `signedIn` from bouncing to `/room`. */
  const skipLobbyToRoomRedirectRef = useRef(false);
  /** Explicit Leave: block stale `signedIn` until disconnect completes (REPLACE to `/`). */
  const leavingRoomRef = useRef(false);

  usePerformanceTransport(performanceState, conductorBpm, serverClockOffsetMs);

  const signedIn = status === 'connected' && self !== null;

  useEffect(() => {
    if (!signedIn) {
      skipLobbyToRoomRedirectRef.current = false;
      leavingRoomRef.current = false;
    }
  }, [signedIn]);

  /** `/room` → `/` leaves the socket session; POP (Back) also arms skip until disconnected. */
  useEffect(() => {
    const prev = prevPathRef.current;
    if (prev === '/room' && pathname === '/') {
      if (navigationType === 'POP') {
        skipLobbyToRoomRedirectRef.current = true;
      }
      disconnect();
    }
    prevPathRef.current = pathname;
  }, [pathname, disconnect, navigationType]);

  /** Connected while still at `/`: enter `/room` with push (form join) or replace (auto-connect). */
  useEffect(() => {
    if (!signedIn || pathname !== '/') return;
    if (leavingRoomRef.current) return;
    if (skipLobbyToRoomRedirectRef.current) return;
    navigate('/room', { replace: joinNavModeRef.current === 'replace' });
    joinNavModeRef.current = 'replace';
  }, [signedIn, pathname, navigate]);

  function leaveRoom() {
    leavingRoomRef.current = true;
    disconnect();
    navigate('/', { replace: true });
  }

  const hasConductor = users.some((u) => u.role === 'conductor');

  return (
    <Routes>
      <Route
        path="/"
        element={
          status === 'connecting' ? (
            <Reconnecting centered />
          ) : signedIn ? (
            <div style={styles.centered} aria-hidden />
          ) : (
            <div style={styles.centered}>
              <SignIn
                onSubmit={(nickname) => {
                  joinNavModeRef.current = 'push';
                  connect(nickname);
                }}
                disabled={false}
                error={error}
              />
            </div>
          )
        }
      />
      <Route
        path="/room"
        element={
          status === 'connecting' ? (
            <Reconnecting />
          ) : signedIn ? (
            <PerformanceContext.Provider
              value={{
                performanceState,
                conductorBpm,
                conductorKey,
                hasConductor,
                setTempo,
                setKey,
                startPerformance,
                stopPerformance,
              }}
            >
              <div style={styles.app}>
                <UserList
                  users={users}
                  self={self}
                  status={status}
                  onLeave={leaveRoom}
                />
                <main style={styles.main}>
                  <TransportDisplay />
                  <MarimbaView />
                </main>
                {self.role === 'conductor' && (
                  <ConductorControls
                    performanceState={performanceState}
                    conductorBpm={conductorBpm}
                    conductorKey={conductorKey}
                    onSetTempo={setTempo}
                    onSetKey={setKey}
                    onStartPerformance={startPerformance}
                    onStopPerformance={stopPerformance}
                  />
                )}
              </div>
            </PerformanceContext.Provider>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </Routes>
  );
}

const styles: Record<string, React.CSSProperties> = {
  centered: {
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1.25rem',
  },
  app: {
    display: 'flex',
    flex: 1,
    minHeight: '100vh',
    width: '100%',
    minWidth: 0,
  },
  main: {
    flex: '1 1 0%',
    minWidth: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  reconnectingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'min(420px, 100%)',
    background: 'var(--bg-elev)',
    border: '1px solid var(--border)',
    borderRadius: radius['2xl'],
    padding: spacing['8xl'],
    gap: spacing.xxl,
  },
  reconnectingText: {
    margin: 0,
    color: 'var(--muted)',
    fontSize: '1rem',
  },
};
