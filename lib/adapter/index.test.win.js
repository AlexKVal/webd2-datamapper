'use strict'

const test = require('tape')

const config = require('../config.js')
const options = {dsn: config.d2alias}

const Adapter = require('./index')

test('adapter.connect()', (t) => {
  const adapter = new Adapter({options})

  adapter.connect()
  .then(() => t.ok(adapter.dbClient, 'it saves opened odbc-client'))
  .catch(t.fail)
  .then(() => adapter.dbClient && adapter.dbClient.close())
  .then(t.end)
})

test('adapter.disconnect()', (t) => {
  const adapter = new Adapter({options})
  adapter.connect()

  .then(() => adapter.disconnect())
  .then(() => t.pass('it returns successfully resolved promise'))
  .then(() => t.equal(adapter.dbClient, undefined, 'it removes link to the odbc client'))

  .catch(t.fail)
  .then(t.end)
})

test('adapter transaction start / end', (t) => {
  const adapter = new Adapter({options})

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
  const adapter = new Adapter({options})

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
  const adapter = new Adapter({options})

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

const initialData = {
  groups: [
    {name: 'Admins', hide: false},
    {name: 'Users', hide: false},
    {name: 'Officers', hide: true}
  ],
  users: [
    {name: 'John', hide: false, config: 1, grpid: 1, password: '333'},
    {name: 'Smith', hide: false, config: 3, grpid: 1, password: '123'},
    {name: 'Johanna', hide: false, config: 2, grpid: 2, password: '321'},
    {name: 'Ann', hide: true, config: 3, grpid: 2, password: '11111'},
    {name: 'Makbeth', hide: false, config: 3, grpid: 2, password: 'fffgg'}
  ]
}

const recordTypes = {
  user: {
    $id: 'PersID',
    $table: 'TestUser',
    name: {type: String},
    deleted: {type: Boolean, $fname: 'hide'},
    config: {private: true, type: Number},
    password: {private: true, type: String},
    group: {link: 'group', $fname: 'GrpID'}
  },
  group: {
    $id: 'GrpID',
    $table: 'TestGroup',
    name: {type: String},
    deleted: {type: Boolean, $fname: 'hide'}
  }
}

function prepareTestTables (t, initialData) {
  const adapter = new Adapter({options})

  return adapter.connect()

  // tables and data preparation
  .then(() => adapter.query("SELECT Xf$Id FROM X$File WHERE Xf$Name='TestUser'"))
  .then((res) => {
    return res.length && adapter.query('DROP TABLE TestUser')
  })
  .then(() => adapter.query(
    "CREATE TABLE TestUser USING 'testuser.mkd'" +
    ' (PersID AUTOINC(4),' +
    ' Name ZSTRING(31),' +
    ' Hide LOGICAL(1),' +
    ' Config INT(1),' +
    ' GrpID INT(2),' +
    ' Password ZSTRING(7))' +
    'WITH INDEX (PersID UNIQUE)'
  ))
  .then(() => t.pass('TestUser table has been created'))

  .then(() => adapter.query("SELECT Xf$Id FROM X$File WHERE Xf$Name='TestGroup'"))
  .then((res) => {
    return res.length && adapter.query('DROP TABLE TestGroup')
  })
  .then(() => adapter.query(
    "CREATE TABLE TestGroup USING 'testgroup.mkd'" +
    ' (GrpID AUTOINC(4),' +
    ' Name ZSTRING(31),' +
    ' Hide LOGICAL(1))' +
    'WITH INDEX (GrpID UNIQUE)'
  ))
  .then(() => t.pass('TestGroup table has been created'))

  .then(() => {
    return Promise.all(initialData.groups.map((g) =>
      adapter.query(`INSERT INTO TestGroup (Name, Hide) VALUES ('${g.name}', ${g.hide})`)))
  })
  .then(() => t.pass('TestGroup has been populated'))

  .then(() => {
    return Promise.all(initialData.users.map((u) =>
      adapter.query('INSERT INTO TestUser (Name, Hide, Config, GrpID, Password)' +
      ` VALUES ('${u.name}', ${u.hide}, ${u.config}, ${u.grpid}, '${u.password}')`)))
  })
  .then(() => t.pass('TestUser has been populated'))

  .then(() => adapter.disconnect())
  .catch(t.fail)
}

test('I&T adapter.find()', (t) => {
  const adapter = new Adapter({recordTypes, options})

  prepareTestTables(t, initialData)

  .then(() => adapter.connect())

  .then(() => adapter.find('group'))
  .then((groups) => t.deepEqual(
    groups,
    [
      {id: 1, name: 'Admins', deleted: false},
      {id: 2, name: 'Users', deleted: false},
      {id: 3, name: 'Officers', deleted: true}
    ],
    'by default it fetches all rows'
  ))

  .then(() => adapter.find('user'))
  .then((users) => t.deepEqual(
    users,
    [
      {id: 1, name: 'John', deleted: false, group: 1},
      {id: 2, name: 'Smith', deleted: false, group: 1},
      {id: 3, name: 'Johanna', deleted: false, group: 2},
      {id: 4, name: 'Ann', deleted: true, group: 2},
      {id: 5, name: 'Makbeth', deleted: false, group: 2}
    ],
    'by default it fetches all rows'
  ))

  .then(() => adapter.find('user', { fieldsOnly: ['name', 'group'] }))
  .then((users) => t.deepEqual(
    users,
    [
      {name: 'John', group: 1},
      {name: 'Smith', group: 1},
      {name: 'Johanna', group: 2},
      {name: 'Ann', group: 2},
      {name: 'Makbeth', group: 2}
    ],
    'fieldsOnly'
  ))

  .then(() => adapter.find('user', { match: { deleted: true } }))
  .then((users) => t.deepEqual(
    users,
    [
      {id: 4, name: 'Ann', deleted: true, group: 2}
    ],
    'match filtering'
  ))

  .then(() => adapter.find('user', { range: { config: [3, null] } }))
  .then((users) => t.deepEqual(
    users,
    [
      {id: 2, name: 'Smith', deleted: false, group: 1},
      {id: 4, name: 'Ann', deleted: true, group: 2},
      {id: 5, name: 'Makbeth', deleted: false, group: 2}
    ],
    'range by private field "config >= 3"'
  ))

  .then(() => adapter.find('user', { sort: { group: false, name: true } }))
  .then((users) => t.deepEqual(
    users,
    [
      {id: 4, name: 'Ann', deleted: true, group: 2},
      {id: 3, name: 'Johanna', deleted: false, group: 2},
      {id: 5, name: 'Makbeth', deleted: false, group: 2},
      {id: 1, name: 'John', deleted: false, group: 1},
      {id: 2, name: 'Smith', deleted: false, group: 1}
    ],
    'sorting'
  ))

  .then(() => adapter.find('user', { ids: [3, 1, 5] }))
  .then((users) => t.deepEqual(
    users,
    [
      {id: 1, name: 'John', deleted: false, group: 1},
      {id: 3, name: 'Johanna', deleted: false, group: 2},
      {id: 5, name: 'Makbeth', deleted: false, group: 2}
    ],
    'find by [ids]'
  ))

  .then(() => adapter.find('user', { ids: [1], match: { password: '333' } }))
  .then((users) => t.deepEqual(
    users,
    [
      {id: 1, name: 'John', deleted: false, group: 1}
    ],
    'matching against private data. e.g. password checking'
  ))

  .then(() => adapter.disconnect())

  .catch(t.fail)
  .then(t.end)
})

test('I&T adapter.delete()', (t) => {
  const adapter = new Adapter({recordTypes, options})

  prepareTestTables(t, initialData)

  .then(() => adapter.connect())

  .then(() => adapter.delete('group', [/* empty ids array */]))
  .then((count) => t.equal(count, 0, 'it is a no-op if ids=[]'))
  .then(() => adapter.find('group'))
  .then((groups) => t.equal(groups.length, 3, 'there is 3 rows left'))

  .then(() => adapter.delete('group' /* ids undefined */))
  .then((count) => t.equal(count, 3, 'it deletes all rows if no `ids` provided'))
  .then(() => adapter.find('group'))
  .then((groups) => t.equal(groups.length, 0, 'there is no rows left'))

  .then(() => adapter.delete('user', [1, 3, 5]))
  .then((count) => t.equal(count, 3, 'it deletes all rows if no `ids` provided'))
  .then(() => adapter.find('user'))
  .then((users) => t.deepEqual(
    users,
    [
      {id: 2, name: 'Smith', deleted: false, group: 1},
      {id: 4, name: 'Ann', deleted: true, group: 2}
    ],
    'two rows left'
  ))

  .then(() => adapter.disconnect())

  .catch(t.fail)
  .then(t.end)
})
