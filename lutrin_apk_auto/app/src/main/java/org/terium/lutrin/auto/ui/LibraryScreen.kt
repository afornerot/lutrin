package org.terium.lutrin.auto.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Upload
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.terium.lutrin.auto.data.AppDatabase
import org.terium.lutrin.auto.data.BookEntity
import org.terium.lutrin.auto.net.ApiClient
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(onOpenBook: (Long) -> Unit, onOpenSettings: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val dao = remember { AppDatabase.get(context).bookDao() }
    val books by dao.observeAll().collectAsState(initial = emptyList())

    var busyLabel by remember { mutableStateOf<String?>(null) }

    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            busyLabel = "Upload de l'EPUB..."
            scope.launch {
                try {
                    val id = withContext(Dispatchers.IO) { addEpubFromUri(context, uri) }
                    busyLabel = null
                    if (id > 0) onOpenBook(id)
                } catch (e: Exception) {
                    busyLabel = "Erreur : ${e.message}"
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ma bibliothèque") },
                actions = {
                    IconButton(onClick = { launcher.launch("*/*") }) {
                        Icon(Icons.Outlined.Upload, contentDescription = "Ajouter un EPUB")
                    }
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Outlined.Settings, contentDescription = "Réglages")
                    }
                }
            )
        }
    ) { pad ->
        Column(Modifier.padding(pad)) {
            if (busyLabel != null) {
                LinearProgressIndicator(Modifier.fillMaxWidth())
                Text(busyLabel!!, Modifier.padding(12.dp))
            }
            if (books.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "Aucun livre.\nTouche ↑ pour importer un EPUB.",
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            } else {
                LazyColumn(Modifier.fillMaxSize()) {
                    items(books, key = { it.id }) { book ->
                        BookRow(book) { onOpenBook(book.id) }
                    }
                }
            }
        }
    }
}

@Composable
fun BookRow(book: BookEntity, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        CoverImage(book.coverDataUrl, 60.dp)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(book.title, style = MaterialTheme.typography.titleMedium)
            if (book.authors.isNotBlank()) {
                Text(book.authors, style = MaterialTheme.typography.bodySmall)
            }
            if (book.lastPlayedAt > 0) {
                val total = BookEntity.chapters(book.fullText).size
                Text(
                    "Chapitre ${minOf(book.lastChapter + 1, total)} / $total",
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}

/** Upload un EPUB à l'API, stocke le livre extrait en Room, retourne son id. */
suspend fun addEpubFromUri(context: android.content.Context, uri: android.net.Uri): Long {
    val dao = AppDatabase.get(context).bookDao()
    val tmp = File(context.cacheDir, "upload_${System.currentTimeMillis()}.epub")
    context.contentResolver.openInputStream(uri)?.use { input ->
        tmp.outputStream().use { input.copyTo(it) }
    } ?: throw RuntimeException("lecture impossible")

    val resp = ApiClient.uploadEpub("/epub/add", tmp)
    tmp.delete()

    val data = resp.getJSONObject("data")
    val meta = data.optJSONObject("metadata") ?: org.json.JSONObject()
    val authors = meta.optJSONArray("authors")?.let { a ->
        (0 until a.length()).mapNotNull { a.optString(it, "").ifBlank { null } }.joinToString(", ")
    } ?: meta.optString("author", "")
    val entity = BookEntity(
        title = meta.optString("title", "Titre inconnu").ifBlank { "Titre inconnu" },
        authors = authors,
        description = meta.optString("description", ""),
        coverDataUrl = if (data.isNull("cover_image")) null else data.optString("cover_image"),
        fullText = data.optString("text", ""),
        language = meta.optString("language", null),
        uploadedAt = System.currentTimeMillis()
    )
    if (entity.fullText.isBlank()) throw RuntimeException("EPUB vide (extraction)")
    return dao.insert(entity)
}
