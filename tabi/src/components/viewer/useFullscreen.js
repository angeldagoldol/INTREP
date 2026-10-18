import { useCallback, useEffect, useState } from 'react';

function fullscreenElement() {
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
}

function canFullscreen() {
  if (typeof document === 'undefined') return false;
  return Boolean(document.fullscreenEnabled ?? document.webkitFullscreenEnabled);
}

/**
 * Leave fullscreen and resolve once the document has actually left it
 * (prefixed WebKit returns no promise), or after `timeout` ms at worst.
 * Until then everything outside the fullscreen element is inert, so focus
 * cannot move to UI rendered elsewhere (a drawer portalled to <body>).
 */
function exitFullscreen(timeout = 1000) {
  if (!fullscreenElement()) return Promise.resolve();
  return new Promise((resolve) => {
    let timer;
    const finish = () => {
      clearTimeout(timer);
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      resolve();
    };
    function onChange() {
      if (!fullscreenElement()) finish();
    }
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    timer = setTimeout(finish, timeout);
    try {
      Promise.resolve((document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document))
        .then(onChange)
        .catch(finish); // refused: nothing to wait for
    } catch {
      finish();
    }
  });
}

/**
 * Fullscreen API for one element, with the WebKit prefix as a fallback.
 * Returns { supported, active, toggle, exit }; `supported` is false on
 * browsers (notably iPhone Safari) that cannot fullscreen arbitrary
 * elements. `exit()` resolves once the document is out of fullscreen.
 */
export function useFullscreen(ref) {
  const [supported] = useState(canFullscreen);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () => setActive(Boolean(ref.current) && fullscreenElement() === ref.current);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [ref]);

  const exit = useCallback(() => exitFullscreen(), []);

  const toggle = useCallback(async () => {
    const el = ref.current;
    if (!el || !supported) return;
    if (fullscreenElement()) {
      await exitFullscreen();
      return;
    }
    try {
      await (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
    } catch {
      /* the browser refused (e.g. no user gesture) — stay as we are */
    }
  }, [ref, supported]);

  return { supported, active, toggle, exit };
}
