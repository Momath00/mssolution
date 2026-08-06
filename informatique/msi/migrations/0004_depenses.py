import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


COMPTES_GRAND_LIVRE = [
    'Fournitures et matériaux',
    'Sous-traitants',
    'Salaires',
    'Loyer',
    'Publicité & Articles promotionnels',
    'Fournitures de bureau',
    "Outils et location d'équipements",
    'Réparations & entretiens matériel roulant',
    'Assurance - Matériel roulant',
    'Frais de déplacement - essence',
    'Frais de repas et représentation',
    'Honoraire professionnels',
    'Télécommunication',
    'Assurance - Invalidité',
    'Assurance - Responsabilité',
    'Intérêts et Frais bancaires',
    'Intérêts et pénalités gouvernements',
    'DAS - Fédéral',
    'DAS - Provincial',
    'Charges salariales (CNESST)',
    'Amort. - Matériels roulant',
    'Divers',
]


def seed_comptes_grand_livre(apps, schema_editor):
    CompteGrandLivre = apps.get_model('msi', 'CompteGrandLivre')
    for ordre, nom in enumerate(COMPTES_GRAND_LIVRE):
        CompteGrandLivre.objects.get_or_create(nom=nom, defaults={'ordre': ordre})


def unseed_comptes_grand_livre(apps, schema_editor):
    CompteGrandLivre = apps.get_model('msi', 'CompteGrandLivre')
    CompteGrandLivre.objects.filter(nom__in=COMPTES_GRAND_LIVRE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('msi', '0003_evenement_client'),
    ]

    operations = [
        migrations.AddField(
            model_name='coordonnees',
            name='courriel_comptable',
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.CreateModel(
            name='CompteGrandLivre',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=150, unique=True)),
                ('actif', models.BooleanField(default=True)),
                ('ordre', models.PositiveIntegerField(default=0)),
            ],
            options={
                'verbose_name': 'Compte de grand livre',
                'verbose_name_plural': 'Comptes de grand livre',
                'ordering': ['ordre', 'nom'],
            },
        ),
        migrations.CreateModel(
            name='Depense',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('fournisseur', models.CharField(max_length=200)),
                ('description', models.CharField(blank=True, max_length=300)),
                ('montant', models.DecimalField(decimal_places=2, max_digits=10)),
                ('tps', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('tvq', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('piece_jointe', models.ImageField(blank=True, null=True, upload_to='depenses/')),
                ('date_creation', models.DateTimeField(auto_now_add=True)),
                (
                    'compte_grand_livre',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='depenses',
                        to='msi.comptegrandlivre',
                    ),
                ),
                (
                    'created_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'ordering': ['-date', '-date_creation'],
            },
        ),
        migrations.RunPython(seed_comptes_grand_livre, unseed_comptes_grand_livre),
    ]
