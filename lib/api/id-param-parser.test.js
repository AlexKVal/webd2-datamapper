'use strict'

const test = require('tape')

const idParamParser = require('./id-param-parser')

test('idParamParser parses string type ids', (t) => {
  t.plan(2)

  const idToBeParsed = '123'
  const idShouldBe = 123

  const next = (error) => {
    if (error) t.fail('should not return error')
    t.pass('calls next middleware')
    t.equal(reqMock.id, idShouldBe, 'parses id and assigns it to request`s id field')
    t.end()
  }

  const resMock = {}
  const reqMock = {}

  idParamParser(reqMock, resMock, next, idToBeParsed)
})

test('idParamParser returns error if id is not a number', (t) => {
  t.plan(1)

  const idToBeParsed = 'sdfljk23lkj'

  const next = (error) => {
    if (error) t.equal(error.message, 'param sdfljk23lkj', 'returns error')
    else t.fail('should not be called')
    t.end()
  }

  const resMock = {}
  const reqMock = {}

  idParamParser(reqMock, resMock, next, idToBeParsed)
})
