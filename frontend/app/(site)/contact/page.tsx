import ContactForm from '@/components/ContactForm';

export const metadata = {
  title: 'Contact',
  description:
    "Contactez MS Solution Informatique pour discuter de votre projet de site web ou de plateforme applicative sur mesure.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold text-navy">Contactez-nous</h1>
      <p className="mt-2 text-black/60">
        Une question, un projet ? Écrivez-nous et nous vous répondrons rapidement.
      </p>
      <div className="mt-10">
        <ContactForm />
      </div>
    </div>
  );
}
