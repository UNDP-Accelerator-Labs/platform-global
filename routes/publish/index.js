const { modules } = include('config/')

const pads = require('./pads/')
const pinboards = require('./pinboards/')
const templates = require('./templates/')
const files = require('./files/')
const reviews = require('./reviews/')
const mobilizations = require('./mobilizations/')

exports.publish = (req, res) => {
	const { referer } = req.headers || {}
	const { rights } = req.session || {}
	const { object } = req.params || {}

	if (object === 'pads') {
		if (modules.some(d => d.type === 'pads' && rights >= d.rights.write)) pads.publish(req, res)
		else res.redirect(referer)
	} else if (object === 'pinboards') {
		if (modules.some(d => d.type === 'pinboards' && rights >= d.rights.write)) pinboards.publish(req, res)
		else res.redirect(referer)
	} else if (object === 'templates') {
		if (modules.some(d => d.type === 'templates' && rights >= d.rights.write)) templates.publish(req, res)
		else res.redirect(referer)
	} else if (object === 'files') {
		if (modules.some(d => d.type === 'files' && rights >= d.rights.write)) files.publish(req, res)
		else res.redirect(referer)
	} else if (object === 'reviews') {
		if (modules.some(d => d.type === 'reviews' && rights >= d.rights.write)) reviews.publish(req, res)
		else res.redirect(referer)
	} else if (object === 'mobilizations') {
		if (modules.some(d => d.type === 'mobilizations' && rights >= d.rights.write)) mobilizations.publish(req, res)
		else res.redirect(referer)
	} else res.redirect('/module-error')
}


exports.unpublish = (req, res) => {
	const { referer } = req.headers || {}
	const { rights } = req.session || {}
	const { object } = req.params || {}

	if (object === 'mobilizations') {
		if (modules.some(d => d.type === 'mobilizations' && rights >= d.rights.write)) mobilizations.unpublish(req, res)
		else res.redirect(referer)
	} else res.redirect('/module-error')
}