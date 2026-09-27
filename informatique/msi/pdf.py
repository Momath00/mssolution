from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from django.template.loader import render_to_string
from weasyprint import HTML

from .models import CATEGORIE_CONTRAT_CHOICES, Coordonnees, Depense, Document, Paiement


def generer_pdf_document(document):
    coordonnees = Coordonnees.load()
    logo_uri = Path(coordonnees.logo.path).as_uri() if coordonnees.logo else None
    html = render_to_string('msi/document_pdf.html', {
        'document': document,
        'client': document.client,
        'lignes': document.lignes.all(),
        'coordonnees': coordonnees,
        'logo_uri': logo_uri,
        'type_label': 'FACTURE' if document.type_document == 'facture' else 'SOUMISSION',
        'echeances': document.etat_echeances(),
        'paiements': document.paiements.all() if document.type_document == 'facture' else [],
    })
    return HTML(string=html).write_pdf()


def generer_pdf_contrat(contrat):
    coordonnees = Coordonnees.load()
    logo_uri = Path(coordonnees.logo.path).as_uri() if coordonnees.logo else None
    categorie_label = dict(CATEGORIE_CONTRAT_CHOICES).get(contrat.categorie, contrat.categorie)
    html = render_to_string('msi/contrat_pdf.html', {
        'contrat': contrat,
        'coordonnees': coordonnees,
        'logo_uri': logo_uri,
        'categorie_label': categorie_label,
    })
    return HTML(string=html).write_pdf()


def _bornes_trimestre(annee, trimestre):
    mois_debut = (trimestre - 1) * 3 + 1
    annee_fin, mois_fin = (annee, mois_debut + 3) if mois_debut + 3 <= 12 else (annee + 1, 1)
    return date(annee, mois_debut, 1), date(annee_fin, mois_fin, 1)


def _formater_solde(valeur):
    """Convention comptable : les soldes négatifs (remboursements) s'affichent entre parenthèses."""
    if valeur < 0:
        return f'({abs(valeur):.2f})'
    return f'{valeur:.2f}'


def _donnees_rapport_comptable(annee, trimestre):
    """Ventes, dépenses et totaux d'un trimestre — source commune au rapport en PDF et en Excel."""
    debut, fin = _bornes_trimestre(annee, trimestre)

    # Comptabilité d'exercice : une vente compte dans le trimestre où la facture est ÉMISE
    # (sa date, celle imprimée sur le PDF), qu'elle soit payée ou non — c'est à ce moment
    # que la TPS/TVQ devient due. Les paiements, eux, sont suivis à part (encaissements et
    # comptes à recevoir). Un rapport ne change donc plus quand un client paie plus tard.
    from .paiements import ventes_emises

    ventes = list(ventes_emises(debut, fin))
    for vente in ventes:
        # Portrait au dernier jour du trimestre (stable même si le rapport est regénéré).
        if vente.type_document == 'soumission':
            vente.paye_fin_periode = vente.total
        else:
            vente.paye_fin_periode = sum(
                (p.montant for p in vente.paiements.all() if p.date < fin), Decimal('0'),
            )
        vente.paye_fin_periode = vente.paye_fin_periode.quantize(Decimal('0.01'))
        vente.solde_fin_periode = max(vente.total - vente.paye_fin_periode, Decimal('0')).quantize(Decimal('0.01'))
    depenses = list(
        Depense.objects.filter(date__gte=debut, date__lt=fin)
        .select_related('compte_grand_livre')
        .order_by('date')
    )

    sous_total_ventes = sum((v.sous_total for v in ventes), Decimal('0'))
    tps_percue = sum((v.montant_tps for v in ventes), Decimal('0'))
    tvq_percue = sum((v.montant_tvq for v in ventes), Decimal('0'))
    total_ventes = sum((v.total for v in ventes), Decimal('0'))

    encaissements = list(
        Paiement.objects.filter(date__gte=debut, date__lt=fin)
        .select_related('document__client')
        .order_by('date', 'id')
    )

    # Soldes dus au dernier jour du trimestre : on ne compte que les paiements reçus avant la
    # fin, pour qu'un rapport regénéré plus tard donne le même portrait qu'à l'époque.
    a_recevoir = []
    factures = (
        Document.objects.filter(type_document='facture', date_creation__date__lt=fin)
        .exclude(statut='brouillon')
        .select_related('client').prefetch_related('lignes', 'paiements')
        .order_by('date_creation')
    )
    for facture in factures:
        paye = sum((p.montant for p in facture.paiements.all() if p.date < fin), Decimal('0')).quantize(Decimal('0.01'))
        solde = facture.total - paye
        if solde > 0:
            a_recevoir.append({'facture': facture, 'paye': paye, 'solde': solde})

    sous_total_depenses = sum((d.sous_total for d in depenses), Decimal('0'))
    tps_payee = sum((d.tps for d in depenses), Decimal('0'))
    tvq_payee = sum((d.tvq for d in depenses), Decimal('0'))
    total_depenses = sum((d.total for d in depenses), Decimal('0'))

    return {
        'debut': debut, 'fin': fin,
        'ventes': ventes, 'depenses': depenses,
        'sous_total_ventes': sous_total_ventes, 'tps_percue': tps_percue,
        'tvq_percue': tvq_percue, 'total_ventes': total_ventes,
        'sous_total_depenses': sous_total_depenses, 'tps_payee': tps_payee,
        'tvq_payee': tvq_payee, 'total_depenses': total_depenses,
        'paye_ventes': sum((v.paye_fin_periode for v in ventes), Decimal('0')),
        'solde_ventes': sum((v.solde_fin_periode for v in ventes), Decimal('0')),
        'encaissements': encaissements,
        'total_encaissements': sum((p.montant for p in encaissements), Decimal('0')),
        'a_recevoir': a_recevoir,
        'total_a_recevoir': sum((r['solde'] for r in a_recevoir), Decimal('0')),
    }


def generer_rapport_comptable(annee, trimestre):
    coordonnees = Coordonnees.load()
    logo_uri = Path(coordonnees.logo.path).as_uri() if coordonnees.logo else None
    d = _donnees_rapport_comptable(annee, trimestre)

    photos = [
        {'depense': dep, 'uri': Path(dep.piece_jointe.path).as_uri()}
        for dep in d['depenses'] if dep.piece_jointe
    ]

    html = render_to_string('msi/rapport_comptable.html', {
        'coordonnees': coordonnees,
        'logo_uri': logo_uri,
        'annee': annee,
        'trimestre': trimestre,
        'debut': d['debut'],
        'fin': d['fin'],
        'ventes': d['ventes'],
        'depenses': d['depenses'],
        'photos': photos,
        'sous_total_ventes': d['sous_total_ventes'],
        'total_ventes': d['total_ventes'],
        'sous_total_depenses': d['sous_total_depenses'],
        'total_depenses': d['total_depenses'],
        'tps_percue': d['tps_percue'],
        'tvq_percue': d['tvq_percue'],
        'tps_payee': d['tps_payee'],
        'tvq_payee': d['tvq_payee'],
        'solde_tps': _formater_solde(d['tps_percue'] - d['tps_payee']),
        'solde_tvq': _formater_solde(d['tvq_percue'] - d['tvq_payee']),
        'paye_ventes': d['paye_ventes'],
        'solde_ventes': d['solde_ventes'],
        'encaissements': d['encaissements'],
        'total_encaissements': d['total_encaissements'],
        'a_recevoir': d['a_recevoir'],
        'total_a_recevoir': d['total_a_recevoir'],
        'date_fin_periode': d['fin'] - timedelta(days=1),
    })
    return HTML(string=html).write_pdf()
