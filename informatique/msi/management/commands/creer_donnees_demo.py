"""
Crée des clients, factures (avec plans de paiement et paiements partiels) et soumissions
fictifs pour voir la facturation en action. À n'utiliser qu'en développement local.

    python manage.py creer_donnees_demo              # crée (remplace les données démo existantes)
    python manage.py creer_donnees_demo --supprimer  # retire toutes les données démo

Tout est repérable par le suffixe « (démo) » dans le nom du client, et les courriels sont
en @exemple.test : aucun vrai client ne peut recevoir quoi que ce soit.
Aucun courriel n'est envoyé par cette commande.
"""

from datetime import datetime, time, timedelta
from decimal import Decimal
from unittest import mock

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.test import RequestFactory
from django.utils import timezone

from msi.contrats import creer_contrat
from msi.models import Client, Contrat, Document, Evenement, LigneDocument, Paiement
from msi.paiements import definir_echeancier, enregistrer_paiement

SUFFIXE = '(démo)'
CENT = Decimal('0.01')


def jours(n):
    return timezone.localdate() + timedelta(days=n)


def repartir(total, dates, depot=None):
    """Découpe le total en versements égaux (le dernier absorbe les cents), avec dépôt optionnel."""
    versements = []
    reste = total
    if depot:
        date_depot, montant_depot = depot
        versements.append({'date': date_depot, 'montant': montant_depot, 'note': 'Dépôt'})
        reste -= montant_depot
    n = len(dates)
    base = (reste / n).quantize(CENT, rounding='ROUND_DOWN')
    for i, d in enumerate(dates):
        montant = reste - base * (n - 1) if i == n - 1 else base
        versements.append({'date': d, 'montant': montant, 'note': ''})
    return versements


class Command(BaseCommand):
    help = 'Crée (ou supprime avec --supprimer) des données de démonstration pour la facturation.'

    def add_arguments(self, parser):
        parser.add_argument('--supprimer', action='store_true', help='Supprime les données de démo.')

    def handle(self, *args, supprimer, **options):
        if not settings.DEBUG:
            raise CommandError('Commande réservée au développement local (DEBUG=False).')
        with transaction.atomic():
            nb = self.supprimer()
            if supprimer:
                self.stdout.write(self.style.SUCCESS(f'{nb} client(s) démo supprimé(s) avec leurs documents.'))
                return
            self.creer()

    # ------------------------------------------------------------------------------
    def supprimer(self):
        clients = Client.objects.filter(nom_entreprise__endswith=SUFFIXE)
        documents = Document.objects.filter(client__in=clients)
        Evenement.objects.filter(document__in=documents).delete()
        for paiement in Paiement.objects.filter(document__in=documents).exclude(preuve=''):
            paiement.preuve.delete(save=False)
        for contrat in Contrat.objects.filter(soumission__in=documents):
            contrat.pdf.delete(save=False)
            contrat.delete()
        documents.delete()  # lignes, versements et paiements suivent (CASCADE)
        return clients.delete()[1].get('msi.Client', 0)

    def client(self, nom, contact):
        slug = nom.lower().split()[0]
        return Client.objects.create(
            nom_entreprise=f'{nom} {SUFFIXE}', nom_contact=contact,
            courriel=f'{slug}@exemple.test', telephone='514-555-0100',
            adresse='123 rue Exemple, Montréal (QC)', created_by=self.user,
        )

    def document(self, client, type_document, lignes, statut, cree_il_y_a, **extra):
        doc = Document.objects.create(
            numero=Document.generer_numero(type_document), type_document=type_document,
            client=client, statut=statut, created_by=self.user, **extra,
        )
        for description, quantite, prix in lignes:
            LigneDocument.objects.create(
                document=doc, description=description, quantite=quantite, prix_unitaire=Decimal(prix),
            )
        # Antidate la création (auto_now_add l'a mise à maintenant).
        creation = timezone.make_aware(datetime.combine(jours(-cree_il_y_a), time(10, 0)))
        Document.objects.filter(pk=doc.pk).update(
            date_creation=creation, date_envoi=creation if statut != 'brouillon' else None,
        )
        return Document.objects.get(pk=doc.pk)

    def payer(self, facture, montant, il_y_a, mode='virement', reference=''):
        enregistrer_paiement(
            facture, Decimal(montant), jours(-il_y_a), mode, reference=reference, utilisateur=self.user,
        )

    def creer(self):
        self.user = get_user_model().objects.filter(is_superuser=True).first()
        resume = []

        # 1. Ton exemple : 10 000 $, dépôt 1 700 $ + 3 versements mensuels. À jour.
        c = self.client('Garage Tremblay', 'Luc Tremblay')
        f = self.document(c, 'facture', [('Développement logiciel de gestion d’atelier', 1, '8697.54')],
                          'envoyee', 62, categorie='developpement')
        definir_echeancier(f, repartir(f.total, [jours(-30), jours(3), jours(33)], depot=(jours(-60), Decimal('1700'))))
        self.payer(f, '1700', 60, reference='INT-4411')
        self.payer(f, '2766.66', 29, 'cheque', 'Chèque 118')
        resume.append(f'{f.numero} Garage Tremblay : 10 000 $, dépôt + 3 mensuels, à jour (prochain dans 3 jours)')

        # 2. Aux 2 semaines, 1 seul versement payé sur 4 → en retard de 36 jours.
        c = self.client('Boulangerie Côté', 'Marie Côté')
        f = self.document(c, 'facture', [('Site Web transactionnel', 1, '4500'), ('Hébergement 1 an', 1, '600')],
                          'envoyee', 55, categorie='developpement')
        definir_echeancier(f, repartir(f.total, [jours(-50), jours(-36), jours(-22), jours(-8)]))
        self.payer(f, repartir(f.total, [1, 2, 3, 4])[0]['montant'], 49)
        resume.append(f'{f.numero} Boulangerie Côté : 4 versements aux 2 semaines, 3 en retard')

        # 3. Sans plan, échue depuis 100 jours, seulement 500 $ reçus → plus de 90 jours.
        c = self.client('Clinique Dentaire Lavoie', 'Dr Paul Lavoie')
        f = self.document(c, 'facture', [('Maintenance annuelle', 1, '2400')], 'envoyee', 130,
                          categorie='maintenance', date_echeance=jours(-100))
        self.payer(f, '500', 95, 'cheque', 'Chèque 2045')
        resume.append(f'{f.numero} Clinique Lavoie : sans plan, échue depuis 100 jours, 500 $ payés')

        # 4. Aux 45 jours : 1er versement payé en partie → en retard de 10 jours.
        c = self.client('Transport Gagnon', 'Sylvie Gagnon')
        f = self.document(c, 'facture', [('Application de suivi de flotte', 1, '12000')], 'envoyee', 20,
                          categorie='developpement')
        definir_echeancier(f, repartir(f.total, [jours(-10), jours(35), jours(80)]))
        self.payer(f, '1000', 9, 'depot')
        resume.append(f'{f.numero} Transport Gagnon : 3 versements aux 45 jours, 1er partiellement payé')

        # 5. Entièrement payée en 2 fois.
        c = self.client('Studio Yoga Zen', 'Julie Morin')
        f = self.document(c, 'facture', [('Module de réservation en ligne', 1, '1800')], 'envoyee', 40,
                          categorie='fonctionnalite')
        moitie = (f.total / 2).quantize(CENT)
        self.payer(f, moitie, 35)
        self.payer(f, f.total - moitie, 5, 'carte')
        resume.append(f'{f.numero} Studio Yoga Zen : payée en 2 paiements')

        # 6. Plan de 6 mois, rien d'échu encore.
        c = self.client('Épicerie Nguyen', 'Minh Nguyen')
        f = self.document(c, 'facture', [('Abonnement annuel ExtincPro', 1, '3000')], 'envoyee', 2,
                          categorie='abonnement_saas')
        definir_echeancier(f, repartir(f.total, [jours(15 + 30 * i) for i in range(6)]))
        resume.append(f'{f.numero} Épicerie Nguyen : 6 versements mensuels, tous à venir')

        # 7. Brouillon avec plan (pas encore envoyée → pas dans les comptes à recevoir).
        f = self.document(c, 'facture', [('Formation du personnel', 4, '150')], 'brouillon', 0,
                          categorie='fonctionnalite')
        definir_echeancier(f, repartir(f.total, [jours(30), jours(60)]))
        resume.append(f'{f.numero} Épicerie Nguyen : brouillon avec plan en 2 versements')

        # Soumissions dans différents états.
        c_resto = self.client('Restaurant Chez Mimi', 'Mimi Bouchard')
        s = self.document(c_resto, 'soumission', [('Site Web + menu en ligne', 1, '5500'), ('Formation', 2, '150')],
                          'envoyee', 3, categorie='developpement', date_echeance=jours(27))
        definir_echeancier(s, repartir(s.total, [jours(30), jours(60), jours(90)], depot=(jours(0), Decimal('1500'))))
        resume.append(f'{s.numero} Restaurant Chez Mimi : soumission envoyée avec plan (dépôt 1 500 $ + 3 mensuels)')

        c = Client.objects.get(nom_entreprise=f'Transport Gagnon {SUFFIXE}')
        s = self.document(c, 'soumission', [('Module de facturation', 1, '4000')], 'envoyee', 1,
                          categorie='fonctionnalite', date_echeance=jours(29))
        definir_echeancier(s, repartir(s.total, [jours(-7 + 14 * i) for i in range(4)]))
        resume.append(
            f'{s.numero} Transport Gagnon : soumission avec plan aux 2 semaines dont le 1er versement est déjà '
            'passé (dates reportées si acceptée)'
        )

        # Soumission avec plan, acceptée par le client : contrat + facture créés automatiquement.
        c = self.client('Pharmacie Roy', 'Anne Roy')
        s = self.document(c, 'soumission', [('Application de gestion des ordonnances', 1, '15000')], 'envoyee', 8,
                          categorie='developpement', date_echeance=jours(22))
        definir_echeancier(s, repartir(s.total, [jours(-3), jours(27), jours(57), jours(87)]))
        requete = RequestFactory().post('/', REMOTE_ADDR='127.0.0.1', HTTP_USER_AGENT='Données démo')
        # L'envoi de la facture au client est neutralisé : aucun courriel ne part.
        with mock.patch('msi.contrats.envoyer_document'):
            contrat = creer_contrat(s, requete, 'Anne Roy')
        facture = contrat.factures_liees.get()
        self.payer(facture, facture.echeances.first().montant, 0, reference='INT-9001')
        resume.append(
            f'{s.numero} Pharmacie Roy : soumission avec plan ACCEPTÉE → contrat {contrat.numero} + '
            f'facture {facture.numero} (plan reporté de 3 jours, 1er versement payé)'
        )
        s = self.document(c_resto, 'soumission', [('Application de commandes', 1, '9000')], 'brouillon', 0,
                          categorie='developpement', pourcentage_acompte=Decimal('50'))
        resume.append(f'{s.numero} Restaurant Chez Mimi : soumission en brouillon, acompte 50 %')
        c = Client.objects.get(nom_entreprise=f'Boulangerie Côté {SUFFIXE}')
        s = self.document(c, 'soumission', [('Maintenance mensuelle', 12, '200')], 'refusee', 20,
                          categorie='maintenance')
        resume.append(f'{s.numero} Boulangerie Côté : soumission refusée')
        c = Client.objects.get(nom_entreprise=f'Studio Yoga Zen {SUFFIXE}')
        s = self.document(c, 'soumission', [('Module de réservation en ligne', 1, '1800')], 'acceptee', 42,
                          categorie='fonctionnalite')
        Document.objects.filter(pk=s.pk).update(date_reponse=timezone.now() - timedelta(days=41))
        resume.append(f'{s.numero} Studio Yoga Zen : soumission acceptée')

        for ligne in resume:
            self.stdout.write(f'  • {ligne}')
        self.stdout.write(self.style.SUCCESS(f'{len(resume)} documents de démo créés.'))
