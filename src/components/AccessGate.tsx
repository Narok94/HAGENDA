import { useEffect, useState, type ReactNode } from 'react';
export default function AccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState('loading');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const check = async () => {
    try { const r = await fetch('/api/settings'); setStatus(r.ok ? 'ready' : r.status === 401 ? 'login' : 'error'); }
    catch { setStatus('error'); }
  };
  useEffect(() => { check(); }, []);
  if (status === 'ready') return children;
  return <main className="min-h-dvh flex items-center justify-center p-6 bg-[#F3F5FA]"><form className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4" onSubmit={async e => {
    e.preventDefault();
    try {
      const r = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      if (!r.ok) throw new Error('Código de acesso inválido');
      setToken(''); await check();
    } catch(e: any) { setError(e.message); }
  }}><h1 className="text-xl font-bold">HAGENDA</h1>
    {status === 'loading' ? <p>Conectando…</p> : status === 'error' ? <><p>Servidor indisponível ou configuração incompleta.</p><button type="button" onClick={check}>Tentar novamente</button></> : <>
      <label className="block">Código de acesso<input className="w-full border rounded-xl p-3" type="password" autoComplete="current-password" required value={token} onChange={e => setToken(e.target.value)} /></label>
      <button className="bg-[#2F5CFF] text-white rounded-xl p-3 w-full" type="submit">Entrar</button><p role="status">{error}</p>
    </>}
  </form></main>;
}
