'use strict'

const test = require('tape')

const {validate, validateField, validateRecordTypes} = require('./validate-record-rypes')

test('validate(fields)', (t) => {
  t.throws(
    () => validate('not an object'),
    /Type definition must be an object/
  )

  t.end()
})

test('validateField(value, key)', (t) => {
  t.throws(
    () => validateField('not an object', 'aField'),
    /The definition of "aField" must be an object/
  )

  t.throws(
    () => validateField({ type: Number }, 'id'),
    /Cannot define primary key "id"\. Probably you need "\$id"/
  )

  t.throws(
    () => validateField({}, 'withoutTypeAndLink'),
    /The definition of "withoutTypeAndLink" must contain either the "type" or "link" property/
  )

  t.throws(
    () => validateField({ type: Number, link: 'some' }, 'typeAndLink'),
    /Cannot define both "type" and "link" on "typeAndLink"/
  )

  t.throws(
    () => validateField({type: () => {}}, 'someWrongType'),
    /The "type" on "someWrongType" is invalid/
  )

  t.throws(
    () => validateField({type: {}}, 'someWrongType'),
    /The "type" on "someWrongType" is invalid/
  )

  t.throws(
    () => validateField({type: Buffer}, 'someWrongType'),
    /The "type" on "someWrongType" is invalid/
  )

  const nativeTypes = [ String, Number, Boolean, Date ]
  nativeTypes.forEach((type) => {
    t.doesNotThrow(() => validateField({type: type}, 'rightType'))
  })

  t.throws(
    () => validateField({link: {}}, 'wrongLink'),
    /The "link" on "wrongLink" must be a string/
  )

  t.throws(
    () => validateField({link: 'some', isArray: {}}, 'isArrayNotBoolean'),
    /The key "isArray" on "isArrayNotBoolean" must be a boolean/
  )

  t.end()
})

test('validateRecordTypes(transforms, recordTypes)', (t) => {
  const recordTypes = {
    user: { name: { type: String } },
    group: { name: { type: String } },
    known: { name: { type: String } }
  }

  const transforms = {
    known: {
      input: {
        create () {}
      },
      output () {}
    }
  }

  const result = validateRecordTypes(transforms, recordTypes)

  t.deepEqual(
    result,
    {
      user: {},
      group: {},
      known: transforms.known
    },
    'it defines empty tranforms for each record type'
  )

  t.equal(result, transforms, 'it mutates and returns "transforms"')

  t.end()
})
