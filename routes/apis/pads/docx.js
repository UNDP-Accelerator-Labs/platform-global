const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const imgsize = require('image-size')

const { Document, SectionType, AlignmentType, UnderlineType, HeadingLevel, StyleLevel, Packer, Paragraph, TextRun, ImageRun, TableOfContents } = require('docx')

const { app_title_short, colors, metafields, DB } = include('config/')
const { checklanguage, datastructures, array, join, geo } = include('routes/helpers/')

const { filter } = require('../../browse/pads/')

exports.main = async (req, res) => {
	const { output, render, include_data, include_toc, chapters, standardize_structure } = req.body || {}
	const { object } = req.params || {}
	const pw = req.session.email || null

	if (req.session.uuid) { // USER IS LOGGED IN
		var { uuid, rights, username, collaborators } = req.session || {}
	} else { // PUBLIC/ NO SESSION
		var { uuid, rights, username, collaborators } = datastructures.sessiondata({ public: true }) || {}
	}
	const language = checklanguage(req.params?.language || req.session.language)

	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req, res)
	
	// CREATE A tmp FOLDER TO STORE EVERYTHING
	if (render) {
		var basedir = path.join(rootpath, '/tmp')
		if (!fs.existsSync(basedir)) fs.mkdirSync(basedir)
	}

	return DB.conn.any(`
		SELECT p.id, p.owner, p.title, p.sections, p.status, 
			FALSE AS editable,
			m.id AS mobilization, m.title AS mobilization_title, 
			t.title AS template_title,

			-- CASE
			-- 	WHEN AGE(now(), p.date) < '0 second'::interval
			-- 		THEN jsonb_build_object('interval', 'positive', 'date', to_char(p.date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(p.date, now())), 'hours', EXTRACT(hour FROM AGE(p.date, now())), 'days', EXTRACT(day FROM AGE(p.date, now())), 'months', EXTRACT(month FROM AGE(p.date, now())))
			-- 	ELSE jsonb_build_object('interval', 'negative', 'date', to_char(p.date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(now(), p.date)), 'hours', EXTRACT(hour FROM AGE(now(), p.date)), 'days', EXTRACT(day FROM AGE(now(), p.date)), 'months', EXTRACT(month FROM AGE(now(), p.date)))
			-- END AS date
			
			---- THIS DOES NOT NEED TO BE SO COMPLEX 
			jsonb_build_object('date', to_char(p.date, 'DD Mon YYYY')) AS date,
			to_char(p.date, 'YYYY') AS year
			
		FROM pads p
		
		LEFT JOIN templates t
			ON t.id = p.template
		
		LEFT JOIN mobilization_contributions mc
			ON mc.pad = p.id
		
		LEFT JOIN mobilizations m
			ON m.id = mc.mobilization
		
		WHERE TRUE 
			$2:raw 
			AND (m.id = (SELECT MAX(mc2.mobilization) FROM mobilization_contributions mc2 WHERE mc2.pad = p.id)
				OR m.id IS NULL) -- THIS IS IN CASE A PAD IS CONTRIBUTED TO TWO MOBILIZATIONS
			AND p.id NOT IN (SELECT review FROM reviews)
		
		GROUP BY (
			p.id, 
			m.id, 
			m.title, 
			m.pad_limit,
			t.title
		)
		$3:raw
	;`, [ 
		/* $1 */ DB.pgp.as.format(uuid === null ? 'NULL' : '$1', [ uuid ]),
		/* $2 */ full_filters, 
		/* $3 */ order
	]).then(async results => {
		const open = results.every(d => d.status > 2)
		let data = await join.users(results, [ language, 'owner' ])

		if (chapters && chapters !== 'none') {
			data = array.nest.call(data, { key: chapters })
		} else {
			data = [{ key: null, values: data }]
		}

		// TO DO: PROBABLY ONLY USE ONE SECTION BECUSE IN WORD, NEW SECTIONS FORCE PAGE BREAKS THAT CANNOT BE REMOVED EASILY
		let sections = await Promise.all(data.map(async d => {
			return new Promise(async resolve => {
				const arr = []
				if (d.key) {
					const title_obj = {}
					title_obj.properties = { type: SectionType.ODD_PAGE }
					title_obj.children = [new Paragraph({ 
						text: d.key.toUpperCase(), 
						heading: HeadingLevel.HEADING_1,
						alignment: AlignmentType.CENTER
					})]
					arr.push(title_obj)
				}
				
				const pads = await Promise.all(d.values.map((c, j) => {
					return new Promise(async resolve1 => {
						const obj = {}
						// if (j > 0) obj.properties = { type: SectionType.NEXT_PAGE }
						obj.children = []
						// ADD THE TITLE
						const title = new Paragraph({ 
							text: c.title,
							heading: HeadingLevel.HEADING_2
						})
						// TO DO: ADD THE AUTHOR INFO
						obj.children.push(title)
						
						if (include_data) {
							let repetition = 0 // THIS IS FOR REPEATED SECTIONS
							const items = await Promise.all(c.sections.map(async b => {
								const paragraphs = []
								if (b.repeat) repetition ++
								else repetition = 0

								if (b.title || b.lead) {
									if (b.title) paragraphs.push(new Paragraph({
										text: repetition > 0 ? `${b.title} – ${repetition}` : b.title,
										heading: HeadingLevel.HEADING_3
									}))
									if (b.lead) children.push(new Paragraph({ text: b.lead }))
								}
								if (b.items?.length) {					
									const items = await Promise.all(b.items.map(a => populateSection(a)))

									// paragraphs.push(...b.items.map(a => populateSection(a)).filter(a => a.length).flat())
									paragraphs.push(...items.filter(a => a.length).flat())
								}
								return paragraphs
							}))
							obj.children.push(...items.flat())
						}

						resolve1(obj)
					})
				}))
			
				arr.push(...pads)
				resolve(arr)
			})
		})).then(results => results.flat())
		.catch(err => console.log(err))

		async function populateSection (data, repetition = 0) {
			return new Promise(async resolve => {
				const { instruction, type, name, level } = data
				const arr = []
				// ADD THE INSTRUCTION IF THERE IS ONE
				if (instruction) {
					arr.push(new Paragraph({ 
						text: repetition > 0 ? `${instruction} – ${repetition}` : instruction,
						heading: HeadingLevel.HEADING_4
					}))
				} else {
					if (level === 'meta') {
						arr.push(new Paragraph({ 
							text: capitalize(metafields.find(c => c.label === name)?.name || name),
							heading: HeadingLevel.HEADING_4
						}))
					}
				}

				if (type === 'img') {
					const { src } = data
					const p = path.join(rootpath, `public/${src}`)
					if (fs.existsSync(p)) {
						const { width, height } = resizeImg(p)
						arr.push(new Paragraph({
							children: [
								new ImageRun({
									// TO DO: FILTER IF URL
									data: fs.readFileSync(p),
									transformation: {
										width,
										height
									}
								})
							],
							alignment: AlignmentType.CENTER,
							style: 'images'
						}))
					}
				}
				if (type === 'mosaic') {
					const { srcs } = data
					const children = []
					const maxwidth = srcs.length === 2 ? 600 / 2 : 600 / 3
					srcs.forEach(d => {
						const p = path.join(rootpath, `public/${d}`)
						if (fs.existsSync(p)) {
							const { width, height } = resizeImg(p, maxwidth)

							children.push(new ImageRun({
								// TO DO: FILTER IF URL
								data: fs.readFileSync(p),
								transformation: {
									width,
									height
								}
							}))
						}
					})
					arr.push(new Paragraph({ children, alignment: AlignmentType.CENTER, style: 'images' }))
				}
				// if (type === 'video') addVideo({ data, lang, section }) // CANNOT DISPLAY VIDEOS IN PRINT
				
				// if (type === 'drawing') addDrawing({ data, lang, section }) // TO DO

				if (type === 'txt') {
					let { txt } = data
					txt = formatTxt(txt)
					if (txt) {
						const children = []
						txt.forEach((d, i) => {
							children.push(new TextRun({ text: d }))
							if (i < txt.length -1) children.push(new TextRun({ break: 1 }))
						})
						arr.push(new Paragraph({ children, style: 'main' }))
					}
				}

				if (type === 'embed') arr.push(new Paragraph({ text: data.html, style: 'main' })) // TO DO: MIGHT NEED TO CLEAN THE HTML

				if (['checklist', 'radiolist'].includes(type)) {
					let { options } = data
					options = options.filter(d => d.name)
					options.sort((a, b) => {
						if (a.name === b.name) return 0
						else if (!a.name || !a.name.trim().length) return 1
						else if (!b.name || !b.name.trim().length) return -1
						else return a.id < b.id ? -1 : 1
					})
					options.forEach((d, i) => {
						const children = [ new TextRun({ text: d.name, bold: d.checked ? true : false }) ]
						if (i === options.length - 1) children.push(new TextRun({ break: 1 }))
						arr.push(new Paragraph({
							bullet: {
								level: 0
							},
							children
						}))
					})
				}
				// META
				if (type === 'location') {
					const { centerpoints } = data
					console.log('look for locations')
					if (centerpoints?.length) {
						const promises = geo.reversecode.code(centerpoints.map(d => [d.lat, d.lng]), true)
						const data = await Promise.all(promises)
						if (data?.length) {
							data.forEach((d, i) => {
								const { formatted } = d
								const children = []
								formatted.forEach(c => {
									children.push(new TextRun({ text: `${c}*` }))
									// if (i === formatted.length - 1) children.push(new TextRun({ break: 1 }))
								})
								arr.push(new Paragraph({
									bullet: {
										level: 0
									},
									children
								}))
							})
							arr.push(new Paragraph({ text: `* ${data[0].caption}`, style: 'caption' }))
						}
					}
				}
				
				if (type === 'index') {
					const { tags } = data
					tags.sort((a, b) => a.key - b.key)
					const children = []
					tags.forEach(d => {
						children.push(new ImageRun({
							// TO DO: FILTER IF URL
							data: fs.readFileSync(path.join(rootpath, `public/imgs/${d.type}/${language}/G${d.key || d}-c.png`)),
							altText: {
								title: `${d.type}-${d.key}`,
								description: d.name,
								name: d.name
							},
							transformation: {
								width: 100,
								height: 100
							}
						}))
					})
					arr.push(new Paragraph({ children, style: 'images' }))
				}
				if (type === 'tag') {
					let { tags } = data
					tags = tags.filter(d => d.name)
					tags.sort((a, b) => a.name.localeCompare(b.name))
					tags.forEach((d, i) => {
						const children = [ new TextRun({ text: d.name }) ]
						if (i === tags.length - 1) children.push(new TextRun({ break: 1 }))
						arr.push(new Paragraph({
							bullet: {
								level: 0
							},
							children
						}))
					})
				}
				
				if (type === 'attachment') {
					const { srcs } = data

					if (srcs?.length) {
						const children = []
						srcs.forEach(d => {
							children.push(new TextRun({ text: d }))
							children.push(new TextRun({ break: 1 }))
						})
						arr.push(new Paragraph({ children, style: 'hyperlink' })) 
					}
				}
				
				// GROUP
				if (type === 'group') {
					const { items } = data
					items.forEach((c, j) => {
						arr.push(...c.map(b => populateSection(b, j + 1)).filter(b => b.length).flat())
					})
				}

				resolve(arr)
			})
		}

		function resizeImg (p, maxwidth = 600, maxheight = 900) {
			let { width, height } = imgsize(p)
			const ratio = Math.min(maxwidth / width, maxheight / height)
			if (width > maxwidth || height > maxheight) {
				width = width * ratio
				height = height * ratio
			}
			return { width, height }
		}
		function formatTxt (str) {
			if (str?.length) {
				return str.trim().replace(/\x02/g, '').split('\n').map(d => d.trim())
			} else return false
		}
		function capitalize (str) {
			return str.charAt(0).toUpperCase() + str.slice(1)	
		}
		function splitLinks (str) {
		}

		if (include_toc) {
			// ADD TABLE OF CONTENTS
			const toc = { children: 
				[ new TableOfContents('Summary', {
					hyperlink: true,
					headingStyleRange: '1-5',
					stylesWithLevels: [new StyleLevel('toc', 1), new StyleLevel('toc', 2), new StyleLevel('toc', 3)], // THIS IS NOT WORKING
					entryAndPageNumberSeparator: '\t', // THIS IS NOT WORKING
					style: 'toc'
				}) ]
			}
			sections.unshift(toc)
		}

		// CREATE DOCUMENT
		console.log('preping doc')
		const doc = new Document({
			creator: username,
			title: 'A collection of solutions', // TO DO: TRANSLATE
			features: {
				updateFields: true
			},
			styles: {
				default: {
					heading1: {
						run: {
							font: 'Noto Sans',
							size: 48,
							bold: true,
							color: colors['dark-blue']
						},
						paragraph: {
							spacing: {
								before: 120,
								after: 240,
								line: 36 * 6
							}
						}
					},
					heading2: {
						run: {
							font: 'Noto Sans',
							size: 32,
							bold: true,
							color: colors['dark-blue']
						},
						paragraph: {
							spacing: {
								before: 120,
								after: 240,
								line: 36 * 6
							}
						}
					},
					heading3: {
						run: {
							font: 'Noto Sans',
							size: 28,
							color: colors['mid-blue']
						},
						paragraph: {
							spacing: {
								before: 120,
								after: 240,
								line: 28 * 6
							}
						}
					},
					heading4: {
						run: {
							font: 'Noto Sans',
							size: 20,
							color: colors['light-grey']
						},
						paragraph: {
							spacing: {
								after: 120
							}
						}
					},
					listParagraph: {
						run: {
							font: 'Noto Sans',
							size: 20
						},
						paragraph: {
							spacing: {
								// after: 120
							}
						}
					},
				},
				paragraphStyles: [
					{
						id: 'main',
						name: 'Main text style',
						basedOn: 'Normal',
						next: 'Normal',
						quickFormat: true,
						run: {
							font: 'Noto Sans',
							size: 20
						},
						paragraph: {
							spacing: {
								after: 240
							}
						}
					},
					{
						id: 'caption',
						name: 'Main text style',
						basedOn: 'Main text style',
						next: 'Main text style',
						quickFormat: true,
						run: {
							font: 'Noto Sans',
							color: colors['light-grey'],
							size: 16
						},
						paragraph: {
							spacing: {
								after: 240
							}
						}
					},
					{
						id: 'images',
						name: 'Spacing for images',
						basedOn: 'Main text style',
						next: 'Main text style',
						quickFormat: true,
						paragraph: {
							spacing: {
								after: 360
							}
						}
					},
					{
						id: 'hyperlink',
						name: 'Hyperlink style',
						basedOn: 'Main text style',
						next: 'Main text style',
						quickFormat: true,
						run: {
							color: colors['light-blue'],
							underline: {
								type: UnderlineType.SINGLE
							}
						},
						paragraph: {
							spacing: {
								after: 360
							}
						}
					},
					{
						id: 'toc',
						name: 'Table of contents style',
						basedOn: 'Main text style',
						next: 'Main text style',
						quickFormat: true,
						run: {
							font: 'Noto Sans',
							size: 20,
							color: colors['dark-blue'],
							underline: {
								type: UnderlineType.SINGLE
							}
						}
					}
				]
			},
			sections
		})

		// RENDER DOCUMENT
		if (render) {
			console.log('rendering')
			Packer.toBuffer(doc)
			.then((buffer) => {
				const p = path.join(basedir, `${app_title_short}.docx`)
				fs.writeFileSync(p, buffer)

				// IF OPEN, NO NEED TO ZIP
				if (open) {
					// DOWNLOAD THE FILE
					// FOR docx MIME TYPE, SEE https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
					res.setHeader('Content-type','application/vnd.openxmlformats-officedocument.wordprocessingml.document')
					res.sendFile(p, {}, function () {
						fs.rmSync(p)
					})
				} else {
					// var zip = spawn('zip',[ '-P', pw, 'archive.zip', path.relative(basedir, `${app_title_short}.docx`) ], { cwd: basedir })
					var zip = spawn('zip',[ '-P', pw, 'archive.zip', `${app_title_short}.docx` ], { cwd: basedir })
					// zip.stdin.on('data', (data) => { console.log(`stdin: ${data}`) })
					zip.stdout.on('data', data => console.log(`stdout: ${data}`))
					zip.stderr.on('data', data => console.log(`stderr: ${data}`))
					// zip.on('error', err => console.log(err))
					zip.on('exit', code => {
						console.log(`zipped: ${code}`)
						fs.rmSync(p)
						console.log('file removed')
						// DOWNLOAD THE FILE
						res.setHeader('Content-type','application/zip')
						res.sendFile(path.join(basedir, '/archive.zip'), {}, function () {
							fs.rmSync(path.join(basedir, '/archive.zip'))
						})
					})
				}

			}).catch(err => console.log(err))
		}

	}).catch(err => console.log(err))
}