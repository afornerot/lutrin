package org.terium.lutrin.auto.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [BookEntity::class, ChapterEntity::class], version = 2, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun bookDao(): BookDao

    companion object {
        @Volatile private var instance: AppDatabase? = null

        fun get(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext, AppDatabase::class.java, "lutrin-auto.db"
                )
                    // v1 (texte complet sur une ligne) est cassée pour les gros
                    // livres ; on repart de zéro, les livres se réimportent.
                    .fallbackToDestructiveMigration()
                    .build().also { instance = it }
            }
    }
}
