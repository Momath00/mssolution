import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('msi', '0008_rapportcomptablearchive'),
    ]

    operations = [
        migrations.AddField(
            model_name='evenement',
            name='document',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='evenements',
                to='msi.document',
            ),
        ),
    ]
