/* Dynamic Island : « Valider X tâche(s) +Y% » (gain calculé par points), « +Y pts » en mode points, 🌿 en style Tranquille */
export default function ValidateButton({ k, gain, onClick }) {
  return (
    <button id="vbtn" className={k ? 'show' : ''} onClick={onClick}>
      {k ? <>Valider {k} tâche{k > 1 ? 's' : ''}{gain && <em>{gain}</em>}</> : null}
    </button>
  );
}
