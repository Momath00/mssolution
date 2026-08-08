import uuid
from decimal import Decimal

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.db import models
from django.utils import timezone


CATEGORIE_CONTRAT_CHOICES = [
    ('developpement', 'Développement de logiciel'),
    ('maintenance', 'Maintenance'),
    ('fonctionnalite', 'Ajout de fonctionnalité'),
]

class StockagePriveContrats(FileSystemStorage):
    """
    Stockage hors de MEDIA_ROOT : contrairement à media/ (servi publiquement sans
    authentification, voir informatique/urls.py), ce dossier n'est exposé par aucune
    route — les PDF de contrats (données personnelles : nom, courriel, IP) ne sont
    accessibles que via l'action authentifiée ContratViewSet.pdf.

    deconstruct() ne sérialise aucun argument dans les migrations : le chemin est
    recalculé à partir de BASE_DIR à chaque exécution, pour rester correct que ce
    soit en local (Windows) ou en production (conteneur Linux).
    """

    def __init__(self, **kwargs):
        kwargs['location'] = str(settings.BASE_DIR / 'media_prive')
        super().__init__(**kwargs)

    def deconstruct(self):
        return ('msi.models.StockagePriveContrats', [], {})


stockage_prive = StockagePriveContrats()


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
        ('acceptee', 'Acceptée'),
        ('refusee', 'Refusée'),
        ('payee', 'Payée'),
    ]

    numero = models.CharField(max_length=30, unique=True)
    type_document = models.CharField(max_length=20, choices=TYPE_CHOICES)
    categorie = models.CharField(max_length=20, choices=CATEGORIE_CONTRAT_CHOICES, blank=True)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='documents')
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='brouillon')
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_echeance = models.DateField(null=True, blank=True)
    date_reponse = models.DateTimeField(null=True, blank=True)
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


class Evenement(models.Model):
    TYPE_CHOICES = [
        ('rendez_vous', 'Rendez-vous'),
        ('tache', 'Tâche'),
        ('rappel', 'Rappel'),
    ]

    titre = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date = models.DateField()
    heure = models.TimeField(null=True, blank=True)
    type_evenement = models.CharField(max_length=20, choices=TYPE_CHOICES, default='tache')
    termine = models.BooleanField(default=False)
    client = models.ForeignKey(
        Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='evenements',
    )
    document = models.ForeignKey(
        Document, on_delete=models.SET_NULL, null=True, blank=True, related_name='evenements',
    )
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'heure']

    def __str__(self):
        return f'{self.titre} ({self.date})'


class Coordonnees(models.Model):
    """Singleton — une seule ligne existe toujours dans cette table (pk=1)."""

    nom_entreprise = models.CharField(max_length=200, default='MS Solution Informatique')
    courriel = models.EmailField()
    telephone = models.CharField(max_length=20)
    adresse = models.CharField(max_length=300, blank=True)
    logo = models.ImageField(upload_to='coordonnees/', blank=True, null=True)
    numero_tps = models.CharField(max_length=30, blank=True)
    numero_tvq = models.CharField(max_length=30, blank=True)
    courriel_comptable = models.EmailField(blank=True)

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


class CompteGrandLivre(models.Model):
    nom = models.CharField(max_length=150, unique=True)
    actif = models.BooleanField(default=True)
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['ordre', 'nom']
        verbose_name = 'Compte de grand livre'
        verbose_name_plural = 'Comptes de grand livre'

    def __str__(self):
        return self.nom


class Depense(models.Model):
    date = models.DateField()
    fournisseur = models.CharField(max_length=200)
    description = models.CharField(max_length=300, blank=True)
    sous_total = models.DecimalField(max_digits=10, decimal_places=2)
    tps = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))
    tvq = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))
    compte_grand_livre = models.ForeignKey(CompteGrandLivre, on_delete=models.PROTECT, related_name='depenses')
    piece_jointe = models.ImageField(upload_to='depenses/', blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-date_creation']

    @property
    def total(self):
        return (self.sous_total + self.tps + self.tvq).quantize(Decimal('0.01'))

    def __str__(self):
        return f'{self.fournisseur} — {self.total}$ ({self.date})'


class Contrat(models.Model):
    """
    Preuve figée à la signature d'une soumission acceptée. Les montants, lignes et
    conditions sont copiés au moment de la signature et ne changent plus jamais, même
    si la soumission d'origine est modifiée par la suite — c'est ce qui fait foi en cas
    de litige, avec l'IP/horodatage de signature.
    """

    STATUT_CHOICES = [
        ('actif', 'Actif'),
        ('annule', 'Annulé'),
    ]

    soumission = models.OneToOneField(Document, on_delete=models.PROTECT, related_name='contrat')
    numero = models.CharField(max_length=30, unique=True)
    categorie = models.CharField(max_length=20, choices=CATEGORIE_CONTRAT_CHOICES)

    client_nom = models.CharField(max_length=200)
    client_courriel = models.EmailField()

    lignes_json = models.JSONField(default=list)
    sous_total = models.DecimalField(max_digits=12, decimal_places=2)
    montant_tps = models.DecimalField(max_digits=12, decimal_places=2)
    montant_tvq = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    conditions_json = models.JSONField(default=list)

    nom_signataire = models.CharField(max_length=200)
    courriel_signataire = models.EmailField()
    ip_signature = models.GenericIPAddressField()
    user_agent_signature = models.CharField(max_length=500, blank=True)
    date_signature = models.DateTimeField(auto_now_add=True)

    pdf = models.FileField(upload_to='contrats/', storage=stockage_prive)
    statut = models.CharField(max_length=10, choices=STATUT_CHOICES, default='actif')

    class Meta:
        ordering = ['-date_signature']

    def __str__(self):
        return self.numero

    @classmethod
    def generer_numero(cls):
        base = f'CON-{timezone.now().year}-'
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


class RapportComptableArchive(models.Model):
    """
    Copie archivée d'un rapport comptable généré pour un trimestre — conservée même si les
    ventes/dépenses sous-jacentes changent plus tard (ex. dépense corrigée après coup), pour
    qu'on retrouve toujours ce qui a été produit et envoyé à l'origine.
    """

    annee = models.PositiveIntegerField()
    trimestre = models.PositiveSmallIntegerField()
    pdf = models.FileField(upload_to='rapports-comptables/', storage=stockage_prive)
    date_generation = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-annee', '-trimestre']
        constraints = [
            models.UniqueConstraint(fields=['annee', 'trimestre'], name='rapport_unique_par_periode'),
        ]

    def __str__(self):
        return f'T{self.trimestre} {self.annee}'
