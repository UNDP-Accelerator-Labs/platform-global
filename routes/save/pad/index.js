const { DB } = include('config/')
const fs = require('fs')
const path = require('path')

exports.main = (req, res) => {
	const { id, tagging, locations, metadata, deletion, mobilization } = req.body || {}
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
		const batch = []

		return t.oneOrNone(saveSQL)
		.then(result => {
			const newID = result ? result.id : undefined
			const batch = []	
			
			// SAVE TAGS INFO
			if (tagging?.length) {
				// SAVE TAGS INFO
				tagging.forEach(d => {
					d.tag_id = d.id
					d.pad = newID || id
				})
				// INSERT ALL NEW TAGS
				const sql = DB.pgp.helpers.insert(tagging, ['pad', 'tag_id', 'type'], 'tagging')
				batch.push(t.none(`
					$1:raw
					ON CONFLICT ON CONSTRAINT unique_pad_tag_type
						DO NOTHING
				;`, [ sql ]))
				// REMOVE ALL OLD TAGS
				batch.push(t.none(`
					DELETE FROM tagging
					WHERE pad = $1
						AND tag_id NOT IN ($2:csv)
				;`, [ newID || id, tagging.map(d => d.tag_id) ]))
			} else batch.push(t.none(`
				DELETE FROM tagging
				WHERE pad = $1
			;`, [ newID || id ]))
			
			// SAVE LOCATIONS INFO
			if (locations?.length) {
				// SAVE THE LOCATION INFO
				locations.forEach(d => d.pad = newID || id)
				const sql = DB.pgp.helpers.insert(locations, ['pad', 'lng', 'lat'], 'locations')
				batch.push(t.none(`
					$1:raw
					ON CONFLICT ON CONSTRAINT unique_pad_lnglat
						DO NOTHING
				;`, [ sql ]))
				// REMOVE ALL OLD LOCATIONS
				const values = DB.pgp.helpers.values(locations, ['pad', 'lng', 'lat'])
				batch.push(t.none(`
					DELETE FROM locations
					WHERE pad IN ($1:csv)
						AND (pad, lng, lat) NOT IN ($2:raw)
				;`, [ locations.map(d => d.pad), values ]))
			} else batch.push(t.none(`
				DELETE FROM locations
				WHERE pad = $1
			;`, [ newID || id ]))

			// SAVE EXTRA METADATA INFO
			if (metadata?.length) {
				// SAVE THE METADATA
				metadata.forEach(d => {
					d.pad = newID || id
					if (!Number.isInteger(d.key)) d.key = null
				})
				const sql = DB.pgp.helpers.insert(metadata, ['pad', 'type', 'name', 'key', 'value'], 'metafields')
				batch.push(t.none(`
					$1:raw
					ON CONFLICT ON CONSTRAINT pad_value_type
						DO NOTHING
				;`, [ sql ]))
				// REMOVE ALL OLD METADATA
				const values = DB.pgp.helpers.values(metadata, ['type', 'name', 'key', 'value'])
				batch.push(t.none(`
					DELETE FROM metafields
					WHERE pad = $1
						AND (type, name, key, value) NOT IN ($2:raw)
				;`, [ newID || id, values ]))
			} else batch.push(t.none(`
				DELETE FROM metafields
				WHERE pad = $1
			;`, [ newID || id ]))
			
			// SAVE MOBILIZATION INFO
			if (mobilization && newID) {
				batch.push(t.none(`
					INSERT INTO mobilization_contributions (pad, mobilization)
					-- VALUES ($1, $2)
					SELECT $1::INT, m.id FROM mobilizations m 
						WHERE m.id IN ($2::INT, (SELECT source FROM mobilizations WHERE id = $2::INT AND child = TRUE))
				;`, [ newID, mobilization ]))
			}
			
			// UPDATE THE TIMESTAMP
			batch.push(t.none(`
				UPDATE pads SET update_at = NOW() WHERE id = $1::INT
			;`, [ newID || id]))
			
			return t.batch(batch)
				.then(_ => newID)
				.catch(err => console.log(err))
		})
	}).then(newID => {
		if (deletion) {
			const promises = deletion.map(f => {
				if (fs.existsSync(path.join(__dirname, `../public/${f}`))) {
					return new Promise(resolve => {
						resolve(fs.unlinkSync(path.join(__dirname, `../public/${f}`)))
					})
				}
			})
			Promise.all(promises).then(_ => res.json({ status: 200, message: 'Successfully saved.', object: newID }))
		} else res.json({ status: 200, message: 'Successfully saved.', object: newID })
	}).catch(err => console.log(err))
}