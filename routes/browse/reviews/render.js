// THIS IS HEAVILY INSPIRED BY browse/pads/render.js
const { page_content_limit, modules, metafields, engagementtypes, lazyload, map, browse_display, DB } = include('config/')
const header_data = include('routes/header/').data
const { array, datastructures, checklanguage, join } = include('routes/helpers/')

const fetch = require('node-fetch')

const load = require('./load/')
const filter = require('./filter.js').main

exports.main = async (req, res) => { 
	const { object, space } = req.params || {}
	const { display } = req.query || {}
	const { uuid, rights, collaborators } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)

	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req)
	
	const module_rights = modules.find(d => d.type === object)?.rights
	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
	if (!collaborators_ids.length) collaborators_ids = [ uuid ]

	DB.conn.tx(async t => {
		const { participations } = await header_data({ connection: t, req: req })
		
		const batch = []
		
		// PADS DATA
		batch.push(load.data({ connection: t, req }))
		// FILTERS MENU DATA
		batch.push(load.filters_menu({ connection: t, participations, req }))
		// SUMMARY STATISTICS
		batch.push(load.statistics({ connection: t, req }))
		
		return t.batch(batch)
		.then(async results => {
			let [ data,
				filters_menu,
				statistics
			] = results

			const { sections, pads } = data
			console.log(statistics)
			const stats = { 
				total: array.sum.call(statistics.total, 'count'), 
				filtered: array.sum.call(statistics.filtered, 'count'), 
				
				pending: statistics.pending,
				ongoing: statistics.ongoing,
				past: statistics.past,
				
				displayed: data.count,
				breakdown: statistics.filtered,
				persistent_breakdown: statistics.persistent
			}

			const metadata = await datastructures.pagemetadata({ req, page, pagecount: Math.ceil((array.sum.call(statistics.filtered, 'count') || 0) / page_content_limit), display })
			return Object.assign(metadata, { sections, pads, stats, filters_menu })
		})
	}).then(data => res.render('browse/', data))
	.catch(err => console.log(err))
}