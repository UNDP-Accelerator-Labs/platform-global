const logSQL = true
const initOptions = {
	query(e) {
		if (logSQL) console.log(e.query)
	}
}
const pgp = require('pg-promise')(initOptions)
const DB = require('./app.js').connection
const DB_apps = require('./app.js').connections
DB_apps.forEach(d => {
	d.conn = pgp(d.conn)
})
const DB_general = require('./general.js').connection
const DB_blog= require('./blog.js').connection

exports.DB = { conn: pgp(DB), conns: DB_apps, general: pgp(DB_general), blog: pgp(DB_blog), pgp }
