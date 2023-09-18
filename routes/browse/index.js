const { modules } = include('config/')

const pads = require('./pads/')
const blog = require('./blog/')

module.exports = async (req, res) => {
	const { xhr } = req
	let { object, space, instance } = req.params || {}

	if (modules.some(d => d.type === object)) {
		if (object === 'pads') pads.render(req, res)
		if(object === 'blog') blog.render(req, res)
	} else if (instance) {
		pads.render(req, res)
	} else res.redirect('/module-error')
}