const singlesession = require('./single.js')
const multiplesession = require('./multiple.js')

module.exports = (req, res) => {
	const { session } = req.params || {}

	if (session === 'current') singlesession(req, res)
	else if (session === 'multiple') multiplesession(req, res)
	else res.redirect('/module-error')
}