const { modules } = include('config/')

const pads = require('./pads/')

module.exports = async (req, res) => {
	let { object } = req.params || {}

	if (modules.some(d => d.type === object)) {
		if (object === 'pads') pads.render(req, res)
	} else res.redirect('/module-error')
}