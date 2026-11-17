// Optional Playwright + installed Chrome. Run against Vite only; every API is mocked.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:4179';
const copy = value => JSON.parse(JSON.stringify(value));

(async () => {
  const browser = await chromium.launch({ channel: process.env.HAGENDA_BROWSER_CHANNEL || 'chrome', headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, timezoneId: 'America/Sao_Paulo', permissions: ['microphone'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let version = 1, parseCalls = 0, voiceCalls = 0;
    const failed = new Set();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const original = { id: 'ui-task', version: '1', title: 'Teste persistência', time: '10:00', date: today,
      category: 'Geral', icon: 'Circle', completed: false, priority: false, notes: '', recurrence: 'none', completedDates: [] };
    const tasks = new Map([[original.id, original]]);
    const documents = {
      settings: { version: '1', userName: 'Teste', highContrast: false, reminderMinutes: 15, completedStudyDates: [] },
      'workout-state': { version: '1', activeGroupId: 'A', workoutDate: today, completedExercises: {}, weights: {} },
      'diet-state': { version: '1', dietDate: today, completedMeals: {}, waterMl: 0 }
    };
    await page.route('**/api/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname.slice(5), method = request.method();
      const body = method === 'POST' ? request.postDataJSON() : null;
      const respond = (json, status = 200) => route.fulfill({ status, json });
      if (path === 'tasks' && method === 'GET') return respond(copy([...tasks.values()]));
      if ((path === 'tasks' && method === 'POST') || (path.startsWith('tasks/') && method === 'DELETE')) {
        if (failed.has(method)) return respond({ error: 'Falha simulada' }, 503);
        const id = method === 'POST' ? body.id : decodeURIComponent(path.slice(6));
        const previous = tasks.get(id);
        if (method === 'DELETE') {
          if (!previous || previous.version !== request.headers()['if-match']) return respond({ error: 'Conflito' }, 409);
          tasks.delete(id);
          return respond({ success: true });
        }
        if ((previous && previous.version !== body.version) || (!previous && body.version)) return respond({ error: 'Conflito' }, 409);
        const saved = { ...body, version: String(++version) };
        tasks.set(id, saved);
        return respond({ success: true, task: saved });
      }
      if (documents[path]) {
        if (method === 'GET') return respond(copy(documents[path]));
        const expected = request.headers()['if-match'];
        if (expected && expected !== documents[path].version) return respond({ error: 'Conflito' }, 409);
        documents[path] = { ...documents[path], ...body, version: String(++version) };
        return respond({ success: true, [path === 'settings' ? 'settings' : path === 'diet-state' ? 'dietState' : 'workoutState']: documents[path] });
      }
      if (path === 'db-status') return respond({ connected: true, mode: 'neon' });
      if (path === 'generate-inspiration') return respond({ text: 'Teste local' });
      if (path === 'reminders') return respond({ configs: {}, scheduler: {} });
      if (path === 'parse-task' || path === 'transcribe-task') {
        if (path === 'parse-task') parseCalls++; else voiceCalls++;
        return respond({ title: path === 'parse-task' ? 'IA pendente' : 'Voz pendente', date: today, time: '14:00',
          category: 'Geral', icon: 'Circle', completed: false, priority: false, recurrence: 'none' });
      }
      return respond({ success: true });
    });
    const pendingCount = () => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('momentum_task_pending:')).length);
    const retry = () => page.getByRole('status').getByRole('button', { name: 'Tentar novamente', exact: true }).first().click();
    const check = title => page.getByRole('checkbox', { name: new RegExp(`^(Concluir|Reabrir) ${title}$`) });
    await page.goto(base);
    await check(original.title).waitFor();
    failed.add('POST');
    await check(original.title).click();
    await page.getByRole('status').getByText(/503/).waitFor();
    assert.equal(await check(original.title).getAttribute('aria-checked'), 'false');
    assert.equal(await pendingCount(), 1);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.reload();
    await page.getByRole('status').getByText(/503/).waitFor();
    assert.equal(await check(original.title).getAttribute('aria-checked'), 'false');
    assert.equal(await pendingCount(), 1);
    failed.delete('POST');
    await retry();
    await page.getByRole('checkbox', { name: `Reabrir ${original.title}`, exact: true }).waitFor();
    console.log('PASS UI: failed completion + focus + reload + durable retry');

    await page.getByRole('button', { name: `Abrir ${original.title}`, exact: true }).click();
    failed.add('DELETE');
    await page.getByRole('button', { name: `Excluir ${original.title}`, exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(tasks.size, 1);
    assert.equal(await pendingCount(), 1);
    await page.getByRole('button', { name: 'Fechar tarefa', exact: true }).click();
    failed.delete('DELETE');
    await retry();
    await page.getByRole('button', { name: 'Desfazer', exact: true }).waitFor();
    assert.equal(tasks.size, 0);
    failed.add('POST');
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
    await page.getByRole('status').getByText(/503/).waitFor();
    assert.equal(tasks.size, 0);
    assert.equal(await pendingCount(), 1);
    failed.delete('POST');
    await retry();
    await check(original.title).waitFor();
    assert.equal(tasks.size, 1);
    assert.ok(tasks.has(original.id));
    console.log('PASS UI: failed delete + confirmed delete + failed undo + retry');

    await page.getByRole('button', { name: `Abrir ${original.title}`, exact: true }).click();
    await page.getByRole('button', { name: 'Editar tarefa', exact: true }).click();
    await page.getByPlaceholder('O que precisa ser feito?').fill('Minha edição');
    tasks.set(original.id, { ...tasks.get(original.id), version: String(++version), title: 'Outro dispositivo', notes: 'Nota remota preservada' });
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(tasks.get(original.id).title, 'Outro dispositivo');
    await page.getByRole('button', { name: 'Fechar tarefa', exact: true }).click();
    await page.getByRole('button', { name: 'Reaplicar minha alteração', exact: true }).click();
    await check('Minha edição').waitFor();
    assert.equal(tasks.get(original.id).notes, 'Nota remota preservada');
    assert.equal(await pendingCount(), 0);
    console.log('PASS UI: overlapping edits require review and preserve independent server data');

    await page.getByText('Mais opções da agenda', { exact: true }).click();
    await page.getByRole('button', { name: 'Criar tarefa por texto ou voz', exact: true }).click();
    failed.add('POST');
    await page.getByPlaceholder('Ex: Treino hoje às 18h...').fill('Criar tarefa de teste');
    await page.getByPlaceholder('Ex: Treino hoje às 18h...').press('Enter');
    await page.getByRole('status').getByText(/503/).waitFor();
    assert.equal([...tasks.values()].filter(task => task.title === 'IA pendente').length, 0);
    assert.equal(await pendingCount(), 1);
    failed.delete('POST');
    await page.getByPlaceholder('Ex: Treino hoje às 18h...').press('Enter');
    await check('IA pendente').waitFor();
    assert.equal(parseCalls, 1);
    assert.equal([...tasks.values()].filter(task => task.title === 'IA pendente').length, 1);
    console.log('PASS UI: AI draft retained, retried without re-parsing or duplicate creation');

    await page.getByRole('button', { name: 'Criar tarefa por texto ou voz', exact: true }).click();
    failed.add('POST');
    await page.getByTitle('Falar comando de voz', { exact: true }).click();
    await page.getByTitle('Ouvindo... Toque para parar', { exact: true }).waitFor();
    await page.waitForTimeout(250); // Capture only synthetic audio from Chrome's fake microphone.
    await page.getByTitle('Ouvindo... Toque para parar', { exact: true }).click();
    await page.getByRole('status').getByText(/503/).waitFor();
    assert.equal([...tasks.values()].filter(task => task.title === 'Voz pendente').length, 0);
    failed.delete('POST');
    await page.getByRole('button', { name: 'Tentar novamente', exact: true }).last().click();
    await check('Voz pendente').waitFor();
    assert.equal(voiceCalls, 1);
    assert.equal([...tasks.values()].filter(task => task.title === 'Voz pendente').length, 1);
    assert.equal(await pendingCount(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log('PASS UI: synthetic voice draft + retry, 375px, no overflow or runtime errors');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
