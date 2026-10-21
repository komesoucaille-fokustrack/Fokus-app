export const K = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const parseK = (k) => { const [a, b, c] = k.split('-').map(Number); return new Date(a, b - 1, c); };
export const addDays = (k, n) => { const d = parseK(k); d.setDate(d.getDate() + n); return K(d); };
/* Écart en jours entre deux clés (b − a) */
export const daysBetween = (a, b) => Math.round((parseK(b) - parseK(a)) / 864e5);
/* Lundi de la semaine d'une date (clé) */
export const mondayOf = (k) => { const d = parseK(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return K(d); };

export const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/* Libellé humain d'une date par rapport à aujourd'hui */
export function dayLabel(k, today) {
  if (!k) return 'Plus tard';
  const n = daysBetween(today, k);
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return 'Demain';
  if (n === -1) return 'Hier';
  const d = parseK(k);
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
