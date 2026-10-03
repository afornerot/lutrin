package org.terium.lutrin.auto.audio

import android.content.ComponentName
import android.content.Context
import android.os.Bundle
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionToken
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Pont entre l'UI (MainActivity) et le PlaybackService via MediaController.
 * Draggable aussi bien par l'écran téléphone que par Android Auto (qui a son
 * propre controller géré par le système).
 */
object PlaybackController {

    private const val CMD_SET_BOOK = PlaybackService.CMD_SET_BOOK
    private const val CMD_SKIP = PlaybackService.CMD_SKIP
    private const val CMD_GOTO = PlaybackService.CMD_GOTO

    private var controller: MediaController? = null

    // ---- état observé par l'UI ----
    data class UiState(
        val isConnected: Boolean = false,
        val isBuffering: Boolean = false,
        val isPlaying: Boolean = false,
        val chapterIndex: Int = 0,
        val chapterCount: Int = 0,
        val positionMs: Long = 0,
        val durationMs: Long = 0,
        val bookTitle: String = "",
        val playingBookId: Long = -1
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) {
            publish(player)
        }
    }

    private fun publish(p: Player) {
        val extras = p.currentMediaItem?.mediaMetadata?.extras
        _state.value = UiState(
            isConnected = true,
            isBuffering = p.playbackState == Player.STATE_BUFFERING,
            isPlaying = p.isPlaying,
            chapterIndex = extras?.getInt(PlaybackService.EXTRA_CHAPTER_INDEX, 0) ?: 0,
            chapterCount = extras?.getInt(PlaybackService.EXTRA_CHAPTER_COUNT, 0) ?: 0,
            positionMs = p.currentPosition.coerceAtLeast(0),
            durationMs = if (p.duration > 0) p.duration else 0,
            bookTitle = extras?.getString(PlaybackService.EXTRA_BOOK_TITLE) ?: "",
            playingBookId = playingBookId
        )
    }

    @Volatile private var playingBookId: Long = -1

    suspend fun connect(context: Context): Boolean {
        if (controller != null) return true
        val token = SessionToken(
            context,
            ComponentName(context, PlaybackService::class.java)
        )
        val future = MediaController.Builder(context, token).buildAsync()
        return try {
            val c = future.get() as MediaController
            c.addListener(listener)
            controller = c
            publish(c)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun setBook(id: Long) {
        playingBookId = id
        send(CMD_SET_BOOK, Bundle().apply { putLong("bookId", id) })
    }

    fun skip(delta: Int) = send(CMD_SKIP, Bundle().apply { putInt("delta", delta) })

    fun goTo(index: Int) = send(CMD_GOTO, Bundle().apply { putInt("chapterIndex", index) })

    fun playPause() {
        controller?.let { if (it.isPlaying) it.pause() else it.play() }
    }

    fun seekToFraction(fraction: Float) {
        controller?.let {
            if (it.duration > 0) it.seekTo((it.duration * fraction).toLong())
        }
    }

    private fun send(action: String, args: Bundle) {
        controller?.sendCustomCommand(SessionCommand(action, Bundle.EMPTY), args)
    }
}
