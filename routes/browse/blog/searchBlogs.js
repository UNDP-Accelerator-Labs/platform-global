const { searchBlogQuery } = require('./query')
const { parsers } = include('routes/helpers/')

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	const { req, res, baseurl, page, page_content_limit } = kwargs || {}

    const searchText = req.query.search ||  '';
	let { source, search, country, type } = req.query || {}
	const searchRegex = searchText ? parsers.regexQuery(searchText) : '';

	return conn.task(t => {
			return t.any(searchBlogQuery(searchText, page, country, type)).then(async (results) => {
				// console.log('searchRegex ', searchRegex)
				// Process each row and collect results
				const res = results.map((row) => {
					const matchedTexts = extractContext(row.content, searchRegex);
					delete row.content
					delete row.all_html_content
					// console.log('matchedTexts ', matchedTexts)
					return { ...row, matched_texts: matchedTexts };
				});

				return {
					searchResults : res,
					page,
					total_pages : results[0]?.total_pages || 0,
					totalRecords : results[0]?.total_records || 0
				}
			  
			}).catch(err => {
				console.log(err);
				// NOTE recovering from any query parse errors
				return {
					searchResults : []
				}
			})
		
	})
}

function extractContext(text, searchTerm) {
    const regexPattern = sanitizeSearchTerm(searchTerm);
    const match = text.match(regexPattern);
	const words = text.split(/\s+/);

	let wordIndex = 0;
	let charCount = 0;
	const startIndex = Math.max(0, wordIndex - 10);
    const endIndex = Math.min(words.length, wordIndex + 100);

    if (match) {
        // Find the index of the word where the match starts
        while (charCount < match.index) {
            charCount += words[wordIndex].length + 1; // +1 for space
            wordIndex++;
        }
    }

	const contextBefore = words.slice(startIndex, wordIndex).join(' ');
	const contextAfter = words.slice(wordIndex, endIndex).join(' ');
	return contextBefore + ' ' + contextAfter;
}


function sanitizeSearchTerm(searchTerm) {
    // Split the search term into individual words or phrases
    const terms = searchTerm.split('|');

    // Sanitize each word or phrase
    const sanitizedTerms = terms.map(term => {
        // Remove invalid escape characters
        const termWithoutInvalidEscapes = term.replace(/\\(?![b])/g, '');
        
        // Replace \m and \M with \b
        return termWithoutInvalidEscapes.replace(/m|M/g, '\\b');
    });

    // Join the sanitized words or phrases back into a single string
    const sanitizedSearchTerm = sanitizedTerms.join('|');
    
    // Create regular expression
    const regexPattern = new RegExp(`${sanitizedSearchTerm}`, 'i');
    return regexPattern;
}





 const documents = _data => {
	const { embeddings, documents, filters, language } = _data

	let b = '\\b' // WORD BOUNDARIES
	let B = '\\B'
	if (language === 'AR') {
		b = '(^|[^\u0621-\u064A])'
		B = '($|[^\u0621-\u064A])'
	}

	let terms = []
	if (embeddings) terms = embeddings.flat().unique().filter(d => d.charAt(0) !== '-')
	let filteredTerms = []
	if (filters) filteredTerms = filters.flat().unique().filter(d => d.charAt(0) !== '-')
	
	return documents.map(d => {
		d.matches = []
		terms.forEach(c => {
			let match
			if (c.indexOf('*') !== -1) match = d.text.match(new RegExp(`${b}(\#)?${c.trim()}(\\w+)?`, 'gi'))
			else match = d.text.match(new RegExp(`${b}(\#)?${c.trim()}(\\S+)?`, 'gi'))
			if (match) match.unique().forEach(b => d.text = d.text.replace(b, `<span class='highlight-term'>${b}</span>`))
			d.matches.push({ term: c, count: (match || []).length })
		})
		filteredTerms.forEach(c => {
			let match
			if (c.indexOf('*') !== -1) match = d.text.match(new RegExp(`${b}(\#)?${c.trim()}(\\w+)?`, 'gi'))
			else match = d.text.match(new RegExp(`${b}(\#)?${c.trim()}(\\S+)?`, 'gi'))
			if (match) match.forEach(b => d.text = d.text.replace(b, `<span class='highlight-filtered-term'>${b}</span>`))
		})
		if (d.tags) d.tags = d.tags.map(c => JSON.parse(c))
		return d
	})
}
  

  