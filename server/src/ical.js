/* =====================================================================
   FLUX D'AGENDA FOKUS (iCal, lecture seule) — abonnement depuis Apple Calendrier, Google Agenda, Outlook…
   Construit à partir des données synchronisées du compte (les mêmes que l'app) :
   - tâche à une heure → événement (durée = temps estimé, sinon la durée par défaut) ;
   - tâche sans heure → événement « toute la journée » (réglage set.calAllDay, activé par défaut) ;
   - tâche validée → « ✅ T̶e̶x̶t̶e̶ » barré, déplacé à l'heure où elle a été faite (doneAt), y compris après minuit
     (tâches archivées : arch) ;
   - fenêtre : 60 jours en arrière, 6 mois en avant. Identifiants stables : l'agenda met à jour au lieu de dupliquer.
   Heures « murales » dans le fuseau de l'appareil (data.tz), annoncé par TZID et X-WR-TIMEZONE.
   ===================================================================== */
const TZ_OK = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){0,2}$/;
const KEY = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

/* texte barré : chaque caractère suivi du trait combinant U+0336 (affiché barré dans tous les agendas) */
export const strike = (t) => [...t].map((c) => (c === ' ' ? c : c + '\u0336')).join('');
const esc = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/* lignes de 75 octets au plus (sans couper un caractère UTF-8) */
function fold(line) {
  const enc = new TextEncoder(), out = [];
  let cur = '', n = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; }
    cur += ch; n += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const ymd = (k) => k.replace(/-/g, '');
const addDays = (k, n) => { const d = new Date(k + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const addMin = (k, hm, min) => { // date + heure + minutes → [date, 'HHMM00'] (peut passer au lendemain)
  const [h, m] = hm.split(':').map(Number), t = h * 60 + m + min, days = Math.floor(t / 1440), r = t - days * 1440;
  return [addDays(k, days), `${pad(Math.floor(r / 60))}${pad(r % 60)}00`];
};

export function buildIcs(data, { now = new Date(), name = 'Fokus' } = {}) {
  const S = data && typeof data === 'object' ? data : {};
  const tz = TZ_OK.test(S.tz || '') ? S.tz : 'Europe/Paris';
  const set = S.set || {}, allDay = set.calAllDay !== false, defDur = Math.max(5, Math.min(600, +set.defDur || 30));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const from = addDays(today, -60), to = addDays(today, 183);
  const cats = Object.fromEntries((Array.isArray(S.cats) ? S.cats : []).map((c) => [c.id, c]));
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fokus//Fokus Track//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`, 'X-WR-CALDESC:Mes tâches Fokus · fokus-track.com', `X-WR-TIMEZONE:${tz}`,
    'X-APPLE-CALENDAR-COLOR:#10B981', 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M',
  ];
  const dtstamp = stamp(now), seen = new Set();
  const add = (t, archived) => {
    if (!t || typeof t !== 'object' || !t.id || seen.has(t.id)) return;
    const text = String(t.text || '').trim().slice(0, 200);
    if (!text) return;
    // jour et heure : validée → moment de la validation ; sinon la date prévue (tâche en retard = aujourd'hui)
    const doneAt = typeof t.doneAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t.doneAt) ? t.doneAt : '';
    let day = doneAt ? doneAt.slice(0, 10) : t.date, hm = doneAt ? doneAt.slice(11) : t.time;
    if (!KEY.test(day || '')) return;
    if (!t.done && !archived && day < today) day = today;
    if (day < from || day > to) return;
    if (!HM.test(hm || '')) hm = null;
    if (!hm && !allDay) return;
    seen.add(t.id);
    const c = cats[t.cat], done = !!(t.done || archived);
    const title = (done ? '✅ ' + strike(text) : (t.prio ? '★ ' : '') + text);
    const desc = [done ? 'Fait ✓' : 'À faire', c ? `${c.emoji || ''} ${c.name}`.trim() : '', t.weight > 1 ? `${t.weight} points` : '', 'Ouvrir Fokus : https://fokus-track.com/'].filter(Boolean).join('\n');
    lines.push('BEGIN:VEVENT', `UID:${String(t.id).replace(/[^\w-]/g, '')}@fokus-track.com`, `DTSTAMP:${dtstamp}`);
    if (hm) {
      const [d2, e] = addMin(day, hm, Math.max(5, Math.min(1440, +t.est || defDur)));
      lines.push(`DTSTART;TZID=${tz}:${ymd(day)}T${hm.replace(':', '')}00`, `DTEND;TZID=${tz}:${ymd(d2)}T${e}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd(day)}`, `DTEND;VALUE=DATE:${ymd(addDays(day, 1))}`, 'TRANSP:TRANSPARENT');
    }
    lines.push(`SUMMARY:${esc((c && c.emoji && !done ? c.emoji + ' ' : '') + title)}`, `DESCRIPTION:${esc(desc)}`, `STATUS:CONFIRMED`, 'END:VEVENT');
  };
  for (const t of Array.isArray(S.tasks) ? S.tasks : []) add(t, false);
  for (const t of Array.isArray(S.arch) ? S.arch : []) add(t, true);
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
