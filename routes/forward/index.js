const { modules } = include('config/')
const { checklanguage } = include('routes/helpers/')

const pad = require('./pad/')
// const template = require('./template/')
// const mobilization = require('./mobilization/')

exports.main = (req, res) => {
	const { uuid, rights } = req.session || {}
	const { object } = req.params || {}
	const language = checklanguage(req.params?.language || req.session.language)

	if (modules.some(d => d.type === `${object}s`)) {
		if (object === 'pad' && (rights >= modules.find(d => d.type === 'pads').rights.write || !uuid)) pad.main(req, res) // THE || uuid IS FOR PUBLIC ACCESS DURING MOBILIZATIONS
		// else if (object === 'template' && rights >= modules.find(d => d.type === 'templates').rights.write) template.create(req, res)
		// else if (object === 'mobilization' && rights >= modules.find(d => d.type === 'mobilizations').rights.write) mobilization.create(req, res)
		else res.redirect(`/${language}/browse/${object}s/public`)
	} else res.redirect('/module-error')
}