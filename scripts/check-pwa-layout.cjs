// Optional local verification tool: requires Playwright and its WebKit/Chromium browsers.
// Start `npm run dev`, then run `node scripts/check-pwa-layout.cjs [base-url]`.
// Desktop WebKit and synthetic viewport events DO NOT validate an installed iOS PWA.
const assert = require('node:assert/strict');
const { webkit, chromium } = require('playwright');
const baseURL = process.argv[2] || 'http://127.0.0.1:5173';

async function measure(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector);
      const bounds = element.getBoundingClientRect();
      const css = getComputedStyle(element);
      return { top: bounds.top, bottom: bounds.bottom, height: bounds.height,
        overflow: css.overflowY, paddingBottom: parseFloat(css.paddingBottom),
        scrollHeight: element.scrollHeight, clientHeight: element.clientHeight };
    };
    return { innerHeight, scrollY, viewport: window.visualViewport && {
      height: visualViewport.height, pageTop: visualViewport.pageTop,
      offsetTop: visualViewport.offsetTop },
      html: rect('html'), body: rect('body'), root: rect('#root'),
      shell: rect('.hagenda-app-shell'), main: rect('main'), nav: rect('nav') };
  });
}

async function check(page, safeBottom = 0) {
  await page.waitForFunction(() => {
    const viewport = window.visualViewport;
    return !viewport || Math.abs(document.querySelector('#root').getBoundingClientRect().height - viewport.height) < 1;
  });
  const m = await measure(page);
  const height = m.viewport?.height ?? m.innerHeight;
  const top = (m.viewport?.pageTop ?? 0) - m.scrollY;
  for (const element of ['root', 'shell']) {
    assert.ok(Math.abs(m[element].height - height) < 1, JSON.stringify(m));
    assert.ok(Math.abs(m[element].top - top) < 1, JSON.stringify(m));
  }
  assert.ok(Math.abs(m.nav.bottom - (top + height)) < 1, JSON.stringify(m));
  assert.ok(Math.abs(m.main.bottom - m.nav.top) < 1, JSON.stringify(m));
  assert.equal(m.nav.paddingBottom, safeBottom + 4);
  assert.equal(m.main.paddingBottom, 16);
  assert.equal(m.main.overflow, 'auto');
  assert.equal(m.root.overflow, 'visible');
  assert.equal(m.shell.overflow, 'visible');
  assert.equal(m.scrollY, 0, JSON.stringify(m));
  return m;
}

(async () => {
  for (const [name, engine] of Object.entries({ webkit, chromium })) {
    const browser = await engine.launch();
    try {
      for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 844, height: 390 }]) {
        for (const mode of ['native viewport', 'synthetic standalone/keyboard', 'no VisualViewport']) {
          const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.addInitScript(({ mode, viewport }) => {
            if (mode === 'no VisualViewport') {
              Object.defineProperty(window, 'visualViewport', { value: undefined });
            } else if (mode.startsWith('synthetic')) {
              const vv = new EventTarget();
              Object.assign(vv, { height: viewport.height, pageTop: 0, offsetTop: 0, scale: 1 });
              Object.defineProperty(window, 'visualViewport', { value: vv });
              Object.defineProperty(navigator, 'standalone', { value: true });
            }
          }, { mode, viewport });
          // Isolate layout checks from backend writes and production data.
          await page.route('**/api/**', route => route.fulfill({ json:
            route.request().url().endsWith('/tasks') ? [] : {} }));
          await page.goto(baseURL);
          await page.locator('nav').waitFor();
          for (const tab of ['Dashboard', 'Calendário', 'Mais']) {
            await page.getByRole('navigation').getByRole('button', { name: tab, exact: true }).click();
            for (const inset of [0, 21, 34, 96]) {
              // Simulate the CSS environment value without capping it.
              await page.locator('.hagenda-app-shell').evaluate((el, inset) =>
                el.style.setProperty('--app-safe-bottom', `${inset}px`), inset);
              await check(page, inset);
            }
          }
          await page.locator('.hagenda-app-shell').evaluate(el => el.style.removeProperty('--app-safe-bottom'));
          if (mode.startsWith('synthetic')) {
            // Keyboard shrink/pan while innerHeight remains unchanged, then dismissal.
            for (const state of [{ height: 300, pageTop: 80 }, { height: 350, pageTop: 0 }, { height: viewport.height, pageTop: 0 }]) {
              await page.evaluate(state => {
                Object.assign(visualViewport, state, { offsetTop: state.pageTop });
                visualViewport.dispatchEvent(new Event('resize'));
                visualViewport.dispatchEvent(new Event('scroll'));
              }, state);
              for (const tab of ['Dashboard', 'Calendário', 'Mais']) {
                await page.getByRole('navigation').getByRole('button', { name: tab, exact: true }).click();
                await check(page);
              }
              const measurement = await check(page);
              console.log(name, 'synthetic keyboard state:', JSON.stringify({ state, innerHeight: measurement.innerHeight, root: measurement.root.height, shell: measurement.shell.height, navBottom: measurement.nav.bottom }));
            }
            console.log(name, 'keyboard/pan/restore measurements:', JSON.stringify(await measure(page)));
          } else {
            await page.setViewportSize({ width: viewport.width, height: Math.max(300, viewport.height - 100) });
            await check(page);
            await page.setViewportSize(viewport);
            await check(page);
          }
          // Confirm a long main remains scrollable and cannot push the footer down.
          await page.locator('main').evaluate(main => {
            const content = document.createElement('div');
            content.style.height = '2000px';
            main.append(content);
            main.scrollTop = main.scrollHeight;
          });
          assert.ok(await page.locator('main').evaluate(main => main.scrollTop > 0));
          await check(page);
          assert.deepEqual(errors, []);
          console.log('PASS', name, mode, JSON.stringify(viewport));
          await page.close();
        }
      }
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
