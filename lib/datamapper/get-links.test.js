'use strict'

const test = require('tape')

const getLinks = require('./get-links')

test('getLinks()', (t) => {
  t.deepEqual(
    getLinks({
      $id: 'PersID',
      $table: 'sPersonal',
      name: {type: String},
      group: {link: 'group'},
      rights: {link: 'rights'},
      posts: {link: 'post', isArray: true}
    }),
    {
      group: {link: 'group'},
      rights: {link: 'rights'}
    },
    'it returns only one-to-many descriptors'
  )

  t.end()
})
