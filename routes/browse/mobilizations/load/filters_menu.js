const { modules, metafields, DB } = include('config/')
const { datastructures, checklanguage, count, flatObj } = include('routes/helpers/')

const filter = require('../filter').main

// TO DO: FIX THIS (SEE ISSUES IN PUBLIC VIEW)

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	// THIS NEEDS TO BE A TASK
	const { req, participations } = kwargs || {}
	const { space } = req.params || {}
	const { uuid, rights } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)
	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req)

	return conn.task(t => {
		const batch = []
			
		// GET TEMPLATE BREAKDOWN
		// if (modules.includes('templates')) {
		if (modules.some(d => d.type === 'templates')) {
			batch.push(t.any(`
				SELECT COUNT (DISTINCT (m.id))::INT, t.id, t.title FROM mobilizations m 
				INNER JOIN templates t 
					ON m.template = t.id
				WHERE (m.owner = $1
					OR $1 IN (SELECT mc.participant FROM mobilization_contributors mc WHERE mc.mobilization = m.id)
					OR $2 > 2)
					$3:raw
				GROUP BY t.id
			;`, [ uuid, rights, f_space ]).then(results => { 
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
		} else batch.push(null)
			
		return t.batch(batch)
		.then(results => results.filter(d => d))
		.catch(err => console.log(err))
	}).then(results => {
		return results
		// return results.map(d => flatObj.call(d))
	}).catch(err => console.log(err))
}