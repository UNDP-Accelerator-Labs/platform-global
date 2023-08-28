const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
// const rootpath = path.resolve(__dirname, '../..')
// global.include = path => require(`${rootpath}/${path}`)

const turf = require('@turf/turf')

const { app_title_short, metafields, DB } = include('config/')
const { checklanguage, array, join, parsers } = include('routes/helpers/')

const filter = include('routes/browse/pads/filter').main

exports.main = async (req, res) => {
	let { output, render, use_templates, include_data, include_imgs, include_tags, include_locations, include_metafields, include_engagement, include_comments } = Object.keys(req.query)?.length ? req.query : Object.keys(req.body)?.length ? req.body : {} // req.body || {}
	const pw = req.session.email || null
	const language = checklanguage(req.params?.language || req.session.language)

	const [ f_space, order, page, full_filters ] = await filter(req, res)
	let cors_filter = ''
	if (!pw) cors_filter = DB.pgp.as.format(`AND p.status > 2`)

	if (output === 'geojson') {
		include_locations = true
	}
	return res.redirect('/module-error')

	// return Promise.all(DB.conns.map(async app_conn => {
	// 	const [ f_space, order, page, full_filters ] = await filter(req, res, { source: app_conn.key })

	// 	// CREATE A tmp FOLDER TO STORE EVERYTHING
	// 	if (render) {
	// 		// const basedir = path.join(__dirname, `../public/uploads/`)
	// 		var basedir = path.join(rootpath, '/tmp')
	// 		if (!fs.existsSync(basedir)) fs.mkdirSync(basedir)
	// 		const now = new Date()
	// 		var dir = path.join(basedir, `download-${app_conn.key.toLowerCase().replace(/\s/g, '_')}-${+now}`)
	// 		if (!fs.existsSync(dir)) fs.mkdirSync(dir)
	// 	}

	// 	return app_conn.conn.any(`
	// 		SELECT p.id AS pad_id, 
	// 			p.owner AS contributor_id, 
	// 			p.title, 
	// 			p.date AS created_at, 
	// 			p.update_at AS updated_at, 
	// 			p.status, 
	// 			p.source AS source_pad_id, 
	// 			p.template, 
	// 			-- p.full_text, 
	// 			p.sections,

	// 			COALESCE(jsonb_agg(DISTINCT (jsonb_build_object('tag_id', t.tag_id, 'type', t.type))) FILTER (WHERE t.tag_id IS NOT NULL), '[]') AS tags,

	// 			COALESCE(jsonb_agg(DISTINCT (jsonb_build_object('lat', l.lat, 'lng', l.lng))) FILTER (WHERE l.lat IS NOT NULL AND l.lng IS NOT NULL), '[]') AS locations,
				
	// 			COALESCE(jsonb_agg(DISTINCT (jsonb_build_object('type', m.type, 'name', m.name, 'value', m.value))) FILTER (WHERE m.value IS NOT NULL), '[]') AS metadata,

	// 			COALESCE(jsonb_agg(DISTINCT (jsonb_build_object('type', e.type, 'count', (SELECT count(type) FROM engagement WHERE type = e.type AND docid = p.id )))) FILTER (WHERE e.type IS NOT NULL), '[]') AS engagement,

	// 			COALESCE(jsonb_agg(DISTINCT (jsonb_build_object('message_id', c.id, 'response_to_message_id', c.source, 'user_id', c.contributor, 'date', c.date, 'message', c.message))) FILTER (WHERE c.id IS NOT NULL), '[]') AS comments
			
	// 		FROM pads p

	// 		LEFT JOIN tagging t
	// 			ON t.pad = p.id

	// 		LEFT JOIN locations l
	// 			ON l.pad = p.id

	// 		LEFT JOIN metafields m
	// 			ON m.pad = p.id

	// 		LEFT JOIN engagement e
	// 			ON e.docid = p.id

	// 		LEFT JOIN comments c
	// 			ON c.docid = p.id

	// 		WHERE TRUE
	// 			$1:raw
	// 			$2:raw
	// 			AND p.id NOT IN (SELECT review FROM reviews)
			
	// 		GROUP BY (p.id)
	// 		ORDER BY p.id DESC
	// 	;`, [ full_filters, cors_filter ]).then(async pads => {	
	// 		let contributor_list = array.unique.call(pads, { key: 'contributor_id', onkey: true })
	// 		contributor_list = array.shuffle.call(contributor_list)

	// 		const open = pads.every(d => d.status > 2)

	// 		if (use_templates) {
	// 			pads = array.nest.call(pads, { key: 'template' })
	// 		} else {
	// 			pads = [{ key: 0, values: pads }]
	// 		}

	// 		pads = await Promise.all(pads.map(pad_group => {
	// 			return new Promise(async resolve => {
	// 				if (include_imgs) {
	// 					pad_group.values.forEach(d => {
	// 						// GET THE MEDIA ITEMS
	// 						d.media = parsers.getImg(d, false)
	// 					})
	// 					var imgs = pad_group.values.map(d => {
	// 						return d.media?.map(c => {
	// 							const obj = {}
	// 							obj.pad_id = d.pad_id
	// 							obj.image = c
	// 							return obj
	// 						})
	// 					}).flat().filter(d => d)
	// 				}

	// 				pad_group.values = await Promise.all(pad_group.values.map(d => {
	// 					return new Promise(async resolve => {
	// 						// ANONYMIZE CONTRIBUTORS
	// 						// NOTE THIS id IS DISSOCIATED FROM COMMENTS
	// 						d.contributor_id = `c-${contributor_list.indexOf(d.contributor_id) + 1}`

	// 						// SET TAGS WITH NAMES
	// 						if (include_tags) {
	// 							const nest = array.nest.call(d.tags, { key: 'type' })
	// 						 	const tags = await Promise.all(nest.map(d => {
	// 								return new Promise(async resolve1 => {
	// 									const tags = await join.tags(d.values, [ language, 'tag_id', d.key ])
	// 									tags?.forEach(d => {
	// 										delete d.tag_id
	// 										delete d.equivalents
	// 									})
	// 									resolve1(tags)
	// 								})
	// 							}))
	// 							d.tags = tags.flat()
	// 						} else delete d.tags

	// 						// SET LOCATIONS
	// 						if (!include_locations) delete d.locations

	// 						// SET IMAGES
	// 						if (include_imgs) {
	// 							d.media = d.media?.map(c => {
	// 								const idx = imgs.findIndex(b => b.image === c)
	// 								if (render && fs.existsSync(path.join(rootpath, `/public${c.replace('uploads/sm', 'uploads')}`))) {
	// 									return `images/pad-${d.pad_id}/image-${idx + 1}${path.extname(c)}`
	// 								} else return c
	// 							})

	// 						}

	// 						// SET METAFIELDS
	// 						// if (include_attachments) {
	// 						// 	d.attachments = parsers.getAttachments(d)
	// 						// }
	// 						if (!include_metafields) delete d.metadata

	// 						// SET ENGAGEMENT
	// 						if (!include_engagement) delete d.engagement

	// 						// ANONYMIZE COMMENTERS
	// 						if (include_comments) {
	// 							let commenter_list = array.unique.call(pad_group.values.map(d => d.comments).flat(), { key: 'user_id', onkey: true })
	// 							commenter_list = array.shuffle.call(commenter_list)

	// 							d.comments.forEach(c => {
	// 								c.user_id = `u-${commenter_list.indexOf(c.user_id) + 1}`
	// 							})
	// 						} else delete d.comments

	// 						// SET MAIN DATA
	// 						if (!include_data) delete d.sections

	// 						resolve(d)
	// 					})
	// 				}))

	// 				if (output === 'geojson') {
	// 					pad_group.values = pad_group.values.map(d => {
	// 						const { locations, ...properties } = d
	// 						return d.locations.map(c => {
	// 							return turf.point([c.lng, c.lat], properties)
	// 						})
	// 					}).flat()
	// 				}

	// 				// RENDER THE FILES
	// 				if (render) {
	// 					if (use_templates) {
	// 						const template_dir = path.join(dir, `${app_title_short}_template_${pad_group.key}`)
	// 						if (!fs.existsSync(template_dir)) fs.mkdirSync(template_dir)

	// 						if (include_imgs && imgs.length > 0) {
	// 							const img_dir = path.join(template_dir, 'images')
	// 							if (!fs.existsSync(img_dir)) fs.mkdirSync(img_dir)

	// 							imgs.forEach((d, i) => {
	// 								const img_pad_dir = path.join(img_dir, `pad-${d.pad_id}`)
	// 								if (!fs.existsSync(img_pad_dir)) fs.mkdirSync(img_pad_dir)
	// 								try {
	// 									fs.copyFileSync(path.join(rootpath, `/public${d.image.replace('uploads/sm', 'uploads')}`), path.join(img_pad_dir, `image-${i + 1}${path.extname(d.image)}`), fs.constants.COPYFILE_EXCL)
	// 								} catch(err) { console.log(err) }
	// 							})
	// 						}

	// 						fs.writeFileSync(path.join(template_dir, 'data.json'), JSON.stringify(pad_group.values))
	// 					} else {
	// 						if (include_imgs && imgs.length > 0) {
	// 							const img_dir = path.join(dir, 'images')
	// 							if (!fs.existsSync(img_dir)) fs.mkdirSync(img_dir)

	// 							imgs.forEach((d, i) => {
	// 								const img_pad_dir = path.join(img_dir, `pad-${d.pad_id}`)
	// 								if (!fs.existsSync(img_pad_dir)) fs.mkdirSync(img_pad_dir)
	// 								try {
	// 									fs.copyFileSync(path.join(rootpath, `/public${d.image.replace('uploads/sm', 'uploads')}`), path.join(img_pad_dir, `image-${i + 1}${path.extname(d.image)}`), fs.constants.COPYFILE_EXCL)
	// 								} catch(err) { console.log(err) }
	// 							})
	// 						}

	// 						fs.writeFileSync(path.join(dir, `${app_title_short}_data.json`), JSON.stringify(pad_group.values))
	// 					}
	// 				}
	// 				resolve(pad_group)
	// 			})
	// 		}))
	// 		return { open, basedir, dir, data: pads.map(d => d.values) }
	// 	}).catch(err => console.log(err))
	// })).then(results => {
	// 	const open = results.every(d => d.open === true)
	// 	const dirs = results.map(d => path.relative(d.basedir, d.dir))
	// 	const basedir = array.unique.call(results, { key: 'basedir', onkey: true })[0]
	// 	console.log(`is open: ${open}`)
	// 	if (render) {
	// 		if (open) var zip = spawn('zip',[ '-r', 'archive.zip', ...dirs ], { cwd: basedir })
	// 		else var zip = spawn('zip',[ '-rP', pw, 'archive.zip', ...dirs ], { cwd: basedir })
	// 		// zip.stdin.on('data', (data) => { console.log(`stdin: ${data}`) })
	// 		zip.stdout.on('data', data => console.log(`stdout: ${data}`))
	// 		zip.stderr.on('data', data => console.log(`stderr: ${data}`))
	// 		// zip.on('error', err => console.log(err))
	// 		zip.on('exit', async code => {
	// 			console.log(`zipped: ${code}`)
	// 			await Promise.all(results.map(d => {
	// 				return new Promise(resolve => {
	// 					fs.rmSync(d.dir, { recursive: true })
	// 					console.log('folder removed')
	// 					resolve()
	// 				})
	// 			}))
	// 			// DOWNLOAD THE FILE
	// 			res.setHeader('Content-type','application/zip')
	// 			res.sendFile(path.join(basedir, '/archive.zip'), {}, function () {
	// 				fs.rmSync(path.join(basedir, '/archive.zip'))
	// 			})
	// 		})
	// 	} else {
	// 		if (data.length) res.json(data)
	// 		else res.send('Sorry you do not have the rights to download this content. Please enquire about getting an access token to view download this content.')
	// 	}
	// }).catch(err => console.log(err))
}