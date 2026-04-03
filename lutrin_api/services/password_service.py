# lutrin_api/services/passwords_service.py
import secrets
import datetime
from datetime import timedelta
from . import user_db_service, email_service
from .logger_service import Log, Error, Success, Warning
from config import FRONT_URL
from . import password_db_service


def request_password(email):
    """
    Gère une demande de réinitialisation de mot de passe.
    """

    user = user_db_service.get_user_by_email(email)
    if not user:
        Warning(f"Demande de reset pour un email inexistant: {email}")
        # On ne révèle pas que l'email n'existe pas.
        return True, "Si un compte est associé à cette adresse, un e-mail de réinitialisation a été envoyé."

    token = secrets.token_urlsafe(32)
    expires_at = datetime.datetime.now() + timedelta(minutes=30)

    if not password_db_service.add_password(email, token, expires_at):
        return False, "Une erreur est survenue lors de la demande."

    reset_url = f"{FRONT_URL}/passwordvalidate?token={token}"
    subject = "Réinitialisation de votre mot de passe Lutrin"
    body = f"Bonjour,\n\nPour réinitialiser votre mot de passe, veuillez cliquer sur le lien suivant:\n\n{reset_url}\n\nCe lien expirera dans 30 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail."
    
    email_service.send_email(email, subject, body)
    
    return True, "Si un compte est associé à cette adresse, un e-mail de réinitialisation a été envoyé."

def validate_password(token, new_password):
    """
    Valide le token et met à jour le mot de passe.
    """
    
    password = password_db_service.get_password(token)
    if not password or datetime.datetime.now() > datetime.datetime.fromisoformat(password['expires_at']):
        if password: password_db_service.delete_password(token)
        return False, "Le lien de réinitialisation est invalide ou a expiré."

    password_db_service.delete_password(token)

    if not user_db_service.update_user_password(password['email'], new_password):
        return False, "Une erreur est survenue lors de la mise à jour du mot de passe."

   
    return True, "Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter."