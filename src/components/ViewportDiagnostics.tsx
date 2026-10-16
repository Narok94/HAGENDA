import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const selectors = ['html', 'body', '#root', '.hagenda-app-shell', 'nav'] as const;
const px = (value: number) => Math.round(value * 100) / 100;

/** Whitelisted geometry only: never read page text, user data, storage or tasks. */
function readDiagnostic(probe: HTMLElement) {
  const viewport = window.visualViewport;
  const elements = Object.fromEntries(selectors.map(selector => {
    const element = document.querySelector(selector);
    if (!element) return [selector, null];
    const rect = element.getBoundingClientRect();
    const css = getComputedStyle(element);
    return [selector, {
      top: px(rect.top), bottom: px(rect.bottom), height: px(rect.height),
      clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
      position: css.position, cssHeight: css.height, paddingBottom: css.paddingBottom,
    }];
  }));
  const nav = document.querySelector('nav')?.getBoundingClientRect();
  const visibleBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
  const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const navigatorStandalone = (navigator as Navigator & { standalone?: boolean }).standalone ?? null;
  return {
    build: __HAGENDA_BUILD__,
    measuredAt: new Date().toISOString(),
    standalone: { active: displayModeStandalone || navigatorStandalone === true,
      displayMode: displayModeStandalone, navigator: navigatorStandalone },
    innerHeight: window.innerHeight,
    visualViewport: viewport ? { height: px(viewport.height), offsetTop: px(viewport.offsetTop),
      pageTop: px(viewport.pageTop), scale: viewport.scale } : null,
    screenHeight: window.screen.height,
    scrollY: px(window.scrollY),
    elements,
    navBottom: nav ? px(nav.bottom) : null,
    safeAreaInsetBottom: px(probe.getBoundingClientRect().height),
    visibleViewportBottom: px(visibleBottom),
    gapBelowNav: nav ? px(visibleBottom - nav.bottom) : null,
  };
}

type Diagnostic = ReturnType<typeof readDiagnostic>;

function DiagnosticPanel({ onClose }: { onClose: () => void }) {
  const probeRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [manualCopy, setManualCopy] = useState('');

  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    let frame = 0;
    const update = () => setDiagnostic(readDiagnostic(probe));
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const viewport = window.visualViewport;
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const observer = new ResizeObserver(schedule);
    selectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) observer.observe(element);
    });
    observer.observe(probe);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    displayMode.addEventListener('change', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule);
    window.addEventListener('pageshow', schedule);
    const timer = window.setInterval(update, 500);
    update();
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      observer.disconnect();
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      displayMode.removeEventListener('change', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('pageshow', schedule);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  const copy = async () => {
    if (!probeRef.current) return;
    const latest = readDiagnostic(probeRef.current);
    setDiagnostic(latest);
    const text = JSON.stringify(latest, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setManualCopy('');
      setCopyStatus('Diagnóstico copiado.');
    } catch {
      // Keep the exact snapshot available without requiring clipboard permission.
      setManualCopy(text);
      setCopyStatus('Não foi possível copiar automaticamente. Selecione e copie o texto abaixo.');
    }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="viewport-diagnostic-title"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
        if (event.key === 'Tab') {
          const buttons = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button, textarea'));
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}
      className="fixed inset-0 z-[100] flex flex-col bg-white text-[#0E1730]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div ref={probeRef} aria-hidden="true" data-safe-area-probe="bottom"
        style={{ position: 'fixed', top: 0, left: 0, width: 0,
          height: 'env(safe-area-inset-bottom, 0px)', visibility: 'hidden', pointerEvents: 'none' }} />
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E3E8F1] p-4">
        <h2 id="viewport-diagnostic-title" className="text-base font-bold">Diagnóstico do rodapé</h2>
        <button ref={closeRef} type="button" onClick={onClose}
          className="min-h-11 rounded-lg border border-[#E3E8F1] px-3 text-sm">Voltar</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 text-xs">
        <p className="mb-3">Painel temporário · atualização a cada 0,5 s. Apenas dimensões e identificação do build; sem dados pessoais ou tarefas.</p>
        <button type="button" onClick={copy} className="mb-2 min-h-11 rounded-lg bg-[#2F5CFF] px-4 font-semibold text-white">Copiar diagnóstico</button>
        <p role="status" className="mb-3">{copyStatus}</p>
        {manualCopy && <textarea aria-label="Diagnóstico para copiar manualmente" readOnly value={manualCopy}
          onFocus={event => event.currentTarget.select()} className="mb-4 h-48 w-full rounded-lg border p-2 font-mono" />}
        <p className="mb-3">gapBelowNav: positivo = espaço abaixo da barra; negativo = barra além da viewport visível. Valores em px CSS.</p>
        <pre data-viewport-diagnostic className="whitespace-pre-wrap break-all rounded-lg bg-[#F3F5FA] p-3 font-mono text-[11px] leading-relaxed">{diagnostic ? JSON.stringify(diagnostic, null, 2) : 'Medindo…'}</pre>
      </div>
    </div>, document.body,
  );
}

export default function ViewportDiagnostics() {
  const [isOpen, setIsOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setIsOpen(true)}
      className="min-h-11 w-full rounded-xl border border-[#E3E8F1] bg-[#F3F5FA] px-3 py-2 text-sm font-semibold text-[#0E1730]">
      Diagnóstico do rodapé (temporário)
    </button>
    {isOpen && <DiagnosticPanel onClose={() => setIsOpen(false)} />}
  </>;
}
