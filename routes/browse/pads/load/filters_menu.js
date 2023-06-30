const { apps_in_suite, modules, metafields, DB } = include('config/')
const { array, datastructures, checklanguage, join, flatObj } = include('routes/helpers/')

const filter = require('../filter').main

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	// THIS NEEDS TO BE A TASK
	const { req, res, participations } = kwargs || {}
	let source = kwargs.source || req.query.source || req.body.source
	if (!source || !apps_in_suite.some(d => d.key === source)) source = apps_in_suite[0].key
	
	if (req.session.uuid) { // USER IS LOGGED IN
		var { uuid, rights, collaborators } = req.session || {}
	} else { // PUBLIC/ NO SESSION
		var { uuid, rights, collaborators } = datastructures.sessiondata({ public: true }) || {}
	}
	// const { uuid, rights, collaborators } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)
	const { space } = req.params || {}
	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req, res, { source })

	return conn.task(t => {
		const batch = []
		// GET CONTRBIUTOR BREAKDOWN
		// DEPENDING ON space, GET names OR COUNTRIES
		
		batch.push(t.task(t1 => {
			const batch1 = []
			if (['private', 'curated'].includes(space)) {
				batch1.push(t1.any(`
					SELECT COUNT (DISTINCT (id))::INT, owner
					FROM pads p
					WHERE p.id NOT IN (SELECT review FROM reviews)
						$1:raw
					GROUP BY owner
				;`, [ full_filters ])
				.then(async results => {
					let contributors = await join.users(results, [ language, 'owner' ])
					// THIS NEEDS SOME CLEANING FOR THE FRONTEND
					contributors = contributors.map(d => {
						const obj = {}
						obj.id = d.owner
						obj.name = d.ownername
						obj.count = d.count
						return obj
					})
					contributors.sort((a, b) => a.name?.localeCompare(b.name))

					return contributors.length ? { contributors } : null
				}).catch(err => console.log(err)))
			} else if (['pinned', 'shared', 'public'].includes(space)) {
				batch1.push(t1.any(`
					SELECT p.owner
					FROM pads p
					WHERE p.id NOT IN (SELECT review FROM reviews)
						$1:raw
				;`, [ full_filters ])
				.then(async results => {
					let countries = await join.users(results, [ language, 'owner' ])
					countries = array.count.call(countries, { key: 'country', keyname: 'name', keep: 'iso3' })
					// THIS NEEDS SOME CLEANING FOR THE FRONTEND
					countries = countries.map(d => {
						const obj = {}
						obj.id = d.iso3
						obj.name = d.name
						obj.count = d.count
						return obj
					})
					countries.sort((a, b) => a.name?.localeCompare(b.name))
					return countries.length ? { countries } : null
				}).catch(err => console.log(err)))
			} else batch1.push(null)
			
			// GET TEMPLATE BREAKDOWN
			// if (modules.includes('templates')) {
			if (modules.some(d => d.type === 'templates')) {
				batch1.push(t1.any(`
					SELECT COUNT (DISTINCT (p.id))::INT, t.id, t.title FROM pads p 
					INNER JOIN templates t 
						ON p.template = t.id
					WHERE p.id NOT IN (SELECT review FROM reviews)
						$1:raw
					GROUP BY t.id
				;`, [ full_filters ]).then(results => { 
					// THIS NEEDS SOME CLEANING FOR THE FRONTEND
					const templates = results.map(d => {
						const obj = {}
						obj.id = d.id
						obj.name = d.title
						obj.count = d.count
						return obj
					})
					templates.sort((a, b) => a.name?.localeCompare(b.name))

					return templates.length ? { templates } : null
				}))
			} else batch1.push(null)
			
			// GET MOBILIZATIONS BREAKDOWN
			// TO DO: IF USER IS NOT HOST OF THE MBILIZATION, ONLY MAKE THIS AVAILABLE IN PUBLIC VIEW
			// (CONTRIBUTORS CAN ONLY SEE WHAT OTHERS HAVE PUBLISHED)
			// if (modules.includes('mobilizations') && participations.length) {
			if (modules.some(d => d.type === 'mobilizations') && participations.length) {
				batch1.push(t1.any(`
					SELECT COUNT (DISTINCT (p.id))::INT, m.id, m.title AS name, start_date FROM pads p 
					INNER JOIN mobilization_contributions mc 
						ON mc.pad = p.id
					INNER JOIN mobilizations m
						ON m.id = mc.mobilization
					WHERE m.id IN ($1:csv)
						AND p.id NOT IN (SELECT review FROM reviews)
						$2:raw
					GROUP BY m.id
					ORDER BY m.start_date DESC
				;`, [ participations.map(d => d.id), full_filters ]).then(results => { 
					return results.length ? { mobilizations: results } : null
				}))
			} else batch1.push(null)
			
			return t1.batch(batch1)
			.then(results => results.filter(d => d))
			.catch(err => console.log(err))
		}).catch(err => console.log(err)))
		
		// GET TAGS, INDEXES, AND OTHER METAFILEDS BREAKDOWN
		batch.push(t.task(t1 => {
			const batch1 = []
			
			metafields.filter(d => ['tag', 'index'].includes(d.type))
			.forEach(d => {
				batch1.push(t1.any(`
					SELECT COUNT (DISTINCT (t.pad))::INT, t.tag_id AS id, t.type FROM tagging t
					INNER JOIN pads p
						ON p.id = t.pad
					WHERE t.type = $1
						AND p.id NOT IN (SELECT review FROM reviews)
						$2:raw
					GROUP BY (tag_id, t.type)
				;`, [ d.label, full_filters ]).then(async results => { 
					const tags = await join.tags(results, [ language, 'id', d.label, d.type ])

					if (d.type === 'index') {
						tags.forEach(d => {
							d.name = `${d.key} – ${d.name}`
							// d.id = d.key
							// delete d.key
						})
						tags.sort((a, b) => a.key - b.key)
					} else tags.sort((a, b) => a.name?.localeCompare(b.name))
					
					let obj = null
					if (tags.length) {
						obj = {}
						obj[d.label.toLowerCase()] = tags
					}
					return obj
				}).catch(err => console.log(err)))
			})

			metafields.filter(d => !['tag', 'index', 'location', 'attachment'].includes(d.type))
			.forEach(d => {
				batch1.push(t1.any(`
					SELECT COUNT (DISTINCT (m.pad))::INT, m.value AS name, m.key AS id FROM metafields m
					INNER JOIN pads p
						ON p.id = m.pad
					WHERE m.name = $1
						AND p.id NOT IN (SELECT review FROM reviews)
						$2:raw
					GROUP BY (m.name, m.value, m.key)
				;`, [ d.label, full_filters ]).then(results => {

					results.sort((a, b) => {
						if (Number.isInteger(a?.id) && Number.isInteger(b?.id)) return a?.id - b?.id
						else return a?.name?.localeCompare(b?.name)
					})
					
					let obj = null
					if (results.length) {
						obj = {}
						obj[d.label.toLowerCase()] = results
					}
					return obj
				}).catch(err => console.log(err)))
			})

			return t1.batch(batch1)
			.then(results => results.filter(d => d))
			.catch(err => console.log(err))
		}).catch(err => console.log(err)))

		return t.batch(batch)
		.then(results => results.filter(d => d.length))
		.catch(err => console.log(err))
	}).then(results => {
		return results.map(d => flatObj.call(d))
	}).catch(err => console.log(err))
}