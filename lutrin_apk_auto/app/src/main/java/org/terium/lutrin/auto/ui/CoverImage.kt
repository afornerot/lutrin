package org.terium.lutrin.auto.ui

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp

/** Affiche une couverture encodée data:image/...;base64,xxx. */
@Composable
fun CoverImage(dataUrl: String?, size: Dp) {
    val bitmap by remember(dataUrl) {
        derivedStateOf { decodeDataUrl(dataUrl) }
    }
    if (bitmap != null) {
        Image(
            bitmap = bitmap!!.asImageBitmap(),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.size(size)
        )
    } else {
        Box(
            Modifier.size(size).background(Color(0xFF3A3A5E))
        )
    }
}

private fun decodeDataUrl(dataUrl: String?): android.graphics.Bitmap? {
    if (dataUrl.isNullOrBlank()) return null
    return try {
        val b64 = if (',' in dataUrl) dataUrl.substringAfter(',') else dataUrl
        val bytes = Base64.decode(b64, Base64.DEFAULT)
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    } catch (_: Exception) {
        null
    }
}
