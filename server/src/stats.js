/* =====================================================================
   STATISTIQUES FOKUS — tableau de bord du propriétaire (une seule instance « Stats », base SQLite)
   - Présence : chaque appareil ouvert envoie un signal anonyme (/ping) toutes les minutes avec un numéro tiré au hasard
     (aucun nom, aucune tâche) : « en ligne » = signal reçu dans les 130 dernières secondes (gardé en mémoire).
   - Totaux par jour (fuseau Europe/Paris) : visiteurs uniques (appareils), temps passé dans l'app (onglet visible),
     minutes de concentration, tâches validées, comptes créés.
   - Registre des comptes : adresse e-mail, date de création, dernière visite, moyen de connexion (Google / code).
   ===================================================================== */
const TZ = 'Europe/Paris';
export const ONLINE_MS = 130e3;
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export const dayKey = (t = Date.now()) => fmt.format(t); // AAAA-MM-JJ

/* Début de chaque période (chaînes AAAA-MM-JJ, comparables directement) */
export function periodStarts(today = dayKey()) {
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const monday = new Date(dt.getTime() - ((dt.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10);
  return { today, week: monday, month: today.slice(0, 8) + '01', year: today.slice(0, 5) + '01-01', all: '0000-00-00' };
}

export class Stats {
  constructor(state) {
    this.sql = state.storage.sql;
    this.live = new Map(); // appareil → { seen, acc }
    this.seenAcc = new Map(); // compte → dernière écriture de « dernière visite » (une par 10 min au plus)
    this.sql.exec('CREATE TABLE IF NOT EXISTS visits (day TEXT NOT NULL, vid TEXT NOT NULL, PRIMARY KEY (day, vid))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, secs INTEGER NOT NULL DEFAULT 0, focus INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0, signups INTEGER NOT NULL DEFAULT 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL, created INTEGER NOT NULL, seen INTEGER NOT NULL, via TEXT NOT NULL)');
  }

  add(day, col, n) {
    if (!n) return;
    this.sql.exec(`INSERT INTO days (day, ${col}) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET ${col} = ${col} + excluded.${col}`, day, n);
  }

  online(now = Date.now()) {
    let n = 0, acc = 0;
    for (const [k, v] of this.live) {
      if (now - v.seen > ONLINE_MS) this.live.delete(k);
      else { n++; if (v.acc) acc++; }
    }
    return { online: n, onlineAccounts: acc };
  }

  async fetch(req) {
    const path = new URL(req.url).pathname, b = await req.json(), now = Date.now(), day = dayKey(now);
    if (path === '/ping') {
      if (b.bye) this.live.delete(b.vid); else this.live.set(b.vid, { seen: now, acc: b.acc || null });
      this.sql.exec('INSERT OR IGNORE INTO visits (day, vid) VALUES (?, ?)', day, b.vid);
      if (b.s || b.f || b.t) {
        this.sql.exec('INSERT INTO days (day, secs, focus, done) VALUES (?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET secs = secs + excluded.secs, focus = focus + excluded.focus, done = done + excluded.done', day, b.s | 0, b.f | 0, b.t | 0);
      }
      if (b.acc && now - (this.seenAcc.get(b.acc) || 0) > 600e3) {
        this.seenAcc.set(b.acc, now);
        this.sql.exec('UPDATE accounts SET seen = ? WHERE id = ?', now, b.acc);
      }
      return Response.json({ ok: true });
    }
    if (path === '/login') { // à chaque connexion ; crée l'entrée la première fois
      const had = this.sql.exec('SELECT id FROM accounts WHERE id = ?', b.id).toArray().length;
      if (had) this.sql.exec('UPDATE accounts SET seen = ?, email = ? WHERE id = ?', now, b.email, b.id);
      else {
        this.sql.exec('INSERT INTO accounts (id, email, created, seen, via) VALUES (?, ?, ?, ?, ?)', b.id, b.email, now, now, b.via || 'email');
        this.add(day, 'signups', 1);
      }
      return Response.json({ ok: true, isNew: !had });
    }
    if (path === '/forget') { this.sql.exec('DELETE FROM accounts WHERE id = ?', b.id); return Response.json({ ok: true }); }
    if (path === '/whois') {
      const r = this.sql.exec('SELECT email FROM accounts WHERE id = ?', b.id).toArray()[0];
      return Response.json({ email: r ? r.email : '' });
    }
    if (path === '/summary') {
      const starts = periodStarts(day), periods = {};
      for (const [k, from] of Object.entries(starts)) {
        const v = this.sql.exec('SELECT COUNT(DISTINCT vid) AS n FROM visits WHERE day >= ?', from).toArray()[0];
        const t = this.sql.exec('SELECT COALESCE(SUM(secs), 0) AS secs, COALESCE(SUM(focus), 0) AS focus, COALESCE(SUM(done), 0) AS done, COALESCE(SUM(signups), 0) AS signups FROM days WHERE day >= ?', from).toArray()[0];
        periods[k] = { from, visitors: v.n, secs: t.secs, focus: t.focus, done: t.done, signups: t.signups };
      }
      const from30 = dayKey(now - 29 * 864e5);
      const vis = Object.fromEntries(this.sql.exec('SELECT day, COUNT(*) AS n FROM visits WHERE day >= ? GROUP BY day', from30).toArray().map((r) => [r.day, r.n]));
      const tot = Object.fromEntries(this.sql.exec('SELECT day, secs, signups FROM days WHERE day >= ?', from30).toArray().map((r) => [r.day, r]));
      const daily = [];
      for (let i = 29; i >= 0; i--) {
        const d = dayKey(now - i * 864e5);
        if (daily.length && daily[daily.length - 1].day === d) continue; // changement d'heure
        daily.push({ day: d, visitors: vis[d] || 0, secs: tot[d]?.secs || 0, signups: tot[d]?.signups || 0 });
      }
      const accounts = this.sql.exec('SELECT COUNT(*) AS n FROM accounts').toArray()[0].n;
      return Response.json({ ...this.online(now), periods, daily, accounts, at: now });
    }
    if (path === '/accounts') {
      return Response.json({ accounts: this.sql.exec('SELECT email, created, seen, via FROM accounts ORDER BY created DESC').toArray() });
    }
    return Response.json({ error: 'not found' }, { status: 404 });
  }
}
