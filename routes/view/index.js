const { modules } = include('config/')
const { checklanguage, datastructures } = include('routes/helpers/')

const pad = require('../contribute/pad/')
const template = require('../contribute/template/')
// const mobilization = require('./mobilization/')
const contributor = require('../mobilize/contributor/')

exports.main = (req, res) => {
	const { referer } = req.headers || {}
	const { id } = req.query || {}
	const { object } = req.params || {}
	
	if (req.session.uuid) { // USER IS LOGGED IN
		var { uuid, rights } = req.session || {}
	} else { // PUBLIC/ NO SESSION
		var { uuid, rights } = datastructures.sessiondata({ public: true }) || {}
	}
	const language = checklanguage(req.params?.language || req.session.language)

	if (id) {
		if (object === 'pad') {
			if (modules.some(d => d.type === 'pads')) {
				if (!uuid) pad.main(req, res)
				else if (rights >= modules.find(d => d.type === 'pads').rights.read) pad.main(req, res)
				else res.redirect(referer)
			} else res.redirect('/module-error')
		}
		if (object === 'template') {
			if (modules.some(d => d.type === 'templates')) {
				if (rights >= modules.find(d => d.type === 'templates').rights.read) template.main(req, res)
				else res.redirect(referer)
			} else res.redirect('/module-error')
		}
		if (object === 'review') {
			if (modules.some(d => d.type === 'reviews')) {
				if (rights >= modules.find(d => d.type === 'reviews').rights.read) pad.main(req, res)
				else res.redirect(referer)
			} else res.redirect('/module-error')
		}
		if (object === 'contributor') {
			if (modules.some(d => d.type === 'contributors')) {
				if (rights >= modules.find(d => d.type === 'contributors').rights.read) contributor.main(req, res)
				else res.redirect(referer)
			} else res.redirect('/module-error')
		}
	} else {
		const query = []
		for (key in req.query) {
			query.push(`${key}=${req.query[key]}`)
		}
		res.redirect(`/${language}/contribute/${object}${query.length > 0 ? `?${query.join('&')}` : ''}`)
	}
}