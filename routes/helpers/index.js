const { DB } = include('config/')

exports.array = require('./array/')
exports.join = require('./joins/')
exports.parsers = require('./parsers/')
exports.datastructures = require('./datastructures/')
exports.checklanguage = require('./language/').main
exports.email = require('./email/').main
exports.geo = require('./geo/')

exports.flatObj = function () {
	// FLATTEN OBJECT: https://stackoverflow.com/questions/31136422/flatten-array-with-objects-into-1-object
	return Object.assign.apply(Object, this)
}
exports.engagementsummary = function (kwargs = {}) {
	const { doctype, docid, engagementtypes, uuid } = kwargs
	
	const query = []
	const coalesce = []
	const cases = []
	const list = []

	// TO DO: FILTER IF NO ENGAGEMENT TYPES
	if (engagementtypes.includes('comment')) {
		query.push(DB.pgp.as.format(`
			SELECT CASE WHEN e.docid IS NULL
				THEN cnt.docid
				ELSE e.docid
			END AS docid,
			COALESCE(cnt.count, 0) AS "comments"$1:raw
		`, [ engagementtypes.length > 1 ? ',' : ''  ]))

		coalesce.push(DB.pgp.as.format(`COALESCE (ce.$1:name, 0)::INT AS $1:name`, [ 'comments' ]))
		list.push(DB.pgp.as.format(`ce.$1:name`, [ 'comments' ]))
	} else query.push(DB.pgp.as.format('SELECT e.docid$1:raw', [ engagementtypes.filter(e => e !== 'comment').length > 0 ? ',' : ''  ]))
	
	engagementtypes.filter(e => e !== 'comment').forEach((e, i) => {
		query.push(DB.pgp.as.format(`SUM (CASE WHEN e.type = $1 THEN 1 ELSE 0 END) AS $2:name$3:raw`, [ e, `${e}s`, i < engagementtypes.filter(e => e !== 'comment').length - 1 ? ',' : '' ]))
		coalesce.push(DB.pgp.as.format(`COALESCE (ce.$1:name, 0)::INT AS $1:name`, [ `${e}s` ]))
		
		if (uuid) {
			cases.push(DB.pgp.as.format(`
				CASE WHEN $1:raw.status >= 2 
					AND $2 IN (
						SELECT type FROM engagement 
						WHERE docid = $1:raw.id 
							AND doctype = $3 
							AND contributor = $4
						) THEN TRUE 
						ELSE FALSE 
					END AS $5:name
			`, [ doctype.charAt(0), e, doctype, uuid, e.charAt(e.length - 1) !== 'e' ? `${e}ed` : `${e}d` ]))
		} else cases.push(DB.pgp.as.format(`FALSE AS $1:name`, [ e.charAt(e.length - 1) !== 'e' ? `${e}ed` : `${e}d` ]))

		list.push(DB.pgp.as.format(`ce.$1:name`, [ `${e}s` ]))
	})

	if (engagementtypes.filter(e => e !== 'comment').length > 0) query.push('FROM engagement e')
	if (engagementtypes.includes('comment')) {
		query.push(DB.pgp.as.format(`
			FULL JOIN (
				SELECT docid, doctype, COUNT (message) FROM comments
				WHERE message IS NOT NULL
				AND doctype = $1
				GROUP BY (docid, doctype)
			) cnt
			ON e.docid = cnt.docid
		`, [ doctype ]))
	}

	let comment_clause = ''
	if (engagementtypes.includes('comment')) comment_clause = DB.pgp.as.format(' OR cnt.doctype = $1', [ doctype ])
	if (docid) query.push(DB.pgp.as.format(`WHERE (e.doctype = $1$3:raw) AND e.docid = $2 GROUP BY (e.docid, cnt.docid, cnt.count)`, [ doctype, docid, comment_clause ]))
	else query.push(DB.pgp.as.format(`WHERE (e.doctype = $1$2:raw) GROUP BY (e.docid, cnt.docid, cnt.count)`, [ doctype, comment_clause ]))
	
	return { coalesce: coalesce.join(', '), cases: cases.join(', '), query: query.join(' '), list: list.join(', ') }
}


// EXAMPLE FOUND AT: https://css-tricks.com/snippets/javascript/strip-html-tags-in-javascript/
exports.stripHTML = function () {
	return this.replace(/(<([^>]+)>)/gi, '')
}

// Array.prototype.min = function (key, onkey) {
// USE DESTRUCTURING: SEE https://medium.com/@vladbezden/how-to-get-min-or-max-of-an-array-in-javascript-1c264ec6e1aa	
// const nums = [1, 2, 3]
// 	Math.min(...nums)    // 1
// 	Math.max(...nums)    // 3
// }