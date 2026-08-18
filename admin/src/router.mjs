export const METRIC_DETAIL_KEYS = Object.freeze([
  'total-users',
  'active-users',
  'total-transactions',
  'transaction-volume',
]);

const metricDetailKeySet = new Set(METRIC_DETAIL_KEYS);

function overviewRoute() {
  return { view: 'overview' };
}

function safeTarget(value) {
  const normalized = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');

  return normalized || 'unknown-route';
}

/**
 * Parse a location hash into the small set of views supported by the admin UI.
 * Unknown values are reduced to a display-safe token; callers never receive raw
 * markup or an unchecked metric key.
 */
export function parseAdminRoute(hash) {
  if (typeof hash !== 'string') return overviewRoute();

  const rawHash = hash.trim();
  if (!rawHash || rawHash === '#') return overviewRoute();

  const rawFragment = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  let fragment;

  try {
    fragment = decodeURIComponent(rawFragment).trim();
  } catch {
    return { view: 'unavailable', target: 'invalid-route' };
  }

  if (!fragment || fragment === 'overview') return overviewRoute();
  if (fragment === 'users') return { view: 'users' };

  const parts = fragment.split('/');
  if (parts.length === 2 && parts[0] === 'detail') {
    const key = parts[1];
    if (metricDetailKeySet.has(key)) return { view: 'detail', key };
    return { view: 'unavailable', target: safeTarget(key) };
  }

  return { view: 'unavailable', target: safeTarget(fragment) };
}

/**
 * Turn an admin route back into its canonical location hash. Invalid or
 * unsupported route objects safely fall back to the overview.
 */
export function adminRouteHash(route) {
  if (route?.view === 'users') return '#users';
  if (route?.view === 'detail' && metricDetailKeySet.has(route.key)) {
    return `#detail/${route.key}`;
  }
  return '#overview';
}
