const tag = require('./tag/')
const pinboard = require('./pinboard/')
const contributor = require('./contributor')
const pad = require('./pad/')
const template = require('./template/')
const review = require('./review/')
const file = require('./file/')

exports.main = (req, res) => {
	const { object } = req.params || {}

	if (object === 'tag') tag.main(req, res)
	else if (object === 'pinboard') pinboard.main(req, res)
	else if (object === 'contributor') contributor(req, res)
	else if (object === 'pad') pad.main(req, res)
	else if (object === 'template') template.main(req, res)
	else if (object === 'review') review.main(req, res)
	else if (object === 'file') file.main(req, res)
	else res.redirect('/module-error')
}