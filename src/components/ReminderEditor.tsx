import { useEffect, useState } from 'react';
export interface ReminderConfig {
  mode: 'none' | 'simple' | 'persistent';
  leadMinutes: number; intervalMinutes: number; snoozeMinutes: number; time?: string;
}
export const defaultReminder: ReminderConfig = { mode: 'none', leadMinutes: 15, intervalMinutes: 15, snoozeMinutes: 10 };
export async function saveReminder(id: string, config: ReminderConfig) {
  const r = await fetch(`/api/reminders/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
  if (!r.ok) throw new Error((await r.json()).error || 'Falha ao salvar alerta');
}
export default function ReminderEditor({ id, time, onChange }: { id?: string; time?: string; onChange?: (config: ReminderConfig) => void }) {
  const [config, setConfig] = useState(defaultReminder);
  const [status, setStatus] = useState('');
  const [ready, setReady] = useState(!id);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!id) return;
    let active = true;
    fetch('/api/reminders').then(async r => { if (!r.ok) throw new Error('Alertas indisponíveis; verifique Neon'); return r.json(); }).then(data => {
      if (!active) return;
      const value = data.configs[id] || defaultReminder;
      setConfig(value); onChange?.(value); setReady(true);
    }).catch(e => { if (active) setStatus(e.message); });
    return () => { active = false; };
  }, [id]);
  const change = (patch: Partial<ReminderConfig>) => { const value = { ...config, ...patch }; setConfig(value); onChange?.(value); setStatus(''); };
  const field = 'w-full min-w-0 rounded-xl border border-[#E3E8F1] bg-white p-2 text-sm';
  return <fieldset disabled={!ready || busy} className="rounded-2xl border border-[#E3E8F1] bg-[#F3F5FA] p-4 space-y-3">
    <legend className="text-xs font-semibold text-[#69708A] px-1">Lembrete desta atividade</legend>
    <label className="block text-xs">Tipo de alerta<select className={field} value={config.mode} onChange={e => change({ mode: e.target.value as ReminderConfig['mode'] })}>
      <option value="none">Sem alerta</option><option value="simple">Alerta simples</option><option value="persistent">Repetir até confirmação</option>
    </select></label>
    {config.mode !== 'none' && <>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs">Primeiro aviso (min antes)<input className={field} type="number" min="0" max="1440" value={config.leadMinutes} onChange={e => change({ leadMinutes: Number(e.target.value) })} /></label>
        <label className="text-xs">Adiar por (min)<input className={field} type="number" min="1" max="1440" value={config.snoozeMinutes} onChange={e => change({ snoozeMinutes: Number(e.target.value) })} /></label>
      </div>
      {config.mode === 'persistent' && <div className="grid grid-cols-2 gap-3">
        <label className="text-xs">Repetir a cada<select className={field} value={[5,10,15,30].includes(config.intervalMinutes) ? config.intervalMinutes : 'custom'} onChange={e => change({ intervalMinutes: e.target.value === 'custom' ? 20 : Number(e.target.value) })}>
          {[5,10,15,30].map(n => <option key={n} value={n}>{n} minutos</option>)}<option value="custom">Personalizado</option>
        </select></label>
        <label className="text-xs">Intervalo (min)<input className={field} type="number" min="1" max="1440" value={config.intervalMinutes} onChange={e => change({ intervalMinutes: Number(e.target.value) })} /></label>
      </div>}
      <label className="block text-xs">Horário (São Paulo)<input className={field} type="time" value={config.time || (/^\d{2}:\d{2}$/.test(time || '') ? time : '')} onChange={e => change({ time: e.target.value || undefined })} /></label>
      <p className="text-xs text-[#69708A]">A entrega depende do sistema. No iPhone, instale na Tela de Início e permita notificações. Se os botões não aparecerem, abra o lembrete para confirmar ou adiar.</p>
    </>}
    {id && <button type="button" className="text-sm font-semibold text-[#2F5CFF] min-h-11" onClick={async () => {
      setBusy(true); try { await saveReminder(id, config); setStatus('Alerta salvo'); } catch(e: any) { setStatus(e.message); } finally { setBusy(false); }
    }}>{busy ? 'Salvando…' : 'Salvar alerta'}</button>}
    {status && <p role="status" className="text-xs">{status}</p>}
  </fieldset>;
}
