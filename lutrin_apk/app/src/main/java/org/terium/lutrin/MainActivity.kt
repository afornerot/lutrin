package org.terium.lutrin

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentTransaction

private const val URL_CIBLE = "https://lutrin.terium.org"
private const val PORT = 8080
private const val TAG = "MainActivity"

class MainActivity : AppCompatActivity() {

    internal var myWebServer: MyWebServer? = null
    private lateinit var webView: WebView

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            filePathCallback?.onReceiveValue(uris)
            filePathCallback = null
        }

    private var webViewPermissionRequest: PermissionRequest? = null
    private val requestWebViewPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            webViewPermissionRequest?.let { request ->
                if (isGranted) {
                    request.grant(request.resources)
                    Log.d(TAG, "Permission WebView accordée pour ${request.resources.joinToString()}")
                } else {
                    request.deny()
                    Log.d(TAG, "Permission WebView refusée pour ${request.resources.joinToString()}")
                }
                webViewPermissionRequest = null
            }
        }

    private val requestCameraPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted: Boolean ->
            if (isGranted) {
                Log.d(TAG, "La permission pour la caméra a été accordée.")
                loadCameraFragment()
            } else {
                Log.w(TAG, "La permission pour la caméra a été refusée.")
                // Vous pouvez afficher un message à l'utilisateur ici pour l'informer que la fonctionnalité n'est pas disponible.
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        if (savedInstanceState == null) {
            checkAndRequestCameraPermission()
        }
        startWebServer()

        setupWebView()
        webView.loadUrl(URL_CIBLE)
        setupBackPressedHandler()
    }

    private fun checkAndRequestCameraPermission() {
        when {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED -> {
                loadCameraFragment()
            }
            shouldShowRequestPermissionRationale(Manifest.permission.CAMERA) -> {
                // Ici, vous pourriez afficher une UI expliquant pourquoi vous avez besoin de la permission.
                // Pour faire simple, nous la demandons directement.
                requestCameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
            else -> {
                requestCameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        }
    }

    private fun loadCameraFragment() {
        val fragment = CameraPreviewFragment()
        supportFragmentManager
            .beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .setTransition(FragmentTransaction.TRANSIT_FRAGMENT_OPEN)
            .commit()
        Log.i(TAG, "CameraPreviewFragment chargé.")
    }

    private fun startWebServer() {
        try {
            myWebServer = MyWebServer()
            myWebServer?.startServer()
            Log.i(TAG, "Serveur MJPEG démarré sur http://127.0.0.1:$PORT")
        } catch (e: Exception) {
            Log.e(TAG, "Erreur au démarrage du serveur web", e)
        }
    }

    private fun setupWebView() {
        webView = findViewById(R.id.webView)

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            webView.setOnApplyWindowInsetsListener { view, insets ->
                val systemBars = insets.getInsets(android.view.WindowInsets.Type.systemBars())
                val navigationBars = insets.getInsets(android.view.WindowInsets.Type.navigationBars())
                view.setPadding(0, systemBars.top, 0, navigationBars.bottom)
                insets.consumeSystemWindowInsets()
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.setOnApplyWindowInsetsListener { view, insets ->
                @Suppress("DEPRECATION")
                val bottomPadding = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                    insets.getInsets(android.view.WindowInsets.Type.navigationBars()).bottom
                } else {
                    0
                }
                webView.setPadding(0, 0, 0, bottomPadding)
                insets
            }
        }

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.allowContentAccess = true
        webView.settings.allowFileAccess = true
        webView.settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        webView.settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
        WebView.setWebContentsDebuggingEnabled(true)

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "WebView a fini de charger: $url")
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                Log.d(TAG, "onPermissionRequest pour ${request.resources.joinToString()} depuis ${request.origin}")

                webViewPermissionRequest = request

                val requiredPermission = when {
                    request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) -> Manifest.permission.CAMERA
                    request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) -> Manifest.permission.RECORD_AUDIO
                    else -> null
                }

                if (requiredPermission != null) {
                    if (ContextCompat.checkSelfPermission(this@MainActivity, requiredPermission) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(request.resources)
                    } else {
                        requestWebViewPermissionLauncher.launch(requiredPermission)
                    }
                } else {
                    request.deny()
                }
            }

            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback

                val intent = params.createIntent()
                try {
                    fileChooserLauncher.launch(intent)
                } catch (e: Exception) {
                    Log.w(TAG, "Impossible de lancer le sélecteur de fichiers.", e)
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = null
                    return false
                }
                return true
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                Log.d("WebViewConsole", "${consoleMessage.message()} -- Ligne ${consoleMessage.lineNumber()} de ${consoleMessage.sourceId()}")
                return true
            }
        }
    }

    private fun setupBackPressedHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else if (isEnabled) {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        myWebServer?.stopServer()
    }
}