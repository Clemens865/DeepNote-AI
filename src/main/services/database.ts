import { getDatabase, closeDatabase } from '../db'

export class DatabaseService {
  init() {
    getDatabase()
  }

  close() {
    closeDatabase()
  }
}

export const databaseService = new DatabaseService()
