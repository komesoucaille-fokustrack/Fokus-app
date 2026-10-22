import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import gsap from 'gsap';
import { K, dayLabel, parseK } from '../lib/dates';
import { getColorForPercentage } from '../lib/colors';
import { BADGES, BADGE_CATS, TIERS, badgeCtx, clearNewBadge, toast, focusToday, now, setModal, stats, streaks, todayKey, useStore } from '../store';
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
    if (k === tk) { const s = stats(S.tasks); return { p: s.p, d: s.c, t: s.n, fm: focusToday(S), tg: todayTags(S) }; }
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
  return { labels, titles, pts, avg, fm: sumF(all), tg };
}
const sumF = (a) => a.reduce((s, x) => s + (x.fm || 0), 0);
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
  const live = stats(S.tasks);
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
                  const bg = d && d.t > 0 ? getColorForPercentage(d.p) : undefined;
                  return (
                    <button
                      type="button" key={k} disabled={fut}
                      className={'hc ' + (k === pick ? 'pick ' : '') + (d?.jk ? 'jk ' : '') + (fut ? 'fut' : '')}
                      style={bg ? { background: bg } : undefined}
                      title={`${dayLabel(k, tk)} : ${d && d.t ? d.p + ' %' : 'aucune donnée'}`}
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
        {h && h.t > 0 ? (
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

export default function StatsPage({ S }) {
  const [view, setView] = useState('w');
  const canvas = useRef(null);
  const { labels, titles, pts, avg, fm, tg } = buildPeriod(view, S);
  const z = streaks(S);
  const tags = Object.entries(tg).map(([id, c]) => ({ g: S.tags.find((x) => x.id === id), c })).filter((x) => x.g).sort((a, b) => b.c - a.c);
  const tagMax = Math.max(1, ...tags.map((x) => x.c));
  const col = getColorForPercentage(avg);

  useEffect(() => {
    const chart = new Chart(canvas.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: pts.map((p) => (p ? p.p : null)),
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
          y: { min: 0, max: 100, ticks: { color: '#a0a0a0', callback: (v) => v + '%', stepSize: 20, font: { family: 'Inter Variable' } }, grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false } },
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
  }, [view, S]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {VIEWS.map(([k, l]) => <button key={k} className={'b ' + (view === k ? 'on' : '')} onClick={() => setView(k)}>{l}</button>)}
        </div>
        <button className="b" onClick={() => setModal('weekly')}>Bilan de la semaine</button>
      </div>
      <div className="card">
        <div className="text-[13px] text-mut">Moyenne de la période</div>
        <div
          className="my-2 mb-3.5 inline-block rounded-[14px] border-2 px-5 py-1.5 text-[44px] font-extrabold tracking-[-0.04em] tabular-nums transition-colors duration-700"
          style={{ color: col, borderColor: col, boxShadow: `0 0 30px ${col}33` }}
        >{avg}%</div>
        <div className="relative h-[340px]"><canvas ref={canvas} /></div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-mut tabular-nums">
          <span>⏱ Concentration : <b className="text-white">{fmtMin(fm)}</b></span>
          {S.set.showStreak && <span>🔥 Série : <b className="text-white">{z.cur} j</b> (record {z.best} j)</span>}
          {S.set.showStreak && <span>Semaines réussies d’affilée : <b className="text-white">{z.wcur}</b> (record {z.wbest})</span>}
        </div>
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
      <FocusStats S={S} />
      <Heatmap S={S} />
      {S.set.showBadges && <Badges S={S} />}
    </section>
  );
}
