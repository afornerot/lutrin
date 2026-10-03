package org.terium.lutrin.auto.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.Color
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

    // Réessai de connexion au service audio (utilisé si l'app démarre déconnectée)
    var audioError by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        if (!PlaybackController.state.value.isConnected) {
            val ok = kotlinx.coroutines.withTimeoutOrNull(15_000L) {
                PlaybackController.connect(context)
            } == true
            audioError = !ok
        }
    }

    LaunchedEffect(bookId) {
        val b = dao.getById(bookId)
        if (b == null) {
            // Livre supprimé / id obsolète : on repart à la bibliothèque
            onBack(); return@LaunchedEffect
        }
        book = b
        // Chapitres depuis la table chapters (IO) — filtre aligné sur le service
        chapters = dao.getChapters(bookId).filter { it.trim().length >= 2 }
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
                ui = ui,
                onBack = { PlaybackController.skip(-1) },
                onForward = { PlaybackController.skip(1) },
                onPlayPause = { PlaybackController.playPause() },
                onNavigate = { chapter, inChapter ->
                    if (ui.playingBookId == bookId && chapter == ui.chapterIndex) {
                        PlaybackController.seekToFraction(inChapter)
                    } else {
                        PlaybackController.setBook(bookId, chapter)
                    }
                }
            )
        }
    ) { pad ->
        Column(
            Modifier.padding(pad).fillMaxSize()
        ) {
            if (ui.lastError != null && ui.playingBookId == bookId) {
                Text(
                    ui.lastError!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                )
            }
            if (audioError && !ui.isConnected) {
                Text(
                    "Service audio indisponible — si ça persiste : Paramètres → Apps → Lutrin Auto → Effacer les données.",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(12.dp)
                )
            }

            // Zone de lecture : couverture à gauche, tous les chapitres à droite,
            // celui en cours surligné + auto-défilement dessus.
            val listState = androidx.compose.foundation.lazy.rememberLazyListState()
            LaunchedEffect(displayedChapter) {
                if (chapters.isNotEmpty()) {
                    listState.animateScrollToItem(displayedChapter)
                }
            }
            Row(
                Modifier.fillMaxWidth().padding(16.dp).weight(1f),
                verticalAlignment = Alignment.Top
            ) {
                CoverImage(book!!.coverDataUrl, 132.dp)
                Spacer(Modifier.width(16.dp))
                LazyColumn(
                    state = listState,
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    itemsIndexed(chapters) { index, text ->
                        val isCurrent = index == displayedChapter
                        // Police grossie (2×) ; chapitre courant = fond bleu translucide
                        // + texte BLANC en gras (lisible sur brun-beige/blue)
                        Text(
                            text,
                            fontSize = 28.sp,
                            lineHeight = 38.sp,
                            fontWeight = if (isCurrent) androidx.compose.ui.text.font.FontWeight.Bold else null,
                            color = if (isCurrent) Color.White
                                    else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                            modifier = Modifier
                                .fillMaxWidth()
                                .then(
                                    if (isCurrent) Modifier.background(
                                        MaterialTheme.colorScheme.primary.copy(alpha = 0.35f),
                                        androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
                                    ) else Modifier
                                )
                                .padding(if (isCurrent) 8.dp else 0.dp)
                        )
                    }
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
    onPlayPause: () -> Unit,
    onNavigate: (Int, Float) -> Unit  // (chapitre cible, fraction dans le chapitre)
) {
    val count = ui.chapterCount

    // Position globale = (chapitre courant + frac du chapitre) / nb chapitres
    val globalFraction: Float = if (count <= 0) 0f else {
        val chapterFrac = if (ui.durationMs > 0) ui.positionMs.toFloat() / ui.durationMs else 0f
        (ui.chapterIndex + chapterFrac) / count
    }.let { it.coerceIn(0f, 0.9999f) }

    Column(
        Modifier
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .navigationBarsPadding()
            .imePadding()
    ) {
        if (count > 0) {
            var sliderValue by remember { mutableFloatStateOf(globalFraction) }
            var dragging by remember { mutableStateOf(false) }

            // suit la lecture tant qu'on ne manipule pas le curseur
            if (!dragging) sliderValue = globalFraction

            Slider(
                value = sliderValue,
                onValueChange = { sliderValue = it; dragging = true },
                onValueChangeFinished = {
                    dragging = false
                    val target = sliderValue * count
                    val chapter = target.toInt().coerceIn(0, count - 1)
                    val inChapter = target - chapter
                    onNavigate(chapter, inChapter)
                },
                modifier = Modifier.fillMaxWidth()
            )
        }

        Row(
            Modifier.fillMaxWidth().padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onBack) { Text("◀ Préc") }
            Button(onClick = onPlayPause) { Text(if (ui.isPlaying) "Pause" else "Lecture") }
            TextButton(onClick = onForward) { Text("Suiv ▶") }
        }
    }
}
