const { apps_in_suite } = require('../edit/')

exports.connections = apps_in_suite.map(d => {
	return {
		key: d.key,
		baseurl: d.baseurl,
	}
})
