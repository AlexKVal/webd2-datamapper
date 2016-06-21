const { transform } = require('lodash')
const { DescBelongsTo, DescHasMany } = require('./descriptors')

function getBelongsToDescriptors (schemaObject) {
  if (schemaObject == null) throw new TypeError('getBelongsToDescriptors: schemaObject is undefined')
  return transform(schemaObject, (memo, descriptor, modelFieldName) => {
    if (typeof descriptor === 'object' && descriptor.belongsTo) {
      memo.push(new DescBelongsTo(modelFieldName, descriptor))
    }
  }, [])
}

function getHasManyDescriptors (schemaObject) {
  if (schemaObject == null) throw new TypeError('getHasManyDescriptors: schemaObject is undefined')
  return transform(schemaObject, (memo, descriptor, modelFieldName) => {
    if (typeof descriptor === 'object' && descriptor.hasMany) {
      memo.push(new DescHasMany(modelFieldName, descriptor))
    }
  }, [])
}

module.exports = {
  getBelongsToDescriptors,
  getHasManyDescriptors
}
