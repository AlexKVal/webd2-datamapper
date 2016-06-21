'use strict'
const {BadRequestError} = require('jsonapi-errors/lib/errors')

module.exports = function idParamParser (req, res, next, id) {
  const idInt = parseInt(id, 10)

  if (isNaN(idInt)) return next(new BadRequestError(`param ${id}`))

  req.id = idInt
  next()
}
