import type { User } from '@laptop-orchestra/shared';
import type { ConnectionStatus } from '../hooks/useSocket';

interface UserListProps {
  users: User[];
  self: User | null;
  status: ConnectionStatus;
  onLeave: () => void;
}

export function UserList({ users, self, status, onLeave }: UserListProps) {
  return (
    <section style={styles.panel}>
      <p style={styles.wordmark}>Deus Ex Machina</p>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Online ({users.length})</h1>
          <p style={styles.subtitle}>
            <StatusDot status={status} /> {statusLabel(status)}
            {self ? ` — you're "${self.nickname}"` : ''}
          </p>
        </div>
        <button type="button" onClick={onLeave} style={styles.leaveButton}>
          Leave
        </button>
      </header>

      {users.length === 0 ? (
        <p style={styles.empty}>Waiting for the roster…</p>
      ) : (
        <ul style={styles.list}>
          {users.map((user) => {
            const isSelf = user.id === self?.id;
            return (
              <li key={user.id} style={styles.item(isSelf)}>
                <span style={styles.avatar(user.nickname)}>
                  {initials(user.nickname)}
                </span>
                <div style={styles.itemBody}>
                  <span style={styles.nickname}>
                    {user.nickname}
                    {isSelf ? <span style={styles.youTag}>you</span> : null}
                  </span>
                  <span style={styles.joined}>
                    joined {relativeTime(user.joinedAt)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const color =
    status === 'connected'
      ? '#34d399'
      : status === 'connecting'
        ? '#fbbf24'
        : status === 'error'
          ? 'var(--danger)'
          : 'var(--muted)';
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        marginRight: 6,
        verticalAlign: 'middle',
      }}
    />
  );
}

function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting…';
    case 'error':
      return 'Disconnected';
    case 'idle':
      return 'Idle';
  }
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+|[-_]/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeTime(ts: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// Stable hue per nickname for a friendly avatar tint.
function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

const styles = {
  panel: {
    width: 280,
    minHeight: '100vh',
    background: 'var(--bg-elev)',
    borderRight: '1px solid var(--border)',
    padding: '1.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    overflowY: 'auto',
    flexShrink: 0,
  } as React.CSSProperties,
  wordmark: {
    margin: 0,
    paddingBottom: '0.85rem',
    marginBottom: 0,
    borderBottom: '1px solid var(--border)',
    fontFamily: 'var(--font-display)',
    fontSize: '0.68rem',
    fontWeight: 600,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
    lineHeight: 1.45,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: '1.4rem',
    letterSpacing: '-0.01em',
  } as React.CSSProperties,
  subtitle: {
    margin: '0.25rem 0 0',
    color: 'var(--muted)',
    fontSize: '0.9rem',
  } as React.CSSProperties,
  leaveButton: {
    background: 'transparent',
    color: 'var(--muted)',
    border: '1px solid var(--border)',
  } as React.CSSProperties,
  empty: {
    margin: 0,
    color: 'var(--muted)',
  } as React.CSSProperties,
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  } as React.CSSProperties,
  item: (isSelf: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.65rem 0.75rem',
    border: '1px solid',
    borderColor: isSelf ? 'var(--self)' : 'var(--border)',
    borderRadius: '10px',
    background: isSelf ? 'rgba(253, 230, 138, 0.06)' : 'transparent',
  }),
  avatar: (name: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: `hsl(${hue(name)}, 70%, 30%)`,
    color: 'white',
    fontWeight: 700,
    fontSize: '0.85rem',
    flexShrink: 0,
  }),
  itemBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  } as React.CSSProperties,
  nickname: {
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  youTag: {
    marginLeft: 8,
    fontSize: '0.7rem',
    color: 'var(--self)',
    border: '1px solid var(--self)',
    borderRadius: 6,
    padding: '1px 6px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  joined: {
    color: 'var(--muted)',
    fontSize: '0.8rem',
  } as React.CSSProperties,
};
