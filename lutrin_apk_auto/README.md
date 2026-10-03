# lutrin_apk_auto — App Android Auto

App Android Auto **à part** de `lutrin_apk` (qui reste une WebView intouchable).
Objectif : audioread des EPUB téléchargés dans la bibliothèque Lutrin, en voiture,
via le protocole Media (MediaLibraryService media3).

## Fonctionnalités (v1)
- Login → clé API (`POST /auth/login`, header `X-API-Key`)
- Import d'EPUB perso (`POST /epub/add` → texte extrait stocké en Room locale)
- Lecture par chapitre (découpage `\n\n` identique au client web)
- TTS **Piper uniquement** (v1) : voix sélectionnable (`GET /tts/piper-models`) +
  vitesse (`length_scale`) réglable dans Réglages
- Pré-génération du chapitre suivant pendant la lecture (limite "1 WAV/utilisateur")
- Progression locale (Room), reprise du livre en cours
- Android Auto : browse + play/pause/chapitres via MediaSession

## Build headless

Prérequis (installés sur la machine de dev, hors repo) :
- JDK 17 : `/home/ubuntu/tools/jdk-17.0.13+11`
- Android SDK : `/home/ubuntu/tools/android-sdk` (local.properties pointe dessus)
- Keystore release : `/home/ubuntu/tools/keystores/lutrin-auto.keystore`
  (alias `lutrin-auto`, mot de passe dans `lutrin-auto.keystore.pass`)

```bash
export JAVA_HOME=/home/ubuntu/tools/jdk-17.0.13+11
export ANDROID_HOME=/home/ubuntu/tools/android-sdk
export LUTRIN_KEYSTORE=/home/ubuntu/tools/keystores/lutrin-auto.keystore
export LUTRIN_KEYSTORE_PASSWORD=$(cat /home/ubuntu/tools/keystores/lutrin-auto.keystore.pass)
gradlew assembleRelease
```

APK : `app/build/outputs/apk/release/app-release.apk`

## Installation sur téléphone + Android Auto
1. Activer "installer via sources inconnues" pour le gestionnaire de fichiers
2. Installer l'APK
3. Dans l'app **Android Auto** du téléphone : la nouvelle app apparaît
   automatiquement (metadata `car.application`). Pour les APK hors Play Store :
   ⇒ dans Android Auto, activer le mode développeur (10 taps sur "Version") puis
   activer **"Sources inconnues"** dans les réglages développeur
4. Test sans voiture : Desktop Head Unit (DHU) de Google sur PC

## Anti-répéter les pièges connus
- L'image coqui Idiap ne bundle pas torch → image custom via `lutrin_coqui/Dockerfile`
- Cert self-hosté repo obsolète : le site public est derrière Let's Encrypt, l'app
  utilise la confiance système standard.
