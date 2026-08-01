// Palette catégorielle validée (accessibilité daltonisme + contraste) — ordre fixe, jamais permuté.
// Une couleur par client, dérivée de son id : chaque client garde toujours la même teinte.
// `text` est une variante assombrie de `light`, calculée pour un contraste ≥ 4.5:1 sur fond blanc
// (certaines teintes vives — jaune, magenta, aqua — ne sont pas assez lisibles telles quelles en texte).
const PALETTE: { light: string; dark: string; text: string }[] = [
  { light: '#2a78d6', dark: '#3987e5', text: '#2876d2' }, // bleu
  { light: '#eb6834', dark: '#d95926', text: '#cc4814' }, // orange
  { light: '#1baf7a', dark: '#199e70', text: '#15855d' }, // aqua
  { light: '#eda100', dark: '#c98500', text: '#9c6a00' }, // jaune
  { light: '#e87ba4', dark: '#d55181', text: '#da2c6e' }, // magenta
  { light: '#008300', dark: '#008300', text: '#008300' }, // vert
  { light: '#4a3aa7', dark: '#9085e9', text: '#4a3aa7' }, // violet
  { light: '#e34948', dark: '#e66767', text: '#df2f2e' }, // rouge
];

export function clientColor(clientId: number | null | undefined) {
  if (clientId == null) return null;
  return PALETTE[clientId % PALETTE.length];
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Styles prêts à l'emploi pour un bloc/badge d'événement sur fond sombre (planificateur).
export function clientBlocStyle(clientId: number | null | undefined) {
  const c = clientColor(clientId);
  if (!c) return null;
  return {
    borderColor: c.dark,
    backgroundColor: hexToRgba(c.dark, 0.14),
    color: c.dark,
  };
}

// Style pour un pastille/point d'identification sur fond clair (dashboard).
export function clientDotStyle(clientId: number | null | undefined) {
  const c = clientColor(clientId);
  if (!c) return null;
  return { backgroundColor: c.light };
}

// Bordure gauche colorée pour une carte sur fond clair (planificateur en cartes).
export function clientCardBorderStyle(clientId: number | null | undefined) {
  const c = clientColor(clientId);
  if (!c) return null;
  return { borderLeftColor: c.light };
}

// Couleur de texte lisible (titre, badge) sur fond clair — contraste ≥ 4.5:1 garanti.
export function clientTextStyle(clientId: number | null | undefined) {
  const c = clientColor(clientId);
  if (!c) return null;
  return { color: c.text };
}
