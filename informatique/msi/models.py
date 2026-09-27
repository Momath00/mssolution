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
    ('abonnement_saas', 'Abonnement annuel ExtincPro'),
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
        ('partielle', 'Partiellement payée'),
        ('payee', 'Payée'),
    ]

    TYPE_PAIEMENT_CHOICES = [
        ('complet', 'Complet'),
        ('acompte', 'Acompte'),
        ('solde', 'Solde'),
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

    # Sur une soumission : pourcentage d'acompte demandé si acceptée (ex. 35 pour un
    # développement de logiciel). Vide/0 = paiement complet à l'acceptation, comme avant.
    pourcentage_acompte = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Pourcentage d'acompte exigé à la signature (ex. 35). Laisser vide pour un paiement complet.",
    )
    # Sur une facture : type de paiement et contrat auquel elle se rattache — permet de
    # relier une facture d'acompte et sa facture de solde pour le rapport comptable.
    type_paiement = models.CharField(max_length=10, choices=TYPE_PAIEMENT_CHOICES, default='complet')
    contrat_lie = models.ForeignKey(
        'Contrat', on_delete=models.SET_NULL, null=True, blank=True, related_name='factures_liees',
    )
    # Suivi des courriels automatiques (voir rappels.py et la commande envoyer_rappels) —
    # chaque date empêche d'envoyer deux fois le même rappel.
    date_envoi = models.DateTimeField(null=True, blank=True)  # dernier envoi au client
    # Facture : dernier rappel « paiement en retard ».
    date_derniere_relance = models.DateTimeField(null=True, blank=True)
    # Facture sans plan : rappel « échéance dans X jours ».
    date_rappel_avant_echeance = models.DateTimeField(null=True, blank=True)
    # Soumission : relance « sans réponse », rappel « expire bientôt », alerte interne « expirée ».
    date_relance_soumission = models.DateTimeField(null=True, blank=True)
    date_rappel_expiration = models.DateTimeField(null=True, blank=True)
    date_alerte_expiration = models.DateTimeField(null=True, blank=True)

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

    # --- Paiements et solde dû -------------------------------------------------------
    # Les calculs passent par .all() (et non aggregate) pour profiter du prefetch_related
    # fait dans les listes, sans requête supplémentaire par facture.

    @property
    def montant_paye(self):
        return sum((p.montant for p in self.paiements.all()), Decimal('0')).quantize(Decimal('0.01'))

    @property
    def solde_du(self):
        return max(self.total - self.montant_paye, Decimal('0')).quantize(Decimal('0.01'))

    def etat_echeances(self, aujourd_hui=None):
        """
        Répartit les paiements reçus sur les versements prévus, du plus ancien au plus récent :
        un paiement couvre d'abord le premier versement, le surplus passe au suivant. Donne
        pour chaque versement ce qui a été payé, ce qu'il reste et son état.
        """
        aujourd_hui = aujourd_hui or timezone.localdate()
        disponible = self.montant_paye
        etats = []
        for echeance in sorted(self.echeances.all(), key=lambda e: (e.date, e.pk or 0)):
            paye = min(disponible, echeance.montant)
            disponible -= paye
            reste = (echeance.montant - paye).quantize(Decimal('0.01'))
            if reste <= 0:
                statut = 'payee'
            elif echeance.date < aujourd_hui:
                statut = 'en_retard'
            elif paye > 0:
                statut = 'partielle'
            else:
                statut = 'a_venir'
            etats.append({
                'echeance': echeance,
                'paye': paye.quantize(Decimal('0.01')),
                'reste': reste,
                'statut': statut,
            })
        return etats

    def _dates_en_retard(self, aujourd_hui):
        """Montants et dates encore dus et déjà échus — base du retard et de l'âge des comptes."""
        if self.type_document != 'facture' or self.statut == 'brouillon' or self.solde_du <= 0:
            return []
        etats = self.etat_echeances(aujourd_hui)
        if etats:
            return [(e['echeance'].date, e['reste']) for e in etats if e['statut'] == 'en_retard']
        if self.date_echeance and self.date_echeance < aujourd_hui:
            return [(self.date_echeance, self.solde_du)]
        return []

    def montant_en_retard(self, aujourd_hui=None):
        aujourd_hui = aujourd_hui or timezone.localdate()
        return sum((m for _, m in self._dates_en_retard(aujourd_hui)), Decimal('0')).quantize(Decimal('0.01'))

    def jours_retard(self, aujourd_hui=None):
        """Nombre de jours depuis le plus ancien montant échu et impayé (0 si rien n'est en retard)."""
        aujourd_hui = aujourd_hui or timezone.localdate()
        dates = [d for d, _ in self._dates_en_retard(aujourd_hui)]
        return (aujourd_hui - min(dates)).days if dates else 0

    @property
    def en_retard(self):
        return self.jours_retard() > 0

    def prochaine_echeance(self, aujourd_hui=None):
        """Prochain versement encore dû (date + montant restant), ou l'échéance de la facture
        s'il n'y a pas de plan de paiement. None si tout est payé."""
        if self.solde_du <= 0:
            return None
        for etat in self.etat_echeances(aujourd_hui):
            if etat['reste'] > 0:
                return {'date': etat['echeance'].date, 'montant': etat['reste']}
        if self.date_echeance:
            return {'date': self.date_echeance, 'montant': self.solde_du}
        return None

    def recalculer_statut(self):
        """
        Aligne le statut d'une facture sur ses paiements : aucun paiement → envoyée,
        une partie → partiellement payée, tout → payée. Retourne l'ancien statut.
        Les soumissions ne sont pas concernées (leur « payée » reste manuel).
        """
        ancien = self.statut
        if self.type_document != 'facture':
            return ancien
        paye = self.montant_paye
        if paye <= 0:
            nouveau = 'envoyee' if ancien in ('partielle', 'payee') else ancien
        elif paye >= self.total:
            nouveau = 'payee'
        else:
            nouveau = 'partielle'
        if nouveau != ancien:
            self.statut = nouveau
            self.save(update_fields=['statut'])
        return ancien


class Echeance(models.Model):
    """
    Un versement prévu du plan de paiement d'une facture — c'est toi qui choisis combien de
    versements, à quelles dates et de quels montants (ex. 10 000 $ en 4 versements mensuels).
    La somme des versements doit égaler le total de la facture.
    """

    document = models.ForeignKey(Document, related_name='echeances', on_delete=models.CASCADE)
    date = models.DateField()
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    note = models.CharField(max_length=200, blank=True)
    # Rappel « versement dans X jours » déjà envoyé pour ce versement.
    date_rappel_avant = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['date', 'id']

    def __str__(self):
        return f'{self.document.numero} — {self.montant} $ le {self.date}'


class Paiement(models.Model):
    """Un montant réellement reçu du client sur une facture. Le solde dû = total − paiements."""

    MODE_CHOICES = [
        ('virement', 'Virement Interac'),
        ('depot', 'Dépôt direct'),
        ('cheque', 'Chèque'),
        ('carte', 'Carte de crédit'),
        ('comptant', 'Comptant'),
        ('autre', 'Autre'),
    ]

    document = models.ForeignKey(Document, related_name='paiements', on_delete=models.CASCADE)
    date = models.DateField(default=timezone.localdate)
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default='virement')
    reference = models.CharField(max_length=100, blank=True, help_text='N° de chèque, de transaction, etc.')
    note = models.CharField(max_length=300, blank=True)
    # Photo du chèque, capture du virement, PDF de l'avis de dépôt… Stockage privé (un chèque
    # porte des numéros de compte) : jamais servi publiquement, seulement par l'API connectée.
    preuve = models.FileField(upload_to='paiements/', storage=stockage_prive, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'id']

    def __str__(self):
        return f'{self.document.numero} — {self.montant} $ le {self.date}'

    def delete(self, *args, **kwargs):
        if self.preuve:
            self.preuve.delete(save=False)
        return super().delete(*args, **kwargs)


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


class ArticleCatalogue(models.Model):
    """
    Service ou module à prix standard (grille tarifaire), choisi dans le formulaire de
    soumission/facture pour pré-remplir une ligne. La ligne créée est une copie : modifier
    un prix ici ne change pas les documents déjà émis.
    """

    FREQUENCE_CHOICES = [
        ('unique', 'Paiement unique'),
        ('annuel', 'Par année'),
    ]

    nom = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    prix = models.DecimalField(max_digits=10, decimal_places=2)
    frequence = models.CharField(max_length=10, choices=FREQUENCE_CHOICES, default='unique')
    actif = models.BooleanField(default=True)
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['ordre', 'nom']
        verbose_name = 'Article du catalogue'
        verbose_name_plural = 'Articles du catalogue'

    def __str__(self):
        return f'{self.nom} ({self.prix} $)'


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

    # Rappels automatiques (exécutés chaque matin par la commande envoyer_rappels).
    # Un délai à 0 désactive ce rappel en particulier.
    rappels_actifs = models.BooleanField(default=True)
    relance_soumission_jours = models.PositiveSmallIntegerField(
        default=7, help_text='Relancer une soumission sans réponse X jours après son envoi (0 = jamais).',
    )
    rappel_expiration_jours = models.PositiveSmallIntegerField(
        default=3, help_text="Prévenir le client X jours avant l'expiration de la soumission (0 = jamais).",
    )
    rappel_avant_versement_jours = models.PositiveSmallIntegerField(
        default=3, help_text='Rappeler un versement X jours avant sa date (0 = jamais).',
    )
    rappel_retard_intervalle_jours = models.PositiveSmallIntegerField(
        default=7, help_text='Relancer un paiement en retard au plus une fois tous les X jours (0 = jamais).',
    )

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
    pourcentage_acompte = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    conditions_json = models.JSONField(default=list)
    # Plan de paiement accepté par le client ([{date, montant, note}]), dates déjà ajustées
    # au jour de la signature — figé comme le reste du contrat.
    echeancier_json = models.JSONField(default=list, blank=True)

    nom_signataire = models.CharField(max_length=200)
    # Trait de signature dessiné à la main (souris/doigt) au moment de l'acceptation, stocké
    # en data URI PNG — plus simple qu'un vrai fichier pour une image générée côté client et
    # jamais réutilisée ailleurs (le PDF l'embarque directement).
    signature_image = models.TextField(blank=True)
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

    @property
    def versements(self):
        """Plan de paiement figé, avec de vraies dates (pour les gabarits)."""
        from datetime import date

        return [
            {'date': date.fromisoformat(v['date']), 'montant': v['montant'], 'note': v.get('note', '')}
            for v in self.echeancier_json
        ]

    @property
    def montant_acompte(self):
        """Sous-total (avant taxes) de l'acompte — les taxes s'appliquent ensuite normalement
        sur la facture d'acompte elle-même, donc son .total() correspond bien à ce pourcentage
        du total taxes incluses du contrat."""
        if not self.pourcentage_acompte:
            return None
        return (self.sous_total * self.pourcentage_acompte / Decimal('100')).quantize(Decimal('0.01'))

    @property
    def montant_solde(self):
        if not self.pourcentage_acompte:
            return None
        return (self.sous_total - self.montant_acompte).quantize(Decimal('0.01'))

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
    excel = models.FileField(upload_to='rapports-comptables/', storage=stockage_prive, blank=True, default='')
    date_generation = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-annee', '-trimestre']
        constraints = [
            models.UniqueConstraint(fields=['annee', 'trimestre'], name='rapport_unique_par_periode'),
        ]

    def __str__(self):
        return f'T{self.trimestre} {self.annee}'
