import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, CalendarDays, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react';
import './AccessGate.css';

type AccessStatus = 'loading' | 'ready' | 'login' | 'error';
export default function AccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccessStatus>('loading');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const check = async () => {
    try {
      const response = await fetch('/api/settings', { signal: AbortSignal.timeout(15000) });
      setStatus(response.ok ? 'ready' : response.status === 401 ? 'login' : 'error');
    } catch { setStatus('error'); }
  };
  useEffect(() => { check(); }, []);
  if (status === 'ready') return children;
  return <main className="access-page">
    <div className="access-orbit access-orbit-one" aria-hidden="true" />
    <div className="access-orbit access-orbit-two" aria-hidden="true" />
    <div className="access-layout">
      <header className="access-brand"><span><CalendarDays size={25} strokeWidth={1.7} /></span><strong>HAGENDA</strong></header>
      <section className="access-card" aria-labelledby="access-title">
        <span className="access-lock" aria-hidden="true"><LockKeyhole size={24} strokeWidth={1.7} /></span>
        <p className="access-eyebrow">SUA ROTINA, EM DIA</p>
        <h1 id="access-title">Seu dia começa aqui.</h1>
        {status === 'loading' ? <div className="access-state" role="status"><LoaderCircle className="access-spinner" size={21} /><p>Preparando seu espaço…</p></div> : status === 'error' ? <div className="access-state"><p role="alert">Não foi possível conectar agora.</p><button className="access-submit" onClick={() => { setStatus('loading'); check(); }}>Tentar novamente <ArrowRight size={18} /></button></div> : <>
          <p className="access-description">Digite seu código para acessar a agenda.</p>
          <form className="access-form" onSubmit={async event => {
            event.preventDefault();
            if (busy || !/^\d{4}$/.test(token)) return;
            setBusy(true); setError('');
            try {
              const response = await fetch('/api/session', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
              if (!response.ok) throw new Error(response.status === 401 ? 'Código incorreto. Tente novamente.' : 'Não foi possível entrar agora. Tente novamente.');
              setToken(''); await check();
            } catch (cause) {
              setError(cause instanceof Error && cause.name !== 'TimeoutError' && cause.name !== 'TypeError' ? cause.message : 'Não foi possível conectar. Tente novamente.');
              input.current?.focus(); input.current?.select();
            } finally { setBusy(false); }
          }}>
            <label htmlFor="access-code">Código de acesso</label>
            <div className="access-code-field" data-invalid={!!error}>
              <input ref={input} id="access-code" type={visible ? 'text' : 'password'} inputMode="numeric" autoComplete="current-password" autoCapitalize="none" spellCheck={false} required pattern="[0-9]{4}" minLength={4} maxLength={4} placeholder="••••" value={token} aria-invalid={!!error} aria-describedby={error ? 'access-error' : 'access-hint'} disabled={busy} onChange={event => { setToken(event.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }} />
              <button type="button" aria-label={visible ? 'Ocultar código' : 'Mostrar código'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button>
            </div>
            <p id="access-hint" className="access-hint">Seu código pessoal de 4 dígitos.</p>
            {error && <p id="access-error" className="access-error" role="alert">{error}</p>}
            <button className="access-submit" type="submit" disabled={busy || token.length !== 4} aria-busy={busy}>{busy ? <><LoaderCircle className="access-spinner" size={18} />Entrando…</> : <>Entrar na minha agenda <ArrowRight size={18} /></>}</button>
          </form>
        </>}
      </section>
      <footer className="access-footer">Mais clareza. Mais foco. Mais você.</footer>
    </div>
  </main>;
}
