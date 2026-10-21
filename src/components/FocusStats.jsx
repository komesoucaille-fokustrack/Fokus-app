import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { fmtMin } from './TaskList';
import { addDays, parseK } from '../lib/dates';
import { focusToday, todayKey } from '../store';

/* =====================================================================
   STATISTIQUES DE CONCENTRATION (Page 2)
   Sources : hist[jour].fm (minutes par jour), journal des sessions (heures, étiquettes, tâches, sessions terminées),
   hist[jour].ea (précision des estimations).
   ===================================================================== */
const BLUE = '#93c5fd', MINT = '#86efac';
const axis = { ticks: { color: '#a0a0a0', font: { family: 'Inter Variable' } }, grid: { color: 'rgba(255,255,255,.06)' }, border: { display: false } };
const tip = { backgroundColor: '#0c0c0e', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1, padding: 10, displayColors: false };

function useChart(ref, config, deps) {
  useEffect(() => {
    const c = new Chart(ref.current, config());
    return () => c.destroy();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

export function focusData(S, weeks) {
  const tk = todayKey(), n = weeks * 7, from = addDays(tk, -(n - 1));
  const days = [...Array(n)].map((_, i) => addDays(from, i));
  const perDay = days.map((k) => (k === tk ? focusToday(S) : S.hist[k]?.fm || 0));
  const t0 = parseK(from).getTime() / 1000 - S.off * 864e2, t1 = t0 + n * 864e2;
  const ses = S.sessions.filter((x) => x[0] >= t0 && x[0] < t1);
  const hours = Array(24).fill(0), tags = {}, tasks = {};
  for (const [st, dur, , , , tg = [], title = ''] of ses) {
    // répartit la durée sur les heures réellement couvertes
    let a = st, left = dur;
    while (left > 0) {
      const d = new Date(a * 1000), h = d.getHours(), room = 3600 - (d.getMinutes() * 60 + d.getSeconds()), c = Math.min(room, left);
      hours[h] += c / 60; a += c; left -= c;
    }
    (tg.length ? tg : ['—']).forEach((g) => { tags[g] = (tags[g] || 0) + dur / 60 / Math.max(1, tg.length); });
    const name = title || 'Session libre';
    tasks[name] = (tasks[name] || 0) + dur / 60;
  }
  const weeksTot = [...Array(weeks)].map((_, w) => perDay.slice(w * 7, w * 7 + 7).reduce((s, x) => s + x, 0));
  let est = 0, real = 0;
  days.forEach((k) => { const e = S.hist[k]?.ea; if (e) { est += e[0]; real += e[1]; } });
  return {
    days, perDay, hours, weeksTot, total: perDay.reduce((s, x) => s + x, 0), done: ses.filter((x) => x[4]).length,
    tags: Object.entries(tags).sort((a, b) => b[1] - a[1]),
    tasks: Object.entries(tasks).sort((a, b) => b[1] - a[1]).slice(0, 8),
    acc: est ? { est, real, ratio: real / est } : null,
  };
}

export default function FocusStats({ S }) {
  const [weeks, setWeeks] = useState(4);
  const d = useMemo(() => focusData(S, weeks), [S, weeks]);
  const daily = useRef(null), trend = useRef(null), hrs = useRef(null);
  const short = (k) => { const x = parseK(k); return x.getDate() + '/' + (x.getMonth() + 1); };

  useChart(daily, () => ({
    type: 'bar',
    data: { labels: d.days.map(short), datasets: [{ data: d.perDay.map(Math.round), backgroundColor: BLUE + 'cc', borderRadius: 4, maxBarThickness: 18 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
      scales: { y: { ...axis, beginAtZero: true, ticks: { ...axis.ticks, stepSize: Math.max(...d.perDay) > 150 ? 60 : 30, callback: (v) => fmtMin(v) } }, x: { ...axis, grid: { display: false }, ticks: { ...axis.ticks, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } } },
      plugins: { legend: { display: false }, tooltip: { ...tip, callbacks: { title: (i) => d.days[i[0].dataIndex], label: (i) => fmtMin(i.raw) } } },
    },
  }), [d]);

  useChart(trend, () => ({
    type: 'line',
    data: { labels: d.weeksTot.map((_, i) => (i === weeks - 1 ? 'Cette sem.' : `S-${weeks - 1 - i}`)), datasets: [{ data: d.weeksTot.map(Math.round), borderColor: MINT, backgroundColor: MINT + '22', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: MINT, borderWidth: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
      scales: { y: { ...axis, beginAtZero: true, ticks: { ...axis.ticks, callback: (v) => Math.round(v / 60) + ' h' } }, x: { ...axis, grid: { display: false } } },
      plugins: { legend: { display: false }, tooltip: { ...tip, callbacks: { label: (i) => fmtMin(i.raw) } } },
    },
  }), [d]);

  useChart(hrs, () => ({
    type: 'bar',
    data: { labels: [...Array(19)].map((_, i) => i + 6 + ' h'), datasets: [{ data: d.hours.slice(6).map(Math.round), backgroundColor: d.hours.slice(6).map((v) => (v >= Math.max(...d.hours) * 0.8 && v > 0 ? MINT : BLUE + '99')), borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
      scales: { y: { ...axis, beginAtZero: true, ticks: { ...axis.ticks, callback: (v) => v + ' min' } }, x: { ...axis, grid: { display: false }, ticks: { ...axis.ticks, maxRotation: 0, autoSkip: true } } },
      plugins: { legend: { display: false }, tooltip: { ...tip, callbacks: { label: (i) => fmtMin(i.raw) } } },
    },
  }), [d]);

  const best = d.hours.indexOf(Math.max(...d.hours));
  const tagOf = (id) => S.tags.find((g) => g.id === id) || { name: id === '—' ? 'Sans étiquette' : 'Étiquette supprimée', color: '#a0a0a0' };
  const max = Math.max(1, ...d.tags.map((x) => x[1]), ...d.tasks.map((x) => x[1]));
  const accTxt = d.acc && (Math.abs(d.acc.ratio - 1) < 0.1 ? 'Très justes 👌' : d.acc.ratio > 1 ? `+${Math.round((d.acc.ratio - 1) * 100)} % : tu sous-estimes` : `−${Math.round((1 - d.acc.ratio) * 100)} % : tu surestimes`);

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <b className="text-[15px]">Concentration</b>
        <div className="segs">{[4, 12].map((w) => <button key={w} className={'seg ' + (weeks === w ? 'on' : '')} onClick={() => setWeeks(w)}>{w} semaines</button>)}</div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="stat"><span className="slab">Total</span><b className="text-lg tabular-nums">{fmtMin(d.total)}</b><span className="text-[12px] text-mut">≈ {fmtMin(d.total / (weeks * 7))} / jour</span></div>
        <div className="stat"><span className="slab">Sessions terminées</span><b className="text-lg tabular-nums">{d.done}</b><span className="text-[12px] text-mut">sur {weeks} semaines</span></div>
        <div className="stat"><span className="slab">Meilleure heure</span><b className="text-lg tabular-nums">{d.hours[best] > 0 ? `${best} h – ${best + 1} h` : '–'}</b><span className="text-[12px] text-mut">là où tu te concentres le plus</span></div>
        <div className="stat"><span className="slab">Estimations</span><b className="text-lg tabular-nums">{d.acc ? `${fmtMin(d.acc.real)} / ${fmtMin(d.acc.est)}` : '–'}</b><span className="text-[12px] text-mut">{d.acc ? accTxt : 'réel / estimé (tâches estimées)'}</span></div>
      </div>
      <div className="slab mb-1">Par jour</div>
      <div className="relative mb-5 h-[200px]"><canvas ref={daily} /></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div><div className="slab mb-1">Tendance par semaine</div><div className="relative h-[180px]"><canvas ref={trend} /></div></div>
        <div><div className="slab mb-1">Meilleures heures</div><div className="relative h-[180px]"><canvas ref={hrs} /></div></div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="slab mb-2">Par étiquette</div>
          {d.tags.length ? d.tags.map(([id, m]) => { const g = tagOf(id); return (
            <div key={id} className="mb-1.5 flex items-center gap-3 text-[13px]">
              <span className="w-28 truncate" style={{ color: g.color }}>{g.name}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5"><i className="block h-full rounded-full" style={{ width: (m / max) * 100 + '%', background: g.color }} /></span>
              <b className="w-16 text-right tabular-nums">{fmtMin(m)}</b>
            </div>
          ); }) : <p className="text-[13px] text-mut">Aucune session sur la période.</p>}
        </div>
        <div>
          <div className="slab mb-2">Par tâche</div>
          {d.tasks.length ? d.tasks.map(([name, m]) => (
            <div key={name} className="mb-1.5 flex items-center gap-3 text-[13px]">
              <span className="w-40 truncate">{name}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5"><i className="block h-full rounded-full" style={{ width: (m / max) * 100 + '%', background: BLUE }} /></span>
              <b className="w-16 text-right tabular-nums">{fmtMin(m)}</b>
            </div>
          )) : <p className="text-[13px] text-mut">Lance le minuteur depuis une tâche pour voir où va ton temps.</p>}
        </div>
      </div>
    </div>
  );
}
