const debugLogger = require('debug')

const logApi = debugLogger('webd2-api:api')
const logSQL = debugLogger('webd2-api:sql')

function debugApi (msg) {
  return logApi(msg)
}

function debugSql (msg, sql) {
  const message = msg + ' ' + (sql || '').replace(/\s+/g, ' ')
  return logSQL(message)
}

module.exports = {
  debugApi,
  debugSql
}
