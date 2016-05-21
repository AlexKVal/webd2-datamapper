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
  .catch((e) => t.fail(e))
  .then(() => t.end())
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

  .catch((e) => t.fail(e))
  .then(() => t.end())
})
