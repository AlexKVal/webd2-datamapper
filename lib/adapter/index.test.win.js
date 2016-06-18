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

test('adapter.endTransaction() closes connection in case of error as well', (t) => {
  const adapter = new Adapter({options})

  adapter.beginTransaction()
  .then((transaction) => {
    t.pass('transaction started')
    t.ok(transaction, 'transaction object exists')
    return transaction
  })

  .then((transaction) => transaction.endTransaction())
  .then(() => t.pass('normal transaction end'))
  .then(() => t.equal(adapter.dbClient, undefined, 'db-connection should be closed'))

  .then(() => adapter.beginTransaction())
  .then((transaction) => {
    t.pass('transaction started')
    t.ok(transaction, 'transaction object exists')
    return transaction
  })

  .then((transaction) => transaction.endTransaction(new Error('some error')))
  .then(() => t.pass('end transaction with error'))
  .catch((e) => t.equal(e.message, 'some error', 'adapter re-throws error'))
  .then(() => t.equal(adapter.dbClient, undefined, 'but db-connection should be closed anyway'))

  .then(() => adapter.connect())
  .then(() => t.pass('it is OK to open next db-connection'))
  .then(() => adapter.disconnect())
  .then(() => t.equal(adapter.dbClient, undefined))

  .catch(t.fail)
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

test.skip('adapter: odbc + Promise.all() check', (t) => {
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

const {recordTypes, initialData, prepareTestTables} = require('./_prepare-test-db')

test('I&T adapter.find()', (t) => {
  const adapter = new Adapter({recordTypes, options})

  prepareTestTables(initialData)

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

  prepareTestTables(initialData)

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

test('I&T adapter.create()', (t) => {
  const adapter = new Adapter({recordTypes, options})

  prepareTestTables({groups: [], users: []}) // we need empty tables

  .then(() => adapter.connect())

  .then(() => adapter.find('group'))
  .then((groups) => t.equal(groups.length, 0, 'there is no rows at the beginning'))
  .then(() => adapter.create('group', [
    { name: 'Admins' },
    { name: 'Users' },
    { name: 'Waiters', deleted: true }
  ]))
  .then((groups) => t.deepEqual(
    groups,
    [
      {id: 1, name: 'Admins', deleted: false},
      {id: 2, name: 'Users', deleted: false},
      {id: 3, name: 'Waiters', deleted: true}
    ],
    'three rows have been inserted'
  ))

  .then(() => adapter.find('user'))
  .then((users) => t.equal(users.length, 0, 'there is no rows at the beginning'))
  .then(() => adapter.create('user', [
    {name: 'John', deleted: false, group: 1, password: '123', config: 2},
    {name: 'Smith', deleted: true, group: 2, password: 'fff', config: 3},
    {name: 'Partial', password: 'data', config: 1}, // partial data
    {name: 'just a name'} // partial data
  ]))
  .then((users) => t.deepEqual(
    users,
    [
      {id: 1, name: 'John', deleted: false, group: 1},
      {id: 2, name: 'Smith', deleted: true, group: 2},
      {id: 3, name: 'Partial', deleted: false, group: null},
      {id: 4, name: 'just a name', deleted: false, group: null}
    ],
    'four rows have been inserted'
  ))

  .then(() => adapter.find('user', { match: {password: '123', config: 2} }))
  .then((users) => t.deepEqual(
    users,
    [
      {id: 1, name: 'John', deleted: false, group: 1}
    ],
    'hidden fields have been saved as well'
  ))

  .then(() => adapter.disconnect())

  .catch(t.fail)
  .then(t.end)
})

test('I&T adapter.update()', (t) => {
  const adapter = new Adapter({recordTypes, options})

  prepareTestTables(initialData)

  .then(() => adapter.connect())

  .then(() => adapter.find('group'))
  .then((groups) => t.deepEqual(
    groups,
    [
      {id: 1, name: 'Admins', deleted: false},
      {id: 2, name: 'Users', deleted: false},
      {id: 3, name: 'Officers', deleted: true}
    ],
    'groups before update'
  ))
  .then(() => adapter.update('group', [
    { id: 1, name: 'NewAdmins' },
    { id: 2, name: 'deleted users', deleted: true }
  ]))
  .catch(t.fail)
  .then(() => t.pass('resolves positively'))
  .then(() => adapter.find('group'))
  .then((groups) => t.deepEqual(
    groups,
    [
      {id: 1, name: 'NewAdmins', deleted: false},
      {id: 2, name: 'deleted users', deleted: true},
      {id: 3, name: 'Officers', deleted: true}
    ],
    'groups after update'
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
    'users before update'
  ))
  .then(() => adapter.update('user', [
    {id: 1, name: 'John New', deleted: true, group: 3, password: '#$!%', config: 1},
    {id: 2, name: 'Smith New', deleted: false, group: 3, password: '76%!', config: 1},
    {id: 3, config: 1, group: 3},
    {id: 4, config: 1, group: 3},
    {id: 5, config: 1, group: 3}
  ]))
  .catch(t.fail)
  .then(() => t.pass('resolves positively'))
  .then(() => adapter.find('user'))
  .then((users) => t.deepEqual(
    users,
    [
      {id: 1, name: 'John New', deleted: true, group: 3},
      {id: 2, name: 'Smith New', deleted: false, group: 3},
      {id: 3, name: 'Johanna', deleted: false, group: 3},
      {id: 4, name: 'Ann', deleted: true, group: 3},
      {id: 5, name: 'Makbeth', deleted: false, group: 3}
    ],
    'users after update'
  ))

  .then(() => adapter.find('user', { match: {password: '76%!', config: 1} }))
  .then((users) => t.deepEqual(
    users,
    [ {id: 2, name: 'Smith New', deleted: false, group: 3} ],
    'hidden fields have been updated as well'
  ))

  .then(() => adapter.find('user', { match: {config: 1} }))
  .then((users) => t.equal(users.length, 5, 'hidden "config" field'))

  .then(() => adapter.update('user', [
    {id: 2, password: 'the data for this field is too long'}
  ]))
  .catch((e) => t.ok(/The specified value exceeds the maximum length defined for the column/.test(e.message)))

  .then(() => adapter.disconnect())

  .catch(t.fail)
  .then(t.end)
})

const {recordTypesTimes, prepareTestTablesTimes} = require('./_prepare-test-db-times')

test('I&T reading `date` and `time`', (t) => {
  const adapter = new Adapter({recordTypes: recordTypesTimes, options})

  prepareTestTablesTimes()

  .then(() => adapter.connect())

  .then(() => adapter.find('account'))
  .then((rows) => t.deepEqual(
    rows,
    [
      {id: 1,
        openDate: new Date('2015-02-20 00:00:00'), openTime: new Date('1970-01-01 23:20:18'),
        closeDate: new Date('2015-02-20 00:00:00'), closeTime: new Date('1970-01-01 23:40:01')
      },
      {id: 2,
        openDate: new Date('2015-02-20 00:00:00'), openTime: new Date('1970-01-01 23:20:18'),
        closeDate: null, closeTime: new Date('1970-01-01 00:00:00')
      },
      {id: 3,
        openDate: new Date('2015-02-20 00:00:00'), openTime: new Date('1970-01-01 23:20:18'),
        closeDate: new Date('1899-12-31 00:00:00'), closeTime: new Date('1970-01-01 00:00:00')
      }
    ],
    '`date` allows `null`, but `time` converts it to `00:00:00`'
  ))

  .then(() => adapter.disconnect())

  .catch((e) => t.deepEqual(e.stack, ''))

  .catch(t.fail)
  .then(t.end)
})

test('I&T writing `date` and `time`', (t) => {
  const adapter = new Adapter({recordTypes: recordTypesTimes, options})

  prepareTestTablesTimes()

  .then(() => adapter.connect())

  .then(() => adapter.update(
    'account',
    [
      {id: 1,
        openDate: new Date('1999-03-24 00:00:00'), openTime: new Date('1970-01-01 14:21:10'),
        closeDate: new Date('2000-12-20 00:00:00'), closeTime: new Date('1970-01-01 22:00:11')
      },
      {id: 2,
        openDate: null, openTime: null,
        closeDate: null, closeTime: null
      },
      {id: 3,
        openDate: new Date('1899-12-31 00:00:00'), openTime: new Date('1970-01-01 00:00:00'),
        closeDate: new Date('1899-12-31 00:00:00'), closeTime: new Date('1970-01-01 23:59:59')
      }
    ]
  ))
  .then(() => t.pass('it resolves positive'))

  .then(() => adapter.find('account'))
  .then((rows) => t.deepEqual(
    rows,
    [
      {id: 1,
        openDate: new Date('1999-03-24 00:00:00'), openTime: new Date('1970-01-01 14:21:10'),
        closeDate: new Date('2000-12-20 00:00:00'), closeTime: new Date('1970-01-01 22:00:11')
      },
      {id: 2,
        openDate: null, openTime: new Date('1970-01-01 00:00:00'),
        closeDate: null, closeTime: new Date('1970-01-01 00:00:00')
      },
      {id: 3,
        openDate: new Date('1899-12-31 00:00:00'), openTime: new Date('1970-01-01 00:00:00'),
        closeDate: new Date('1899-12-31 00:00:00'), closeTime: new Date('1970-01-01 23:59:59')
      }
    ],
    'check updated dates and times values'
  ))

  .then(() => adapter.disconnect())

  .catch((e) => t.deepEqual(e.stack, ''))

  .catch(t.fail)
  .then(t.end)
})
