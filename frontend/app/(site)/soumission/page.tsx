import SoumissionForm from '@/components/SoumissionForm';
import PageHero from '@/components/site/PageHero';

export const metadata = {
  title: 'Demander une soumission',
  description:
    "Décrivez votre projet et recevez une soumission personnalisée de MS Solution Informatique pour votre site web ou votre plateforme applicative.",
};

export default function SoumissionPage() {
  return (
    <>
      <PageHero
        surtitre="Soumission"
        titre="Demander une soumission"
        description="Décrivez votre projet et votre entreprise, notre équipe vous revient rapidement avec une soumission."
      />
      <div className="relative mx-auto -mt-10 mb-20 w-full max-w-2xl px-6">
        <div className="animate-entree rounded-2xl border border-black/5 bg-white p-6 shadow-xl shadow-navy/10 sm:p-10" style={{ '--d': '300ms' } as React.CSSProperties}>
          <SoumissionForm />
        </div>
      </div>
    </>
  );
}
