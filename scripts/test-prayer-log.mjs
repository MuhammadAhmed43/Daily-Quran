// Mirror of togglePrayer + derive (lib/prayer-log.ts) — verify the reducer invariants without a
// device: mark/unmark, count, prune empty days, log-on-mark-only, and the rolling 7-day window.
//   node scripts/test-prayer-log.mjs
const FARD = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

let logCount = 0; // mock recordActivity('prayer_logged')
function toggle(store, name, day) {
  const m = (store.days[day] ??= {});
  if (m[name]) {
    delete m[name];
    if (Object.keys(m).length === 0) delete store.days[day];
  } else {
    m[name] = true;
    logCount++;
  }
}
const count = (store, key) => FARD.reduce((n, p) => n + (store.days[key]?.[p] ? 1 : 0), 0);
function last7(store) {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const k = dayKey(addDays(new Date(), -i));
    out.push({ key: k, count: count(store, k) });
  }
  return out;
}

let fails = 0;
const ok = (c, m) => {
  if (!c) {
    fails++;
    console.log('  ✗ ' + m);
  } else console.log('  ✓ ' + m);
};

const today = dayKey(new Date());
const store = { v: 1, days: {} };

toggle(store, 'fajr', today);
ok(count(store, today) === 1, 'mark fajr -> count 1');
ok(store.days[today]?.fajr === true, 'fajr stored true');
ok(logCount === 1, 'marking logs prayer_logged once');

toggle(store, 'fajr', today);
ok(count(store, today) === 0, 'unmark fajr -> count 0');
ok(store.days[today] === undefined, 'empty day pruned from store');
ok(logCount === 1, 'unmarking does NOT log');

for (const p of FARD) toggle(store, p, today);
ok(count(store, today) === 5, 'all five -> count 5');
ok(logCount === 6, 'five more logs (total 6)');

const l7 = last7(store);
ok(l7.length === 7, 'last7 returns 7 days');
ok(l7[6].key === today, 'last entry is today');
ok(l7[6].count === 5, 'today shows 5 in last7');
ok(l7.slice(0, 6).every((d) => d.count === 0), 'prior 6 days empty');

const yest = dayKey(addDays(new Date(), -1));
store.days[yest] = { fajr: true, isha: true };
ok(last7(store)[5].count === 2, 'yesterday (2 prayers) shows in last7');

const old = dayKey(addDays(new Date(), -9)); // outside the 7-day window
store.days[old] = { fajr: true };
ok(
  last7(store).every((d) => d.key !== old),
  'a 9-day-old entry is outside the window (kept in store, not shown)',
);

console.log(fails === 0 ? '\n✅ PRAYER-LOG INVARIANTS HOLD' : `\n❌ ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
