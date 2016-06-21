const {ForbiddenError} = require('jsonapi-errors/lib/errors')

function superAdminsOnly (req, res, next) {
  if (req.user.name === 'D2Admin') {
    next()
  } else {
    next(new ForbiddenError('Super admins only'))
  }
}

module.exports = superAdminsOnly
