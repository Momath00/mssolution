import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { fetchServer, mediaUrl, type Coordonnees } from "@/lib/api";

const siteUrl = "https://mssolutioninformatique.com";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  let coordonnees: Coordonnees | null = null;
  try {
    coordonnees = await fetchServer<Coordonnees>("/api/coordonnees/");
  } catch {
    coordonnees = null;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: coordonnees?.nom_entreprise || "MS Solution Informatique",
    url: siteUrl,
    logo: `${siteUrl}/logo-icon-trimmed.png`,
    image: coordonnees?.logo ? mediaUrl(coordonnees.logo) || undefined : `${siteUrl}/logo-icon-trimmed.png`,
    description: "Conception et développement de plateformes web sur mesure pour les entreprises.",
    ...(coordonnees?.courriel ? { email: coordonnees.courriel } : {}),
    ...(coordonnees?.telephone ? { telephone: coordonnees.telephone } : {}),
    ...(coordonnees?.adresse ? { address: coordonnees.adresse } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </>
  );
}
