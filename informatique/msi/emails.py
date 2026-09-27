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
        f'<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
        f'<td><img src="cid:{logo["content_id"]}" alt="{coordonnees.nom_entreprise}" height="40" '
        f'style="display:block;height:40px;"></td>'
        f'<td style="padding-left:12px;vertical-align:middle;">'
        f'<span style="color:#fff;font-size:18px;font-weight:bold;">{coordonnees.nom_entreprise}</span></td>'
        f'</tr></table>'
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


def envoyer_soumission_refusee(document):
    """Alerte l'équipe lorsqu'un client refuse une soumission — sans quoi le refus passerait inaperçu."""
    coordonnees = Coordonnees.load()
    logo = _piece_jointe_logo(coordonnees)
    destinataire = settings.CONTACT_NOTIFICATION_EMAIL or settings.REPLY_TO_SOUMISSION

    corps = (
        f'<p><strong>{document.client.nom_entreprise}</strong> a refus&eacute; la soumission '
        f'{document.numero} ({document.total}&nbsp;$).</p>'
        f'<p>Contactez le client si vous souhaitez en discuter&nbsp;: {document.client.courriel}</p>'
    )
    payload = {
        'from': settings.RESEND_FROM_SOUMISSION,
        'to': [destinataire],
        'reply_to': settings.REPLY_TO_SOUMISSION,
        'subject': f'Soumission refusée {document.numero} — {document.client.nom_entreprise}',
        'html': _gabarit_html(f'Soumission refusée {document.numero}', corps, coordonnees, logo),
    }
    if logo:
        payload['attachments'] = [logo]
    _client().Emails.send(payload)


def envoyer_confirmation_paiement(document):
    """Confirme au client que son paiement a été reçu — preuve écrite avec le numéro de document."""
    coordonnees = Coordonnees.load()
    logo = _piece_jointe_logo(coordonnees)
    est_facture = document.type_document == 'facture'
    type_label = 'facture' if est_facture else 'soumission'
    reply_to = settings.REPLY_TO_FACTURE if est_facture else settings.REPLY_TO_SOUMISSION

    if document.type_paiement == 'acompte':
        libelle_paiement = "votre acompte pour"
    elif document.type_paiement == 'solde':
        libelle_paiement = "le solde de"
    else:
        libelle_paiement = "votre paiement pour"

    solde_html = ''
    if document.type_paiement == 'acompte' and document.contrat_lie and document.contrat_lie.montant_solde:
        solde_html = (
            f'<p style="margin-top:12px;">Le solde de <strong>{document.contrat_lie.montant_solde}&nbsp;$</strong> '
            f'(avant taxes) vous sera factur&eacute; &agrave; la livraison/mise en ligne du logiciel.</p>'
        )

    corps = (
        f'<p>Bonjour {document.client.nom_entreprise},</p>'
        f'<p>Nous confirmons que {libelle_paiement} la {type_label} <strong>{document.numero}</strong> '
        f'a &eacute;t&eacute; re&ccedil;u par l&rsquo;&eacute;quipe {coordonnees.nom_entreprise}.</p>'
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">'
        f'<tr><td style="background:#16a34a;border-radius:8px;padding:12px 20px;">'
        f'<span style="color:#fff;font-weight:bold;font-size:16px;">Montant re&ccedil;u&nbsp;: {document.total}&nbsp;$</span>'
        f'</td></tr></table>'
        f'{solde_html}'
        f'<p style="margin-top:20px;">Merci de votre confiance.</p>'
    )
    payload = {
        'from': settings.RESEND_FROM_PAIEMENT,
        'to': [document.client.courriel],
        'reply_to': reply_to,
        'subject': f'Paiement reçu — {document.numero}',
        'html': _gabarit_html(f'Paiement reçu — {document.numero}', corps, coordonnees, logo),
    }
    if logo:
        payload['attachments'] = [logo]
    _client().Emails.send(payload)


def _date_fr(d):
    return d.strftime('%d/%m/%Y')


def _plan_propose_html(document):
    """Plan de paiement proposé sur une soumission (dates et montants seulement)."""
    echeances = list(document.echeances.all())
    if not echeances:
        return ''
    cellule = 'padding:6px 8px;border-bottom:1px solid #eee;'
    lignes = ''.join(
        f'<tr><td style="{cellule}">{i}/{len(echeances)}</td>'
        f'<td style="{cellule}">{_date_fr(e.date)}{f" — {e.note}" if e.note else ""}</td>'
        f'<td style="{cellule}text-align:right;">{e.montant}&nbsp;$</td></tr>'
        for i, e in enumerate(echeances, start=1)
    )
    return (
        f'<p style="margin:20px 0 6px;font-weight:bold;color:{NAVY};">Plan de paiement propos&eacute;</p>'
        f'<table role="presentation" cellpadding="0" cellspacing="0" '
        f'style="width:100%;font-size:13px;border-collapse:collapse;">{lignes}</table>'
        f'<p style="font-size:12px;color:#888;">Si vous acceptez apr&egrave;s la date du premier versement, '
        f'toutes les dates sont report&eacute;es d&rsquo;autant.</p>'
    )


def _plan_paiement_html(document, seulement_dus=False):
    """Tableau des versements prévus (date, montant, reste) pour les courriels de facture."""
    etats = document.etat_echeances()
    if seulement_dus:
        etats = [e for e in etats if e['reste'] > 0]
    if not etats:
        return ''
    libelles = {'payee': 'Payé', 'partielle': 'Partiel', 'en_retard': 'En retard', 'a_venir': 'À venir'}
    couleurs = {'payee': '#16a34a', 'partielle': '#b45309', 'en_retard': ACCENT, 'a_venir': '#555'}
    cellule = 'padding:6px 8px;border-bottom:1px solid #eee;'
    entete = f'padding:6px 8px;border-bottom:1px solid {NAVY};'
    lignes = ''.join(
        f'<tr>'
        f'<td style="{cellule}">{_date_fr(e["echeance"].date)}</td>'
        f'<td style="{cellule}text-align:right;">{e["echeance"].montant}&nbsp;$</td>'
        f'<td style="{cellule}text-align:right;">{e["reste"]}&nbsp;$</td>'
        f'<td style="{cellule}color:{couleurs[e["statut"]]};font-weight:bold;">{libelles[e["statut"]]}</td>'
        f'</tr>'
        for e in etats
    )
    return (
        f'<p style="margin:20px 0 6px;font-weight:bold;color:{NAVY};">Plan de paiement</p>'
        f'<table role="presentation" cellpadding="0" cellspacing="0" '
        f'style="width:100%;font-size:13px;border-collapse:collapse;">'
        f'<tr style="color:#777;font-size:11px;text-transform:uppercase;">'
        f'<td style="{entete}">Date</td>'
        f'<td style="{entete}text-align:right;">Montant</td>'
        f'<td style="{entete}text-align:right;">Reste</td>'
        f'<td style="{entete}">&Eacute;tat</td>'
        f'</tr>{lignes}</table>'
    )


def _resume_solde_html(document):
    """Encadré Total / Payé / Solde dû."""
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" '
        f'style="margin-top:16px;width:100%;background:{FOND};border-radius:8px;font-size:14px;">'
        f'<tr><td style="padding:10px 16px 2px;">Total de la facture</td>'
        f'<td style="padding:10px 16px 2px;text-align:right;">{document.total}&nbsp;$</td></tr>'
        f'<tr><td style="padding:2px 16px;color:#16a34a;">Total pay&eacute;</td>'
        f'<td style="padding:2px 16px;text-align:right;color:#16a34a;">{document.montant_paye}&nbsp;$</td></tr>'
        f'<tr><td style="padding:2px 16px 10px;font-weight:bold;color:{NAVY};">Solde d&ucirc;</td>'
        f'<td style="padding:2px 16px 10px;text-align:right;font-weight:bold;color:{NAVY};">'
        f'{document.solde_du}&nbsp;$</td></tr>'
        f'</table>'
    )


def _piece_jointe_facture(document):
    pdf_bytes = generer_pdf_document(document)
    return {
        'filename': f'Facture_{document.numero}.pdf',
        'content': base64.b64encode(pdf_bytes).decode('ascii'),
    }


def envoyer_recu_paiement(paiement):
    """
    Reçu envoyé au client pour CHAQUE paiement (même partiel) : montant reçu, total payé à ce
    jour, solde restant et prochain versement attendu. La facture à jour est jointe.
    """
    document = paiement.document
    coordonnees = Coordonnees.load()
    logo = _piece_jointe_logo(coordonnees)

    if document.solde_du <= 0:
        suite_html = (
            '<p style="margin-top:16px;"><strong>Votre facture est maintenant enti&egrave;rement '
            'pay&eacute;e.</strong> Merci&nbsp;!</p>'
        )
        if document.type_paiement == 'acompte' and document.contrat_lie and document.contrat_lie.montant_solde:
            suite_html += (
                f'<p>Le solde du contrat de <strong>{document.contrat_lie.montant_solde}&nbsp;$</strong> '
                f'(avant taxes) vous sera factur&eacute; &agrave; la livraison/mise en ligne du logiciel.</p>'
            )
    else:
        prochaine = document.prochaine_echeance()
        suite_html = ''
        if prochaine:
            suite_html = (
                f'<p style="margin-top:16px;">Prochain versement attendu&nbsp;: '
                f'<strong>{prochaine["montant"]}&nbsp;$</strong> le <strong>{_date_fr(prochaine["date"])}</strong>.</p>'
            )
        suite_html += _plan_paiement_html(document)

    reference = f' (r&eacute;f.&nbsp;{paiement.reference})' if paiement.reference else ''
    corps = (
        f'<p>Bonjour {document.client.nom_entreprise},</p>'
        f'<p>Nous confirmons avoir re&ccedil;u votre paiement du {_date_fr(paiement.date)} '
        f'({paiement.get_mode_display()}{reference}) pour la facture <strong>{document.numero}</strong>.</p>'
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;">'
        f'<tr><td style="background:#16a34a;border-radius:8px;padding:12px 20px;">'
        f'<span style="color:#fff;font-weight:bold;font-size:16px;">'
        f'Montant re&ccedil;u&nbsp;: {paiement.montant}&nbsp;$</span>'
        f'</td></tr></table>'
        f'{_resume_solde_html(document)}'
        f'{suite_html}'
        f'<p style="margin-top:20px;">Merci de votre confiance.</p>'
    )
    sujet = f'Paiement reçu — {document.numero}'
    attachments = [_piece_jointe_facture(document)]
    if logo:
        attachments.append(logo)
    _client().Emails.send({
        'from': settings.RESEND_FROM_PAIEMENT,
        'to': [document.client.courriel],
        'reply_to': settings.REPLY_TO_FACTURE,
        'subject': sujet,
        'html': _gabarit_html(sujet, corps, coordonnees, logo),
        'attachments': attachments,
    })


def envoyer_rappel_paiement(document):
    """Rappel courtois au client : montant en retard, solde total et versements encore dus."""
    coordonnees = Coordonnees.load()
    logo = _piece_jointe_logo(coordonnees)
    en_retard = document.montant_en_retard()
    jours = document.jours_retard()

    if en_retard > 0:
        pluriel = 's' if jours > 1 else ''
        intro = (
            f'<p>Sauf erreur de notre part, un montant de <strong>{en_retard}&nbsp;$</strong> sur la facture '
            f'<strong>{document.numero}</strong> est en retard de {jours} jour{pluriel}.</p>'
        )
        couleur, libelle, montant = ACCENT, 'Montant en retard', en_retard
    else:
        prochaine = document.prochaine_echeance()
        date_txt = f' le <strong>{_date_fr(prochaine["date"])}</strong>' if prochaine else ''
        intro = (
            f'<p>Petit rappel&nbsp;: un paiement sur la facture <strong>{document.numero}</strong> '
            f'est attendu{date_txt}.</p>'
        )
        couleur, libelle = NAVY, 'Montant attendu'
        montant = prochaine['montant'] if prochaine else document.solde_du

    corps = (
        f'<p>Bonjour {document.client.nom_entreprise},</p>'
        f'{intro}'
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;">'
        f'<tr><td style="background:{couleur};border-radius:8px;padding:12px 20px;">'
        f'<span style="color:#fff;font-weight:bold;font-size:16px;">{libelle}&nbsp;: {montant}&nbsp;$</span>'
        f'</td></tr></table>'
        f'{_resume_solde_html(document)}'
        f'{_plan_paiement_html(document, seulement_dus=True)}'
        f'<p style="margin-top:20px;">Si votre paiement a d&eacute;j&agrave; &eacute;t&eacute; envoy&eacute;, merci '
        f'de ne pas tenir compte de ce message. Pour toute question, r&eacute;pondez simplement &agrave; ce '
        f'courriel.</p>'
    )
    sujet = f'Rappel de paiement — {document.numero}'
    attachments = [_piece_jointe_facture(document)]
    if logo:
        attachments.append(logo)
    _client().Emails.send({
        'from': settings.RESEND_FROM_FACTURE,
        'to': [document.client.courriel],
        'reply_to': settings.REPLY_TO_FACTURE,
        'subject': sujet,
        'html': _gabarit_html(sujet, corps, coordonnees, logo),
        'attachments': attachments,
    })


def _boutons_soumission_html(document):
    lien = f'{settings.SITE_URL}/soumission/{document.token}/'
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;">'
        f'<tr>'
        f'<td style="background:#16a34a;border-radius:8px;">'
        f'<a href="{lien}?reponse=accepter" style="display:inline-block;padding:12px 20px;color:#fff;'
        f'font-weight:bold;font-size:14px;text-decoration:none;">Accepter la soumission</a>'
        f'</td>'
        f'<td style="width:12px;"></td>'
        f'<td style="border:1px solid #ccc;border-radius:8px;">'
        f'<a href="{lien}" style="display:inline-block;padding:12px 18px;color:#555;'
        f'font-weight:bold;font-size:14px;text-decoration:none;">Consulter la soumission</a>'
        f'</td>'
        f'</tr></table>'
    )


def _resume_plan_soumission_html(document):
    """Rappel informatif du plan proposé — ce n'est PAS une demande de paiement."""
    echeances = list(document.echeances.all())
    if not echeances:
        return ''
    premier = echeances[0]
    return (
        f'<p style="margin-top:12px;">Pour rappel, le total de <strong>{document.total}&nbsp;$</strong> est payable '
        f'en {len(echeances)} versement{"s" if len(echeances) > 1 else ""}, le premier de '
        f'<strong>{premier.montant}&nbsp;$</strong>.</p>'
    )


def _envoyer_au_client_soumission(document, sujet, corps):
    coordonnees = Coordonnees.load()
    logo = _piece_jointe_logo(coordonnees)
    payload = {
        'from': settings.RESEND_FROM_SOUMISSION,
        'to': [document.client.courriel],
        'reply_to': settings.REPLY_TO_SOUMISSION,
        'subject': sujet,
        'html': _gabarit_html(sujet, corps, coordonnees, logo),
    }
    if logo:
        payload['attachments'] = [logo]
    _client().Emails.send(payload)


def envoyer_relance_soumission(document):
    """Relance polie d'une soumission restée sans réponse."""
    corps = (
        f'<p>Bonjour {document.client.nom_contact or document.client.nom_entreprise},</p>'
        f'<p>Nous vous avons fait parvenir la soumission <strong>{document.numero}</strong> '
        f'({document.total}&nbsp;$). Avez-vous eu l&rsquo;occasion de la consulter&nbsp;?</p>'
        f'{_resume_plan_soumission_html(document)}'
        + (
            f'<p>Elle est valide jusqu&rsquo;au <strong>{_date_fr(document.date_echeance)}</strong>.</p>'
            if document.date_echeance else ''
        )
        + f'<p>Vous pouvez l&rsquo;accepter ou la refuser en un clic&nbsp;:</p>'
        f'{_boutons_soumission_html(document)}'
        f'<p style="margin-top:20px;">Une question ou un ajustement&nbsp;? R&eacute;pondez simplement &agrave; ce '
        f'courriel.</p>'
    )
    _envoyer_au_client_soumission(document, f'Votre soumission {document.numero}', corps)


def envoyer_rappel_expiration_soumission(document, jours_restants):
    """Prévient le client que la soumission expire bientôt."""
    quand = "aujourd&rsquo;hui" if jours_restants == 0 else (
        f'dans {jours_restants} jour{"s" if jours_restants > 1 else ""}'
    )
    corps = (
        f'<p>Bonjour {document.client.nom_contact or document.client.nom_entreprise},</p>'
        f'<p>Petit rappel&nbsp;: la soumission <strong>{document.numero}</strong> ({document.total}&nbsp;$) '
        f'expire {quand}, le <strong>{_date_fr(document.date_echeance)}</strong>. Apr&egrave;s cette date, '
        f'les prix et disponibilit&eacute;s pourraient changer.</p>'
        f'{_resume_plan_soumission_html(document)}'
        f'{_boutons_soumission_html(document)}'
    )
    _envoyer_au_client_soumission(document, f'Votre soumission {document.numero} expire bientôt', corps)


def envoyer_alerte_soumission_expiree(document):
    """Alerte INTERNE (à toi, pas au client) : une soumission a expiré sans réponse."""
    coordonnees = Coordonnees.load()
    logo = _piece_jointe_logo(coordonnees)
    destinataire = settings.CONTACT_NOTIFICATION_EMAIL or settings.REPLY_TO_SOUMISSION
    corps = (
        f'<p>La soumission <strong>{document.numero}</strong> pour <strong>{document.client.nom_entreprise}</strong> '
        f'({document.total}&nbsp;$) a expir&eacute; le {_date_fr(document.date_echeance)} sans r&eacute;ponse '
        f'du client.</p>'
        f'<p>Tu peux le contacter ({document.client.courriel}), ou prolonger la date d&rsquo;&eacute;ch&eacute;ance '
        f'et renvoyer la soumission depuis le tableau de bord.</p>'
    )
    payload = {
        'from': settings.RESEND_FROM_SOUMISSION,
        'to': [destinataire],
        'reply_to': settings.REPLY_TO_SOUMISSION,
        'subject': f'Soumission expirée sans réponse — {document.numero} ({document.client.nom_entreprise})',
        'html': _gabarit_html(f'Soumission expirée — {document.numero}', corps, coordonnees, logo),
    }
    if logo:
        payload['attachments'] = [logo]
    _client().Emails.send(payload)


def envoyer_rappel_versement_a_venir(document, versements):
    """
    Rappel au client quelques jours AVANT un versement : `versements` = [{date, montant}]
    (montant = ce qu'il reste à payer sur ce versement, si déjà payé en partie).
    """
    coordonnees = Coordonnees.load()
    logo = _piece_jointe_logo(coordonnees)
    premier = versements[0]
    cellule = 'padding:6px 8px;border-bottom:1px solid #eee;'
    lignes = ''.join(
        f'<tr><td style="{cellule}">{_date_fr(v["date"])}</td>'
        f'<td style="{cellule}text-align:right;font-weight:bold;">{v["montant"]}&nbsp;$</td></tr>'
        for v in versements
    )
    corps = (
        f'<p>Bonjour {document.client.nom_entreprise},</p>'
        f'<p>Petit rappel amical&nbsp;: un versement de <strong>{premier["montant"]}&nbsp;$</strong> est pr&eacute;vu '
        f'le <strong>{_date_fr(premier["date"])}</strong> pour la facture <strong>{document.numero}</strong>.</p>'
        + (
            f'<table role="presentation" cellpadding="0" cellspacing="0" '
            f'style="width:100%;font-size:13px;border-collapse:collapse;margin-top:8px;">{lignes}</table>'
            if len(versements) > 1 else ''
        )
        + f'{_resume_solde_html(document)}'
        f'<p style="margin-top:20px;">Paiement par virement Interac&nbsp;: {coordonnees.courriel}</p>'
        f'<p>Si votre paiement est d&eacute;j&agrave; envoy&eacute;, merci de ne pas tenir compte de ce message.</p>'
    )
    sujet = f'Rappel : versement prévu le {_date_fr(premier["date"])} — {document.numero}'
    payload = {
        'from': settings.RESEND_FROM_FACTURE,
        'to': [document.client.courriel],
        'reply_to': settings.REPLY_TO_FACTURE,
        'subject': sujet,
        'html': _gabarit_html(sujet, corps, coordonnees, logo),
    }
    if logo:
        payload['attachments'] = [logo]
    _client().Emails.send(payload)


def envoyer_document(document):
    coordonnees = Coordonnees.load()
    logo = _piece_jointe_logo(coordonnees)
    pdf_bytes = generer_pdf_document(document)
    type_label = 'Facture' if document.type_document == 'facture' else 'Soumission'
    est_facture = document.type_document == 'facture'
    from_email = settings.RESEND_FROM_FACTURE if est_facture else settings.RESEND_FROM_SOUMISSION
    reply_to = settings.REPLY_TO_FACTURE if est_facture else settings.REPLY_TO_SOUMISSION

    lien_signature_html = ''
    if not est_facture:
        lien = f'{settings.SITE_URL}/soumission/{document.token}/'
        lien_signature_html = (
            f'<p style="margin-top:20px;">Consultez le d&eacute;tail de la soumission, ou acceptez/refusez-la '
            f'directement ci-dessous&nbsp;:</p>'
            f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;">'
            f'<tr>'
            f'<td style="background:#16a34a;border-radius:8px;">'
            f'<a href="{lien}?reponse=accepter" style="display:inline-block;padding:12px 20px;color:#fff;'
            f'font-weight:bold;font-size:14px;text-decoration:none;">Accepter la soumission</a>'
            f'</td>'
            f'<td style="width:12px;"></td>'
            f'<td style="border:1px solid #ccc;border-radius:8px;">'
            f'<a href="{lien}?reponse=refuser" style="display:inline-block;padding:12px 18px;color:#555;'
            f'font-weight:bold;font-size:14px;text-decoration:none;">Refuser la soumission</a>'
            f'</td>'
            f'</tr></table>'
            f'<p style="margin-top:8px;font-size:12px;color:#888;">Ces liens vous am&egrave;nent &agrave; la page '
            f'de la soumission — l&rsquo;acceptation devient alors votre contrat officiel, et aucune '
            f'r&eacute;ponse n&rsquo;est enregistr&eacute;e sans votre confirmation explicite sur la page.</p>'
        )

    # Précise sans ambiguïté, sur une facture d'acompte ou de solde, à quelle soumission
    # acceptée elle se rattache — évite qu'un client se demande pourquoi il reçoit une
    # facture qu'il n'a pas explicitement redemandée.
    paiement_info_html = ''
    sous_titre = None
    if est_facture and document.type_paiement in ('acompte', 'solde') and document.contrat_lie:
        soumission_numero = document.contrat_lie.soumission.numero
        if document.type_paiement == 'acompte':
            sous_titre = 'Acompte'
            paiement_info_html = (
                f'<p style="margin-top:16px;">Cette facture est due pour la soumission '
                f'<strong>{soumission_numero}</strong> que vous avez accept&eacute;e — il s&rsquo;agit de '
                f'l&rsquo;<strong>acompte</strong> exigible &agrave; la signature.</p>'
            )
        else:
            sous_titre = 'Solde'
            paiement_info_html = (
                f'<p style="margin-top:16px;">Cette facture est due pour la soumission '
                f'<strong>{soumission_numero}</strong> que vous avez accept&eacute;e — il s&rsquo;agit du '
                f'<strong>solde</strong> exigible &agrave; la livraison, l&rsquo;acompte ayant d&eacute;j&agrave; '
                f'&eacute;t&eacute; factur&eacute;.</p>'
            )

    abonnement_saas_html = ''
    if document.categorie == 'abonnement_saas':
        abonnement_saas_html = (
            f'<p style="margin-top:8px;">Il s&rsquo;agit de votre abonnement logiciel '
            f'<strong>ExtincPro</strong>.</p>'
        )

    # Facture déjà en partie payée, ou payable en plusieurs versements : le client voit tout
    # de suite ce qu'il reste à payer et quand.
    solde_html = ''
    if est_facture:
        if document.montant_paye > 0:
            solde_html += _resume_solde_html(document)
        solde_html += _plan_paiement_html(document)
    else:
        solde_html = _plan_propose_html(document)

    corps = (
        f'<p>Bonjour {document.client.nom_entreprise},</p>'
        f'<p>Veuillez trouver ci-joint votre {type_label.lower()} n&deg; {document.numero}.</p>'
        f'{abonnement_saas_html}'
        f'{paiement_info_html}'
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">'
        f'<tr><td style="background:{ACCENT};border-radius:8px;padding:12px 20px;">'
        f'<span style="color:#fff;font-weight:bold;font-size:16px;">Total&nbsp;: {document.total}&nbsp;$</span>'
        f'</td></tr></table>'
        f'{solde_html}'
        f'{lien_signature_html}'
    )

    sujet = f'{type_label} ({sous_titre}) {document.numero}' if sous_titre else f'{type_label} {document.numero}'

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
        'subject': sujet,
        'html': _gabarit_html(sujet, corps, coordonnees, logo),
        'attachments': attachments,
    })


def envoyer_contrat_signe(contrat):
    """Transmet le contrat signé au client et au propriétaire — chacun reçoit la même preuve."""
    coordonnees = Coordonnees.load()
    logo = _piece_jointe_logo(coordonnees)
    contrat.pdf.open('rb')
    try:
        pdf_bytes = contrat.pdf.read()
    finally:
        contrat.pdf.close()

    corps = (
        f'<p>Bonjour {contrat.nom_signataire},</p>'
        f'<p>Merci ! Votre acceptation de la soumission {contrat.soumission.numero} a &eacute;t&eacute; '
        f'enregistr&eacute;e — ce document devient votre contrat officiel. Vous le trouverez ci-joint.</p>'
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">'
        f'<tr><td style="background:{ACCENT};border-radius:8px;padding:12px 20px;">'
        f'<span style="color:#fff;font-weight:bold;font-size:16px;">Total&nbsp;: {contrat.total}&nbsp;$</span>'
        f'</td></tr></table>'
    )

    attachments = [{
        'filename': f'Soumission_{contrat.soumission.numero}.pdf',
        'content': base64.b64encode(pdf_bytes).decode('ascii'),
    }]
    if logo:
        attachments.append(logo)

    destinataires = [contrat.courriel_signataire]
    if settings.CONTACT_NOTIFICATION_EMAIL and settings.CONTACT_NOTIFICATION_EMAIL not in destinataires:
        destinataires.append(settings.CONTACT_NOTIFICATION_EMAIL)

    _client().Emails.send({
        'from': settings.RESEND_FROM_SOUMISSION,
        'to': destinataires,
        'reply_to': settings.REPLY_TO_SOUMISSION,
        'subject': f'Soumission acceptée {contrat.soumission.numero} — {contrat.client_nom}',
        'html': _gabarit_html(f'Soumission acceptée {contrat.soumission.numero}', corps, coordonnees, logo),
        'attachments': attachments,
    })


def envoyer_rapport_comptable(pdf_bytes, excel_bytes, annee, trimestre):
    coordonnees = Coordonnees.load()
    logo = _piece_jointe_logo(coordonnees)

    corps = (
        f'<p>Bonjour,</p>'
        f'<p>Veuillez trouver ci-joint le rapport comptable du trimestre '
        f'<strong>T{trimestre} {annee}</strong> (ventes, d&eacute;penses, sommaire des taxes et pi&egrave;ces '
        f'justificatives), en format PDF et Excel.</p>'
    )

    attachments = [
        {
            'filename': f'Rapport-comptable-T{trimestre}-{annee}.pdf',
            'content': base64.b64encode(pdf_bytes).decode('ascii'),
        },
        {
            'filename': f'Rapport-comptable-T{trimestre}-{annee}.xlsx',
            'content': base64.b64encode(excel_bytes).decode('ascii'),
        },
    ]
    if logo:
        attachments.append(logo)

    _client().Emails.send({
        'from': settings.RESEND_FROM_FACTURE,
        'to': [coordonnees.courriel_comptable],
        'reply_to': settings.REPLY_TO_FACTURE,
        'subject': f'Rapport comptable T{trimestre} {annee} — {coordonnees.nom_entreprise}',
        'html': _gabarit_html(f'Rapport comptable T{trimestre} {annee}', corps, coordonnees, logo),
        'attachments': attachments,
    })
