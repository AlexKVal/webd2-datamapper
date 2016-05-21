'use strict'

const odbc = GLOBAL.odbcMock || require('odbc') // it allows to run tests under *nix

/**
 * Usage:
 *
 * const adapter = new Adapter(...)
 *
 * adapter.connect() ... adapter.disconnect()
 * or
 * adapter.beginTransaction() ... adapter.endTransaction()
 */
class Adapter {
  constructor ({options}) {
    this.options = options

    if (!options.dsn) throw new Error('dsn option is required')
  }

  connect () {
    const connectionString = `DSN=${this.options.dsn}`

    return new Promise((resolve, reject) => {
      odbc.open(connectionString, (error, dbClient) => {
        if (error) return reject(error)

        this.dbClient = dbClient

        return resolve()
      })
    })
  }

  disconnect () {
    return new Promise((resolve, reject) => {
      this.dbClient.close((error) => {
        if (error) reject(error)

        delete this.dbClient

        resolve()
      })
    })
  }

  /**
   * Begin a transaction to write to the data store.
   * It creates new db-connection and resolves with adapter instance
   */
  beginTransaction () {
    if (this.dbClient) throw new Error('a previous db-connection exists')

    return this.connect()
    .then(() => new Promise((resolve, reject) => {
      this.dbClient.query('START TRANSACTION', (error) => {
        if (error) reject(error)

        this.__inTransaction = true

        resolve(this)
      })
    }))
  }

  /**
   * Create records.
   * A successful response resolves to the newly created records.
   */
  create () {
    throw new Error('is not implemented')
  }

  /**
   * Find records by IDs and options.
   * If IDs is undefined, it returns all records.
   * If IDs is an empty array, it should be a no-op.
   *
   * The format of the options:
   * {
   *   sort: { ... },
   *   fields: { ... },
   *   match: { ... },
   *   range: { ... }
   * }
   *
   * For the `match` fields the logical operator should be "and".
   *
   * The syntax of the `sort` object is as follows:
   * {
   *   age: false, // descending
   *   name: true // ascending
   * }
   *
   * Fields can be specified to be either included or omitted, but not both.
   * Use the values `true` to include, or `false` to omit. The syntax of the
   * `fields` object is as follows:
   * {
   *   name: true, // include this field
   *   age: true // also include this field
   * }
   *
   * The syntax of the `match` object is straightforward:
   * {
   *   name: 'value', // exact match or containment if array
   *   friends: [ 'joe', 'bob' ] // match any one of these values
   * }
   *
   * The `range` object is used to filter between lower and upper bounds. It
   * should take precedence over `match`. For array fields, it should apply on
   * the length of the array. For singular link fields, it should not apply.
   * {
   *   range: { // Ranges should be inclusive.
   *     age: [ 18, null ], // From 18 and above.
   *     name: [ 'a', 'd' ], // Starting with letters A through C.
   *     createdAt: [ null, new Date(2016, 0) ] // Dates until 2016.
   *   }
   * }
   *
   * The return value of the promise should be an array.
   */
  find (type, ids, options) {
    throw new Error('is not implemented')
  }

  /**
   * Update records by IDs.
   * The `updates` parameter should be an array of objects that
   * correspond to updates by IDs.
   *
   * Each update object must be as follows:
   * {
   *   // ID to update. Required.
   *   id: 1,
   *
   *   // Replace a value of a field. Use a `null` value to unset a field.
   *   { name: 'Bob' }
   * }
   */
  update (updates) {
    throw new Error('is not implemented')
  }

  /**
   * Delete records by IDs, or delete the entire collection if IDs are
   * undefined or empty.
   */
  delete (type, ids) {
    throw new Error('is not implemented')
  }

  /**
   * End a transaction.
   * It returns a Promise with no value if the transaction is
   * completed successfully, or reject the promise if it failed.
   *
   * If an error is passed, roll back the transaction.
   */
  endTransaction (anError) {
    throw new Error('is not implemented')
  }
}

module.exports = Adapter
