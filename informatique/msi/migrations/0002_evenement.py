import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('msi', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Evenement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titre', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('date', models.DateField()),
                ('heure', models.TimeField(blank=True, null=True)),
                ('type_evenement', models.CharField(choices=[('rendez_vous', 'Rendez-vous'), ('tache', 'Tâche'), ('rappel', 'Rappel')], default='tache', max_length=20)),
                ('termine', models.BooleanField(default=False)),
                ('date_creation', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['date', 'heure'],
            },
        ),
    ]
