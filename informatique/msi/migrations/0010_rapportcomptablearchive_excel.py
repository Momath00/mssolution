import msi.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('msi', '0009_evenement_document'),
    ]

    operations = [
        migrations.AddField(
            model_name='rapportcomptablearchive',
            name='excel',
            field=models.FileField(
                blank=True, default='', storage=msi.models.StockagePriveContrats(), upload_to='rapports-comptables/',
            ),
        ),
    ]
