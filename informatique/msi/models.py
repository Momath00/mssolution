from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class Realisation(models.Model):
    STATUT_CHOICES = [
        ('brouillon', 'Brouillon'),
        ('publie', 'Publié'),
    ]

    titre = models.CharField(max_length=200)
    description = models.TextField()
    client = models.CharField(max_length=200)
    secteur = models.CharField(max_length=100, blank=True)
    image = models.ImageField(upload_to='realisations/')
    lien_site = models.URLField(blank=True)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='brouillon')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_creation']

    def __str__(self):
        return self.titre


class Client(models.Model):
    nom_entreprise = models.CharField(max_length=200)
    nom_contact = models.CharField(max_length=200, blank=True)
    courriel = models.EmailField()
    telephone = models.CharField(max_length=20, blank=True)
    adresse = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nom_entreprise']

    def __str__(self):
        return self.nom_entreprise


class Document(models.Model):
    TYPE_CHOICES = [
        ('soumission', 'Soumission'),
        ('facture', 'Facture'),
    ]
    STATUT_CHOICES = [
        ('brouillon', 'Brouillon'),
        ('envoyee', 'Envoyée'),
        ('payee', 'Payée'),
    ]

    numero = models.CharField(max_length=30, unique=True)
    type_document = models.CharField(max_length=20, choices=TYPE_CHOICES)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='documents')
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='brouillon')
    date_creation = models.DateTimeField(auto_now_add=True)
    date_echeance = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-date_creation']

    def __str__(self):
        return self.numero

    @classmethod
    def generer_numero(cls, type_document):
        prefixe = 'FAC' if type_document == 'facture' else 'SOU'
        base = f'{prefixe}-{timezone.now().year}-'
        dernier = (
            cls.objects.filter(numero__startswith=base)
            .order_by('-numero')
            .values_list('numero', flat=True)
            .first()
        )
        prochain = 1
        if dernier:
            try:
                prochain = int(dernier.rsplit('-', 1)[-1]) + 1
            except ValueError:
                prochain = 1
        return f'{base}{prochain:04d}'

    @property
    def sous_total(self):
        total = sum((ligne.montant for ligne in self.lignes.all()), Decimal('0'))
        return total.quantize(Decimal('0.01'))

    @property
    def montant_tps(self):
        return (self.sous_total * Decimal(str(settings.TPS_RATE))).quantize(Decimal('0.01'))

    @property
    def montant_tvq(self):
        return (self.sous_total * Decimal(str(settings.TVQ_RATE))).quantize(Decimal('0.01'))

    @property
    def total(self):
        return (self.sous_total + self.montant_tps + self.montant_tvq).quantize(Decimal('0.01'))


class LigneDocument(models.Model):
    document = models.ForeignKey(Document, related_name='lignes', on_delete=models.CASCADE)
    description = models.CharField(max_length=300)
    quantite = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    prix_unitaire = models.DecimalField(max_digits=10, decimal_places=2)

    @property
    def montant(self):
        return (self.quantite * self.prix_unitaire).quantize(Decimal('0.01'))

    def __str__(self):
        return f'{self.description} ({self.document.numero})'


class Coordonnees(models.Model):
    """Singleton — une seule ligne existe toujours dans cette table (pk=1)."""

    nom_entreprise = models.CharField(max_length=200, default='MS Solution Informatique')
    courriel = models.EmailField()
    telephone = models.CharField(max_length=20)
    adresse = models.CharField(max_length=300, blank=True)
    logo = models.ImageField(upload_to='coordonnees/', blank=True, null=True)
    numero_tps = models.CharField(max_length=30, blank=True)
    numero_tvq = models.CharField(max_length=30, blank=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return self.nom_entreprise
