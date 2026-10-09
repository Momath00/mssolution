"""Écrans ExtincPro de MS Solution : liste « À lier », alertes de retard et pilotage
d'une organisation depuis la fiche du client. Voir msi/extincpro.py."""

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import extincpro
from .models import ActionExtincPro, Client
from .serializers import ClientSerializer


def _erreur(exc, code=status.HTTP_502_BAD_GATEWAY):
    return Response({'error': str(exc)}, status=code)


class ActionExtincProSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source='utilisateur.username', read_only=True, default='')

    class Meta:
        model = ActionExtincPro
        fields = ['id', 'action', 'details', 'succes', 'erreur', 'utilisateur_nom', 'date']


class ExtincProEtatView(APIView):
    """État en direct pour la Vue d'ensemble et la page ExtincPro : organisations à lier,
    décisions à prendre, abonnés actifs ou bloqués. Une seule lecture d'ExtincPro."""

    def get(self, request):
        vide = {'a_lier': 0, 'a_lier_noms': [], 'alertes': 0, 'alertes_detail': [], 'nb_actifs': 0, 'nb_bloques': 0}
        if not extincpro.est_configure():
            return Response({'configure': False, **vide})
        try:
            orgs = extincpro.organisations()
            alertes = extincpro.alertes(orgs=orgs)
        except extincpro.ExtincProIndisponible as exc:
            return Response({'configure': True, 'erreur': str(exc), **vide})
        non_liees = [o for o in orgs if not o.get('ms_client_id')]
        liees_ici = set(
            Client.objects.filter(extincpro_organisation_id__isnull=False, extincpro_resilie_le__isnull=True)
            .values_list('extincpro_organisation_id', flat=True)
        )
        abonnees = [o for o in orgs if o['id'] in liees_ici]
        return Response({
            'configure': True,
            'a_lier': len(non_liees),
            'a_lier_noms': [o['nom'] for o in sorted(non_liees, key=lambda o: o['date_creation'], reverse=True)[:5]],
            'alertes': len(alertes),
            'alertes_detail': alertes,
            'nb_actifs': sum(1 for o in abonnees if o['est_active']),
            'nb_bloques': sum(1 for o in abonnees if not o['est_active']),
        })


class OrganisationsALierView(APIView):
    def get(self, request):
        try:
            orgs = extincpro.organisations(non_liees=True)
        except extincpro.ExtincProIndisponible as exc:
            return _erreur(exc)
        for org in orgs:
            org['suggestions'] = ClientSerializer(extincpro.suggestions_clients(org), many=True).data
        return Response(orgs)


class LierOrganisationView(APIView):
    """{"client_id": 12} relie à un client existant ; {"creer": true} crée le client."""

    def post(self, request, organisation_id):
        client = None
        if not request.data.get('creer'):
            client_id = request.data.get('client_id')
            if not client_id:
                return Response(
                    {'error': 'Choisir un client existant ou demander la création.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            client = get_object_or_404(Client, pk=client_id)
        try:
            client = extincpro.lier(organisation_id, request.user, client=client)
        except extincpro.ExtincProIndisponible as exc:
            return _erreur(exc, status.HTTP_400_BAD_REQUEST)
        return Response(ClientSerializer(client).data, status=status.HTTP_201_CREATED)


class AlertesView(APIView):
    def get(self, request):
        try:
            return Response({'jours_grace': settings.EXTINCPRO_JOURS_GRACE, 'alertes': extincpro.alertes()})
        except extincpro.ExtincProIndisponible as exc:
            return _erreur(exc)


class ModulesView(APIView):
    def get(self, request):
        try:
            return Response(extincpro.modules_disponibles())
        except extincpro.ExtincProIndisponible as exc:
            return _erreur(exc)


class ClientExtincProView(APIView):
    """Bloc « ExtincPro » de la fiche client : état réel de l'organisation, retard sur
    l'abonnement et historique des ordres envoyés."""

    def get(self, request, pk):
        client = get_object_or_404(Client, pk=pk)
        if not client.est_client_extincpro:
            return Response({'lie': False})
        donnees = {
            'lie': True,
            'organisation_id': client.extincpro_organisation_id,
            'resilie_le': client.extincpro_resilie_le,
            'jours_grace': settings.EXTINCPRO_JOURS_GRACE,
            'retard': extincpro.retard(client),
            'journal': ActionExtincProSerializer(client.actions_extincpro.all()[:20], many=True).data,
            'organisation': None,
            'erreur': None,
        }
        if not client.extincpro_resilie_le:
            try:
                org = extincpro.organisation(client.extincpro_organisation_id)
                if org is None:
                    extincpro.marquer_resilie(client)
                    donnees['resilie_le'] = client.extincpro_resilie_le
                donnees['organisation'] = org
            except extincpro.ExtincProIndisponible as exc:
                donnees['erreur'] = str(exc)
        return Response(donnees)


class ClientExtincProActionView(APIView):
    """Ordres envoyés à ExtincPro pour l'organisation de ce client."""

    def post(self, request, pk, action):
        client = get_object_or_404(Client, pk=pk)
        data = request.data
        try:
            if action == 'acces':
                if 'est_active' not in data:
                    return Response({'error': 'Fournir « est_active ».'}, status=status.HTTP_400_BAD_REQUEST)
                org = extincpro.fixer_acces(client, bool(data['est_active']), request.user, str(data.get('motif', '')))
            elif action == 'modules':
                modules = data.get('modules')
                if not isinstance(modules, dict) or not modules:
                    return Response({'error': 'Fournir « modules ».'}, status=status.HTTP_400_BAD_REQUEST)
                org = extincpro.fixer_modules(client, {k: bool(v) for k, v in modules.items()}, request.user)
            elif action == 'essai':
                org = extincpro.fixer_essai(client, data.get('date_fin_essai') or None, request.user)
            elif action == 'delier':
                extincpro.delier(client, request.user)
                return Response({'lie': False})
            else:
                return Response(status=status.HTTP_404_NOT_FOUND)
        except extincpro.ExtincProIndisponible as exc:
            return _erreur(exc)
        return Response({'organisation': org})
