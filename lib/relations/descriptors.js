'use strict'

const { camelCase } = require('lodash')
const foreignKey = require('../sql-builder/foreign-key')

class DescBelongsTo {
  constructor (modelFieldName, descriptorObject) {
    if (modelFieldName == null) throw new TypeError('modelNameField attribute is undefined')
    if (descriptorObject == null) throw new TypeError('descriptorObject attribute is undefined')
    if (descriptorObject.belongsTo == null) throw new TypeError('belongsTo field is undefined')

    this.modelFieldName = modelFieldName

    this.relationModelName = descriptorObject.belongsTo
    this.fkField = descriptorObject.fkField || camelCase(this.relationModelName)
    this.fkAs = descriptorObject.fkAs || foreignKey(this.relationModelName)
  }
}

class DescHasMany {
  constructor (modelFieldName, descriptorObject) {
    if (modelFieldName == null) throw new TypeError('modelNameField attribute is undefined')
    if (descriptorObject == null) throw new TypeError('descriptorObject attribute is undefined')
    if (descriptorObject.hasMany == null) throw new TypeError('hasMany field is undefined')
    if (descriptorObject.fkField == null) throw new TypeError('fkField field is undefined')

    this.modelFieldName = modelFieldName

    this.relationModelName = descriptorObject.hasMany
    this.fkField = descriptorObject.fkField
  }
}

module.exports = {
  DescBelongsTo,
  DescHasMany
}
