package org.terium.lutrin.auto.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Download
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
fun LibraryScreen(
    onOpenBook: (Long) -> Unit,
    onOpenSettings: () -> Unit,
    banner: String? = null
) {
    val context = LocalContext.current
    val dao = remember { AppDatabase.get(context).bookDao() }
    val books by dao.observeAll().collectAsState(initial = emptyList())

    var tab by remember { mutableStateOf(0) } // 0 = mes livres, 1 = bibliothèque serveur
    var busyLabel by remember { mutableStateOf<String?>(null) }
    var errorLabel by remember { mutableStateOf<String?>(null) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    // ---- Import EPUB (fichier <= /epub/add) ----
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            busyLabel = "Traitement de l'EPUB..."
            errorLabel = null
            scope.launch {
                runCatching { withContext(Dispatchers.IO) { addEpubFromUri(context, uri) } }
                    .onSuccess { id ->
                        busyLabel = null
                        if (id > 0) { tab = 0; onOpenBook(id) }
                    }
                    .onFailure {
                        busyLabel = null
                        errorLabel = "Import impossible : ${it.message}"
                    }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Lutrin Auto") },
                actions = {
                    IconButton(onClick = { launcher.launch("*/*") }) {
                        Icon(Icons.Outlined.Upload, contentDescription = "Importer un EPUB")
                    }
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Outlined.Settings, contentDescription = "Réglages")
                    }
                }
            )
        }
    ) { pad ->
        Column(Modifier.padding(pad)) {
            TabRow(selectedTabIndex = tab) {
                Tab(selected = tab == 0, onClick = { tab = 0 },
                    text = { Text("Mes livres (${books.size})") })
                Tab(selected = tab == 1, onClick = { tab = 1 },
                    text = { Text("Bibliothèque du serveur") })
            }
            if (banner != null) {
                Text(banner, color = MaterialTheme.colorScheme.tertiary, modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp))
            }
            if (busyLabel != null) {
                LinearProgressIndicator(Modifier.fillMaxWidth())
                Text(busyLabel!!, Modifier.padding(12.dp))
            }
            errorLabel?.let {
                Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(12.dp))
            }
            when (tab) {
                0 -> LocalBooksTab(books, onOpenBook)
                1 -> ServerLibraryTab(onImported = { id -> busyLabel = null; tab = 0; onOpenBook(id) },
                    setBusy = { busyLabel = it },
                    setError = { errorLabel = it })
            }
        }
    }
}

// ------------------------------------------------------------ mes livres

@Composable
fun LocalBooksTab(books: List<BookEntity>, onOpenBook: (Long) -> Unit) {
    if (books.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                "Aucun livre.\nTouche ↑ pour importer un EPUB\nou va dans « Bibliothèque du serveur ».",
                style = MaterialTheme.typography.bodyLarge
            )
        }
        return
    }
    LazyColumn(Modifier.fillMaxSize()) {
        items(books, key = { it.id }) { book ->
            BookRow(book) { onOpenBook(book.id) }
        }
    }
}

@Composable
fun BookRow(book: BookEntity, onClick: () -> Unit) {
    androidx.compose.foundation.layout.Row(
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
                val total = book.totalChapters
                Text(
                    "Chapitre ${minOf(book.lastChapter + 1, total)} / $total",
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}

// -------------------------------------------------- onglet serveur (library)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServerLibraryTab(
    onImported: (Long) -> Unit,
    setBusy: (String?) -> Unit,
    setError: (String?) -> Unit
) {
    val context = LocalContext.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var serverBooks by remember { mutableStateOf<List<ServerBook>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        setBusy("Chargement de la bibliothèque du serveur...")
        serverBooks = withContext(Dispatchers.IO) {
            runCatching { loadServerLibrary() }
                .onFailure { error = "Chargement impossible : ${it.message}" }
                .getOrDefault(emptyList())
        }
        setBusy(null)
    }

    error?.let {
        Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(12.dp))
    }
    if (!error.isNullOrBlank() && serverBooks.isEmpty()) return

    LazyColumn {
        items(serverBooks, key = { it.id }) { sb ->
            androidx.compose.material3.ListItem(
                headlineContent = { Text(sb.title) },
                supportingContent = if (sb.authors.isNotBlank()) {
                    { androidx.compose.material3.Text(sb.authors, style = androidx.compose.material3.MaterialTheme.typography.bodySmall) }
                } else null,
                leadingContent = { CoverImage(sb.coverDataUrl, 44.dp) },
                trailingContent = {
                    androidx.compose.material3.IconButton(onClick = {
                        setBusy("Import « ${sb.title.take(24)} »...")
                        scope.launch {
                            runCatching { withContext(Dispatchers.IO) { importServerBook(context, sb.id) } }
                                .onSuccess { localId ->
                                    setBusy(null)
                                    onImported(localId)
                                }
                                .onFailure {
                                    setError("Import impossible : ${it.message}")
                                    setBusy(null)
                                }
                        }
                    } ) {
                        androidx.compose.material3.Icon(
                            androidx.compose.material.icons.Icons.Outlined.Download,
                            contentDescription = "Importer dans mes livres"
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

data class ServerBook(val id: Int, val title: String, val authors: String, val coverDataUrl: String?)

/** Liste les livres de la bibliothèque centrale : GET /library/list */
suspend fun loadServerLibrary(): List<ServerBook> = withContext(Dispatchers.IO) {
    val resp = ApiClient.getJson("/library/list")
    val arr = resp.getJSONArray("data")
    (0 until arr.length()).mapNotNull { i ->
        val item = arr.getJSONObject(i)
        val id = item.optInt("id", -1)
        if (id < 0) return@mapNotNull null
        val meta = item.optJSONObject("metadata") ?: org.json.JSONObject()
        val authors = meta.optJSONArray("authors")?.let { a ->
            (0 until a.length()).mapNotNull { a.optString(it, "").ifBlank { null } }.joinToString(", ")
        } ?: meta.optString("author", "")
        ServerBook(
            id = id,
            title = meta.optString("title", "Sans titre"),
            authors = authors,
            coverDataUrl = if (item.isNull("cover_image")) null else item.optString("cover_image")
        )
    }
}

/** Télécharge le livre complet (GET /library/get/<id>) et l'insère en Room. */
suspend fun importServerBook(context: android.content.Context, id: Int): Long =
    withContext(Dispatchers.IO) {
        val dao = AppDatabase.get(context).bookDao()
        val resp = ApiClient.getJson("/library/get/$id")
        val data = resp.getJSONObject("data")
        insertServerData(dao, data)
    }

private suspend fun insertServerData(dao: org.terium.lutrin.auto.data.BookDao, data: org.json.JSONObject): Long {
    val meta = data.optJSONObject("metadata") ?: org.json.JSONObject()
    val authors = meta.optJSONArray("authors")?.let { a ->
        (0 until a.length()).mapNotNull { a.optString(it, "").ifBlank { null } }.joinToString(", ")
    } ?: meta.optString("author", "")
    val fullText = data.optString("text", "")
    val chapters = BookEntity.chapters(fullText)
    if (chapters.isEmpty()) throw RuntimeException("livre sans texte côté serveur")
    val entity = BookEntity(
        title = meta.optString("title", "Sans titre"),
        authors = authors,
        description = meta.optString("description", ""),
        coverDataUrl = if (data.isNull("cover_image")) null else data.optString("cover_image"),
        language = meta.optString("language", null),
        uploadedAt = System.currentTimeMillis()
    )
    return dao.insertWithChapters(entity, chapters)
}

/** Upload un EPUB (POST /epub/add), stocke le livre extrait en Room, retourne son id. */
suspend fun addEpubFromUri(context: android.content.Context, uri: android.net.Uri): Long =
    withContext(Dispatchers.IO) {
        val dao = AppDatabase.get(context).bookDao()
        val tmp = File(context.cacheDir, "upload_${System.currentTimeMillis()}.epub")
        context.contentResolver.openInputStream(uri)?.use { input ->
            tmp.outputStream().use { input.copyTo(it) }
        } ?: throw RuntimeException("lecture du fichier impossible")

        val resp = ApiClient.uploadEpub("/epub/add", tmp)
        tmp.delete()

        val data = resp.getJSONObject("data")
        insertServerData(dao, data) // même format de réponse {metadata, cover_image, text}
    }
