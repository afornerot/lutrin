package org.terium.lutrin.auto.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Un livre audiobook. Le texte brut (extrait par l'API à l'upload) est découpé
 * en chapitres à la volée sur \n\n (même règle que le client web).
 */
@Entity(tableName = "books")
data class BookEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val authors: String,
    val description: String,
    val coverDataUrl: String?,       // data:image/jpeg;base64,...
    val fullText: String,
    val language: String?,
    val uploadedAt: Long,
    val lastChapter: Int = 0,        // progression locale (index de chapitre)
    val lastPositionMs: Long = 0,
    val lastPlayedAt: Long = 0
) {
    companion object {
        /** Découpage chapitre = paragraphe, identique au client web (split \n\n). */
        fun chapters(fullText: String): List<String> =
            fullText.split(Regex("\n\n+")).map { it.trim() }.filter { it.isNotEmpty() }
    }
}
