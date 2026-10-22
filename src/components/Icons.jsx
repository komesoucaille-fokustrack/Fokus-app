/* =====================================================================
   ICÔNES FOKUS — trait fin et arrondi, couleur du texte (currentColor), grille 24 px.
   Remplacent les emojis de l'interface : même style partout, nettes à toutes les tailles.
   ===================================================================== */
const P = {
  focus: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 13.5V9.5M9.5 2.5h5M12 2.5V6M18.5 6.5l1.5-1.5" /></>,
  pause: <><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z" /><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1 1 1.4 1 2.5M12 3.5c0 1 1 1.4 1 2.5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />,
  bulb: <><path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" /></>,
  sound: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /></>,
  flame: <path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-3.4-2.2-5.4-3.6-7.5-.5 1.8-1.4 3-2.6 3.6C12.6 7.5 11.2 4.6 9 3c.2 3-1.6 4.8-2.8 6.6A6.4 6.4 0 0 0 5.5 14.5 6.5 6.5 0 0 0 12 21Z" />,
  medal: <><circle cx="12" cy="14.5" r="6" /><path d="M8.5 9.6 6 3h4l2 4.5L14 3h4l-2.5 6.6" /><path d="M12 12v5" /></>,
  joker: <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="m12 8 1.2 2.5 2.8.4-2 2 .5 2.8L12 14.4l-2.5 1.3.5-2.8-2-2 2.8-.4Z" /></>,
  trash: <><path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l.8 12.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8l.8-12.2" /><path d="M10 10.5v6M14 10.5v6" /></>,
  alert: <><path d="M10.3 4.3 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /><path d="M12 9.5v4.5M12 17.2v.1" /></>,
  skip: <><path d="M5 5.5v13l9-6.5Z" /><path d="M18.5 5.5v13" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  hourglass: <><path d="M6 3h12M6 21h12" /><path d="M7 3v2.5a5 5 0 0 0 2.2 4.1L12 12l2.8-2.4A5 5 0 0 0 17 5.5V3" /><path d="M7 21v-2.5a5 5 0 0 1 2.2-4.1L12 12l2.8 2.4a5 5 0 0 1 2.2 4.1V21" /></>,
  repeat: <><path d="M17 3.5 20 6.5l-3 3" /><path d="M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5 4 17.5l3-3" /><path d="M20 12.5v1a4 4 0 0 1-4 4H4" /></>,
  pip: <><rect x="2.5" y="4.5" width="19" height="15" rx="3" /><rect x="11.5" y="11" width="7.5" height="6" rx="1.5" fill="currentColor" stroke="none" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  sprout: <><path d="M12 20.5v-8" /><path d="M12 12.5C12 8.5 9 6 4.5 6c0 4 2.5 6.5 7.5 6.5ZM12 10.5c0-3.5 2.5-6 7-6 0 3.8-2.5 6-7 6Z" /></>,
  comet: <><circle cx="15.5" cy="8.5" r="3.5" /><path d="M12.8 11.2 4 20M10.5 9 6 13.5M15 14l-4.5 4.5" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0Z" /><path d="M8 5.5H4.5a3 3 0 0 0 3.6 4M16 5.5h3.5a3 3 0 0 1-3.6 4M12 13v4M8.5 20.5h7M9.5 17h5" /></>,
  crown: <><path d="M4 8l4 4 4-7 4 7 4-4-1.5 10h-13Z" /><path d="M6 20.5h12" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" /></>,
  sunrise: <><path d="M4 18.5h16M7.5 18.5a4.5 4.5 0 0 1 9 0M12 4v5M9.5 6.5 12 4l2.5 2.5M4.5 13.5l1.5 1M19.5 13.5l-1.5 1" /></>,
  chart: <><path d="M4 4v16h16" /><path d="m7.5 14.5 3.5-4 3 2.5 5-6" /></>,
  rocket: <><path d="M12 15.5 8.5 12C10 6.5 14 3.5 20.5 3.5 20.5 10 17.5 14 12 15.5Z" /><circle cx="15" cy="9" r="1.6" /><path d="M8.5 12 5 11.5l2.5-3.5 4 .5M12 15.5l.5 3.5 3.5-2.5-.5-4M6.5 17.5l-2 2" /></>,
  bolt: <path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12Z" />,
  dumbbell: <><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></>,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9Z" />,
  sparkle: <><path d="M12 3c.7 4.4 2.6 6.3 7 7-4.4.7-6.3 2.6-7 7-.7-4.4-2.6-6.3-7-7 4.4-.7 6.3-2.6 7-7Z" /><path d="M19 15.5c.3 1.6 1 2.2 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.3 2.2-.9 2.5-2.5Z" /></>,
  diamond: <><path d="M6.5 4h11l3.5 5-9 11L3 9Z" /><path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5" /></>,
  brain: <><path d="M12 5.5a3 3 0 0 0-5.5-1A3.5 3.5 0 0 0 4 9.5a3.5 3.5 0 0 0 .5 6A3.5 3.5 0 0 0 9 19.5a3 3 0 0 0 3-1.5Z" /><path d="M12 5.5a3 3 0 0 1 5.5-1A3.5 3.5 0 0 1 20 9.5a3.5 3.5 0 0 1-.5 6 3.5 3.5 0 0 1-4.5 4 3 3 0 0 1-3-1.5Z" /><path d="M12 5.5v13" /></>,
  leaf: <><path d="M5 19c0-8 5-13.5 15-14-.3 10-6 15-14 14Z" /><path d="M5 19l7-7" /></>,
  wave: <><path d="M3 9c2 0 2-2 4.5-2S10 9 12 9s2-2 4.5-2S19 9 21 9M3 14c2 0 2-2 4.5-2s2.5 2 4.5 2 2-2 4.5-2 2.5 2 4.5 2M3 19c2 0 2-2 4.5-2s2.5 2 4.5 2 2-2 4.5-2 2.5 2 4.5 2" /></>,
  battery: <><rect x="3" y="7" width="16" height="10" rx="2.5" /><path d="M21 10.5v3M6.5 10.5v3M9.5 10.5v3M12.5 10.5v3" /></>,
  tag: <><path d="M3.5 12.5V4.5h8l9 9-8 8Z" /><circle cx="8" cy="9" r="1.4" /></>,
  save: <><path d="M5 3.5h11l3.5 3.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z" /><path d="M7.5 3.5v5h8v-5M7.5 20.5v-6h9v6" /></>,
  gift: <><rect x="3.5" y="9" width="17" height="11.5" rx="2" /><path d="M2.5 9h19v-3h-19ZM12 6v14.5M12 6C10 2.5 6.5 3 7.5 6M12 6c2-3.5 5.5-3 4.5 0" /></>,
  palette: <><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.5-2.2-.6-1.4.2-2.8 1.8-2.8h1.7a3.5 3.5 0 0 0 3.5-3.5c0-4.7-3.8-8.5-8.5-8.5Z" /><circle cx="8" cy="11" r="1.1" /><circle cx="10.5" cy="7.5" r="1.1" /><circle cx="15" cy="8" r="1.1" /></>,
  headphones: <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3.5" y="14" width="4.5" height="6.5" rx="1.8" /><rect x="16" y="14" width="4.5" height="6.5" rx="1.8" /></>,
  layers: <><path d="m12 3.5 9 5-9 5-9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  ring: <><path d="M12 4.5a7.5 7.5 0 1 1-7.5 7.3" strokeWidth="2.6" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /></>,
};

export default function Icon({ name, size = 16, className = '', style, title }) {
  const d = P[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      className={'ico ' + className} style={style} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {d}
    </svg>
  );
}
export const ICONS = Object.keys(P);
