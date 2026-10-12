import ContactForm from '@/components/ContactForm';
import PageHero from '@/components/site/PageHero';

export const metadata = {
  title: 'Contact',
  description:
    "Contactez MS Solution Informatique pour discuter de votre projet d'application web, de logiciel sur mesure ou d'automatisation.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        surtitre="Contact"
        titre="Contactez-nous"
        description="Une question, un projet ? Écrivez-nous et nous vous répondrons rapidement."
      />
      <div className="relative mx-auto -mt-10 mb-20 w-full max-w-2xl px-6">
        <div className="animate-entree rounded-2xl border border-black/5 bg-white p-6 shadow-xl shadow-navy/10 sm:p-10" style={{ '--d': '300ms' } as React.CSSProperties}>
          <ContactForm />
        </div>
      </div>
    </>
  );
}
