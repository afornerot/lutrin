# lutrin_api/services/register_service.py
import secrets
import datetime
from datetime import timedelta
from . import register_db_service, user_db_service, email_service
from .logger_service import Log, Error, Success, Warning
from config import FRONT_URL, MAILER_DSN

def _send_magic_link_email(email, token):
    """Envoie un e-mail avec le lien magique."""
    magic_link_url = f"{FRONT_URL}/registervalidate?token={token}"
    subject = "Votre lien magique pour l'inscription à Lutrin"
    body = f"""
    Bonjour,

    Quelqu'un (espérons-le, vous !) a demandé à s'inscrire à Lutrin en utilisant cette adresse e-mail.
    Pour finaliser votre inscription, veuillez cliquer sur le lien ci-dessous :

    {magic_link_url}

    Ce lien est valide pendant 30 minutes.

    Si vous n'avez pas demandé cette inscription, veuillez ignorer cet e-mail.

    Cordialement,
    L'équipe Lutrin
    """
    return email_service.send_email(email, subject, body)

def request_register(username,email):
    """
    Gère la demande d'un lien magique pour l'inscription.
    """

    # Vérifier si l'e-mail est déjà enregistré
    if user_db_service.get_user_by_email(email):
        Warning(f"Tentative d'inscription avec un email déjà enregistré: {email}")
        return False, "Ce compte existe déjà."

    # Vérifier si le username est déjà enregistré
    if user_db_service.get_user_by_username(username):
        Warning(f"Tentative d'inscription avec ce login déjà enregistré: {username}")
        return False, "Ce compte existe déjà."
    
    # Générer un jeton unique et une date d'expiration
    token = secrets.token_urlsafe(32)
    expires_at = datetime.datetime.now() + timedelta(minutes=30)

    # Stocker la demande dans la base de données
    if not register_db_service.add_register(username, email, token, expires_at):
        Error(f"Échec de l'enregistrement de la demande d'inscription pour {email}.")
        return False, "Une erreur est survenue lors de la demande d'inscription."

    # Envoyer l'e-mail avec le lien magique
    if not _send_magic_link_email(email, token):
        Error(f"Échec de l'envoi de l'e-mail pour {email}.")
        register_db_service.delete_register(token)
        return False, "Une erreur est survenue lors de l'envoi du lien magique."

    Success(f"Demande de lien magique réussie pour {email}.")
    return True, "Un lien magique a été envoyé à votre adresse e-mail. Veuillez vérifier votre boîte de réception pour finaliser votre inscription."

def validate_register(token,password):
    """
    Valide un lien magique et finalise l'inscription.
    """

    register = register_db_service.get_register(token)

    if not register:
        Warning(f"Tentative de validation avec un jeton inexistant: {token}")
        return False, "Lien de validation invalide ou expiré."

    if datetime.datetime.now() > datetime.datetime.fromisoformat(register['expires_at']):
        Error(f"Tentative de validation avec un jeton expiré pour {register['email']}.")
        register_db_service.delete_register(token)
        return False, "Le lien de validation a expiré. Veuillez demander un nouveau lien."

    if not user_db_service.add_user(register['username'], password, register['email']):
        Error(f"Échec de la création de l'utilisateur pour {register['email']} après validation du lien.")
        return False, "Une erreur est survenue lors de la création de votre compte utilisateur."

    register_db_service.delete_register(token)

    Success(f"Inscription réussie et validée pour {register['email']}.")
    return True, "Votre inscription a été validée avec succès ! Vous pouvez maintenant vous connecter."