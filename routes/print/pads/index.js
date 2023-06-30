// THIS IS AN ULTR SIMLPFIED VERSION OF browse/pads
const { map, DB } = include('config/')
const { checklanguage, datastructures, array, join } = include('routes/helpers/')

const { filter } = require('../../browse/pads/')

exports.render = async (req, res) => {
	const { object } = req.params || {}
	
	if (req.session.uuid) { // USER IS LOGGED IN
		var { uuid, rights, collaborators } = req.session || {}
	} else { // PUBLIC/ NO SESSION
		var { uuid, rights, collaborators } = datastructures.sessiondata({ public: true }) || {}
	}
	const language = checklanguage(req.params?.language || req.session.language)

	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req, res)
	
	return DB.conn.any(`
		SELECT p.id, p.owner, p.title, p.sections, p.status, 
			FALSE AS editable,
			m.id AS mobilization, m.title AS mobilization_title, 
			t.title AS template_title,

			CASE
				WHEN AGE(now(), p.date) < '0 second'::interval
					THEN jsonb_build_object('interval', 'positive', 'date', to_char(p.date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(p.date, now())), 'hours', EXTRACT(hour FROM AGE(p.date, now())), 'days', EXTRACT(day FROM AGE(p.date, now())), 'months', EXTRACT(month FROM AGE(p.date, now())))
				ELSE jsonb_build_object('interval', 'negative', 'date', to_char(p.date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(now(), p.date)), 'hours', EXTRACT(hour FROM AGE(now(), p.date)), 'days', EXTRACT(day FROM AGE(now(), p.date)), 'months', EXTRACT(month FROM AGE(now(), p.date)))
			END AS date
			
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
		const data = await join.users(results, [ language, 'owner' ])
		const metadata = await datastructures.pagemetadata({ req, res, pagecount: data?.length ?? 0, map })
		const booklet = Object.assign(metadata, { data })
		res.render('print/pads/', booklet)
	}).catch(err => console.log(err))
}