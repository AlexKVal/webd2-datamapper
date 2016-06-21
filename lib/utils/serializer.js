'use strict'

const JSONSerializer = require('jsonapi-serializer').Serializer
const {forIn} = require('lodash')

function serializerOptions (modelAttributes, attributesOfRelations, relatedIncluded) {
  const options = { attributes: modelAttributes }
  forIn(attributesOfRelations, (relAttrs, modelFieldName) => {
    options[modelFieldName] = {
      ref: 'id',
      attributes: relAttrs,
      included: relatedIncluded
    }
  })
  return options
}

class Serializer {
  constructor ({modelName, attributes, attributesOfRelations}) {
    if (!modelName) throw new Error('provide `modelName`')
    if (!attributes) throw new Error('provide `attributes`')
    if (!attributesOfRelations) throw new Error('provide `attributesOfRelations`')

    this.serializerWithoutRelated = new JSONSerializer(
      modelName,
      serializerOptions(attributes, attributesOfRelations, false)
    )
    this.serializerWithRelated = new JSONSerializer(
      modelName,
      serializerOptions(attributes, attributesOfRelations, true)
    )
  }

  withRelated (dataSet) {
    return this.serializerWithRelated.serialize(dataSet)
  }

  withoutRelated (dataSet) {
    return this.serializerWithoutRelated.serialize(dataSet)
  }
}

Serializer.serializerOptions = serializerOptions

module.exports = Serializer
