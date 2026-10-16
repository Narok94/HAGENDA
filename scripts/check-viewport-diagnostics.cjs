// Optional Playwright smoke check. Start vite preview on port 5175 first.
const assert = require('node:assert/strict');
const { webkit, chromium } = require('playwright');
const baseURL = process.argv[2] || 'http://127.0.0.1:5175';
(async () => {
  for (const [name, engine] of Object.entries({ webkit, chromium })) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', { value: {
          writeText: async text => {
            if (window.failDiagnosticCopy) throw new Error('Clipboard unavailable');
            window.copiedDiagnostic = text;
          },
        } });
      });
      await page.route('**/api/**', route => route.fulfill({ json:
        route.request().url().endsWith('/tasks') ? [] :
        route.request().url().endsWith('/settings') ? { userName: 'PRIVATE_DIAGNOSTIC_USER' } : {} }));
      await page.goto(baseURL);
      await page.getByRole('navigation').waitFor();
      assert.equal(await page.getByText('Diagnóstico do rodapé (temporário)', { exact: true }).count(), 0);
      const rects = () => page.evaluate(() => ['html', 'body', '#root', '.hagenda-app-shell', 'nav'].map(s => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, height: r.height };
      }));
      const before = await rects();
      await page.getByRole('navigation').getByRole('button', { name: 'Mais', exact: true }).click();
      await page.getByRole('button', { name: /^Configurações/ }).click();
      await page.getByRole('button', { name: 'Diagnóstico do rodapé (temporário)', exact: true }).click();
      const panel = page.getByRole('dialog', { name: 'Diagnóstico do rodapé' });
      await panel.waitFor();
      const read = async () => JSON.parse(await page.locator('[data-viewport-diagnostic]').innerText());
      await page.waitForFunction(() => document.querySelector('[data-viewport-diagnostic]')?.textContent.includes('navBottom'));
      let snapshot = await read();
      assert.deepEqual(Object.keys(snapshot).sort(), ['build', 'measuredAt', 'standalone', 'innerHeight', 'visualViewport',
        'screenHeight', 'scrollY', 'elements', 'navBottom', 'safeAreaInsetBottom', 'visibleViewportBottom', 'gapBelowNav'].sort());
      assert.match(snapshot.build.commit, /^[a-f0-9]{40}$/);
      assert.ok(snapshot.build.builtAt);
      assert.equal(snapshot.innerHeight, 844);
      assert.equal(snapshot.visualViewport.height, 844);
      assert.equal(snapshot.gapBelowNav, 0);
      assert.equal(snapshot.safeAreaInsetBottom, 0);
      assert.deepEqual(await rects(), before, 'Panel must not change app geometry');
      const initialTime = snapshot.measuredAt;
      await page.waitForFunction(time => JSON.parse(document.querySelector('[data-viewport-diagnostic]').textContent).measuredAt !== time, initialTime);
      await page.setViewportSize({ width: 390, height: 667 });
      await page.waitForFunction(() => JSON.parse(document.querySelector('[data-viewport-diagnostic]').textContent).innerHeight === 667);
      // Confirm the inset is measured from the probe, not a hardcoded value.
      await page.locator('[data-safe-area-probe]').evaluate(el => el.style.height = '27px');
      await page.waitForFunction(() => JSON.parse(document.querySelector('[data-viewport-diagnostic]').textContent).safeAreaInsetBottom === 27);
      await panel.getByRole('button', { name: 'Copiar diagnóstico', exact: true }).click();
      await panel.getByRole('status').filter({ hasText: 'Diagnóstico copiado.' }).waitFor();
      const copied = await page.evaluate(() => window.copiedDiagnostic);
      const parsed = JSON.parse(copied);
      assert.equal(parsed.innerHeight, 667);
      assert.equal(parsed.safeAreaInsetBottom, 27);
      assert.ok(!copied.includes('PRIVATE_DIAGNOSTIC_USER'));
      assert.ok(!copied.includes('tasks'));
      await page.evaluate(() => window.failDiagnosticCopy = true);
      await panel.getByRole('button', { name: 'Copiar diagnóstico', exact: true }).click();
      const manual = panel.getByRole('textbox', { name: 'Diagnóstico para copiar manualmente' });
      await manual.waitFor();
      assert.equal(JSON.parse(await manual.inputValue()).innerHeight, 667);
      await panel.getByRole('button', { name: 'Voltar', exact: true }).click();
      assert.equal(await panel.count(), 0);
      assert.equal(await page.locator('[data-safe-area-probe]').count(), 0);
      await page.getByRole('heading', { name: 'Configurações', exact: true }).waitFor();
      assert.deepEqual(errors, []);
      console.log('PASS', name, 'settings-only access, live measurements, unchanged geometry, probe, copy/privacy, manual fallback, cleanup');
      await page.close();
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
