const { modules, DB } = include('config/')

exports.main = (req, res) => {
	const { referer } = req.headers || {}
	const { id, template } = req.query || {}
	const { uuid } = req.session || {}
	const { object } = req.params || {}

	// EXECUTE SQL
	if (object === 'review') {
		return DB.conn.tx(t => {
			const batch = []
			// BELOW IS AN UPSERT INSTEAD OF AN UPDATE TO ACCOUNT FOR A SUDO USER JUMPING IN FOR A REVIEW
			batch.push(t.none(`
				INSERT INTO reviewer_pool (reviewer, request, status)
				SELECT $1, id, 1 FROM review_requests WHERE pad = $2::INT
					ON CONFLICT ON CONSTRAINT unique_reviewer_pad
					DO UPDATE 
						SET status = EXCLUDED.status
			;`, [ uuid, id ]))

			batch.push(t.one(`
				INSERT INTO pads (owner, source, template)
				VALUES ($1, $2::INT, $3::INT)
				RETURNING id
			;`, [ uuid, id, template ], d => d.id)
			.then(result => {
				return t.none(`
					INSERT INTO reviews (pad, reviewer, review) 
					VALUES ($1::INT, $2, $3::INT)
				;`, [ id, uuid, result ])
				.catch(err => console.log(err))
			}).catch(err => console.log(err)))

			return t.batch(batch)
			.then(_ => {
				return t.one(`
					SELECT COUNT (id)::INT FROM reviewer_pool
					WHERE status = 1
						AND request = (SELECT id FROM review_requests WHERE pad = $1)
				;`, [ id ], d => d.count)
				.then(reviewer_count => {
					if (reviewer_count === modules.find(d => d.type === 'reviews').reviewers) {
						return t.none(`
							DELETE FROM reviewer_pool
							WHERE status = 0
								AND request = (SELECT id FROM review_requests WHERE pad = $1)
						;`, [ id ])
					} else return null
				})
			}).catch(err => console.log(err))
		}).then(_ => {
			res.redirect(referer)
		}).catch(err => console.log(err))
	}
}