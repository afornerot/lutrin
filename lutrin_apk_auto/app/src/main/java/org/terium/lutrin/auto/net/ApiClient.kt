package org.terium.lutrin.auto.net

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Client HTTP pour l'API Lutrin (auth par header X-API-Key).
 *
 * Le serveur public passe par le proxy du client web : toute route JSON est
 * préfixée /api, les fichiers sont servis sous /file (racine).
 *
 * Routes utilisées :
 *  - POST /api/auth/login??? (via proxy)  {username, password} → {api_key, role}
 *  - POST /api/epub/add      multipart champ 'epub_file' → {metadata, cover_image, text}
 *  - GET  /api/tts/piper-models → {models: [filename.onnx]}
 *  - POST /api/tts           {text, piper_model_name?, length_scale?} → {audio_url: /file/xxx}
 *  - GET  /file/<name>       WAV brut (pas d'auth, pas de préfixe /api)
 */
object ApiClient {

    var baseUrl: String = ""
        private set
    private var apiKey: String = ""

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.MINUTES) // TTS Coqui peut être long
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    fun configure(serverUrl: String, key: String) {
        baseUrl = serverUrl.trimEnd('/')
        apiKey = key
    }

    private fun requestBuilder(url: String): Request.Builder {
        val b = Request.Builder().url(url)
        if (apiKey.isNotEmpty()) b.header("X-API-Key", apiKey)
        return b
    }

    fun login(serverUrl: String, username: String, password: String): JSONObject {
        val payload = JSONObject().put("username", username).put("password", password)
        val req = requestBuilder(serverUrl.trimEnd('/') + "/api/auth/login")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
        return execute(req)
    }

    fun getJson(path: String): JSONObject = execute(requestBuilder(urlFor(path)).get())

    fun postJson(path: String, payload: JSONObject): JSONObject =
        execute(requestBuilder(urlFor(path))
            .post(payload.toString().toRequestBody("application/json".toMediaType())))

    fun uploadEpub(path: String, file: File): JSONObject {
        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("epub_file", file.name,
                file.asRequestBody("application/epub+zip".toMediaType()))
            .build()
        return execute(requestBuilder(urlFor(path)).post(requestBody))
    }

    fun downloadFile(path: String, dest: File) {
        val resp = client.newCall(requestBuilder(urlFor(path)).build()).execute()
        resp.use {
            if (!it.isSuccessful) throw ApiError(it.code, "téléchargement $path")
            val src = it.body ?: throw RuntimeException("corps vide")
            dest.outputStream().use { out -> src.byteStream().copyTo(out) }
        }
    }

    /**
     * Les réponses de l'API renvoient des chemins tels que "/file/xxx.wav"
     * (racine du serveur, pas le préfixe /api). Les chemins d'appel JSON sont
     * exprimés relativement à /api.
     */
    private fun urlFor(path: String): String {
        val p = path.trimStart('/')
        return if (p.startsWith("file/")) "$baseUrl/$p" else "$baseUrl/api/$p"
    }

    private fun execute(builder: Request.Builder): JSONObject {
        client.newCall(builder.build()).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            val json = if (text.trimStart().startsWith("{")) JSONObject(text) else JSONObject()
            if (!resp.isSuccessful) throw ApiError(resp.code, json.optString("error", resp.message))
            return json
        }
    }
}

class ApiError(val code: Int, message: String) : RuntimeException("HTTP $code : $message")
