"""
Envoie tous les rappels automatiques du jour (voir msi/rappels.py) : relances de soumissions,
avis d'expiration, rappels de versements à venir et de paiements en retard.

À planifier une fois par jour (cron Railway), par exemple chaque matin :
    python manage.py envoyer_rappels
Pour voir ce qui partirait, sans rien envoyer :
    python manage.py envoyer_rappels --simulation
"""

from django.core.management.base import BaseCommand

from msi.rappels import executer_rappels


class Command(BaseCommand):
    help = 'Envoie les rappels automatiques du jour (soumissions et paiements).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--simulation', action='store_true', help='Affiche ce qui serait envoyé, sans rien envoyer.',
        )

    def handle(self, *args, simulation, **options):
        resultat = executer_rappels(simulation=simulation)
        if not resultat['actifs']:
            self.stdout.write('Rappels automatiques désactivés (Paramètres).')
            return
        if not resultat['actions']:
            self.stdout.write('Aucun rappel à envoyer aujourd’hui.')
            return
        for action in resultat['actions']:
            ligne = f"[{action['statut']}] {action['libelle']} — {action['numero']} ({action['client']}) : {action['detail']}"
            if action['statut'] == 'echec':
                self.stderr.write(self.style.ERROR(f"{ligne} — {action['erreur']}"))
            else:
                self.stdout.write(self.style.SUCCESS(ligne) if action['statut'] == 'envoye' else ligne)
        if not simulation:
            self.stdout.write(f"{resultat['envoyes']} envoyé(s), {resultat['echecs']} échec(s).")
