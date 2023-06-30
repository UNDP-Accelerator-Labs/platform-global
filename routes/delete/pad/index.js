const { DB } = include('config/')

exports.main = (req, res) => {	
	const { referer } = req.headers || {}
	let { id } = req.query || {}
	const { uuid, rights } = req.session || {}
	// CONVERT id TO ARRAY
	if (!Array.isArray(id)) id = [id]
	id = id.map(d => +d)
	
	if (id.length) {
		DB.conn.none(`
			DELETE FROM pads
			WHERE id IN ($1:csv)
				AND (owner = $2
					OR $3 > 2)
		;`, [ id, uuid, rights ])
		.then(_ => res.redirect(referer))
		.catch(err => console.log(err))
	} else res.redirect(referer)
}