'use strict'

const config = require('../config.js')
const options = {dsn: config.d2alias}

const Adapter = require('./index')

const initialData = {
  accounts: [
    {openDate: '2015-02-20', openTime: '23:20:18', closeDate: '2015-02-20', closeTime: '23:40:01'},
    {openDate: '2015-02-20', openTime: '23:20:18', closeDate: null, closeTime: null},
    {openDate: '2015-02-20', openTime: '23:20:18', closeDate: '1899-12-31', closeTime: '00:00:00'}
  ]
}

const recordTypesTimes = {
  account: {
    $table: 'TestTimes',
    openDate: {type: 'date'},
    openTime: {type: 'time'},
    closeDate: {type: 'date'},
    closeTime: {type: 'time'}
  }
}

function quote (val) {
  return val === null ? null : `'${val}'`
}

function prepareTestTablesTimes () {
  const adapter = new Adapter({options})

  return adapter.connect()

  // tables and data preparation
  .then(() => adapter.query("SELECT Xf$Id FROM X$File WHERE Xf$Name='TestTimes'"))
  .then((res) => {
    return res.length && adapter.query('DROP TABLE TestTimes')
  })
  .then(() => adapter.query(
    "CREATE TABLE TestTimes USING 'testtimes.mkd'" +
    ' (id AUTOINC(4),' +
    ' openDate DATE(4),' +
    ' openTime TIME(4),' +
    ' closeDate DATE(4),' +
    ' closeTime TIME(4))' +
    ' WITH INDEX (id UNIQUE)'
  ))

  .then(() => {
    return Promise.all(initialData.accounts.map((row) =>
      adapter.query(`INSERT INTO TestTimes (openDate, openTime, closeDate, closeTime) VALUES (${quote(row.openDate)}, ${quote(row.openTime)}, ${quote(row.closeDate)}, ${quote(row.closeTime)})`)))
  })

  .catch((e) => {
    return adapter.disconnect()
    .then(() => { throw e })
  })

  .then(() => adapter.disconnect())
}

module.exports = {
  prepareTestTablesTimes,
  recordTypesTimes
}
