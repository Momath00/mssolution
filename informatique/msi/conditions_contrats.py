"""
Notes et modalités par catégorie, affichées sur la soumission et copiées (figées)
dans Contrat.conditions_json au moment de la signature. Volontairement courtes et
en langage clair plutôt qu'en clauses juridiques — ce ne sont pas des avis
juridiques, seulement des modalités pratiques.
"""

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
            'Propriété',
            "Les droits sur la solution développée sont transférés au client une fois le paiement complété.",
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
}


def generer_conditions(categorie, *, numero_soumission, total):
    """Retourne la liste [{titre, texte}] figée pour une soumission donnée."""
    gabarit = CONDITIONS_CONTRATS.get(categorie, [])
    return [
        {'titre': titre, 'texte': texte.format(numero_soumission=numero_soumission, total=total)}
        for titre, texte in gabarit
    ]
