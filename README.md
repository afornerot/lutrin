# Variables d'environnement

Ce projet utilise plusieurs variables d'environnement pour configurer son comportement. Voici les variables disponibles et leur description :

## Variables obligatoires

- **GROQ_TOKEN** : Clé API pour accéder aux services Groq. Cette variable est nécessaire pour l'authentification et l'accès aux fonctionnalités de l'API.

## Variables de configuration

- **FRONT_URL** : URL de base pour l'interface utilisateur. Cette variable définit l'adresse à laquelle l'application frontend sera accessible.

- **COQUI_MODEL** : Modèle de synthèse vocale Coqui à utiliser. Cette variable spécifie le modèle de synthèse vocale qui sera utilisé pour la conversion texte-parole.

## Variables optionnelles (commentées)

- **COQUI_MODEL** (commenté) : Modèle alternatif de synthèse vocale Coqui. Cette variable est commentée par défaut et peut être utilisée pour spécifier un modèle de synthèse vocale différent.

## Surcharge des variables

Pour surcharger ces variables, vous pouvez créer un fichier `.env.local` à la racine du projet. Dans ce fichier, vous pouvez définir les valeurs que vous souhaitez utiliser pour remplacer les valeurs par défaut. Par exemple :

```env
GROQ_TOKEN=votre_nouvelle_clé_api
FRONT_URL=https://votre_nouvelle_url
COQUI_MODEL=votre_nouveau_modèle
```

En utilisant un fichier `.env.local`, vous pouvez facilement personnaliser le comportement de l'application sans modifier les fichiers de configuration principaux.