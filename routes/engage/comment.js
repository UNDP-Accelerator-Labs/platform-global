const { DB } = include('config/')

//TODO: covert to API
exports.main = (req, res) => {
	const { uuid } = req.session || {}
	const { referer } = req.headers || {}
	const { object, id, message, source } = req.body || {}

	if (uuid) {
		var saveSQL = DB.pgp.as.format(`
			INSERT INTO comments (contributor, doctype, docid, message, source)
			VALUES ($1, $2, $3::INT, $4, $5)
			RETURNING TRUE AS bool
		;`, [ uuid, object, id, message, source])

		DB.conn.one(saveSQL)
		.then(result => {
			res.redirect(referer)
		}).catch(err => console.log(err))
	} else res.json({ status: 400, message: 'You need to be logged in to engage with content.' })
}