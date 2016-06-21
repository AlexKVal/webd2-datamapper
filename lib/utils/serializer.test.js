'use strict'
const test = require('tape')

const Serializer = require('./serializer')

test('Serializer.constructor', (t) => {
  t.throws(
    () => new Serializer({}),
    /provide `modelName`/,
    'requires `modelName`'
  )

  t.throws(
    () => new Serializer({modelName: 'some'}),
    /provide `attributes`/,
    'requires `attributes`'
  )

  t.throws(
    () => new Serializer({modelName: 'some', attributes: []}),
    /provide `attributesOfRelations`/,
    'requires `attributesOfRelations`'
  )

  const fn1 = function () {
    new Serializer({ // eslint-disable-line
      modelName: 'userAccount',
      attributes: ['name', 'userGroup'],
      attributesOfRelations: {
        rel1: ['one', 'two'],
        rel2: ['one1', 'two1']
      }
    })
  }

  t.doesNotThrow(fn1, 'when all parameters are provided')

  t.end()
})

const serializerOptions = Serializer.serializerOptions

test('Serializer.serializerOptions()', (t) => {
  const modelAttributes = ['name', 'hide', 'rel1', 'rel2']

  const attributesOfRelations = {
    rel1: ['enabled'],
    rel2: ['shortName']
  }

  let relatedIncluded = true
  const options1 = serializerOptions(modelAttributes, attributesOfRelations, relatedIncluded)
  t.deepEqual(
    options1,
    {
      attributes: ['name', 'hide', 'rel1', 'rel2'],
      rel1: { attributes: ['enabled'], included: true, ref: 'id' },
      rel2: { attributes: ['shortName'], included: true, ref: 'id' }
    },
    'generates options with `included` on'
  )

  relatedIncluded = false
  const options2 = serializerOptions(modelAttributes, attributesOfRelations, relatedIncluded)
  t.deepEqual(
    options2,
    {
      attributes: ['name', 'hide', 'rel1', 'rel2'],
      rel1: { attributes: ['enabled'], included: false, ref: 'id' },
      rel2: { attributes: ['shortName'], included: false, ref: 'id' }
    },
    'generates options with `included` off'
  )

  t.end()
})

test('Serializer serialization', (t) => {
  const serializer = new Serializer({
    modelName: 'user',
    attributes: ['name', 'group', 'rights'],
    attributesOfRelations: {
      group: ['name', 'hide'],
      rights: ['shortName']
    }
  })

  const data = [
    {
      id: '1', name: 'John',
      group: {id: '101', name: 'Admins', hide: false},
      rights: {id: '12', shortName: 'Full'}
    },
    {
      id: '2', name: 'Smith',
      group: {id: '102', name: 'Users', hide: true},
      rights: {id: '13', shortName: 'Part'}
    }
  ]

  t.deepEqual(
    serializer.withoutRelated(data),
    {
      data: [{
        attributes: { name: 'John' },
        id: '1',
        relationships: {
          group: { data: { id: '101', type: 'groups' } },
          rights: { data: { id: '12', type: 'rights' } }
        },
        type: 'users'
      }, {
        attributes: { name: 'Smith' },
        id: '2',
        relationships: {
          group: { data: { id: '102', type: 'groups' } },
          rights: { data: { id: '13', type: 'rights' } }
        },
        type: 'users'
      }]
    },
    'withoutRelated() does not include relations` data'
  )

  t.deepEqual(
    serializer.withRelated(data),
    {
      data: [{
        attributes: { name: 'John' },
        id: '1',
        relationships: {
          group: { data: { id: '101', type: 'groups' } },
          rights: { data: { id: '12', type: 'rights' } }
        },
        type: 'users'
      }, {
        attributes: { name: 'Smith' },
        id: '2',
        relationships: {
          group: { data: { id: '102', type: 'groups' } },
          rights: { data: { id: '13', type: 'rights' } }
        },
        type: 'users'
      }],
      included: [{
        attributes: { name: 'Admins', hide: false },
        id: '101',
        type: 'groups'
      }, {
        attributes: { 'short-name': 'Full' },
        id: '12',
        type: 'rights'
      }, {
        attributes: { name: 'Users', hide: true },
        id: '102',
        type: 'groups'
      }, {
        attributes: { 'short-name': 'Part' },
        id: '13',
        type: 'rights'
      }]
    },
    'withRelated() includes relations data'
  )

  t.end()
})
