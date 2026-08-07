from rest_framework import serializers

from .conditions_contrats import generer_conditions
from .models import (
    Client,
    CompteGrandLivre,
    Contrat,
    Coordonnees,
    Depense,
    Document,
    Evenement,
    LigneDocument,
    RapportComptableArchive,
    Realisation,
)


class RealisationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Realisation
        fields = [
            'id', 'titre', 'description', 'client', 'secteur', 'image',
            'lien_site', 'statut', 'date_creation',
        ]
        read_only_fields = ['id', 'date_creation']


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            'id', 'nom_entreprise', 'nom_contact', 'courriel', 'telephone',
            'adresse', 'date_creation',
        ]
        read_only_fields = ['id', 'date_creation']


class LigneDocumentSerializer(serializers.ModelSerializer):
    montant = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = LigneDocument
        fields = ['id', 'description', 'quantite', 'prix_unitaire', 'montant']


class DocumentSerializer(serializers.ModelSerializer):
    lignes = LigneDocumentSerializer(many=True)
    client_nom = serializers.CharField(source='client.nom_entreprise', read_only=True)
    sous_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    montant_tps = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    montant_tvq = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Document
        fields = [
            'id', 'numero', 'type_document', 'categorie', 'client', 'client_nom', 'statut',
            'date_creation', 'date_echeance', 'date_reponse', 'lignes',
            'sous_total', 'montant_tps', 'montant_tvq', 'total',
        ]
        read_only_fields = ['id', 'numero', 'date_creation', 'date_reponse']

    def create(self, validated_data):
        lignes_data = validated_data.pop('lignes')
        validated_data['numero'] = Document.generer_numero(validated_data['type_document'])
        validated_data['statut'] = 'brouillon'
        document = Document.objects.create(**validated_data)
        for ligne_data in lignes_data:
            LigneDocument.objects.create(document=document, **ligne_data)
        return document

    def update(self, instance, validated_data):
        lignes_data = validated_data.pop('lignes', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lignes_data is not None:
            instance.lignes.all().delete()
            for ligne_data in lignes_data:
                LigneDocument.objects.create(document=instance, **ligne_data)
        return instance


class SoumissionPubliqueSerializer(serializers.ModelSerializer):
    """Vue publique (par token) d'une soumission, sans exposer d'IDs internes ni le client complet."""

    lignes = LigneDocumentSerializer(many=True, read_only=True)
    client_nom = serializers.CharField(source='client.nom_entreprise', read_only=True)
    categorie_label = serializers.CharField(source='get_categorie_display', read_only=True)
    sous_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    montant_tps = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    montant_tvq = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    conditions = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'numero', 'client_nom', 'categorie', 'categorie_label', 'statut',
            'date_creation', 'date_echeance', 'date_reponse', 'lignes',
            'sous_total', 'montant_tps', 'montant_tvq', 'total', 'conditions',
        ]

    def get_conditions(self, document):
        return generer_conditions(document.categorie, numero_soumission=document.numero, total=str(document.total))


class RepondreSoumissionSerializer(serializers.Serializer):
    reponse = serializers.ChoiceField(choices=['acceptee', 'refusee'])
    nom_signataire = serializers.CharField(max_length=200, required=False, allow_blank=True)
    accepte_conditions = serializers.BooleanField(required=False, default=False)

    def validate(self, data):
        if data['reponse'] == 'acceptee':
            if not data.get('nom_signataire', '').strip():
                raise serializers.ValidationError(
                    {'nom_signataire': 'Le nom complet du signataire est requis pour accepter.'}
                )
            if not data.get('accepte_conditions'):
                raise serializers.ValidationError(
                    {'accepte_conditions': 'Vous devez cocher que vous acceptez cette soumission et ses modalités.'}
                )
        return data


class ContratSerializer(serializers.ModelSerializer):
    categorie_label = serializers.CharField(source='get_categorie_display', read_only=True)
    soumission_numero = serializers.CharField(source='soumission.numero', read_only=True)

    class Meta:
        model = Contrat
        fields = [
            'id', 'numero', 'categorie', 'categorie_label', 'soumission', 'soumission_numero',
            'client_nom', 'client_courriel', 'total', 'nom_signataire', 'date_signature',
            'statut', 'pdf',
        ]
        read_only_fields = fields


class RapportComptableArchiveSerializer(serializers.ModelSerializer):
    class Meta:
        model = RapportComptableArchive
        fields = ['id', 'annee', 'trimestre', 'date_generation']
        read_only_fields = fields


class EvenementSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source='client.nom_entreprise', read_only=True, default=None)

    class Meta:
        model = Evenement
        fields = [
            'id', 'titre', 'description', 'date', 'heure', 'type_evenement',
            'termine', 'client', 'client_nom', 'date_creation',
        ]
        read_only_fields = ['id', 'date_creation']


class CoordonneesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coordonnees
        fields = [
            'nom_entreprise', 'courriel', 'telephone', 'adresse', 'logo',
            'numero_tps', 'numero_tvq', 'courriel_comptable',
        ]


class CompteGrandLivreSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompteGrandLivre
        fields = ['id', 'nom', 'actif', 'ordre']


class DepenseSerializer(serializers.ModelSerializer):
    compte_grand_livre_nom = serializers.CharField(source='compte_grand_livre.nom', read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Depense
        fields = [
            'id', 'date', 'fournisseur', 'description', 'sous_total', 'tps', 'tvq', 'total',
            'compte_grand_livre', 'compte_grand_livre_nom', 'piece_jointe', 'date_creation',
        ]
        read_only_fields = ['id', 'date_creation']


class ContactSerializer(serializers.Serializer):
    nom = serializers.CharField(max_length=200)
    courriel = serializers.EmailField()
    message = serializers.CharField()


class DemandeSoumissionSerializer(serializers.Serializer):
    nom_entreprise = serializers.CharField(max_length=200)
    nom_contact = serializers.CharField(max_length=200, required=False, allow_blank=True)
    courriel = serializers.EmailField()
    telephone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    message = serializers.CharField()
