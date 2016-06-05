'use strict'

const test = require('tape')

const validateSchemaLinks = require('./validate-schema-links')

test('validateSchemaLinks()', (t) => {
  t.doesNotThrow(
    () => validateSchemaLinks({
      user: {
        $id: 'PersID',
        $table: 'sPersonal',
        name: { type: String }
      },
      group: {
        $id: 'GrpID',
        $table: 'sGroup',
        name: { type: String }
      }
    }),
    'with no links it does nothing'
  )

  t.throws(
    () => validateSchemaLinks({
      first: {
        linkField: { link: 'undescribedModel' }
      }
    }),
    /'linkField' link of the 'first' points to undescribed 'undescribedModel'/
  )

  t.doesNotThrow(
    () => validateSchemaLinks({
      user: {
        name: { type: String },
        group: { link: 'group' },
        rights: { link: 'rights' }
      },
      group: {
        name: { type: String }
      },
      rights: {
        name: { type: String }
      }
    }),
    'with some belongsTo relations'
  )

  t.throws(
    () => validateSchemaLinks({
      first: {
        arrayLink: { link: 'second', isArray: true }
      },
      second: {
        name: { type: String }
        // has no inverse belongsTo link
      }
    }),
    /'arrayLink' array link of the 'first' has no inverse belongsTo link in 'second'/
  )

  t.throws(
    () => validateSchemaLinks({
      first: {
        arrayLink: { link: 'second', isArray: true, inverse: 'undescribedField' }
      },
      second: {
        // undescribedField
        otherBelongsToFirst: { link: 'first' }
      }
    }),
    /'arrayLink' array link of the 'first' has "inverse" pointing to undescribed field 'undescribedField' of 'second'/
  )

  t.throws(
    () => validateSchemaLinks({
      first: {
        arrayLink: { link: 'second', isArray: true, inverse: 'notALink' }
      },
      second: {
        notALink: { type: String },
        otherBelongsToFirst: { link: 'first' }
      }
    }),
    /'arrayLink' array link of the 'first' has "inverse" pointing to not a link field 'notALink' of 'second'/
  )

  t.throws(
    () => validateSchemaLinks({
      first: {
        arrayLink: { link: 'second', isArray: true, inverse: 'notInverse' }
      },
      second: {
        notInverse: { link: 'third' }
      },
      third: {
        name: { type: String }
      }
    }),
    /'arrayLink' array link of the 'first' has "inverse" pointing to not an inverse link field 'notInverse' of 'second' which points to 'third' instead of 'first'/
  )

  t.doesNotThrow(
    () => validateSchemaLinks({
      first: { // disambiguation with `inverse`
        seconds: { link: 'second', isArray: true, inverse: 'belongsToFirst' }
      },
      second: {
        belongsToFirst: { link: 'first' },
        otherBelongsToFirst: { link: 'first' }
      }
    }),
    '"inverse" on the hasMany link side'
  )

  t.doesNotThrow(
    () => validateSchemaLinks({
      first: {
        seconds: { link: 'second', isArray: true }
      },
      second: { // disambiguation with `inverse`
        belongsToFirst: { link: 'first', inverse: 'seconds' },
        otherBelongsToFirst: { link: 'first' }
      }
    }),
    '"inverse" on the belongsTo link side'
  )

  t.throws(
    () => validateSchemaLinks({
      first: {
        arrayLink: { link: 'second', isArray: true, inverse: 'belongsToFirst' }
      },
      second: {
        belongsToFirst: { link: 'first', isArray: true }
      }
    }),
    /wrong schema: 'arrayLink' array link of the 'first' has inverse 'belongsToFirst' link in 'second' but it 'isArray'/
  )

  t.throws(
    () => validateSchemaLinks({
      first: {
        arrayLink: { link: 'second', isArray: true }
      },
      second: {
        belongsToFirst: { link: 'first', isArray: true }
      }
    }),
    /wrong schema: 'arrayLink' array link of the 'first' has inverse link in 'second' but it 'isArray'/
  )

  t.throws(
    () => validateSchemaLinks({
      first: {
        ambiguousSeconds: { link: 'second', isArray: true }
      },
      second: {
        belongsToFirst: { link: 'first' },
        otherBelongsToFirst: { link: 'first' }
      }
    }),
    /wrong schema: 'ambiguousSeconds' array link of the 'first' has several ambiguous inverse links in 'second'/
  )

  t.doesNotThrow(
    () => validateSchemaLinks({
      user: {
        name: { type: String },
        friend: { link: 'user' }, // or inverse: 'friends'
        friends: { link: 'user', isArray: true, inverse: 'friend' },
        enemy: { link: 'user', inverse: 'enemies' },
        enemies: { link: 'user', isArray: true } // or inverse: 'enemy'
      }
    }),
    'rights: tree like hasMany relations to the same model'
  )

  t.throws(
    () => validateSchemaLinks({
      user: {
        name: { type: String },
        friend: { link: 'user' },
        friends: { link: 'user', isArray: true }
      }
    }),
    /wrong schema: 'friends' array link of the 'user' has several ambiguous inverse links in 'user'/,
    'wrong: tree like hasMany relations to the same model'
  )

  t.end()
})
