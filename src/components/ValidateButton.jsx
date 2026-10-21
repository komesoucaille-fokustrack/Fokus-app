/* Dynamic Island : « Valider X tâche(s) +Y% » (gain calculé par points) */
export default function ValidateButton({ k, gain, onClick }) {
  return (
    <button id="vbtn" className={k ? 'show' : ''} onClick={onClick}>
      {k ? <>Valider {k} tâche{k > 1 ? 's' : ''}<em>+{gain}%</em></> : null}
    </button>
  );
}
