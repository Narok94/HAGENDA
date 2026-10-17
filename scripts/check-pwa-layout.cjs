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

async function check(page, safeBottom = 0, expectedHeight = null, expectedTop = null) {
  await page.waitForFunction(({ expectedHeight, expectedTop }) => {
    const viewport = window.visualViewport;
    const rect = document.querySelector('#root').getBoundingClientRect();
    const height = expectedHeight ?? viewport?.height ?? innerHeight;
    const top = expectedTop ?? ((viewport?.pageTop ?? 0) - scrollY);
    return Math.abs(rect.height - height) < 1 && Math.abs(rect.top - top) < 1;
  }, { expectedHeight, expectedTop });
  const m = await measure(page);
  const height = expectedHeight ?? m.viewport?.height ?? m.innerHeight;
  const top = expectedTop ?? ((m.viewport?.pageTop ?? 0) - m.scrollY);
  for (const element of ['root', 'shell']) {
    assert.ok(Math.abs(m[element].height - height) < 1, JSON.stringify(m));
    assert.ok(Math.abs(m[element].top - top) < 1, JSON.stringify(m));
  }
  assert.ok(Math.abs(m.nav.bottom - (top + height)) < 1, JSON.stringify(m));
  assert.ok(Math.abs(m.main.bottom - m.nav.top) < 1, JSON.stringify(m));
  assert.equal(m.nav.paddingBottom, Math.max(4, safeBottom));
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
      for (const viewport of [{ width: 414, height: 896 }, { width: 390, height: 844 }, { width: 375, height: 667 }, { width: 844, height: 390 }]) {
        for (const mode of ['native viewport', 'synthetic standalone/keyboard', 'synthetic browser/keyboard', 'no VisualViewport']) {
          const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
          const standalone = mode === 'synthetic standalone/keyboard';
          const restingHeight = mode.startsWith('synthetic') ? viewport.height - 48 : viewport.height;
          const restCheck = async (inset = 0) => {
            const m = await check(page, inset, standalone ? viewport.height : null, standalone ? 0 : null);
            if (standalone) {
              assert.equal(m.html.height, viewport.height);
              assert.equal(m.body.height, viewport.height);
            }
            return m;
          };
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.addInitScript(({ mode, viewport, restingHeight, standalone }) => {
            if (mode === 'no VisualViewport') {
              Object.defineProperty(window, 'visualViewport', { value: undefined });
            } else if (mode.startsWith('synthetic')) {
              const vv = new EventTarget();
              Object.assign(vv, { height: restingHeight, pageTop: 0, offsetTop: 0, scale: 1 });
              Object.defineProperty(window, 'visualViewport', { value: vv });
              Object.defineProperty(navigator, 'standalone', { value: standalone });
            }
          }, { mode, viewport, restingHeight, standalone });
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
              await restCheck(inset);
            }
          }
          await page.locator('.hagenda-app-shell').evaluate(el => el.style.removeProperty('--app-safe-bottom'));
          if (mode.startsWith('synthetic')) {
            // Reproduce 896 CSS viewport / 848 VisualViewport without using screen.height.
            await restCheck();
            await page.locator('main').evaluate(main => {
              const input = document.createElement('input');
              input.setAttribute('data-keyboard-test', '');
              main.prepend(input);
              input.focus({ preventScroll: true });
            });
            // Allow the focus event to settle before the synthetic keyboard resizes.
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await restCheck(); // Focus alone must not turn the 48px API discrepancy into a keyboard.
            for (const state of [
              { height: Math.floor(restingHeight * 0.45), pageTop: 40 },
              { height: Math.floor(restingHeight * 0.55), pageTop: 0 },
              { height: restingHeight, pageTop: 0 },
            ]) {
              await page.evaluate(state => {
                Object.assign(visualViewport, state, { offsetTop: state.pageTop });
                visualViewport.dispatchEvent(new Event('resize'));
                visualViewport.dispatchEvent(new Event('scroll'));
              }, state);
              const restored = state.height === restingHeight;
              const expectedHeight = restored && standalone ? viewport.height : state.height;
              for (const tab of ['Dashboard', 'Calendário', 'Mais']) {
                await page.getByRole('navigation').getByRole('button', { name: tab, exact: true }).click();
                await check(page, 0, expectedHeight, state.pageTop);
              }
              const measurement = await check(page, 0, expectedHeight, state.pageTop);
              console.log(name, mode, JSON.stringify({ visualHeight: state.height, innerHeight: measurement.innerHeight,
                rootHeight: measurement.root.height, navBottom: measurement.nav.bottom }));
            }
            await page.locator('[data-keyboard-test]').evaluate(input => input.remove());
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
          await restCheck();
          assert.deepEqual(errors, []);
          console.log('PASS', name, mode, JSON.stringify(viewport));
          await page.close();
        }
      }
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
