const pinboard = require('./pinboard/')
const contributor = require('./contributor/')
const pad = require('./pad/')

exports.main = (req, res) => {
	const { object } = req.params || {}
	
	if (object === 'pinboard') pinboard.main(req, res)
	else if (object === 'contributor') contributor.main(req, res)
	else if (object === 'pad') pad.main(req, res)
	else res.redirect('/module-error')
}