const { page_content_limit, DB } = include('config/')
const header_data = include('routes/header/').data
const { array, checklanguage, datastructures } = include('routes/helpers/')

const load = require('./load/')

// TO DO: INTEGRATE OPTIONS FROM config.js
const filter = require('./filter.js').main

exports.main = async (req, res) => {
	const { object, space } = req.params || {}
	const { display } = req.query || {}
	const { rights } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)

	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req)

	DB.conn.tx(async t => {
		const { participations } = await header_data({ connection: t, req: req })
	
		const batch = []
		
		// PADS DATA
		batch.push(load.data({ connection: t, req }))
		// FILTERS_MENU
		batch.push(load.filters_menu({ connection: t, participations, req }))
		// SUMMARY STATISTICS
		batch.push(load.statistics({ connection: t, req }))
		
		return t.batch(batch)
		.then(async results => {
			let [ data, 
				filters_menu,
				statistics
			] = results

			const stats = { 
				total: array.sum.call(statistics.total, 'count'), 
				filtered: array.sum.call(statistics.filtered, 'count'),
				
				private: statistics.private,
				curated: statistics.curated,
				shared: statistics.shared,
				public: statistics.public, 
				
				displayed: data.count,
				breakdown: statistics.filtered,
				persistent_breakdown: statistics.persistent,
				contributors: statistics.contributors
			}

			const metadata = await datastructures.pagemetadata({ req, page, pagecount: Math.ceil((array.sum.call(statistics.filtered, 'count') || 0) / page_content_limit), display: display || 'rows' })
			return Object.assign(metadata, { sections: data.sections, stats, filters_menu })
		})
	}).then(data => res.render('browse/', data))
	.catch(err => console.log(err))
}