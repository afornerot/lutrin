package org.terium.lutrin.auto.audio

import android.content.Context
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.terium.lutrin.auto.data.AppDatabase
import org.terium.lutrin.auto.data.BookEntity
import org.terium.lutrin.auto.data.SettingsStore
import org.terium.lutrin.auto.net.ApiClient
import java.io.File

/**
 * Service de lecture (ExoPlayer + MediaSession) — apparaît dans Android Auto
 * grâce à l'intent-filter MediaLibraryService + automotive_app_desc.xml.
 *
 * Un seul chapitre est chargé dans le player à la fois ; le chapitre suivant
 * est pré-généré pendant la lecture (l'API ne garde qu'un WAV à la fois).
 */
class PlaybackService : MediaLibraryService() {

    companion object {
        /** Chapitre stocké dans MediaMetadata.extras pour l'UI. */
        const val EXTRA_CHAPTER_INDEX = "chapter_index"
        const val EXTRA_CHAPTER_COUNT = "chapter_count"
        const val EXTRA_BOOK_TITLE = "book_title"

        // Commandes personnalisées (UI → service)
        const val CMD_SET_BOOK = "org.terium.lutrin.auto.SET_BOOK"
        const val CMD_SKIP = "org.terium.lutrin.auto.SKIP"
        const val CMD_GOTO = "org.terium.lutrin.auto.GOTO"

        // Libellé browse Android Auto
        private const val ROOT_ID = "lutrin_root"
        private const val BOOK_PREFIX = "book:"
        private const val TAG = "LutrinAuto"
    }

    private lateinit var player: ExoPlayer
    private var session: MediaLibrarySession? = null
    private lateinit var prefs: SettingsStore
    private val dao get() = AppDatabase.get(this).bookDao()

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private var book: BookEntity? = null
    private var chapters: List<String> = emptyList()
    private var currentChapter = 0
    private var pendingResumeMs = 0L

    // ------------------------------------------------------------------ cycle

    override fun onCreate() {
        super.onCreate()
        prefs = SettingsStore(this)
        player = ExoPlayer.Builder(this).build()
        player.addListener(PlayerSuccessListener())
        session = MediaLibrarySession.Builder(this, player, LibraryCallback())
            .build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? =
        session

    override fun onDestroy() {
        saveProgress()
        scope.cancel()
        player.release()
        session?.release()
        session = null
        super.onDestroy()
    }

    // ------------------------------------------------------------------- code

    private inner class PlayerSuccessListener : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            when (playbackState) {
                Player.STATE_READY -> {
                    if (pendingResumeMs > 0) {
                        player.seekTo(pendingResumeMs)
                        pendingResumeMs = 0
                    }
                    if (book != null) scope.launch { prefetchNext() }
                }
                Player.STATE_ENDED -> {
                    if (currentChapter < chapters.size - 1) gotoChapter(currentChapter + 1)
                }
                else -> {}
            }
        }
    }

    /** Joue un chapitre : génère le WAV si absent du cache puis charge dans le player.
     *  Les opérations (réseau, fichier, Room) tournent sur IO pour ne jamais bloquer
     *  le thread principal. */
    private suspend fun playChapter(index: Int, resumeMs: Long = 0L) {
        val b = book ?: return
        if (index !in chapters.indices) return
        currentChapter = index
        pendingResumeMs = resumeMs
        val playerRef = player
        try {
            val file = kotlinx.coroutines.withContext(Dispatchers.IO) { ensureChapterFile(index) }
            val item = buildChapterItem(b, index)
            playerRef.setMediaItem(item)
            playerRef.prepare()
            playerRef.play()
            org.terium.lutrin.auto.audio.PlaybackController.clearError()
        } catch (e: Exception) {
            android.util.Log.e(TAG, "playChapter($index) échoué", e)
            org.terium.lutrin.auto.audio.PlaybackController.reportError(
                "Chapitre ${index + 1} : ${e.message ?: e.javaClass.simpleName}"
            )
        }
    }

    /**
     * Fichier de chapitre mis en cache DANS un sous-dossier qui dépend des
     * réglages TTS (voix + vitesse) : changer un réglage invalide le cache et
     * régénère le chapitre avec les nouveaux paramètres dès la relecture.
     */
    private suspend fun chapterFile(index: Int): File {
        val st = prefs.current()
        val tag = "${st.piperVoice.ifBlank { "defaut" }}_x${st.lengthScale}"
        return File(cacheDir, "chapters/book_${book?.id ?: 0}/$tag/ch_$index.wav")
    }

    private suspend fun ensureChapterFile(index: Int): File {
        val file = chapterFile(index)
        if (file.exists() && file.length() > 0) return file
        return generateChapter(index)
    }

    private suspend fun buildChapterItem(b: BookEntity, index: Int): MediaItem {
        // Couverture du livre en artwork : visible dans le widget média Auto,
        // l'écran "lecture en cours" et les notifications.
        val artworkUri: android.net.Uri? = artworkFileFor(b)?.let { file ->
            try { android.net.Uri.parse(file.toURI().toString()) } catch (_: Exception) { null }
        }
        val metadata = MediaMetadata.Builder()
            .setTitle("Chapitre ${index + 1}/${chapters.size}")
            .setArtist(b.authors)
            .setAlbumTitle(b.title)
            .setArtworkUri(artworkUri)
            .setExtras(Bundle().apply {
                putInt(EXTRA_CHAPTER_INDEX, index)
                putInt(EXTRA_CHAPTER_COUNT, chapters.size)
                putString(EXTRA_BOOK_TITLE, b.title)
            })
            .build()
        return MediaItem.Builder()
            .setMediaId("chapter:$index")
            .setUri(chapterFile(index).toURI().toString())
            .setMediaMetadata(metadata)
            .build()
    }

    /** Cache de la couverture du livre : data URL base64 → JPEG fichier. */
    private fun artworkFileFor(b: BookEntity): File? {
        val dataUrl = b.coverDataUrl ?: return null
        val f = File(cacheDir, "chapters/book_${b.id}/cover.jpg")
        if (f.exists() && f.length() > 0) return f
        if (f.parentFile?.exists() != true) f.parentFile?.mkdirs()
        return try {
            val b64 = if ("," in dataUrl) dataUrl.substringAfter(',') else dataUrl
            val bytes = android.util.Base64.decode(
                b64, android.util.Base64.DEFAULT
            )
            // Re-encodage JPEG contrôlé : les data URLs serveur sont lossy/WebP variés
            val bmp = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            if (bmp != null) {
                f.outputStream().use { out -> bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, out) }
                bmp.recycle()
                f
            } else null
        } catch (e: Exception) {
            android.util.Log.w(TAG, "artwork indisponible pour le livre ${b.id}", e)
            null
        }
    }

    private suspend fun generateChapter(index: Int): File = kotlinx.coroutines.withContext(Dispatchers.IO) {
        val st = prefs.current()
        val payload = org.json.JSONObject().put("text", chapters[index])
        if (st.piperVoice.isNotBlank()) payload.put("piper_model_name", st.piperVoice)
        if (st.lengthScale != 1.0f) payload.put("length_scale", st.lengthScale.toDouble())

        val resp = ApiClient.postJson("/tts", payload)
        val audioUrl = resp.optString("audio_url")
        if (audioUrl.isBlank()) throw RuntimeException("audio_url absent")

        val dest = chapterFile(index)
        dest.parentFile?.mkdirs()
        ApiClient.downloadFile(audioUrl, dest)
        dest
    }

    /** Pré-génère le chapitre suivant en fond (pas d'attente à la fin du chapitre). */
    private suspend fun prefetchNext() {
        val next = currentChapter + 1
        if (next >= chapters.size) return
        val file = chapterFile(next)
        if (file.exists() && file.length() > 0) return
        runCatching { generateChapter(next) }
            .onFailure {
                android.util.Log.e(TAG, "pré-génération du chapitre $next échouée", it)
            }
    }

    /** Premier chapitre jouable à partir de `index` (les fragments trop courts
     *  rejetés par /tts sont sautés, comme le client web avec ses "silent"). */
    private fun firstPlayableIndex(tryFrom: Int): Int {
        for (i in tryFrom until chapters.size) {
            if (chapters[i].trim().length >= 2) return i
        }
        return -1
    }

    private fun gotoChapter(index: Int) {
        val target = firstPlayableIndex(index)
        if (target == -1) {
            android.util.Log.d(TAG, "plus de chapitre jouable dès $index — pas d'avance")
            return
        }
        android.util.Log.d(TAG, "gotoChapter($target)")
        scope.launch { playChapter(target) }
    }

    // ------------------------------------------------------------- progression

    private fun saveProgress() {
        val b = book ?: return
        val pos = if (player.playbackState == Player.STATE_ENDED) 0L else player.currentPosition
        scope.launch {
            dao.saveProgress(b.id, currentChapter, pos, System.currentTimeMillis())
        }
    }

    private fun saveLastBook(id: Long) {
        scope.launch { prefs.setLastBook(id) }
    }

    /** Tick de sauvegarde de progression pendant la lecture. */
    private fun startProgressTicker() {
        scope.launch {
            repeat(30) { _ -> // ~1 minute par tick batch
                delay(2000)
                if (player.isPlaying) saveProgress()
            }
        }
    }

    // ------------------------------------------------------------ commandes UI

    private fun handleSetBook(args: Bundle): Boolean {
        val id = args.getLong("bookId", -1L)
        if (id <= 0) return false
        val chapter = if (args.containsKey("chapterIndex")) args.getInt("chapterIndex", -1) else null
        android.util.Log.d(TAG, "setBook($id, chapter=$chapter)")
        scope.launch {
            try {
                val b = dao.getById(id)
                if (b == null) { android.util.Log.e(TAG, "livre $id introuvable"); return@launch }
                book = b
                // Chapitres depuis la table chapters (IO) — jamais le texte entier
                chapters = kotlinx.coroutines.withContext(Dispatchers.IO) { dao.getChapters(id) }
                    .filter { it.trim().length >= 2 } // chute les frags < 2c (500 côté /tts)
                android.util.Log.d(TAG, "livre '${b.title}' → ${chapters.size} chapitres")
                if (chapters.isEmpty()) return@launch
                val start = chapter?.takeIf { it in chapters.indices }
                    ?: b.lastChapter.coerceIn(chapters.indices)
                saveLastBook(b.id)
                playChapter(
                    start,
                    resumeMs = if (chapter == null && start == b.lastChapter) b.lastPositionMs else 0L
                )
            } catch (e: Exception) {
                android.util.Log.e(TAG, "setBook($id) échoué", e)
                org.terium.lutrin.auto.audio.PlaybackController.reportError(
                    "Livre : ${e.message ?: e.javaClass.simpleName}"
                )
            }
        }
        return true
    }

    private fun handleSkip(args: Bundle): Boolean {
        val delta = args.getInt("delta", 0)
        if (delta != 0 && chapters.isNotEmpty()) {
            gotoChapter((currentChapter + delta).coerceIn(chapters.indices))
            return true
        }
        android.util.Log.d(TAG, "skip ignoré (delta=$delta, chapitres=${chapters.size})")
        return false
    }

    private fun handleGoto(args: Bundle): Boolean {
        val index = args.getInt("chapterIndex", -1)
        if (index in chapters.indices) { gotoChapter(index); return true }
        android.util.Log.d(TAG, "goto ignoré ($index, chapitres=${chapters.size})")
        return false
    }

    // --------------------------------------------------------------- callbacks

    private inner class SessionCallback : MediaSession.Callback {

        val availableCommands = listOf(
            SessionCommand(CMD_SET_BOOK, Bundle.EMPTY),
            SessionCommand(CMD_SKIP, Bundle.EMPTY),
            SessionCommand(CMD_GOTO, Bundle.EMPTY)
        )

        override fun onConnect(
            session: MediaSession,
            controller: MediaSession.ControllerInfo
        ): MediaSession.ConnectionResult {
            val sessionCommands =
                MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
                    .add(SessionCommand(CMD_SET_BOOK, Bundle.EMPTY))
                    .add(SessionCommand(CMD_SKIP, Bundle.EMPTY))
                    .add(SessionCommand(CMD_GOTO, Bundle.EMPTY))
                    .build()
            return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                .setAvailableSessionCommands(sessionCommands)
                .build()
        }

        override fun onCustomCommand(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
            customCommand: SessionCommand,
            args: Bundle
        ): ListenableFuture<SessionResult> {
            when (customCommand.customAction) {
                CMD_SET_BOOK -> handleSetBook(args)
                CMD_SKIP -> handleSkip(args)
                CMD_GOTO -> handleGoto(args)
                else -> {}
            }
            return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
        }

        override fun onAddMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: List<MediaItem>
        ): ListenableFuture<List<MediaItem>> {
            // Ex: depuis Android Auto, un tap sur un livre de la browse view
            val first = mediaItems.firstOrNull()?.mediaId ?: return Futures.immediateFuture(emptyList())
            if (first.startsWith(BOOK_PREFIX)) {
                val id = first.removePrefix(BOOK_PREFIX).toLongOrNull() ?: -1L
                if (id > 0) {
                    handleSetBook(Bundle().apply { putLong("bookId", id) })
                    return Futures.immediateFuture(emptyList()) // le service gère la file lui-même
                }
            }
            return Futures.immediateFuture(emptyList())
        }
    }

    private inner class LibraryCallback : MediaLibrarySession.Callback {
        val sessionCallback = SessionCallback()

        override fun onConnect(
            session: MediaSession,
            controller: MediaSession.ControllerInfo
        ): MediaSession.ConnectionResult = sessionCallback.onConnect(session, controller)

        override fun onCustomCommand(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
            customCommand: SessionCommand,
            args: Bundle
        ): ListenableFuture<SessionResult> =
            sessionCallback.onCustomCommand(session, controller, customCommand, args)

        override fun onAddMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: List<MediaItem>
        ): ListenableFuture<List<MediaItem>> =
            sessionCallback.onAddMediaItems(mediaSession, controller, mediaItems)

        override fun onGetLibraryRoot(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            params: MediaLibraryService.LibraryParams?
        ): ListenableFuture<LibraryResult<MediaItem>> =
            Futures.immediateFuture(
                LibraryResult.ofItem(
                    MediaItem.Builder()
                        .setMediaId(ROOT_ID)
                        .setMediaMetadata(
                            MediaMetadata.Builder().setTitle("Lutrin").build()
                        )
                        .build(), params
                )
            )

        override fun onGetChildren(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            parentId: String,
            page: Int,
            pageSize: Int,
            params: MediaLibraryService.LibraryParams?
        ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
            if (parentId != ROOT_ID) {
                return Futures.immediateFuture(
                    LibraryResult.ofItemList(
                        ImmutableList.of(), params
                    )
                )
            }
            val books: List<BookEntity> = runBlocking { dao.getAllSnapshot() }
            val items: ImmutableList<MediaItem> = ImmutableList.copyOf(
                books.map { b ->
                    MediaItem.Builder()
                        .setMediaId(BOOK_PREFIX + b.id)
                        .setMediaMetadata(
                            MediaMetadata.Builder()
                                .setTitle(b.title)
                                .setArtist(b.authors)
                                .build()
                        )
                        .build()
                }
            )
            return Futures.immediateFuture(
                LibraryResult.ofItemList(items, params)
            )
        }
    }
}
