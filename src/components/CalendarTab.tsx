import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock3, Plus, RefreshCw } from 'lucide-react';
import { Task } from '../types';
import { formatDateLocal, isTaskCompletedOnDate, isTaskOnDate } from '../utils/taskDates';

interface CalendarTabProps {
  tasks: Task[] | null;
  now: Date;
  onOpenTask: (taskId: string, date: string) => void;
  onToggleTask: (taskId: string, date: string) => void;
  onCreateTask: (date: string) => void;
}

export default function CalendarTab({ tasks, now, onOpenTask, onToggleTask, onCreateTask }: CalendarTabProps) {
  const today = formatDateLocal(now);
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  const dates = Array.from({ length: cellCount }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - first.getDay() + 1));
  const dayTasks = (tasks || []).filter(task => isTaskOnDate(task, selectedDate)).sort((a, b) => {
    const timed = (task: Task) => /^\d{2}:\d{2}$/.test(task.time);
    return Number(!timed(a)) - Number(!timed(b)) || a.time.localeCompare(b.time);
  });
  const completedCount = dayTasks.filter(task => isTaskCompletedOnDate(task, selectedDate)).length;
  const selected = new Date(`${selectedDate}T12:00:00`);
  const moveMonth = (direction: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + direction, 1);
    setMonth(next);
    setSelectedDate(formatDateLocal(next));
  };
  const selectDay = (date: Date) => {
    setSelectedDate(formatDateLocal(date));
    if (date.getMonth() !== month.getMonth()) setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  return (
    <section className="calendar-page">
      <header className="calendar-header"><div><p>SEU TEMPO, EM PERSPECTIVA</p><h1>Calendário</h1></div></header>
      <section className="calendar-month" aria-label="Calendário mensal">
        <div className="calendar-month-heading">
          <h2 aria-live="polite">{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
          <div><button className="calendar-today" onClick={() => { setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(today); }}>Hoje</button><button aria-label="Mês anterior" onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button><button aria-label="Próximo mês" onClick={() => moveMonth(1)}><ChevronRight size={18} /></button></div>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => <span key={index}>{day}</span>)}</div>
        <div className="calendar-grid" role="group" aria-label="Dias do mês">
          {dates.map(date => {
            const key = formatDateLocal(date);
            const count = (tasks || []).filter(task => isTaskOnDate(task, key)).length;
            return <button key={key} className={`${date.getMonth() !== month.getMonth() ? 'is-outside' : ''} ${key === today ? 'is-today' : ''}`} aria-label={`${date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}${tasks === null ? ', carregando atividades' : `, ${count} atividades`}`} aria-pressed={key === selectedDate} aria-current={key === today ? 'date' : undefined} onClick={() => selectDay(date)}><span>{date.getDate()}</span><span className="calendar-day-dot" data-has-tasks={count > 0} /></button>;
          })}
        </div>
        <p className="calendar-legend"><span /> Dia com atividades</p>
      </section>
      <section className="calendar-day" aria-label="Atividades da data selecionada">
        <div className="calendar-day-heading"><div><h2>{selected.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>{tasks !== null && <p>{dayTasks.length} {dayTasks.length === 1 ? 'atividade' : 'atividades'} · {completedCount} concluídas</p>}</div><button className="calendar-create" aria-label="Adicionar tarefa nesta data" onClick={() => onCreateTask(selectedDate)}><Plus size={19} /></button></div>
        {tasks === null ? <p className="calendar-empty" role="status">Carregando atividades…</p> : dayTasks.length === 0 ? <div className="calendar-empty"><p>Nenhuma tarefa para esta data.</p><button onClick={() => onCreateTask(selectedDate)}>Adicionar tarefa <Plus size={15} /></button></div> : <div className="calendar-day-list">
          {dayTasks.map(task => {
            const completed = isTaskCompletedOnDate(task, selectedDate);
            return <div className={`calendar-task ${completed ? 'is-complete' : ''}`} key={`${task.id}-${selectedDate}`}>
              <button role="checkbox" aria-checked={completed} aria-label={`${completed ? 'Reabrir' : 'Concluir'} ${task.title}`} onClick={() => onToggleTask(task.id, selectedDate)}>{completed && <Check size={13} strokeWidth={3} />}</button>
              <button className="calendar-task-copy" aria-label={`Detalhes de ${task.title}`} onClick={() => onOpenTask(task.id, selectedDate)}><strong>{task.title}</strong><span><Clock3 size={11} />{task.time}<span className="calendar-category">{task.category}</span>{task.recurrence && task.recurrence !== 'none' && <RefreshCw size={11} aria-label="Recorrente" />}</span></button>
              <button className="calendar-task-details" aria-label={`Abrir ${task.title}`} onClick={() => onOpenTask(task.id, selectedDate)}><ChevronRight size={17} /></button>
            </div>;
          })}
        </div>}
      </section>
    </section>
  );
}
