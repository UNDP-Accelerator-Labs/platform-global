const { DB } = include('config/')

exports.main = (req, res) => {
	const { name, type } = req.body || {}
	const { uuid } = req.session || {}
	
	if (type !== 'sdgs') { // TECHNICALLY THIS SHOULD NOT HAPPEN BECAUSE sdgs CANNOT BE opencoded AS PER THE config
		DB.general.tx(gt => {
			return gt.one(`
				INSERT INTO tags (name, type, contributor)
				VALUES ($1, $2, $3)
				ON CONFLICT ON CONSTRAINT name_type_key
					DO NOTHING
				RETURNING id, name, type
			;`, [ name, type, uuid ])
			.then(datum => {
				if (datum) return datum
				else return gt.one(`
					SELECT id, name, type FROM tags
					WHERE name = $1
						AND type = $2
				;`, [ name, type ])
			}).catch(err => console.log(err))
		}).then(datum => {
			res.json({ status: 200, message: 'Successfully saved.', datum })
		}).catch(err => console.log(err))
	} else res.json({ status: 400, message: 'You cannot add this type of tag.' })
}