const password = require('./password.js')

exports.main = (req, res) => {
	const { object } = req.params || {}

	if (object === 'password') password.main(req, res)
}