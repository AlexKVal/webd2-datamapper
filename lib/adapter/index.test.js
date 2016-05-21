'use strict'

const test = require('tape')

GLOBAL.odbcMock = {}

const Adapter = require('./index')

test('Adapter', (t) => {
  t.throws(
    () => new Adapter({options: {/* no dsn */}}),
    /dsn option is required/,
    'DSN for ODBC driver is required option'
  )

  t.end()
})

test('adapter.connect()', (t) => {
  t.plan(3)

  const dbClientMock = {}

  GLOBAL.odbcMock.open = (connectionString, callback) => {
    t.pass('it calls odbc.open() method')
    t.equal(connectionString, 'DSN=DBALIAS')
    callback(undefined, dbClientMock)
  }

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

  const adapter = new Adapter({options: {dsn: 'DBALIAS'}})
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
    }
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
    }
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
