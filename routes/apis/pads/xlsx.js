const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
// const rootpath = path.resolve(__dirname, '../..')
// global.include = path => require(`${rootpath}/${path}`)

const XLSX = require('xlsx') // SEE HERE: https://www.npmjs.com/package/xlsx

const { app_title_short, metafields, media_value_keys, DB } = include('config/')
const { checklanguage, array, join, parsers, flatObj } = include('routes/helpers/')

const filter = include('routes/browse/pads/filter').main

exports.main = (req, res) => {
	let { output, render, use_templates, include_data, include_imgs, include_tags, include_locations, include_metafields, include_engagement, include_comments } = req.body || {}
	const pw = req.session.email || null
	const language = checklanguage(req.params?.language || req.body.language || req.session.language)

	if (output === 'csv') {
		var single_sheet = true
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

	// 	return app_conn.conn.tx(t => {
	// 		return t.any(`
	// 			SELECT p.id AS pad_id, 
	// 				p.owner AS contributor_id, 
	// 				p.title, 
	// 				p.date AS created_at, 
	// 				p.update_at AS updated_at, 
	// 				p.status, 
	// 				p.source AS source_pad_id, 
	// 				p.template, 
	// 				p.full_text, 
	// 				p.sections 
	// 			FROM pads p
				
	// 			WHERE TRUE
	// 				$1:raw
	// 				AND p.id NOT IN (SELECT review FROM reviews)
				
	// 			ORDER BY id DESC
	// 		;`, [ full_filters ]).then(async pads => {
	// 			// JOIN THE USER INFOR FOR COUNTRY NAMES
	// 			pads = await join.users(pads, [ language, 'contributor_id' ])
	// 			// AND DELETE ALL THE PERSONAL INFORMATION
	// 			pads.forEach(d => {
	// 				delete d.position
	// 				delete d.ownername
	// 			})

	// 			let contributor_list = array.unique.call(pads, { key: 'contributor_id', onkey: true })
	// 			contributor_list = array.shuffle.call(contributor_list)


	// 			const open = pads.every(d => d.status > 2)

	// 			if (use_templates) {
	// 				pads = array.nest.call(pads, { key: 'template' })
	// 			} else {
	// 				pads = [{ key: 0, values: pads }]
	// 			}

	// 			const batch = pads.map(pad_group => {
	// 				return t.task(t1 => {
	// 					const batch1 = []
	// 					const ids = pad_group.values.map(d => d.pad_id)
	// 					if (include_tags) {
	// 						batch1.push(t1.any(`
	// 							SELECT pad AS pad_id, tag_id, type FROM tagging
	// 							WHERE pad IN ($1:csv)
	// 							ORDER BY (pad, type)
	// 						;`, [ ids ]).then(async results => {
	// 							const nest = array.nest.call(results, { key: 'type' })
	// 							const tags = await Promise.all(nest.map(d => {
	// 								return new Promise(async resolve => {
	// 									const tags = await join.tags(d.values, [ language, 'tag_id', d.key ])
	// 									tags.forEach(d => {
	// 										delete d.tag_id
	// 										delete d.equivalents
	// 									})
	// 									resolve(tags)
	// 								})
	// 							}))
	// 							return tags.flat().sort((a, b) => a.pad_id - b.pad_id)

	// 						}).catch(err => console.log(err)))
	// 					} else batch1.push(null)
	// 					if (include_locations) {
	// 						batch1.push(t1.any(`
	// 							SELECT pad AS pad_id, lat, lng FROM locations
	// 							WHERE pad IN ($1:csv)
	// 							ORDER BY pad
	// 						;`, [ ids ]))
	// 					} else batch1.push(null)
	// 					if (include_metafields) {
	// 						batch1.push(t1.any(`
	// 							SELECT pad AS pad_id, type, name, key, value FROM metafields
	// 							WHERE pad IN ($1:csv)
	// 							ORDER BY pad
	// 						;`, [ ids ]))
	// 					} else batch1.push(null)
	// 					if (include_engagement) {
	// 						batch1.push(t1.any(`
	// 							SELECT docid AS pad_id, type, count(type) FROM engagement
	// 							WHERE doctype = 'pad'
	// 								AND docid IN ($1:csv)
	// 							GROUP BY (docid, type)
	// 							ORDER BY docid
	// 						;`, [ ids ]))
	// 					} else batch1.push(null)
	// 					if (include_comments) {
	// 						batch1.push(t1.any(`
	// 							SELECT docid AS pad_id, id AS message_id, source AS response_to_message_id, contributor AS user_id, date, message FROM comments
	// 							WHERE doctype = 'pad'
	// 								AND docid IN ($1:csv)
	// 							ORDER BY (docid, id, source)
	// 						;`, [ ids ]))
	// 					} else batch1.push(null)
	// 					return t1.batch(batch1)
	// 					.then(results => {
	// 						const [ tags, locations, metadata, engagement, comments ] = results

	// 						const wb = XLSX.utils.book_new()

	// 						if (include_data) {
	// 							// ADD MAIN PAD TO WORKBOOK

	// 							// DETERMINE MAX ENTRIES
	// 							if (include_imgs) {
	// 								pad_group.values.forEach(d => {
	// 									d.img = parsers.getImg(d, false)
	// 								})
	// 								var max_imgs = Math.max(...pad_group.values.map(d => d.img?.length ?? 0))

	// 								var imgs = pad_group.values.map(d => {
	// 									return d.img?.map(c => {
	// 										const obj = {}
	// 										obj.pad_id = d.pad_id
	// 										obj.image = c
	// 										return obj
	// 									})
	// 								}).flat().filter(d => d)
	// 							}
	// 							// DETERMINE MAX TAGS BY TYPE
	// 							if (include_tags) {
	// 								// TO DO: UPDATE THIS TO type-name
	// 								const tag_types = array.unique.call(tags, { key: 'type', onkey: true })
	// 								const tag_counts = array.nest.call(tags, { key: 'pad_id' })
	// 									.map(d => {
	// 										return array.nest.call(d.values, { key: 'type' })
	// 									}).flat()
	// 								var max_tags = tag_types.map(d => {
	// 									const obj = {}
	// 									obj.type = d
	// 									obj.max = Math.max(...tag_counts.filter(c => c.key === d).map(c => c.count))
	// 									return obj
	// 								})
	// 							}
	// 							// DETERMINE MAX LOCATIONS
	// 							if (include_locations) {
	// 								var max_locations = array.nest.call(locations, { key: 'pad_id' })?.map(d => d.count)
	// 								if (max_locations.length) max_locations = Math.max(...max_locations)
	// 								else max_locations = 0	
	// 							}
	// 							// EXTRACT METAFIELDS AND DETERMINE MAX METAFIELDS
	// 							if (include_metafields) {
	// 								const meta_types = array.unique.call(metadata, { key: d => `${d.type}-${d.name}`, onkey: true })
	// 								const meta_counts = array.nest.call(metadata, { key: 'pad_id' })
	// 									.map(d => {
	// 										return array.nest.call(d.values, { key: c => `${c.type}-${c.name}` })
	// 									}).flat()
	// 								var max_metafields = meta_types.map(d => {
	// 									const obj = {}
	// 									obj.type = d
	// 									obj.max = Math.max(...meta_counts.filter(c => c.key === d).map(c => c.count))
	// 									return obj
	// 								})
			
	// 								// var attachments = pad_group.values.map(d => parsers.getAttachments(d).map(c => { return { pad_id: d.pad_id, resource: c } }))
	// 								// var max_attachments = Math.max(...attachments.map(d => d.length))
	// 							}


	// 							if (use_templates) {
	// 								// FLATTEN CONTENT
	// 								function create_id (d, id_prefix, name_prefix) {
	// 									if (Array.isArray(d)) {
	// 										var id = id_prefix
	// 										var name = name_prefix
	// 									} else if (d.type === 'section') {
	// 										var id = `${id_prefix ? `${id_prefix}--` : ''}${d.type ?? undefined}-${d.title ?? undefined}-${d.lead ?? undefined}`
	// 										var name = `${name_prefix ? `${name_prefix}--` : ''}${d.title ?? undefined}`
	// 									} else if (d.type === 'group') {
	// 										var id = `${id_prefix ? `${id_prefix}--` : ''}${d.level ?? undefined}-${d.type ?? undefined}-${d.name ?? undefined}-${d.instruction?.length ? d.instruction : undefined}`
	// 										var name = `${name_prefix ? `${name_prefix}--` : ''}${d.instruction?.length ? d.instruction : undefined}`
	// 									} else {
	// 										var id = `${id_prefix ? `${id_prefix}--` : ''}${d.level ?? undefined}-${d.type ?? undefined}-${d.instruction?.length ? d.instruction : undefined}`
	// 										var name = `${name_prefix ? `${name_prefix}--` : ''}${d.instruction?.length ? d.instruction : undefined}`
	// 									}
										
	// 									return [ id, name ]
	// 								}
	// 								function check_for_items (items, pad_id, id_prefix, name_prefix, structure = []) {
	// 									items?.forEach(d => {
	// 										let [ cid, cname ] = create_id(d, id_prefix, name_prefix)
	// 										cname = cname.replace(/[\n\s+]/g, ' ').replace(/^(undefined\-+)+/, '')
	// 										if (!['section', 'group'].includes(d.type) && !Array.isArray(d)) {
	// 											if (d.type === 'checklist') {
	// 												d.options?.forEach(c => {
	// 													const obj = {}
	// 													obj.id = `${cid}--${c.name}`
	// 													obj.repetition = structure.some(c => c.id === obj.id) ? structure.filter(c => c.id === obj.id).length : 0
	// 													obj.name = `${obj.repetition > 0 ? `[${obj.repetition}]--` : ''}${cname}--${c.name}`

	// 													obj.content = c.checked
	// 													structure.push(obj)
	// 												})
	// 											} else if (d.type === 'radiolist') {
	// 												const opt = d.options.find(c => c.checked)
	// 												const obj = {}
	// 												obj.id = cid
	// 												obj.repetition = structure.some(c => c.id === obj.id) ? structure.filter(c => c.id === obj.id).length : 0
	// 												obj.name = `${obj.repetition > 0 ? `[${obj.repetition}]--` : ''}${cname}`

	// 												obj.content = opt?.name ?? null
	// 												structure.push(obj)
	// 											} else if (include_locations && d.type === 'location') {
	// 												for (let i = 0; i < max_locations; i ++) {
	// 													const obj = {}
	// 													obj.id = `${cid}--${i}`
	// 													obj.repetition = structure.some(c => c.id === obj.id) ? structure.filter(c => c.id === obj.id).length : 0
	// 													obj.name = `${obj.repetition > 0 ? `[${obj.repetition}]--` : ''}${cname}--${i + 1}`

	// 													if (d.centerpoints?.[i]) obj.content = `${d.centerpoints[i]?.lat}, ${d.centerpoints[i]?.lng}`
	// 													else obj.content = null
	// 													structure.push(obj)	
	// 												}
	// 											} else if (include_tags && ['index', 'tag'].includes(d.type)) {
	// 												const max = max_tags.find(c => c.type === d.name)?.max ?? 0

	// 												// d.tags?.forEach((c, i) => {
	// 												// 	const obj = {}
	// 												// 	obj.id = `${cid}--${i}`
	// 												// 	obj.repetition = structure.some(c => c.id === cid) ? structure.filter(c => c.id === cid).length : 0
	// 												// 	obj.name = `${obj.repetition > 0 ? `[${obj.repetition}]--` : ''}${cname}--${i}`

	// 												// 	obj.content = c.name ?? null
	// 												// 	structure.push(obj)	
	// 												// })

	// 												for (let i = 0; i < max; i ++) {
	// 													const obj = {}
	// 													obj.id = `${cid}--${i}`
	// 													obj.repetition = structure.some(c => c.id === obj.id) ? structure.filter(c => c.id === obj.id).length : 0
	// 													obj.name = `${obj.repetition > 0 ? `[${obj.repetition}]--` : ''}${cname}--${i + 1}`

	// 													obj.content = d.tags[i]?.name ?? null
	// 													structure.push(obj)	
	// 												}
	// 											} else if (include_metafields && metafields.filter(c => !['tag', 'index', 'location'].includes(c.type)).some(c => c.type === d.type && c.name === d.name)) {
	// 												const max = max_metafields.find(c => c.type === `${d.type}-${d.name}`)?.max ?? 0

	// 												// for (let i = 0; i < max_attachments; i ++) {
	// 												// 	const obj = {}
	// 												// 	obj.id = `${cid}--${i}`
	// 												// 	obj.repetition = structure.some(c => c.id === obj.id) ? structure.filter(c => c.id === obj.id).length : 0
	// 												// 	obj.name = `${obj.repetition > 0 ? `[${obj.repetition}]--` : ''}${cname}--${i + 1}`

	// 												// 	obj.content = d.srcs[i] ?? null
	// 												// 	structure.push(obj)	
	// 												// }

	// 												for (let i = 0; i < max; i ++) {
	// 													const valuekey = Object.keys(d).find(c => media_value_keys.includes(c))
	// 													let value = d[valuekey]

	// 													if (Array.isArray(valuekey) && valuekey === 'options') value = value.filter(c => c.checked === true)

	// 													const obj = {}
	// 													obj.id = `${cid}--${i}`
	// 													obj.repetition = structure.some(c => c.id === obj.id) ? structure.filter(c => c.id === obj.id).length : 0
	// 													obj.name = `${obj.repetition > 0 ? `[${obj.repetition}]--` : ''}${cname}--${i + 1}`

	// 													obj.content = (Array.isArray(value) ? value[i] : value) ?? null
	// 													structure.push(obj)	
	// 												}
	// 											} else {
	// 												const obj = {}
	// 												obj.id = cid
	// 												obj.repetition = structure.some(c => c.id === obj.id) ? structure.filter(c => c.id === obj.id).length : 0
	// 												obj.name = `${obj.repetition > 0 ? `[${obj.repetition}]--` : ''}${cname}`

	// 												if (d.type === 'title') obj.content = d.txt
	// 												if (include_imgs && d.type === 'img') {
	// 													if (d.src) {
	// 														const idx = imgs.findIndex(c => c.image === d.src.replace('uploads', '/uploads/sm'))
	// 														if (include_imgs && fs.existsSync(path.join(rootpath, `/public/${d.src}`))) {
	// 															obj.content = `images/pad-${pad_id}/image-${idx + 1}${path.extname(d.src)}`
	// 														} else obj.content = d.src
	// 													}
	// 												}
	// 												if (include_imgs && d.type === 'mosaic') {
	// 													if (d.srcs?.length) {
	// 														obj.content = d.srcs.map(c => {
	// 															const idx = imgs.findIndex(b => b.image === c.replace('uploads', '/uploads/sm'))
	// 															if (include_imgs && fs.existsSync(path.join(rootpath, `/public/${c}`))) {
	// 																return `images/pad-${pad_id}/image-${idx + 1}${path.extname(c)}`
	// 															} else return c
	// 														}).join(', ')
	// 													}
	// 												}
	// 												if (include_imgs && d.type === 'video') obj.content = d.src
	// 												if (d.type === 'drawing') obj.content = d.shapes?.join(', ')
	// 												if (d.type === 'txt') obj.content = d.txt
	// 												if (d.type === 'embed') obj.content = d.html?.replace(/<[^>]*>/g, '') || d.src // THE replace IS IMPORTANT HERE TO AVOID xml INJECTION IN THE xlsx OUTPUT

	// 												if (!obj.content) obj.content = null

	// 												structure.push(obj)
	// 											}
	// 										}
											
	// 										if (d.items) structure = check_for_items(d.items, pad_id, cid, cname, structure)
	// 										else if (Array.isArray(d)) structure = check_for_items(d, pad_id, cid, cname, structure)
	// 									})
	// 									return structure
	// 								}

	// 								var flat_content = pad_group.values.map(d => {
	// 									const structure = check_for_items(d.sections, d.pad_id)
	// 										.map(c => {
	// 											const obj = {}
	// 											obj[c.name] = c.content
	// 											return obj
	// 										})
	// 									return Object.assign(flatObj.call(structure), { pad_id: d.pad_id })
	// 								})
									
	// 								const content_lengths = flat_content.map(d => Object.keys(d).length)
	// 								var headers = flat_content.find(d => Object.keys(d).length === Math.max(...content_lengths))
	// 								headers = Object.keys(headers).filter(c => c !== 'pad_id')
	// 							}

	// 							pad_group.values.forEach(d => {
	// 								// ANONYMIZE CONTRIBUTORS
	// 								// NOTE THIS id IS COMMON TO ALL WORKBOOKS (IF SEVERAL ARE GENERATED)
	// 								d.contributor_id = `c-${contributor_list.indexOf(d.contributor_id) + 1}`
									
	// 								// FIGURE OUT WHICH CONTENT STRUCTURE TO KEEP
	// 								if (!use_templates) {
	// 									d.content = d.full_text?.replace(/<[^>]*>/g, '')
	// 								} else {
	// 									const structure = flat_content.find(c => c.pad_id === d.pad_id)
	// 									headers.forEach(c => {
	// 										d[c] = structure[c] ?? null
	// 									})
	// 								}
	// 								delete d.full_text
	// 								delete d.sections

	// 								// EXTRACT IMAGES
	// 								if (single_sheet && include_imgs && !use_templates) {
	// 									if (Array.isArray(d.img)) {
	// 										for (let i = 0; i < max_imgs; i ++) {
	// 											if (d.img[i]) {
	// 												const idx = imgs.findIndex(c => c.image === d.img[i])
	// 												if (fs.existsSync(path.join(rootpath, `/public${d.img[i].replace('uploads/sm', 'uploads')}`))) d[`media-${i + 1}`] = `images/pad-${d.pad_id}/image-${idx + 1}${path.extname(d.img[i])}`
	// 												else d[`media-${i + 1}`] = d.img[i]
	// 											}
	// 										}
	// 									}
	// 								}
	// 								delete d.img
	// 							})

								
	// 							const data_sheet = XLSX.utils.json_to_sheet(pad_group.values)
	// 							XLSX.utils.book_append_sheet(wb, data_sheet, 'data-main')

	// 							// ADD IMAGES TO WORKBOOK
	// 							// THIS COMES HERE, UNLIKE THE tags, locations, etc
	// 							// BECAUSE IT IS CONSIDERED DATA (NOT METADATA), AND IS PART OF THE PACKAGE OF DATA
	// 							if (!single_sheet && include_imgs) {
	// 								if (imgs?.length) {
	// 									const imgs_data = imgs.map((d, i) => {
	// 										const obj = {}
	// 										obj.pad_id = d.pad_id
	// 										if (fs.existsSync(path.join(rootpath, `/public${d.image.replace('uploads/sm', 'uploads')}`))) obj.image = `images/pad-${d.pad_id}/image-${i + 1}${path.extname(d.image)}`
	// 										else obj.image = d.image
	// 										return obj
	// 									})
	// 									const imgs_sheet = XLSX.utils.json_to_sheet(imgs_data)
	// 									XLSX.utils.book_append_sheet(wb, imgs_sheet, 'data-media')
	// 								}
	// 							}
	// 						}

	// 						if (!single_sheet && tags?.length) {
	// 							// ADD TAGS TO WORKBOOK
	// 							tags.forEach(d => {
	// 								d.type = metafields.find(c => c.label === d.type)?.name ?? d.type
	// 							})

	// 							const tags_sheet = XLSX.utils.json_to_sheet(tags)
	// 							XLSX.utils.book_append_sheet(wb, tags_sheet, 'metadata-tags')
	// 						}
	// 						if (!single_sheet && locations?.length) {
	// 							// ADD LOCATIONS TO WORKBOOK
	// 							const locations_sheet = XLSX.utils.json_to_sheet(locations)
	// 							XLSX.utils.book_append_sheet(wb, locations_sheet, 'metadata-locations')
	// 						}
	// 						// if (!single_sheet && attachments?.flat().length) {
	// 							// const consent_sheet = XLSX.utils.json_to_sheet(attachments.flat())
	// 						if (!single_sheet && metadata?.length) {
	// 							const consent_sheet = XLSX.utils.json_to_sheet(metadata)
	// 							XLSX.utils.book_append_sheet(wb, consent_sheet, 'metadata-other')
	// 						}
	// 						if (!single_sheet && engagement?.length) {
	// 							// ADD ENGAGEMENT TO WORKBOOK
	// 							const engagement_sheet = XLSX.utils.json_to_sheet(engagement)
	// 							XLSX.utils.book_append_sheet(wb, engagement_sheet, 'metadata-engagement')
	// 						}
	// 						if (!single_sheet && comments?.length) {
	// 							// ADD COMMENTS TO WORKBOOK
	// 							// NOTE THIS IS UNIQUE TO EACH WORKBOOK, WHEREAS THE contributor_list IS COMMON TO ALL WORKBOOKS
	// 							let commenter_list = array.unique.call(comments, { key: 'user_id', onkey: true })
	// 							commenter_list = array.shuffle.call(commenter_list)
								
	// 							comments.forEach(d => {
	// 								// ANONYMIZE CONTRIBUTORS
	// 								d.user_id = `u-${commenter_list.indexOf(d.user_id) + 1}`
	// 							})
	// 							const comments_sheet = XLSX.utils.json_to_sheet(comments)
	// 							XLSX.utils.book_append_sheet(wb, comments_sheet, 'metadata-comments')
	// 							// XLSX.utils.sheet_to_csv(ws)
	// 						}
							
	// 						// RENDER THE FILES
	// 						if (render) {
	// 							if (use_templates) {
	// 								const template_dir = path.join(dir, `${app_title_short}_template_${pad_group.key}`)
	// 								if (!fs.existsSync(template_dir)) fs.mkdirSync(template_dir)

	// 								if (include_imgs && imgs.length > 0) {
	// 									const img_dir = path.join(template_dir, 'images')
	// 									if (!fs.existsSync(img_dir)) fs.mkdirSync(img_dir)

	// 									imgs.forEach((d, i) => {
	// 										const img_pad_dir = path.join(img_dir, `pad-${d.pad_id}`)
	// 										if (!fs.existsSync(img_pad_dir)) fs.mkdirSync(img_pad_dir)
	// 										try { 
	// 											fs.copyFileSync(path.join(rootpath, `/public${d.image.replace('uploads/sm', 'uploads')}`), path.join(img_pad_dir, `image-${i + 1}${path.extname(d.image)}`), fs.constants.COPYFILE_EXCL)
	// 										} catch(err) { console.log(err) }
	// 										// fs.copyFile(path.join(rootpath, `/public${d.image.replace('uploads/sm', 'uploads')}`), path.join(img_pad_dir, `image-${i + 1}${path.extname(d.image)}`), err => {
	// 										// 	if (err) console.log(err)
	// 										// 	else console.log('file copied')
	// 										// })
	// 									})
	// 								}

	// 								if (single_sheet) XLSX.writeFile(wb, path.join(template_dir, 'data.csv'), {})
	// 								else XLSX.writeFile(wb, path.join(template_dir, 'data.xlsx'), {})
	// 							} else {
	// 								if (include_imgs && imgs.length > 0) {
	// 									const img_dir = path.join(dir, 'images')
	// 									if (!fs.existsSync(img_dir)) fs.mkdirSync(img_dir)

	// 									imgs.forEach((d, i) => {
	// 										const img_pad_dir = path.join(img_dir, `pad-${d.pad_id}`)
	// 										if (!fs.existsSync(img_pad_dir)) fs.mkdirSync(img_pad_dir)
	// 										try {
	// 											fs.copyFileSync(path.join(rootpath, `/public${d.image.replace('uploads/sm', 'uploads')}`), path.join(img_pad_dir, `image-${i + 1}${path.extname(d.image)}`), fs.constants.COPYFILE_EXCL)
	// 										} catch(err) { console.log(err) }
	// 										// fs.copyFileSync(path.join(rootpath, `/public${d.image.replace('uploads/sm', 'uploads')}`), path.join(img_pad_dir, `image-${i + 1}${path.extname(d.image)}`), err => {
	// 										// 	if (err) console.log(err)
	// 										// 	else console.log('file copied')
	// 										// })
	// 									})
	// 								}

	// 								if (single_sheet) XLSX.writeFile(wb, path.join(dir, `${app_title_short}_data.csv`), {})
	// 								else XLSX.writeFile(wb, path.join(dir, `${app_title_short}_data.xlsx`), {})
	// 							}
	// 						}
	// 						return null
	// 					}).catch(err => console.log(err))	
	// 				})
	// 			})

	// 			return t.batch(batch)
	// 			.then(results => {
	// 				return { open, basedir, dir }
	// 			}).catch(err => console.log(err))
	// 		}).catch(err => console.log(err))
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
	// 	}
	// }).catch(err => console.log(err))
}