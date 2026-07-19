from rest_framework import serializers

from .models import Client, Coordonnees, Document, LigneDocument, Realisation


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
            'id', 'numero', 'type_document', 'client', 'client_nom', 'statut',
            'date_creation', 'date_echeance', 'lignes',
            'sous_total', 'montant_tps', 'montant_tvq', 'total',
        ]
        read_only_fields = ['id', 'numero', 'date_creation']

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


class CoordonneesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coordonnees
        fields = [
            'nom_entreprise', 'courriel', 'telephone', 'adresse', 'logo',
            'numero_tps', 'numero_tvq',
        ]


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
