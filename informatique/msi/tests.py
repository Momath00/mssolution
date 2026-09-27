import os
import shutil
import tempfile
from datetime import timedelta
from decimal import Decimal
from io import StringIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .emails import envoyer_document, envoyer_rappel_paiement, envoyer_recu_paiement
from .excel import generer_excel_comptes_a_recevoir, generer_excel_rapport_comptable
from .models import Client, Contrat, Coordonnees, Document, Evenement, LigneDocument, Paiement
from .paiements import comptes_a_recevoir, definir_echeancier, enregistrer_paiement
from .pdf import generer_pdf_document, generer_rapport_comptable
from .rappels import executer_rappels

AUJOURDHUI = timezone.localdate()


def jours(n):
    return AUJOURDHUI + timedelta(days=n)


class BaseFacture(TestCase):
    def setUp(self):
        # Aucun vrai courriel ne part pendant les tests.
        patcher = mock.patch('msi.emails._client')
        self.courriels = patcher.start()
        self.addCleanup(patcher.stop)
        self.user = get_user_model().objects.create_user(username='admin', password='x')
        self.api = APIClient()
        self.api.force_authenticate(self.user)
        self.client_entreprise = Client.objects.create(nom_entreprise='ACME', courriel='acme@example.com')
        self.facture = self.creer_facture(Decimal('10000'))

    def creer_facture(self, prix, statut='envoyee', **kwargs):
        facture = Document.objects.create(
            numero=Document.generer_numero('facture'), type_document='facture',
            client=self.client_entreprise, statut=statut, **kwargs,
        )
        LigneDocument.objects.create(document=facture, description='Logiciel', quantite=1, prix_unitaire=prix)
        return facture

    def recharger(self, document):
        return Document.objects.prefetch_related('paiements', 'echeances', 'lignes').get(pk=document.pk)

    def payer(self, document, montant, **extra):
        donnees = {'montant': str(montant), 'date': str(AUJOURDHUI), 'mode': 'virement', 'envoyer_recu': False}
        donnees.update(extra)
        return self.api.post(f'/api/documents/{document.id}/paiements/', donnees, format='json')


class PaiementsPartielsTests(BaseFacture):
    def test_paiement_partiel_puis_solde(self):
        total = self.facture.total
        reponse = self.payer(self.facture, '1700')
        self.assertEqual(reponse.status_code, 201, reponse.content)
        doc = reponse.json()['document']
        self.assertEqual(doc['statut'], 'partielle')
        self.assertEqual(Decimal(doc['montant_paye']), Decimal('1700.00'))
        self.assertEqual(Decimal(doc['solde_du']), total - Decimal('1700'))

        reponse = self.payer(self.facture, total - Decimal('1700'))
        self.assertEqual(reponse.status_code, 201, reponse.content)
        doc = reponse.json()['document']
        self.assertEqual(doc['statut'], 'payee')
        self.assertEqual(Decimal(doc['solde_du']), Decimal('0'))

    def test_paiement_superieur_au_solde_refuse(self):
        reponse = self.payer(self.facture, self.facture.total + Decimal('0.01'))
        self.assertEqual(reponse.status_code, 400)
        self.assertFalse(Paiement.objects.exists())

    def test_paiement_nul_ou_futur_refuse(self):
        self.assertEqual(self.payer(self.facture, '0').status_code, 400)
        self.assertEqual(self.payer(self.facture, '10', date=str(jours(1))).status_code, 400)

    def test_facture_deja_payee_refuse(self):
        self.payer(self.facture, self.facture.total)
        self.assertEqual(self.payer(self.facture, '1').status_code, 400)

    def test_supprimer_paiement_recalcule_statut(self):
        self.payer(self.facture, '1700')
        paiement = Paiement.objects.get()
        reponse = self.api.delete(f'/api/documents/{self.facture.id}/paiements/{paiement.id}/')
        self.assertEqual(reponse.status_code, 200, reponse.content)
        self.assertEqual(reponse.json()['statut'], 'envoyee')
        self.assertFalse(Paiement.objects.exists())

    def test_paiement_refuse_sur_soumission(self):
        soumission = Document.objects.create(
            numero='SOU-X', type_document='soumission', client=self.client_entreprise, statut='envoyee',
        )
        LigneDocument.objects.create(document=soumission, description='x', quantite=1, prix_unitaire=10)
        self.assertEqual(self.payer(soumission, '5').status_code, 400)

    def test_statut_payee_manuel_refuse_sur_facture(self):
        reponse = self.api.patch(f'/api/documents/{self.facture.id}/', {'statut': 'payee'}, format='json')
        self.assertEqual(reponse.status_code, 400)

    def test_statut_payee_manuel_permis_sur_soumission(self):
        soumission = Document.objects.create(
            numero='SOU-Y', type_document='soumission', client=self.client_entreprise, statut='acceptee',
        )
        with mock.patch('msi.views.envoyer_confirmation_paiement'):
            reponse = self.api.patch(f'/api/documents/{soumission.id}/', {'statut': 'payee'}, format='json')
        self.assertEqual(reponse.status_code, 200, reponse.content)

    def test_modifier_lignes_recalcule_statut(self):
        self.payer(self.facture, '1700')
        # Le total baisse sous le montant déjà payé : la facture devient payée.
        reponse = self.api.patch(
            f'/api/documents/{self.facture.id}/',
            {'lignes': [{'description': 'Réduit', 'quantite': '1', 'prix_unitaire': '1000'}]},
            format='json',
        )
        self.assertEqual(reponse.status_code, 200, reponse.content)
        self.assertEqual(reponse.json()['statut'], 'payee')
        self.assertEqual(Decimal(reponse.json()['solde_du']), Decimal('0'))
        self.courriels.return_value.Emails.send.assert_not_called()

    def test_recu_envoye_si_demande(self):
        with mock.patch('msi.views.envoyer_recu_paiement') as envoi:
            reponse = self.payer(self.facture, '100', envoyer_recu=True)
        self.assertEqual(reponse.status_code, 201)
        self.assertTrue(reponse.json()['recu_envoye'])
        envoi.assert_called_once()

    def test_echec_du_recu_ne_bloque_pas_le_paiement(self):
        with mock.patch('msi.views.envoyer_recu_paiement', side_effect=RuntimeError('panne')):
            reponse = self.payer(self.facture, '100', envoyer_recu=True)
        self.assertEqual(reponse.status_code, 201)
        self.assertFalse(reponse.json()['recu_envoye'])
        self.assertEqual(Paiement.objects.count(), 1)

    def test_renvoyer_facture_partielle_garde_son_statut(self):
        self.payer(self.facture, '100')
        with mock.patch('msi.views.envoyer_document'):
            reponse = self.api.post(f'/api/documents/{self.facture.id}/envoyer/')
        self.assertEqual(reponse.json()['statut'], 'partielle')


class EcheancierTests(BaseFacture):
    def plan(self, versements):
        return self.api.put(
            f'/api/documents/{self.facture.id}/echeancier/',
            {'versements': [{'date': str(d), 'montant': str(m), 'note': ''} for d, m in versements]},
            format='json',
        )

    def test_somme_differente_du_total_refusee(self):
        reponse = self.plan([(jours(10), '100')])
        self.assertEqual(reponse.status_code, 400)

    def test_plan_valide_et_repartition_des_paiements(self):
        total = self.facture.total
        premier = Decimal('1700')
        reste = total - premier
        moitie = (reste / 2).quantize(Decimal('0.01'))
        reponse = self.plan([(jours(-40), premier), (jours(-5), moitie), (jours(25), reste - moitie)])
        self.assertEqual(reponse.status_code, 200, reponse.content)
        doc = reponse.json()
        self.assertEqual(doc['date_echeance'], str(jours(25)))
        self.assertEqual([e['statut'] for e in doc['echeances']], ['en_retard', 'en_retard', 'a_venir'])
        self.assertEqual(doc['jours_retard'], 40)

        # 1 700 $ payés : le 1er versement est couvert, le 2e reste en retard.
        doc = self.payer(self.facture, premier).json()['document']
        self.assertEqual([e['statut'] for e in doc['echeances']], ['payee', 'en_retard', 'a_venir'])
        self.assertEqual(doc['jours_retard'], 5)
        self.assertEqual(Decimal(doc['montant_en_retard']), moitie)

        # Paiement partiel du 2e versement.
        doc = self.payer(self.facture, '100').json()['document']
        self.assertEqual(Decimal(doc['echeances'][1]['reste']), moitie - 100)
        self.assertEqual(doc['prochaine_echeance'], {'date': str(jours(-5)), 'montant': str(moitie - 100)})

    def test_evenements_de_versement_dans_le_planificateur(self):
        total = self.facture.total
        self.plan([(jours(5), '1000'), (jours(35), total - 1000)])
        evenements = Evenement.objects.filter(document=self.facture).order_by('date')
        self.assertEqual(evenements.count(), 2)
        self.assertFalse(evenements[0].termine)
        self.payer(self.facture, '1000')
        evenements = Evenement.objects.filter(document=self.facture).order_by('date')
        self.assertEqual(evenements.count(), 2)
        self.assertTrue(evenements[0].termine)
        self.assertFalse(evenements[1].termine)

    def test_retirer_le_plan(self):
        total = self.facture.total
        self.plan([(jours(5), total)])
        reponse = self.plan([])
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.json()['echeances'], [])
        self.assertFalse(Evenement.objects.filter(document=self.facture).exists())


class ComptesARecevoirTests(BaseFacture):
    def test_age_des_comptes(self):
        # Facture 1 : plan avec 1 000 $ en retard de 45 jours, le reste à venir.
        total = self.facture.total
        definir_echeancier(self.facture, [
            {'date': jours(-45), 'montant': Decimal('1000'), 'note': ''},
            {'date': jours(30), 'montant': total - 1000, 'note': ''},
        ])
        # Facture 2 : sans plan, échue depuis 100 jours, 50 $ payés.
        autre = self.creer_facture(Decimal('100'), date_echeance=jours(-100))
        enregistrer_paiement(autre, Decimal('50'), AUJOURDHUI, 'cheque')
        # Brouillon et facture payée : exclus.
        self.creer_facture(Decimal('500'), statut='brouillon')
        payee = self.creer_facture(Decimal('10'))
        enregistrer_paiement(payee, payee.total, AUJOURDHUI, 'comptant')

        donnees = comptes_a_recevoir()
        tranches = {t['cle']: t['montant'] for t in donnees['tranches']}
        solde_autre = autre.total - 50
        self.assertEqual(tranches['31_60'], Decimal('1000'))
        self.assertEqual(tranches['plus_90'], solde_autre)
        self.assertEqual(tranches['courant'], total - 1000)
        self.assertEqual(donnees['total_du'], total + solde_autre)
        self.assertEqual(donnees['total_en_retard'], Decimal('1000') + solde_autre)
        self.assertEqual(len(donnees['factures']), 2)
        self.assertEqual(len(donnees['clients']), 1)

        self.assertEqual(self.api.get('/api/comptes-a-recevoir/').status_code, 200)
        self.assertTrue(generer_excel_comptes_a_recevoir(donnees).startswith(b'PK'))

    def test_statistiques_du_tableau_de_bord(self):
        enregistrer_paiement(self.facture, Decimal('1700'), AUJOURDHUI, 'virement')
        brouillon = self.creer_facture(Decimal('50'), statut='brouillon')
        soumission = Document.objects.create(
            numero='SOU-EXP', type_document='soumission', client=self.client_entreprise,
            statut='envoyee', date_echeance=jours(3),
        )
        definir_echeancier(self.facture, [
            {'date': jours(2), 'montant': Decimal('3000'), 'note': ''},
            {'date': jours(40), 'montant': self.facture.total - 3000, 'note': ''},
        ])
        stats = self.api.get('/api/dashboard/stats/').json()
        self.assertEqual(Decimal(str(stats['encaisse_mois'])), Decimal('1700'))
        self.assertEqual(Decimal(str(stats['comptes_a_recevoir'])), self.facture.total - 1700)
        self.assertEqual(stats['nb_factures_a_recevoir'], 1)
        # Facturé = la facture émise (payée ou non) ; le brouillon ne compte pas.
        self.assertEqual(Decimal(str(stats['facture_annee'])), self.facture.total)
        serie = stats['serie_12_mois']
        self.assertEqual(len(serie), 12)
        self.assertEqual(Decimal(str(serie[-1]['facture'])), self.facture.total)
        self.assertEqual(Decimal(str(serie[-1]['encaisse'])), Decimal('1700'))
        a_faire = stats['a_faire']
        # 3 000 $ prévus dans 2 jours, dont 1 700 $ déjà payés : reste 1 300 $.
        self.assertEqual(
            [(v['numero'], Decimal(str(v['montant']))) for v in a_faire['versements_semaine']],
            [(self.facture.numero, Decimal('1300'))],
        )
        self.assertEqual([s['numero'] for s in a_faire['soumissions_expirent']], [soumission.numero])
        self.assertEqual([f['numero'] for f in a_faire['factures_brouillon']], [brouillon.numero])

    def test_commande_de_rappels(self):
        en_retard = self.creer_facture(Decimal('100'), date_echeance=jours(-3))
        sortie = StringIO()
        call_command('envoyer_rappels', '--simulation', stdout=sortie)
        self.assertIn(en_retard.numero, sortie.getvalue())
        self.assertNotIn(self.facture.numero, sortie.getvalue())

        with mock.patch('msi.emails._client') as client_courriel:
            call_command('envoyer_rappels', stdout=StringIO())
            self.assertEqual(client_courriel.return_value.Emails.send.call_count, 1)
            # Déjà relancée : pas de 2e rappel avant le délai.
            call_command('envoyer_rappels', stdout=StringIO())
            self.assertEqual(client_courriel.return_value.Emails.send.call_count, 1)
        en_retard.refresh_from_db()
        self.assertIsNotNone(en_retard.date_derniere_relance)

    def test_rappel_refuse_sur_brouillon(self):
        brouillon = self.creer_facture(Decimal('100'), statut='brouillon')
        self.assertEqual(self.api.post(f'/api/documents/{brouillon.id}/rappel/').status_code, 400)


class DocumentsGeneresTests(BaseFacture):
    """Les gabarits PDF et les courriels se construisent sans erreur avec paiements et plan."""

    def setUp(self):
        super().setUp()
        total = self.facture.total
        definir_echeancier(self.facture, [
            {'date': jours(-10), 'montant': Decimal('1700'), 'note': 'Dépôt'},
            {'date': jours(20), 'montant': total - 1700, 'note': ''},
        ])
        self.paiement = enregistrer_paiement(self.facture, Decimal('1000'), AUJOURDHUI, 'cheque', reference='123')

    def test_pdf_facture(self):
        html = generer_pdf_document(self.recharger(self.facture)).decode('utf-8', errors='ignore')
        self.assertIn('Plan de paiement', html)
        self.assertIn('Solde d&ucirc;', html)
        self.assertIn('1000.00', html)

    def test_rapport_comptable(self):
        trimestre = (AUJOURDHUI.month - 1) // 3 + 1
        html = generer_rapport_comptable(AUJOURDHUI.year, trimestre).decode('utf-8', errors='ignore')
        self.assertIn('Paiements re&ccedil;us', html)
        self.assertIn(self.facture.numero, html)
        self.assertTrue(generer_excel_rapport_comptable(AUJOURDHUI.year, trimestre).startswith(b'PK'))

    def test_courriels(self):
        facture = self.recharger(self.facture)
        with mock.patch('msi.emails._client') as client_courriel:
            envoyer_recu_paiement(Paiement.objects.select_related('document').get(pk=self.paiement.pk))
            envoyer_rappel_paiement(facture)
            envoyer_document(facture)
        envois = [c.args[0] for c in client_courriel.return_value.Emails.send.call_args_list]
        self.assertEqual(len(envois), 3)
        self.assertIn('Montant re&ccedil;u', envois[0]['html'])
        self.assertIn('Rappel de paiement', envois[1]['subject'])
        self.assertIn('Montant en retard', envois[1]['html'])
        self.assertIn('Plan de paiement', envois[2]['html'])


class PlanSurSoumissionTests(BaseFacture):
    def setUp(self):
        super().setUp()
        self.soumission = Document.objects.create(
            numero='SOU-PLAN', type_document='soumission', client=self.client_entreprise,
            statut='envoyee', categorie='developpement', pourcentage_acompte=Decimal('35'),
        )
        LigneDocument.objects.create(
            document=self.soumission, description='Logiciel', quantite=1, prix_unitaire=Decimal('8697.54'),
        )
        # Le PDF du contrat n'est pas écrit sur disque pendant les tests.
        stockage = Contrat._meta.get_field('pdf').storage
        patcher = mock.patch.object(stockage, '_save', side_effect=lambda nom, contenu: nom)
        patcher.start()
        self.addCleanup(patcher.stop)

    def plan(self, versements):
        return self.api.put(
            f'/api/documents/{self.soumission.id}/echeancier/',
            {'versements': [{'date': str(d), 'montant': str(m), 'note': n} for d, m, n in versements]},
            format='json',
        )

    def accepter(self):
        return self.api.post(
            f'/api/soumission-publique/{self.soumission.token}/repondre/',
            {'reponse': 'acceptee', 'accepte_conditions': True}, format='json',
        )

    def test_plan_remplace_acompte_et_visible_par_le_client(self):
        reponse = self.plan([(jours(0), '1700', 'Dépôt'), (jours(30), '8300', '')])
        self.assertEqual(reponse.status_code, 200, reponse.content)
        self.assertIsNone(reponse.json()['pourcentage_acompte'])
        self.assertFalse(Evenement.objects.filter(document=self.soumission).exists())

        publique = self.api.get(f'/api/soumission-publique/{self.soumission.token}/').json()
        self.assertEqual([e['montant'] for e in publique['echeances']], ['1700.00', '8300.00'])
        paiement = next(c for c in publique['conditions'] if c['titre'] == 'Paiement')
        self.assertIn('2 versements', paiement['texte'])

        refus = self.api.patch(
            f'/api/documents/{self.soumission.id}/', {'pourcentage_acompte': '35'}, format='json',
        )
        self.assertEqual(refus.status_code, 400)

    def test_acceptation_cree_la_facture_avec_le_plan_decale(self):
        # Plan qui commençait il y a 10 jours : tout est repoussé de 10 jours à la signature.
        self.plan([(jours(-10), '1700', 'Dépôt'), (jours(20), '8300', '')])
        reponse = self.accepter()
        self.assertEqual(reponse.status_code, 200, reponse.content)

        contrat = Contrat.objects.get(soumission=self.soumission)
        self.assertEqual(
            contrat.echeancier_json,
            [
                {'date': str(jours(0)), 'montant': '1700.00', 'note': 'Dépôt'},
                {'date': str(jours(30)), 'montant': '8300.00', 'note': ''},
            ],
        )
        facture = contrat.factures_liees.get()
        self.assertEqual(facture.type_paiement, 'complet')
        self.assertEqual(facture.statut, 'envoyee')
        self.assertEqual(facture.total, Decimal('10000.00'))
        self.assertEqual([(e.date, e.montant) for e in facture.echeances.all()],
                         [(jours(0), Decimal('1700.00')), (jours(30), Decimal('8300.00'))])
        self.assertEqual(facture.date_echeance, jours(30))
        # Pas de facture d'acompte en plus.
        self.assertEqual(contrat.factures_liees.count(), 1)

        # Le plan de la soumission est désormais figé.
        self.assertEqual(self.plan([(jours(5), '10000', '')]).status_code, 400)

    def test_plan_invalide_bloque_envoi(self):
        self.plan([(jours(5), '10000', '')])
        LigneDocument.objects.filter(document=self.soumission).update(prix_unitaire=Decimal('100'))
        with mock.patch('msi.views.envoyer_document') as envoi:
            reponse = self.api.post(f'/api/documents/{self.soumission.id}/envoyer/')
        self.assertEqual(reponse.status_code, 400)
        envoi.assert_not_called()
        doc = self.api.get(f'/api/documents/{self.soumission.id}/').json()
        self.assertFalse(doc['plan_valide'])

    def test_pdf_et_courriel_de_la_soumission(self):
        self.plan([(jours(5), '1700', 'Dépôt'), (jours(35), '8300', '')])
        doc = self.recharger(self.soumission)
        html = generer_pdf_document(doc).decode('utf-8', errors='ignore')
        self.assertIn('Plan de paiement propos&eacute;', html)
        envoyer_document(doc)
        envoi = self.courriels.return_value.Emails.send.call_args.args[0]
        self.assertIn('Plan de paiement propos&eacute;', envoi['html'])


class PreuvePaiementTests(BaseFacture):
    def setUp(self):
        super().setUp()
        self.dossier = tempfile.mkdtemp()
        stockage = Paiement._meta.get_field('preuve').storage
        patcher = mock.patch.object(stockage, 'location', self.dossier)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(shutil.rmtree, self.dossier, ignore_errors=True)
        stockage.__dict__.pop('base_location', None)
        self.addCleanup(stockage.__dict__.pop, 'base_location', None)

    def photo(self, nom='cheque.jpg', taille=100):
        return SimpleUploadedFile(nom, b'x' * taille, content_type='image/jpeg')

    def test_paiement_avec_photo_puis_telechargement(self):
        reponse = self.api.post(
            f'/api/documents/{self.facture.id}/paiements/',
            {'montant': '1700', 'date': str(AUJOURDHUI), 'mode': 'cheque', 'reference': '118',
             'envoyer_recu': 'false', 'preuve': self.photo()},
            format='multipart',
        )
        self.assertEqual(reponse.status_code, 201, reponse.content)
        paiement_json = reponse.json()['document']['paiements'][0]
        self.assertTrue(paiement_json['a_preuve'])
        paiement = Paiement.objects.get()
        self.assertTrue(paiement.preuve.name.startswith(f'paiements/{self.facture.numero}-paiement-'))

        fichier = self.api.get(f'/api/documents/{self.facture.id}/paiements/{paiement.id}/preuve/')
        self.assertEqual(fichier.status_code, 200)
        self.assertEqual(fichier['Content-Type'], 'image/jpeg')
        self.assertEqual(fichier.content, b'x' * 100)

        # Non connecté : refusé.
        self.assertIn(APIClient().get(f'/api/documents/{self.facture.id}/paiements/{paiement.id}/preuve/').status_code, (401, 403))

        # Supprimer le paiement supprime aussi le fichier.
        chemin = paiement.preuve.path
        self.api.delete(f'/api/documents/{self.facture.id}/paiements/{paiement.id}/')
        self.assertFalse(os.path.exists(chemin))

    def test_ajouter_remplacer_retirer_la_preuve_apres_coup(self):
        self.payer(self.facture, '100')
        paiement = Paiement.objects.get()
        url = f'/api/documents/{self.facture.id}/paiements/{paiement.id}/preuve/'
        self.assertEqual(self.api.get(url).status_code, 404)

        self.assertEqual(self.api.post(url, {'preuve': self.photo('virement.png')}, format='multipart').status_code, 200)
        premier = Paiement.objects.get().preuve.path
        self.assertEqual(self.api.post(url, {'preuve': self.photo('avis.pdf')}, format='multipart').status_code, 200)
        paiement.refresh_from_db()
        self.assertTrue(paiement.preuve.name.endswith('.pdf'))
        self.assertFalse(os.path.exists(premier))

        reponse = self.api.delete(url)
        self.assertEqual(reponse.status_code, 200)
        self.assertFalse(reponse.json()['paiements'][0]['a_preuve'])

    def test_fichier_refuse(self):
        self.payer(self.facture, '100')
        paiement = Paiement.objects.get()
        url = f'/api/documents/{self.facture.id}/paiements/{paiement.id}/preuve/'
        self.assertEqual(self.api.post(url, {'preuve': self.photo('virus.exe')}, format='multipart').status_code, 400)
        trop_gros = self.photo('gros.jpg', 10 * 1024 * 1024 + 1)
        self.assertEqual(self.api.post(url, {'preuve': trop_gros}, format='multipart').status_code, 400)


class RappelsAutomatiquesTests(BaseFacture):
    """Scénarios de msi/rappels.py — chaque rappel part une seule fois, au bon moment."""

    def setUp(self):
        super().setUp()
        # La facture de base (sans échéance) ne doit gêner aucun scénario.
        self.facture.delete()

    def envois(self):
        return [c.args[0] for c in self.courriels.return_value.Emails.send.call_args_list]

    def sujets(self):
        return [e['subject'] for e in self.envois()]

    def soumission(self, envoyee_il_y_a, expire_dans=None, **extra):
        s = Document.objects.create(
            numero=Document.generer_numero('soumission'), type_document='soumission',
            client=self.client_entreprise, statut='envoyee',
            date_envoi=timezone.now() - timedelta(days=envoyee_il_y_a),
            date_echeance=jours(expire_dans) if expire_dans is not None else None, **extra,
        )
        LigneDocument.objects.create(document=s, description='Site', quantite=1, prix_unitaire=Decimal('1000'))
        return s

    def facture_envoyee(self, prix='1000', envoyee_il_y_a=10, **extra):
        f = self.creer_facture(Decimal(prix), **extra)
        f.date_envoi = timezone.now() - timedelta(days=envoyee_il_y_a)
        f.save(update_fields=['date_envoi'])
        return f

    def test_relance_soumission_sans_reponse_une_seule_fois(self):
        recente = self.soumission(envoyee_il_y_a=3)
        ancienne = self.soumission(envoyee_il_y_a=8)
        resultat = executer_rappels()
        self.assertEqual([a['numero'] for a in resultat['actions']], [ancienne.numero])
        self.assertEqual(self.sujets(), [f'Votre soumission {ancienne.numero}'])
        executer_rappels()
        self.assertEqual(len(self.envois()), 1)
        ancienne.refresh_from_db()
        self.assertIsNotNone(ancienne.date_relance_soumission)
        recente.refresh_from_db()
        self.assertIsNone(recente.date_relance_soumission)

    def test_expiration_prioritaire_puis_plus_de_relance(self):
        s = self.soumission(envoyee_il_y_a=10, expire_dans=2)
        executer_rappels()
        self.assertEqual(self.sujets(), [f'Votre soumission {s.numero} expire bientôt'])
        executer_rappels()  # ni 2e avis, ni relance « sans réponse » en plus
        self.assertEqual(len(self.envois()), 1)

    def test_alerte_interne_a_l_expiration(self):
        s = self.soumission(envoyee_il_y_a=40, expire_dans=-1)
        with self.settings(CONTACT_NOTIFICATION_EMAIL='moi@exemple.test'):
            executer_rappels()
            executer_rappels()
        envois = self.envois()
        self.assertEqual(len(envois), 1)
        self.assertEqual(envois[0]['to'], ['moi@exemple.test'])
        self.assertIn(s.numero, envois[0]['subject'])

    def test_rien_pour_brouillon_repondue_ou_envoyee_aujourdhui(self):
        self.soumission(envoyee_il_y_a=0, expire_dans=1)
        brouillon = self.soumission(envoyee_il_y_a=30)
        Document.objects.filter(pk=brouillon.pk).update(statut='brouillon')
        acceptee = self.soumission(envoyee_il_y_a=30)
        Document.objects.filter(pk=acceptee.pk).update(statut='acceptee')
        self.assertEqual(executer_rappels()['actions'], [])

    def test_renvoyer_la_soumission_repart_un_cycle(self):
        s = self.soumission(envoyee_il_y_a=30, date_relance_soumission=timezone.now())
        with mock.patch('msi.views.envoyer_document'):
            self.api.post(f'/api/documents/{s.id}/envoyer/')
        s.refresh_from_db()
        self.assertIsNone(s.date_relance_soumission)
        self.assertEqual(timezone.localtime(s.date_envoi).date(), AUJOURDHUI)

    def test_versement_a_venir_trois_jours_avant(self):
        f = self.facture_envoyee('1000')
        definir_echeancier(f, [
            {'date': jours(3), 'montant': Decimal('500'), 'note': ''},
            {'date': jours(33), 'montant': f.total - 500, 'note': ''},
        ])
        executer_rappels(aujourd_hui=jours(-1))  # 4 jours avant : trop tôt
        self.assertEqual(self.envois(), [])
        executer_rappels()
        self.assertEqual(self.sujets(), [f'Rappel : versement prévu le {jours(3):%d/%m/%Y} — {f.numero}'])
        executer_rappels()
        self.assertEqual(len(self.envois()), 1)
        f = self.recharger(f)
        self.assertIsNotNone(f.echeances.all()[0].date_rappel_avant)
        self.assertIsNone(f.echeances.all()[1].date_rappel_avant)

    def test_versement_deja_paye_ou_partiel(self):
        f = self.facture_envoyee('1000')
        definir_echeancier(f, [
            {'date': jours(2), 'montant': Decimal('500'), 'note': ''},
            {'date': jours(40), 'montant': f.total - 500, 'note': ''},
        ])
        enregistrer_paiement(f, Decimal('500'), AUJOURDHUI, 'virement')
        self.assertEqual(executer_rappels()['actions'], [])  # payé en avance : rien

        f2 = self.facture_envoyee('1000')
        definir_echeancier(f2, [
            {'date': jours(2), 'montant': Decimal('500'), 'note': ''},
            {'date': jours(40), 'montant': f2.total - 500, 'note': ''},
        ])
        enregistrer_paiement(f2, Decimal('200'), AUJOURDHUI, 'virement')
        executer_rappels()
        self.assertIn('300.00', self.envois()[0]['html'])  # seulement le reste du versement

    def test_facture_sans_plan_et_facture_envoyee_aujourdhui(self):
        sans_plan = self.facture_envoyee('100', date_echeance=jours(3))
        self.facture_envoyee('100', envoyee_il_y_a=0, date_echeance=jours(2))
        resultat = executer_rappels()
        self.assertEqual([a['numero'] for a in resultat['actions']], [sans_plan.numero])

    def test_retard_prioritaire_et_intervalle(self):
        f = self.facture_envoyee('1000')
        definir_echeancier(f, [
            {'date': jours(-5), 'montant': Decimal('500'), 'note': ''},
            {'date': jours(2), 'montant': f.total - 500, 'note': ''},
        ])
        executer_rappels()
        self.assertEqual(self.sujets(), [f'Rappel de paiement — {f.numero}'])
        # Le versement qui arrive dans 2 jours est couvert par ce rappel : pas de 2e courriel.
        executer_rappels()
        self.assertEqual(len(self.envois()), 1)
        # 8 jours plus tard : nouveau rappel de retard.
        with mock.patch('msi.rappels.timezone.now', return_value=timezone.now() + timedelta(days=8)):
            executer_rappels(aujourd_hui=jours(8))
        self.assertEqual(len(self.envois()), 2)

    def test_echec_non_date_et_reessaye(self):
        s = self.soumission(envoyee_il_y_a=8)
        self.courriels.return_value.Emails.send.side_effect = RuntimeError('Resend en panne')
        resultat = executer_rappels()
        self.assertEqual(resultat['echecs'], 1)
        s.refresh_from_db()
        self.assertIsNone(s.date_relance_soumission)
        self.courriels.return_value.Emails.send.side_effect = None
        self.assertEqual(executer_rappels()['envoyes'], 1)

    def test_reglages_desactivation_et_simulation(self):
        s = self.soumission(envoyee_il_y_a=8)
        resultat = self.api.post('/api/rappels/executer/', {'simulation': True}, format='json').json()
        self.assertEqual([a['statut'] for a in resultat['actions']], ['simulation'])
        self.assertEqual(self.envois(), [])

        reponse = self.api.put('/api/parametres-rappels/', {'relance_soumission_jours': 0}, format='json')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(executer_rappels()['actions'], [])

        reglages = Coordonnees.load()
        reglages.relance_soumission_jours = 7
        reglages.rappels_actifs = False
        reglages.save()
        self.assertFalse(executer_rappels()['actifs'])
        self.assertEqual(self.envois(), [])
        s.refresh_from_db()
        self.assertIsNone(s.date_relance_soumission)

        # Les réglages ne sont pas publics (contrairement aux coordonnées).
        self.assertIn(APIClient().get('/api/parametres-rappels/').status_code, (401, 403))
        self.assertNotIn('rappels_actifs', APIClient().get('/api/coordonnees/').json())

    def test_modifier_le_plan_garde_les_rappels_envoyes(self):
        f = self.facture_envoyee('1000')
        definir_echeancier(f, [
            {'date': jours(3), 'montant': Decimal('500'), 'note': ''},
            {'date': jours(33), 'montant': f.total - 500, 'note': ''},
        ])
        executer_rappels()
        definir_echeancier(f, [
            {'date': jours(3), 'montant': Decimal('500'), 'note': 'modifié'},
            {'date': jours(63), 'montant': f.total - 500, 'note': ''},
        ])
        executer_rappels()
        self.assertEqual(len(self.envois()), 1)


class RapportComptableExerciceTests(BaseFacture):
    """Option A : une vente compte au trimestre où la facture est émise, payée ou non."""

    def setUp(self):
        super().setUp()
        self.trimestre = (AUJOURDHUI.month - 1) // 3 + 1
        self.debut_trimestre = AUJOURDHUI.replace(month=(self.trimestre - 1) * 3 + 1, day=1)

    def donnees(self):
        from .pdf import _donnees_rapport_comptable

        return _donnees_rapport_comptable(AUJOURDHUI.year, self.trimestre)

    def test_facture_partiellement_payee_compte_entierement_avec_ses_taxes(self):
        enregistrer_paiement(self.facture, Decimal('1700'), AUJOURDHUI, 'virement')
        d = self.donnees()
        self.assertEqual([v.numero for v in d['ventes']], [self.facture.numero])
        self.assertEqual(d['total_ventes'], self.facture.total)
        self.assertEqual(d['tps_percue'], self.facture.montant_tps)
        vente = d['ventes'][0]
        self.assertEqual(vente.paye_fin_periode, Decimal('1700'))
        self.assertEqual(vente.solde_fin_periode, self.facture.total - 1700)

    def test_brouillon_exclu(self):
        self.creer_facture(Decimal('500'), statut='brouillon')
        self.assertEqual([v.numero for v in self.donnees()['ventes']], [self.facture.numero])

    def test_facture_du_trimestre_precedent_payee_maintenant(self):
        ancienne = self.creer_facture(Decimal('300'))
        Document.objects.filter(pk=ancienne.pk).update(
            date_creation=timezone.make_aware(
                timezone.datetime.combine(self.debut_trimestre - timedelta(days=5), timezone.datetime.min.time()),
            ),
        )
        enregistrer_paiement(ancienne, ancienne.total, AUJOURDHUI, 'cheque')
        d = self.donnees()
        # Pas dans les ventes de ce trimestre (émise avant)…
        self.assertNotIn(ancienne.numero, [v.numero for v in d['ventes']])
        # …mais bien dans les paiements reçus.
        self.assertIn(ancienne.numero, [p.document.numero for p in d['encaissements']])

    def test_soumission_payee_sans_facture_compte_mais_pas_en_double(self):
        directe = Document.objects.create(
            numero='SOU-DIRECTE', type_document='soumission', client=self.client_entreprise, statut='payee',
        )
        LigneDocument.objects.create(document=directe, description='x', quantite=1, prix_unitaire=Decimal('100'))

        avec_facture = Document.objects.create(
            numero='SOU-FACTUREE', type_document='soumission', client=self.client_entreprise, statut='payee',
        )
        contrat = Contrat.objects.create(
            soumission=avec_facture, numero='CON-X', categorie='developpement', client_nom='ACME',
            client_courriel='acme@example.com', sous_total=0, montant_tps=0, montant_tvq=0, total=0,
            nom_signataire='X', courriel_signataire='acme@example.com', ip_signature='127.0.0.1', pdf='x.pdf',
        )
        Document.objects.filter(pk=self.facture.pk).update(contrat_lie=contrat)

        numeros = [v.numero for v in self.donnees()['ventes']]
        self.assertIn('SOU-DIRECTE', numeros)
        self.assertNotIn('SOU-FACTUREE', numeros)
        self.assertEqual(numeros.count(self.facture.numero), 1)
