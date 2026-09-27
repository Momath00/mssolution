// Montants et dates pour la facturation. Les calculs de répartition se font en cents
// (entiers) pour éviter les erreurs d'arrondi des nombres à virgule.

export function formaterMontant(valeur: string | number | null | undefined): string {
  const n = Number(valeur ?? 0);
  return `${n.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

export function versCents(valeur: string | number): number {
  return Math.round(Number(valeur || 0) * 100);
}

export function depuisCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function dateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
}

export function lireDateISO(iso: string): Date {
  const [y, m, j] = iso.split('-').map(Number);
  return new Date(y, m - 1, j);
}

export function aujourdhuiISO(): string {
  return dateISO(new Date());
}

export function formaterDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return lireDateISO(iso.slice(0, 10)).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ajouterJours(iso: string, jours: number): string {
  const d = lireDateISO(iso);
  d.setDate(d.getDate() + jours);
  return dateISO(d);
}

/** Ajoute des mois en gardant le même jour, ramené au dernier jour du mois au besoin (31 janv. → 28 févr.). */
export function ajouterMois(iso: string, mois: number): string {
  const d = lireDateISO(iso);
  const jour = d.getDate();
  const cible = new Date(d.getFullYear(), d.getMonth() + mois, 1);
  const dernierJour = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
  cible.setDate(Math.min(jour, dernierJour));
  return dateISO(cible);
}
