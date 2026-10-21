export default function ValidateButton({ k, s, onClick }) {
  const np = k && s.n ? Math.round(((s.c + k) / s.n) * 100) : 0;
  return (
    <button id="vbtn" className={k ? 'show' : ''} onClick={onClick}>
      {k ? <>Valider {k} tâche{k > 1 ? 's' : ''}<em>+{np - s.p}%</em></> : null}
    </button>
  );
}
