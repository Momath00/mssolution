from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from .pdf import _donnees_rapport_comptable

ENTETE_FONT = Font(bold=True, color='FFFFFF')
ENTETE_FILL = PatternFill('solid', fgColor='1A1440')
FORMAT_MONETAIRE = '#,##0.00'


def _ecrire_entete(feuille, colonnes):
    feuille.append(colonnes)
    for cellule in feuille[1]:
        cellule.font = ENTETE_FONT
        cellule.fill = ENTETE_FILL
        cellule.alignment = Alignment(horizontal='center')


def _ajuster_largeurs(feuille):
    for colonne in feuille.columns:
        longueur = max((len(str(c.value)) for c in colonne if c.value is not None), default=10)
        feuille.column_dimensions[get_column_letter(colonne[0].column)].width = min(longueur + 2, 40)


def _feuille_ventes(feuille, ventes):
    _ecrire_entete(feuille, [
        'Date d’émission', 'Numéro', 'Client', 'Sous-total', 'TPS', 'TVQ', 'Total',
        'Payé (fin de période)', 'Solde (fin de période)',
    ])
    for vente in ventes:
        feuille.append([
            vente.date_creation.date(), vente.numero, vente.client.nom_entreprise,
            float(vente.sous_total), float(vente.montant_tps), float(vente.montant_tvq), float(vente.total),
            float(vente.paye_fin_periode), float(vente.solde_fin_periode),
        ])
    for ligne in feuille.iter_rows(min_row=2, min_col=4, max_col=9):
        for cellule in ligne:
            cellule.number_format = FORMAT_MONETAIRE
    _ajuster_largeurs(feuille)


def _feuille_depenses(feuille, depenses):
    _ecrire_entete(
        feuille, ['Date', 'Fournisseur', 'Description', 'Compte de grand livre', 'Sous-total', 'TPS', 'TVQ', 'Total'],
    )
    for depense in depenses:
        feuille.append([
            depense.date, depense.fournisseur, depense.description, depense.compte_grand_livre.nom,
            float(depense.sous_total), float(depense.tps), float(depense.tvq), float(depense.total),
        ])
    for ligne in feuille.iter_rows(min_row=2, min_col=5, max_col=8):
        for cellule in ligne:
            cellule.number_format = FORMAT_MONETAIRE
    _ajuster_largeurs(feuille)


def _formater_montants(feuille, premiere_ligne, colonnes):
    for ligne in feuille.iter_rows(min_row=premiere_ligne):
        for cellule in ligne:
            if cellule.column in colonnes and cellule.value is not None:
                cellule.number_format = FORMAT_MONETAIRE


def _feuille_encaissements(feuille, encaissements):
    _ecrire_entete(feuille, ['Date', 'Facture', 'Client', 'Mode', 'Référence', 'Montant'])
    for p in encaissements:
        feuille.append([
            p.date, p.document.numero, p.document.client.nom_entreprise,
            p.get_mode_display(), p.reference, float(p.montant),
        ])
    _formater_montants(feuille, 2, {6})
    _ajuster_largeurs(feuille)


def _feuille_a_recevoir_fin_periode(feuille, a_recevoir):
    _ecrire_entete(feuille, ['Facture', 'Client', 'Échéance', 'Total', 'Payé', 'Solde dû'])
    for r in a_recevoir:
        f = r['facture']
        feuille.append([
            f.numero, f.client.nom_entreprise, f.date_echeance,
            float(f.total), float(r['paye']), float(r['solde']),
        ])
    _formater_montants(feuille, 2, {4, 5, 6})
    _ajuster_largeurs(feuille)


def _feuille_sommaire(feuille, annee, trimestre, d):
    feuille.append([f'Rapport comptable — T{trimestre} {annee}'])
    feuille['A1'].font = Font(bold=True, size=14)
    feuille.append([])
    _ecrire_entete(feuille, ['', 'Montant'])
    lignes = [
        ('Sous-total des ventes (factures émises)', d['sous_total_ventes']),
        ('TPS perçue (facturée)', d['tps_percue']),
        ('TVQ perçue (facturée)', d['tvq_percue']),
        ('Total des ventes', d['total_ventes']),
        ('', None),
        ('Sous-total des dépenses', d['sous_total_depenses']),
        ('TPS payée', d['tps_payee']),
        ('TVQ payée', d['tvq_payee']),
        ('Total des dépenses', d['total_depenses']),
        ('', None),
        ('Solde TPS (perçue − payée)', d['tps_percue'] - d['tps_payee']),
        ('Solde TVQ (perçue − payée)', d['tvq_percue'] - d['tvq_payee']),
        ('', None),
        ('Paiements reçus (encaissements)', d['total_encaissements']),
        ('Comptes à recevoir en fin de période', d['total_a_recevoir']),
    ]
    for libelle, montant in lignes:
        feuille.append([libelle, float(montant) if montant is not None else None])
    for ligne in feuille.iter_rows(min_row=4, min_col=2, max_col=2):
        for cellule in ligne:
            if cellule.value is not None:
                cellule.number_format = FORMAT_MONETAIRE
    _ajuster_largeurs(feuille)


def generer_excel_rapport_comptable(annee, trimestre):
    d = _donnees_rapport_comptable(annee, trimestre)

    classeur = Workbook()
    feuille_ventes = classeur.active
    feuille_ventes.title = 'Ventes'
    _feuille_ventes(feuille_ventes, d['ventes'])

    _feuille_depenses(classeur.create_sheet('Dépenses'), d['depenses'])
    _feuille_encaissements(classeur.create_sheet('Encaissements'), d['encaissements'])
    _feuille_a_recevoir_fin_periode(classeur.create_sheet('À recevoir'), d['a_recevoir'])
    _feuille_sommaire(classeur.create_sheet('Sommaire'), annee, trimestre, d)

    tampon = BytesIO()
    classeur.save(tampon)
    return tampon.getvalue()


def generer_excel_comptes_a_recevoir(donnees):
    """Âge des comptes à recevoir (voir paiements.comptes_a_recevoir) : par facture et par client."""
    from .paiements import TRANCHES_AGE

    libelles_tranches = [label for _, label in TRANCHES_AGE]
    classeur = Workbook()

    feuille = classeur.active
    feuille.title = 'Par facture'
    _ecrire_entete(feuille, [
        'Facture', 'Client', 'Échéance', 'Total', 'Payé', 'Solde dû', 'Jours de retard',
        *libelles_tranches,
    ])
    for f in donnees['factures']:
        feuille.append([
            f['numero'], f['client_nom'], f['date_echeance'], float(f['total']), float(f['montant_paye']),
            float(f['solde_du']), f['jours_retard'],
            *[float(f[f'tranche_{cle}']) for cle, _ in TRANCHES_AGE],
        ])
    feuille.append([])
    feuille.append([
        'Total', '', '', None, None, float(donnees['total_du']), None,
        *[float(t['montant']) for t in donnees['tranches']],
    ])
    feuille.cell(row=feuille.max_row, column=1).font = Font(bold=True)
    _formater_montants(feuille, 2, {4, 5, 6, *range(8, 8 + len(TRANCHES_AGE))})
    _ajuster_largeurs(feuille)

    feuille_clients = classeur.create_sheet('Par client')
    _ecrire_entete(feuille_clients, [
        'Client', 'Courriel', 'Nb factures', 'Solde dû', 'En retard', *libelles_tranches,
    ])
    for c in donnees['clients']:
        feuille_clients.append([
            c['client_nom'], c['client_courriel'], c['nombre_factures'], float(c['solde_du']),
            float(c['montant_en_retard']), *[float(c[f'tranche_{cle}']) for cle, _ in TRANCHES_AGE],
        ])
    _formater_montants(feuille_clients, 2, {4, 5, *range(6, 6 + len(TRANCHES_AGE))})
    _ajuster_largeurs(feuille_clients)

    tampon = BytesIO()
    classeur.save(tampon)
    return tampon.getvalue()
