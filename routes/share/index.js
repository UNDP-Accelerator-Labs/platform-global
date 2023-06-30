const { modules } = include('config/')

const pinboards = require('./pinboards/')

exports.share = (req, res) => {
	const { referer } = req.headers || {}
	const { rights } = req.session || {}
	const { object } = req.params || {}

	if (['pinboard', 'pinboards'].includes(object)) {
		if (modules.some(d => d.type === 'pinboards' && rights >= d.rights.write)) pinboards.share(req, res)
		else res.redirect(referer)
	}
}

exports.unshare = (req, res) => {

}