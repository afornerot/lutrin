package org.terium.lutrin.auto.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "lutrin_auto")

data class AppSettings(
    val serverUrl: String,
    val apiKey: String,
    val username: String,
    val piperVoice: String,   // ex: fr_FR-siwis-medium.onnx
    val lengthScale: Float,   // vitesse de lecture (1.0 = normal)
    val lastBookId: Long      // livre en cours
)

class SettingsStore(private val context: Context) {

    private object Keys {
        val SERVER_URL = stringPreferencesKey("server_url")
        val API_KEY = stringPreferencesKey("api_key")
        val USERNAME = stringPreferencesKey("username")
        val PIPER_VOICE = stringPreferencesKey("piper_voice")
        val LENGTH_SCALE = floatPreferencesKey("length_scale")
        val LAST_BOOK = longPreferencesKey("last_book_id")
    }

    val settings: Flow<AppSettings> = context.dataStore.data.map { p ->
        AppSettings(
            serverUrl = p[Keys.SERVER_URL] ?: DEFAULT_SERVER_URL,
            apiKey = p[Keys.API_KEY] ?: "",
            username = p[Keys.USERNAME] ?: "",
            piperVoice = p[Keys.PIPER_VOICE] ?: "",
            lengthScale = p[Keys.LENGTH_SCALE] ?: 1.0f,
            lastBookId = p[Keys.LAST_BOOK] ?: 0L
        )
    }

    suspend fun current(): AppSettings = settings.first()

    suspend fun setLoggedIn(serverUrl: String, username: String, apiKey: String) {
        context.dataStore.edit { p ->
            p[Keys.SERVER_URL] = serverUrl.trimEnd('/')
            p[Keys.USERNAME] = username
            p[Keys.API_KEY] = apiKey
        }
    }

    suspend fun setPiperVoice(voice: String) =
        context.dataStore.edit { it[Keys.PIPER_VOICE] = voice }

    suspend fun setLengthScale(scale: Float) =
        context.dataStore.edit { it[Keys.LENGTH_SCALE] = scale }

    suspend fun setLastBook(id: Long) =
        context.dataStore.edit { it[Keys.LAST_BOOK] = id }

    suspend fun logout() =
        context.dataStore.edit { p ->
            p[Keys.API_KEY] = ""
            p[Keys.USERNAME] = ""
            p[Keys.LAST_BOOK] = 0L
        }

    companion object {
        const val DEFAULT_SERVER_URL = "https://lutrin.terium.org"
    }
}
