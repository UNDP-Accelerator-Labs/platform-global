const { modules } = include('config/')
const { checklanguage, datastructures } = include('routes/helpers/')

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
		if (object === 'contributor') {
			if (modules.some(d => d.type === 'contributors')) {
				if (rights >= modules.find(d => d.type === 'contributors').rights.write) contributor.main(req, res)
				else res.redirect(referer)
			} else res.redirect('/module-error')
		}
	} 
}