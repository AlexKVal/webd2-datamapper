'use strict'

const _ = require('lodash')

function validateSchemaLinks (recordTypes) {
  // general validations of `recordTypes` are already done by validateRecordTypes()

  const modelNames = Object.keys(recordTypes)

  modelNames.forEach((modelName) => {
    const fields = recordTypes[modelName]

    const linkNames = Object.keys(fields)
    .filter((key) => !/^\$/.test(key)) // filter out $id, $table
    .filter((key) => !!fields[key].link)

    linkNames.forEach((linkName) => {
      const linkDescr = fields[linkName]
      const relationType = linkDescr.link
      const relationModelFields = recordTypes[relationType]

      if (!relationModelFields) {
        throw new TypeError(`'${linkName}' link of the '${modelName}' points to undescribed '${relationType}'`)
      }

      if (linkDescr.isArray) { // hasMany relations
        if (linkDescr.inverse) { // array link has own `inverse`
          const inverseField = relationModelFields[linkDescr.inverse]

          if (!inverseField) {
            throw new TypeError(`'${linkName}' array link of the '${modelName}'` +
            ` has "inverse" pointing to undescribed field '${linkDescr.inverse}' of '${relationType}'`)
          }

          if (!inverseField.link) {
            throw new TypeError(`'${linkName}' array link of the '${modelName}'` +
            ` has "inverse" pointing to not a link field '${linkDescr.inverse}' of '${relationType}'`)
          }

          if (inverseField.link !== modelName) {
            throw new TypeError(`'${linkName}' array link of the '${modelName}'` +
            ` has "inverse" pointing to not an inverse link field '${linkDescr.inverse}'` +
            ` of '${relationType}' which points to '${inverseField.link}' instead of '${modelName}'`)
          }

          if (inverseField.isArray) {
            throw new TypeError(`wrong schema: '${linkName}' array link of the '${modelName}'` +
            ` has inverse '${linkDescr.inverse}' link in '${relationType}' but it 'isArray'`)
          }
        } else { // w/o own `inverse` try to find
          const inverseLinks = _.filter(relationModelFields, { link: modelName })

          if (!inverseLinks.length) {
            throw new TypeError(`'${linkName}' array link of the '${modelName}'` +
            ` has no inverse belongsTo link in '${relationType}'`)
          }

          if (inverseLinks.length === 1 && inverseLinks[0].isArray) {
            throw new TypeError(`wrong schema: '${linkName}' array link of the '${modelName}'` +
            ` has inverse link in '${relationType}' but it 'isArray'`)
          }

          if (inverseLinks.length > 1 && !_.filter(relationModelFields, { inverse: linkName }).length) {
            throw new TypeError(`wrong schema: '${linkName}' array link of the '${modelName}'` +
            ` has several ambiguous inverse links in '${relationType}'`)
          }
        }
      }
    })
  })
}

module.exports = validateSchemaLinks
