import Link from 'next/link';

import Reveal from '@/components/Reveal';

export const metadata = {
  title: 'Services',
  description:
    "Sites web sur mesure, plateformes applicatives, facturation, intégrations API et hébergement : découvrez les services de MS Solution Informatique pour votre entreprise.",
};

const services = [
  {
    titre: 'Sites web sur mesure',
    description:
      "Sites vitrines, institutionnels ou promotionnels conçus autour de votre image de marque, avec un design professionnel et une performance optimisée.",
  },
  {
    titre: 'Plateformes web applicatives',
    description:
      "Portails clients, dashboards de gestion, outils internes : nous développons des applications web adaptées à vos processus d'affaires réels.",
  },
  {
    titre: 'Facturation et gestion',
    description:
      "Des outils de facturation et de gestion client sur mesure, avec génération de documents PDF et automatisation des tâches répétitives.",
  },
  {
    titre: 'Intégration & API',
    description:
      "Connexion de votre plateforme à des services tiers (paiement, courriel, CRM) pour automatiser vos flux de travail.",
  },
  {
    titre: 'Hébergement & maintenance',
    description:
      "Déploiement, surveillance et mises à jour continues pour garantir la stabilité et la sécurité de votre plateforme.",
  },
  {
    titre: 'Accompagnement continu',
    description:
      "Un point de contact unique pour faire évoluer votre plateforme au rythme de la croissance de votre entreprise.",
  },
];

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-bold text-navy">Nos services</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        De la conception à la maintenance, nous accompagnons votre entreprise à chaque étape de votre présence en ligne.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service, i) => (
          <Reveal key={service.titre} delay={(i % 3) * 100}>
            <div className="h-full rounded-xl border border-black/5 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <h2 className="font-semibold text-navy">{service.titre}</h2>
              <p className="mt-2 text-sm text-black/60">{service.description}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-14 rounded-xl bg-navy px-8 py-10 text-center text-white">
        <h2 className="text-xl font-bold">Un besoin spécifique ?</h2>
        <p className="mt-2 text-white/70">Parlons de votre projet et bâtissons ensemble la solution qu&apos;il vous faut.</p>
        <Link
          href="/soumission"
          className="mt-6 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold hover:opacity-90"
        >
          Demander une soumission
        </Link>
      </Reveal>
    </div>
  );
}
