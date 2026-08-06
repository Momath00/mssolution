from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('msi', '0004_depenses'),
    ]

    operations = [
        migrations.RenameField(
            model_name='depense',
            old_name='montant',
            new_name='sous_total',
        ),
    ]
