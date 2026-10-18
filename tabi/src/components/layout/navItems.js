/** Primary navigation, shared by the desktop bar and the mobile menu. */
export const NAV_ITEMS = [
  { to: '/', label: 'Home', jp: 'ホーム', end: true },
  { to: '/brochures', label: 'Brochures', jp: 'パンフレット' },
  { to: '/studio', label: 'Studio', jp: 'スタジオ' },
];

/** The viewer (/brochures/:slug) is immersive reading: compact chrome, no footer. */
export function isImmersivePath(pathname) {
  return /^\/brochures\/[^/]+\/?$/.test(pathname);
}
