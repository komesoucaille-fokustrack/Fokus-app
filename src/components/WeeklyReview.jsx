import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import Sheet from './Sheet';
import { fmtMin } from './TaskList';
import { getColorForPercentage } from '../lib/colors';
import { addDays, dayLabel, parseK } from '../lib/dates';
import { todayKey, useStore, weekReview } from '../store';
import Icon from './Icons';

const short = (k) => parseK(k).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/* « Bilan de la semaine » : moyenne et écart, meilleure journée, série, priorités, concentration */
export default function WeeklyReview({ onClose, current }) {
  const { S } = useStore();
  const tk = todayKey();
  const r = weekReview(S, current ? addDays(tk, -((parseK(tk).getDay() + 6) % 7)) : undefined);
  const grid = useRef(null);
  useLayoutEffect(() => {
    gsap.from(grid.current.children, { y: 14, opacity: 0, duration: 0.6, stagger: 0.06, ease: 'expo.out', delay: 0.1, clearProps: 'transform,opacity' });
  }, []);
  const col = getColorForPercentage(r.avg ?? 0);
  const diff = r.avg != null && r.prevAvg != null ? r.avg - r.prevAvg : null;
  return (
    <Sheet title={current ? 'Bilan de cette semaine' : 'Bilan de la semaine'} sub={`Du ${short(r.from)} au ${short(r.to)}`} onClose={onClose}>
      <div ref={grid} className="grid grid-cols-2 gap-2.5">
        <div className="stat col-span-2">
          <span className="slab">Moyenne de la semaine</span>
          <span className="flex items-baseline gap-3">
            <b className="text-[44px] leading-none tracking-[-0.04em] tabular-nums" style={{ color: col }}>{r.avg ?? '–'}{r.avg != null && '%'}</b>
            {diff != null && <span className={'text-[15px] font-semibold tabular-nums ' + (diff >= 0 ? 'text-[#86efac]' : 'text-mut')}>{diff >= 0 ? '↑' : '↓'} {Math.abs(diff)} pts vs semaine précédente</span>}
          </span>
          <span className="text-[13px] text-mut">{r.ok} jour{r.ok > 1 ? 's' : ''} réussi{r.ok > 1 ? 's' : ''} sur {r.n} · {r.done} tâche{r.done > 1 ? 's' : ''} validée{r.done > 1 ? 's' : ''}</span>
        </div>
        <div className="stat">
          <span className="slab">Meilleure journée</span>
          <b className="text-lg">{r.best ? `${r.best.h.p}%` : '–'}</b>
          <span className="text-[13px] text-mut">{r.best ? dayLabel(r.best.k, tk) : 'Aucune donnée'}</span>
        </div>
        <div className="stat">
          <span className="slab">Série</span>
          <b className="inline-flex items-center gap-1.5 text-lg"><Icon name="flame" size={18} />{r.z.cur} j</b>
          <span className="text-[13px] text-mut">Record {r.z.best} j · {r.z.wcur} sem.</span>
        </div>
        <div className="stat">
          <span className="slab">Priorités tenues</span>
          <b className="text-lg tabular-nums">{r.prt ? `${r.pr}/${r.prt}` : '–'}</b>
          <span className="text-[13px] text-mut">{r.prt ? Math.round((r.pr / r.prt) * 100) + ' %' : 'Aucune priorité'}</span>
        </div>
        <div className="stat">
          <span className="slab">Concentration</span>
          <b className="text-lg tabular-nums">{fmtMin(r.fm)}</b>
          <span className="text-[13px] text-mut">Minuteur ▶</span>
        </div>
      </div>
      <button className="b on mt-4 w-full py-3!" onClick={onClose}>Continuer</button>
    </Sheet>
  );
}
