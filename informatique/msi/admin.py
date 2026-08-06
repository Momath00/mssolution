from django.contrib import admin

from .models import (
    Client,
    CompteGrandLivre,
    Coordonnees,
    Depense,
    Document,
    Evenement,
    LigneDocument,
    Realisation,
)


@admin.register(Realisation)
class RealisationAdmin(admin.ModelAdmin):
    list_display = ('titre', 'client', 'statut', 'date_creation')
    list_filter = ('statut', 'secteur')
    search_fields = ('titre', 'client')


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('nom_entreprise', 'nom_contact', 'courriel', 'telephone')
    search_fields = ('nom_entreprise', 'nom_contact', 'courriel')


class LigneDocumentInline(admin.TabularInline):
    model = LigneDocument
    extra = 1


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('numero', 'type_document', 'client', 'statut', 'date_creation', 'date_echeance')
    list_filter = ('type_document', 'statut')
    search_fields = ('numero', 'client__nom_entreprise')
    inlines = [LigneDocumentInline]


@admin.register(Evenement)
class EvenementAdmin(admin.ModelAdmin):
    list_display = ('titre', 'date', 'heure', 'type_evenement', 'termine')
    list_filter = ('type_evenement', 'termine')
    search_fields = ('titre', 'description')


@admin.register(Coordonnees)
class CoordonneesAdmin(admin.ModelAdmin):
    list_display = ('nom_entreprise', 'courriel', 'telephone')

    def has_add_permission(self, request):
        return not Coordonnees.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CompteGrandLivre)
class CompteGrandLivreAdmin(admin.ModelAdmin):
    list_display = ('nom', 'actif', 'ordre')
    list_filter = ('actif',)
    search_fields = ('nom',)


@admin.register(Depense)
class DepenseAdmin(admin.ModelAdmin):
    list_display = ('fournisseur', 'date', 'sous_total', 'total', 'compte_grand_livre')
    list_filter = ('compte_grand_livre',)
    search_fields = ('fournisseur', 'description')
