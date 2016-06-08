'use strict'

const _ = require('lodash')
/**
 * getLinks({
 *   $id: 'PersID',
 *   $table: 'sPersonal',
 *   name: {type: String},
 *   group: {link: 'group'},
 *   rights: {link: 'rights'},
 *   posts: {link: 'post', isArray: true}
 * })
 *
 * returns only one-to-many links: {
 *   group: {link: 'group'},
 *   rights: {link: 'rights'}
 * }
 */
function getLinks (typeDescriptors) {
  return _.pickBy(typeDescriptors, (descr, key) => {
    return !/^\$/.test(key) && descr.link && !descr.isArray
  })
}

module.exports = getLinks
