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
import org.terium.lutrin.auto.data.SettingsStore

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF8A7BEA),
                    background = Color(0xFF12122A)
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

    LaunchedEffect(Unit) {
        val st = prefs.current()
        if (st.apiKey.isNotBlank()) {
            org.terium.lutrin.auto.net.ApiClient.configure(st.serverUrl, st.apiKey)
            if (PlaybackController.connect(context)) {
                openBookId = st.lastBookId
                screen = if (openBookId > 0) "book" else "library"
            } else {
                screen = "login"
            }
        } else {
            screen = "login"
        }
    }

    when (screen) {
        "loading" -> LoadingScreen()
        "login" -> LoginScreen(onSuccess = { screen = "library" })
        "library" -> LibraryScreen(
            onOpenBook = { id -> openBookId = id; screen = "book" },
            onOpenSettings = { screen = "settings" }
        )
        "book" -> BookScreen(bookId = openBookId, onBack = { screen = "library" })
        "settings" -> SettingsScreen(
            onBack = { screen = "library" },
            onLogout = { screen = "login" }
        )
    }
}

