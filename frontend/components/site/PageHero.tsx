// En-tête commun des pages intérieures du site public.

interface Props {
  surtitre: string;
  titre: string;
  description: string;
}

export default function PageHero({ surtitre, titre, description }: Props) {
  return (
    <section className="relative isolate overflow-hidden bg-navy text-white">
      <div className="bg-grille absolute inset-0 -z-10" />
      <div className="animate-halo absolute -right-24 -top-32 -z-10 h-80 w-80 rounded-full bg-accent/25 blur-3xl" />
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-14 sm:pb-20 sm:pt-16">
        <p
          className="animate-entree text-xs font-semibold uppercase tracking-[0.2em] text-accent"
          style={{ '--d': '0ms' } as React.CSSProperties}
        >
          {surtitre}
        </p>
        <h1
          className="animate-entree mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl"
          style={{ '--d': '100ms' } as React.CSSProperties}
        >
          {titre}
        </h1>
        <p
          className="animate-entree mt-4 max-w-2xl text-white/70 sm:text-lg"
          style={{ '--d': '200ms' } as React.CSSProperties}
        >
          {description}
        </p>
      </div>
    </section>
  );
}
