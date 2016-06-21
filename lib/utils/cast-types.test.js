'use strict'
const test = require('tape')

const {
  getCaster,
  castTypes,
  castTypesRows,
  castTypesRow
} = require('./cast-types')

test('CastTypes getCaster()', (t) => {
  const caster = getCaster({
    // id
    // undefinedType
    stringTypeField: 'string',
    booleanTypeField: 'boolean',
    integerTypeField: 'integer'
  })

  t.equal(caster('id', '45'), '45', '`id` as is')
  t.equal(caster('id', 415), 415, '`id` as is')

  t.equal(caster('undefinedType', 455), 455, '`unknown type` as is')
  t.equal(caster('undefinedType', true), true, '`unknown type` as is')
  t.equal(caster('undefinedType', 'str'), 'str', '`unknown type` as is')

  t.equal(caster('stringTypeField', true), 'true', 'string type')
  t.equal(caster('stringTypeField', 432), '432', 'string type')
  t.equal(caster('stringTypeField', 'some value'), 'some value', 'string type')

  t.equal(caster('stringTypeField', null), '', 'string type: `null` => empty string')
  t.equal(caster('stringTypeField', undefined), '', 'string type: `undefined` => empty string')

  t.equal(caster('stringTypeField', true), 'true', 'string type: boolean true')
  t.equal(caster('stringTypeField', false), 'false', 'string type: boolean false')

  t.equal(caster('booleanTypeField', '0'), false, 'boolean type')
  t.equal(caster('booleanTypeField', '1'), true, 'boolean type')

  t.equal(caster('integerTypeField', '1001'), 1001, 'integer type')
  t.equal(caster('integerTypeField', 356), 356, 'integer type')

  t.end()
})

test('castRow', (t) => {
  const schema = {
    name: 'string',
    password: 'string',
    rights: 'id',
    hide: 'boolean',
    enabled: 'boolean'
  }

  const odbcRow = {
    id: '45',
    name: 'admin',
    rights: '3',
    hide: '0',
    enabled: '1'
  }

  const row = castTypesRow(odbcRow, schema)

  t.equal(row.id, '45', 'id has "id" type')
  t.equal(row.name, 'admin', 'name: string type')
  t.equal(row.rights, '3', 'rights: id type')
  t.equal(row.hide, false, 'hide: boolean type')
  t.equal(row.enabled, true, 'enabled: boolean type')
  t.end()
})

test('castRows', (t) => {
  const schema = {
    name: 'string',
    password: 'string',
    rights: 'id',
    hide: 'boolean',
    enabled: 'boolean'
  }

  const odbcRows = [
    {
      id: '45',
      name: 'admin',
      rights: '3',
      hide: '0',
      enabled: '1'
    },
    {
      id: '46',
      name: 'user',
      rights: '2',
      hide: '1',
      enabled: '0'
    }
  ]

  const rows = castTypesRows(odbcRows, schema)

  t.equal(rows.length, 2)

  t.equal(rows[0].id, '45', 'id has "id" type')
  t.equal(rows[0].name, 'admin', 'name: string type')
  t.equal(rows[0].rights, '3', 'rights: id type')
  t.equal(rows[0].hide, false, 'hide: boolean type')
  t.equal(rows[0].enabled, true, 'enabled: boolean type')

  t.equal(rows[1].id, '46', 'id has "id" type')
  t.equal(rows[1].name, 'user', 'name: string type')
  t.equal(rows[1].rights, '2', 'rights: id type')
  t.equal(rows[1].hide, true, 'hide: boolean type')
  t.equal(rows[1].enabled, false, 'enabled: boolean type')

  t.end()
})

test('castTypes handles "row"', (t) => {
  const odbcRow = {
    id: '45'
  }

  const row = castTypes(odbcRow, {/* schema */})

  t.equal(row.id, '45', 'id has "id" type')
  t.end()
})

test('castTypes handles "rows"', (t) => {
  const odbcRows = [
    { id: '45' },
    { id: '46' }
  ]

  const rows = castTypes(odbcRows, {/* schema */})

  t.equal(rows.length, 2)

  t.end()
})
