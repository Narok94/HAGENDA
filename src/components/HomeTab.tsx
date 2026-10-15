import { ArrowRight, CalendarDays, CheckCheck, Clock3, ListTodo } from 'lucide-react';
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
}

export default function HomeTab({ userName, avatarUrl, now, tasks, onTasks, onSettings }: HomeTabProps) {
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
  const progress = ordered.length ? Math.round(completed / ordered.length * 100) : 0;

  return (
    <div className="home-page">
      <header className="home-header">
        <div><h1><span>{greeting},</span><span>{userName}<span className="home-wave" aria-hidden="true">👋🏻</span></span></h1><p>{now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
        <button className="home-avatar" aria-label="Abrir perfil e configurações" onClick={onSettings}>
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{userName.trim().slice(0, 2).toUpperCase()}</span>}
        </button>
      </header>

      <section className="home-banner">
        <h2>Um dia organizado<br />começa agora.</h2>
        <p>Foque no que importa.</p>
        <button onClick={onTasks}>Organizar meu dia <ArrowRight size={16} /></button>
      </section>

      <section className="home-day-summary" aria-label="Resumo de hoje" aria-busy={tasks === null}>
        <div className="home-section-heading"><h2>Seu dia em resumo</h2><span>Hoje</span></div>
        {tasks === null ? <p className="home-loading" role="status">Carregando suas atividades…</p> : <>
          <div className="home-metrics">
            <div><span><ListTodo size={15} />{ordered.length}</span><small>Atividades</small></div>
            <div><span><Clock3 size={15} />{pending}</span><small>Pendentes</small></div>
            <div><span><CheckCheck size={15} />{completed}</span><small>Concluídas</small></div>
          </div>
          <div className="home-progress-label"><span>Progresso do dia</span><strong>{progress}%</strong></div>
          <div className="home-progress" role="progressbar" aria-label="Progresso do dia" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
        </>}
      </section>

      <section className="home-next" aria-label="Próxima atividade">
        <div className="home-next-label"><CalendarDays size={15} /><h2>PRÓXIMA ATIVIDADE</h2></div>
        {tasks === null ? <p className="home-loading" role="status">Carregando…</p> : nextTask ? <button className="home-next-event" onClick={onTasks}>
          <span className="home-next-time">{nextTask.time}</span><span className="home-event-dot is-next" />
          <span className="home-event-copy"><strong>{nextTask.title}</strong><small>{nextTask.category}{recurrenceText(nextTask)}</small></span>
          <span className="home-next-arrow"><ArrowRight size={19} /></span>
        </button> : <p className="home-empty">{pending ? 'Nenhuma atividade futura com horário definido.' : ordered.length ? 'Tudo concluído por hoje.' : 'Seu dia está livre.'}</p>}
      </section>

      <section className="home-upcoming" aria-label="A seguir">
        <div className="home-section-heading"><h2>A seguir</h2><button onClick={onTasks}>Ver tarefas <ArrowRight size={13} /></button></div>
        {tasks !== null && (upcoming.length > 1 ? upcoming.slice(1, 3).map(task => <button className="home-event" key={task.id} onClick={onTasks}>
          <span className="home-event-time">{task.time}<span className="home-event-dot" /></span>
          <span className="home-event-copy"><strong>{task.title}</strong><small>{task.category}{recurrenceText(task)}</small></span>
          <ArrowRight size={15} />
        </button>) : <p className="home-empty">Nenhuma outra atividade futura com horário definido.</p>)}
      </section>
      {late > 0 && <button className="home-late" onClick={onTasks}><Clock3 size={15} />{late} {late === 1 ? 'atividade com horário passado' : 'atividades com horário passado'}<ArrowRight size={15} /></button>}

    </div>
  );
}
