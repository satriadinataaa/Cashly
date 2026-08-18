const test = require('node:test');
const assert = require('node:assert/strict');

const routerPromise = import('../admin/src/router.mjs');

test('daftar key detail metrik stabil dan tidak dapat diubah', async () => {
  const { ADMIN_PAGE_VIEWS, METRIC_DETAIL_KEYS } = await routerPromise;

  assert.deepEqual(METRIC_DETAIL_KEYS, [
    'total-users',
    'active-users',
    'total-transactions',
    'transaction-volume',
  ]);
  assert.equal(Object.isFrozen(METRIC_DETAIL_KEYS), true);
  assert.deepEqual(ADMIN_PAGE_VIEWS, ['overview', 'users', 'transactions', 'reports']);
  assert.equal(Object.isFrozen(ADMIN_PAGE_VIEWS), true);
});

test('hash kosong dan overview menuju halaman overview', async () => {
  const { parseAdminRoute } = await routerPromise;

  for (const hash of ['', '#', '#overview', '  #overview  ']) {
    assert.deepEqual(parseAdminRoute(hash), { view: 'overview' });
  }

  for (const value of [undefined, null, 42, {}, []]) {
    assert.deepEqual(parseAdminRoute(value), { view: 'overview' });
  }
});

test('hash halaman sidebar menuju halaman admin terkait', async () => {
  const { parseAdminRoute } = await routerPromise;

  assert.deepEqual(parseAdminRoute('#users'), { view: 'users' });
  assert.deepEqual(parseAdminRoute('#%75sers'), { view: 'users' });
  assert.deepEqual(parseAdminRoute('#transactions'), { view: 'transactions' });
  assert.deepEqual(parseAdminRoute('#reports'), { view: 'reports' });
});

test('setiap key metrik memiliki rute detail', async () => {
  const { METRIC_DETAIL_KEYS, parseAdminRoute } = await routerPromise;

  for (const key of METRIC_DETAIL_KEYS) {
    assert.deepEqual(parseAdminRoute(`#detail/${key}`), { view: 'detail', key });
  }

  assert.deepEqual(parseAdminRoute('#detail/total%2Dusers'), {
    view: 'detail',
    key: 'total-users',
  });
});

test('rute asing dan malformed menjadi unavailable dengan target aman', async () => {
  const { parseAdminRoute } = await routerPromise;

  assert.deepEqual(parseAdminRoute('#settings'), { view: 'unavailable', target: 'settings' });
  assert.deepEqual(parseAdminRoute('#detail/unknown-metric'), {
    view: 'unavailable',
    target: 'unknown-metric',
  });
  assert.equal(parseAdminRoute('#detail').view, 'unavailable');
  assert.equal(parseAdminRoute('#detail/total-users/extra').view, 'unavailable');
  assert.deepEqual(parseAdminRoute('#detail/%E0%A4%A'), {
    view: 'unavailable',
    target: 'invalid-route',
  });
});

test('traversal dan script terenkode tidak pernah diteruskan sebagai HTML', async () => {
  const { parseAdminRoute } = await routerPromise;
  const unsafeHashes = [
    '#detail/%2e%2e%2fusers',
    '#%3Cscript%3Ealert(1)%3C%2Fscript%3E',
    '#detail/%3Cimg%20src=x%20onerror=alert(1)%3E',
    '#detail/%00total-users',
  ];

  for (const hash of unsafeHashes) {
    const route = parseAdminRoute(hash);
    assert.equal(route.view, 'unavailable');
    assert.match(route.target, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.doesNotMatch(route.target, /[<>&"']/);
  }
});

test('adminRouteHash menghasilkan hash kanonis dan menolak detail asing', async () => {
  const { adminRouteHash } = await routerPromise;

  assert.equal(adminRouteHash({ view: 'overview' }), '#overview');
  assert.equal(adminRouteHash({ view: 'users' }), '#users');
  assert.equal(adminRouteHash({ view: 'transactions' }), '#transactions');
  assert.equal(adminRouteHash({ view: 'reports' }), '#reports');
  assert.equal(
    adminRouteHash({ view: 'detail', key: 'active-users' }),
    '#detail/active-users',
  );
  assert.equal(adminRouteHash({ view: 'detail', key: 'not-allowed' }), '#overview');
  assert.equal(adminRouteHash({ view: 'unavailable', target: '<script>' }), '#overview');
  assert.equal(adminRouteHash(null), '#overview');
});

test('rute yang didukung dapat round-trip melalui hash kanonis', async () => {
  const { METRIC_DETAIL_KEYS, adminRouteHash, parseAdminRoute } = await routerPromise;
  const routes = [
    { view: 'overview' },
    { view: 'users' },
    { view: 'transactions' },
    { view: 'reports' },
    ...METRIC_DETAIL_KEYS.map(key => ({ view: 'detail', key })),
  ];

  for (const route of routes) {
    assert.deepEqual(parseAdminRoute(adminRouteHash(route)), route);
  }
});
