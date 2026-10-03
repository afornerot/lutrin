package org.terium.lutrin.auto.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import kotlinx.coroutines.flow.first
import org.terium.lutrin.auto.audio.PlaybackController
import org.terium.lutrin.auto.data.AppDatabase
import org.terium.lutrin.auto.data.SettingsStore

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MaterialTheme(
                // Palette de lutrin_client (assets/style.css)
                colorScheme = darkColorScheme(
                    primary = Color(0xFF3B82F6),          // boutons primaires
                    onPrimary = Color.White,
                    tertiary = Color(0xFF7EC8E3),         // liens
                    background = Color(0xFF73655C),       // --bg-main
                    surface = Color(0xFF3E3E3E),          // --bg-card
                    onBackground = Color.White,
                    onSurface = Color.White,
                    secondary = Color(0xFF4A4038),        // --bg-modal
                    error = Color(0xFFF87171)
                )
            ) {
                Root()
            }
        }
    }
}

/** Navigation maison : login → bibliothèque → livre / réglages. */
@Composable
fun Root() {
    val context = androidx.compose.ui.platform.LocalContext.current
    val prefs = remember { SettingsStore(context) }

    var screen by remember { mutableStateOf("loading") } // loading|login|library|book|settings
    var openBookId by remember { mutableStateOf(-1L) }
    var bootMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        // Trace du dernier crash (si l'app s'est fermée violemment)
        bootMessage = org.terium.lutrin.auto.CrashReporter.consume(context)
            ?.lineSequence()?.firstOrNull()?.let { "Dernier bug : $it" }
        // Boot infaillible : même si le service audio ne répond pas, on ouvre
        // la bibliothèque (l'app reste utilisable, un réessai est possible).
        val result = runCatching {
            val st = prefs.current()
            if (st.apiKey.isBlank()) {
                "login"
            } else {
                org.terium.lutrin.auto.net.ApiClient.configure(st.serverUrl, st.apiKey)
                val connected = kotlinx.coroutines.withTimeoutOrNull(15_000L) {
                    PlaybackController.connect(context)
                } == true
                // On NE rouvre pas auto le dernier livre : bibliothèque directe.
                if (!connected) "library" else "library"
            }
        }.getOrElse { "login" }
        screen = result
    }

    when (screen) {
        "loading" -> LoadingScreen()
        "login" -> LoginScreen(onSuccess = { screen = "library" })
        "library" -> LibraryScreen(
            onOpenBook = { id -> openBookId = id; screen = "book" },
            onOpenSettings = { screen = "settings" },
            banner = bootMessage
        )
        "book" -> BookScreen(bookId = openBookId, onBack = { screen = "library" })
        "settings" -> SettingsScreen(
            onBack = { screen = "library" },
            onLogout = { screen = "login" }
        )
    }
}

