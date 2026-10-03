package org.terium.lutrin.auto

import android.content.Context
import java.io.File

/** Capture les crashes (exceptions non rattrapées) dans un fichier in-app. */
object CrashReporter {

    private const val FILE = "last_crash.txt"

    fun install(context: Context) {
        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            kotlin.runCatching {
                File(context.applicationInfo.dataDir, FILE).writeText(
                    "${throwable.javaClass.name}\n${throwable.stackTraceToString().take(8000)}"
                )
            }
            previousHandler?.uncaughtException(thread, throwable)
        }
    }

    /** Renvoie (et efface) la trace du dernier crash, s'il y en a une. */
    fun consume(context: Context): String? {
        val f = File(context.applicationInfo.dataDir, FILE)
        if (!f.exists()) return null
        val content = f.readText()
        f.delete()
        return content
    }
}
