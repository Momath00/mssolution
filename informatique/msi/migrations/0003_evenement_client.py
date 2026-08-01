import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('msi', '0002_evenement'),
    ]

    operations = [
        migrations.AddField(
            model_name='evenement',
            name='client',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='evenements',
                to='msi.client',
            ),
        ),
    ]
