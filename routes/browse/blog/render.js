const { page_content_limit, apps_in_suite, modules, metafields, engagementtypes, lazyload, map, browse_display, welcome_module, DB } = include('config/')
const header_data = include('routes/header/').data
const { array, datastructures, checklanguage, join, parsers } = include('routes/helpers/')

const fetch = require('node-fetch')

const loadAggValues = require('./loadAgg')
const searchBlogs  = require('./searchBlogs')
const filter = require('./filters')
const filterpage = require('../pads/filter.js').main

exports.main = async (req, res) => { 
	const [ f_space, order, page, full_filters ] = await filterpage(req, res)

    let { mscale, display, pinboard, source } = req.query || {}
	if (!source || !apps_in_suite.some(d => d.key === source)) source = apps_in_suite[0].key

	let metadata;

	const data = await DB.blog.tx(async t => {
		const batch = []
		
		// LOAD AGGREGATE VALUES
		batch.push(loadAggValues.main({ connection: t, req, res, page }))

		//LOAD search reasults
		batch.push(searchBlogs.main({ connection: t, req, res,page_content_limit, page }))

		//LOAD filter reasults
		batch.push(filter.main({ connection: t, req, res }))

		return t.batch(batch)
			.catch(err => console.log(err))

	})
	.then(async results => {
		metadata = await datastructures.pagemetadata({ req, res, page, pagecount: +(results[1]['total_pages']) || 1, map, mscale, source, display: 'blog' })
		
		if(!metadata?.metadata?.page?.query['search']){
			metadata.metadata.page.query.search = ""
		}

		return results
	})
	.catch(err => console.log(err))

	res.render('browse/blogs/', Object.assign(metadata, { data, clusters: [data?.[2]?.['geoData']] || [] } ) )
}