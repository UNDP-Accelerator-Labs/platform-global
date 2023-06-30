exports.getImg = (_json = {}, _unique = true) => { 
	if (_json?.sections) {
		const media = _json.sections.map(c => c.items?.map(b => b.type === 'group' ? b.items.flat() : b).flat()).flat()
		const img = media.filter(c => c.type === 'img' && c.src).map(d => {
			if (this.isURL(d.src)) return d.src
			else return `/${d.src.replace('uploads', 'uploads/sm')}`
		})
		const mosaic = media.filter(c => c.type === 'mosaic' && c.srcs?.length > 0).map(d => d.srcs).flat().map(d => {
			if (this.isURL(d)) return d
			else return `/${d.replace('uploads', 'uploads/sm')}`
		})
		const embed = media.filter(c => c.type === 'embed' && c.src).map(d => d.src).filter(d => d).map(d => {
			if (this.isURL(d)) return d
			else return `/${d.replace('uploads', 'uploads/sm')}`
		})
		const results = img?.concat(mosaic, embed)
		
		if (_unique) return [results[0]].filter(d => d)
		else return results.filter(d => d)

		// if (img) {
		// 	if (this.isURL(img.src)) return [img.src]
		// 	else return [`/${img.src.replace('uploads', 'uploads/sm')}`]
		// } else if (mosaic) {
			// if (this.isURL(mosaic.srcs?.[0])) return [mosaic.srcs?.[0]]
			// else return [`/${mosaic.srcs?.[0].replace('uploads', 'uploads/sm')}`]
		// } else if (embed) {
			// if (this.isURL(embed.src)) return [embed.src]
			// else return [`${embed.src.replace('uploads', 'uploads/sm')}`]
		// } else return []
	} else return []
}
exports.getSDGs = function (_json = {}) {
	if (_json?.sections) {
		const meta = _json.sections.map(c => c.items?.map(b => b.type === 'group' ? b.items : b)).flat(3)
		// const sdgs = meta.find(c => c.type === 'sdgs')
		const sdgs = meta.find(c => c.type === 'index' && c.name === 'sdgs')
		if (sdgs) return sdgs.tags // THIS IS LEGACY FOR THE ACTION PLANS PLATFORM
		else return []
	} else return []
}
exports.getTags = function (_json = {}) {
	if (_json?.sections) {
		const meta = _json.sections.map(c => c.items?.map(b => b.type === 'group' ? b.items : b)).flat(3)
		const tags = meta.find(c => c.type === 'tag' && c.name === 'thematic_areas' && c.tags?.length)
		if (tags) return tags.tags?.filter(c => c.name)//.map(c => c.name)]
		// if (tags) return [tags.tags.filter(c => c.name && c.name !== '').map(c => c.name)]
		else return []
	} else return []
}
exports.getTxt = function (_json = {}) {
	if (_json?.sections) {
		const media = _json.sections.map(c => c.items?.map(b => b.type === 'group' ? b.items : b)).flat(3)
		let txt = media.find(c => c.type === 'txt' && c.is_excerpt && c.txt?.length)
		if (!txt) txt = media.find(c => c.type === 'txt' && c.txt?.length && c.txt?.trim().toLowerCase() !== _json?.title?.trim().toLowerCase())
		if (txt) return [txt.txt]
		else return []
	} else return []
}
exports.getReviewScore = function (_json = {}) {
	if (_json?.sections) {
		const media = _json.sections.map(d => d.items?.map(c => c.type === 'group' ? c.items : c)).flat(3)
		const score = media.find(d => d.type === 'radiolist' && d.name === 'review_score')?.options.find(d => d.checked)?.value
		return score ?? null
	} else return null
}
exports.getAttachments = (_json = {}) => { 
	if (_json?.sections) {
		const meta = _json.sections.map(c => c.items?.map(b => b.type === 'group' ? b.items : b)).flat(3)
		const attachments = meta.filter(c => c.type === 'attachment' && c.srcs?.filter(b => b).length > 0)
			.map(d => d.srcs).flat()
			// .map(d => {
			// 	if (this.isURL(d.src)) return d.src
			// 	else return `/${d.src.replace('uploads', 'uploads/sm')}`
			// })
		return attachments
	} else return []
}
exports.regexQuery = require('./search.js').sqlregex

exports.isURL = function (str = '') {
	let b = '\\b' // WORD BOUNDARIES
	let B = '\\B'
	// const pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
	// 	'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
	// 	'((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
	// 	'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
	// 	'(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
	// 	'(\\#[-a-z\\d_]*)?$', 'i') // extension
	const url = new RegExp(`(?<!:)(${b}(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])`, 'ig')
	return !!url.test(encodeURI(str.valueOf().trim()))
}

// NOTE THIS IS NOT USED FOR NOW
function extractItem (d = {}, section = null, group = null) {
	if (d.type === 'img') return { key: d.instruction, value: d.src ? d.src : null, section: section, group: group }
	if (d.type === 'mosaic') return { key: d.instruction, value: d.srcs.length ? d.srcs.join(', ') : null, section: section, group: group }
	// NOTE: HAVE NOT TESTED WITH mosaic OR video
	if (d.type === 'video') return { key: d.instruction, value: d.src ? d.src : null, section: section, group: group }
	if (d.type === 'txt') return { key: d.instruction, value: d.txt && d.txt !== '' ? d.txt : null, section: section, group: group }
	if (d.type === 'embed') return { key: d.instruction, value: d.html && d.html !== '' ? d.html : null, section: section, group: group }
	if (d.type === 'checklist') return d.options.map(c => { return { key: `${d.instruction}: ${c.name}`, value: c.checked ? 1 : 0, section: section, group: group } })
	if (d.type === 'radiolist') return { key: d.instruction, value: d.options && d.options.find(c => c.checked) ? d.options.find(c => c.checked).name : null, section: section, group: group }
	// TO DO: UPDATE THIS TO USE metafields
	if (d.type === 'sdgs') return { key: d.instruction, value: d.sdgs.length ? d.sdgs.join(', ') : null, section: section, group: group }
	if (d.type === 'tags') return { key: d.instruction, value: d.tags.length ? d.tags.map(c => c.name).join(', ') : null, section: section, group: group }
	if (['skills', 'methods'].includes(d.type)) return { key: d.instruction, value: d.tags.length ? d.tags.map(c => c.name).join(', ') : null, section: section, group: group }
	if (d.type === 'datasources') return { key: d.instruction, value: d.tags.length ? d.tags.map(c => c.name).join(', ') : null, section: section, group: group }

	if (d.type === 'group') { 
		if (d.repeat) { // THIS IS A REPEAT GROUP
			const grouped_items = []
			for (let i = 0; i < d.repeat; i ++) {
				let items = []
				if (d.items[i]) items = d.items[i]
				// PASS AN OBJECT WITH ALL null VALUES (THIS IS A FILLER IN CASE OTHER PADS HAVE MORE REPETITIONS OF THE GROUP)
				else {
					items = d.items[0].map(c => { // THIS IS MAYBE A BIT HACKY (SINCE VERY SPECIFIC)
						const obj = {}
						for (key in c) {
							obj[key] = c[key]
							if (!['type', 'instruction'].includes(key)) {
								if (obj.type === 'checklist' && key === 'options') obj[key].forEach(b => b.checked = false) // IF CHECKLIST, THEN WE NEED TO KEEP THE OPTIONS AND WE FORCE A NON RESPONSE (checked = false)
								else obj[key] = null
							}
						}
						return obj
					})
				}				
				grouped_items.push(items.map(c => { // THESE ARE THE ITEMS IN EACH REPEAT GROUP
					return extractItem(c, section, `${d.instruction} #${i + 1}`)
				}).flat())
			}
			return grouped_items.flat()
		} else { // THIS IS NOT A REPEAT GROUP
			return d.items.map(c => { // THIS IS WHERE REPEAT GROUPS ARE STORED
				return c.map(b => { // THESE ARE THE ITEMS IN EACH GROUP
					return extractItem(b, section, `${d.instruction}`)
				}).flat()
			}).flat()
		}
	}
}