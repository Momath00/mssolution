import base64
from pathlib import Path

import resend
from django.conf import settings

from .models import Coordonnees
from .pdf import generer_pdf_document

NAVY = '#1a1440'
ACCENT = '#e63946'
FOND = '#eef0f6'


def _client():
    resend.api_key = settings.RESEND_API_KEY
    return resend


def _piece_jointe_logo(coordonnees):
    if not coordonnees.logo:
        return None
    with open(coordonnees.logo.path, 'rb') as fichier:
        contenu = fichier.read()
    extension = Path(coordonnees.logo.name).suffix.lstrip('.') or 'png'
    return {
        'filename': f'logo.{extension}',
        'content': base64.b64encode(contenu).decode('ascii'),
        'content_id': 'logo-entreprise',
    }


def _gabarit_html(titre, corps_html, coordonnees, logo):
    entete_logo = (
        f'<img src="cid:{logo["content_id"]}" alt="{coordonnees.nom_entreprise}" height="40" '
        f'style="display:block;height:40px;">'
        if logo
        else f'<span style="color:#fff;font-size:20px;font-weight:bold;">{coordonnees.nom_entreprise}</span>'
    )
    pied_ligne2 = ' &middot; '.join(filter(None, [coordonnees.telephone, coordonnees.courriel]))
    return f'''<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:{FOND};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{FOND};padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0"
                 style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:{NAVY};padding:24px 32px;">{entete_logo}</td>
            </tr>
            <tr>
              <td style="padding:32px;color:#1a1a1a;font-size:14px;line-height:1.6;">
                <h1 style="margin:0 0 16px;font-size:20px;color:{NAVY};">{titre}</h1>
                {corps_html}
              </td>
            </tr>
            <tr>
              <td style="background:{FOND};padding:20px 32px;font-size:11px;color:#777;line-height:1.6;">
                <strong style="color:{NAVY};">{coordonnees.nom_entreprise}</strong><br>
                {coordonnees.adresse or ''}<br>
                {pied_ligne2}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>'''


def _envoyer_confirmation(destinataire, from_email, reply_to, sujet, corps, coordonnees, logo):
    payload = {
        'from': from_email,
        'to': [destinataire],
        'reply_to': reply_to,
        'subject': sujet,
        'html': _gabarit_html(sujet, corps, coordonnees, logo),
    }
    if logo:
        payload['attachments'] = [logo]
    _client().Emails.send(payload)


def envoyer_contact(nom, courriel, message):
    coordonnees = Coordonnees.load()
    logo = _piece_jointe_logo(coordonnees)
    destinataire = settings.CONTACT_NOTIFICATION_EMAIL or settings.REPLY_TO_CONTACT
    corps = (
        f'<p><strong>Nom&nbsp;:</strong> {nom}</p>'
        f'<p><strong>Courriel&nbsp;:</strong> {courriel}</p>'
        f'<p><strong>Message&nbsp;:</strong></p><p>{message}</p>'
    )
    payload = {
        'from': settings.RESEND_FROM_CONTACT,
        'to': [destinataire],
        'reply_to': courriel,
        'subject': f'Nouveau message de contact — {nom}',
        'html': _gabarit_html('Nouveau message de contact', corps, coordonnees, logo),
    }
    if logo:
        payload['attachments'] = [logo]
    _client().Emails.send(payload)

    _envoyer_confirmation(
        destinataire=courriel,
        from_email=settings.RESEND_FROM_CONTACT,
        reply_to=settings.REPLY_TO_CONTACT,
        sujet='Votre message a été envoyé avec succès',
        corps=(
            f'<p>Bonjour {nom},</p>'
            f'<p>Merci de nous avoir contact&eacute;s. Votre message a bien &eacute;t&eacute; transmis &agrave; notre '
            f'&eacute;quipe et nous vous r&eacute;pondrons dans les plus brefs d&eacute;lais.</p>'
            f'<p>— L&rsquo;&eacute;quipe MS Solution Informatique</p>'
        ),
        coordonnees=coordonnees,
        logo=logo,
    )


def envoyer_demande_soumission(nom_entreprise, nom_contact, courriel, telephone, message):
    coordonnees = Coordonnees.load()
    logo = _piece_jointe_logo(coordonnees)
    destinataire = settings.CONTACT_NOTIFICATION_EMAIL or settings.REPLY_TO_SOUMISSION

    corps = (
        f'<p><strong>Entreprise&nbsp;:</strong> {nom_entreprise}</p>'
        + (f'<p><strong>Contact&nbsp;:</strong> {nom_contact}</p>' if nom_contact else '')
        + f'<p><strong>Courriel&nbsp;:</strong> {courriel}</p>'
        + (f'<p><strong>T&eacute;l&eacute;phone&nbsp;:</strong> {telephone}</p>' if telephone else '')
        + f'<p><strong>Besoin&nbsp;:</strong></p><p>{message}</p>'
    )
    payload = {
        'from': settings.RESEND_FROM_SOUMISSION,
        'to': [destinataire],
        'reply_to': courriel,
        'subject': f'Nouvelle demande de soumission — {nom_entreprise}',
        'html': _gabarit_html('Nouvelle demande de soumission', corps, coordonnees, logo),
    }
    if logo:
        payload['attachments'] = [logo]
    _client().Emails.send(payload)

    _envoyer_confirmation(
        destinataire=courriel,
        from_email=settings.RESEND_FROM_SOUMISSION,
        reply_to=settings.REPLY_TO_SOUMISSION,
        sujet='Votre demande de soumission a été envoyée avec succès',
        corps=(
            f'<p>Bonjour {nom_contact or nom_entreprise},</p>'
            f'<p>Votre demande de soumission pour <strong>{nom_entreprise}</strong> a bien &eacute;t&eacute; '
            f're&ccedil;ue. Notre &eacute;quipe l&rsquo;analysera et vous contactera sous peu.</p>'
            f'<p>— L&rsquo;&eacute;quipe MS Solution Informatique</p>'
        ),
        coordonnees=coordonnees,
        logo=logo,
    )


def envoyer_document(document):
    coordonnees = Coordonnees.load()
    logo = _piece_jointe_logo(coordonnees)
    pdf_bytes = generer_pdf_document(document)
    type_label = 'Facture' if document.type_document == 'facture' else 'Soumission'
    est_facture = document.type_document == 'facture'
    from_email = settings.RESEND_FROM_FACTURE if est_facture else settings.RESEND_FROM_SOUMISSION
    reply_to = settings.REPLY_TO_FACTURE if est_facture else settings.REPLY_TO_SOUMISSION

    corps = (
        f'<p>Bonjour {document.client.nom_entreprise},</p>'
        f'<p>Veuillez trouver ci-joint votre {type_label.lower()} n&deg; {document.numero}.</p>'
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">'
        f'<tr><td style="background:{ACCENT};border-radius:8px;padding:12px 20px;">'
        f'<span style="color:#fff;font-weight:bold;font-size:16px;">Total&nbsp;: {document.total}&nbsp;$</span>'
        f'</td></tr></table>'
    )

    attachments = [{
        'filename': f'{type_label}_{document.numero}.pdf',
        'content': base64.b64encode(pdf_bytes).decode('ascii'),
    }]
    if logo:
        attachments.append(logo)

    _client().Emails.send({
        'from': from_email,
        'to': [document.client.courriel],
        'reply_to': reply_to,
        'subject': f'{type_label} {document.numero}',
        'html': _gabarit_html(f'{type_label} {document.numero}', corps, coordonnees, logo),
        'attachments': attachments,
    })
