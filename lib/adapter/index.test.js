'use strict'

const test = require('tape')

const Adapter = require('./index')

test('Adapter', (t) => {
  t.ok(new Adapter({options: {}}))
  t.end()
})
