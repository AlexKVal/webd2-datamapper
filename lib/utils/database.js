'use strict'
const {
  DbError
} = require('jsonapi-errors/lib/errors')

class Database {
  constructor (db) {
    this.db = db
  }
  exec (sql) {
    return this.db.exec(sql)
    .catch((dbMsg) => Promise.reject(new DbError(dbMsg)))
  }
}

/**
 * GLOBAL.dbInstance is used for testing purposes
 * because odbc is compiled for windows but tests could be run on *nix
 * just define GLOBAL.dbInstance to a mock at the beginning of a test file
 */
module.exports = {
  Database, // for testing

  getDatabase () {
    if (!GLOBAL.dbInstance) {
      const getDatabase = require('webd2-db').getDatabase
      const db = getDatabase(`DSN=${process.env.D2ALIAS}`)
      GLOBAL.dbInstance = new Database(db)
    }

    return GLOBAL.dbInstance
  }
}
