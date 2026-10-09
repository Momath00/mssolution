"""Cas limites de l'intégration ExtincPro : liaison refusée, déliaison, fiche client,
configuration absente, et code de module transmis de la soumission jusqu'à la facture."""

from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.test import override_settings

from . import extincpro
from .models import ActionExtincPro, ArticleCatalogue, Client, Contrat, Document, LigneDocument
from .tests_extincpro import AUJOURDHUI, BaseExtincPro


class LiaisonRefusee(BaseExtincPro):
    def test_organisation_inexistante(self):
        res = self.api.post('/api/extincpro/a-lier/99/lier/', {'creer': True}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(Client.objects.exists())

    def test_organisation_deja_liee_ailleurs(self):
        self.faux.ajouter(1, 'Sécurité ABC')
        self.faux.orgs[1]['ms_client_id'] = 777
        res = self.api.post('/api/extincpro/a-lier/1/lier/', {'creer': True}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_client_deja_lie_a_une_autre_organisation(self):
        client = self.client_lie(1)
        self.faux.ajouter(2, 'Autre org')
        res = self.api.post('/api/extincpro/a-lier/2/lier/', {'client_id': client.id}, format='json')
        self.assertEqual(res.status_code, 400)
        client.refresh_from_db()
        self.assertEqual(client.extincpro_organisation_id, 1)

    def test_ni_client_ni_creation(self):
        self.faux.ajouter(1, 'Sécurité ABC')
        self.assertEqual(self.api.post('/api/extincpro/a-lier/1/lier/', {}, format='json').status_code, 400)

    def test_les_clients_deja_lies_ne_sont_pas_suggeres(self):
        self.client_lie(1, nom='Sécurité ABC')
        self.faux.ajouter(2, 'Sécurité ABC')
        org = self.api.get('/api/extincpro/a-lier/').data[0]
        self.assertEqual(org['suggestions'], [])

    def test_le_lien_ne_se_modifie_pas_par_le_formulaire_client(self):
        client = Client.objects.create(nom_entreprise='ACME', courriel='a@acme.test')
        self.api.patch(f'/api/clients/{client.id}/', {'extincpro_organisation_id': 5}, format='json')
        client.refresh_from_db()
        self.assertIsNone(client.extincpro_organisation_id)
        self.assertEqual(self.faux.appels, [])

    def test_la_cle_est_envoyee_a_extincpro(self):
        with mock.patch('msi.extincpro.requests.request', wraps=self.faux) as appel:
            extincpro.organisations()
        self.assertEqual(appel.call_args.kwargs['headers'], {'Authorization': 'Bearer cle-test'})


class Deliaison(BaseExtincPro):
    def test_delier_remet_l_organisation_a_lier(self):
        client = self.client_lie(1)
        res = self.api.post(f'/api/clients/{client.id}/extincpro/delier/', {}, format='json')
        self.assertEqual(res.status_code, 200)
        client.refresh_from_db()
        self.assertIsNone(client.extincpro_organisation_id)
        self.assertIsNone(self.faux.orgs[1]['ms_client_id'])
        self.assertEqual([o['id'] for o in self.api.get('/api/extincpro/a-lier/').data], [1])

    def test_delier_une_organisation_supprimee_n_appelle_pas_extincpro(self):
        client = self.client_lie(1)
        del self.faux.orgs[1]
        extincpro.marquer_resilie(client)
        nb_appels = len(self.faux.appels)
        extincpro.delier(client, self.user)
        self.assertEqual(len(self.faux.appels), nb_appels)
        client.refresh_from_db()
        self.assertIsNone(client.extincpro_resilie_le)

    def test_un_client_delie_peut_etre_supprime(self):
        client = self.client_lie(1)
        extincpro.delier(client, self.user)
        self.assertEqual(self.api.delete(f'/api/clients/{client.id}/').status_code, 204)

    def test_un_client_resilie_peut_etre_supprime(self):
        client = self.client_lie(1)
        extincpro.marquer_resilie(client)
        self.assertEqual(self.api.delete(f'/api/clients/{client.id}/').status_code, 204)


class FicheClient(BaseExtincPro):
    def test_client_non_lie(self):
        client = Client.objects.create(nom_entreprise='ACME', courriel='a@acme.test')
        self.assertEqual(self.api.get(f'/api/clients/{client.id}/extincpro/').data, {'lie': False})

    def test_etat_en_direct_retard_et_journal(self):
        client = self.client_lie(1)
        facture = self.facture_abonnement(client)
        Document.objects.filter(pk=facture.pk).update(date_echeance=AUJOURDHUI - timedelta(days=3))
        data = self.api.get(f'/api/clients/{client.id}/extincpro/').data
        self.assertEqual(data['organisation']['nom'], 'Sécurité ABC')
        self.assertEqual(data['retard']['jours'], 3)
        self.assertEqual(data['retard']['facture'], facture.numero)
        self.assertEqual(data['jours_grace'], 15)
        self.assertEqual([a['action'] for a in data['journal']], ['lier'])

    def test_extincpro_injoignable_garde_retard_et_journal(self):
        client = self.client_lie(1)
        self.faux.en_panne = True
        data = self.api.get(f'/api/clients/{client.id}/extincpro/').data
        self.assertIsNone(data['organisation'])
        self.assertIn('injoignable', data['erreur'])
        self.assertEqual(data['retard']['jours'], 0)
        self.assertEqual(len(data['journal']), 1)

    def test_organisation_disparue_marque_le_client_resilie(self):
        client = self.client_lie(1)
        del self.faux.orgs[1]
        data = self.api.get(f'/api/clients/{client.id}/extincpro/').data
        self.assertIsNotNone(data['resilie_le'])
        client.refresh_from_db()
        self.assertIsNotNone(client.extincpro_resilie_le)

    def test_ordres_mal_formes_ou_inconnus(self):
        client = self.client_lie(1)
        base = f'/api/clients/{client.id}/extincpro'
        self.assertEqual(self.api.post(f'{base}/acces/', {}, format='json').status_code, 400)
        self.assertEqual(self.api.post(f'{base}/modules/', {'modules': {}}, format='json').status_code, 400)
        self.assertEqual(self.api.post(f'{base}/inconnu/', {}, format='json').status_code, 404)

    def test_fixer_les_modules_et_l_essai_depuis_la_fiche(self):
        client = self.client_lie(1)
        base = f'/api/clients/{client.id}/extincpro'
        res = self.api.post(f'{base}/modules/', {'modules': {'gicleur': True}}, format='json')
        self.assertTrue(res.data['organisation']['modules'][0]['actif'])
        self.api.post(f'{base}/essai/', {'date_fin_essai': '2027-01-31'}, format='json')
        self.assertEqual(self.faux.orgs[1]['date_fin_essai'], '2027-01-31')
        self.api.post(f'{base}/essai/', {'date_fin_essai': None}, format='json')
        self.assertIsNone(self.faux.orgs[1]['date_fin_essai'])

    def test_ordre_sur_un_client_non_lie(self):
        client = Client.objects.create(nom_entreprise='ACME', courriel='a@acme.test')
        res = self.api.post(f'/api/clients/{client.id}/extincpro/acces/', {'est_active': False}, format='json')
        self.assertEqual(res.status_code, 502)
        self.assertEqual(self.faux.appels, [])

    def test_l_historique_est_reserve_a_l_administration(self):
        from rest_framework.test import APIClient

        client = self.client_lie(1)
        self.assertEqual(APIClient().get(f'/api/clients/{client.id}/extincpro/').status_code, 401)
        self.assertEqual(APIClient().get('/api/extincpro/a-lier/').status_code, 401)


class Retards(BaseExtincPro):
    def test_les_brouillons_et_autres_categories_ne_comptent_pas(self):
        client = self.client_lie(1)
        brouillon = self.facture_abonnement(client)
        autre = self.facture_abonnement(client)
        Document.objects.filter(pk=brouillon.pk).update(statut='brouillon', date_echeance=AUJOURDHUI - timedelta(days=40))
        Document.objects.filter(pk=autre.pk).update(categorie='maintenance', date_echeance=AUJOURDHUI - timedelta(days=40))
        self.assertEqual(extincpro.retard(client)['jours'], 0)
        self.assertEqual(extincpro.alertes(), [])

    def test_une_mensualite_en_retard_compte(self):
        client = self.client_lie(1)
        total = Decimal('1149.75')
        facture = self.facture_abonnement(client, echeances=[
            {'date': AUJOURDHUI - timedelta(days=16), 'montant': Decimal('100.00'), 'note': ''},
            {'date': AUJOURDHUI + timedelta(days=14), 'montant': total - Decimal('100.00'), 'note': ''},
        ])
        r = extincpro.retard(client)
        self.assertEqual((r['jours'], r['montant'], r['facture']), (16, '100.00', facture.numero))
        self.assertEqual([a['type'] for a in extincpro.alertes()], ['a_bloquer'])

    @override_settings(EXTINCPRO_JOURS_GRACE=30)
    def test_le_delai_de_grace_est_reglable(self):
        client = self.client_lie(1)
        facture = self.facture_abonnement(client)
        Document.objects.filter(pk=facture.pk).update(date_echeance=AUJOURDHUI - timedelta(days=20))
        self.assertEqual(extincpro.alertes(), [])

    def test_un_client_bloque_et_toujours_en_retard_n_est_pas_a_debloquer(self):
        client = self.client_lie(1)
        facture = self.facture_abonnement(client)
        Document.objects.filter(pk=facture.pk).update(date_echeance=AUJOURDHUI - timedelta(days=20))
        self.faux.orgs[1]['est_active'] = False
        self.assertEqual(extincpro.alertes(), [])

    def test_aucun_appel_sans_client_lie(self):
        Client.objects.create(nom_entreprise='ACME', courriel='a@acme.test')
        self.assertEqual(extincpro.alertes(), [])
        self.assertEqual(self.faux.appels, [])


@override_settings(EXTINCPRO_API_URL='', EXTINCPRO_API_KEY='')
class SansConfiguration(BaseExtincPro):
    def test_etat_indique_non_configure(self):
        data = self.api.get('/api/extincpro/etat/').data
        self.assertFalse(data['configure'])
        self.assertEqual((data['a_lier'], data['alertes'], data['nb_bloques']), (0, 0, 0))

    def test_les_ecrans_repondent_sans_planter(self):
        self.assertEqual(self.api.get('/api/extincpro/a-lier/').status_code, 502)
        self.assertEqual(self.api.get('/api/extincpro/modules/').status_code, 502)
        self.assertEqual(self.faux.appels, [])


class ModuleDeLaSoumissionALaFacture(BaseExtincPro):
    def setUp(self):
        super().setUp()
        stockage = Contrat._meta.get_field('pdf').storage
        patcher = mock.patch.object(stockage, '_save', side_effect=lambda nom, contenu: nom)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_le_catalogue_et_les_lignes_portent_le_module(self):
        res = self.api.post('/api/catalogue/', {
            'nom': 'Module gicleurs', 'prix': '1800', 'frequence': 'annuel', 'module_extincpro': 'gicleur',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(ArticleCatalogue.objects.get(nom='Module gicleurs').module_extincpro, 'gicleur')

        client = Client.objects.create(nom_entreprise='ACME', courriel='a@acme.test')
        res = self.api.post('/api/documents/', {
            'type_document': 'facture', 'categorie': 'abonnement_saas', 'client': client.id,
            'lignes': [{'description': 'Module gicleurs', 'quantite': '1', 'prix_unitaire': '1800',
                        'module_extincpro': 'gicleur'}],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(LigneDocument.objects.get().module_extincpro, 'gicleur')

    def test_signature_avec_plan_puis_premier_paiement_active_le_module(self):
        client = self.client_lie(1)
        soumission = Document.objects.create(
            numero='SOU-ABO', type_document='soumission', categorie='abonnement_saas', client=client, statut='envoyee',
        )
        LigneDocument.objects.create(
            document=soumission, description='Module gicleurs', quantite=1, prix_unitaire=Decimal('1000'),
            module_extincpro='gicleur',
        )
        total = soumission.total
        self.api.put(f'/api/documents/{soumission.id}/echeancier/', {'versements': [
            {'date': str(AUJOURDHUI), 'montant': '100.00', 'note': ''},
            {'date': str(AUJOURDHUI + timedelta(days=30)), 'montant': str(total - Decimal('100.00')), 'note': ''},
        ]}, format='json')
        with mock.patch('msi.contrats.envoyer_document'), mock.patch('msi.views.envoyer_contrat_signe'):
            res = self.api.post(
                f'/api/soumission-publique/{soumission.token}/repondre/',
                {'reponse': 'acceptee', 'accepte_conditions': True}, format='json',
            )
        self.assertEqual(res.status_code, 200, res.content)

        contrat = Contrat.objects.get(soumission=soumission)
        self.assertEqual(contrat.lignes_json[0]['module_extincpro'], 'gicleur')
        facture = Document.objects.get(contrat_lie=contrat, type_document='facture')
        self.assertEqual(facture.lignes.get().module_extincpro, 'gicleur')

        res = self.api.post(f'/api/documents/{facture.id}/paiements/', {
            'montant': '100.00', 'date': AUJOURDHUI.isoformat(), 'mode': 'virement', 'envoyer_recu': False,
        }, format='json')
        self.assertEqual(res.data['extincpro'], {'ok': True, 'modules': ['gicleur']})
        self.assertTrue(self.faux.orgs[1]['modules'][0]['actif'])

    def test_les_modules_du_contrat_servent_si_la_facture_n_en_a_pas(self):
        client = self.client_lie(1)
        soumission = Document.objects.create(
            numero='SOU-ANC', type_document='soumission', categorie='abonnement_saas', client=client,
        )
        # Contrat signé avant l'intégration : la facture n'a pas de code, le contrat en a.
        contrat = Contrat.objects.create(
            soumission=soumission, numero='CON-ANC', categorie='abonnement_saas',
            client_nom=client.nom_entreprise, client_courriel=client.courriel,
            lignes_json=[{'description': 'Gicleurs', 'module_extincpro': 'gicleur'}, {'description': 'Frais'}],
            sous_total=Decimal('1000'), montant_tps=Decimal('50'), montant_tvq=Decimal('99.75'),
            total=Decimal('1149.75'), nom_signataire='X', courriel_signataire='x@x.test',
            ip_signature='127.0.0.1', pdf='contrats/CON-ANC.pdf',
        )
        facture = self.facture_abonnement(client, module='')
        facture.contrat_lie = contrat
        facture.save(update_fields=['contrat_lie'])
        self.assertEqual(extincpro.modules_factures(facture), ['gicleur'])

    def test_un_client_resilie_n_est_pas_synchronise(self):
        client = self.client_lie(1)
        extincpro.marquer_resilie(client)
        facture = self.facture_abonnement(client)
        nb_appels = len(self.faux.appels)
        self.assertIsNone(extincpro.apres_paiement(facture, self.user))
        self.assertEqual(len(self.faux.appels), nb_appels)
        self.assertFalse(ActionExtincPro.objects.filter(action='modules').exists())


class VueDEnsemble(BaseExtincPro):
    def payer(self, facture, montant):
        self.api.post(f'/api/documents/{facture.id}/paiements/', {
            'montant': str(montant), 'date': AUJOURDHUI.isoformat(), 'mode': 'virement', 'envoyer_recu': False,
        }, format='json')

    def test_les_revenus_extincpro_sont_separes(self):
        client = self.client_lie(1)
        abonnement = self.facture_abonnement(client)
        dev = self.facture_abonnement(client)
        Document.objects.filter(pk=dev.pk).update(categorie='developpement')
        self.payer(abonnement, 300)
        self.payer(dev, 100)

        stats = self.api.get('/api/dashboard/stats/').data
        self.assertEqual(stats['encaisse_mois'], Decimal('400'))
        self.assertEqual(stats['extincpro']['encaisse_mois'], Decimal('300'))
        self.assertEqual(stats['serie_12_mois'][-1]['encaisse_extincpro'], Decimal('300'))
        self.assertEqual(stats['extincpro']['facture_annee'], abonnement.total)
        self.assertEqual(stats['extincpro']['part_annee'], 50)
        self.assertEqual(stats['extincpro']['abonnes'], 1)

    def test_les_versements_d_abonnement_sont_reperes(self):
        client = self.client_lie(1)
        abonnement = self.facture_abonnement(client)
        Document.objects.filter(pk=abonnement.pk).update(date_echeance=AUJOURDHUI + timedelta(days=3))
        versements = self.api.get('/api/dashboard/stats/').data['a_faire']['versements_semaine']
        self.assertEqual([v['extincpro'] for v in versements], [True])

    def test_etat_en_direct_pour_la_vue_d_ensemble(self):
        self.client_lie(1, nom='Active')
        bloquee = self.client_lie(2, nom='Bloquée')
        self.faux.orgs[2]['est_active'] = False
        self.faux.ajouter(3, 'Nouvelle')
        data = self.api.get('/api/extincpro/etat/').data
        self.assertEqual((data['nb_actifs'], data['nb_bloques']), (1, 1))
        self.assertEqual((data['a_lier'], data['a_lier_noms']), (1, ['Nouvelle']))
        self.assertEqual([(a['type'], a['client_id']) for a in data['alertes_detail']], [('a_debloquer', bloquee.id)])

    def test_la_vue_d_ensemble_marche_sans_extincpro(self):
        self.faux.en_panne = True
        self.assertEqual(self.api.get('/api/dashboard/stats/').status_code, 200)
        data = self.api.get('/api/extincpro/etat/').data
        self.assertIn('injoignable', data['erreur'])
