from decimal import Decimal

from django.db import migrations, models


GRILLE_INITIALE = [
    ('Module de gestion des extincteurs', '', '3155', 'unique'),
    ("Module de gestion de l'éclairage d'urgence", '', '2500', 'unique'),
    ('Module de gestion des gicleurs', '', '3800', 'unique'),
    ("Module de gestion des alarmes d'incendie", '', '4200', 'unique'),
    ('Module de gestion des systèmes de cuisine', '', '4200', 'unique'),
    ('Module de gestion des bornes-fontaines', '', '1800', 'unique'),
    ("Module de gestion des pompes d'incendie", '', '1800', 'unique'),
    ("Module d'essai et d'inspection des dispositifs antirefoulement", '', '1800', 'unique'),
    ("Rapport d'inspection – dispositifs de monoxyde de carbone", '', '1800', 'unique'),
    ("Système d'appel de service", 'Suivi de la progression et signature', '3600', 'unique'),
    ('Environnement portail Superviseur / Technicien / Client', '', '2200', 'unique'),
    ('Rapports PDF, certificats et automatisation', '', '500', 'unique'),
    (
        'Extraction de données par module pour un modèle de rapport',
        'Format PDF, Word (.doc) ou Excel',
        '600',
        'unique',
    ),
    (
        'Système de calendrier et planification des visites/tournées',
        'Avec rappels automatiques',
        '3200',
        'unique',
    ),
    (
        "Planification et gestion d'horaire (punch in / punch out)",
        'Avec lien Google Maps',
        '4200',
        'unique',
    ),
    ('Système de facturation et soumission', '', '3300', 'unique'),
    ('Hébergement serveur et ressources', 'Abonnement annuel', '420', 'annuel'),
    ('Système de messagerie électronique', 'Abonnement annuel', '360', 'annuel'),
    ('Maintenance annuelle', '', '1200', 'annuel'),
]


def charger_grille(apps, schema_editor):
    ArticleCatalogue = apps.get_model('msi', 'ArticleCatalogue')
    for ordre, (nom, description, prix, frequence) in enumerate(GRILLE_INITIALE):
        ArticleCatalogue.objects.create(
            nom=nom, description=description, prix=Decimal(prix), frequence=frequence, ordre=ordre,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('msi', '0013_alter_contrat_categorie_alter_document_categorie'),
    ]

    operations = [
        migrations.CreateModel(
            name='ArticleCatalogue',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('prix', models.DecimalField(decimal_places=2, max_digits=10)),
                ('frequence', models.CharField(choices=[('unique', 'Paiement unique'), ('annuel', 'Par année')], default='unique', max_length=10)),
                ('actif', models.BooleanField(default=True)),
                ('ordre', models.PositiveIntegerField(default=0)),
            ],
            options={
                'verbose_name': 'Article du catalogue',
                'verbose_name_plural': 'Articles du catalogue',
                'ordering': ['ordre', 'nom'],
            },
        ),
        migrations.RunPython(charger_grille, migrations.RunPython.noop),
    ]
