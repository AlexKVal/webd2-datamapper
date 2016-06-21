'use strict'

const jwt = require('jsonwebtoken')
const {
  UnauthorizedError
} = require('jsonapi-errors/lib/errors')

function getToken (req) {
  // header "Authorization": "Bearer <token>"
  const header = req.headers.authorization || ''
  return header.split('Bearer ')[1]
}

// token validation middleware
module.exports = function verifyJWT (req, res, next) {
  const tokenSent = getToken(req)

  if (!tokenSent) return next(new UnauthorizedError('No token provided'))

  jwt.verify(tokenSent, req.app.get('jwtSecret'), function (err, decoded) {
    if (err) return next(new UnauthorizedError('Failed to authenticate token'))

    req.user = decoded
    next()
  })
}
