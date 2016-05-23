'use strict'

const test = require('tape')

const config = require('../config.js')

const Adapter = require('./index')

test('adapter.connect()', (t) => {
  const adapter = new Adapter({options: {dsn: config.d2alias}})

  adapter.connect()
  .then(() => t.ok(adapter.dbClient, 'it saves opened odbc-client'))
  .catch(t.fail)
  .then(() => adapter.dbClient && adapter.dbClient.close())
  .then(t.end)
})

test('adapter.disconnect()', (t) => {
  const adapter = new Adapter({options: {dsn: config.d2alias}})
  adapter.connect()

  .then(() => adapter.disconnect())
  .then(() => t.pass('it returns successfully resolved promise'))
  .then(() => t.equal(adapter.dbClient, undefined, 'it removes link to the odbc client'))

  .catch(t.fail)
  .then(t.end)
})

test('adapter transaction start / end', (t) => {
  const adapter = new Adapter({options: {dsn: config.d2alias}})

  adapter.beginTransaction()
  .then((transaction) => {
    t.pass('transaction started')
    t.ok(transaction, 'transaction object')
    return transaction
  })

  .then((transaction) =>
    transaction.query('DELETE FROM fCheckInfo')
    .then(() => t.pass('delete query OK'))
    .then(() => transaction)
  )

  .then((transaction) => transaction.endTransaction())
  .then(() => t.pass('transaction ended'))

  .catch(t.fail)
  .then(() => adapter.dbClient && adapter.dbClient.close())
  .then(t.end)
})

test('adapter transaction with inserting data and aborting', (t) => {
  const adapter = new Adapter({options: {dsn: config.d2alias}})

  // clean the table for test
  adapter.connect()
  .then(() => adapter.query('DELETE FROM fCheckInfo'))
  .then(() => adapter.disconnect())
  .catch(t.fail)

  // test a successful transaction
  .then(() => adapter.beginTransaction())
  .then(() => adapter.query("INSERT INTO fCheckInfo VALUES (0, 'INFORMATION')"))
  .then(() => adapter.endTransaction())
  .catch(t.fail)
  .then(() => t.pass('transaction is successfull'))
  // check saved data
  .then(() => adapter.connect())
  .then(() => adapter.query('SELECT info FROM fCheckInfo'))
  .then((rows) => t.deepEqual(rows, [ { info: 'INFORMATION' } ], 'a row has been saved'))
  .then(() => adapter.disconnect())
  .catch(t.fail)

  // test transaction aborting
  .then(() => adapter.beginTransaction())

  .then(() => adapter.query("INSERT INTO fCheckInfo VALUES (0, 'some info')"))
  .then(() => adapter.query("INSERT INTO fCheckInfo VALUES (0, 'some another info')"))
  .then(() => adapter.query("INSERT INTO fCheckInfo VALUES (0, 'and yet other info')"))
  .then(() => adapter.query('SELECT * FROM fCheckInfo'))
  .catch(t.fail)
  .then((rows) => t.deepEqual(rows, [
    { ID: '4', Info: 'and yet other info' },
    { ID: '3', Info: 'some another info' },
    { ID: '2', Info: 'some info' },
    { ID: '1', Info: 'INFORMATION' }
  ], 'table state in the middle of transaction'))

  .then(() => adapter.endTransaction(new Error('abort transaction')))
  .catch((e) => t.equal(e.message, 'abort transaction', 'it aborts transaction'))

  // check data table state after transation abortion
  .then(() => adapter.connect())
  .then(() => adapter.query('SELECT * FROM fCheckInfo'))
  .then((rows) => t.deepEqual(rows, [
    { ID: '1', Info: 'INFORMATION' }
  ], 'there is no inserted rows because of aborted transaction'))
  .then(() => adapter.disconnect())

  .catch(t.fail)
  .then(t.end)
})

test('adapter: odbc + Promise.all() check', (t) => {
  const adapter = new Adapter({options: {dsn: config.d2alias}})

  let numRows

  adapter.connect()
  .then(() => adapter.query('SELECT COUNT(*) as num FROM sPersonal'))
  .then((rows) => { numRows = +(rows[0].num) })

  .then(() => adapter.query('SELECT PersID as id FROM sPersonal'))
  .then((rows) => {
    const ids = rows.map((row) => row.id)
    t.equal(ids.length, numRows)
    return ids
  })

  .then((ids) => Promise.all(ids.map((id) => adapter.query(`SELECT * FROM sPersonal WHERE PersID=${id}`))))
  .then((results) => t.equal(results.length, numRows))

  .then(() => adapter.disconnect())

  .catch(t.fail)
  .then(t.end)
})
