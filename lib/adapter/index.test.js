'use strict'

const test = require('tape')

GLOBAL.odbcMock = {}

const Adapter = require('./index')

test('Adapter', (t) => {
  const recordTypes = {}
  const options = {dsn: 'DB'}

  const instance = new Adapter({options, recordTypes})
  t.equal(instance.recordTypes, recordTypes, 'it saves recordTypes')
  t.equal(instance.options, options, 'it saves options')

  t.end()
})

test('adapter.connect()', (t) => {
  t.plan(4)

  const dbClientMock = {}

  GLOBAL.odbcMock.open = (connectionString, callback) => {
    t.pass('it calls odbc.open() method')
    t.equal(connectionString, 'DSN=DBALIAS')
    callback(undefined, dbClientMock)
  }

  t.throws(
    () => new Adapter({options: {/* dsn: undefined */}}).connect(),
    /dsn option is undefined/,
    'DSN for ODBC driver is required'
  )

  const adapter = new Adapter({options: {dsn: 'DBALIAS'}})

  adapter.connect()
  .then(() => {
    t.equal(adapter.dbClient, dbClientMock, 'it saves opened odbc-client')
  })
  .catch(t.fail)
  .then(t.end)
})

test('adapter.connect() when already connected', (t) => {
  const dbClientMock = {}
  GLOBAL.odbcMock.open = (_, callback) => {
    callback(undefined, dbClientMock)
  }

  const adapter = new Adapter({options: {dsn: 'DBALIAS'}})
  adapter.connect()
  .then(() => {
    t.throws(
      () => adapter.connect(),
      /there is opened db connection already/,
      'it throws an error'
    )
  })
  .catch(t.fail)
  .then(t.end)
})

test('adapter.disconnect()', (t) => {
  t.plan(3)

  const dbClientMock = {
    close (callback) {
      t.pass('it calls odbcClient.close() method')
      callback(/* no error */)
    }
  }
  GLOBAL.odbcMock.open = (_, callback) => callback(undefined, dbClientMock)

  const adapter = new Adapter({options: {dsn: 'DBALIAS'}})
  adapter.connect()

  .then(() => adapter.disconnect())
  .then(() => t.pass('it returns successfully resolved promise'))
  .then(() => t.equal(adapter.dbClient, undefined, 'it removes link to the odbc client'))

  .catch(t.fail)
  .then(t.end)
})

test('adapter.disconnect() when not connected', (t) => {
  const dbClientMock = { close (cb) { cb() } }
  GLOBAL.odbcMock.open = (_, callback) => callback(undefined, dbClientMock)

  const adapter = new Adapter({})
  t.equal(adapter.dbClient, undefined, 'there is no previous db-connection')

  t.throws(
    () => adapter.disconnect(),
    /there is no opened db-connection/,
    'throws an error'
  )

  t.end()
})

test('adapter.disconnect() when there is a transaction pending', (t) => {
  const dbClientMock = { query (_, cb) { cb() } }
  GLOBAL.odbcMock.open = (_, callback) => callback(undefined, dbClientMock)

  const adapter = new Adapter({options: {dsn: 'DBALIAS'}})

  adapter.beginTransaction()
  .then(() => t.throws(
    () => adapter.disconnect(),
    /there is a transaction pending/,
    'throws an error'
  ))
  .catch(t.fail)
  .then(t.end)
})

test('adapter.beginTransaction()', (t) => {
  t.plan(6)

  const dbClientMock = {
    query (sqlQuery, cb) {
      t.equal(sqlQuery, 'START TRANSACTION', 'it starts transaction')
      cb(/* no error */)
    }
  }
  GLOBAL.odbcMock.open = (_, callback) => callback(undefined, dbClientMock)

  const adapter = new Adapter({options: {dsn: 'DBALIAS'}})
  t.equal(adapter.dbClient, undefined, 'there is no previous db-connection')
  t.equal(adapter.__inTransaction, undefined, 'adapter`s inner state is undefined')

  adapter.beginTransaction()
  .then((result) => {
    t.equal(result, adapter, 'it resolves with adapter instance')
    t.equal(result.dbClient, dbClientMock, 'it opens new db-connection')
    t.ok(result.__inTransaction, 'adapter`s inner state is "in transaction"')
  })

  .catch(t.fail)
  .then(t.end)
})

test('adapter.beginTransaction() when already connected', (t) => {
  t.plan(3)

  const dbClientMock = { query (_, cb) { cb(/* no error */) } }
  GLOBAL.odbcMock.open = (_, callback) => callback(undefined, dbClientMock)

  const adapter = new Adapter({options: {dsn: 'DBALIAS'}})
  t.equal(adapter.dbClient, undefined, 'there is no previous db-connection')

  adapter.beginTransaction()
  .then((result) => t.equal(result.dbClient, dbClientMock, 'it opens new db-connection'))

  .then(() => {
    t.throws(
      () => adapter.beginTransaction(),
      /there is opened db connection already/,
      'it throws an error'
    )
  })
  .catch(t.fail)
  .then(t.end)
})

test('adapter.endTransaction() closes connection', (t) => {
  const dbClientMock = {
    query (_, cb) { cb() },
    close (cb) { cb() }
  }
  GLOBAL.odbcMock.open = (_, callback) => callback(undefined, dbClientMock)

  const adapter = new Adapter({options: {dsn: 'DBALIAS'}})
  adapter.beginTransaction()
  .then(() => t.ok(adapter.dbClient, 'there is opened db connection'))

  .then(() => adapter.endTransaction())
  .then(() => t.equal(adapter.dbClient, undefined, 'db connection has been closed'))

  .catch(t.fail)
  .then(t.end)
})

test('adapter.endTransaction() when there is no transaction pending', (t) => {
  const dbClientMock = { close (cb) { cb() } }
  GLOBAL.odbcMock.open = (_, callback) => callback(undefined, dbClientMock)

  const adapter = new Adapter({options: {dsn: 'DBALIAS'}})
  adapter.connect()
  .then(() => {
    t.ok(adapter.dbClient, 'there is opened db connection')
    t.equal(adapter.__inTransaction, undefined, 'there is no transaction pending')
  })
  .then(() => t.throws(
    () => adapter.endTransaction(),
    /there is no transaction pending/,
    'it throws an error'
  ))
  .catch(t.fail)
  .then(t.end)
})

test('adapter.endTransaction() without error argument', (t) => {
  t.plan(3)

  const dbClientMock = {
    counter: 0,
    query (sqlQuery, cb) {
      switch (this.counter) {
        case 0:
          t.equal(sqlQuery, 'START TRANSACTION', 'it starts transaction')
          this.counter++
          cb(/* no error */)
          break
        case 1:
          t.equal(sqlQuery, 'COMMIT WORK', 'then it commits transaction')
          this.counter++
          cb(/* no error */)
          break
        default:
          t.fail('there is more sql queries')
      }
    },
    close (cb) { cb() }
  }
  GLOBAL.odbcMock.open = (_, callback) => callback(undefined, dbClientMock)

  const adapter = new Adapter({options: {dsn: 'DBALIAS'}})
  adapter.beginTransaction()

  .then(() => adapter.endTransaction())
  .then(() => t.pass('it resolves OK'))

  .catch(t.fail)
  .then(t.end)
})

test('adapter.endTransaction(error) with an error passed in', (t) => {
  t.plan(3)

  const dbClientMock = {
    counter: 0,
    query (sqlQuery, cb) {
      switch (this.counter) {
        case 0:
          t.equal(sqlQuery, 'START TRANSACTION', 'it starts transaction')
          this.counter++
          cb(/* no error */)
          break
        case 1:
          t.equal(sqlQuery, 'ROLLBACK WORK', 'then it rolls back transaction')
          this.counter++
          cb(/* no error */)
          break
        default:
          t.fail('there is more sql queries')
      }
    },
    close (cb) { cb() }
  }
  GLOBAL.odbcMock.open = (_, callback) => callback(undefined, dbClientMock)

  const adapter = new Adapter({options: {dsn: 'DBALIAS'}})
  adapter.beginTransaction()

  .then(() => adapter.endTransaction(new Error('some high lvl error')))
  .then(() => t.fail('it should not resolve OK'))
  .catch((e) => t.equal(e.message, 'some high lvl error', 'it rejects with the error'))
  .then(t.end)
})

test('adapter.query()', (t) => {
  t.plan(7)

  const dbClientMock = {
    query (sqlQuery, cb) {
      if (sqlQuery === 'some wrong sql query') return cb(new Error('some db error'))

      t.equal(sqlQuery, 'some good sql query', 'it passes sql query to db-connection')
      cb(undefined, [{name: 'one'}, {name: 'two'}]) // return some rows
    }
  }
  GLOBAL.odbcMock.open = (_, cb) => cb(undefined, dbClientMock)

  const adapter = new Adapter({options: {dsn: 'DBALIAS'}})
  t.equal(adapter.dbClient, undefined, 'there is no db-connection')

  t.throws(
    () => adapter.query('a query'),
    /there is no opened db-connection/,
    'when not connected it throws an error'
  )

  adapter.connect()
  .then(() => t.pass('connection is opened'))

  .then(() => t.throws(
    () => adapter.query(/* undefined */),
    /sqlQuery cannot be undefined/,
    'when sqlQuery is not provided it throws an error'
  ))

  .then(() => adapter.query('some good sql query'))
  .then((rows) => t.deepEqual(
    rows,
    [{name: 'one'}, {name: 'two'}],
    'it returns fetched rows'
  ))
  .catch(t.fail)

  .then(() => adapter.query('some wrong sql query'))
  .then(() => t.fail('it should not be OK'))
  .catch((error) => t.equal(error.message, 'some db error', 'it returns db error'))

  .then(t.end)
})

test('adapter._selectFieldsPart(type, fieldsOnly)', (t) => {
  let recordTypes = {}

  recordTypes.aType = {
    /* no custom $id */
  }
  t.equal(
    new Adapter({recordTypes})._selectFieldsPart('aType'),
    '"id"',
    'default id field name is `id`'
  )

  recordTypes.aType = {
    $id: 'PersID'
  }
  t.equal(
    new Adapter({recordTypes})._selectFieldsPart('aType'),
    '"PersID" as "id"',
    "custom id field name could be provided with `$id: 'customName'`"
  )

  recordTypes.aType = {
    name: { type: String },
    deleted: { type: Boolean, $fname: 'hide' }, // custom field name
    privateField: { private: true, type: Number }
  }
  t.equal(
    new Adapter({recordTypes})._selectFieldsPart('aType'),
    '"id", "name", "hide" as "deleted"',
    'returns only public data fields'
  )

  recordTypes.aType = {
    group: { link: 'userGroup', $fname: 'GrpID' },
    rights: { link: 'rights' },
    posts: { link: 'post', inverse: 'user', isArray: true } // hasMany
  }
  t.equal(
    new Adapter({recordTypes})._selectFieldsPart('aType'),
    '"id", "GrpID" as "group", "rights"',
    'it generates clauses for belongsTo relations only; hasMany are ignored'
  )

  recordTypes.user = {
    $id: 'UserID',
    name: { type: String },
    deleted: { type: Boolean, $fname: 'hide' },
    counter: { type: Number },
    privateField: { private: true, type: Number },
    group: { link: 'userGroup', $fname: 'GrpID' }, // belongsTo
    posts: { link: 'post', inverse: 'user', isArray: true } // hasMany
  }

  t.equal(
    new Adapter({recordTypes})._selectFieldsPart('user' /* no fieldsOnly */),
    '"UserID" as "id", "name", "hide" as "deleted", "counter", "GrpID" as "group"',
    'w/o `fieldsOnly`: id field, public data fields, and belongsTo relation fields'
  )

  let fieldsOnly = ['id', 'deleted', 'group']
  t.equal(
    new Adapter({recordTypes})._selectFieldsPart('user', fieldsOnly),
    '"UserID" as "id", "hide" as "deleted", "GrpID" as "group"',
    'with `fieldsOnly` provided'
  )

  fieldsOnly = ['deleted', 'name']
  t.equal(
    new Adapter({recordTypes})._selectFieldsPart('user', fieldsOnly),
    '"name", "hide" as "deleted"',
    'fieldsOnly filters `id` clause too'
  )

  t.end()
})

const mapValue = Adapter.mapValue

test('mapValue(fieldType, value)', (t) => {
  t.equal(mapValue(Boolean, null), null)
  t.equal(mapValue(Number, null), null)
  t.equal(mapValue(String, null), null)

  t.equal(mapValue(Boolean, false), false)
  t.equal(mapValue(Number, 3), 3)
  t.equal(mapValue(String, 'some name'), "'some name'")
  t.equal(mapValue(String, 'input with \'quotes\''), "'input with  quotes '")
  t.equal(mapValue(String, 123), "'123'")
  t.equal(mapValue(String, false), "'false'")

  t.equal(mapValue(String, ['some', 'name']), "'some', 'name'")
  t.equal(mapValue(Number, [1, 2, 3]), '1, 2, 3')

  t.equal(mapValue('date', new Date('2015-02-15 00:00:00')), '2015-02-15')
  t.equal(mapValue('date', null), null)
  t.equal(mapValue('date', new Date('1899-12-31 00:00:00')), '1899-12-31')

  t.equal(mapValue('time', null), null)
  t.equal(mapValue('time', new Date('1970-01-01 00:00:00')), '00:00:00')
  t.equal(mapValue('time', new Date('1970-01-01 01:02:03')), '01:02:03')

  t.end()
})

const castType = Adapter.castType

test('castType(fieldType, value)', (t) => {
  t.equal(castType(Number, '45'), 45)
  t.equal(castType(Number, '45.34'), 45.34)
  t.equal(castType(Number, 415), 415)

  t.equal(castType(String, true), 'true', 'string type')
  t.equal(castType(String, 432), '432', 'string type')
  t.equal(castType(String, 'some value'), 'some value', 'string type')

  t.equal(castType(String, null), '', 'string type: `null` => empty string')
  t.equal(castType(String, undefined), '', 'string type: `undefined` => empty string')

  t.equal(castType(String, true), 'true', 'string type: boolean true')
  t.equal(castType(String, false), 'false', 'string type: boolean false')

  t.equal(castType(Boolean, '0'), false, 'boolean type')
  t.equal(castType(Boolean, '1'), true, 'boolean type')

  t.equal(castType('id', '0'), null, 'db-layer keeps null value for ids as 0')
  t.equal(castType('id', '123'), 123, 'ids are numbers')

  t.deepEqual(castType('date', '2015-02-27'), new Date('2015-02-27 00:00:00'), 'custom date type')
  t.deepEqual(castType('date', '1899-12-31'), new Date('1899-12-31 00:00:00'), 'the earliest date of the db-layer')
  t.deepEqual(castType('date', null), null, 'custom date type')
  t.deepEqual(castType('time', '20:21:23'), new Date('1970-01-01 20:21:23'), 'custom time type')
  t.deepEqual(castType('time', null), null, 'custom time type')

  t.end()
})

test('adapter._wherePart(type, options)', (t) => {
  let recordTypes = {}
  recordTypes.user = {
    $id: 'UserID',
    $table: 'sPersonal',
    name: { type: String },
    deleted: { type: Boolean, $fname: 'hide' },
    counter: { type: Number },
    privateField: { private: true, type: Number },
    group: { link: 'userGroup', $fname: 'GrpID' }, // belongsTo
    posts: { link: 'post', inverse: 'user', isArray: true } // hasMany
  }
  const adapter = new Adapter({recordTypes})

  let options

  options = { ids: [321, 333, 22, 33] }
  t.equal(
    adapter._wherePart('user', options),
    ' WHERE "UserID" IN (321, 333, 22, 33)',
    'options.ids <primary_key> IN (<ids, ids>)'
  )

  options = { ids: ['123), some evil', 333] }
  t.throws(
    () => adapter._wherePart('user', options),
    /options\.ids can only be of Number type/,
    'it ensures that all IDs are Numbers'
  )

  options = { match: {name: undefined} }
  t.throws(
    () => adapter._wherePart('user', options),
    /match: value of the 'name' field is undefined/,
    'throws if `match` field value is undefined'
  )

  options = { match: {
    counter: 1,
    deleted: false // $fname: 'hide'
  } }
  t.equal(
    adapter._wherePart('user', options),
    ' WHERE "counter"=1 AND "hide"=false',
    'options.match for field with $fname'
  )

  options = { match: {
    privateField: 13
  } }
  t.equal(
    adapter._wherePart('user', options),
    ' WHERE "privateField"=13',
    'options.match works with private fields'
  )

  options = { match: {
    name: [ 'joe', 'bob' ],
    counter: [1, 2, 3]
  } }
  t.equal(
    adapter._wherePart('user', options),
    " WHERE \"name\" IN ('joe', 'bob') AND \"counter\" IN (1, 2, 3)",
    'options.match works with array values; IN (...)'
  )

  options = { match: {
    unknownFieldName: 1
  } }
  t.throws(
    () => adapter._wherePart('user', options),
    /match: there is no 'unknownFieldName' field in 'user'/,
    'match with undescribed field'
  )

  options = { match: {
    id: 1
  } }
  t.throws(
    () => adapter._wherePart('user', options),
    /match: use options\.ids for 'id' matching/,
    'match with ID field. use options.ids'
  )

  options = { match: {
    group: 10 // belongsTo
  } }
  t.equal(
    adapter._wherePart('user', options),
    ' WHERE "GrpID"=10',
    'options.match one id with belongsTo relation'
  )

  options = { match: {
    group: [1, 2, 10] // belongsTo
  } }
  t.equal(
    adapter._wherePart('user', options),
    ' WHERE "GrpID" IN (1, 2, 10)',
    'options.match some ids with belongsTo relation'
  )

  options = { match: {
    posts: 10 // hasMany
  } }
  t.throws(
    () => adapter._wherePart('user', options),
    /cannot match against hasMany relation/,
    'options.match throws with hasMany link'
  )

  options = { range: {
    name: undefined
  } }
  t.throws(
    () => adapter._wherePart('user', options),
    /range: value of the 'name' is 'undefined'/,
    'range: [min, max]; should not be undefined'
  )

  options = { range: {
    name: 'gt A'
  } }
  t.throws(
    () => adapter._wherePart('user', options),
    /range: value of the 'name' is 'gt A'/,
    'range: [min, max]; should be of Array type'
  )

  options = { range: {
    name: [null, null]
  } }
  t.throws(
    () => adapter._wherePart('user', options),
    /range 'name' field: both min and max are null/,
    'range: [min, max]; only one parameter can be null'
  )

  options = { range: {
    name: [undefined, 'b']
  } }
  t.throws(
    () => adapter._wherePart('user', options),
    /range 'name' field: min is undefined/,
    'range: [min, max]; min cannot be undefined'
  )

  options = { range: {
    name: ['a', undefined]
  } }
  t.throws(
    () => adapter._wherePart('user', options),
    /range 'name' field: max is undefined/,
    'range: [min, max]; max cannot be undefined'
  )

  options = { range: {
    posts: [ 1, 10 ] // { isArray: true }
  } }
  t.throws(
    () => adapter._wherePart('user', options),
    /range option for 'isArray' fields is not implemented/,
    'range for isArray is not implemented'
  )

  options = { range: {
    unknownFieldName: [ 1, 10 ]
  } }
  t.throws(
    () => adapter._wherePart('user', options),
    /range: there is no 'unknownFieldName' field in 'user'/,
    'range with undescribed field'
  )

  options = { range: {
    name: [ 'a', 'd' ] // Starting with letters 'a' through 'd'.
  } }
  t.equal(
    adapter._wherePart('user', options),
    ' WHERE "name" >= \'a\' AND "name" <= \'d\'',
    'options.range with both max and min values; String'
  )

  options = { range: {
    name: [ 'a', null ] // Starting with letters 'a' and above
  } }
  t.equal(
    adapter._wherePart('user', options),
    ' WHERE "name" >= \'a\'',
    'options.range String with only min value provided'
  )

  options = { range: {
    counter: [ 1, 10 ]
  } }
  t.equal(
    adapter._wherePart('user', options),
    ' WHERE "counter" >= 1 AND "counter" <= 10',
    'options.range with both max and min values; Number'
  )

  options = { range: {
    counter: [ null, 10 ] // less than 11
  } }
  t.equal(
    adapter._wherePart('user', options),
    ' WHERE "counter" <= 10',
    'options.range Number with only max value provided'
  )

  options = { range: {
    id: [ 1, 10 ]
  } }
  t.equal(
    adapter._wherePart('user', options),
    ' WHERE "UserID" >= 1 AND "UserID" <= 10',
    'options.range special case for ID'
  )

  options = { range: {
    group: [ 1, 10 ] // belongsTo
  } }
  t.equal(
    adapter._wherePart('user', options),
    ' WHERE "GrpID" >= 1 AND "GrpID" <= 10',
    'options.range with belongsTo'
  )

  t.end()
})

test('adapter._orderByPart(type, options)', (t) => {
  let recordTypes = {}
  recordTypes.user = {
    $id: 'UserID',
    $table: 'sPersonal',
    name: { type: String },
    deleted: { type: Boolean, $fname: 'hide' },
    counter: { type: Number },
    privateField: { private: true, type: Number },
    group: { link: 'userGroup', $fname: 'GrpID' }, // belongsTo
    posts: { link: 'post', inverse: 'user', isArray: true } // hasMany
  }
  const adapter = new Adapter({recordTypes})

  let options

  options = { sort: {
    unknownFieldName: true
  } }
  t.throws(
    () => adapter._orderByPart('user', options.sort),
    /sort: there is no 'unknownFieldName' field in 'user'/,
    'sort: undescribed field'
  )

  options = { sort: {
    name: undefined
  } }
  t.throws(
    () => adapter._orderByPart('user', options.sort),
    /sort: value of the 'name' field is undefined/,
    'sort: undefined value'
  )

  options = { sort: {
    name: 'asc'
  } }
  t.throws(
    () => adapter._orderByPart('user', options.sort),
    /sort: value of the 'name' should be of Boolean type/,
    'sort: not Boolean type'
  )

  options = { sort: {
    posts: true // hasMany
  } }
  t.throws(
    () => adapter._orderByPart('user', options.sort),
    /cannot sort on hasMany relation field/,
    'sort: with hasMany'
  )

  options = { sort: {
    name: true, // asc
    counter: false, // desc
    deleted: false // $fname: 'hide'
  } }
  t.equal(
    adapter._orderByPart('user', options.sort),
    ' ORDER BY "name" ASC, "counter" DESC, "hide" DESC',
    'sort: generates ORDER BY clauses'
  )

  options = { sort: {
    id: true,
    counter: false
  } }
  t.equal(
    adapter._orderByPart('user', options.sort),
    ' ORDER BY "UserID" ASC, "counter" DESC',
    'sort: can sort by ID'
  )

  options = { sort: {
    group: true, // belongsTo
    counter: false
  } }
  t.equal(
    adapter._orderByPart('user', options.sort),
    ' ORDER BY "GrpID" ASC, "counter" DESC',
    'sort: can sort by belongsTo'
  )

  options = { sort: {
    privateField: true
  } }
  t.equal(
    adapter._orderByPart('user', options.sort),
    ' ORDER BY "privateField" ASC',
    'sort: can sort by private fields'
  )
  t.end()
})

test('adapter._buildSelectQuery(type, options)', (t) => {
  let recordTypes = {}

  recordTypes.user = {/* empty */}
  t.equal(
    new Adapter({recordTypes})._buildSelectQuery('user'),
    'SELECT "id" FROM "user"',
    'with empty model schema select `ids`'
  )

  recordTypes.user = {
    $table: 'sPersonal'
  }
  t.equal(
    new Adapter({recordTypes})._buildSelectQuery('user'),
    'SELECT "id" FROM "sPersonal"',
    'it uses `$table` for table name'
  )

  recordTypes.user = {
    $id: 'PersID'
    /* no $table */
  }
  t.equal(
    new Adapter({recordTypes})._buildSelectQuery('user'),
    'SELECT "PersID" as "id" FROM "user"',
    'it uses `type` for table name if no `$table` has been provided'
  )

  recordTypes.user = {
    $id: 'UserID',
    $table: 'sPersonal',
    name: { type: String },
    deleted: { type: Boolean, $fname: 'hide' },
    counter: { type: Number },
    privateField: { private: true, type: Number },
    group: { link: 'userGroup', $fname: 'GrpID' }, // belongsTo
    posts: { link: 'post', inverse: 'user', isArray: true } // hasMany
  }

  t.equal(
    new Adapter({recordTypes})._buildSelectQuery('user'),
    'SELECT "UserID" as "id", "name", "hide" as "deleted", "counter", "GrpID" as "group" FROM "sPersonal"',
    'by default it builds SELECT query for extracting of all rows w/ public fields'
  )

  const options = {
    ids: [1, 2, 3],

    fieldsOnly: ['id', 'name', 'group'],

    match: {
      deleted: false,
      name: ['Admin', 'John'],
      group: [1, 2, 7]
    },

    range: {
      id: [2, 20],
      name: ['a', 'c'],
      privateField: [3, null],
      group: [null, 105]
    },

    sort: {
      id: false,
      name: true,
      group: false,
      privateField: true
    }
  }
  t.equal(
    new Adapter({recordTypes})._buildSelectQuery('user', options),
    'SELECT "UserID" as "id", "name", "GrpID" as "group" FROM "sPersonal"' +
    ' WHERE "UserID" IN (1, 2, 3)' +
    ' AND "hide"=false AND "name" IN (\'Admin\', \'John\') AND "GrpID" IN (1, 2, 7)' +
    ' AND "UserID" >= 2 AND "UserID" <= 20 AND "name" >= \'a\' AND "name" <= \'c\' AND "privateField" >= 3 AND "GrpID" <= 105' +
    ' ORDER BY "UserID" DESC, "name" ASC, "GrpID" DESC, "privateField" ASC',
    'kinda integrational test for options'
  )

  t.end()
})

test('adapter.find()', (t) => {
  t.plan(11)

  const options = {dsn: 'DB'}
  let recordTypes = {}

  const dbClientMock = {
    query (sqlQuery, cb) {
      t.pass('it calls this.query()')
      t.equal(sqlQuery, 'SELECT * FROM "table"')

      let rows = [{some: 'data'}, {some: 'data1'}]
      cb(undefined, rows)
    }
  }
  GLOBAL.odbcMock.open = (_, cb) => cb(undefined, dbClientMock)

  recordTypes.aType = { name: { type: String } }
  const adapter = new Adapter({options, recordTypes})

  t.throws(
    () => adapter.find('undescribedType'),
    /find: there is no "undescribedType" described/
  )

  t.throws(
    () => adapter.find('aType'),
    /there is no opened db-connection/
  )

  // mocks
  adapter._buildSelectQuery = (type, options) => {
    t.pass('it calls this._buildSelectQuery()')
    t.equal(type, 'aType', 'it passes type')
    t.deepEqual(options, { match: { deleted: false } }, 'it passes options')
    return 'SELECT * FROM "table"'
  }
  adapter.outputRecord = (type, record) => {
    t.pass('it calls this.outputRecord() for every record')
    return record
  }

  adapter.connect()

  .then(() => adapter.find('aType', { ids: [/* empty ids */] }))
  .then((rows) => t.deepEqual(rows, [], 'with empty ids it returns []'))

  .then(() => adapter.find('aType', { match: { deleted: false } }))
  .then((rows) => t.deepEqual(
    rows,
    [{some: 'data'}, {some: 'data1'}],
    'it returns type-casted selected records'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('adapter.find(): ensure unique options.ids', (t) => {
  t.plan(2)

  const dbClientMock = {
    query (sqlQuery, cb) { cb(undefined, [{some: 'data'}, {some: 'data1'}]) }
  }
  GLOBAL.odbcMock.open = (_, cb) => cb(undefined, dbClientMock)

  const recordTypes = {
    aType: { name: { type: String } }
  }
  const adapter = new Adapter({options: {dsn: 'DB'}, recordTypes})

  // mocks
  adapter._buildSelectQuery = (_, options) => {
    t.deepEqual(options.ids, [3, 2, 1], 'it ensures that ids are unique')
    return 'SELECT * FROM "table" WHERE id IN (3, 2, 1)'
  }
  adapter.outputRecord = (_, record) => record

  adapter.connect()

  .then(() => adapter.find('aType', { ids: [3, 3, 2, 2, 1, 1] }))
  .then((rows) => t.equal(rows.length, 2))

  .catch(t.fail)
  .then(t.end)
})

test('adapter.outputRecord(type, record)', (t) => {
  let recordTypes = {}
  recordTypes.user = {
    $id: 'UserID',
    $table: 'sPersonal',
    name: { type: String },
    deleted: { type: Boolean, $fname: 'hide' },
    counter: { type: Number },
    privateField: { private: true, type: Number },
    group: { link: 'userGroup', $fname: 'GrpID' }, // belongsTo
    posts: { link: 'post', inverse: 'user', isArray: true } // hasMany
  }
  const adapter = new Adapter({recordTypes})

  let record

  record = {
    id: '123'
  }
  t.deepEqual(
    adapter.outputRecord('user', record),
    {
      id: 123
    },
    'all ids are of Number type'
  )

  record = {
    name: 'John Stench',
    privateField: '2442'
  }
  t.deepEqual(
    adapter.outputRecord('user', record),
    {
      name: 'John Stench'
    },
    'it ensures that private fields are filtered out'
  )

  record = {
    group: '41' // belongsTo
  }
  t.deepEqual(
    adapter.outputRecord('user', record),
    {
      group: 41
    },
    'belongsTo foreign key is Number'
  )

  record = {
    id: '123',
    name: 'John Stench',
    deleted: '0',
    counter: '333',
    privateField: '2442',
    group: '41' // belongsTo
  }
  t.deepEqual(
    adapter.outputRecord('user', record),
    {
      id: 123,
      name: 'John Stench',
      deleted: false,
      counter: 333,
      group: 41
    },
    "it casts odbc types to JavaScript's"
  )

  record = { unknownFieldName: 'some value' }
  t.throws(
    () => adapter.outputRecord('user', record),
    /there is no 'unknownFieldName' field in 'user'; this should not happen/,
    'edge case: undescribed field from odbc layer'
  )

  record = { posts: 'some value' }
  t.throws(
    () => adapter.outputRecord('user', record),
    /hasMany relation 'posts' field in 'user'; this should not happen/,
    'edge case: hasMany field from odbc layer'
  )

  record = { name: undefined }
  t.throws(
    () => adapter.outputRecord('user', record),
    /'user':'name' field is undefined; this should not happen/,
    'edge case: undefined value from odbc layer'
  )

  t.end()
})

test('adapter.delete(type, ids)', (t) => {
  t.plan(9)

  const dbClientMock = {
    counter: 0,
    query (sqlQuery, cb) {
      t.pass('it calls this.query()') // twice

      const numberOfdeletedRows = 3

      if (this.counter === 0) {
        t.equal(
          sqlQuery,
          'SELECT COUNT(*) as "count" FROM "tableName" WHERE "idName" IN (1, 2, 3)',
          'it first determines the number of the would be deleted rows. (fix for odbc)'
        )
        this.counter++
        return cb(undefined, [{count: numberOfdeletedRows}])
      }

      if (this.counter === 1) {
        t.equal(
          sqlQuery,
          'DELETE FROM "tableName" WHERE "idName" IN (1, 2, 3)',
          'it then deletes rows'
        )
        this.counter++
        return cb(undefined, undefined) // returns nothing in the case of success
      }

      if (this.counter > 1) t.fail('it should not call dbClient.query() more than two times')
    }
  }
  GLOBAL.odbcMock.open = (_, cb) => cb(undefined, dbClientMock)

  const recordTypes = { aType: {
    $id: 'idName',
    $table: 'tableName',
    name: { type: String }
  } }
  const adapter = new Adapter({recordTypes, options: {dsn: 'DB'}})

  t.throws(
    () => adapter.delete('undescribedType'),
    /there is no "undescribedType" described/
  )

  adapter.connect()

  .then(() => adapter.delete('aType', []))
  .then((count) => {
    t.pass('it returns resolved Promise')
    t.equal(count, 0, 'with empty ids it is a no-op')
  })

  .then(() => adapter.delete('aType', [1, 2, 3]))
  .then((count) => {
    t.pass('in the case of success it resolves OK')
    t.equal(count, 3, 'it returns number of deleted rows')
  })

  .catch(t.fail)
  .then(t.end)
})

test('adapter.delete(type, ids) ensures that ids are unique', (t) => {
  t.plan(3)

  const dbClientMock = {
    counter: 0,
    query (sqlQuery, cb) {
      const numberOfdeletedRows = 3

      if (this.counter === 0) {
        this.counter++
        return cb(undefined, [{count: numberOfdeletedRows}])
      }

      return cb(undefined, undefined) // returns nothing in the case of success
    }
  }
  GLOBAL.odbcMock.open = (_, cb) => cb(undefined, dbClientMock)

  const recordTypes = { aType: { name: { type: String } } }
  const adapter = new Adapter({recordTypes, options: {dsn: 'DB'}})

  // mock
  adapter._buildEndOfQueryForDelete = (type, ids) => {
    t.deepEqual(ids, [1, 2, 3], 'it ensures ids are unique')
    return 'WHERE "idName" IN (1, 2, 3)'
  }

  adapter.connect()

  .then(() => adapter.delete('aType', [1, 1, 2, 2, 3, 3]))
  .then(() => t.pass('it resolves OK'))

  .catch(t.fail)
  .then(t.end)
})

test('adapter.delete(type, ids) with undefined ids', (t) => {
  t.plan(5)

  const dbClientMock = {
    counter: 0,
    query (sqlQuery, cb) {
      t.pass('it calls this.query()') // twice

      const numberOfdeletedRows = 33

      if (this.counter === 0) {
        t.equal(
          sqlQuery,
          'SELECT COUNT(*) as "count" FROM "tableName"',
          'it counts all rows. (fix for odbc)'
        )
        this.counter++
        return cb(undefined, [{count: numberOfdeletedRows}])
      }

      if (this.counter === 1) {
        t.equal(
          sqlQuery,
          'DELETE FROM "tableName"',
          'it then deletes all rows'
        )
        this.counter++
        return cb(undefined, undefined) // returns nothing in the case of success
      }

      if (this.counter > 1) t.fail('it should not call dbClient.query() more than two times')
    }
  }
  GLOBAL.odbcMock.open = (_, cb) => cb(undefined, dbClientMock)

  const recordTypes = { aType: {
    $id: 'idName',
    $table: 'tableName',
    name: { type: String }
  } }
  const adapter = new Adapter({recordTypes, options: {dsn: 'DB'}})

  adapter.connect()

  .then(() => adapter.delete('aType' /* ids is undefined */))
  .then((count) => t.equal(count, 33, 'it returns number of all rows'))

  .catch(t.fail)
  .then(t.end)
})

test('adapter._buildEndOfQueryForDelete(type, ids)', (t) => {
  let recordTypes = {}

  recordTypes.user = {/* empty */}
  t.equal(
    new Adapter({recordTypes})._buildEndOfQueryForDelete('user'),
    'FROM "user"',
    'with empty `ids` it deletes all rows'
  )

  recordTypes.user = {
    $table: 'sPersonal'
  }
  t.equal(
    new Adapter({recordTypes})._buildEndOfQueryForDelete('user'),
    'FROM "sPersonal"',
    'it uses `$table` for table name'
  )

  recordTypes.user = {
    $id: 'UserID',
    $table: 'sPersonal'
  }
  t.equal(
    new Adapter({recordTypes})._buildEndOfQueryForDelete('user', [100, 101, 123]),
    'FROM "sPersonal" WHERE "UserID" IN (100, 101, 123)',
    'it deletes only provided `ids` and uses provided `$id`'
  )

  t.end()
})

test('adapter.create(type, records)', (t) => {
  t.plan(11)

  const options = {dsn: 'DB'}

  const dbClientMock = {
    query (sqlQuery, cb) {
      t.pass('it calls this.query()')

      const maxIdResult = [{newid: '3'}]
      cb(undefined, maxIdResult)
    }
  }
  GLOBAL.odbcMock.open = (_, cb) => cb(undefined, dbClientMock)

  const recordTypes = {
    aType: { name: { type: String } }
  }
  const adapter = new Adapter({options, recordTypes})

  t.throws(
    () => adapter.create('undescribedType'),
    /there is no "undescribedType" described/
  )

  t.throws(
    () => adapter.create('aType' /* records undefined */),
    /records argument is undefined/
  )

  t.throws(
    () => adapter.create('aType', 'the records are not an Array'),
    /records should be of Array type/
  )

  // mocks
  adapter._buildCreateQuery = (type, record) => {
    t.pass('it calls this._buildCreateQuery() for every record')
    return 'INSERT ...'
  }
  adapter._buildGetNewIdQuery = (type) => {
    t.pass('it calls this._buildGetNewIdQuery() for every record')
    return 'SELECT MAX("id") as "newid" FROM "aType"'
  }
  adapter.find = (type, options) => {
    t.pass('it calls this.find({ids: newIds})')
    t.deepEqual(options, {ids: [3]}, 'new id for every inserted record is provided')

    const fetchedRecords = [{id: 3, name: 'new name'}]
    return fetchedRecords
  }

  adapter.connect()

  .then(() => adapter.create('aType', [/* empty records */]))
  .then((rows) => t.deepEqual(rows, [], 'with empty records it returns []'))

  .then(() => adapter.create('aType', [{name: 'new name'}]))
  .then((rows) => t.deepEqual(
    rows,
    [{id: 3, name: 'new name'}],
    'it returns type-casted records with autoincremented by db-engine ids'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('adapter._buildGetNewIdQuery(type)', (t) => {
  let recordTypes = {}

  recordTypes.user = {/* empty */}
  t.equal(
    new Adapter({recordTypes})._buildGetNewIdQuery('user'),
    'SELECT MAX("id") as "newid" FROM "user"',
    'if neither $id nor $table has been provided'
  )

  recordTypes.user = {
    $id: 'UserID',
    $table: 'sPersonal'
  }
  t.equal(
    new Adapter({recordTypes})._buildGetNewIdQuery('user'),
    'SELECT MAX("UserID") as "newid" FROM "sPersonal"',
    'with $id and $table has been provided'
  )

  t.end()
})

test('adapter._buildCreateQuery(type, record)', (t) => {
  const recordTypes = { user: {
    $id: 'UserID',
    $table: 'sPersonal',
    name: { type: String },
    deleted: { type: Boolean, $fname: 'hide' },
    group: { link: 'group', $fname: 'GrpID' },
    posts: { link: 'post', isArray: true },
    someArrayField: { type: Number, isArray: true },
    privateField: { private: true, type: Number }
  } }
  const adapter = new Adapter({recordTypes})

  let record

  record = {
    name: 'new name',
    deleted: false
  }
  t.equal(
    adapter._buildCreateQuery('user', record),
    'INSERT INTO "sPersonal" ("name", "hide") VALUES (\'new name\', false)',
    'builds INSERT query for provided data fields only'
  )

  record = {
    group: 12
  }
  t.equal(
    adapter._buildCreateQuery('user', record),
    'INSERT INTO "sPersonal" ("GrpID") VALUES (12)',
    'works with belongsTo fields'
  )

  record = {
    privateField: 312
  }
  t.equal(
    adapter._buildCreateQuery('user', record),
    'INSERT INTO "sPersonal" ("privateField") VALUES (312)',
    'works with private fields as well'
  )

  record = {
    posts: 'data'
  }
  t.throws(
    () => adapter._buildCreateQuery('user', record),
    /inserting of hasMany this way is not implemented\. use inverse belongsTo/,
    'it is not the Adapter`s concern'
  )

  record = {
    someArrayField: [1, 2, 3]
  }
  t.throws(
    () => adapter._buildCreateQuery('user', record),
    /inserting of isArray values is not implemented/,
    'yet'
  )

  record = {
    unknownFieldName: 'data'
  }
  t.throws(
    () => adapter._buildCreateQuery('user', record),
    /create: 'user' model does not contain 'unknownFieldName' field/,
    'throws if unknown field has been provided'
  )

  t.end()
})

test('adapter.update(type, records)', (t) => {
  t.plan(11)

  const options = {dsn: 'DB'}

  const dbClientMock = {
    query (sqlQuery, cb) {
      t.pass('it calls this.query()')
      cb(undefined, [{id: 1}])
    }
  }
  GLOBAL.odbcMock.open = (_, cb) => cb(undefined, dbClientMock)

  const recordTypes = {
    aType: { name: { type: String } }
  }
  const adapter = new Adapter({options, recordTypes})

  // mocks
  adapter._buildUpdateQuery = (type, record) => {
    t.pass('it calls this._buildUpdateQuery() for every record')
    return 'UPDATE ...'
  }

  t.throws(
    () => adapter.update('undescribedType'),
    /there is no "undescribedType" described/
  )

  t.throws(
    () => adapter.update('aType' /* records undefined */),
    /records argument is undefined/
  )

  t.throws(
    () => adapter.update('aType', 'the records are not an Array'),
    /records should be of Array type/
  )

  adapter.connect()

  .then(() => adapter.update('aType', [/* empty records */]))
  .then((res) => t.equal(res, 0, 'with empty records it is a no-op'))
  .catch(t.fail)

  .then(() => adapter.update('aType', [
    {id: 1, name: 'new name'},
    {id: 2, name: 'next'},
    {id: 3, name: 'third name'}
  ]))
  .then(() => t.pass('it resolves positive'))

  .catch(t.fail)
  .then(t.end)
})

test('adapter._buildDoesRowExist(type, id)', (t) => {
  let recordTypes = {}

  recordTypes.user = {/* empty */}
  t.equal(
    new Adapter({recordTypes})._buildDoesRowExist('user', 3),
    'SELECT "id" FROM "user" WHERE "id"=3',
    'if neither $id nor $table has been provided'
  )

  recordTypes.user = {
    $id: 'UserID',
    $table: 'sPersonal'
  }
  t.equal(
    new Adapter({recordTypes})._buildDoesRowExist('user', 123),
    'SELECT "UserID" FROM "sPersonal" WHERE "UserID"=123',
    'with $id and $table has been provided'
  )

  const adapter = new Adapter({recordTypes})
  t.throws(
    () => adapter._buildDoesRowExist('user', undefined),
    /update: the record has no "id"/
  )

  t.throws(
    () => adapter._buildDoesRowExist('user', null),
    /update: the record has no "id"/
  )

  t.end()
})

test('adapter._buildUpdateQuery(type, record)', (t) => {
  const recordTypes = { user: {
    $id: 'UserID',
    $table: 'sPersonal',
    name: { type: String },
    deleted: { type: Boolean, $fname: 'hide' },
    group: { link: 'group', $fname: 'GrpID' },
    posts: { link: 'post', isArray: true },
    privateField: { private: true, type: Number }
  } }
  const adapter = new Adapter({recordTypes})

  let record

  record = {
    id: 33,
    name: 'new name',
    deleted: false
  }
  t.equal(
    adapter._buildUpdateQuery('user', record),
    'UPDATE "sPersonal"' +
    ' SET "name"=\'new name\', "hide"=false' +
    ' WHERE "UserID"=33',
    'builds UPDATE query for provided data fields only'
  )

  record = {
    id: 33,
    group: 12
  }
  t.equal(
    adapter._buildUpdateQuery('user', record),
    'UPDATE "sPersonal"' +
    ' SET "GrpID"=12' +
    ' WHERE "UserID"=33',
    'works with belongsTo fields'
  )

  record = {
    id: 33,
    privateField: 312
  }
  t.equal(
    adapter._buildUpdateQuery('user', record),
    'UPDATE "sPersonal"' +
    ' SET "privateField"=312' +
    ' WHERE "UserID"=33',
    'works with private fields as well'
  )

  record = {
    id: 33,
    posts: 'data'
  }
  t.throws(
    () => adapter._buildUpdateQuery('user', record),
    /updating of hasMany is not implemented/,
    'it is not the Adapter`s concern'
  )

  record = {
    id: 33,
    unknownFieldName: 'data'
  }
  t.throws(
    () => adapter._buildUpdateQuery('user', record),
    /update: 'user' model does not contain 'unknownFieldName' field/,
    'throws if unknown field has been provided'
  )

  t.end()
})
