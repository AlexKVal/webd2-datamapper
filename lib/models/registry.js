'use strict'

const {camelCase} = require('lodash')

const registry = {}

function preventOverwrite (store, name) {
  if (store[name]) throw new Error(name + ' is already defined in the registry')
}

/**
 * Usage:
 *
 * to register new model
 * class UserAccount extends BaseModel {<custom model's methods>}
 * UserAccount.schemaObject = {<model's schema>}
 * module.exports = registry.model('userAccount', UserAccount)
 *
 * to retrieve registered model
 * const userAccount = registry.model('userAccount')
 */
registry.model = function (name, ModelClass, db) {
  if (ModelClass && !db) {
    db = require('../utils/database').getDatabase() // for tests
  }

  name = camelCase(name)

  this._models = this._models || Object.create(null)
  if (ModelClass) {
    if (!ModelClass.schemaObject) throw new Error('you need to define `ModelClass.schemaObject`')

    preventOverwrite(this._models, name)

    this._models[name] = new ModelClass({
      db,
      name,
      schema: ModelClass.schemaObject
    })
  }
  return this._models[name]
}

// use this method in tests
registry.reset = function () {
  this._models = Object.create(null)
}

module.exports = registry
