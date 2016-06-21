const {camelCase} = require('lodash')

module.exports = function foreignKey (relationName) {
  return camelCase(relationName) + 'Id'
}
