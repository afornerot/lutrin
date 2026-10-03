package org.terium.lutrin.auto.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.terium.lutrin.auto.data.SettingsStore
import org.terium.lutrin.auto.net.ApiClient
import org.terium.lutrin.auto.net.ApiError

@Composable
fun LoginScreen(onSuccess: () -> Unit) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val prefs = remember { SettingsStore(context) }

    var serverUrl by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { serverUrl = prefs.current().serverUrl }

    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Lutrin Auto", style = MaterialTheme.typography.headlineLarge)
        Spacer(Modifier.height(32.dp))

        OutlinedTextField(
            value = serverUrl, onValueChange = { serverUrl = it },
            label = { Text("Serveur") },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = username, onValueChange = { username = it },
            label = { Text("Utilisateur") },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it },
            label = { Text("Mot de passe") },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(20.dp))

        if (error.isNotEmpty()) {
            Text(error, color = MaterialTheme.colorScheme.error)
            Spacer(Modifier.height(12.dp))
        }

        Button(
            onClick = {
                if (username.isBlank() || password.isBlank() || serverUrl.isBlank()) {
                    error = "Tous les champs sont requis"
                } else {
                    busy = true; error = ""
                    scope.launch {
                        try {
                            val resp = withContext(Dispatchers.IO) {
                                ApiClient.login(serverUrl, username.trim(), password)
                            }
                            val key = resp.optString("api_key")
                            if (key.isBlank()) throw RuntimeException("api_key absente")
                            prefs.setLoggedIn(serverUrl, username.trim(), key)
                            ApiClient.configure(serverUrl, key)
                            onSuccess()
                        } catch (e: ApiError) {
                            error = if (e.code == 401) "Identifiants invalides" else e.message ?: "Erreur"
                        } catch (e: Exception) {
                            error = "Connexion impossible : ${e.message}"
                        } finally {
                            busy = false
                        }
                    }
                }
            },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
            else Text("Connexion")
        }
    }
}
