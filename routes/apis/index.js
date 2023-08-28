const pads = require('./pads/')
const jwt = require('jsonwebtoken')

module.exports = async (req, res) => {
	const token = req.body.token || req.query.token || req.headers['x-access-token']
	const { action, object } = req.params || {}
	const { output, render } = req.body || {}

	// TO DO: ADD Readme.md TO DOWNLOADS

	if (token) { // IF THERE IS A TOKEN, THIS IS AN CORS CALL, SO WE NEED TO SET UP SOME BASIC session INFORMATION
		const auth = jwt.verify(token, process.env.GLOBAL_LOGIN_KEY)
		if (auth) {
			const { email } = auth
			req.session.email = email // PASS THIS TO SESSION FOR THE json PROCESSOR
		} // IF NO TOKEN IS SENT, THEN ONLY PUBLIC CONTENT CAN BE DOWNLOADED
	}

	if (action === 'download' && render) {
		if (object === 'pads') {
			if (['xlsx', 'csv'].includes(output)) pads.xlsx(req, res)
			else if (['json', 'geojson'].includes(output)) pads.json(req, res)
			else if (output === 'docx') pads.docx(req, res)
			else res.redirect('/module-error')
		} 
	} 
}