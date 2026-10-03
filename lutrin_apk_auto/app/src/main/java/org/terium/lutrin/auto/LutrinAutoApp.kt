package org.terium.lutrin.auto

import android.app.Application
import org.terium.lutrin.auto.data.SettingsStore
import org.terium.lutrin.auto.net.ApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class LutrinAutoApp : Application() {

    val appScope = CoroutineScope(Dispatchers.Default)

    override fun onCreate() {
        super.onCreate()
        val prefs = SettingsStore(this)
        appScope.launch {
            val st = prefs.current()
            if (st.apiKey.isNotBlank()) ApiClient.configure(st.serverUrl, st.apiKey)
        }
    }
}
