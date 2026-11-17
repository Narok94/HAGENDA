import { useEffect, useSyncExternalStore } from 'react';
import { TaskSync } from '../utils/taskSync';

let shared: TaskSync | undefined;
export const getTaskSync = () => shared ??= new TaskSync();

export function useTaskSync() {
  const store = getTaskSync();
  return { ...useSyncExternalStore(store.subscribe, store.getSnapshot), store };
}

export function useTaskSyncLifecycle() {
  const { store } = useTaskSync();
  useEffect(() => {
    const refresh = () => { void store.synchronize().catch(store.reportError); };
    const storage = (event: StorageEvent) => { if (event.key?.startsWith('momentum_task_pending:')) refresh(); };
    const message = (event: MessageEvent) => { if (event.data?.type === 'reminder-updated') refresh(); };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('storage', storage);
    navigator.serviceWorker?.addEventListener('message', message);
    return () => {
      window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh);
      window.removeEventListener('storage', storage); navigator.serviceWorker?.removeEventListener('message', message);
    };
  }, [store]);
}
