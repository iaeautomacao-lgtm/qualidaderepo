/**
 * Conjunto de ícones SVG inline do QualiDDM.
 *
 * Regras do set (mantenha ao adicionar novos ícones):
 * - grade de 24x24, desenhados apenas com traço (nunca preenchimento);
 * - `stroke="currentColor"` + `fill="none"`, para herdar a cor do contexto;
 * - `stroke-width` padrão 1.75, pontas e junções arredondadas;
 * - o tamanho vem da prop `size` (define width/height em px).
 *
 * Acessibilidade: sem `label` o ícone é decorativo e sai da árvore de
 * acessibilidade (`aria-hidden`). Com `label` ele passa a carregar
 * significado e é exposto como imagem (`role="img"` + `<title>`).
 */

const icons = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V3" />
      <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
      <path d="M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" />
    </>
  ),
  review: (
    <>
      <path d="M14.5 3H7a2.5 2.5 0 0 0-2.5 2.5v13A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5V8z" />
      <path d="M14.5 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 9V7.5A2.5 2.5 0 0 0 17.5 5h-12A2.5 2.5 0 0 0 3 7.5v9A2.5 2.5 0 0 0 5.5 19h12a2.5 2.5 0 0 0 2.5-2.5V15" />
      <path d="M21 9h-5a3 3 0 0 0 0 6h5z" />
    </>
  ),
  checklist: (
    <>
      <path d="m3 6.5 2 2 4-4" />
      <path d="M12.5 6.5H21" />
      <path d="m3 16.5 2 2 4-4" />
      <path d="M12.5 16.5H21" />
    </>
  ),
  feedback: (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 8.5h8" />
      <path d="M8 12.5h5" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6.5a4 4 0 0 0-4 4V20" />
      <circle cx="9.25" cy="7.5" r="3.5" />
      <path d="M21.5 20v-1.5a4 4 0 0 0-3-3.87" />
      <path d="M15.5 4.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5V10H9" />
      <path d="M12 8v4.3l3 1.8" />
    </>
  ),
  settings: (
    <>
      <path d="M3.5 7.5h9" />
      <path d="M17 7.5h3.5" />
      <circle cx="14.75" cy="7.5" r="2.25" />
      <path d="M3.5 16.5H7" />
      <path d="M11.5 16.5h9" />
      <circle cx="9.25" cy="16.5" r="2.25" />
    </>
  ),

  /* mídia */
  play: <path d="M7.5 4.75 19 12 7.5 19.25z" />,
  pause: (
    <>
      <rect x="7.5" y="5" width="3.5" height="14" rx="1.25" />
      <rect x="13" y="5" width="3.5" height="14" rx="1.25" />
    </>
  ),
  skipBack: (
    <>
      <path d="M11.5 6.5 5 12l6.5 5.5z" />
      <path d="M19.5 6.5 13 12l6.5 5.5z" />
    </>
  ),
  skipForward: (
    <>
      <path d="M12.5 6.5 19 12l-6.5 5.5z" />
      <path d="M4.5 6.5 11 12l-6.5 5.5z" />
    </>
  ),
  volume: (
    <>
      <path d="M11 5.5 6.5 9.25H3.5v5.5h3L11 18.5z" />
      <path d="M15.25 9.75a3.25 3.25 0 0 1 0 4.5" />
      <path d="M18.25 6.75a7.25 7.25 0 0 1 0 10.5" />
    </>
  ),
  volumeMute: (
    <>
      <path d="M11 5.5 6.5 9.25H3.5v5.5h3L11 18.5z" />
      <path d="m15.5 10 5 4" />
      <path d="m20.5 10-5 4" />
    </>
  ),
  waveform: (
    <>
      <path d="M4 10v4" />
      <path d="M8 6.5v11" />
      <path d="M12 4v16" />
      <path d="M16 7.5v9" />
      <path d="M20 10.5v3" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3.5" />
    </>
  ),
  fileAudio: (
    <>
      <path d="M14.5 3H7a2.5 2.5 0 0 0-2.5 2.5v13A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5V8z" />
      <path d="M14.5 3v5h5" />
      <path d="M9.5 17v-4l4-1v4" />
      <circle cx="8.5" cy="17" r="1.25" />
      <circle cx="12.5" cy="16" r="1.25" />
    </>
  ),

  /* navegação e controles */
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.9-4.9" />
    </>
  ),
  filter: <path d="M3.5 5.5h17l-6.5 7.5v5.75l-4 2V13z" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronUp: <path d="m6 14.5 6-6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.5 4.5V10H15" />
    </>
  ),
  undo: (
    <>
      <path d="M4 9.5h10.5a5 5 0 0 1 0 10H8.5" />
      <path d="M7.5 5.5 3.5 9.5l4 4" />
    </>
  ),
  edit: (
    <>
      <path d="M16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4.5 1.5L5 16z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11" />
      <path d="m7.5 10 4.5 4.5L16.5 10" />
      <path d="M4 16.5v2A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-2" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11.5" height="11.5" rx="2.5" />
      <path d="M6.5 15H5.5a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2H13a2 2 0 0 1 2 2v1" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="M6 7v11.5A2.5 2.5 0 0 0 8.5 21h7a2.5 2.5 0 0 0 2.5-2.5V7" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
  star: (
    <path d="m12 3.5 2.6 5.6 6 .8-4.4 4.3 1.1 6.1L12 17.4l-5.3 2.9 1.1-6.1L3.4 9.9l6-.8z" />
  ),

  /* estados e status */
  alert: (
    <>
      <path d="M10.3 4.3 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4" />
      <path d="M12 16.75h.01" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-10" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5 5.5-5.5" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11.25V16.5" />
      <path d="M12 7.75h.01" />
    </>
  ),
  spinner: <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />,

  /* métricas e domínio */
  metrics: (
    <>
      <path d="M4.5 20v-6.5" />
      <path d="M9.75 20V8" />
      <path d="M15 20v-8.5" />
      <path d="M20.25 20V4.5" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 18a8.5 8.5 0 1 1 16 0" />
      <path d="m12 18 4.25-5.25" />
      <circle cx="12" cy="18" r="1.25" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.25" />
      <path d="M12 11.9h.01" />
    </>
  ),
  trendUp: (
    <>
      <path d="m3.5 16.5 5.5-5.5 4 4 7.5-7.5" />
      <path d="M15 7.5h5.5V13" />
    </>
  ),
  trendDown: (
    <>
      <path d="m3.5 7.5 5.5 5.5 4-4 7.5 7.5" />
      <path d="M15 16.5h5.5V11" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.25V12l3.25 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3.5 10.5h17" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6z" />
      <path d="m9 12 2.25 2.25L15.5 10" />
    </>
  ),
  sparkles: (
    <>
      <path d="M11 3.5l1.7 4.3 4.3 1.7-4.3 1.7L11 15.5l-1.7-4.3L5 9.5l4.3-1.7z" />
      <path d="M18.25 15.5l.85 2.15 2.15.85-2.15.85-.85 2.15-.85-2.15L15.25 18.5l2.15-.85z" />
    </>
  ),
  login: (
    <>
      <path d="M14.5 3.5h3.75a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H14.5" />
      <path d="M10 8.5 13.5 12 10 15.5" />
      <path d="M13.5 12h-10" />
    </>
  ),
  logout: (
    <>
      <path d="M9.5 3.5H5.75a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2H9.5" />
      <path d="M16.5 8.5 20 12l-3.5 3.5" />
      <path d="M20 12H10" />
    </>
  ),

  /* administração e operação */
  bolt: <path d="M13.5 3 5 13.5h5.5L10.5 21 19 10.5h-5.5z" />,
  layers: (
    <>
      <path d="m12 3 8.5 4.5L12 12 3.5 7.5z" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5" />
      <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
    </>
  ),
  activity: <path d="M3.5 12H7l2.5-6 4 12 2.5-6h4.5" />,
  workflow: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M8.5 6h7" />
      <path d="m7.5 8.2 3.5 7.4" />
      <path d="m16.5 8.2-3.5 7.4" />
    </>
  ),
  bug: (
    <>
      <rect x="7.5" y="7.5" width="9" height="12" rx="4.5" />
      <path d="M9.5 7.5 8 4.5" />
      <path d="m14.5 7.5 1.5-3" />
      <path d="M7.5 12H4" />
      <path d="M16.5 12H20" />
      <path d="M7.5 16.5H4.5" />
      <path d="M16.5 16.5h3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="16" r="4" />
      <path d="m10.9 13.1 8.6-8.6" />
      <path d="m15.5 8.5 2.5 2.5" />
      <path d="M18 6l2.5 2.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2" />
      <path d="M12 19.5v2" />
      <path d="m4.6 4.6 1.4 1.4" />
      <path d="m18 18 1.4 1.4" />
      <path d="M2.5 12h2" />
      <path d="M19.5 12h2" />
      <path d="m4.6 19.4 1.4-1.4" />
      <path d="m18 6 1.4-1.4" />
    </>
  ),
  moon: (
    <path d="M20.5 15.3A8.5 8.5 0 0 1 8.7 3.5 7 7 0 1 0 20.5 15.3z" />
  ),
};

export const iconNames = Object.keys(icons);

export function Icon({
  name,
  size = 20,
  label,
  strokeWidth = 1.75,
  className,
  ...rest
}) {
  const shape = icons[name];

  if (!shape) {
    // Nome inválido nunca deve derrubar a tela: não renderiza nada.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Icon: nome desconhecido "${name}".`);
    }
    return null;
  }

  const meaningful = Boolean(label);

  return (
    <svg
      aria-hidden={meaningful ? undefined : "true"}
      className={className}
      fill="none"
      focusable="false"
      height={size}
      role={meaningful ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={size}
      {...rest}
    >
      {meaningful ? <title>{label}</title> : null}
      {shape}
    </svg>
  );
}

export default Icon;
