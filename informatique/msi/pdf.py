from pathlib import Path

from django.template.loader import render_to_string
from weasyprint import HTML

from .models import Coordonnees


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
    })
    return HTML(string=html).write_pdf()
