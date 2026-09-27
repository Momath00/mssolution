from decimal import Decimal

from django.db import migrations

NOM = 'Système de facturation et soumission'
ANCIEN_PRIX = Decimal('3300')
NOUVEAU_PRIX = Decimal('5200')


def mettre_a_jour_prix(apps, schema_editor):
    """Nouveau prix par défaut du système de facturation. Un prix déjà modifié à la main dans
    le catalogue n'est pas touché : seul l'ancien prix par défaut est remplacé."""
    ArticleCatalogue = apps.get_model('msi', 'ArticleCatalogue')
    ArticleCatalogue.objects.filter(nom=NOM, prix=ANCIEN_PRIX).update(prix=NOUVEAU_PRIX)


class Migration(migrations.Migration):

    dependencies = [
        ('msi', '0018_rappels_automatiques'),
    ]

    operations = [
        migrations.RunPython(mettre_a_jour_prix, migrations.RunPython.noop),
    ]
