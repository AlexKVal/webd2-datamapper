'use strict'

const debug = require('debug')('webd2-datamapper:adapter')
const _ = require('lodash')
const moment = require('moment')
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
  constructor ({options, recordTypes}) {
    this.options = options
    this.recordTypes = recordTypes
  }

  _ensureNotConnected () {
    if (this.dbClient) throw new Error('there is opened db connection already')
  }

  _ensureConnected () {
    if (!this.dbClient) throw new Error('there is no opened db-connection')
  }

  query (sqlQuery) {
    this._ensureConnected()

    if (!sqlQuery) throw new Error('sqlQuery cannot be undefined')

    debug(`query():\n    ${sqlQuery}`)

    return new Promise((resolve, reject) => {
      this.dbClient.query(sqlQuery, (error, rows, moreResultSets) => {
        if (moreResultSets) throw new Error('odbc.query `moreResultSets` is not implemented')

        if (error) reject(error)
        else resolve(rows)
      })
    })
  }

  connect () {
    this._ensureNotConnected()

    if (!this.options.dsn) throw new Error('dsn option is undefined')
    const connectionString = `DSN=${this.options.dsn}`

    debug('connect()')

    return new Promise((resolve, reject) => {
      odbc.open(connectionString, (error, dbClient) => {
        if (error) return reject(error)

        this.dbClient = dbClient

        return resolve()
      })
    })
  }

  disconnect () {
    this._ensureConnected()

    if (this.__inTransaction) throw new Error('there is a transaction pending')

    debug('disconnect()')

    return new Promise((resolve, reject) => {
      this.dbClient.close((error) => {
        delete this.dbClient

        if (error) return reject(error)
        resolve()
      })
    })
  }

  /**
   * Begin a transaction to write to the data store.
   * It creates new db-connection and resolves with adapter instance
   */
  beginTransaction () {
    this._ensureNotConnected()

    debug('beginTransaction()')

    return this.connect()
    .then(() => this.query('START TRANSACTION'))
    .then(() => {
      this.__inTransaction = true
      return this
    })
  }

  /**
   * End a transaction and close db connection.
   * It returns a Promise with no value if the transaction is
   * completed successfully, or rejects the promise if it is failed.
   *
   * If an error is passed, roll back the transaction.
   */
  endTransaction (errorArg) {
    if (!this.__inTransaction) throw new Error('there is no transaction pending')

    delete this.__inTransaction

    debug('endTransaction()')

    return this.query(errorArg ? 'ROLLBACK WORK' : 'COMMIT WORK')
    .then(() => this.disconnect())
    .then(() => { if (errorArg) throw errorArg })
  }

  /**
   * Create records.
   * A successful response resolves to the newly created records.
   */
  create (type, records) {
    this._ensureTypeIsDescribed(type)
    this._ensureRecords(records)
    if (records && !records.length) return Promise.resolve([]) // no-op

    let newIds = []

    return records.reduce((sequence, record) => {
      return sequence
      .then(() => this.query(this._buildCreateQuery(type, record)))
      .then(() => this.query(this._buildGetNewIdQuery(type)))
      .then((rows) => newIds.push(Number(rows[0].newid)))
    }, Promise.resolve())
    .then(() => this.find(type, {ids: newIds})) // return newly created records
  }

  /**
   * Find records by options.
   *
   * The format of the options:
   * {
   *   ids: [ ... ],
   *   fieldsOnly: [ ... ],
   *   match: { ... },
   *   sort: { ... },
   *   range: { ... }
   * }
   *
   * If `ids` is undefined, it returns all records.
   * If `ids` is an empty array, it should be a no-op.
   *
   * The syntax of the `fieldsOnly`: ['id', 'name', 'group']
   * If there is no `fieldsOnly` then all fields will be returned
   *
   * For the `match`, `sort`, `range` fields the logical operator is "AND".
   *
   * The syntax of the `sort` object is as follows:
   * {
   *   age: false, // descending
   *   name: true // ascending
   * }
   *
   * The syntax of the `match` object is straightforward:
   * {
   *   name: 'value', // exact match
   *   friends: [ 'joe', 'bob' ] // match any one of these values
   * }
   *
   * The `range` object is used to filter between lower and upper bounds.
   * For singular link fields, it should not apply.
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
  find (type, options) {
    this._ensureTypeIsDescribed(type)

    options = options || {}

    if (options.ids) {
      if (!options.ids.length) return Promise.resolve([]) // Handle a no-op.

      options.ids = _.uniq(options.ids)
    }

    const sqlQuery = this._buildSelectQuery(type, options)

    return this.query(sqlQuery)
    .then((records) => records.map((record) => this.outputRecord(type, record)))
  }

  /**
   * Update records by IDs.
   * The `records` parameter should be an array of objects that
   * correspond to updates by IDs.
   *
   * Each recrds must contain ID.
   * {
   *   // ID to update. Required.
   *   id: 1,
   *
   *   // Replace a value of a field. Use a `null` value to unset a field.
   *   name: 'Bob'
   * }
   */
  update (type, records) {
    this._ensureTypeIsDescribed(type)
    this._ensureRecords(records)
    if (records && !records.length) return Promise.resolve(0) // no-op

    return Promise.all(records.map((record) =>
      this.query(this._buildUpdateQuery(type, record))
    ))
  }

  /**
   * Delete records by IDs.
   * Or delete the entire collection if IDs are undefined.
   * adapter.delete('aType') // deletes all rows
   * adapter.delete('aType', [1, 2, 3]) // deletes only rows with 'id' IN (1, 2, 3)
   */
  delete (type, ids) {
    this._ensureTypeIsDescribed(type)
    if (ids) {
      if (!Array.isArray(ids)) throw new TypeError('ids should be of Array type')
      if (!ids.length) return Promise.resolve(0) // no-op
      ids = _.uniq(ids) // ensure
    }

    let numberOfRowsToBeDeleted = 0

    return this.query(`SELECT COUNT(*) as "count" ${this._buildEndOfQueryForDelete(type, ids)}`)
    .then((rows) => { numberOfRowsToBeDeleted = Number(rows[0].count) })

    .then(() => this.query(`DELETE ${this._buildEndOfQueryForDelete(type, ids)}`))
    .then(() => numberOfRowsToBeDeleted)
  }

  outputRecord (type, record) {
    const descriptors = this.recordTypes[type]

    for (let field in record) {
      const fieldValue = record[field]

      if (fieldValue === undefined) {
        throw new Error(`'${type}':'${field}' field is undefined; this should not happen`)
      }

      const isId = field === 'id'
      const descriptor = descriptors[field]

      if (!isId) {
        if (descriptor === undefined) {
          throw new Error(`there is no '${field}' field in '${type}'; this should not happen`)
        }

        if (descriptor.link && descriptor.isArray) {
          throw new Error(`hasMany relation '${field}' field in '${type}'; this should not happen`)
        }

        if (descriptor.private) { // ensure
          delete record[field]
          continue
        }
      }

      const fieldType = ((isId || descriptor.link) && 'id') || descriptor.type

      record[field] = castType(fieldType, fieldValue)
    }

    return record
  }

  _ensureTypeIsDescribed (type) {
    if (!this.recordTypes[type]) throw new TypeError(`find: there is no "${type}" described`)
  }

  _ensureRecords (records) {
    if (records === undefined) throw new TypeError('records argument is undefined')
    if (records && !Array.isArray(records)) throw new TypeError('records should be of Array type')
  }

  /**
   * Generates `fields_part` of SELECT queries for `type`
   * SELECT <fields_part> FROM ...
   *
   * SELECT PersID as id,
   * name, cardcode, hide as deleted // data columns
   * GrpID as group, // belongsTo
   * rights // belongsTo w/o custom $fname
   *
   * by default - returns all public fields described in schema
   * ('aType') => '<all fields>'
   *
   * w/ fieldsOnly = ['id', 'name', 'hide', 'rights']
   * ('aType', fieldsOnly) => 'PersID as id, name, hide, rights'
   */
  _selectFieldsPart (type, fieldsOnly) {
    const descriptors = this.recordTypes[type]

    const idFieldClause = () => {
      const customIdFieldName = descriptors.$id
      const idClause = customIdFieldName ? `"${customIdFieldName}" as "id"` : '"id"'

      return ~(fieldsOnly || ['id']).indexOf('id') ? idClause : []
    }

    const dataAndBelongsToFields = () => {
      return Object.keys(descriptors).reduce((memo, key) => {
        const field = descriptors[key]
        if (
          key[0] !== '$' && // exclude meta
          !field.private && // only public
          !field.isArray && // exclude hasMany relation fields
          (fieldsOnly ? ~fieldsOnly.indexOf(key) : true) // fieldsOnly filter
        ) memo.push(field.$fname ? `"${field.$fname}" as "${key}"` : `"${key}"`)
        return memo
      }, [])
    }

    return [].concat(
      idFieldClause(),
      dataAndBelongsToFields()
    ).join(', ')
  }

  _wherePart (type, options) {
    const descriptors = this.recordTypes[type]
    const primaryKey = descriptors.$id || 'id'

    let clauses = []

    if (options.ids) {
      if (!_.every(options.ids, Number)) {
        throw new TypeError(`options.ids can only be of Number type: '${options.ids}'`)
      }
      clauses.push(`"${primaryKey}" IN (${options.ids.join(', ')})`)
    }

    const describedFields = Object.keys(descriptors)

    for (let matchField in options.match) {
      if (matchField.toLowerCase() === 'id') {
        throw new TypeError("match: use options.ids for 'id' matching")
      }

      if (!~describedFields.indexOf(matchField)) {
        throw new TypeError(`match: there is no '${matchField}' field in '${type}'`)
      }

      const matchValue = options.match[matchField]

      if (matchValue === undefined) {
        throw new Error(`match: value of the '${matchField}' field is undefined`)
      }

      if (descriptors[matchField].link && descriptors[matchField].isArray) { // hasMany
        throw new Error('cannot match against hasMany relation')
      }
      const fieldType = descriptors[matchField].type || (descriptors[matchField].link && Number)
      const fieldName = descriptors[matchField].$fname || matchField
      const fieldValue = mapValue(fieldType, matchValue)

      if (Array.isArray(matchValue)) {
        clauses.push(`"${fieldName}" IN (${fieldValue})`)
      } else {
        clauses.push(`"${fieldName}"=${fieldValue}`)
      }
    }

    for (let rangeField in options.range) {
      const isIdField = rangeField.toLowerCase() === 'id'

      if (!isIdField && !~describedFields.indexOf(rangeField)) {
        throw new TypeError(`range: there is no '${rangeField}' field in '${type}'`)
      }

      if (!isIdField && descriptors[rangeField].isArray) throw new Error("range option for 'isArray' fields is not implemented")

      const rangeValues = options.range[rangeField]

      if (rangeValues === undefined || !Array.isArray(rangeValues)) {
        throw new TypeError(`range: value of the '${rangeField}' is '${rangeValues}'. should be [min, max]`)
      }

      const [min, max] = rangeValues

      if (min === undefined) throw new TypeError(`range '${rangeField}' field: min is undefined`)
      if (max === undefined) throw new TypeError(`range '${rangeField}' field: max is undefined`)
      if (min === null && max === null) throw new TypeError(`range '${rangeField}' field: both min and max are null`)

      const fieldType = isIdField || descriptors[rangeField].link ? Number : descriptors[rangeField].type
      const fieldName = isIdField ? primaryKey : descriptors[rangeField].$fname || rangeField

      if (min !== null) {
        clauses.push(`"${fieldName}" >= ${mapValue(fieldType, min)}`)
      }
      if (max !== null) {
        clauses.push(`"${fieldName}" <= ${mapValue(fieldType, max)}`)
      }
    }

    return clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
  }

  _orderByPart (type, sortOptions) {
    const descriptors = this.recordTypes[type]
    const primaryKey = descriptors.$id || 'id'

    const describedFields = Object.keys(descriptors)

    let clauses = []

    for (let sortField in sortOptions) {
      const isId = sortField.toLowerCase() === 'id'

      if (!isId && !~describedFields.indexOf(sortField)) {
        throw new TypeError(`sort: there is no '${sortField}' field in '${type}'`)
      }

      const sortValue = sortOptions[sortField]

      if (sortValue === undefined) {
        throw new Error(`sort: value of the '${sortField}' field is undefined`)
      }

      if (typeof sortValue !== 'boolean') {
        throw new Error(`sort: value of the '${sortField}' should be of Boolean type`)
      }

      if (!isId && descriptors[sortField].link && descriptors[sortField].isArray) { // hasMany
        throw new Error('cannot sort on hasMany relation field')
      }

      const fieldName = isId ? primaryKey : descriptors[sortField].$fname || sortField

      clauses.push(`"${fieldName}" ${sortValue ? 'ASC' : 'DESC'}`)
    }

    return clauses.length ? ` ORDER BY ${clauses.join(', ')}` : ''
  }

  _buildSelectQuery (type, options) {
    options = options || {}

    const tableName = this.recordTypes[type].$table || type

    let sqlQuery = `SELECT ${this._selectFieldsPart(type, options.fieldsOnly)} FROM "${tableName}"`

    sqlQuery += this._wherePart(type, options)

    sqlQuery += this._orderByPart(type, options.sort)

    return sqlQuery
  }

  _buildEndOfQueryForDelete (type, ids) {
    const idFieldName = this.recordTypes[type].$id || 'id'
    const tableName = this.recordTypes[type].$table || type

    let sqlQuery = `FROM "${tableName}"`

    if (ids) sqlQuery += ` WHERE "${idFieldName}" IN (${ids.join(', ')})`

    return sqlQuery
  }

  _buildGetNewIdQuery (type) {
    const idFieldName = this.recordTypes[type].$id || 'id'
    const tableName = this.recordTypes[type].$table || type

    return `SELECT MAX("${idFieldName}") as "newid" FROM "${tableName}"`
  }

  _buildCreateQuery (type, record) {
    const descriptors = this.recordTypes[type]

    const tableName = descriptors.$table || type
    const idFieldName = descriptors.$id || 'id'

    let columnList = []
    let valueList = []

    for (let fieldName in record) {
      const fieldValue = record[fieldName]

      if (fieldName === 'id') {
        columnList.push('"' + idFieldName + '"')
        valueList.push(mapValue(Number, fieldValue))
      } else {
        const fieldDescr = descriptors[fieldName]

        if (fieldDescr === undefined) {
          throw new Error(`create: '${type}' model does not contain '${fieldName}' field`)
        }
        if (fieldDescr.link && fieldDescr.isArray) {
          throw new Error('inserting of hasMany this way is not implemented. use inverse belongsTo')
        }

        if (!fieldDescr.link && fieldDescr.isArray) {
          throw new Error('inserting of isArray values is not implemented')
        }

        columnList.push(`"${fieldDescr.$fname || fieldName}"`)

        const fieldType = fieldDescr.type || (fieldDescr.link && Number)
        valueList.push(mapValue(fieldType, fieldValue))
      }
    }

    return `INSERT INTO "${tableName}" (${columnList.join(', ')}) VALUES (${valueList.join(', ')})`
  }

  _buildDoesRowExist (type, id) {
    if (id == null) throw new TypeError('update: the record has no "id"')

    const idFieldName = this.recordTypes[type].$id || 'id'
    const tableName = this.recordTypes[type].$table || type

    return `SELECT "${idFieldName}" FROM "${tableName}" WHERE "${idFieldName}"=${id}`
  }

  _buildUpdateQuery (type, record) {
    const descriptors = this.recordTypes[type]

    const tableName = descriptors.$table || type
    const idFieldName = descriptors.$id || 'id'

    let setClauses = []

    for (let fieldName in record) {
      if (fieldName === 'id') continue

      const fieldDescr = descriptors[fieldName]

      if (fieldDescr === undefined) {
        throw new Error(`update: '${type}' model does not contain '${fieldName}' field`)
      }
      if (fieldDescr.link && fieldDescr.isArray) {
        throw new Error('updating of hasMany is not implemented')
      }

      const fieldType = fieldDescr.type || (fieldDescr.link && Number)
      const setFieldName = fieldDescr.$fname || fieldName
      const setValue = mapValue(fieldType, record[fieldName])

      setClauses.push(`"${setFieldName}"=${setValue}`)
    }

    return `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE "${idFieldName}"=${record.id}`
  }
}

/**
 * This ad-hoc function exists because the odbc library doesn't work with '?' parameters
 */
function mapValue (fieldType, value) {
  if (value === null) return null

  switch (fieldType) {
    case Boolean:
    case Number:
      return (Array.isArray(value)) ? value.join(', ') : value

    case 'date':
      return moment(value).format('YYYY-MM-DD')
    case 'time':
      return moment(value).format('HH:mm:ss')

    case String:
    default:
      return (Array.isArray(value)) ? value.map(quote).join(', ') : quote(value)
  }

  function quote (val) {
    return "'" + String(val).replace(/'/g, ' ') + "'"
  }
}

/**
 * Cast type of odbc value into JavaScript's
 */
function castType (fieldType, value) {
  switch (fieldType) {
    case String:
      return String(value != null ? value : '')
    case Number:
      return Number(value)
    case Boolean:
      return value === '1'
    case 'id':
      return value === '0' ? null : Number(value)
    case 'date':
      return value && new Date(`${value} 00:00:00`)
    case 'time':
      return value && new Date(`1970-01-01 ${value}`)
    default:
      return value
  }
}

 // for testing
Adapter.mapValue = mapValue
Adapter.castType = castType

module.exports = Adapter
