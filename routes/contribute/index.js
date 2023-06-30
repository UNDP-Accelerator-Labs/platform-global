const { modules } = include('config/')

const pad = require('./pad/')
const template = require('./template/')

exports.main = (req, res) => {
	const { referer } = req.headers || {}
	const { uuid, rights } = req.session || {}
	const { object } = req.params || {}

	if (modules.some(d => d.type === `${object}s`)) {
		if (object === 'pad' && (rights >= modules.find(d => d.type === 'pads').rights.write || !uuid)) pad.main(req, res) // THE || uuid IS FOR PUBLIC ACCESS DURING MOBILIZATIONS
		else if (object === 'template' && rights >= modules.find(d => d.type === 'templates').rights.write) template.main(req, res)
		else if (object === 'review' && rights >= modules.find(d => d.type === 'reviews').rights.write) pad.main(req, res)
		else res.redirect(referer)
	} else res.redirect('/module-error')
}