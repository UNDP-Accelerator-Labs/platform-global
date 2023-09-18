const { modules } = include('config/')
const { checklanguage } = include('routes/helpers/')

const contributor = require('./contributor/')

exports.main = (req, res) => {
	const { uuid, rights } = req.session || {}
	const { object } = req.params || {}
	const language = checklanguage(req.params?.language || req.session.language)

	if (modules.some(d => [`${object}s`, 'mobilizations'].includes(d.type))) {
		if (object === 'contributor' && rights >= modules.find(d => d.type === 'contributors').rights.write) contributor.main(req, res)
		else res.redirect(`/${language}/browse/${object}s/public`)
	} else res.redirect('/module-error')
}