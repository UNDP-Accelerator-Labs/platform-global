const { DB } = include('config/')

exports.main = (req, res) => {
	const { id } = req.body || {}

	if (!id) { // INSERT OBJECT
		// INSPIRED BY https://stackoverflow.com/questions/38750705/filter-object-properties-by-key-in-es6
		const insert = Object.keys(req.body)
			.filter(key => !['id', 'deletion', 'mobilization', 'tagging', 'locations'].includes(key))
			.reduce((obj, key) => {
				obj[key] = req.body[key]
				return obj
			}, {})

		var sql = DB.pgp.as.format(`
			INSERT INTO files ($1:name, owner) 
			VALUES ($1:csv, $2)
			RETURNING id
		;`, [ insert, uuid ])
	} else { // UPDATE OBJECT
		const condition = DB.pgp.as.format(` WHERE id = $1::INT;`, [ id ])
		var sql = DB.pgp.helpers.update(req.body, Object.keys(req.body).filter(d => !['id', 'deletion', 'mobilization', 'tagging', 'locations'].includes(d)), 'files') + condition
	}	

	DB.conn.oneOrNone(sql)
	.then(result => {
		const newID = result ? result.id : undefined
		res.json({ status: 200, message: 'Successfully saved.', object: newID })
	}).catch(err => console.log(err))
}