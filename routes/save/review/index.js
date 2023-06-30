const { DB } = include('config/')

exports.main = (req, res) => {
	const { id, source, status } = req.body || {}
	const { uuid } = req.session || {}

	if (!id) { // INSERT OBJECT
		// INSPIRED BY https://stackoverflow.com/questions/38750705/filter-object-properties-by-key-in-es6
		const insert = Object.keys(req.body)
			.filter(key => !['id', 'deletion', 'mobilization', 'tagging', 'locations', 'metadata'].includes(key))
			.reduce((obj, key) => {
				obj[key] = req.body[key]
				return obj
			}, {})
		
		var saveSQL = DB.pgp.as.format(`
			INSERT INTO pads ($1:name, owner) 
			VALUES ($1:csv, $2)
			RETURNING id
		;`, [ insert, uuid ])
	} else { // UPDATE OBJECT
		const condition = DB.pgp.as.format(` WHERE id = $1::INT;`, [ id ])
		var saveSQL = DB.pgp.helpers.update(req.body, Object.keys(req.body).filter(d => !['id', 'deletion', 'mobilization', 'tagging', 'locations', 'metadata'].includes(d)), 'pads') + condition
	}	

	DB.conn.tx(t => { 
		return t.oneOrNone(saveSQL)
		.then(result => {
			const newID = result ? result.id : undefined
			const batch = []

			if (!id) { // INSERT NEW REVIEW
				batch.push(t.none(`
					INSERT INTO reviews (pad, reviewer, review, status)
					SELECT $1, $2, $3, $4
				;`, [ source, uuid, newID || id, status ]))
			} else {
				batch.push(t.none(`
					UPDATE reviews
					SET status = $1
					WHERE pad = $2
						AND review = $3
				;`, [ status, source, newID || id ]))
			}
			// UPDATE THE REVIEW REQUEST
			batch.push(t.none(`
				UPDATE pads SET update_at = NOW() WHERE id = $1::INT
			;`, [ newID || id]))

			return t.batch(batch)
			.then(_ => newID)
			.catch(err => console.log(err))
		})
	}).then(newID => {
		res.json({ status: 200, message: 'Successfully saved.', object: newID })
	}).catch(err => console.log(err))
}