import { useLayoutEffect } from 'react';

/** Size the app to the visible viewport, including keyboard resize/panning.
 * CSS supplies the fallback when VisualViewport is unavailable.
 */
export function useAppViewport() {
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const root = document.getElementById('root');
    if (!viewport || !root) return;

    let frame = 0;
    const update = () => {
      // Ignore transient zero measurements while the app is backgrounded.
      if (viewport.height <= 0) return;
      root.style.setProperty('--app-viewport-height', `${viewport.height}px`);
      // Root is absolute in document coordinates, so use pageTop, not offsetTop.
      root.style.setProperty('--app-viewport-top', `${viewport.pageTop}px`);
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    viewport.addEventListener('resize', scheduleUpdate);
    viewport.addEventListener('scroll', scheduleUpdate);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('pageshow', scheduleUpdate);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', scheduleUpdate);
      viewport.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('pageshow', scheduleUpdate);
      root.style.removeProperty('--app-viewport-height');
      root.style.removeProperty('--app-viewport-top');
    };
  }, []);
}
