package org.terium.lutrin.auto.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.terium.lutrin.auto.audio.PlaybackController
import org.terium.lutrin.auto.data.AppDatabase
import org.terium.lutrin.auto.data.BookEntity

/** Écran du livre : couverture, chapitres, contrôle de lecture. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookScreen(bookId: Long, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val dao = remember { AppDatabase.get(context).bookDao() }
    val ui by PlaybackController.state.collectAsState()

    var book by remember { mutableStateOf<BookEntity?>(null) }
    var chapters by remember { mutableStateOf<List<String>>(emptyList()) }

    LaunchedEffect(bookId) {
        book = dao.getById(bookId)
        if (book != null) chapters = BookEntity.chapters(book!!.fullText)
        if (PlaybackController.state.value.playingBookId != bookId) {
            PlaybackController.setBook(bookId)
        }
    }

    book ?: run {
        LoadingScreen(); return
    }

    // Le chapitre affiché = "où je suis dans l'écran" (peut différer du livre
    // actuellement joué si la lecture auto a avancé).
    val displayedChapter = if (ui.playingBookId == bookId) ui.chapterIndex else book!!.lastChapter

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(book!!.title, maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                }
            )
        },
        bottomBar = {
            PlayerBar(
                ui = ui, onBack = { PlaybackController.skip(-1) },
                onForward = { PlaybackController.skip(1) },
                onBack10 = { },
                onPlayPause = { PlaybackController.playPause() },
                onSeek = { PlaybackController.seekToFraction(it) }
            )
        }
    ) { pad ->
        Column(Modifier.padding(pad)) {
            // En-tête livre
            Row(
                Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                CoverImage(book!!.coverDataUrl, 72.dp)
                Spacer(Modifier.width(16.dp))
                Column {
                    Text(book!!.title, style = MaterialTheme.typography.titleLarge)
                    Text(book!!.authors, style = MaterialTheme.typography.bodyMedium)
                    Text(
                        "${chapters.size} chapitres",
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }

            HorizontalDivider()

            LazyColumn(Modifier.fillMaxSize()) {
                itemsIndexed(chapters) { index, text ->
                    val isCurrent = index == displayedChapter
                    ListItem(
                        modifier = Modifier.clickable {
                            if (ui.playingBookId != bookId) PlaybackController.setBook(bookId)
                            PlaybackController.goTo(index)
                        },
                        headlineContent = {
                            Column {
                                Text(
                                    "Chapitre ${index + 1}",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isCurrent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text.take(80),
                                    style = MaterialTheme.typography.bodySmall,
                                    maxLines = 1
                                )
                            }
                        },
                        supportingContent = {
                            if (isCurrent && ui.isBuffering) {
                                Text("Génération TTS...", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    )
                    HorizontalDivider(thickness = 0.5.dp)
                }
            }
        }
    }
}

@Composable
fun PlayerBar(
    ui: PlaybackController.UiState,
    onBack: () -> Unit,
    onForward: () -> Unit,
    onBack10: () -> Unit,
    onPlayPause: () -> Unit,
    onSeek: (Float) -> Unit
) {
    Column(Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) {
        if (ui.durationMs > 0) {
            var fraction by remember { mutableFloatStateOf(
                if (ui.durationMs > 0) ui.positionMs.toFloat() / ui.durationMs else 0f) }
            Slider(
                value = fraction.coerceIn(0f, 1f),
                onValueChange = { fraction = it; onSeek(it) },
                modifier = Modifier.fillMaxWidth()
            )
        }
        Row(
            Modifier.fillMaxWidth().padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onBack) { Text("◀ Chapitre") }
            FilledIconToggleButton(
                checked = ui.isPlaying,
                onCheckedChange = { onPlayPause() }
            ) { Text(if (ui.isPlaying) "Pause" else "Lecture") }
            TextButton(onClick = onForward) { Text("Chapitre ▶") }
        }
    }
}
