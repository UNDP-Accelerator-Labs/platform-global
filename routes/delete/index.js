const { modules } = include('config/')
const { checklanguage } = include('routes/helpers/')

const pad = require('./pad/')
const template = require('./template/')
const contributor = require('./contributor/')

exports.main = (req, res) => {
	const { referer } = req.headers || {}
	const { uuid, rights } = req.session || {}
	const { object } = req.params || {}
	const language = checklanguage(req.params?.language || req.session.language)


	if (object === 'pads') {
		if (modules.some(d => d.type === 'pads')) {
			if (rights >= modules.find(d => d.type === 'pads').rights.write) pad.main(req, res)
			else res.redirect(referer)
		} else res.redirect('/module-error')
	}
	if (object === 'templates') {
		if (modules.some(d => d.type === 'templates')) {
			if (rights >= modules.find(d => d.type === 'templates').rights.write) template.main(req, res)
			else res.redirect(referer)
		} else res.redirect('/module-error')
	}
	if (object === 'contributors') {
		if (modules.some(d => d.type === 'contributors')) {
			if (rights >= modules.find(d => d.type === 'contributors').rights.write) contributor.main(req, res)
			else res.redirect(referer)
		} else res.redirect('/module-error')
	}
}