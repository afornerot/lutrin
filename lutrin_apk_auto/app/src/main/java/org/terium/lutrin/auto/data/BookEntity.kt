package org.terium.lutrin.auto.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Un livre : métadonnées + progression. Le TEXTE est stocké chapitre par
 * chapitre dans la table chapters (un paragraphe = un chapitre, même règle
 * que le client web). On ne stocke JAMAIS le texte entier sur une ligne :
 * une ligne SQLite > ~2 MB fait planter le CursorWindow (SQLiteBlobTooBig).
 */
@Entity(tableName = "books")
data class BookEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val authors: String,
    val description: String,
    val coverDataUrl: String?,       // data:image/jpeg;base64,...
    val language: String?,
    val uploadedAt: Long,
    val totalChapters: Int = 0,
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

@Entity(
    tableName = "chapters",
    primaryKeys = ["bookId", "idx"],
    foreignKeys = [ForeignKey(
        entity = BookEntity::class,
        parentColumns = ["id"],
        childColumns = ["bookId"],
        onDelete = ForeignKey.CASCADE
    )],
    indices = [Index("bookId")]
)
data class ChapterEntity(
    val bookId: Long,
    val idx: Int,
    val text: String
)
