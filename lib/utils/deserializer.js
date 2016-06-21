'use strict'

const JSONDeserializer = require('jsonapi-serializer').Deserializer
const pluralize = require('pluralize')
const {kebabCase} = require('lodash')

class Deserializer {
  constructor (modelNamesOfRelations) {
    if (!modelNamesOfRelations || !Array.isArray(modelNamesOfRelations)) throw new Error('provide `modelNamesOfRelations` Array')

    this.options = {
      keyForAttribute: 'camelCase'
    }

    modelNamesOfRelations.forEach((relationModelName) => {
      /**
       * pluralModelName should be as in relationships.<modelname>.data.type
       *
       * relationships: {
       *  'user-group': {data: {type: 'user-groups', id: '2'}},
       *  'rights': {data: {type: 'rights', id: '21'}}
       * }
       */
      const pluralModelName = pluralize(kebabCase(relationModelName))
      this.options[pluralModelName] = {
        valueForRelationship (rel) { return { id: rel.id } }
      }
    })

    this._deserializer = new JSONDeserializer(this.options)
  }

  deserialize (dataSet) {
    return new Promise((resolve, reject) => {
      this._deserializer.deserialize(dataSet, (error, deserializedData) => {
        if (error) reject(error)
        else resolve(deserializedData)
      })
    })
  }
}

module.exports = Deserializer
