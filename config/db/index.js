const logSQL = true
const initOptions = {
	query(e) {
		if (logSQL) console.log(e.query)
	}
}
const pgp = require('pg-promise')(initOptions)
const DB_apps = require('./app.js').connections
const DB_general = require('./general.js').connection

const general = pgp(DB_general);
exports.DB = { conn: general, conns: DB_apps, general, pgp }
