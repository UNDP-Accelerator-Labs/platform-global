const { apps_in_suite } = require('../edit/')

if (['production', 'local-production'].includes(process.env.NODE_ENV)) {
	console.log('in production environment')
	exports.connections = apps_in_suite.map(d => {
		return {
			key: d.key,
			baseurl: d.baseurl,
			conn: {
				database: d.key, 
				port: process.env.DB_PORT, 
				host: process.env.DB_HOST,
				user: process.env.DB_USERNAME,
				password: process.env.DB_PASSWORD,
				ssl: true
			}
		}
	})
	exports.connection = {
		database: process.env.DB_NAME, 
		port: process.env.DB_PORT, 
		host: process.env.DB_HOST,
		user: process.env.DB_USERNAME,
		password: process.env.DB_PASSWORD,
		ssl: true
	}
} else {
	console.log('in local test envorinment')
	exports.connections = apps_in_suite.map(d => {
		return { 
			key: d.key,
			baseurl: d.baseurl,
			conn: {
				database: d.key, 
				port: process.env.port, 
				host: process.env.host,
				user: process.env.user,
				password: process.env.password
			}
		}
	})
	exports.connection = {
		database: process.env.database, 
		port: process.env.port, 
		host: process.env.host,
		user: process.env.user,
		password: process.env.password
	}
}