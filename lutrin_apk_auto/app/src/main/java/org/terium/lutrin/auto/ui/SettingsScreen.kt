package org.terium.lutrin.auto.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.terium.lutrin.auto.audio.PlaybackController
import org.terium.lutrin.auto.data.AppDatabase
import org.terium.lutrin.auto.data.SettingsStore
import org.terium.lutrin.auto.net.ApiClient
import org.terium.lutrin.auto.net.ApiError

private fun org.json.JSONArray.toStringList(): List<String> {
    val out = ArrayList<String>(length())
    for (i in 0 until length()) out.add(optString(i))
    return out
}

/** Réglages : voix Piper + vitesse de lecture + gestion des livres. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit, onLogout: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val prefs = remember { SettingsStore(context) }
    val dao = remember { AppDatabase.get(context).bookDao() }

    var piperVoice by remember { mutableStateOf("") }
    var lengthScale by remember { mutableFloatStateOf(1.0f) }
    var models by remember { mutableStateOf<List<String>>(emptyList()) }
    var error by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        val st = prefs.current()
        piperVoice = st.piperVoice
        lengthScale = st.lengthScale
        username = st.username
        models = withContext(Dispatchers.IO) {
            runCatching { ApiClient.getJson("/tts/piper-models").getJSONArray("models").toStringList() }
                .getOrElse { emptyList() }
        }
        if (models.isEmpty()) error = "Liste des voix indisponible (API)"
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Réglages") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                }
            )
        }
    ) { pad ->
        Column(
            Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // ---- Voix Piper ----
            Text("Voix Piper (fr)", style = MaterialTheme.typography.titleMedium)
            if (error.isNotEmpty()) Text(error, color = MaterialTheme.colorScheme.error)
            models.forEach { m ->
                Row(
                    Modifier.fillMaxWidth().clickable {
                        piperVoice = m
                        scope.launch { prefs.setPiperVoice(m) }
                    },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RadioButton(selected = piperVoice == m, onClick = {
                        piperVoice = m
                        scope.launch { prefs.setPiperVoice(m) }
                    })
                    Text(m.removeSuffix(".onnx"))
                }
            }

            // ---- Vitesse ----
            Text("Vitesse de lecture", style = MaterialTheme.typography.titleMedium)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("0,7×")
                Slider(
                    value = lengthScale,
                    onValueChange = { lengthScale = it },
                    onValueChangeFinished = {
                        // length_scale : >1 = plus lent ; la vitesse d'affichage est
                        // l'inverse → on expose directement length_scale ici (1.0 défaut)
                        scope.launch { prefs.setLengthScale(lengthScale) }
                    },
                    valueRange = 0.7f..1.3f,
                    modifier = Modifier.weight(1f)
                )
                Text("1,3×")
            }
            Text(
                "Réglage actuel : ${"%.2f".format(lengthScale)} (plus grand = plus lent)",
                style = MaterialTheme.typography.labelSmall
            )

            HorizontalDivider()

            // ---- Gestion des livres ----
            Text("Bibliothèque locale", style = MaterialTheme.typography.titleMedium)
            val books = dao.observeAll().collectAsState(initial = emptyList()).value
            books.forEach { b ->
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(b.title.take(30), Modifier.weight(1f))
                    TextButton(onClick = {
                        scope.launch { dao.delete(b.id) }
                    }) { Text("Supprimer") }
                }
            }

            HorizontalDivider()

            Row(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
                Text("Utilisateur : $username", style = MaterialTheme.typography.labelSmall)
                Spacer(Modifier.width(16.dp))
                OutlinedButton(onClick = {
                    scope.launch {
                        PlaybackController.playPause()
                        prefs.logout()
                        onLogout()
                    }
                }) { Text("Se déconnecter") }
            }
        }
    }
}
