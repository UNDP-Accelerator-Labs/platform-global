const helpers = include('routes/helpers/')

exports.regexQuery = (_data, _language) => { // DO SOMETHING HERE FOR RTL LANGUAGES
	let m = '\\m' // WORD BOUNDARIES
	let M = '\\M'
	if (_language === 'AR') {
		m = '(^|[^\u0621-\u064A])'
		M = '($|[^\u0621-\u064A])'
	}
	const query = _data.map(d => {
		return `^${d.map(c => {
			if (c.charAt(0) !== '-') { // POSITIVE LOOKAHEAD
				// WE NEED TO REMOVE ANY QUOTE MARKS
				c = c.replace(/["]+/g, '')
				if (c.charAt(c.length - 1) === '*') return `(?=.*${m}${c})` 
				else if (c.charAt(0) === '#') return `(?=.*(^|[^\\w#])${c}($|[^\\w#]))`
				else return `(?=.*${m}${c}${M})` 
			}
			else { // NEGATIVE LOOKAHEAD
				c = c.replace(/["]+/g, '')
				if (c.charAt(c.length - 1) === '*') return `(?!.*${m}${c.substr(1)})`
				else if (c.charAt(0) === '#') return `(?!.*(^|[^\\w#])${c}($|[^\\w#]))`
				else return `(?!.*${m}${c.substr(1)}${M})`
			}
		}).join('')}.*$`
	})
	return `(${query.join('|')})`
}
exports.documents = _data => {
	const { embeddings, documents, filters, language } = _data

	let b = '\\b' // WORD BOUNDARIES
	let B = '\\B'
	if (language === 'AR') {
		b = '(^|[^\u0621-\u064A])'
		B = '($|[^\u0621-\u064A])'
	}

	let terms = []
	if (embeddings) terms = helpers.unique.call(embeddings.flat()).filter(d => d.charAt(0) !== '-')
	let filteredTerms = []
	if (filters) filteredTerms = helpers.unique.call(filters.flat()).filter(d => d.charAt(0) !== '-')
	
	return documents.map(d => {
		d.matches = []
		terms.forEach(c => {
			let match
			if (c.indexOf('*') !== -1) match = [d.description, d.insights, d.application].join(' ').match(new RegExp(`${b}(\#)?${c.trim()}(\\w+)?`, 'gi'))
			else match = [d.description, d.insights, d.application].join(' ').match(new RegExp(`${b}(\#)?${c.trim()}(\\S+)?`, 'gi'))
			if (match) helpers.unique.call(match).forEach(b => {
				d.description = d.description ? d.description.replace(b, `<span class='highlight-term'>${b}</span>`) : null
				d.insights = d.insights ? d.insights.replace(b, `<span class='highlight-term'>${b}</span>`) : null
				d.application = d.application ? d.application.replace(b, `<span class='highlight-term'>${b}</span>`) : null
			})
			d.matches.push({ term: c, count: (match || []).length })
		})
		// filteredTerms.forEach(c => {
		// 	let match
		// 	if (c.indexOf('*') !== -1) match = d.text.match(new RegExp(`${b}(\#)?${c.trim()}(\\w+)?`, 'gi'))
		// 	else match = d.text.match(new RegExp(`${b}(\#)?${c.trim()}(\\S+)?`, 'gi'))
		// 	if (match) match.forEach(b => d.text = d.text.replace(b, `<span class='highlight-filtered-term'>${b}</span>`))
		// })
		if (d.tags) d.tags = d.tags.map(c => JSON.parse(c))
		return d
	})
}


// Array.prototype.unique = function (key, onkey) {
// 	const arr = []
// 	this.forEach(d => {
// 		if (!key) {
// 			if (arr.indexOf(d) === -1) arr.push(d)
// 		}
// 		else {
// 			if (onkey) { if (arr.map(c => c).indexOf(d[key]) === -1) arr.push(d[key]) }
// 			else { if (arr.map(c => c[key]).indexOf(d[key]) === -1) arr.push(d) }
// 		}
// 	})
// 	return arr
// }