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
    contrat_lie_numero = serializers.CharField(source='contrat_lie.numero', read_only=True, default=None)
    contrat_id = serializers.SerializerMethodField()
    solde_facturable = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id', 'numero', 'type_document', 'categorie', 'client', 'client_nom', 'statut',
            'date_creation', 'date_echeance', 'date_reponse', 'lignes',
            'sous_total', 'montant_tps', 'montant_tvq', 'total',
            'pourcentage_acompte', 'type_paiement', 'contrat_lie', 'contrat_lie_numero',
            'contrat_id', 'solde_facturable',
        ]
        read_only_fields = ['id', 'numero', 'date_creation', 'date_reponse', 'type_paiement', 'contrat_lie']

    def get_contrat_id(self, document):
        contrat = getattr(document, 'contrat', None)
        return contrat.id if contrat else None

    def get_solde_facturable(self, document):
        """Vrai sur une soumission acceptée avec acompte déjà facturé mais pas encore de solde
        — sert à afficher/masquer le bouton « Facturer le solde » sans dupliquer cette règle
        côté frontend."""
        contrat = getattr(document, 'contrat', None)
        if not contrat or not contrat.pourcentage_acompte:
            return False
        types = {f.type_paiement for f in contrat.factures_liees.all()}
        return 'acompte' in types and 'solde' not in types
        read_only_fields = ['id', 'numero', 'date_creation', 'date_reponse', 'type_paiement', 'contrat_lie']

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
            'pourcentage_acompte',
        ]

    def get_conditions(self, document):
        return generer_conditions(
            document.categorie, numero_soumission=document.numero, total=str(document.total),
            pourcentage_acompte=document.pourcentage_acompte,
        )


class RepondreSoumissionSerializer(serializers.Serializer):
    reponse = serializers.ChoiceField(choices=['acceptee', 'refusee'])
    nom_signataire = serializers.CharField(max_length=200, required=False, allow_blank=True)
    accepte_conditions = serializers.BooleanField(required=False, default=False)
    signature_image = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data['reponse'] == 'acceptee' and not data.get('accepte_conditions'):
            raise serializers.ValidationError(
                {'accepte_conditions': 'Vous devez cocher que vous acceptez cette soumission et ses modalités.'}
            )
        return data


class FactureLieeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'numero', 'type_paiement', 'statut', 'total', 'date_creation']
        read_only_fields = fields


class ContratSerializer(serializers.ModelSerializer):
    categorie_label = serializers.CharField(source='get_categorie_display', read_only=True)
    soumission_numero = serializers.CharField(source='soumission.numero', read_only=True)
    montant_acompte = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    montant_solde = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    factures_liees = FactureLieeSerializer(many=True, read_only=True)

    class Meta:
        model = Contrat
        fields = [
            'id', 'numero', 'categorie', 'categorie_label', 'soumission', 'soumission_numero',
            'client_nom', 'client_courriel', 'total', 'nom_signataire', 'date_signature',
            'statut', 'pdf', 'pourcentage_acompte', 'montant_acompte', 'montant_solde',
            'factures_liees',
        ]
        read_only_fields = fields


class RapportComptableArchiveSerializer(serializers.ModelSerializer):
    a_excel = serializers.SerializerMethodField()

    class Meta:
        model = RapportComptableArchive
        fields = ['id', 'annee', 'trimestre', 'date_generation', 'a_excel']
        read_only_fields = fields

    def get_a_excel(self, archive):
        return bool(archive.excel)


class EvenementSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source='client.nom_entreprise', read_only=True, default=None)
    document_numero = serializers.CharField(source='document.numero', read_only=True, default=None)

    class Meta:
        model = Evenement
        fields = [
            'id', 'titre', 'description', 'date', 'heure', 'type_evenement',
            'termine', 'client', 'client_nom', 'document', 'document_numero', 'date_creation',
        ]
        read_only_fields = ['id', 'document', 'document_numero', 'date_creation']


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
