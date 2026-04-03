package org.terium.lutrin

import fi.iki.elonen.NanoHTTPD
import java.io.IOException
import java.io.InputStream
import java.io.ByteArrayOutputStream
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.util.Log
import java.util.concurrent.atomic.AtomicReference
import android.graphics.Bitmap
import java.nio.ByteBuffer
import java.lang.Integer.min
import org.terium.lutrin.AppConstants.RGBA_FORMAT_CODE // Import de la constante

private const val PORT = 8080
private const val TAG = "MyWebServer"
private const val BOUNDARY = "frameboundary"

class MyWebServer : NanoHTTPD(PORT) {

    private val currentJpegFrame = AtomicReference<ByteArray?>(null)
    private val frameSync = Object()
    private val activeStreams = mutableMapOf<Thread, MjpegStreamer>()

    // --- GESTION YUV ET RGBA vers JPEG ---
    /**
     * Reçoit les données brutes (YUV, RGBA ou JPEG), les convertit en JPEG, et notifie le thread de streaming.
     */
    fun updateFrame(data: ByteArray, width: Int, height: Int, imageFormat: Int) {
        // La structure 'when' sélectionne la méthode de conversion appropriée
        val jpeg = when (imageFormat) {
            ImageFormat.JPEG -> data // Cas 1: Déjà JPEG (ex: MJPEG direct)
            // L'accès à RGBA_FORMAT_CODE est maintenant garanti d'être le même que dans le Fragment
            RGBA_FORMAT_CODE -> convertRgbaToJpeg(data, width, height) // Cas 2: Format RGBA (notre code personnalisé 30)
            else -> convertYuvToJpeg(data, width, height, imageFormat) // Cas 3: Format YUV (ex: NV21, YUYV)
        }

        if (jpeg != null) {
            currentJpegFrame.set(jpeg)

            // Notifie tous les threads de streaming en attente qu'une nouvelle image est disponible
            synchronized(frameSync) {
                frameSync.notifyAll()
            }
        }
    }

    // --- CONVERSION RGBA -> JPEG (via Bitmap) ---
    private fun convertRgbaToJpeg(rgbaData: ByteArray, width: Int, height: Int): ByteArray? {
        try {
            val expectedSize = width * height * 4

            // 1. Vérifie si le tampon est trop petit.
            if (rgbaData.size < expectedSize) {
                Log.e(TAG, "Taille RGBA/ARGB trop petite: attendu $expectedSize, reçu ${rgbaData.size}")
                return null
            }

            // 2. Si le tampon est plus grand, nous loguons un avertissement mais continuons.
            if (rgbaData.size > expectedSize) {
                Log.w(TAG, "Taille RGBA/ARGB plus grande que prévue. Ignorer ${rgbaData.size - expectedSize} octets de bourrage/en-tête.")
            }

            // Crée un Bitmap en ARGB_8888 (le format 32 bits le plus couramment utilisé par Android)
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)

            // Copie SEULEMENT la partie des pixels (expectedSize) dans le ByteBuffer du Bitmap.
            // On ignore ainsi les octets supplémentaires à la fin.
            val buffer = ByteBuffer.wrap(rgbaData, 0, expectedSize)
            bitmap.copyPixelsFromBuffer(buffer)

            // Compresser le Bitmap en JPEG
            val baos = ByteArrayOutputStream()
            // Qualité de compression de 80%
            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, baos)

            // Nettoyage: libère la mémoire occupée par le Bitmap
            bitmap.recycle()

            return baos.toByteArray()
        } catch (e: Exception) {
            Log.e(TAG, "Erreur de conversion RGBA vers JPEG: ${e.message}")
            return null
        }
    }


    // --- CONVERSION YUV -> JPEG (méthode existante, utilise YuvImage) ---
    private fun convertYuvToJpeg(yuvData: ByteArray, width: Int, height: Int, imageFormat: Int): ByteArray? {
        if (imageFormat == ImageFormat.UNKNOWN || yuvData.isEmpty()) return null

        try {
            // YuvImage est la classe standard d'Android pour convertir les formats YUV en JPEG
            val yuvImage = YuvImage(yuvData, imageFormat, width, height, null)
            val baos = ByteArrayOutputStream()

            // Compression
            yuvImage.compressToJpeg(Rect(0, 0, width, height), 80, baos)
            return baos.toByteArray()

        } catch (e: Exception) {
            // C'est souvent ici que les bugs d'alignement/format YUV se manifestent
            Log.e(TAG, "Erreur de conversion YUV vers JPEG (Format: $imageFormat, W:$width, H:$height): ${e.message}")
            return null
        }
    }

    init {
        // Laissez init vide ou ajoutez une logique d'initialisation si nécessaire
    }

    fun startServer() {
        try {
            start(SOCKET_READ_TIMEOUT, false)
            Log.i(TAG, "Serveur MJPEG démarré sur http://127.0.0.1:$PORT/")
        } catch (e: IOException) {
            Log.e(TAG, "ERREUR: Impossible de démarrer le serveur MJPEG sur le port $PORT.", e)
        }
    }

    override fun serve(session: IHTTPSession): Response {         // Gérer les requêtes pre-flight CORS (OPTIONS)
        if (Method.OPTIONS == session.method) {
            val response = newFixedLengthResponse(Response.Status.OK, MIME_PLAINTEXT, null, 0)
            response.addHeader("Access-Control-Allow-Origin", "https://lutrin.terium.org")
            response.addHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
            response.addHeader("Access-Control-Allow-Headers", "Content-Type")
            return response
        }

        return when (session.uri.lowercase()) {
            "/stream.mjpeg" -> serveMjpegStream()
            else -> serveHtmlPage()
        }
    }

    private fun serveMjpegStream(): Response {
        val mimeType = "multipart/x-mixed-replace; boundary=$BOUNDARY"

        val streamer = MjpegStreamer()

        activeStreams[streamer.streamThread] = streamer

        val response = newChunkedResponse(Response.Status.OK, mimeType, streamer)

        response.addHeader("Access-Control-Allow-Origin", "https://lutrin.terium.org")
        response.addHeader("Cache-Control", "no-store, no-cache, must-revalidate, pre-check=0, post-check=0, max-age=0")
        response.addHeader("Pragma", "no-cache")
        response.addHeader("Connection", "Keep-Alive")
        response.addHeader("Expires", "0")

        Log.d(TAG, "Nouveau client connecté à /stream.mjpeg")

        return response
    }

    private fun serveHtmlPage(): Response {
        val html = """
            <html>
                <head>
                    <title>Flux Vidéo Caméra UVC</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { 
                            margin: 0; 
                            padding: 0; 
                            background-color: #1f2937; 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            min-height: 100vh;
                        }
                        img { 
                            max-width: 90vw; 
                            max-height: 90vh; 
                            width: auto;
                            height: auto;
                            border: 8px solid #3b82f6; 
                            border-radius: 12px;
                            box-shadow: 0 10px 15px rgba(0, 0, 0, 0.5);
                        }
                    </style>
                </head>
                <body>
                    <!-- L'URL de la source est relative au serveur -->
                    <img src="/stream.mjpeg" alt="Flux vidéo en direct.">
                </body>
            </html>
        """.trimIndent()

        return newFixedLengthResponse(Response.Status.OK, "text/html", html)
    }

    // --- CLASSE DE FLUX MJPEG INTERNE (CORRIGÉE) ---
    private inner class MjpegStreamer : InputStream() {

        @Volatile var isRunning = true
        // Remplacer l'OutputStream par un AtomicReference pour le buffer de la frame complète
        // Ce buffer contiendra l'intégralité de la frame MJPEG (Header + JPEG + Boundary)
        private val frameBuffer = AtomicReference<ByteArray?>(null)
        private var readIndex: Int = 0

        // Nouvelle référence pour la synchronisation entre écriture et lecture de la frame
        private val readWriteLock = Object()

        val streamThread: Thread = Thread {
            Log.d(TAG, "Streamer thread pour un client démarré.")
            try {

                while (isRunning) {
                    var jpeg: ByteArray?

                    // 1. Attendre qu'une nouvelle frame JPEG soit disponible globalement
                    synchronized(frameSync) {
                        // Attendre la notification de updateYUVFrame
                        frameSync.wait(500L)
                        jpeg = currentJpegFrame.get()
                    }

                    if (jpeg != null) {
                        // 2. Construire la frame complète (Header + JPEG + Boundary)
                        val baos = ByteArrayOutputStream()
                        val header = ("--$BOUNDARY\r\n" +
                                "Content-Type: image/jpeg\r\n" +
                                "Content-Length: ${jpeg.size}\r\n\r\n").toByteArray(Charsets.US_ASCII)
                        val trailer = "\r\n".toByteArray(Charsets.US_ASCII)

                        baos.write(header)
                        baos.write(jpeg)
                        baos.write(trailer)

                        val completeFrame = baos.toByteArray()

                        // 3. Synchroniser pour mettre à jour le buffer (thread-safe)
                        synchronized(readWriteLock) {
                            if (frameBuffer.get() != null) {
                                Log.w(TAG, "Client trop lent. Remplacement de l'ancienne frame. Index lu: $readIndex")
                            }

                            frameBuffer.set(completeFrame)
                            readIndex = 0 // Réinitialise l'index de lecture
                            readWriteLock.notifyAll() // Notifie le thread de lecture (NanoHTTPD) qu'une nouvelle frame est prête
                        }
                    }
                }
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
            } catch (e: IOException) {
                Log.w(TAG, "Client déconnecté (IOException dans le thread de streaming).", e)
            } catch (e: Exception) {
                Log.e(TAG, "Erreur inconnue dans le thread de streaming.", e)
            } finally {
                isRunning = false
                // Note: La fermeture de baos n'est plus nécessaire ici car il est local
                activeStreams.remove(Thread.currentThread())
                Log.d(TAG, "Thread de streaming MJPEG arrêté.")
            }
        }

        init {
            streamThread.start()
        }

        override fun read(): Int {
            return -1
        }

        // Cette méthode est appelée par NanoHTTPD pour lire les données du flux
        override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
            if (!isRunning) return -1

            synchronized(readWriteLock) {
                var currentBuffer = frameBuffer.get()

                // Attendre qu'un buffer de frame soit disponible (écrit par streamThread)
                while (isRunning && currentBuffer == null) {
                    try {
                        readWriteLock.wait(100L) // Attend qu'une frame soit écrite
                        currentBuffer = frameBuffer.get()
                    } catch (e: InterruptedException) {
                        Thread.currentThread().interrupt()
                        isRunning = false
                        return -1
                    }
                }

                if (!isRunning || currentBuffer == null) return -1

                // 1. Calculer les octets disponibles à lire dans cette frame
                val remainingBytes = currentBuffer.size - readIndex
                if (remainingBytes <= 0) {
                    // Normal: la frame est entièrement lue (devrait déjà être null, mais sécurité)
                    frameBuffer.set(null)
                    readIndex = 0
                    // On retourne 0, NanoHTTPD rappellera read() pour le prochain chunk
                    return 0
                }

                // 2. Calculer combien d'octets seront copiés
                val bytesToCopy = min(length, remainingBytes)

                // 3. Copier les données
                System.arraycopy(currentBuffer, readIndex, buffer, offset, bytesToCopy)

                // 4. Mettre à jour l'index de lecture
                readIndex += bytesToCopy

                // 5. Si la frame est maintenant entièrement lue, la marquer comme null pour que streamThread écrive la suivante
                if (readIndex >= currentBuffer.size) {
                    frameBuffer.set(null)
                    readIndex = 0
                }

                return bytesToCopy
            }
        }

        override fun close() {
            isRunning = false
            streamThread.interrupt()
            synchronized(readWriteLock) {
                readWriteLock.notifyAll() // Réveille les threads en attente pour qu'ils puissent fermer
            }
            super.close()
        }
    }

    /**
     * Arrête le serveur HTTP et ferme tous les threads de streaming actifs.
     */
    fun stopServer() {
        synchronized(activeStreams) {
            val streamers = activeStreams.values.toList()
            for (streamer in streamers) {
                streamer.close()
            }
            activeStreams.clear()
        }

        stop()
        Log.i(TAG, "Serveur MJPEG arrêté.")
    }
}