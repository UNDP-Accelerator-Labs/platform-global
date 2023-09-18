const pads = require('./pads/')

module.exports = async (req, res) => {
	const { action, object } = req.params || {}
	const { output, render } = req.body || {}

	if (action === 'download' && render) {
		if (object === 'pads') {
			if (['xlsx', 'csv'].includes(output)) pads.xlsx(req, res)
			else if (['json', 'geojson'].includes(output)) pads.xlsx(req, res, output)
			// else if (output === 'docx') pads.docx(req, res)
			else res.redirect('/module-error')
		} 
	} 
}