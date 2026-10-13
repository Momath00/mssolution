import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('msi', '0020_integration_extincpro'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='soumission_origine',
            field=models.ForeignKey(blank=True, limit_choices_to={'type_document': 'soumission'}, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='factures_converties', to='msi.document'),
        ),
    ]
