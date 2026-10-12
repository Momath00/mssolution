import { ICONES } from '@/components/Icone';

// Offre de services affichée sur l'accueil (trois premiers) et la page Services.
export const services = [
  {
    titre: 'Applications web sur mesure',
    icone: ICONES.grille,
    description:
      "Portails clients, tableaux de bord et outils internes accessibles partout, sur ordinateur comme sur mobile, construits autour de vos façons de travailler.",
  },
  {
    titre: 'Applications logicielles',
    icone: ICONES.code,
    description:
      "Logiciels de gestion, de facturation ou de planification conçus pour votre entreprise, au lieu d'adapter votre entreprise à un logiciel générique.",
  },
  {
    titre: 'Automatisation des processus',
    icone: ICONES.eclair,
    description:
      "Rappels, relances, documents PDF, rapports, synchronisation de données : nous automatisons les tâches répétitives pour libérer votre équipe.",
  },
  {
    titre: 'Transformation numérique',
    icone: ICONES.transformer,
    description:
      "Nous transformons vos fichiers Excel, vos formulaires papier et vos systèmes dépassés en outils numériques modernes et centralisés.",
  },
  {
    titre: 'Intégration & API',
    icone: ICONES.lien,
    description:
      "Connexion de vos applications à des services tiers (paiement, courriel, comptabilité, CRM) pour que vos données circulent sans ressaisie.",
  },
  {
    titre: 'Hébergement & maintenance',
    icone: ICONES.serveur,
    description:
      "Déploiement, surveillance, sauvegardes et mises à jour continues pour garantir la stabilité et la sécurité de vos applications.",
  },
];

// Ce que la transformation numérique change concrètement (section Avant / Après).
export const transformation = [
  { avant: 'Fichiers Excel dispersés', apres: 'Une application centralisée' },
  { avant: 'Saisie manuelle en double', apres: 'Données saisies une seule fois' },
  { avant: 'Relances oubliées', apres: 'Rappels envoyés automatiquement' },
  { avant: 'Documents papier', apres: 'Documents PDF générés en un clic' },
  { avant: 'Accès au bureau seulement', apres: 'Accessible partout, en tout temps' },
];

export const etapes = [
  {
    titre: 'Écoute',
    icone: ICONES.discussion,
    description: 'Nous analysons vos processus actuels pour repérer ce qui peut être simplifié et automatisé.',
  },
  {
    titre: 'Conception',
    icone: ICONES.ecran,
    description: 'Maquettes et parcours utilisateurs validés avec vous avant la première ligne de code.',
  },
  {
    titre: 'Développement',
    icone: ICONES.code,
    description: 'Livraisons régulières pour suivre l\'avancement et ajuster en cours de route.',
  },
  {
    titre: 'Mise en ligne & suivi',
    icone: ICONES.fusee,
    description: 'Déploiement sécurisé, formation de votre équipe et maintenance continue.',
  },
];
