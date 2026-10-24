import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import gsap from 'gsap';
import { K, dayLabel, parseK } from '../lib/dates';
import { ZEN_BLUE, getColorForPercentage } from '../lib/colors';
import { BADGES, BADGE_CATS, TIERS, badgeCtx, clearNewBadge, toast, focusToday, now, setModal, stats, streaks, todayKey, useStore, METEO, zenOn } from '../store';
import { fmtMin } from './TaskList';
import FocusStats from './FocusStats';
import Medal from './Medal';

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const VIEWS = [['w', 'Semaine'], ['m', 'Mois'], ['y', 'Année']];
const longDate = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const sum = (a, f) => a.reduce((s, x) => s + x[f], 0);

function buildPeriod(view, S) {
  const n = now(), Y = n.getFullYear(), tk = K(n);
  const dayData = (d) => {
    const k = K(d);
    if (k === tk) { const s = stats(S.tasks); return { p: s.p, d: s.c, t: s.n, fm: focusToday(S), tg: todayTags(S), cg: todayCats(S) }; }
    return k < tk ? S.hist[k] || null : null;
  };
  let groups, labels, titles;
  if (view === 'w') {
    const m = new Date(Y, n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7));
    groups = [...Array(7)].map((_, i) => [new Date(m.getFullYear(), m.getMonth(), m.getDate() + i)]);
    labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    titles = groups.map((g) => longDate(g[0]));
  } else if (view === 'm') {
    const N = new Date(Y, n.getMonth() + 1, 0).getDate();
    groups = [...Array(N)].map((_, i) => [new Date(Y, n.getMonth(), i + 1)]);
    labels = groups.map((_, i) => i + 1);
    titles = groups.map((g) => longDate(g[0]));
  } else {
    groups = MOIS.map((_, m) => [...Array(new Date(Y, m + 1, 0).getDate())].map((_, i) => new Date(Y, m, i + 1)));
    labels = MOIS.map((x) => x.slice(0, 3));
    titles = MOIS.map((x) => x + ' ' + Y);
  }
  const pts = groups.map((g) => {
    const a = g.map(dayData).filter(Boolean);
    if (a.length) return { p: Math.round(sum(a, 'p') / a.length), n: a.length, d: sum(a, 'd'), t: sum(a, 't'), fm: sumF(a) };
    return g[0] <= n ? { p: 0, n: 0, d: 0, t: 0, fm: 0 } : null;
  });
  const all = groups.flat().map(dayData).filter(Boolean);
  const avg = all.length ? Math.round(sum(all, 'p') / all.length) : 0;
  // tâches validées par étiquette sur la période
  const tg = {};
  all.forEach((h) => Object.entries(h.tg || {}).forEach(([id, c]) => { tg[id] = (tg[id] || 0) + c; }));
  // par catégorie : tâches validées (historique) et temps de concentration (journal des sessions)
  const cg = {}, cm = {};
  all.forEach((h) => Object.entries(h.cg || {}).forEach(([id, c]) => { cg[id] = (cg[id] || 0) + c; }));
  const g0 = groups[0][0], g1 = groups[groups.length - 1].at(-1);
  const t0 = new Date(g0.getFullYear(), g0.getMonth(), g0.getDate()) / 1000, t1 = new Date(g1.getFullYear(), g1.getMonth(), g1.getDate() + 1) / 1000;
  S.sessions.forEach((x) => { if (x[7] && x[0] >= t0 && x[0] < t1) cm[x[7]] = (cm[x[7]] || 0) + x[1] / 60; });
  return { labels, titles, pts, avg, fm: sumF(all), tg, cg, cm };
}
const sumF = (a) => a.reduce((s, x) => s + (x.fm || 0), 0);
function todayCats(S) {
  const cg = {}, tk = todayKey();
  S.tasks.forEach((t) => { if (t.done && t.cat && t.date && t.date <= tk) cg[t.cat] = (cg[t.cat] || 0) + 1; });
  return cg;
}
function todayTags(S) {
  const tg = {}, tk = todayKey();
  S.tasks.forEach((t) => { if (t.done && t.date && t.date <= tk) t.tags.forEach((g) => { tg[g] = (tg[g] || 0) + 1; }); });
  return tg;
}

/* Calendrier de chaleur : 12 mois, une case par jour, couleur getColorForPercentage ; tap = détail du jour */
function Heatmap({ S }) {
  const tk = todayKey(), t = parseK(tk);
  const [pick, setPick] = useState(tk);
  const months = [...Array(12)].map((_, i) => new Date(t.getFullYear(), t.getMonth() - 11 + i, 1));
  const live = stats(S.tasks), zen = zenOn(S);
  // Tranquille : intensité de bleu selon le nombre de tâches faites (jamais un pourcentage)
  const dMax = zen ? Math.max(1, live.c, ...Object.values(S.hist).map((x) => x.d || 0)) : 1;
  const tint = (d) => (zen ? (d.d ? `rgba(96,165,250,${(0.28 + 0.72 * Math.min(1, d.d / dMax)).toFixed(2)})` : undefined) : getColorForPercentage(d.p));
  const data = (k) => (k === tk ? (live.n ? { p: live.p, d: live.c, t: live.n, pd: live.pd, pt: live.pt, pr: live.pr, prt: live.prt, fm: focusToday(S) } : null) : S.hist[k]);
  const h = data(pick);
  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <b className="text-[15px]">Calendrier de l’année</b>
        <span className="text-[12px] text-mut">Touchez un jour pour le détail</span>
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
        {months.map((m) => {
          const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(), lead = (m.getDay() + 6) % 7;
          return (
            <div key={m.getMonth() + '-' + m.getFullYear()}>
              <div className="mb-1 text-[11px] text-mut capitalize">{m.toLocaleDateString('fr-FR', { month: 'short' })}</div>
              <div className="hm">
                {[...Array(lead)].map((_, i) => <span key={'e' + i} />)}
                {[...Array(dim)].map((_, i) => {
                  const k = K(new Date(m.getFullYear(), m.getMonth(), i + 1)), d = data(k), fut = k > tk;
                  const bg = d && d.t > 0 ? tint(d) : undefined;
                  return (
                    <button
                      type="button" key={k} disabled={fut}
                      className={'hc ' + (k === pick ? 'pick ' : '') + (d?.jk ? 'jk ' : '') + (fut ? 'fut' : '')}
                      style={bg ? { background: bg } : undefined}
                      title={`${dayLabel(k, tk)} : ${d && d.t ? (zen ? `${d.d} faite${d.d > 1 ? 's' : ''}` : d.p + ' %') : 'aucune donnée'}`}
                      onClick={() => setPick(k)} onMouseEnter={() => setPick(k)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-xl border border-line bg-cont px-4 py-3 text-[14px]">
        <b className="mr-2">{dayLabel(pick, tk)}</b>
        {h && h.t > 0 && zen ? (
          <span className="text-mut tabular-nums"><b style={{ color: ZEN_BLUE }}>{h.d} tâche{h.d > 1 ? 's' : ''} faite{h.d > 1 ? 's' : ''}</b>{h.fm > 0 && ` · ⏱ ${fmtMin(h.fm)}`}</span>
        ) : h && h.t > 0 ? (
          <span className="text-mut tabular-nums">
            <b style={{ color: getColorForPercentage(h.p) }}>{h.p} %</b> · {h.d}/{h.t} tâches · {h.pd ?? h.d}/{h.pt ?? h.t} pts
            {h.prt > 0 && ` · Priorités ${h.pr}/${h.prt}`}{h.fm > 0 && ` · ⏱ ${fmtMin(h.fm)}`}{h.jk && ' · 🃏 joker utilisé'}
          </span>
        ) : <span className="text-mut">Aucune donnée ce jour-là.</span>}
      </div>
    </div>
  );
}

/* Vitrine des badges (masquable dans les réglages) */
function Badges({ S }) {
  const { UI } = useStore();
  const box = useRef(null);
  useLayoutEffect(() => {
    if (!UI.newBadge || !box.current) return;
    const el = box.current.querySelector(`[data-b="${UI.newBadge}"]`);
    if (el) gsap.fromTo(el, { scale: 0.6, boxShadow: '0 0 0 rgba(255,255,255,0)' }, { scale: 1, boxShadow: '0 0 34px rgba(255,255,255,.35)', duration: 0.9, ease: 'elastic.out(1,.5)', onComplete: () => gsap.to(el, { boxShadow: '0 0 0 rgba(255,255,255,0)', duration: 1.2, clearProps: 'boxShadow,transform' }) });
    clearNewBadge();
  }, [UI.newBadge]);
  const n = BADGES.filter((b) => S.badges[b.id]).length;
  const c = useMemo(() => badgeCtx(S), [S]);
  // badges en minutes (concentration) : affichés en heures
  const fmt = (b, v) => (/^(focus\d|day\dh|week\d+h|deep)/.test(b.id) ? `${fmtMin(v)} / ${fmtMin(b.goal)}` : `${v} / ${b.goal}`);
  const info = (b, d, v) => toast(d ? `🏅 ${b.name} — ${TIERS[b.tier]}, obtenu le ${parseK(d).toLocaleDateString('fr-FR')}` : `${b.name} — ${TIERS[b.tier]} · ${fmt(b, v)}`, null, 3800);
  return (
    <div className="card">
      <div className="mb-1 flex items-baseline justify-between"><b className="text-[15px]">Badges</b><span className="text-[12px] text-mut tabular-nums">{n} / {BADGES.length}</span></div>
      <div ref={box}>
        {BADGE_CATS.map(([cat, label]) => {
          const list = BADGES.filter((b) => b.cat === cat), got = list.filter((b) => S.badges[b.id]).length;
          return (
            <section key={cat} className="mt-3">
              <div className="mb-2 flex items-baseline justify-between text-[12px] tracking-wide text-mut uppercase"><span>{label}</span><span className="tabular-nums">{got} / {list.length}</span></div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                {list.map((b) => {
                  const d = S.badges[b.id], v = Math.min(b.goal, Math.floor(b.v(c) || 0)), show = !d && b.goal > 1 && v > 0;
                  return (
                    <button type="button" key={b.id} data-b={b.id} className={'badge ' + (d ? 'got' : show ? 'part' : '')} onClick={() => info(b, d, v)}
                      aria-label={b.name + (d ? ' (obtenu)' : show ? ` (${fmt(b, v)})` : ' (à débloquer)')}>
                      <Medal icon={b.icon} tier={b.tier} got={!!d} progress={v / b.goal} size={58} />
                      <span className="bname">{b.name}</span>
                      {show && <em className="bval">{fmt(b, v)}</em>}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* Météo du jour : ce que tu fais selon ton énergie (tous les jours enregistrés avec une météo) */
function MeteoStats({ S }) {
  const rows = METEO.map(([id, e, l]) => {
    const days = Object.values(S.hist).filter((h) => h.mt === id && h.t);
    const n = days.length;
    return { id, e, l, n, d: n ? days.reduce((a, h) => a + h.d, 0) / n : 0, ok: n ? days.filter((h) => h.p >= 100).length : 0 };
  });
  const total = rows.reduce((a, r) => a + r.n, 0);
  if (!total) return null;
  const dMax = Math.max(1, ...rows.map((r) => r.d));
  const low = rows.filter((r) => (r.id === 'rain' || r.id === 'moon') && r.n);
  const lowAvg = low.length ? low.reduce((a, r) => a + r.d * r.n, 0) / low.reduce((a, r) => a + r.n, 0) : 0;
  return (
    <div className="card">
      <b className="text-[15px]">Ta météo et toi</b>
      <div className="mt-3 flex flex-col gap-2.5">
        {rows.filter((r) => r.n).map((r) => (
          <div key={r.id} className="flex items-center gap-3 text-[13px]">
            <span className="flex w-36 items-center gap-1.5 truncate"><span className="text-[16px]">{r.e}</span>{r.l}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5"><i className="block h-full rounded-full bg-[#93c5fd]" style={{ width: (r.d / dMax) * 100 + '%' }} /></span>
            <b className="w-24 text-right tabular-nums">{r.d.toFixed(1).replace('.', ',')} / jour</b>
            <span className="w-20 text-right text-mut tabular-nums">{r.n} j</span>
          </div>
        ))}
        <p className="text-[12px] text-mut">Tâches validées en moyenne selon ta météo du jour · nombre de jours.{lowAvg >= 1 ? ` Même les jours difficiles, tu avances : ${lowAvg.toFixed(1).replace('.', ',')} tâches en moyenne 💪` : ''}</p>
      </div>
    </div>
  );
}

export default function StatsPage({ S }) {
  const [view, setView] = useState('w');
  const canvas = useRef(null);
  const { labels, titles, pts, avg, fm, tg, cg, cm } = buildPeriod(view, S);
  const cats = S.cats.map((c) => ({ c, n: cg[c.id] || 0, m: cm[c.id] || 0 })).filter((x) => x.n || x.m).sort((a, b) => b.n - a.n || b.m - a.m);
  const catMax = Math.max(1, ...cats.map((x) => x.n));
  const z = streaks(S);
  const tags = Object.entries(tg).map(([id, c]) => ({ g: S.tags.find((x) => x.id === id), c })).filter((x) => x.g).sort((a, b) => b.c - a.c);
  const tagMax = Math.max(1, ...tags.map((x) => x.c));
  const zen = zenOn(S);
  const col = zen ? ZEN_BLUE : getColorForPercentage(avg);
  const doneTotal = pts.reduce((a, p) => a + (p ? p.d : 0), 0);

  useEffect(() => {
    const chart = new Chart(canvas.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: pts.map((p) => (p ? (zen ? p.d : p.p) : null)), // Tranquille : tâches faites, pas de pourcentage
          borderColor: col, borderWidth: 3.5,
          pointBackgroundColor: col, pointBorderColor: '#121318', pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 8,
          tension: 0.4, fill: true, spanGaps: true,
          backgroundColor: (c) => {
            const a = c.chart.chartArea;
            if (!a) return col + '33';
            const g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
            g.addColorStop(0, col + '77'); g.addColorStop(1, col + '00');
            return g;
          },
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: zen
            ? { min: 0, suggestedMax: 4, ticks: { color: '#a0a0a0', precision: 0, font: { family: 'Inter Variable' } }, grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false } }
            : { min: 0, max: 100, ticks: { color: '#a0a0a0', callback: (v) => v + '%', stepSize: 20, font: { family: 'Inter Variable' } }, grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false } },
          x: { ticks: { color: '#a0a0a0', maxRotation: 0, autoSkip: true, font: { family: 'Inter Variable' } }, grid: { display: false }, border: { color: 'rgba(255,255,255,.08)' } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0b0c10', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1, padding: 12, displayColors: false,
            callbacks: {
              title: (i) => titles[i[0].dataIndex],
              label: (i) => {
                const p = pts[i.dataIndex];
                if (zen) return [`${p.d} tâche${p.d > 1 ? 's' : ''} faite${p.d > 1 ? 's' : ''}`, ...(p.fm ? [`Concentration : ${fmtMin(p.fm)}`] : [])];
                if (!p.n) return 'Aucune donnée enregistrée (0%)';
                return view === 'y'
                  ? [`Moyenne : ${p.p}%`, `${p.d}/${p.t} tâches sur ${p.n} jour${p.n > 1 ? 's' : ''}`, ...(p.fm ? [`Concentration : ${fmtMin(p.fm)}`] : [])]
                  : [`Réussite : ${p.p}%`, `${p.d}/${p.t} tâche${p.t > 1 ? 's' : ''}`, ...(p.fm ? [`Concentration : ${fmtMin(p.fm)}`] : [])];
              },
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [view, S, zen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {VIEWS.map(([k, l]) => <button key={k} className={'b ' + (view === k ? 'on' : '')} onClick={() => setView(k)}>{l}</button>)}
        </div>
        <button className="b" onClick={() => setModal('weekly')}>{zen ? 'Ma semaine' : 'Bilan de la semaine'}</button>
      </div>
      <div className="card">
        <div className="text-[13px] text-mut">{zen ? 'Ce que tu as fait sur la période 🌿' : 'Moyenne de la période'}</div>
        <div
          className="my-2 mb-3.5 inline-block rounded-[14px] border-2 px-5 py-1.5 text-[44px] font-extrabold tracking-[-0.04em] tabular-nums transition-colors duration-700"
          style={{ color: col, borderColor: col, boxShadow: `0 0 30px ${col}33` }}
        >{zen ? `${doneTotal} tâche${doneTotal > 1 ? 's' : ''}` : `${avg}%`}</div>
        <div className="relative h-[340px]"><canvas ref={canvas} /></div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-mut tabular-nums">
          <span>⏱ Concentration : <b className="text-white">{fmtMin(fm)}</b></span>
          {S.set.showStreak && <span>🔥 Série : <b className="text-white">{z.cur} j</b> (record {z.best} j)</span>}
          {S.set.showStreak && <span>Semaines réussies d’affilée : <b className="text-white">{z.wcur}</b> (record {z.wbest})</span>}
        </div>
      </div>
      <div className="card">
        <b className="text-[15px]">Par catégorie</b>
        {cats.length ? (
          <div className="mt-3 flex flex-col gap-2.5">
            {cats.map(({ c, n, m }) => (
              <div key={c.id} className="flex items-center gap-3 text-[13px]">
                <span className="flex w-28 items-center gap-1.5 truncate"><span className="text-[16px]">{c.emoji}</span>{c.name}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5"><i className="block h-full rounded-full" style={{ width: (n / catMax) * 100 + '%', background: c.color }} /></span>
                <b className="w-8 text-right tabular-nums">{n}</b>
                <span className="w-16 text-right text-mut tabular-nums">{m >= 1 ? fmtMin(m) : '–'}</span>
              </div>
            ))}
            <p className="text-[12px] text-mut">Tâches validées · temps de concentration sur la période.</p>
          </div>
        ) : <p className="mt-2 text-[13px] text-mut">Aucune tâche classée validée sur la période. Choisis une catégorie en ajoutant une tâche, ou tape « @sport ».</p>}
      </div>
      <div className="card">
        <b className="text-[15px]">Tâches validées par étiquette</b>
        {tags.length ? (
          <div className="mt-3 flex flex-col gap-2">
            {tags.map(({ g, c }) => (
              <div key={g.id} className="flex items-center gap-3 text-[13px]">
                <span className="w-24 truncate">{g.name}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5"><i className="block h-full rounded-full" style={{ width: (c / tagMax) * 100 + '%', background: g.color }} /></span>
                <b className="w-8 text-right tabular-nums">{c}</b>
              </div>
            ))}
          </div>
        ) : <p className="mt-2 text-[13px] text-mut">Aucune tâche étiquetée validée sur la période. Ajoute « #nom » en saisissant une tâche.</p>}
      </div>
      <MeteoStats S={S} />
      <FocusStats S={S} />
      <Heatmap S={S} />
      {S.set.showBadges && <Badges S={S} />}
    </section>
  );
}
