# lutrin_api/services/email_service.py
import smtplib
import subprocess
from email.message import EmailMessage
from urllib.parse import urlparse

from config import MAILER_DSN
from .logger_service import Log, Error, Success, Warning

def send_email(to_address, subject, body):
    """
    Envoie un e-mail en utilisant la configuration de MAILER_DSN.
    Gère les DSN 'smtp://', 'smtps://' et 'sendmail://'.
    """
    try:
        dsn = urlparse(MAILER_DSN)
        msg = EmailMessage()
        msg['Subject'] = subject
        # Utilise l'email de l'utilisateur du DSN comme expéditeur, ou un fallback
        msg['From'] = dsn.username or 'noreply@lutrin.app'
        msg['To'] = to_address
        msg.set_content(body)

        if dsn.scheme in ['smtp', 'smtps']:
            Log(f"Envoi d'un e-mail via SMTP à {dsn.hostname}:{dsn.port or '(default)'}")
            
            smtp_class = smtplib.SMTP_SSL if dsn.scheme == 'smtps' else smtplib.SMTP
            host = dsn.hostname
            port = dsn.port or (465 if dsn.scheme == 'smtps' else 587)

            with smtp_class(host, port) as smtp_server:
                if dsn.scheme == 'smtp':
                    smtp_server.starttls() # Toujours sécuriser la connexion
                if dsn.username and dsn.password:
                    smtp_server.login(dsn.username, dsn.password)
                smtp_server.send_message(msg)
            
            Success(f"E-mail envoyé avec succès à {to_address} via SMTP.")
            return True

        elif dsn.scheme == 'sendmail':
            Log("Envoi d'un e-mail via sendmail.")
            p = subprocess.Popen(["/usr/sbin/sendmail", "-t", "-oi"], stdin=subprocess.PIPE)
            p.communicate(msg.as_bytes())
            Success(f"E-mail transmis à sendmail pour {to_address}.")
            return True

        else:
            Warning(f"Le schéma DSN '{dsn.scheme}' n'est pas supporté. L'e-mail ne sera pas envoyé.")
            return False

    except Exception as e:
        Error(f"Échec de l'envoi de l'e-mail à {to_address}: {e}")
        return False