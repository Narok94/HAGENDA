import { createHmac, timingSafeEqual } from 'node:crypto';
import { isTaskOnDate, isTaskCompletedOnDate } from '../src/utils/taskDates.js';

export interface ReminderConfig {
  mode: 'none' | 'simple' | 'persistent';
  leadMinutes: number;
  intervalMinutes: number;
  snoozeMinutes: number;
  time?: string;
}
export const DEFAULT_REMINDER: ReminderConfig = { mode: 'none', leadMinutes: 15, intervalMinutes: 15, snoozeMinutes: 10 };
export function validateConfig(value: any): ReminderConfig {
  if (!value || !['none', 'simple', 'persistent'].includes(value.mode)) throw new Error('Modo de alerta inválido');
  for (const [key, min, max] of [['leadMinutes', 0, 1440], ['intervalMinutes', 1, 1440], ['snoozeMinutes', 1, 1440]] as const) {
    if (!Number.isInteger(value[key]) || value[key] < min || value[key] > max) throw new Error(`${key}: use minutos inteiros entre ${min} e ${max}`);
  }
  if (value.time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) throw new Error('Horário inválido');
  return { mode: value.mode, leadMinutes: value.leadMinutes, intervalMinutes: value.intervalMinutes, snoozeMinutes: value.snoozeMinutes, ...(value.time ? { time: value.time } : {}) };
}
export function localDate(now: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
}
export function offsetDate(date: string, days: number) {
  return new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}
export function firstDue(task: any, date: string, config: ReminderConfig): Date | null {
  const time = config.time || task.time;
  if (config.mode === 'none' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !isTaskOnDate(task, date) || isTaskCompletedOnDate(task, date)) return null;
  // São Paulo currently observes UTC-3. Occurrence dates always belong to this zone.
  return new Date(Date.parse(`${date}T${time}:00-03:00`) - config.leadMinutes * 60000);
}
export function secureEqual(a: string, b: string) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function actionToken(id: string, date: string, revision: string, expires: number) {
  const secret = process.env.REMINDER_ACTION_SECRET;
  if (!secret) throw new Error('REMINDER_ACTION_SECRET ausente');
  const body = Buffer.from(JSON.stringify({ id, date, revision, expires })).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
export function verifyActionToken(token: string) {
  const parts = String(token).split('.');
  if (parts.length !== 2) throw new Error('Token inválido');
  const [body, signature] = parts;
  if (!body || !signature || !process.env.REMINDER_ACTION_SECRET) throw new Error('Token inválido');
  if (!secureEqual(signature, createHmac('sha256', process.env.REMINDER_ACTION_SECRET).update(body).digest('base64url'))) throw new Error('Token inválido');
  const data = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (!Number.isFinite(data.expires) || data.expires < Date.now()) throw new Error('Token expirado');
  return data as { id: string; date: string; revision: string; expires: number };
}
