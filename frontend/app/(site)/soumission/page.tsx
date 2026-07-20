import SoumissionForm from '@/components/SoumissionForm';

export const metadata = {
  title: 'Demander une soumission',
  description:
    "Décrivez votre projet et recevez une soumission personnalisée de MS Solution Informatique pour votre site web ou votre plateforme applicative.",
};

export default function SoumissionPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold text-navy">Demander une soumission</h1>
      <p className="mt-2 text-black/60">
        Décrivez votre projet et votre entreprise, notre équipe vous revient rapidement avec une soumission.
      </p>
      <div className="mt-10">
        <SoumissionForm />
      </div>
    </div>
  );
}
