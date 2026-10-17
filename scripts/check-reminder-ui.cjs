// Optional: requires Playwright + Chromium/WebKit. All APIs are mocked; no push is sent.
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:3000';
(async () => {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
      const writes = [], errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (req.method() !== 'GET') writes.push({ path, body: req.postDataJSON() });
        let data = {};
        if (path === '/api/settings') data = { userName:'Teste',highContrast:false,reminderMinutes:15,completedStudyDates:[] };
        if (path === '/api/tasks') data = req.method() === 'GET' ? [] : {success:true};
        if (path === '/api/db-status') data = {connected:true,mode:'neon'};
        if (path === '/api/reminders') data = {configs:{},scheduler:{}};
        await route.fulfill({ status:200,contentType:'application/json',body:JSON.stringify(data) });
      });
      await page.goto(base);
      await page.getByRole('button',{name:'Nova Tarefa',exact:true}).click();
      await page.getByPlaceholder('O que precisa ser feito?').fill('Teste de alerta');
      await page.getByLabel('Tipo de alerta').selectOption('persistent');
      await page.getByLabel('Primeiro aviso').fill('20');
      await page.getByLabel('Repetir a cada').selectOption('custom');
      await page.getByLabel('Intervalo (min)',{exact:true}).fill('7');
      await page.getByLabel('Adiar por').fill('12');
      await page.getByLabel('Horário (São Paulo)').fill('14:30');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
      await page.getByRole('button',{name:'Salvar',exact:true}).click();
      await page.waitForFunction(() => !document.querySelector('fieldset'));
      const task = writes.find(w=>w.path==='/api/tasks');
      const reminder = writes.find(w=>w.path.startsWith('/api/reminders/'));
      assert.ok(task); assert.equal(reminder.path,`/api/reminders/${task.body.id}`);
      assert.deepEqual(reminder.body,{mode:'persistent',leadMinutes:20,intervalMinutes:7,snoozeMinutes:12,time:'14:30'});
      assert.deepEqual(errors,[]);
      console.log(`PASS ${name}: new activity + custom reminder, 375px, no overflow or runtime errors`);
      await page.close();
    } finally { await browser.close(); }
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
