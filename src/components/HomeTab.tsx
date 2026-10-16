import { ArrowRight, CalendarCheck2, Check, Clock3, RefreshCw, Tag } from 'lucide-react';
import { Task } from '../types';

interface HomeTabProps {
  userName: string;
  avatarUrl: string | null;
  now: Date;
  tasks: Task[] | null;
  onNewTask: () => void;
  onTasks: () => void;
  onCalendar: () => void;
  onMore: () => void;
  onSettings: () => void;
  onCompleteTask: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
}

export default function HomeTab({ userName, avatarUrl, now, tasks, onTasks, onSettings, onCompleteTask, onOpenTask }: HomeTabProps) {
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isTimed = (task: Task) => /^\d{2}:\d{2}$/.test(task.time);
  const ordered = [...(tasks || [])].sort((a, b) => Number(!isTimed(a)) - Number(!isTimed(b)) || a.time.localeCompare(b.time));
  const completed = ordered.filter(task => task.completed).length;
  const late = ordered.filter(task => !task.completed && isTimed(task) && task.time < time).length;
  const pending = ordered.length - completed;
  const upcoming = ordered.filter(task => !task.completed && isTimed(task) && task.time >= time);
  const nextTask = upcoming[0];
  const recurrenceText = (task: Task) => ((task.recurrence && task.recurrence !== 'none') || task.id.startsWith('diet_') || task.id === 'study_daily_summary') ? ' · Recorrente' : '';


  return (
    <div className="home-page">
      <header className="home-header">
        <div><h1><span>{greeting},</span><span>{userName}<span className="home-wave" aria-hidden="true">👋🏻</span></span></h1><p>{now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
        <button className="home-avatar" aria-label="Abrir perfil e configurações" onClick={onSettings}>
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{userName.trim().slice(0, 2).toUpperCase()}</span>}
        </button>
      </header>

      <section className="home-feature" aria-label="Próxima tarefa" aria-busy={tasks === null}>
        <div className="home-feature-label"><span><span className="home-feature-status" />PRÓXIMA TAREFA</span><CalendarCheck2 size={18} /></div>
        {tasks === null ? <p className="home-feature-empty" role="status">Carregando suas atividades…</p> : nextTask ? <>
          <button className="home-feature-title" onClick={() => onOpenTask(nextTask.id)}><h2>{nextTask.title}</h2></button>
          <div className="home-feature-meta"><span><Clock3 size={13} />{nextTask.time}</span><span><Tag size={13} />{nextTask.category}</span>{recurrenceText(nextTask) && <span><RefreshCw size={12} />Recorrente</span>}</div>
          <div className="home-feature-footer"><span>Um passo de cada vez.</span><button className="home-feature-complete" onClick={() => onCompleteTask(nextTask.id)} aria-label={`Concluir ${nextTask.title}`}><Check size={16} strokeWidth={2.5} />Concluir tarefa</button></div>
        </> : <div className="home-feature-empty"><h2>{pending ? 'Nenhuma atividade futura com horário definido.' : ordered.length ? 'Tudo concluído por hoje.' : 'Seu dia está livre.'}</h2><button onClick={onTasks}>Ver minhas tarefas <ArrowRight size={15} /></button></div>}
      </section>

      <section className="home-upcoming" aria-label="A seguir no seu dia">
        <div className="home-section-heading"><h2>A seguir no seu dia</h2><button onClick={onTasks}>Ver todas <ArrowRight size={13} /></button></div>
        {tasks !== null && (upcoming.length > 1 ? upcoming.slice(1, 4).map(task => <button className="home-event" key={task.id} onClick={() => onOpenTask(task.id)}>
          <span className="home-event-time">{task.time}<span className="home-event-dot" /></span>
          <span className="home-event-copy"><strong>{task.title}</strong><small>{task.category}{recurrenceText(task)}</small></span>
          <ArrowRight size={15} />
        </button>) : <p className="home-empty">Nenhuma outra atividade futura com horário definido.</p>)}
      </section>
      {late > 0 && <button className="home-late" onClick={onTasks}><Clock3 size={15} />{late} {late === 1 ? 'atividade atrasada' : 'atividades atrasadas'} · Revisar<ArrowRight size={15} /></button>}

    </div>
  );
}
