const { page_content_limit, modules, metafields, lazyload, DB } = include('config/')
const header_data = include('routes/header/').data
const load = require('./load/')
const { array, datastructures } = include('routes/helpers/')

// TO DO: INTEGRATE OPTIONS FROM config.js
const filter = require('./filter.js').main

exports.main = (req, res) => {
	const { object, space } = req.params || {}
	const { display } = req.query || {}
	// GET FILTERS
	const [ f_space, order, page, full_filters ] = filter(req)

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
					
					scheduled: statistics.scheduled,
					ongoing: statistics.ongoing,
					past: statistics.past,
					
					displayed: data.count,
					breakdown: statistics.filtered,
					persistent_breakdown: statistics.total
					// contributors: statistics.contributors,
				}

			const metadata = await datastructures.pagemetadata({ req, page, pagecount: Math.ceil((array.sum.call(statistics.filtered, 'count') || 0) / page_content_limit), display: display || 'rows' })
			return Object.assign(metadata, { sections: data.sections, stats, filters_menu })

			// return {
			// 	metadata : {
			// 		site: {
			// 			modules,
			// 			metafields
			// 		},
			// 		page: {
			// 			title: pagetitle, 
			// 			path,
			// 			id: page,
			// 			count: Math.ceil(array.sum.call(statistics.filtered, 'count') || 0) / page_content_limit),
			// 			// count: Math.ceil(array.sum.call(statistics.filtered, 'count') || 0) / page_content_limit),
			// 			lazyload,
			// 			language,
			// 			activity: path[1],
			// 			object,
			// 			space,
			// 			query,
			// 			map: false
			// 		},
			// 		menu : {
			// 			templates,
			// 			participations
			// 		},
			// 		user: {
			// 			uuid,
			// 			name: username,
			// 			country,
			// 			centerpoint: JSON.stringify(req.session.country?.lnglat || {}),
			// 			rights
			// 		}
			// 	},
			// 	filters_menu,
				
			// 	// mobilizations: data.mobilizations,
			// 	sections: data.sections
			// }
		})
	}).then(data => res.render('browse/', data))
	.catch(err => console.log(err))
}