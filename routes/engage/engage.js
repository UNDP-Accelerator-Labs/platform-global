const { DB } = include('config/')

exports.main = (req, res) => {
	const { uuid } = req.session || {}
	const { object, id, type, message, action, source } = req.body || {}

	if (uuid) {
		if (action === 'insert') { // INSERT
			var saveSQL = DB.pgp.as.format(`
				INSERT INTO engagement (contributor, doctype, docid, type, message) 
				VALUES ($1, $2, $3::INT, $4, $5)
				RETURNING TRUE AS bool
			;`, [ uuid, object, id, type, message])
		} else if (action === 'delete') { // DELETE
			var saveSQL = DB.pgp.as.format(`
				DELETE FROM engagement
				WHERE contributor = $1
					AND doctype = $2
					AND docid = $3
					AND type = $4
				RETURNING NULL AS bool
			;`, [ uuid, object, id, type ])
		}

		let conn = DB.conn
		if (source) conn = DB.conns.find(d => d.key === source).conn

		conn.one(saveSQL)
		.then(result => {
			res.json({ status: 200, active: result.bool })
		}).catch(err => console.log(err))
	} else res.json({ status: 400, message: 'You need to be logged in to engage with content.' })
}