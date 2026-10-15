import { ArrowRight, CalendarDays, Check, CheckCheck, Clock3, ListTodo, MoreHorizontal, Plus, Sparkles } from 'lucide-react';
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

export default function HomeTab({ userName, avatarUrl, now, tasks, onNewTask, onTasks, onCalendar, onMore, onSettings }: HomeTabProps) {
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isTimed = (task: Task) => /^\d{2}:\d{2}$/.test(task.time);
  const ordered = [...(tasks || [])].sort((a, b) => Number(!isTimed(a)) - Number(!isTimed(b)) || a.time.localeCompare(b.time));
  const completed = ordered.filter(task => task.completed).length;
  const late = ordered.filter(task => !task.completed && isTimed(task) && task.time < time).length;
  const pending = ordered.length - completed;
  const upcoming = ordered.filter(task => !task.completed && (!isTimed(task) || task.time >= time));
  const progress = ordered.length ? Math.round(completed / ordered.length * 100) : 0;

  return (
    <div className="home-page">
      <header className="home-header">
        <div><p>{now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>{greeting}, {userName}<span className="home-greeting-dot" /></h1></div>
        <button className="home-avatar" aria-label="Abrir perfil e configurações" onClick={onSettings}>
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{userName.trim().slice(0, 2).toUpperCase()}</span>}
        </button>
      </header>

      <section className="home-banner">
        <div className="home-banner-eyebrow"><Sparkles size={14} /><span>UM NOVO DIA, NOVAS POSSIBILIDADES</span></div>
        <h2>Seu dia, um passo<br />de cada vez.</h2>
        <p>Cuide do que importa.<br />O próximo passo começa aqui.</p>
        <button onClick={onTasks}>Organizar meu dia <ArrowRight size={16} /></button>
        <div className="home-banner-art" aria-hidden="true"><Check size={30} /><span /><span /></div>
      </section>

      <section aria-label="Atalhos" className="home-shortcuts">
        {[{ label: 'Nova tarefa', Icon: Plus, action: onNewTask }, { label: 'Calendário', Icon: CalendarDays, action: onCalendar }, { label: 'Tarefas', Icon: ListTodo, action: onTasks }, { label: 'Mais', Icon: MoreHorizontal, action: onMore }].map(({ label, Icon, action }) => (
          <button key={label} onClick={action}><span><Icon size={21} strokeWidth={1.7} /></span>{label}</button>
        ))}
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

      <section className="home-upcoming" aria-label="Compromissos de hoje">
        <div className="home-section-heading"><h2>A seguir no seu dia</h2><button onClick={onTasks}>Ver tarefas <ArrowRight size={13} /></button></div>
        {tasks !== null && (upcoming.length ? upcoming.slice(0, 3).map((task, index) => <button className="home-event" key={task.id} onClick={onTasks}>
          <span className="home-event-time">{isTimed(task) ? task.time : 'Livre'}<span className={index === 0 ? 'home-event-dot is-next' : 'home-event-dot'} /></span>
          <span className="home-event-copy"><strong>{task.title}</strong><small>{task.category}{task.recurrence && task.recurrence !== 'none' ? ' · Recorrente' : ''}</small></span>
          <ArrowRight size={15} />
        </button>) : <p className="home-empty">{pending ? 'Nenhum compromisso futuro com horário definido.' : ordered.length ? 'Tudo concluído por hoje. Aproveite a pausa.' : 'Seu dia está livre. Adicione sua primeira tarefa.'}</p>)}
        {late > 0 && <button className="home-late" onClick={onTasks}><Clock3 size={13} />{late} {late === 1 ? 'atividade com horário passado' : 'atividades com horário passado'}<ArrowRight size={13} /></button>}
      </section>
    </div>
  );
}
