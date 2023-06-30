const { modules, DB } = include('config/')
// const { checklanguage } = include('routes/helpers/')

exports.pin = (req, res) => {
	const { uuid, collaborators } = req.session || {}
	const { board_id, board_title, object_id, mobilization } = req.body || {}
	// THE SOURCE IS PASSED IN THE object_id
	
	// const language = checklanguage(req.params?.language || req.session.language)
	
	const module_rights = modules.find(d => d.type === 'pads')?.rights
	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
	if (!collaborators_ids.length) collaborators_ids = [ uuid ]

	if (!board_id) { // CREATE NEW BOARD
		if (board_title?.trim().length > 0) {
			return DB.conn.tx(t => {
				return t.oneOrNone(`
					INSERT INTO pinboards (title, owner)
					VALUES ($1, $2)
					ON CONFLICT ON CONSTRAINT unique_pinboard_owner
						DO NOTHING
					RETURNING id
				;`, [ board_title, uuid ])
				.then(result => {
					if (result) return result
					else return t.one(`
						SELECT id FROM pinboards
						WHERE title = $1
							AND owner = $2
					;`, [ board_title, uuid ])
				}).then(result => {
					const { id } = result
					const batch = []

					batch.push(t.none(`
						INSERT INTO pinboard_contributors (pinboard, participant)
						VALUES ($1::INT, $2)
						ON CONFLICT ON CONSTRAINT unique_pinboard_contributor
							DO NOTHING
					;`, [ id, uuid ]))
					
					batch.push(
						t.none(insertpads(id, object_id, mobilization))
						.then(_ => t.none(updatestatus(id, object_id, mobilization)))
						.catch(err => console.log(err))
					)
					
					return t.batch(batch)
					.then(_ => {
						const batch = []
						batch.push(id)
						batch.push(t.any(retrievepins(object_id)))
						// batch.push(t.any(retrievepinboards(collaborators_ids)))
						batch.push(t.any(retrievepinboards([ uuid ])))
						return t.batch(batch)
					}).catch(err => console.log(err))
				}).catch(err => console.log(err))
			}).then(results => {
				const [ id, pins, pinboards_list ] = results
				res.json({ status: 200, message: 'Successfully created pinboard and added pad.', board_id: id, pins, pinboards_list })
			}).catch(err => console.log(err))
		} else res.json({ status: 400, message: 'You need to create a title for a new pinboard.' })
	} else { // SIMPLY ADD PAD TO BOARD
		if (object_id) {
			return DB.conn.tx(t => {
				return t.none(insertpads(board_id, object_id, mobilization))
				.then(_ => t.none(updatestatus(board_id, object_id, mobilization)))
				.then(_ => {
					const batch = []
					batch.push(t.any(retrievepins(object_id)))
					// batch.push(t.any(retrievepinboards(collaborators_ids)))
					batch.push(t.any(retrievepinboards([ uuid ])))
					return t.batch(batch)
				})
				.catch(err => console.log(err))
			}).then(results => {
				const [ pins, pinboards_list ] = results
				res.json({ status: 200, message: 'Successfully added pad.', board_id, pins, pinboards_list })
			}).catch(err => console.log(err))
		} else res.json({ status: 400, message: 'You are not adding a pad.' })
	}
}

exports.unpin = (req, res) => {
	const { uuid, collaborators } = req.session || {}
	const { board_id, object_id, mobilization } = req.body || {}

	const module_rights = modules.find(d => d.type === 'pads')?.rights
	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
	if (!collaborators_ids.length) collaborators_ids = [ uuid ]

	if (object_id) {
		return DB.conn.tx(t => {
			return t.none(removepads(board_id, object_id, mobilization, uuid))
			.then(_ => t.none(updatestatus(board_id, object_id, mobilization)))
			.then(_ => {
				return t.none(`
					DELETE FROM pinboards
					WHERE id = $1::INT
						AND (SELECT COUNT (pad) FROM pinboard_contributions WHERE pinboard = $1::INT) = 0
						-- AND owner IN ($2:csv)
						AND owner = $2
				;`, [ board_id, uuid /* collaborators_ids */ ])
			}).then(_ => {
				const batch = []
				batch.push(t.any(retrievepins(object_id)))
				// batch.push(t.any(retrievepinboards(collaborators_ids)))
				batch.push(t.any(retrievepinboards([ uuid ])))
				return t.batch(batch)
			})
		}).then(results => {
			const [ pins, pinboards_list ] = results
			res.json({ status: 200, message: 'Successfully created pinboard and added pad.', pins, pinboards_list })
		}).catch(err => console.log(err))
	} else res.json({ status: 400, message: 'You are not removing a pad.' })
}


function insertpads (_id, _object_id, _mobilization) {
	if (_object_id) {
		if (!Array.isArray(_object_id)) _object_id = [_object_id]
		const data = _object_id.map(d => {
			const obj = {}
			obj.pinboard = _id
			obj.pad = d.id
			obj.source = d.source
			return obj
		})

		const insert = DB.pgp.helpers.insert(data, ['pinboard', 'pad', 'source'], 'pinboard_contributions')
		const constraint = DB.pgp.as.format(`ON CONFLICT ON CONSTRAINT unique_pad_pinboard DO NOTHING`)
		return `${insert} ${constraint}`

	} else if (_mobilization) {
		return DB.pgp.as.format(`
			UPDATE pinboards
			SET mobilization = $1::INT
			WHERE id = $2::INT
		;`, [ _mobilization, _id ])
	}
}
function removepads (_id, _object_id, _mobilization, _uuid) {
	if (_object_id) {
		if (!Array.isArray(_object_id)) _object_id = [_object_id]

		const values = DB.pgp.helpers.values(_object_id, [ 'id', 'source' ])
		return DB.pgp.as.format(`
			DELETE FROM pinboard_contributions
			WHERE pinboard = $1::INT
				AND (pad, source) IN ($2:csv)
				AND pinboard IN (
					SELECT id FROM pinboards 
					WHERE owner = $3
				)
		;`, [ _id, values, _uuid ])
	} else if (_mobilization) {
		return DB.pgp.as.format(`
			UPDATE pinboards
			SET mobilization = NULL
			WHERE id = $1::INT
				AND owner = $2
		;`, [ _id, _uuid ])
	}
}
function updatestatus (_id, _object_id, _mobilization) {
	if (_object_id) {
		return DB.pgp.as.format(`
			UPDATE pinboards
			-- SET status = (SELECT GREATEST (
			-- 	LEAST ((SELECT COALESCE(MAX (p.status), 0) FROM pads p
			-- 	INNER JOIN pinboard_contributions pc
			-- 		ON pc.pad = p.id
			-- 	WHERE pc.pinboard = $1::INT), 1)
			-- 	, status)
			-- )
			SET status = (SELECT GREATEST (1, status))
			WHERE id = $1::INT
		;`, [ _id ])
	} else if (_mobilization) { // TO DO: CHECK WHETHER THIS WORKS
		return DB.pgp.as.format(`
			UPDATE pinboards
			SET status = (
				SELECT MAX (p.status) FROM pads p
				INNER JOIN mobilization_contributions mc
					ON mc.pad = p.id
				INNER JOIN pinboards pin
					ON pin.mobilization = mc.mobilization
				WHERE pin.id = $1::INT
			)
			WHERE id = $1::INT
		;`, [ _id ])	
	}
}
function retrievepins (_object_id) {
	if (!Array.isArray(_object_id)) _object_id = [_object_id]

	const values = DB.pgp.helpers.values(_object_id, [ 'id', 'source' ])
	return DB.pgp.as.format(`
		SELECT pb.id, pb.title FROM pinboards pb
		-- INNER JOIN pinboard_contributions pbc
		-- 	ON pbc.pinboard = pb.id
		-- INNER JOIN pads p
		-- 	ON pbc.pad = p.id
		-- WHERE p.id IN ($1:csv)
		WHERE pb.id IN (
			SELECT pinboard FROM pinboard_contributions
			WHERE (pad, source) IN ($1:raw)
		)
	;`, [ values ])
}
function retrievepinboards (_owners) {
	return DB.pgp.as.format(`
		SELECT p.id, p.title, COALESCE(COUNT (DISTINCT (pc.pad)), 0)::INT AS count FROM pinboards p
		INNER JOIN pinboard_contributions pc
			ON pc.pinboard = p.id
		WHERE p.owner IN ($1:csv)
		GROUP BY p.id
	;`, [ _owners ])
}