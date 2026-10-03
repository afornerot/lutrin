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
 * Routes utilisées (lutrin_api) :
 *  - POST /auth/login        {username, password} → {api_key, role}
 *  - POST /epub/add          multipart champ 'epub_file' → {metadata, cover_image, text}
 *  - GET  /tts/piper-models  → {models: [filename.onnx]}
 *  - POST /tts               {text, piper_model_name?, length_scale?} → {audio_url}
 *  - GET  /file/<name>       WAV brut (pas d'auth)
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
        val req = requestBuilder(serverUrl.trimEnd('/') + "/auth/login")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
        return execute(req)
    }

    fun getJson(path: String): JSONObject = execute(requestBuilder(baseUrl + path).get())

    fun postJson(path: String, payload: JSONObject): JSONObject =
        execute(requestBuilder(baseUrl + path)
            .post(payload.toString().toRequestBody("application/json".toMediaType())))

    fun uploadEpub(path: String, file: File): JSONObject {
        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("epub_file", file.name,
                file.asRequestBody("application/epub+zip".toMediaType()))
            .build()
        return execute(requestBuilder(baseUrl + path).post(requestBody))
    }

    fun downloadFile(path: String, dest: File) {
        val resp = client.newCall(requestBuilder(baseUrl + path).build()).execute()
        resp.use {
            if (!it.isSuccessful) throw ApiError(it.code, "téléchargement $path")
            val src = it.body ?: throw RuntimeException("corps vide")
            dest.outputStream().use { out -> src.byteStream().copyTo(out) }
        }
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
