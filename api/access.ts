import { createHmac } from 'node:crypto';
import type { Router } from 'express';
import { secureEqual } from './reminder-policy.js';

const sessionValue = (expires: number) => `${expires}.${createHmac('sha256', process.env.APP_ACCESS_TOKEN || '').update(String(expires)).digest('hex')}`;
export function installAccess(router: Router) {
  router.post('/session', (req, res) => {
    if (!process.env.APP_ACCESS_TOKEN || !secureEqual(String(req.body.token || ''), process.env.APP_ACCESS_TOKEN)) return res.sendStatus(401);
    const value = sessionValue(Date.now() + 30 * 86400000);
    res.setHeader('Set-Cookie', `hagenda_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    res.json({ success: true });
  });
  router.use((req, res, next) => {
    // Cron and notification actions authenticate independently with scoped credentials.
    if (req.path === '/send-reminders' || req.path === '/reminder-action') return next();
    if (!process.env.APP_ACCESS_TOKEN) {
      if (process.env.NODE_ENV !== 'production') return next();
      return res.status(503).json({ error: 'APP_ACCESS_TOKEN não configurado no servidor' });
    }
    const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('hagenda_session='))?.slice(16) || '';
    const expires = Number(cookie.split('.')[0]);
    const validCookie = expires > Date.now() && secureEqual(cookie, sessionValue(expires));
    const validBearer = secureEqual(req.headers.authorization || '', `Bearer ${process.env.APP_ACCESS_TOKEN}`);
    if (!validCookie && !validBearer) return res.sendStatus(401);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['sec-fetch-site'] === 'cross-site') return res.sendStatus(403);
    next();
  });
}
