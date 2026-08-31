"""
Notes et modalités par catégorie, affichées sur la soumission et copiées (figées)
dans Contrat.conditions_json au moment de la signature. Volontairement courtes et
en langage clair plutôt qu'en clauses juridiques — ce ne sont pas des avis
juridiques, seulement des modalités pratiques.
"""

from decimal import Decimal

CONDITIONS_CONTRATS = {
    'developpement': [
        (
            'Portée des travaux',
            "Les travaux se limitent à ce qui est décrit ci-dessus. Tout ajout sera couvert par une "
            "soumission séparée.",
        ),
        (
            'Paiement',
            "Le paiement complet (100 %) est exigible à l'acceptation de la soumission, sauf entente "
            "contraire.",
        ),
        (
            'Livraison',
            "Le client dispose de 10 jours ouvrables après chaque livraison pour signaler toute "
            "non-conformité.",
        ),
        (
            'Accompagnement',
            "Un accompagnement technique d'un (1) mois suivant la livraison est inclus sans frais — "
            "questions d'utilisation et correction des anomalies liées aux travaux réalisés. Au-delà de "
            "cette période, un contrat de maintenance distinct peut être proposé.",
        ),
    ],
    'maintenance': [
        (
            'Portée',
            "Couvre la correction d'anomalies, les mises à jour de sécurité et le support technique de la "
            "solution existante. Tout nouveau développement fait l'objet d'une soumission séparée.",
        ),
        (
            'Facturation',
            "Selon la fréquence indiquée ci-dessus, renouvelée automatiquement sauf avis contraire donné "
            "30 jours à l'avance.",
        ),
        (
            'Résiliation',
            "Possible en tout temps avec un préavis écrit de 30 jours.",
        ),
    ],
    'fonctionnalite': [
        (
            'Portée',
            "Les travaux se limitent à ce qui est décrit ci-dessus.",
        ),
        (
            'Paiement',
            "Exigible à la livraison, sauf entente contraire.",
        ),
        (
            'Garantie',
            "Toute anomalie liée à ces travaux, signalée dans les 30 jours suivant la livraison, est "
            "corrigée sans frais.",
        ),
    ],
    'abonnement_saas': [
        (
            'Portée',
            "Donne accès à la plateforme logicielle décrite ci-dessus, pour l'organisation cliente, "
            "pour une durée de douze (12) mois à compter de l'acceptation de la présente soumission.",
        ),
        (
            'Paiement',
            "Le paiement complet (100 %) est exigible à l'acceptation de la présente soumission. Aucun "
            "acompte n'est requis.",
        ),
        (
            'Renouvellement',
            "L'abonnement est reconduit automatiquement pour une période additionnelle de douze (12) "
            "mois, sauf avis écrit donné par l'une ou l'autre partie au moins 30 jours avant l'échéance.",
        ),
        (
            'Suspension',
            "L'accès à la plateforme peut être suspendu si le paiement n'est pas reçu dans les 30 jours "
            "suivant la date d'échéance de la facture de renouvellement.",
        ),
    ],
}


def generer_conditions(categorie, *, numero_soumission, total, pourcentage_acompte=None):
    """Retourne la liste [{titre, texte}] figée pour une soumission donnée.

    Quand un pourcentage_acompte est fourni pour une soumission de développement, la
    clause "Paiement" par défaut (100 % à l'acceptation) est remplacée par une clause
    décrivant l'acompte exigé à la signature et le solde exigible à la livraison.
    """
    gabarit = CONDITIONS_CONTRATS.get(categorie, [])
    conditions = [
        {'titre': titre, 'texte': texte.format(numero_soumission=numero_soumission, total=total)}
        for titre, texte in gabarit
    ]
    if categorie == 'developpement' and pourcentage_acompte:
        montant_acompte = (Decimal(str(total)) * Decimal(str(pourcentage_acompte)) / Decimal('100')).quantize(Decimal('0.01'))
        pourcentage_solde = Decimal('100') - Decimal(str(pourcentage_acompte))
        texte_paiement = (
            f"Un acompte de {pourcentage_acompte} % ({montant_acompte} $ taxes incluses) est exigible "
            f"à la signature de la présente soumission. Le solde de {pourcentage_solde} % est exigible à la "
            "livraison/mise en ligne du logiciel."
        )
        for condition in conditions:
            if condition['titre'] == 'Paiement':
                condition['texte'] = texte_paiement
    return conditions
