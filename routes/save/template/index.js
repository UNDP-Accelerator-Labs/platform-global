const { DB } = include('config/')

exports.main = (req, res) => {
	const { id, review_template, review_language } = req.body || {}
	const { uuid } = req.session || {}

	if (!id) { // INSERT OBJECT
		// INSPIRED BY https://stackoverflow.com/questions/38750705/filter-object-properties-by-key-in-es6
		const insert = Object.keys(req.body)
			.filter(key => !['id', 'review_template', 'review_language'].includes(key))
			.reduce((obj, key) => {
				obj[key] = req.body[key]
				return obj
			}, {})
		
		var saveSQL = DB.pgp.as.format(`
			INSERT INTO templates ($1:name, owner) 
			VALUES ($1:csv, $2)
			RETURNING id
		;`, [ insert, uuid ])
	} else { // UPDATE OBJECT
		const condition = DB.pgp.as.format(` WHERE id = $1::INT;`, [ id ])
		saveSQL = DB.pgp.helpers.update(req.body, Object.keys(req.body).filter(d => !['id', 'review_template', 'review_language'].includes(d)), 'templates') + condition
	}	

	DB.conn.tx(t => { 
		return t.oneOrNone(saveSQL)
		.then(result => {
			const newID = result ? result.id : undefined
			const batch = []

			if (review_template && !id) { // THIS IS A NEW REVIEW TEMPLATE 
				batch.push(t.none(`
					INSERT INTO review_templates (template, language)
					VALUES ($1, $2)
					ON CONFLICT ON CONSTRAINT review_templates_language_key
						DO UPDATE
						SET template = EXCLUDED.template
				;`, [ newID || id, review_language ]))
			}
			// UPDATE THE TIMESTAMP
			batch.push(t.none(`
				UPDATE templates SET update_at = NOW() WHERE id = $1::INT
			;`, [ newID || id]))
			
			return t.batch(batch)
			.then(_ => newID)
			.catch(err => console.log(err))
		})
	}).then(newID => res.json({ status: 200, message: 'Successfully saved.', object: newID }))
	.catch(err => console.log(err))
}