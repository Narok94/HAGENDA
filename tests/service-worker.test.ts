import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function harness(ok = true) {
  const handlers: Record<string, any> = {};
  const shown: any[] = [], opened: string[] = [], requests: any[] = [];
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url),'utf8'), {
    URL, URLSearchParams,
    self: { location: { origin: 'https://hagenda.test' }, addEventListener: (name: string, handler: any) => { handlers[name] = handler; },
      registration: { showNotification: async (...args: any[]) => { shown.push(args); }, getNotifications: async () => [] } },
    clients: { matchAll: async () => [], openWindow: async (url: string) => { opened.push(url); } },
    fetch: async (url: string, options: any) => { requests.push({url,...options}); return { ok }; }
  });
  const click = async (action: string) => {
    let work: Promise<any> = Promise.resolve();
    handlers.notificationclick({ action, notification: { close() {}, tag:'tag', data: { id:'task/test',date:'2026-10-17',token:'signed.token' } }, waitUntil: (p: Promise<any>) => { work=p; } });
    await work;
  };
  return { handlers,shown,opened,requests,click };
}
test('push displays occurrence tag and actions with signed data', async () => {
  const h=harness(); let work: Promise<any> = Promise.resolve();
  h.handlers.push({ data: { json: () => ({title:'Lembrete',tag:'occurrence-tag',data:{token:'signed'}}) },waitUntil:(p: Promise<any>)=>{work=p;} });
  await work;
  assert.equal(h.shown[0][1].tag,'occurrence-tag');
  assert.deepEqual(Array.from(h.shown[0][1].actions,(a:any)=>a.action),['confirm','snooze','open']);
});
test('successful notification action calls protected action endpoint without opening app', async () => {
  const h=harness(); await h.click('confirm');
  assert.equal(h.requests[0].url,'/api/reminder-action');
  assert.deepEqual(JSON.parse(h.requests[0].body),{action:'confirm',token:'signed.token'});
  assert.equal(h.opened.length,0);
});
test('failed action opens visible fallback with capability in fragment and occurrence date', async () => {
  const h=harness(false); await h.click('snooze');
  const url=new URL(h.opened[0]);
  assert.equal(url.searchParams.get('activity'),'task/test');
  assert.equal(url.searchParams.get('date'),'2026-10-17');
  assert.equal(url.hash,'#reminderToken=signed.token');
  assert.equal(url.searchParams.has('reminderToken'),false);
});
test('notification body click opens activity with fallback actions', async () => {
  const h=harness(); await h.click('');
  assert.equal(h.requests.length,0); assert.equal(h.opened.length,1);
});
