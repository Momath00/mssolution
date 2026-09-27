from rest_framework import serializers

from datetime import date

from django.utils import timezone

from .conditions_contrats import generer_conditions
from .models import (
    ArticleCatalogue,
    Client,
    CompteGrandLivre,
    Contrat,
    Coordonnees,
    Depense,
    Document,
    Evenement,
    LigneDocument,
    Paiement,
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


EXTENSIONS_PREUVE = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.pdf'}
TAILLE_MAX_PREUVE = 10 * 1024 * 1024


def valider_preuve(fichier):
    import os

    extension = os.path.splitext(fichier.name)[1].lower()
    if extension not in EXTENSIONS_PREUVE:
        raise serializers.ValidationError('La preuve doit être une photo (JPG, PNG, HEIC…) ou un PDF.')
    if fichier.size > TAILLE_MAX_PREUVE:
        raise serializers.ValidationError('La preuve ne doit pas dépasser 10 Mo.')
    return fichier


class PaiementSerializer(serializers.ModelSerializer):
    mode_label = serializers.CharField(source='get_mode_display', read_only=True)
    a_preuve = serializers.SerializerMethodField()
    preuve_est_pdf = serializers.SerializerMethodField()

    class Meta:
        model = Paiement
        fields = [
            'id', 'date', 'montant', 'mode', 'mode_label', 'reference', 'note', 'date_creation',
            'a_preuve', 'preuve_est_pdf',
        ]
        read_only_fields = ['id', 'date_creation']

    def get_a_preuve(self, paiement):
        return bool(paiement.preuve)

    def get_preuve_est_pdf(self, paiement):
        return bool(paiement.preuve) and paiement.preuve.name.lower().endswith('.pdf')


class PreuvePaiementSerializer(serializers.Serializer):
    preuve = serializers.FileField(validators=[valider_preuve])


class EnregistrerPaiementSerializer(serializers.Serializer):
    montant = serializers.DecimalField(max_digits=12, decimal_places=2)
    date = serializers.DateField()
    mode = serializers.ChoiceField(choices=Paiement.MODE_CHOICES, default='virement')
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    note = serializers.CharField(max_length=300, required=False, allow_blank=True, default='')
    envoyer_recu = serializers.BooleanField(required=False, default=True)
    preuve = serializers.FileField(required=False, allow_null=True, validators=[valider_preuve])


class VersementSerializer(serializers.Serializer):
    date = serializers.DateField()
    montant = serializers.DecimalField(max_digits=12, decimal_places=2)
    note = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')


class EcheancierSerializer(serializers.Serializer):
    versements = VersementSerializer(many=True)


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
    montant_paye = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    solde_du = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    montant_en_retard = serializers.SerializerMethodField()
    jours_retard = serializers.SerializerMethodField()
    prochaine_echeance = serializers.SerializerMethodField()
    echeances = serializers.SerializerMethodField()
    paiements = PaiementSerializer(many=True, read_only=True)
    plan_valide = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id', 'numero', 'type_document', 'categorie', 'client', 'client_nom', 'statut',
            'date_creation', 'date_echeance', 'date_reponse', 'lignes',
            'sous_total', 'montant_tps', 'montant_tvq', 'total',
            'pourcentage_acompte', 'type_paiement', 'contrat_lie', 'contrat_lie_numero',
            'contrat_id', 'solde_facturable',
            'montant_paye', 'solde_du', 'montant_en_retard', 'jours_retard', 'prochaine_echeance',
            'echeances', 'paiements', 'date_derniere_relance', 'plan_valide',
            'date_envoi', 'date_rappel_avant_echeance', 'date_relance_soumission',
            'date_rappel_expiration', 'date_alerte_expiration',
        ]
        read_only_fields = [
            'id', 'numero', 'date_creation', 'date_reponse', 'type_paiement', 'contrat_lie',
            'date_derniere_relance', 'date_envoi', 'date_rappel_avant_echeance',
            'date_relance_soumission', 'date_rappel_expiration', 'date_alerte_expiration',
        ]

    def get_montant_en_retard(self, document):
        return str(document.montant_en_retard())

    def get_jours_retard(self, document):
        return document.jours_retard()

    def get_prochaine_echeance(self, document):
        prochaine = document.prochaine_echeance()
        if not prochaine:
            return None
        return {'date': prochaine['date'].isoformat(), 'montant': str(prochaine['montant'])}

    def get_echeances(self, document):
        return [
            {
                'id': etat['echeance'].id,
                'date': etat['echeance'].date.isoformat(),
                'montant': str(etat['echeance'].montant),
                'note': etat['echeance'].note,
                'paye': str(etat['paye']),
                'reste': str(etat['reste']),
                'statut': etat['statut'],
                'date_rappel_avant': etat['echeance'].date_rappel_avant,
            }
            for etat in document.etat_echeances()
        ]

    def get_plan_valide(self, document):
        from .paiements import plan_valide

        return plan_valide(document)

    def validate_pourcentage_acompte(self, valeur):
        if valeur and self.instance is not None and self.instance.echeances.exists():
            raise serializers.ValidationError(
                'Cette soumission a un plan de paiement : retirez le plan avant de demander un acompte.',
            )
        return valeur

    def validate_statut(self, statut):
        # Sur une facture, « partiellement payée » et « payée » découlent des paiements
        # enregistrés — jamais d'une case cochée, sinon le solde dû ne voudrait plus rien dire.
        instance = self.instance
        type_document = instance.type_document if instance else self.initial_data.get('type_document')
        if (
            type_document == 'facture'
            and statut in ('partielle', 'payee')
            and (instance is None or statut != instance.statut)
        ):
            raise serializers.ValidationError(
                "Le statut d'une facture se met à jour en enregistrant un paiement.",
            )
        return statut

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
        # Le total a pu changer (lignes modifiées) : le statut payée/partielle doit suivre.
        instance.recalculer_statut()
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
    echeances = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'numero', 'client_nom', 'categorie', 'categorie_label', 'statut',
            'date_creation', 'date_echeance', 'date_reponse', 'lignes',
            'sous_total', 'montant_tps', 'montant_tvq', 'total', 'conditions',
            'pourcentage_acompte', 'echeances',
        ]

    def _versements(self, document):
        """Une fois acceptée, le plan qui fait foi est celui figé au contrat ; avant, c'est le
        plan proposé, ajusté comme s'il était accepté aujourd'hui."""
        from .paiements import plan_decale, plan_valide

        if not hasattr(self, '_cache_versements'):
            contrat = getattr(document, 'contrat', None)
            if contrat is not None:
                self._cache_versements = [
                    {'date': date.fromisoformat(v['date']), 'montant': v['montant'], 'note': v['note']}
                    for v in contrat.echeancier_json
                ]
            elif plan_valide(document):
                self._cache_versements = plan_decale(document, timezone.localdate())
            else:
                self._cache_versements = []
        return self._cache_versements

    def get_echeances(self, document):
        return [
            {'date': v['date'].isoformat(), 'montant': str(v['montant']), 'note': v['note']}
            for v in self._versements(document)
        ]

    def get_conditions(self, document):
        contrat = getattr(document, 'contrat', None)
        if contrat is not None:
            return contrat.conditions_json
        return generer_conditions(
            document.categorie, numero_soumission=document.numero, total=str(document.total),
            pourcentage_acompte=document.pourcentage_acompte, versements=self._versements(document),
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
    montant_paye = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    solde_du = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Document
        fields = ['id', 'numero', 'type_paiement', 'statut', 'total', 'montant_paye', 'solde_du', 'date_creation']
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
            'factures_liees', 'echeancier_json',
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


class ParametresRappelsSerializer(serializers.ModelSerializer):
    """Réglages des rappels automatiques — séparés de CoordonneesSerializer, qui est public."""

    class Meta:
        model = Coordonnees
        fields = [
            'rappels_actifs', 'relance_soumission_jours', 'rappel_expiration_jours',
            'rappel_avant_versement_jours', 'rappel_retard_intervalle_jours',
        ]
        extra_kwargs = {champ: {'max_value': 90} for champ in fields if champ != 'rappels_actifs'}


class ArticleCatalogueSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleCatalogue
        fields = ['id', 'nom', 'description', 'prix', 'frequence', 'actif', 'ordre']


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
