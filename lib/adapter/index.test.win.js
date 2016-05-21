'use strict'

const test = require('tape')

const config = require('../config.js')

const Adapter = require('./index')

test('adapter.connect()', (t) => {
  const adapter = new Adapter({options: {dsn: config.d2alias}})

  adapter.connect()
  .then(() => {
    t.ok(adapter.dbClient, 'it saves opened odbc-client')
  })
  .catch((e) => t.fail(e))
  .then(() => adapter.dbClient.close())
  .then(() => t.end())
})

test('adapter.disconnect()', (t) => {
  const adapter = new Adapter({options: {dsn: config.d2alias}})
  adapter.connect()

  .then(() => adapter.disconnect())
  .then(() => t.pass('it returns successfully resolved promise'))
  .then(() => t.equal(adapter.dbClient, undefined, 'it removes link to the odbc client'))

  .catch((e) => t.fail(e))
  .then(() => t.end())
})
