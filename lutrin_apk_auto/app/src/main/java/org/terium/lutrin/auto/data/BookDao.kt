package org.terium.lutrin.auto.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
abstract class BookDao {

    @Query("SELECT * FROM books ORDER BY lastPlayedAt DESC, uploadedAt DESC")
    abstract fun observeAll(): Flow<List<BookEntity>>

    @Query("SELECT * FROM books WHERE id = :id")
    abstract suspend fun getById(id: Long): BookEntity?

    @Query("SELECT * FROM books ORDER BY lastPlayedAt DESC, uploadedAt DESC")
    abstract suspend fun getAllSnapshot(): List<BookEntity>

    @Insert
    abstract suspend fun insertBook(book: BookEntity): Long

    @Insert
    abstract suspend fun insertChapters(chapters: List<ChapterEntity>)

    /** Insertion transactionnelle : livre + ses chapitres (1 ligne par chapitre). */
    @Transaction
    open suspend fun insertWithChapters(book: BookEntity, chapterTexts: List<String>): Long {
        val id = insertBook(book.copy(totalChapters = chapterTexts.size))
        insertChapters(chapterTexts.mapIndexed { idx, text -> ChapterEntity(id, idx, text) })
        return id
    }

    @Update
    abstract suspend fun update(book: BookEntity)

    @Query("DELETE FROM books WHERE id = :id") // chapters supprimés via CASCADE
    abstract suspend fun delete(id: Long)

    @Query("SELECT text FROM chapters WHERE bookId = :bookId ORDER BY idx")
    abstract suspend fun getChapters(bookId: Long): List<String>

    @Query("UPDATE books SET lastChapter = :chapter, lastPositionMs = :positionMs, lastPlayedAt = :playedAt WHERE id = :id")
    abstract suspend fun saveProgress(id: Long, chapter: Int, positionMs: Long, playedAt: Long)
}
