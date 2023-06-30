const { modules, DB } = include('config/')
// const header_data = include('routes/header').data
const helpers = include('routes/helpers/')

exports.main = (req, res) => { // TO DO
	// 1 CREATE AND STORE THE TEMPLATE
	// 2 CREATE AND STORE THE PADS
	const { pads, template, tags, mobilization } = req.body || {}
	const { uuid, country } = req.session || {}
	template.owner = uuid

	DB.conn.tx(t => {
		// INSERT THE TEMPLATE TO GET THE id
		const sql = DB.pgp.helpers.insert(template, null, 'templates')
		return t.one(`
			$1:raw
			RETURNING id AS template_id
		;`, [ sql ])
		.then(async result => {
			const { template_id } = result

			return t.batch(pads.map(d => {
				d.owner = uuid
				d.template = template_id

				return t.task(t1 => {
					// STORE PAD INFO
					const sql = DB.pgp.helpers.insert(d, ['title', 'sections', 'full_text', 'status', 'owner', 'template'], 'pads')
					return t1.one(`
						$1:raw
						RETURNING id AS pad_id
					;`, [ sql ])
					.then(result => {
						const { pad_id } = result
						const batch1 = []

						if (d.tags?.length) {
							// STORE NEW TAGS 
							d.tags.forEach(c => {
								c.contributor = uuid
								c.name = c.name?.trim()
							})
							const sql = DB.pgp.helpers.insert(d.tags, ['name', 'type', 'contributor'], 'tags')
							batch1.push(DB.general.task(gt => {
								return gt.any(`
									$1:raw
									ON CONFLICT ON CONSTRAINT name_type_key
										DO NOTHING
								;`, [ sql ])
								.then(results => {
									return gt.batch(d.tags.map(c => {
										return gt.one(`
											SELECT id AS tag_id, type FROM tags
											WHERE name = $1
												AND type = $2
										;`, [ c.name, c.type ])
									}))
								})
							}).then(results => {
								if (results.length) {
									// SAVE TAGS INFO
									results.forEach(c => c.pad = pad_id)
									const tags_sql = DB.pgp.helpers.insert(results, ['pad', 'tag_id', 'type'], 'tagging')
									return t1.none(`
										$1:raw
										ON CONFLICT ON CONSTRAINT unique_pad_tag_type
											DO NOTHING
									;`, [ tags_sql ])
								} else return null
							}).catch(err => console.log(err)))
						}

						if (d.locations?.length) {
							// SAVE LOCATIONS INFO
							d.locations.forEach(c => c.pad = pad_id)
							const locations_sql = DB.pgp.helpers.insert(d.locations, ['pad', 'lng', 'lat'], 'locations')
							batch1.push(t1.none(`
								$1:raw
								ON CONFLICT ON CONSTRAINT unique_pad_lnglat
									DO NOTHING
							;`, [ locations_sql ]))
						}

						if (d.metadata?.length) {
							// SAVE METAFIELDS
							d.metadata.forEach(c => {
								c.pad = pad_id
								if (!Number.isInteger(c.key)) c.key = null
							})
							const metadata_sql = DB.pgp.helpers.insert(d.metadata, ['pad', 'type', 'name', 'key', 'value'], 'metafields')
							batch1.push(t1.none(`
								$1:raw
								ON CONFLICT ON CONSTRAINT pad_value_type
									DO NOTHING
							;`, [ metadata_sql ]))
						}

						if (+mobilization !== 0) {
							// SAVE MOBILIZATION INFO
							// batch1.push(t.none(`
							// 	INSERT INTO mobilization_contributions (pad, mobilization) VALUES ($1, $2)
							// ;`, [ pad_id, mobilization ]))
							batch1.push(t.none(`
								INSERT INTO mobilization_contributions (pad, mobilization)
								SELECT $1::INT, m.id FROM mobilizations m 
									WHERE m.id IN ($2::INT, (SELECT source FROM mobilizations WHERE id = $2::INT AND child = TRUE))
							;`, [ pad_id, mobilization ]))


						}

						return t1.batch(batch1)
						.then(_ => pad_id)
					}).catch(err => console.log(err))
				}).catch(err => console.log(err))
			}))
		})
	}).then(results => res.json({ pads: results }))
	.catch(err => console.log(err))
}