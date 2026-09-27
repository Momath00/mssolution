from django.contrib import admin

from .models import (
    ArticleCatalogue,
    Client,
    CompteGrandLivre,
    Coordonnees,
    Depense,
    Document,
    Echeance,
    Evenement,
    LigneDocument,
    Paiement,
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


class EcheanceInline(admin.TabularInline):
    model = Echeance
    extra = 0


class PaiementInline(admin.TabularInline):
    model = Paiement
    extra = 0
    fields = ('date', 'montant', 'mode', 'reference', 'note', 'preuve')


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('numero', 'type_document', 'client', 'statut', 'date_creation', 'date_echeance')
    list_filter = ('type_document', 'statut')
    search_fields = ('numero', 'client__nom_entreprise')
    inlines = [LigneDocumentInline, EcheanceInline, PaiementInline]

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        # Un paiement ajouté/retiré ici doit mettre à jour le statut comme depuis le tableau de bord.
        form.instance.recalculer_statut()


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


@admin.register(ArticleCatalogue)
class ArticleCatalogueAdmin(admin.ModelAdmin):
    list_display = ('nom', 'prix', 'frequence', 'actif', 'ordre')
    list_filter = ('actif', 'frequence')
    search_fields = ('nom', 'description')


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
