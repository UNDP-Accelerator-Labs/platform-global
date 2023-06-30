const { modules, DB } = include('config/')

exports.main = (req, res) => {
	const { referer } = req.headers || {}
	let { id, limit, status } = req.query || {}
	if (!Array.isArray(id)) id = [id]

	const { uuid, rights, collaborators } = req.session || {}

	const module_rights = modules.find(d => d.type === 'pads')?.rights
	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
	if (!collaborators_ids.length) collaborators_ids = [ uuid ]

	// EXECUTE SQL
	DB.conn.tx(t => {
		const batch = []

		if (status) {
			if (id?.length > 0) {
				batch.push(t.none(`
					UPDATE pads
						SET status = $1::INT
					WHERE id IN ($2:csv)
						AND status >= 1
						AND (owner IN ($3:csv)
							OR $4 > 2)
				;`, [ status, id, collaborators_ids, rights ]))

				if (+status < 2) {
					// THE USER IS RETRACTING THE PAD SO IT NEEDS TO BE REMOVED FROM THE review_requests
					batch.push(t.none(`DELETE FROM review_requests WHERE pad IN ($1:csv);`, [ id ]))
				} else if (+status >= 2) {
					batch.push(t.none(`
						UPDATE templates
						SET status = 2
						WHERE id IN (SELECT template FROM pads WHERE id IN ($1:csv))
					;`, [ id ]))
				}
			} else { // PUBLISH ALL
				// MAKE SURE WE ARE NOT PUBLISHING MORE THAN THE LIMIT (IF THERE IS A LIMIT)
				batch.push(t.none(`
					UPDATE pads
						SET status = $1::INT
					WHERE id IN (
						SELECT id FROM pads
						WHERE status >= 1 
							AND (owner IN ($2:csv)
							OR $3 > 2)
						LIMIT $4
					)
				;`, [ status, collaborators_ids, rights, limit ]))
			}
		}

		return t.batch(batch)
		.then(_ => res.redirect(referer))
		.catch(err => console.log(err))
	})
}