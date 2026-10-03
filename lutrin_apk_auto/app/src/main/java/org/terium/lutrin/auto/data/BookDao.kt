package org.terium.lutrin.auto.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface BookDao {

    @Query("SELECT * FROM books ORDER BY lastPlayedAt DESC, uploadedAt DESC")
    fun observeAll(): Flow<List<BookEntity>>

    @Query("SELECT * FROM books WHERE id = :id")
    suspend fun getById(id: Long): BookEntity?

    @Query("SELECT * FROM books ORDER BY lastPlayedAt DESC, uploadedAt DESC")
    suspend fun getAllSnapshot(): List<BookEntity>

    @Insert
    suspend fun insert(book: BookEntity): Long

    @Update
    suspend fun update(book: BookEntity)

    @Query("DELETE FROM books WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("UPDATE books SET lastChapter = :chapter, lastPositionMs = :positionMs, lastPlayedAt = :playedAt WHERE id = :id")
    suspend fun saveProgress(id: Long, chapter: Int, positionMs: Long, playedAt: Long)
}
