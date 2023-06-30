const { app_title, DB } = include('config/')
const { vocabulary } = include('routes/header/language.js')
// const DB = require('../../db-config.js')
const path = require('path')
const fs = require('fs')
const PDFDocument = require('pdfkit')


// DOCUMENTATION HERE: https://pdfkit.org/docs/getting_started.html

// THIS WAS FOR TESTING
// const sdgobj = {
//	 "sdgs": [
//		 {
//			 "key": 1,
//			 "name": "Affordable and clean energy",
//			 "description": "Ensure access to affordable, reliable, sustainable and modern energy for all."
//		 },
//		 {
//			 "key": 2,
//			 "name": "Affordable and clean energy",
//			 "description": "Ensure access to affordable, reliable, sustainable and modern energy for all."
//		 },
//		 {
//			 "key": 4,
//			 "name": "Affordable and clean energy",
//			 "description": "Ensure access to affordable, reliable, sustainable and modern energy for all."
//		 },
//		 {
//			 "key": 6,
//			 "name": "Affordable and clean energy",
//			 "description": "Ensure access to affordable, reliable, sustainable and modern energy for all."
//		 },
//		 {
//			 "key": 7,
//			 "name": "Affordable and clean energy",
//			 "description": "Ensure access to affordable, reliable, sustainable and modern energy for all."
//		 },
//		 {
//			 "key": 9,
//			 "name": "Industry, innovation and infrastructure",
//			 "description": "Build resilient infrastructure, promote inclusive and sustainable industrialization and foster innovation."
//		 },
//		 {
//			 "key": 13,
//			 "name": "Climate action",
//			 "description": "Take urgent action to combat climate change and its impacts."
//		 }
//	 ],
//	 "type": "sdgs",
//	 "level": "meta",
//	 "required": true,
//	 "has_content": true,
//	 "instruction": "SDGs: What SDGs is your challenge related to? (please choose the top 3)"
// }

exports.main = (req, res) => {
	// CHECK THE PAD EXISTS
	const { uuid } = req.session || {}
	const { format } = req.params || {}
	const { id, lang } = req.body || {}

	if (!format) format = 'pdf'
	if (!id) res.send('No id submitted')
	if (!lang) lang = 'en'
		
	const fontsizes = {
		xsmall: 10,
		small: 12,
		mid_small: 14,
		main: 16,
		mid: 20,
		large: 24,
		xlarge: 36,
		xxlarge: 60,
		xxxlarge: 90
	}
	for (key in fontsizes) fontsizes[key] = fontsizes[key] * .75

	const colors = {
		dark_blue: '#0A4C73',
		mid_blue: '#0468B1',
		light_blue: '#32BEE1',

		dark_red: '#A51E41',
		mid_red: '#FA1C26',
		light_red: '#F03C8C',

		dark_green: '#418246',
		mid_green: '#61B233',
		light_green: '#B4DC28',

		dark_yellow: '#FA7814',
		mid_yellow: '#FFC10E',
		light_yellow: '#FFF32A',
		light_yellow_alpha: a => `rgba(255,243,42,${a})`,

		dark_grey: '#000000',
		mid_grey: '#646464',
		light_grey: '#969696'
	}

	let page = 0

	DB.conn.tx(t => {
		return t.one(`
			SELECT * FROM pads WHERE id = $1::INT
		;`, [ id ]).then(result => {
			console.log('data to generate pdf with')
			
			const dir = path.join(__dirname, `../../public/generated/`)
			if (!fs.existsSync(dir)) fs.mkdirSync(dir)

			const docname = `p-${id}.${format}`
			const target = path.join(dir, docname)
			const doc = new PDFDocument({ 
				// font: 'Noto Sans', 
				info: { 
					'Title': result.title || 'Unnamed pad',
					'Author': `${ 'author' } name via ${app_title}`,
					'Subject': 'This document was created using PDFKit: https://pdfkit.org/docs/getting_started.html',
					'ModDate': Date.now()
				},
				size: 'A4',
				bufferPages: true
			})
			// CREATE THE WRITE STREAM
			doc.pipe(fs.createWriteStream(target))
			doc.pipe(res)

			doc.on('pageAdded', _ => page ++)

			// ADD THE TITLE
			doc.fontSize(fontsizes.xlarge)
			.fillColor(colors.dark_blue)
			.font('Helvetica-Bold')
			.text(result.title)
			.moveDown()
			
			resetEnvironment(doc)

			// ADD THE SECTIONS
			result.sections.forEach(d => {
				addSection({ data: d, lang, doc }) // CHANGE en TO CURRENT LANGUAGE // ALTHOUGH THIS SHOULD NOT BE NEEDED HERE
			})

			doc.end() // FINALIZE THE STREAM FOR THE PDF FILE
			return { 
				name: result.title, 
				path: `/generated/${docname}`, 
				full_text: result.full_text, 
				contributor: result.contributor, 
				source: id 
			}
		}).then(result => {
			const { name, path, full_text, contributor, source } = result
			return t.none(`INSERT INTO files (name, path, full_text, contributor, source, status) VALUES ($1, $2, $3, $4, $5, $6)`, [name, path, full_text, contributor, source, 1])
		})
	}).catch(err => console.log(err))


	function addSection (kwargs) {
		const { data, lang, doc } = kwargs || {}
		let { title, lead, structure, items, group } = data || {}
		if (!title) title = ''
		if (!lead) lead = ''
		if (!structure) structure = [] // WE DO NOT USE STRUCTURE HERE
		if (!items) items = []

		let { x, y } = doc
		const { width, margins } = doc.page
		let { right } = margins
		right = width - right

		if (title) {
			const w = doc.widthOfString(title)
			const h = doc.heightOfString(title)
			doc.fillColor(colors.dark_blue)
			.rect(x, y - 5, w + 20, h + 5)
			.fill()

			doc.fillColor(colors.light_grey)
			doc.text(title, x + 10, y)
			
			resetEnvironment(doc)
		}

		y = doc.y
		doc.save()
		doc.strokeColor(colors.dark_blue)
		doc.moveTo(x, y)
		.lineTo(right, y)
		.stroke()
		.moveDown()
		doc.restore()

		if (lead) {
			doc.save()
			doc.fontSize(fontsizes.large)
				.fillColor(colors.dark_grey)
				.text(lead)
				.moveDown()
				.fontSize(fontsizes.main)
			doc.restore()
		}
		

		// items.unshift(sdgobj)

		items.forEach(d => {
			populateSection(d, lang, doc)
		})
		doc.moveDown()
	}

	function populateSection (data, lang = 'en', doc, is_in_group = false) {
		const { instruction } = data
		if (instruction) {
			doc.fillColor(colors.mid_blue)
			.text(instruction, doc.x + (is_in_group ? 20 : 0), doc.y, { indent: 10, paragraphGap: fontsizes.main })
			resetEnvironment(doc)

			const start = { x: doc.x, y: doc.y - doc.heightOfString(instruction) - fontsizes.main, page }
			const end = { x: doc.x, y: doc.y, page }
			const processed	= processDrawing(start, end, doc)
			processed.forEach(d => {
				doc.save()
				if (is_in_group) doc.translate(20, 0)
				doc.strokeColor(colors.mid_blue)
				.moveTo(doc.page.margins.left, d.y1)
				.lineTo(doc.page.margins.left, d.y2 - fontsizes.main)
				.dash(1, { space: 2 })
				.stroke()
				doc.restore()
			})

			if (is_in_group) drawGroupBox(start, end, doc)
		}
		
		// MEDIA
		if (data.type === 'img') addImg({ data, lang, doc, is_in_group })
		if (data.type === 'mosaic') addMosaic({ data, lang, doc, is_in_group })
		// // if (data.type === 'video') addVideo({ data: data, lang: lang, doc: doc }) // CANNOT ADD VIDEO TO PDF
		if (data.type === 'drawing') addDrawing({ data, lang, doc, is_in_group })
		if (data.type === 'txt') addTxt({ data, lang, doc, is_in_group })
		if (data.type === 'embed') addEmbed({ data, lang, doc, is_in_group })
		if (data.type === 'checklist') addChecklist({ data, lang, doc, is_in_group })
		if (data.type === 'radiolist') addRadiolist({ data, lang, doc, is_in_group })
		
		// // META
		// // if (data.type === 'location') {
		// // 	// THIS COMPLEX STATEMENT IS LEGACY (ORIGINALLY ONLY ONE centerpoint COULD BE PLACED)
		// // 	if ((!c.centerpoint && !c.centerpoints) || 
		// // 		(c.centerpoint && (!c.centerpoint.lat || !c.centerpoint.lng)) || 
		// // 		!c.centerpoints.length
		// // 	) {
		// // 		c.centerpoints = [<%- JSON.stringify(locals.centerpoint) %>]
		// // 	} else if (c.centerpoint && !c.centerpoints) c.centerpoints = [c.centerpoint]
		// // 	addMap({ data: data, lang: lang, doc: doc })
		// // }
		
		if (data.type === 'sdgs') addSDGs({ data, lang, doc, is_in_group }) // TECHNICALLY THIS CANNOT BE IN A GROUP
		if (data.type === 'tag') addTags({ data, lang, doc, is_in_group }) // TECHNICALLY THIS CANNOT BE IN A GROUP
		if (['skills', 'methods'].includes(data.type)) addTags({ data, lang, doc, is_in_group }) // TECHNICALLY THIS CANNOT BE IN A GROUP
		if (data.type === 'datasources') addTags({ data, lang, doc, is_in_group }) // TECHNICALLY THIS CANNOT BE IN A GROUP
		// GROUP
		if (data.type === 'group') addGroup({ data: data, lang: lang, doc: doc })
	}


	// TO DO: FINISH THE PDF GENERATOR FOR PADS
	// THEN MOVE TO consent APP AND FINALIZE SLIDESHOWS WITH POSSIBILITY TO EXPORT TO PDF
	// THEN CHANGE ALL 'published' PADS TO PDFs IN consent APP


	function addImg (kwargs) { 
		const { data, lang, doc, is_in_group } = kwargs || {}
		let { src, textalign, scale } = data || {}
		if (!src) src = null
		if (!textalign) textalign = 'left'
		if (!scale) scale = 'original'

		const { width, height, margins } = doc.page
		const { right, bottom, top } = margins
		
		console.log('looking for image')
		let start = { x: doc.x, y: doc.y, page }
		if (src) {
			const img = doc.openImage(path.join(__dirname, `../../public/${src}`))
			const { width: w, height: h } = img
			const scaledwidth = Math.min(width - doc.x - right, w)
			const scaledheight = scaledwidth * h / w
			if (doc.y + scaledheight > height - bottom) {
				doc.addPage()
				start = { x: doc.x, y: top, page }
			}
			doc.save()
			if (is_in_group) doc.translate(20, 0)
			doc.image(img, { width: scaledwidth, height: scaledheight })
			doc.restore()
		} else {
			doc.fillColor(colors.light_grey)
			.text(vocabulary['missing image'][lang], doc.x + (is_in_group ? 20 : 0), doc.y)
			resetEnvironment(doc)
		}
		doc.moveDown()
		const end = { x: doc.x, y: doc.y, page }
		
		if (is_in_group) drawGroupBox(start, end, doc)

		return null
	}
	function addMosaic (kwargs) { 
		// IF ONLY 2 IMAGES: 2 COLS
		// IF 3 OR MORE: 3 COLS
		const { data, lang, doc, is_in_group } = kwargs || {}
		let { srcs, verticalalign } = data || {}
		if (!srcs) srcs = []
		if (!verticalalign) verticalalign = 'center'

		const { width, height, margins } = doc.page
		const { left, right, bottom, top } = margins
		
		console.log('looking for mosaic')
		let start = { x: doc.x, y: doc.y, page }
		if (srcs.length) {
			if (srcs.length === 2) {
				doc.save()
				if (is_in_group) doc.translate(20, 0)
				let { x, y } = doc
				const layout = srcs.map(d => {
					const img = doc.openImage(path.join(__dirname, `../../public/${d}`))
					const { width: w, height: h } = img
					const scaledwidth = (width - x - right - (is_in_group ? 20 : 0)) / 2 - 10 / 2
					const scaledheight = scaledwidth * h / w
					return { img: img, width: scaledwidth, height: scaledheight }
				})
				const maxheight = layout.sort((a, b) => b.height - a.height)[0].height
				layout.forEach((d, i) => {
					if (y + d.height > height - bottom) {
						doc.addPage()
						start = { x: x, y: top, page }
						y = top
					}
					doc.image(d.img, x + (i === 1 ? 10 : 0), y, { fit: [d.width, maxheight], valign: verticalalign })
					x += d.width
				})
				doc.restore()
			} else {
				doc.save()
				if (is_in_group) doc.translate(20, 0)
				let { x, y } = doc
				let line = 0
				const layout = srcs.map((d, i) => {
					if (i !== 0 && !(i % 3)) line ++
					const img = doc.openImage(path.join(__dirname, `../../public/${d}`))
					const { width: w, height: h } = img
					const scaledwidth = (width - x - right - (is_in_group ? 20 : 0)) / 3 - 10 * 2 / 3
					const scaledheight = scaledwidth * h / w
					return { img: img, width: scaledwidth, height: scaledheight, line }
				})
				layout.forEach((d, i) => {
					const maxheight = layout.filter(c => c.line === d.line).sort((a, b) => b.height - a.height)[0].height

					if (i !== 0 && !(i % 3)) {
						const prevheight = layout.filter(c => c.line === d.line - 1).sort((a, b) => b.height - a.height)[0].height
						doc.y += maxheight + 10
						y += prevheight + 10
						x = left
					}

					if (y + d.height > height - bottom) {
						doc.addPage()
						start = { x: x, y: top, page }
						y = top
					}
					doc.image(d.img, x + ((i % 3) !== 0 ? 10 : 0), y, { fit: [d.width, maxheight], valign: verticalalign })
					x += d.width + ((i % 3) !== 0 ? 10 : 0)
				})
				doc.restore()
			}	
		}
		doc.moveDown()
		const end = { x: doc.x, y: doc.y, page }
		
		if (is_in_group) drawGroupBox(start, end, doc)

		return null
	}
	function addDrawing (kwargs) {
		const { data, lang, doc, is_in_group } = kwargs || {}
		let { shapes, size } = data || {}
		const scale = size[1] / size[0]
		if (!shapes) shapes = []
		shapes = shapes.filter(d => d.points.length)
		if (!size) size = []

		const { width, height, margins } = doc.page
		const { left, right, bottom, top } = margins

		console.log('looking for drawing')
		if (doc.y + size[1] * scale > height - bottom) {
			doc.addPage()
			doc.y = top
		}
		let start = { x: doc.x, y: doc.y, page }

		doc.save()
		doc.translate(doc.x + (width - left - right - size[0] * scale) / 2, doc.y)
		.scale(scale)
		if (is_in_group) doc.translate(20, 0)
		
		doc.rect(0, 0, size[0], size[1])
		.fillAndStroke('#FFF', colors.light_grey)

		if (shapes.length) {
			shapes.forEach(d => {
				doc.save()
				if (d.type === 'line') {
					doc.lineWidth(d.lineWidth)
					.strokeColor(d.color)
					.lineCap('round')
					.lineJoin('round')

					d.points.forEach((p, i) => {
						if (i === 0) doc.moveTo(p[0], p[1])
						else doc.lineTo(p[0], p[1])
					})
					doc.stroke()
				}
				doc.restore()
			})
		} else {			
			doc.save()
			.lineWidth(1)
			.strokeColor(colors.light_grey)
			.lineCap('round')
			.lineJoin('round')

			const lines = [[[0, 0], [size[0], size[1]]], [[size[0], 0], [0, size[1]]]]
			lines.forEach(l => {
				l.forEach((p, i) => {
					console.log(p)
					if (i === 0) doc.moveTo(p[0], p[1])
					else doc.lineTo(p[0], p[1])
				})
				doc.stroke()
			})
			doc.restore()
		}
		resetEnvironment(doc)
		doc.y += size[1] * scale
		doc.moveDown()
		.restore()

		const end = { x: doc.x, y: doc.y, page }

		if (is_in_group) drawGroupBox(start, end, doc)

		return null
	}
	function addTxt (kwargs) {
		const { data, lang, doc, is_in_group } = kwargs || {}
		let { fontsize, fontweight, fontstyle, textalign, txt } = data || {}
		if (!fontsize) fontsize = 1
		if (!fontweight) fontweight = 'normal'
		if (!fontstyle) fontstyle = 'normal'
		if (!textalign) textalign = 'left'
		if (!txt) txt = ''

		doc.save()
		doc.fontSize(fontsizes.main / fontsize)
		if (fontweight === 'bold' && fontstyle === 'italic') doc.font('Helvetica-BoldOblique')
		else if (fontweight === 'bold' && fontstyle !== 'italic') doc.font('Helvetica-Bold')
		else if (fontweight !== 'bold' && fontstyle === 'italic') doc.font('Helvetica-Oblique')
		const start = { x: doc.x, y: doc.y, page }
		doc.text(txt, doc.x + (is_in_group ? 20 : 0), doc.y, {
			align: textalign
		}).moveDown()
		resetEnvironment(doc)
		const end = { x: doc.x, y: doc.y, page }
		doc.restore()

		if (is_in_group) drawGroupBox(start, end, doc)

		return null
	}
	function addEmbed (kwargs) { //. TO DO: FINISH FOR GROUPING
		const { data, lang, doc, is_in_group } = kwargs || {}
		let { fontsize, fontweight, fontstyle, textalign, html } = data || {}
		if (!textalign) textalign = 'left'
		if (!html) html = ''

		doc.save()
		doc.font('Courier')
		const start = { x: doc.x, y: doc.y, page }
		doc.text(html, doc.x + (is_in_group ? 20 : 0), doc.y, {
			align: textalign
		}).moveDown()
		resetEnvironment(doc)
		const end = { x: doc.x, y: doc.y, page }
		doc.restore()

		if (is_in_group) drawGroupBox(start, end, doc)

		return null
	}
	function addChecklist (kwargs) { 
		const { data, lang, doc, is_in_group } = kwargs || {}
		let { fontsize, fontweight, fontstyle, options } = data || {}
		if (!fontsize) fontsize = 1
		if (!fontweight) fontweight = 'normal'
		if (!fontstyle) fontstyle = 'normal'
		if (!options) options = []
		else {
			// THIS IS SO THAT ANY NULL OPTION (THAT MIIGHT COME FROM AN EXCEL SHEET) GETS PUSHED TO THE END
			options.sort((a, b) => {
				if (a.name === b.name) return 0
				else if (!a.name || !a.name.trim().length) return 1
				else if (!b.name || !b.name.trim().length) return -1
				else return a.id < b.id ? -1 : 1
			})
		}
		options = options.filter(d => d.name)

		doc.save()
		doc.fontSize(fontsizes.main / fontsize)
		if (fontweight === 'bold' && fontstyle === 'italic') doc.font('Helvetica-BoldOblique')
		else if (fontweight === 'bold' && fontstyle !== 'italic') doc.font('Helvetica-Bold')
		else if (fontweight !== 'bold' && fontstyle === 'italic') doc.font('Helvetica-Oblique')
		const start = { x: doc.x, y: doc.y, page }
		
		options.forEach(d => {
			let { x, y } = doc
			doc.text(d.name, x + (is_in_group ? 50 : 30), y, { 
				paragraphGap: fontsizes.main / 2
			})

			if (y + doc.heightOfString('dummy') > doc.page.height - doc.page.margins.bottom) y = doc.page.margins.top
			doc.save()
			doc.translate(is_in_group ? 30 : 10, -1)
			.lineWidth(1.5)
			.lineJoin('round')
			.rect(x, y, 12, 12)
			if (!d.checked) doc.fillAndStroke('#FFF', colors.dark_blue)
			else {
				doc.fillAndStroke(colors.dark_blue, colors.dark_blue)
				.strokeColor('#FFF')
				.path(`M ${x + 2},${y + 12 / 2} L ${x + (12 - 2) / 2},${y + 12 - 3} L ${x + 12 - 2},${y + 2}`)
				.stroke()
			}
			doc.restore()

			resetEnvironment(doc)
		})
		doc.moveDown()
		const end = { x: doc.x, y: doc.y, page }
		doc.restore()

		if (is_in_group) drawGroupBox(start, end, doc)

		return null
	}
	function addRadiolist (kwargs) { 
		const { data, lang, doc, is_in_group } = kwargs || {}
		let { fontsize, fontweight, fontstyle, options } = data || {}
		if (!fontsize) fontsize = 1
		if (!fontweight) fontweight = 'normal'
		if (!fontstyle) fontstyle = 'normal'
		if (!options) options = []
		else {
			// THIS IS SO THAT ANY NULL OPTION (THAT MIIGHT COME FROM AN EXCEL SHEET) GETS PUSHED TO THE END
			options.sort((a, b) => {
				if (a.name === b.name) return 0
				else if (!a.name || !a.name.trim().length) return 1
				else if (!b.name || !b.name.trim().length) return -1
				else return a.id < b.id ? -1 : 1
			})
		}
		options = options.filter(d => d.name)

		doc.save()
		doc.fontSize(fontsizes.main / fontsize)
		if (fontweight === 'bold' && fontstyle === 'italic') doc.font('Helvetica-BoldOblique')
		else if (fontweight === 'bold' && fontstyle !== 'italic') doc.font('Helvetica-Bold')
		else if (fontweight !== 'bold' && fontstyle === 'italic') doc.font('Helvetica-Oblique')
		const start = { x: doc.x, y: doc.y, page }

		options.forEach(d => {
			let { x, y } = doc
			doc.text(d.name, x + (is_in_group ? 50 : 30), y, { 
				paragraphGap: fontsizes.main / 2
			})

			if (y + doc.heightOfString('dummy') > doc.page.height - doc.page.margins.bottom) y = doc.page.margins.top
			doc.save()
			doc.translate(is_in_group ? 30 : 10, 0)
			.lineWidth(1.5)
			.circle(x + 5, y + 5, 6.5)
			.fillAndStroke('#FFF', colors.dark_blue)
			if (d.checked) {
				doc.fillColor(colors.dark_blue)
				.circle(x + 5, y + 5, 3.5)
				.fill()
			}
			doc.restore()

			resetEnvironment(doc)
		})
		doc.moveDown()
		const end = { x: doc.x, y: doc.y, page }
		doc.restore()

		if (is_in_group) drawGroupBox(start, end, doc)

		return null
	}

	function addTags (kwargs) {
		const { data, lang, doc, is_in_group } = kwargs || {}
		let { tags } = data || {}
		if (!tags?.length) return null

		const start = { x: doc.x, y: doc.y, page }
		const padding = 10
		const lines = []
		let { width, height, margins } = doc.page
		let { left, right, top, bottom } = margins
		width = width - left - right
		bottom = height - bottom
		// PRECALCULATE WIDTHS
		let line = 0
		let x = start.x
		let y = start.y + padding
		let cumul = 0
		
		tags.forEach((d, i) => {
			doc.fontSize(fontsizes.small)
			const w = doc.widthOfString(d.name) + padding * 2
			const h = doc.heightOfString(d.name) + padding
			let addpage = false
			if (i === 0 && y + h > bottom) {
				y = top
				addpage = true
			}
			else if (cumul + w >= width) {
				line ++
				x = start.x
				y += lines.find(c => c.line === line - 1).height + padding
				if (y + h > bottom) {
					y = top
					addpage = true
				}
				cumul = 0
			} else {
				if (lines.length > 0) x += lines[i - 1].width + padding
			}
			cumul += w + padding
			lines.push({ name: d.name, line, width: w, height: h, x, y, addpage })
		})
		new Array(line + 1).fill(0).forEach((d, i) => {
			const currentlines = lines.filter(c => c.line === i)
			const linewidth = currentlines.reduce((prev, val) => { return { width: prev.width + val.width } }).width
			const offset = (width - linewidth) / 2
			currentlines.forEach(c => c.x += offset)
		})

		doc.save()
		lines.forEach((d, i) => {
			if (d.addpage) doc.addPage()
			doc.save()
			.strokeColor(colors.mid_blue)
			.rect(d.x - padding, d.y - padding * .6, d.width, d.height)
			.stroke()
			.restore()
			.fillColor(colors.mid_blue)
			.fontSize(fontsizes.small)
			.text(d.name, d.x, d.y)
			doc.x = left
			if (i === lines.length - 1) doc.y = d.y + d.height + padding
		})
		doc.moveDown()

		resetEnvironment(doc)
		const end = { x: doc.x, y: doc.y, page }
		doc.restore()

		if (is_in_group) drawGroupBox(start, end, doc)		

		return null
	}
	function addSDGs (kwargs) {
		const { data, lang, doc, is_in_group } = kwargs || {}
		let { sdgs } = data || {}
		if (!sdgs?.length) return null

		const start = { x: doc.x, y: doc.y, page }
		const padding = 10
		const lines = []
		let { width, height, margins } = doc.page
		let { left, right, top, bottom } = margins
		width = width - left - right
		bottom = height - bottom
		// PRECALCULATE WIDTHS
		let line = 0
		let x = start.x
		let y = start.y
		let w = h = 100
		let cumul = 0
		
		sdgs.forEach((d, i) => {
			let addpage = false
			if (i === 0 && y + h > bottom) {
				y = top
				addpage = true
			}
			else if (cumul + w >= width) {
				line ++
				x = start.x
				y += lines.find(c => c.line === line - 1).height + padding
				if (y + h > bottom) {
					y = top
					addpage = true
				}
				cumul = 0
			} else {
				if (lines.length > 0) x += lines[i - 1].width + padding
			}
			cumul += w + padding
			lines.push({ key: d.key, line, width: w, height: h, x, y, addpage })
		})
		new Array(line + 1).fill(0).forEach((d, i) => {
			const currentlines = lines.filter(c => c.line === i)
			const linewidth = currentlines.reduce((prev, val) => { return { width: prev.width + val.width } }).width
			const offset = (width - linewidth) / 2
			currentlines.forEach(c => c.x += offset)
		})


		doc.save()
		lines.forEach((d, i) => {
			if (d.addpage) doc.addPage()
			const img = doc.openImage(path.join(__dirname, `../../public/imgs/sdgs/${lang}/G${d.key || d}-c.png`))
			doc.image(img, d.x, d.y, { width: d.width, height: d.height })

			doc.x = left
			if (i === lines.length - 1) doc.y = d.y + d.height + padding
		})
		doc.moveDown()
		resetEnvironment(doc)
		const end = { x: doc.x, y: doc.y, page }
		doc.restore()

		if (is_in_group) drawGroupBox(start, end, doc)		

		return null
	}

	function addGroup (kwargs) {
		console.log('found a group')
		const { data, lang, doc } = kwargs || {}
		let { type, structure, items, repeat } = data || {}
		if (!type) type = 'group'
		if (!structure) structure = [] // WE DO NOT USE STRUCTURE HERE
		if (!items) items = []
	
		for (let i = 0; i < items.length; i ++) {
			doc.save()
			items[i].forEach(d => populateSection(d, lang, doc, true))
			doc.moveDown()
			doc.restore()
		}
		doc.moveDown()

		return null
	}
	function drawGroupBox (start, end, doc) {
		const processed = processDrawing(start, end, doc)
		
		processed.forEach(d => {
			doc.switchToPage(Math.min(d.page, doc.bufferedPageRange().count))
			doc.save()
			const grad = doc.linearGradient(start.x, d.y1, start.x + 30, d.y1)
			grad.stop(0, colors.light_yellow)
				.stop(1, [255,255,255] ,0)

			doc.rect(start.x, d.y1, 30, d.y2 - d.y1)
			doc.fill(grad)

			doc.strokeColor(colors.dark_yellow)
			doc.moveTo(start.x, d.y1)
			.lineTo(end.x, d.y2)
			.stroke()
			doc.restore()

			resetEnvironment(doc)
		})
	}
	function processDrawing (start, end, doc) {
		const { height, margins } = doc.page
		let { bottom, top } = margins
		bottom = height - bottom
		const pagespan = end.page - start.page

		if (pagespan === 0) {
			if (start >= bottom) { // DRAW ON NEXT PAGE
				return [{ y1: top, y2: end.y, page: start.page }]
			} else { // JUST DRAW ON THIS PAGE
				return [{ y1: start.y, y2: end.y, page: start.page }]
			}
		} else {
			return new Array(pagespan + 1).fill(0).map((d, i) => {
				if (i === 0) return { y1: start.y, y2: bottom, page: start.page + i }
				else if (i === pagespan) return { y1: top, y2: end.y, page: start.page + i }
				else return { y1: top, y2: bottom, page: start.page + i }
			})
		}
	}
	function resetEnvironment (doc) {
		doc.fontSize(fontsizes.main)
		.font('Helvetica')
		.fillColor(colors.dark_grey)
		doc.x = doc.page.margins.left
	}
}

