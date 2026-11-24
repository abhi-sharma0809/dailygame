import { useEffect, useState } from 'react';

/*
 * Clean-path routing: simmly.io/play/daily, simmly.io/archive …
 * The browser history API does the work; the host (vercel.json) serves
 * index.html for every path so a reload or a shared link lands in the app.
 */

export interface Route {
  path: string[];
  query: URLSearchParams;
}

const NAV_EVENT = 'simmly:navigate';

// Old links used hash routes (simmly.io/#/play/daily): move them to the clean path.
function upgradeHashLink(): boolean {
  if (!window.location.hash.startsWith('#/')) return false;
  history.replaceState(null, '', window.location.hash.slice(1) || '/');
  return true;
}
if (typeof window !== 'undefined') upgradeHashLink();

function parse(): Route {
  return {
    path: window.location.pathname.split('/').filter(Boolean).map(decodeURIComponent),
    query: new URLSearchParams(window.location.search),
  };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo({ top: 0 });
    };
    // an old #/ link followed while the app is already open
    const onHash = () => { if (upgradeHashLink()) on(); };
    window.addEventListener('popstate', on);
    window.addEventListener(NAV_EVENT, on);
    window.addEventListener('hashchange', onHash);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener(NAV_EVENT, on); window.removeEventListener('hashchange', onHash); };
  }, []);
  return route;
}

export function navigate(to: string, replace = false) {
  const url = to.startsWith('/') ? to : `/${to}`;
  if (url === window.location.pathname + window.location.search) return;
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  window.dispatchEvent(new Event(NAV_EVENT));
}
