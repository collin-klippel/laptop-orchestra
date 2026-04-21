import { MAX_NICKNAME_LENGTH } from '@laptop-orchestra/shared';
import { type FormEvent, useEffect, useState } from 'react';
import * as Tone from 'tone';
import { NICKNAME_STORAGE_KEY as STORAGE_KEY } from '../hooks/useSocket';

interface SignInProps {
  onSubmit: (nickname: string) => void;
  disabled?: boolean;
  error?: string | null;
}

export function SignIn({ onSubmit, disabled, error }: SignInProps) {
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setNickname(saved);
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) return;
    window.localStorage.setItem(STORAGE_KEY, trimmed);
    void Tone.start();
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="sign-in-form" style={styles.form}>
      <h1 className="sign-in-title" style={styles.title}>
        Deus Ex Machina
      </h1>
      <h2 className="sign-in-tagline" style={styles.tagline}>
        A collaborative electronic music performance.
      </h2>
      <div className="poem-verse" style={styles.poem}>
        <p style={styles.poemLine}>世界に薄い膜が降り積もる</p>
        <p style={styles.poemLine}>かつての境目は溶けて消える</p>
        <p style={styles.poemLine}>空の重さを誰も知らない</p>
      </div>
      <label style={styles.label} htmlFor="nickname">
        Name
      </label>
      <input
        id="nickname"
        autoFocus
        value={nickname}
        onChange={(e) =>
          setNickname(e.target.value.slice(0, MAX_NICKNAME_LENGTH))
        }
        maxLength={MAX_NICKNAME_LENGTH}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || nickname.trim().length === 0}>
        {disabled ? 'Joining…' : 'Join'}
      </button>
      {error ? <p style={styles.error}>{error}</p> : null}
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    width: 'min(420px, 100%)',
    background: 'var(--bg-elev)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '2rem',
  },
  title: {
    margin: 0,
  },
  tagline: {
    marginTop: '-0.2rem',
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
  },
  poem: {
    margin: '1.5rem auto',
    paddingBottom: '1rem',
    writingMode: 'vertical-rl' as const,
    textOrientation: 'upright' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    minHeight: '8rem',
  },
  poemLine: {
    margin: 0,
    fontSize: '1rem',
    fontFamily: 'var(--font-display)',
    color: 'var(--text)',
    opacity: 0.65,
    lineHeight: 1.8,
    letterSpacing: '0.06em',
  },
  subtitle: {
    margin: '0 0 0.5rem 0',
    color: 'var(--muted)',
    lineHeight: 1.5,
  },
  label: {
    fontSize: '0.85rem',
    color: 'var(--muted)',
  },
  roleHint: {
    margin: 0,
    fontSize: '0.85rem',
    color: 'var(--muted)',
    lineHeight: 1.45,
  },
  error: {
    margin: 0,
    color: 'var(--danger)',
    fontSize: '0.9rem',
  },
};
