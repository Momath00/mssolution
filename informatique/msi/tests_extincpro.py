"""Intégration ExtincPro : liaison, ordres, alertes de retard et synchro au paiement.
ExtincPro est simulé — aucun appel réseau ne part pendant les tests."""

from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from . import extincpro
from .models import ActionExtincPro, Client, Document, LigneDocument
from .paiements import definir_echeancier

AUJOURDHUI = timezone.localdate()


class FauxExtincPro:
    """Remplace requests.request : garde des organisations en mémoire et applique les
    ordres comme le ferait l'API d'ExtincPro."""

    def __init__(self):
        self.orgs = {}
        self.appels = []
        self.en_panne = False

    def ajouter(self, org_id, nom, courriel='', est_active=True):
        self.orgs[org_id] = {
            'id': org_id, 'nom': nom, 'adresse': '1 rue Test', 'langue': 'fr', 'est_active': est_active,
            'date_fin_essai': '2026-12-31', 'ms_client_id': None, 'nb_utilisateurs': 1,
            'date_creation': f'2026-10-{org_id:02d}T12:00:00Z',
            'modules': [{'code': 'gicleur', 'nom': 'Gicleurs', 'actif': False}],
            'contact': {'nom': 'Jean Test', 'courriel': courriel, 'telephone': ''},
        }

    def __call__(self, methode, url, json=None, timeout=None, headers=None):
        import requests

        if self.en_panne:
            raise requests.ConnectionError('panne')
        self.appels.append((methode, url.split('/ms-solution/')[1], json))
        chemin = url.split('/ms-solution/')[1]
        rep = mock.Mock(status_code=200)
        if chemin.startswith('organisations/?') or chemin == 'organisations/':
            orgs = list(self.orgs.values())
            if 'non_liees' in chemin:
                orgs = [o for o in orgs if not o['ms_client_id']]
            rep.json.return_value = orgs
            return rep
        _, org_id, *action = chemin.strip('/').split('/')
        org = self.orgs.get(int(org_id))
        if org is None:
            rep.status_code = 404
            return rep
        action = action[0] if action else None
        if action == 'lier':
            org['ms_client_id'] = json['ms_client_id']
        elif action == 'acces':
            org['est_active'] = json['est_active']
        elif action == 'essai':
            org['date_fin_essai'] = json['date_fin_essai']
        elif action == 'modules':
            for m in org['modules']:
                if m['code'] in json['modules']:
                    m['actif'] = json['modules'][m['code']]
        rep.json.return_value = org
        return rep


@override_settings(
    EXTINCPRO_API_URL='https://extincpro.test', EXTINCPRO_API_KEY='cle-test', EXTINCPRO_JOURS_GRACE=15,
)
class BaseExtincPro(TestCase):
    def setUp(self):
        self.faux = FauxExtincPro()
        patcher = mock.patch('msi.extincpro.requests.request', self.faux)
        patcher.start()
        self.addCleanup(patcher.stop)
        courriels = mock.patch('msi.emails._client')
        courriels.start()
        self.addCleanup(courriels.stop)
        self.user = get_user_model().objects.create_user(username='admin', password='x')
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def client_lie(self, org_id=1, nom='Sécurité ABC'):
        self.faux.ajouter(org_id, nom)
        return extincpro.lier(org_id, self.user)

    def facture_abonnement(self, client, echeances=(), module='gicleur'):
        facture = Document.objects.create(
            numero=Document.generer_numero('facture'), type_document='facture', categorie='abonnement_saas',
            client=client, statut='envoyee', date_echeance=AUJOURDHUI + timedelta(days=30),
        )
        LigneDocument.objects.create(
            document=facture, description='Module gicleur', quantite=1, prix_unitaire=Decimal('1000'),
            module_extincpro=module,
        )
        if echeances:
            definir_echeancier(facture, list(echeances))
        return facture


class LiaisonClients(BaseExtincPro):
    def test_un_client_cree_ici_n_est_jamais_envoye_a_extincpro(self):
        res = self.api.post('/api/clients/', {'nom_entreprise': 'Client dev', 'courriel': 'dev@x.test'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(self.faux.appels, [])
        self.assertFalse(res.data['est_client_extincpro'])

    def test_liste_a_lier_propose_le_client_existant(self):
        existant = Client.objects.create(nom_entreprise='Autre nom', courriel='jean@abc.test')
        self.faux.ajouter(1, 'Sécurité ABC', courriel='jean@abc.test')
        res = self.api.get('/api/extincpro/a-lier/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual([c['id'] for c in res.data[0]['suggestions']], [existant.id])

    def test_creer_le_client_depuis_l_organisation(self):
        self.faux.ajouter(1, 'Sécurité ABC', courriel='jean@abc.test')
        res = self.api.post('/api/extincpro/a-lier/1/lier/', {'creer': True}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        client = Client.objects.get(pk=res.data['id'])
        self.assertEqual(client.nom_entreprise, 'Sécurité ABC')
        self.assertEqual(client.extincpro_organisation_id, 1)
        self.assertEqual(self.faux.orgs[1]['ms_client_id'], client.pk)
        self.assertEqual(self.api.get('/api/extincpro/a-lier/').data, [])

    def test_lier_a_un_client_existant_sans_doublon(self):
        existant = Client.objects.create(nom_entreprise='ABC inc.', courriel='x@abc.test')
        self.faux.ajouter(1, 'Sécurité ABC')
        res = self.api.post('/api/extincpro/a-lier/1/lier/', {'client_id': existant.id}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Client.objects.count(), 1)
        existant.refresh_from_db()
        self.assertEqual(existant.extincpro_organisation_id, 1)

    def test_si_extincpro_est_en_panne_rien_n_est_cree(self):
        self.faux.ajouter(1, 'Sécurité ABC')
        org = extincpro.organisation(1)
        self.faux.en_panne = True
        with mock.patch('msi.extincpro.organisation', return_value=org):
            res = self.api.post('/api/extincpro/a-lier/1/lier/', {'creer': True}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(Client.objects.exists())

    def test_filtre_par_ligne_d_affaires(self):
        Client.objects.create(nom_entreprise='Client dev', courriel='dev@x.test')
        lie = self.client_lie()
        ids = [c['id'] for c in self.api.get('/api/clients/?ligne=extincpro').data]
        self.assertEqual(ids, [lie.id])
        ids = [c['id'] for c in self.api.get('/api/clients/?ligne=developpement').data]
        self.assertNotIn(lie.id, ids)

    def test_un_client_lie_ne_se_supprime_pas(self):
        lie = self.client_lie()
        self.assertEqual(self.api.delete(f'/api/clients/{lie.id}/').status_code, 400)


class OrdresEtAlertes(BaseExtincPro):
    def test_bloquer_puis_debloquer_est_trace(self):
        client = self.client_lie()
        url = f'/api/clients/{client.id}/extincpro/acces/'
        self.assertEqual(self.api.post(url, {'est_active': False, 'motif': 'Retard'}, format='json').status_code, 200)
        self.assertFalse(self.faux.orgs[1]['est_active'])
        self.api.post(url, {'est_active': True}, format='json')
        self.assertTrue(self.faux.orgs[1]['est_active'])
        actions = list(ActionExtincPro.objects.order_by('date').values_list('action', 'succes'))
        self.assertEqual(actions, [('lier', True), ('bloquer', True), ('debloquer', True)])

    def test_un_echec_est_trace_et_signale(self):
        client = self.client_lie()
        self.faux.en_panne = True
        res = self.api.post(f'/api/clients/{client.id}/extincpro/acces/', {'est_active': False}, format='json')
        self.assertEqual(res.status_code, 502)
        self.assertFalse(ActionExtincPro.objects.get(action='bloquer').succes)

    def test_alerte_a_bloquer_apres_le_delai_de_grace_seulement(self):
        client = self.client_lie()
        facture = self.facture_abonnement(client)
        Document.objects.filter(pk=facture.pk).update(date_echeance=AUJOURDHUI - timedelta(days=10))
        self.assertEqual(extincpro.alertes(), [])
        Document.objects.filter(pk=facture.pk).update(date_echeance=AUJOURDHUI - timedelta(days=15))
        alertes = extincpro.alertes()
        self.assertEqual([a['type'] for a in alertes], ['a_bloquer'])
        self.assertEqual(alertes[0]['retard']['jours'], 15)
        # Rien n'est bloqué automatiquement.
        self.assertTrue(self.faux.orgs[1]['est_active'])

    def test_alerte_a_debloquer_quand_plus_rien_n_est_en_retard(self):
        client = self.client_lie()
        self.faux.orgs[1]['est_active'] = False
        self.assertEqual([a['type'] for a in extincpro.alertes()], ['a_debloquer'])

    def test_organisation_supprimee_dans_extincpro(self):
        client = self.client_lie()
        del self.faux.orgs[1]
        self.assertEqual([a['type'] for a in extincpro.alertes()], ['resiliee'])
        client.refresh_from_db()
        self.assertIsNotNone(client.extincpro_resilie_le)
        self.assertTrue(Client.objects.filter(pk=client.pk).exists())


class PaiementAbonnement(BaseExtincPro):
    def payer(self, facture, montant):
        return self.api.post(f'/api/documents/{facture.id}/paiements/', {
            'montant': str(montant), 'date': AUJOURDHUI.isoformat(), 'mode': 'virement', 'envoyer_recu': False,
        }, format='json')

    def test_premier_paiement_active_les_modules_et_retire_l_essai(self):
        client = self.client_lie()
        facture = self.facture_abonnement(client)
        res = self.payer(facture, 100)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['extincpro'], {'ok': True, 'modules': ['gicleur']})
        self.assertTrue(self.faux.orgs[1]['modules'][0]['actif'])
        self.assertIsNone(self.faux.orgs[1]['date_fin_essai'])

    def test_paiement_mensuel_avec_plan(self):
        client = self.client_lie()
        total = Decimal('1149.75')  # 1000 $ + TPS + TVQ
        versements = [
            {'date': AUJOURDHUI + timedelta(days=30 * i), 'montant': (total / 3).quantize(Decimal('0.01')), 'note': ''}
            for i in range(3)
        ]
        versements[-1]['montant'] = total - sum(v['montant'] for v in versements[:-1])
        facture = self.facture_abonnement(client, echeances=versements)
        self.assertEqual(self.payer(facture, versements[0]['montant']).status_code, 201)
        self.assertTrue(self.faux.orgs[1]['modules'][0]['actif'])

    def test_le_paiement_ne_debloque_pas_tout_seul(self):
        client = self.client_lie()
        self.faux.orgs[1]['est_active'] = False
        self.payer(self.facture_abonnement(client), 100)
        self.assertFalse(self.faux.orgs[1]['est_active'])

    def test_extincpro_en_panne_n_annule_pas_le_paiement(self):
        client = self.client_lie()
        facture = self.facture_abonnement(client)
        self.faux.en_panne = True
        res = self.payer(facture, 100)
        self.assertEqual(res.status_code, 201)
        self.assertFalse(res.data['extincpro']['ok'])
        self.assertEqual(facture.paiements.count(), 1)

    def test_une_facture_ordinaire_ne_touche_pas_extincpro(self):
        client = self.client_lie()
        facture = self.facture_abonnement(client)
        Document.objects.filter(pk=facture.pk).update(categorie='developpement')
        appels_avant = len(self.faux.appels)
        res = self.payer(facture, 100)
        self.assertIsNone(res.data['extincpro'])
        self.assertEqual(len(self.faux.appels), appels_avant)
