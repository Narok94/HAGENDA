import { useState } from 'react';
export default function ReminderAction() {
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('reminderToken'));
  const [open, setOpen] = useState(!!token);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const dismiss = () => { history.replaceState(null, '', location.pathname + location.search); setOpen(false); };
  if (!open) return null;
  const act = async (action: string) => {
    setBusy(true);
    try {
      const r = await fetch('/api/reminder-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, token }) });
      if (!r.ok) throw new Error(r.status === 410 || r.status === 401 ? 'Lembrete expirado ou alterado. Abra a atividade.' : 'Não foi possível salvar. Verifique sua conexão e tente novamente.');
      history.replaceState(null, '', location.pathname + location.search); location.reload();
    } catch(e: any) { setStatus(e.message); } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-5"><section role="dialog" aria-modal="true" aria-label="Ações do lembrete" className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4">
    <h2 className="font-bold">Lembrete da atividade</h2><p className="text-sm">Ocorrência de {new URLSearchParams(location.search).get('date')?.split('-').reverse().join('/')}</p>
    <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={() => act('confirm')} className="rounded-xl bg-[#2F5CFF] text-white p-3">Confirmar</button><button disabled={busy} onClick={() => act('snooze')} className="rounded-xl bg-[#F3F5FA] p-3">Adiar</button><button disabled={busy} onClick={dismiss} className="p-3">Abrir atividade</button></div>
    <p role="status" className="text-sm">{status}</p>
  </section></div>;
}
