import type { Task } from '../types';
import { isTaskList, readTaskCache, writeTaskCache } from './taskStorage';

export type Resource = 'tasks' | 'settings' | 'workout-state' | 'diet-state';
export type SyncDocument = Record<string, any>;
const PREFIX = 'momentum_task_pending:';
type Journal = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
export interface PendingChange {
  id: string; resource: Resource; entityId: string; before: SyncDocument | null; after: SyncDocument | null;
  title: string; createdAt: number;
  actor?: string;
  steps?: { before: Task | null; after: Task }[];
}
export interface PendingStatus extends PendingChange { error?: string; conflict?: string[]; durable: boolean }
export interface SyncSnapshot {
  tasks: Task[]; documents: Partial<Record<Resource, SyncDocument>>;
  pending: PendingStatus[]; error: string; loaded: boolean; syncing: boolean;
}

const resources: Resource[] = ['tasks', 'settings', 'workout-state', 'diet-state'];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const equal = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a), other = Object.keys(b);
  return keys.length === other.length && keys.every(key => Object.hasOwn(b, key) && equal(a[key], b[key]));
};
const object = (value: unknown): value is SyncDocument => !!value && typeof value === 'object' && !Array.isArray(value);
function validDocument(resource: Resource, value: unknown): value is SyncDocument {
  if (resource === 'tasks') return isTaskList([value]);
  if (!object(value)) return false;
  if (resource === 'settings') return typeof value.userName === 'string' && typeof value.highContrast === 'boolean' &&
    Number.isFinite(value.reminderMinutes) && Array.isArray(value.completedStudyDates) && value.completedStudyDates.every((date: unknown) => typeof date === 'string');
  if (resource === 'workout-state') return typeof value.activeGroupId === 'string' && typeof value.workoutDate === 'string' && object(value.completedExercises) && object(value.weights);
  return typeof value.dietDate === 'string' && object(value.completedMeals) && Number.isFinite(value.waterMl) && value.waterMl >= 0;
}
function validChange(op: any, key: string): op is PendingChange {
  if (!op || typeof op.id !== 'string' || key !== PREFIX + op.id || !resources.includes(op.resource) ||
      typeof op.entityId !== 'string' || typeof op.title !== 'string' || !Number.isFinite(op.createdAt) ||
      !Object.hasOwn(op, 'before') || !Object.hasOwn(op, 'after') || (!op.before && !op.after)) return false;
  if ((op.before !== null && !validDocument(op.resource, op.before)) || (op.after !== null && !validDocument(op.resource, op.after))) return false;
  if (op.resource === 'tasks' && [op.before, op.after].some(value => value && value.id !== op.entityId)) return false;
  if (op.resource !== 'tasks' && op.entityId !== '1') return false;
  return !op.steps || (op.resource === 'tasks' && Array.isArray(op.steps) && op.steps.length > 0 && op.steps.every((step: any) =>
    isTaskList([step.after]) && (step.before === null || (isTaskList([step.before]) && step.before.id === step.after.id))));
}

export function normalized(resource: Resource, value: SyncDocument): SyncDocument {
  if (resource === 'tasks') return {
    title: value.title, time: value.time, date: value.date, category: value.category, icon: value.icon,
    completed: value.completed, priority: value.priority, notes: value.notes || '', recurrence: value.recurrence || 'none',
    recurrenceDay: value.recurrenceDay || '', recurrenceDays: [...(value.recurrenceDays || [])].sort(),
    completedDates: [...new Set(value.completedDates || [])].sort()
  };
  const { version: _version, ...fields } = value;
  if (resource === 'settings') return { userName: value.userName ?? 'Henrique', highContrast: !!value.highContrast,
    reminderMinutes: value.reminderMinutes ?? 15, completedStudyDates: [...new Set(value.completedStudyDates || [])].sort() };
  return fields;
}

// Three-way reconciliation applies only the user's delta; unrelated server edits survive.
export function reconcile(resource: Resource, before: SyncDocument, after: SyncDocument, remote: SyncDocument, force = false) {
  let base = normalized(resource, before);
  const desired = normalized(resource, after), current = normalized(resource, remote);
  const conflicts: string[] = [];
  const day = resource === 'diet-state' ? 'dietDate' : resource === 'workout-state' ? 'workoutDate' : null;
  if (day && current[day] > desired[day]) return { value: current, conflicts: [day] };
  if (resource === 'workout-state' && base.activeGroupId !== current.activeGroupId &&
      desired.activeGroupId === base.activeGroupId && !equal(base.completedExercises, desired.completedExercises)) {
    return { value: current, conflicts: ['activeGroupId'] };
  }
  if (day && base[day] !== desired[day] && current[day] === desired[day]) {
    base = resource === 'diet-state' ? { ...base, [day]: desired[day], completedMeals: {}, waterMl: 0 }
      : { ...base, [day]: desired[day], completedExercises: {} };
  }
  const merge = (old: any, next: any, latest: any, path: string): any => {
    if (equal(old, next)) return latest;
    // Identical totals may come from two independent "add water" clicks.
    // Without a receipt, equality cannot prove that this client's increment ran.
    if (resource === 'diet-state' && path === 'waterMl' && !equal(old, latest)) {
      conflicts.push(path); return force ? next : latest;
    }
    if (equal(old, latest) || (path !== '' && equal(next, latest))) return next;
    if (['completedDates', 'completedStudyDates'].includes(path) && [old, next, latest].every(Array.isArray)) {
      const removed = old.filter((date: string) => !next.includes(date));
      const added = next.filter((date: string) => !old.includes(date));
      return [...new Set([...latest.filter((date: string) => !removed.includes(date)), ...added])].sort();
    }
    if ([old, next, latest].every(value => value && typeof value === 'object' && !Array.isArray(value))) {
      return Object.fromEntries([...new Set([...Object.keys(old), ...Object.keys(next), ...Object.keys(latest)])]
        .map(key => [key, merge(old[key], next[key], latest[key], path ? `${path}.${key}` : key)]));
    }
    conflicts.push(path);
    return force ? next : latest;
  };
  return { value: merge(base, desired, current, ''), conflicts: force ? [] : conflicts };
}

export class TaskSync {
  private snapshot: SyncSnapshot;
  private listeners = new Set<() => void>();
  private chain: Promise<unknown> = Promise.resolve();
  private volatile = new Map<string, PendingChange>();
  private failures = new Map<string, { error: string; conflict?: string[] }>();
  private confirmed = new Set<string>();
  private issued = new Map<string, PendingChange>();
  private fetcher: typeof fetch;
  private journal?: Journal;
  private actor = crypto.randomUUID();
  private lastCreatedAt = 0;
  private requestTimeoutMs: number;
  private synchronization?: Promise<void>;
  constructor(options: { storage?: Journal; fetch?: typeof fetch; requestTimeoutMs?: number } = {}) {
    this.journal = options.storage;
    this.fetcher = options.fetch ?? ((input, init) => fetch(input, init));
    this.requestTimeoutMs = options.requestTimeoutMs ?? 15000;
    const cache = readTaskCache(options.storage);
    this.snapshot = { tasks: cache.tasks, documents: {}, pending: [], error: '', loaded: false, syncing: false };
    this.publish();
  }
  private storage(): Journal { return this.journal ?? localStorage; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private pending(): PendingStatus[] {
    const changes = new Map(this.volatile);
    try {
      const storage = this.storage();
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(PREFIX)) continue;
        try {
          const op = JSON.parse(storage.getItem(key)!);
          if (!validChange(op, key)) {
            throw new Error('Pendência inválida; conteúdo preservado');
          }
          changes.set(op.id, op);
        } catch { this.snapshot.error = 'Há uma pendência local ilegível. Seu conteúdo foi preservado.'; }
      }
    } catch (error) { this.snapshot.error = `Não foi possível ler as pendências locais. ${String(error)}`; }
    return [...changes.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
      .map(op => ({ ...op, ...this.failures.get(op.id), durable: !this.volatile.has(op.id) }));
  }
  private publish(update: Partial<SyncSnapshot> = {}) {
    this.snapshot = { ...this.snapshot, ...update };
    this.snapshot.pending = this.pending();
    this.listeners.forEach(listener => listener());
  }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const run = this.chain.catch(() => {}).then(async () => {
      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
      return locks ? locks.request('hagenda-task-sync', work) : work();
    });
    this.chain = run.catch(() => {});
    return run;
  }
  private persist(op: PendingChange) {
    this.volatile.set(op.id, op);
    const encoded = JSON.stringify(op);
    this.storage().setItem(PREFIX + op.id, encoded);
    if (this.storage().getItem(PREFIX + op.id) !== encoded) throw new Error('Não foi possível verificar a gravação local');
    this.volatile.delete(op.id);
  }
  private enqueue(resource: Resource, entityId: string, before: SyncDocument | null, after: SyncDocument | null, title: string, steps?: PendingChange['steps']) {
    before = before ? clone(before) : null;
    after = after ? clone(after) : null;
    steps = steps ? clone(steps) : undefined;
    const duplicate = this.pending().find(op => op.resource === resource && op.entityId === entityId && equal(op.before, before) && equal(op.after, after) && equal(op.steps, steps));
    if (duplicate) { this.issued.set(duplicate.id, duplicate); return duplicate.id; }
    const previous = this.pending().filter(op => op.actor === this.actor && op.resource === resource && op.entityId === entityId && !op.steps).at(-1);
    if (!steps && previous?.after && after) {
      if (equal(normalized(resource, previous.after), normalized(resource, after))) {
        this.issued.set(previous.id, previous); return previous.id;
      }
      const rebased = before ? reconcile(resource, before, after, previous.after, true)
        : { value: normalized(resource, after), conflicts: [] };
      if (!rebased.conflicts.length) { before = previous.after; after = { ...after, ...rebased.value }; }
    }
    this.lastCreatedAt = Math.max(Date.now(), this.lastCreatedAt + 1);
    const op: PendingChange = clone({ id: crypto.randomUUID(), actor: this.actor, resource, entityId, before, after, title, steps, createdAt: this.lastCreatedAt });
    this.issued.set(op.id, op);
    try { this.persist(op); }
    catch { this.failures.set(op.id, { error: 'Armazenamento local indisponível. Mantenha esta página aberta e tente novamente.' }); }
    this.publish();
    return op.id;
  }
  private async request(url: string, options?: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await this.fetcher(url, { ...options, cache: 'no-store', signal: controller.signal });
      const body = await response.text();
      return { status: response.status, ok: response.ok, json: async () => JSON.parse(body) };
    } catch (error: any) {
      if (error.name === 'AbortError') throw new Error('O servidor demorou a responder. A alteração permanece pendente.');
      throw error;
    }
    finally { clearTimeout(timeout); }
  }
  private async read(resource: Resource): Promise<SyncDocument | Task[]> {
    const response = await this.request(`/api/${resource}`);
    if (!response.ok) throw new Error(`Não foi possível carregar os dados (${response.status})`);
    const value = await response.json();
    if (resource === 'tasks') {
      if (!isTaskList(value) || value.some(task => typeof task.version !== 'string')) throw new Error('Resposta de tarefas inválida');
      this.publish({ tasks: value });
      if (!writeTaskCache(value, this.journal)) this.publish({ error: 'Dados confirmados no servidor; não foi possível atualizar o cache local.' });
    } else {
      if (!validDocument(resource, value) || !Object.hasOwn(value, 'version') ||
          (value.version !== null && typeof value.version !== 'string')) throw new Error('Resposta do servidor sem versão válida');
      this.publish({ documents: { ...this.snapshot.documents, [resource]: value } });
    }
    return value;
  }
  refresh(resource: Resource = 'tasks') {
    return this.serial(async () => {
      try { return await this.read(resource); }
      catch (error) { this.publish({ error: String(error) }); throw error; }
      finally { if (resource === 'tasks') this.publish({ loaded: true }); }
    });
  }
  private current(resource: Resource, entityId: string): SyncDocument | null {
    return resource === 'tasks' ? this.snapshot.tasks.find(task => task.id === entityId) ?? null : this.snapshot.documents[resource] ?? null;
  }
  private complete(op: PendingChange, saved: SyncDocument | null, retain = false) {
    if (op.resource === 'tasks') {
      const tasks = this.snapshot.tasks.filter(task => task.id !== op.entityId);
      if (saved) tasks.push(saved as Task);
      this.publish({ tasks });
      if (!writeTaskCache(tasks, this.journal)) this.publish({ error: 'Alteração salva no servidor; cache local indisponível.' });
    } else if (saved) this.publish({ documents: { ...this.snapshot.documents, [op.resource]: saved } });
    if (retain) return;
    this.remove(op);
  }
  private remove(op: PendingChange) {
    this.storage().removeItem(PREFIX + op.id);
    this.confirmed.add(op.id);
    this.volatile.delete(op.id);
    this.failures.delete(op.id);
    this.publish();
  }
  private async apply(op: PendingChange, retain = false) {
    if (op.steps) {
      for (const step of op.steps) await this.apply({ ...op, ...step, entityId: step.after.id, steps: undefined }, true);
      this.remove(op);
      return;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.read(op.resource);
      const remote = this.current(op.resource, op.entityId);
      let desired: SyncDocument | null = op.after;
      if (op.resource === 'tasks' && !op.before) {
        if (remote) {
          if (desired && equal(normalized('tasks', desired), normalized('tasks', remote))) return this.complete(op, remote, retain);
          throw Object.assign(new Error('Já existe outra tarefa com este identificador.'), { conflict: ['id'] });
        }
      } else if (!remote) {
        if (!desired) return this.complete(op, null, retain); // A lost DELETE response is safely reconciled.
        throw Object.assign(new Error('A tarefa foi excluída em outro dispositivo. A alteração foi preservada.'), { conflict: ['exclusão'] });
      } else if (!desired) {
        if (op.before && !equal(normalized(op.resource, op.before), normalized(op.resource, remote))) {
          throw Object.assign(new Error('A tarefa mudou antes da exclusão. Revise a pendência.'), { conflict: ['exclusão'] });
        }
      } else if (op.before) {
        const result = reconcile(op.resource, op.before, desired, remote);
        if (result.conflicts.length) throw Object.assign(new Error('Há alterações diferentes no mesmo campo. Escolha como resolver.'), { conflict: result.conflicts });
        desired = { ...remote, ...result.value };
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'If-Match': remote?.version ?? 'absent' };
      const reopening: SyncDocument = {};
      if (desired && op.before) {
        if (op.resource === 'settings') reopening.removedStudyDates = (op.before.completedStudyDates || []).filter((date: string) => !desired!.completedStudyDates.includes(date));
        if (op.resource === 'diet-state' && op.before.dietDate === desired.dietDate) {
          reopening.reopenedMeals = Object.keys(op.before.completedMeals).filter(key => op.before!.completedMeals[key] === true && desired!.completedMeals[key] !== true);
        }
        if (op.resource === 'workout-state' && op.before.workoutDate === desired.workoutDate && op.before.activeGroupId === desired.activeGroupId) {
          reopening.reopenWorkout = Object.keys(op.before.completedExercises).some(key => op.before!.completedExercises[key] === true && desired!.completedExercises[key] !== true);
        }
      }
      const response = await this.request(op.resource === 'tasks' && !desired ? `/api/tasks/${encodeURIComponent(op.entityId)}` : `/api/${op.resource}`, {
        method: !desired ? 'DELETE' : 'POST', headers,
        ...(desired ? { body: JSON.stringify({ ...desired, ...reopening, ...(op.resource === 'tasks' ? { version: remote?.version } : {}) }) } : {})
      });
      if (response.status === 409) continue; // Read again and reconcile, never blindly overwrite.
      if (!response.ok) throw new Error(`Não foi possível salvar (${response.status}). Alteração pendente para nova tentativa.`);
      const body = await response.json();
      const saved = !desired ? null : body.task ?? body.settings ?? body.workoutState ?? body.dietState;
      if (body.success !== true || (desired && (!validDocument(op.resource, saved) || typeof saved.version !== 'string'))) throw new Error('O servidor não confirmou a persistência da alteração.');
      if (op.resource !== 'tasks') {
        try { await this.read('tasks'); } catch { this.publish({ error: 'Alteração confirmada; não foi possível atualizar as tarefas relacionadas.' }); }
      }
      this.complete(op, saved, retain);
      return;
    }
    throw new Error('Os dados continuam mudando. A alteração permanece pendente.');
  }
  private async flush() {
    this.publish({ syncing: true });
    const blocked = new Set<string>();
    try {
      for (const op of this.pending()) {
        const key = `${op.resource}/${op.entityId}`;
        if (blocked.has(key)) continue;
        try {
          if (!op.durable) this.persist(op);
          await this.apply(op);
        } catch (error: any) {
          blocked.add(key);
          this.failures.set(op.id, { error: error.message || String(error), conflict: error.conflict });
          this.publish();
        }
      }
    } finally { this.publish({ syncing: false }); }
  }
  retry = () => this.serial(() => this.flush());
  synchronize() {
    if (this.synchronization) return this.synchronization;
    this.synchronization = (async () => {
      this.publish({ error: '' });
      await this.retry();
      for (const resource of resources) { try { await this.refresh(resource); } catch { /* Error is visible; keep confirmed state. */ } }
    })().finally(() => { this.synchronization = undefined; });
    return this.synchronization;
  }
  private async wait(id: string, resource: Resource, entityId: string) {
    await this.retry();
    const pending = this.pending().find(op => op.id === id);
    if (pending) throw new Error(pending.error || 'Alteração pendente. Use Tentar novamente.');
    if (!this.confirmed.has(id)) {
      // Another tab may have processed this entry. Missing journal data alone
      // never counts as persistence: verify the intended delta on the server.
      try {
        await this.serial(() => this.read(resource));
        const op = this.issued.get(id);
        const matches = (before: SyncDocument | null, after: SyncDocument | null, key: string) => {
          const remote = this.current(resource, key);
          if (!after) return !remote;
          if (!remote || !remote.version) return false;
          if (!before) return equal(normalized(resource, after), normalized(resource, remote));
          const result = reconcile(resource, before, after, remote);
          return !result.conflicts.length && equal(result.value, normalized(resource, remote));
        };
        if (!op || !(op.steps ? op.steps.every(step => matches(step.before, step.after, step.after.id)) : matches(op.before, op.after, entityId))) {
          throw new Error('Não foi possível confirmar a alteração no servidor. Revise os dados antes de tentar novamente.');
        }
      } catch (error) { this.reportError(error); throw error; }
    }
    return this.current(resource, entityId);
  }
  saveTask(before: Task | null, after: Task) {
    return this.wait(this.enqueue('tasks', after.id, before, after, after.title), 'tasks', after.id);
  }
  saveTaskBatch(steps: NonNullable<PendingChange['steps']>) {
    const last = steps[steps.length - 1];
    return this.wait(this.enqueue('tasks', last.after.id, last.before, last.after, `Adiar: ${last.after.title}`, steps), 'tasks', last.after.id);
  }
  deleteTask(before: Task) {
    return this.wait(this.enqueue('tasks', before.id, before, null, before.title), 'tasks', before.id);
  }
  saveDocument(resource: Exclude<Resource, 'tasks'>, before: SyncDocument, after: SyncDocument) {
    return this.wait(this.enqueue(resource, '1', before, after,
      resource === 'settings' ? 'Estudos e configurações' : resource === 'diet-state' ? 'Dieta e água' : 'Treino'), resource, '1');
  }
  discard(id: string) {
    try { this.storage().removeItem(PREFIX + id); this.volatile.delete(id); this.failures.delete(id); this.publish(); }
    catch { this.publish({ error: 'Não foi possível remover a pendência local.' }); }
  }
  async reapply(id: string) {
    return this.serial(async () => {
      const op = this.pending().find(change => change.id === id);
      if (!op || op.steps) return;
      try {
        await this.read(op.resource);
        const remote = this.current(op.resource, op.entityId);
        if (!remote && !op.after) { this.complete(op, null); return; }
        let after = op.after;
        let before = remote, entityId = op.entityId;
        if (!op.before && remote && after && op.resource === 'tasks') {
          // A creation collision can only produce a new copy, never replace data.
          entityId = crypto.randomUUID(); before = null;
          after = { ...after, id: entityId, version: undefined };
        }
        if (remote && op.before && after) {
          const result = reconcile(op.resource, op.before, after, remote, true);
          if (result.conflicts.length) throw new Error('O dia ou grupo desta pendência mudou. O progresso atual será preservado.');
          after = { ...remote, ...result.value };
        }
        const replacement = clone({ ...op, id: crypto.randomUUID(), entityId, before, after });
        this.persist(replacement); // Keep the original until the replacement is durable.
        this.discard(op.id);
        await this.flush();
      } catch (error) { this.publish({ error: String(error) }); }
    });
  }
  dismissError = () => this.publish({ error: '' });
  reportError = (error: unknown) => this.publish({ error: error instanceof Error ? error.message : String(error) });
}
