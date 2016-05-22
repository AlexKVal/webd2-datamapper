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
    'id',
    'default id field name is `id`'
  )

  recordTypes.aType = {
    $id: 'PersID'
  }
  t.equal(
    new Adapter({recordTypes})._selectFieldsPart('aType'),
    'PersID as id',
    "custom id field name could be provided with `$id: 'customName'`"
  )

  recordTypes.aType = {
    name: { type: String },
    deleted: { type: Boolean, $fname: 'hide' }, // custom field name
    privateField: { private: true, type: Number }
  }
  t.equal(
    new Adapter({recordTypes})._selectFieldsPart('aType'),
    'id, name, hide as deleted',
    'returns only public data fields'
  )

  recordTypes.aType = {
    group: { link: 'userGroup', $fname: 'GrpID' },
    rights: { link: 'rights' },
    posts: { link: 'post', inverse: 'user', isArray: true } // hasMany
  }
  t.equal(
    new Adapter({recordTypes})._selectFieldsPart('aType'),
    'id, GrpID as group, rights',
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
    'UserID as id, name, hide as deleted, counter, GrpID as group',
    'w/o `fieldsOnly`: id field, public data fields, and belongsTo relation fields'
  )

  let fieldsOnly = ['id', 'deleted', 'group']
  t.equal(
    new Adapter({recordTypes})._selectFieldsPart('user', fieldsOnly),
    'UserID as id, hide as deleted, GrpID as group',
    'with `fieldsOnly` provided'
  )

  fieldsOnly = ['deleted', 'name']
  t.equal(
    new Adapter({recordTypes})._selectFieldsPart('user', fieldsOnly),
    'name, hide as deleted',
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
    'WHERE UserID IN (321, 333, 22, 33)',
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
    'WHERE counter=1 AND hide=false',
    'options.match for field with $fname'
  )

  options = { match: {
    privateField: 13
  } }
  t.equal(
    adapter._wherePart('user', options),
    'WHERE privateField=13',
    'options.match works with private fields'
  )

  options = { match: {
    name: [ 'joe', 'bob' ],
    counter: [1, 2, 3]
  } }
  t.equal(
    adapter._wherePart('user', options),
    "WHERE name IN ('joe', 'bob') AND counter IN (1, 2, 3)",
    'options.match works with array values; IN (...)'
  )

  t.end()
})

test('adapter._buildSelectQuery(type, options)', (t) => {
  let recordTypes = {}

  recordTypes.user = {/* empty */}
  t.equal(
    new Adapter({recordTypes})._buildSelectQuery('user'),
    'SELECT id FROM user',
    'with empty model schema select `ids`'
  )

  recordTypes.user = {
    $table: 'sPersonal'
  }
  t.equal(
    new Adapter({recordTypes})._buildSelectQuery('user'),
    'SELECT id FROM sPersonal',
    'it uses `$table` for table name'
  )

  recordTypes.user = {
    $id: 'PersID'
    /* no $table */
  }
  t.equal(
    new Adapter({recordTypes})._buildSelectQuery('user'),
    'SELECT PersID as id FROM user',
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
    'SELECT UserID as id, name, hide as deleted, counter, GrpID as group FROM sPersonal',
    'by default it builds SELECT query for extracting of all rows w/ public fields'
  )

  t.end()
})

test('adapter.find()', (t) => {
  t.plan(7)

  const options = {dsn: 'DB'}
  let recordTypes = {}

  const dbClientMock = {
    query (sqlQuery, cb) {
      t.pass('it calls this.query()')
      t.equal(sqlQuery, 'SELECT * FROM table')

      let rows = [{some: 'data'}, {some: 'data1'}]
      cb(undefined, rows)
    }
  }
  GLOBAL.odbcMock.open = (_, cb) => cb(undefined, dbClientMock)

  recordTypes.aType = { name: { type: String } }
  const adapter = new Adapter({options, recordTypes})

  t.throws(
    () => adapter.find('undescribedType'),
    /there is no "undescribedType" described/
  )

  t.throws(
    () => adapter.find('aType'),
    /there is no opened db-connection/
  )

  // mock it
  adapter._buildSelectQuery = (type, options) => {
    t.pass('it calls this._buildSelectQuery()')
    return 'SELECT * FROM table'
  }

  adapter.connect()

  .then(() => adapter.find('aType', { ids: [/* empty ids */] }))
  .then((rows) => t.deepEqual(rows, [], 'with empty ids it returns []'))

  .then(() => adapter.find('aType'))
  .then((rows) => t.deepEqual(
    rows,
    [{some: 'data'}, {some: 'data1'}],
    'by default it returns all rows with all public fields'
  ))

  .catch(t.fail)
  .then(t.end)
})
