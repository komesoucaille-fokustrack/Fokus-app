import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { K } from '../lib/dates';
import { getColorForPercentage } from '../lib/colors';
import { now, stats } from '../store';

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const VIEWS = [['w', 'Semaine'], ['m', 'Mois'], ['y', 'Année']];
const longDate = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const sum = (a, f) => a.reduce((s, x) => s + x[f], 0);

function buildPeriod(view, S) {
  const n = now(), Y = n.getFullYear(), tk = K(n);
  const dayData = (d) => {
    const k = K(d);
    if (k === tk) { const s = stats(S.tasks); return { p: s.p, d: s.c, t: s.n }; }
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
    if (a.length) return { p: Math.round(sum(a, 'p') / a.length), n: a.length, d: sum(a, 'd'), t: sum(a, 't') };
    return g[0] <= n ? { p: 0, n: 0, d: 0, t: 0 } : null;
  });
  const all = groups.flat().map(dayData).filter(Boolean);
  const avg = all.length ? Math.round(sum(all, 'p') / all.length) : 0;
  return { labels, titles, pts, avg };
}

export default function StatsPage({ S }) {
  const [view, setView] = useState('w');
  const canvas = useRef(null);
  const { labels, titles, pts, avg } = buildPeriod(view, S);
  const col = getColorForPercentage(avg);

  useEffect(() => {
    const chart = new Chart(canvas.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: pts.map((p) => (p ? p.p : null)),
          borderColor: col, borderWidth: 3.5,
          pointBackgroundColor: col, pointBorderColor: '#121215', pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 8,
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
            backgroundColor: '#0c0c0e', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1, padding: 12, displayColors: false,
            callbacks: {
              title: (i) => titles[i[0].dataIndex],
              label: (i) => {
                const p = pts[i.dataIndex];
                if (!p.n) return 'Aucune donnée enregistrée (0%)';
                return view === 'y'
                  ? [`Moyenne : ${p.p}%`, `${p.d}/${p.t} tâches sur ${p.n} jour${p.n > 1 ? 's' : ''}`]
                  : [`Réussite : ${p.p}%`, `${p.d}/${p.t} tâche${p.t > 1 ? 's' : ''}`];
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
      <div className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map(([k, l]) => <button key={k} className={'b ' + (view === k ? 'on' : '')} onClick={() => setView(k)}>{l}</button>)}
      </div>
      <div className="card">
        <div className="text-[13px] text-mut">Moyenne de la période</div>
        <div
          className="my-2 mb-3.5 inline-block rounded-[14px] border-2 px-5 py-1.5 text-[44px] font-extrabold tracking-[-0.04em] tabular-nums transition-colors duration-700"
          style={{ color: col, borderColor: col, boxShadow: `0 0 30px ${col}33` }}
        >{avg}%</div>
        <div className="relative h-[340px]"><canvas ref={canvas} /></div>
      </div>
    </section>
  );
}
