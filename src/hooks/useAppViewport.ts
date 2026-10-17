import { useLayoutEffect } from 'react';

function hasKeyboardFocus() {
  const element = document.activeElement;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled;
  if (element instanceof HTMLInputElement) {
    return !element.readOnly && !element.disabled &&
      !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

/** Standalone uses the CSS layout viewport at rest. VisualViewport can exclude
 * drawable space on iOS; use it there only while an editing keyboard shrinks it.
 * Browser mode continues to follow its visible viewport/toolbars.
 */
export function useAppViewport() {
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const root = document.getElementById('root');
    if (!root) return;
    const displayMode = window.matchMedia('(display-mode: standalone)');
    let frame = 0;
    let restingVisualHeight: number | null = null;
    let keyboardActive = false;
    let previousMode: boolean | null = null;

    const clearVisualSize = () => {
      root.style.removeProperty('--app-viewport-height');
      root.style.removeProperty('--app-viewport-top');
    };
    const update = () => {
      const standalone = displayMode.matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      document.documentElement.dataset.appDisplayMode = standalone ? 'standalone' : 'browser';
      if (previousMode !== standalone) {
        restingVisualHeight = null;
        keyboardActive = false;
        previousMode = standalone;
      }
      if (!viewport || viewport.height <= 0) {
        clearVisualSize();
        return;
      }
      if (standalone) {
        restingVisualHeight ??= viewport.height;
        const editing = hasKeyboardFocus();
        // Compare with the resting VISUAL height, not CSS vh: their difference
        // at rest is the iOS bug we must not mistake for an open keyboard.
        if (editing && viewport.height < restingVisualHeight) keyboardActive = true;
        if (keyboardActive && viewport.height >= restingVisualHeight) keyboardActive = false;
        if (!keyboardActive) {
          if (!editing) restingVisualHeight = viewport.height;
          clearVisualSize();
          return;
        }
      }
      root.style.setProperty('--app-viewport-height', `${viewport.height}px`);
      // Root is absolute in document coordinates, so use pageTop, not offsetTop.
      root.style.setProperty('--app-viewport-top', `${viewport.pageTop}px`);
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const orientationChanged = () => {
      restingVisualHeight = null;
      keyboardActive = false;
      scheduleUpdate();
    };

    update();
    viewport?.addEventListener('resize', scheduleUpdate);
    viewport?.addEventListener('scroll', scheduleUpdate);
    displayMode.addEventListener('change', scheduleUpdate);
    document.addEventListener('focusin', scheduleUpdate);
    document.addEventListener('focusout', scheduleUpdate);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', orientationChanged);
    window.addEventListener('pageshow', scheduleUpdate);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', scheduleUpdate);
      viewport?.removeEventListener('scroll', scheduleUpdate);
      displayMode.removeEventListener('change', scheduleUpdate);
      document.removeEventListener('focusin', scheduleUpdate);
      document.removeEventListener('focusout', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('orientationchange', orientationChanged);
      window.removeEventListener('pageshow', scheduleUpdate);
      delete document.documentElement.dataset.appDisplayMode;
      clearVisualSize();
    };
  }, []);
}
