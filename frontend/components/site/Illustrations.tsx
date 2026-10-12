// Illustrations au trait du site public, dans un même style : traits bleu marine,
// fonds blancs et quelques touches de couleur. Les mouvements discrets sont
// définis dans globals.css (classes .illu-*) et coupés si le visiteur préfère
// réduire les animations.

const TRAIT = '#1a1440';
const ROUGE = '#e63946';
const JAUNE = '#fde68a';
const LAVANDE = '#e0e7ff';
const VERT = '#a7f3d0';

const trait = {
  stroke: TRAIT,
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

interface Props {
  className?: string;
}

export function IlluEcoute({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <ellipse cx="80" cy="108" rx="54" ry="5" fill={LAVANDE} />
      {/* Grande bulle : le besoin du client */}
      <g className="illu-flotte">
        <path d="M22 22h76a10 10 0 0 1 10 10v30a10 10 0 0 1-10 10H52l-14 12v-12H22a10 10 0 0 1-10-10V32a10 10 0 0 1 10-10Z" fill="white" {...trait} />
        <circle className="illu-point" cx="44" cy="47" r="4.5" fill={TRAIT} />
        <circle className="illu-point" style={{ animationDelay: '0.2s' }} cx="60" cy="47" r="4.5" fill={TRAIT} />
        <circle className="illu-point" style={{ animationDelay: '0.4s' }} cx="76" cy="47" r="4.5" fill={TRAIT} />
      </g>
      {/* Petite bulle : l'idée */}
      <g className="illu-flotte" style={{ animationDelay: '-2s' }}>
        <path d="M104 50h36a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8h-6v10l-11-10h-19a8 8 0 0 1-8-8V58a8 8 0 0 1 8-8Z" fill={JAUNE} {...trait} />
        <path d="M122 60a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14Z" fill="white" {...trait} />
        <path d="M118 80h8" {...trait} />
      </g>
    </svg>
  );
}

export function IlluConception({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <ellipse cx="80" cy="108" rx="54" ry="5" fill={LAVANDE} />
      {/* Feuille de maquette */}
      <rect x="24" y="14" width="96" height="84" rx="8" fill="white" {...trait} />
      <path d="M24 30h96" {...trait} />
      <circle cx="33" cy="22" r="2" fill={ROUGE} />
      <circle cx="41" cy="22" r="2" fill={TRAIT} />
      <rect x="34" y="40" width="34" height="26" rx="4" fill={LAVANDE} {...trait} />
      <path d="M76 42h34M76 52h26M76 62h30" {...trait} />
      <path className="illu-trace" d="M34 80h70" stroke={ROUGE} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="70" />
      {/* Crayon */}
      <g className="illu-crayon">
        <path d="M108 86l26-36 10 7-26 36-12 4Z" fill={JAUNE} {...trait} />
        <path d="M134 50l10 7" {...trait} />
        <path d="M108 86l2 7 6-3" fill={TRAIT} {...trait} />
      </g>
    </svg>
  );
}

export function IlluDeveloppement({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <ellipse cx="80" cy="108" rx="58" ry="5" fill={LAVANDE} />
      {/* Ordinateur portable */}
      <rect x="30" y="24" width="84" height="56" rx="6" fill="white" {...trait} />
      <path d="M20 90h104l-8-10H28Z" fill={LAVANDE} {...trait} />
      <path className="illu-code" d="M48 42l-8 10 8 10" {...trait} fill="none" />
      <path className="illu-code" style={{ animationDelay: '0.3s' }} d="M64 64l10-24" {...trait} fill="none" />
      <path className="illu-code" style={{ animationDelay: '0.6s' }} d="M90 42l8 10-8 10" {...trait} fill="none" />
      {/* Engrenages */}
      <g className="illu-tourne">
        <circle cx="132" cy="40" r="12" fill={JAUNE} {...trait} />
        <circle cx="132" cy="40" r="4" fill="white" {...trait} />
        <path d="M132 22v6M132 52v6M114 40h6M144 40h6M119 27l4 4M141 49l4 4M119 53l4-4M141 31l4-4" {...trait} />
      </g>
      <g className="illu-tourne-inverse">
        <circle cx="140" cy="70" r="7" fill={VERT} {...trait} />
        <path d="M140 59v4M140 77v4M129 70h4M147 70h4" {...trait} />
      </g>
    </svg>
  );
}

export function IlluMiseEnLigne({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <ellipse cx="80" cy="108" rx="54" ry="5" fill={LAVANDE} />
      {/* Nuage */}
      <path d="M100 86h34a10 10 0 0 0 0-20 14 14 0 0 0-27-4 10 10 0 0 0-7 24Z" fill="white" {...trait} />
      {/* Traînée */}
      <path className="illu-trace" d="M20 92c16-6 22-20 40-24" stroke={TRAIT} strokeWidth="2" strokeLinecap="round" strokeDasharray="4 6" fill="none" />
      {/* Avion en papier */}
      <g className="illu-envol">
        <path d="M62 66l70-44-28 66-14-18Z" fill="white" {...trait} />
        <path d="M90 70l42-48" {...trait} />
        <path d="M90 70l-4 20 18-2" fill={ROUGE} {...trait} />
      </g>
      <path d="M128 98l4-4 4 4M30 30l3-3 3 3" stroke={ROUGE} strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// Grande illustration de la section Avant / Après : papiers en désordre → application.
export function IlluTransformation({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 320 140" className={className} aria-hidden>
      <ellipse cx="160" cy="128" rx="140" ry="6" fill={LAVANDE} />
      {/* Avant : pile de papiers et classeur */}
      <g className="illu-papiers">
        <rect x="28" y="40" width="52" height="66" rx="3" fill="white" {...trait} transform="rotate(-12 54 73)" />
        <rect x="44" y="34" width="52" height="66" rx="3" fill="white" {...trait} transform="rotate(8 70 67)" />
        <path d="M54 52h30M54 62h24M54 72h28M54 82h18" {...trait} transform="rotate(8 70 67)" />
        <rect x="60" y="94" width="22" height="14" rx="2" fill={JAUNE} {...trait} transform="rotate(-6 71 101)" />
      </g>
      <path d="M96 24l6 6M106 20v8M86 22l4 6" stroke={ROUGE} strokeWidth="2" strokeLinecap="round" />
      {/* Flèche */}
      <path className="illu-fleche" d="M124 74h58m-12-12 12 12-12 12" {...trait} fill="none" strokeWidth="2.6" />
      {/* Après : écran d'application */}
      <rect x="204" y="28" width="96" height="70" rx="7" fill="white" {...trait} />
      <path d="M204 42h96" {...trait} />
      <circle cx="213" cy="35" r="2" fill={ROUGE} />
      <rect x="214" y="50" width="22" height="40" rx="3" fill={LAVANDE} {...trait} />
      {[54, 66, 78].map((y, i) => (
        <g key={y}>
          <circle cx="250" cy={y + 2} r="5" fill={VERT} {...trait} />
          <path className="illu-coche" style={{ animationDelay: `${0.4 + i * 0.4}s` }} d={`M247.5 ${y + 2}l2 2 3.5-4`} {...trait} strokeWidth="1.8" fill="none" pathLength={1} />
          <path d={`M260 ${y + 2}h${30 - i * 6}`} {...trait} />
        </g>
      ))}
      <path d="M236 98l-6 14h56l-6-14" fill={LAVANDE} {...trait} />
    </svg>
  );
}
