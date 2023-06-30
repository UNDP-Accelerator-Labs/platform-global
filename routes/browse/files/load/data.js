const { page_content_limit, followup_count, modules, engagementtypes, DB } = include('config/')
const { checklanguage, engagementsummary, join } = include('routes/helpers/')

const filter = require('../filter').main

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	// THIS NEEDS TO BE A TASK
	const { req } = kwargs
	const { object } = req.params || {}
	const { uuid, rights, collaborators } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)
	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req)
 
 	const module_rights = modules.find(d => d.type === object)?.rights
 	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
 	const engagement = engagementsummary({ doctype: 'file', engagementtypes, uuid })

	return conn.any(`
		SELECT f.id, f.owner, f.name, f.path, f.status, f.source,
			m.id AS mobilization, m.title AS mobilization_title, m.pad_limit, 
			p.template, p.title AS pad_title, 
			t.title AS template_title,


			CASE
				WHEN AGE(now(), f.date) < '0 second'::interval
					THEN jsonb_build_object('interval', 'positive', 'date', to_char(f.date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(f.date, now())), 'hours', EXTRACT(hour FROM AGE(f.date, now())), 'days', EXTRACT(day FROM AGE(f.date, now())), 'months', EXTRACT(month FROM AGE(f.date, now())))
				ELSE jsonb_build_object('interval', 'negative', 'date', to_char(f.date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(now(), f.date)), 'hours', EXTRACT(hour FROM AGE(now(), f.date)), 'days', EXTRACT(day FROM AGE(now(), f.date)), 'months', EXTRACT(month FROM AGE(now(), f.date)))
			END AS date,


			-- CASE WHEN AGE(now(), f.date) < '1 hour'::interval
			-- 		THEN EXTRACT(minute FROM AGE(now(), f.date))::text || ' minutes ago'
			-- 	WHEN AGE(now(), f.date) < '1 day'::interval
			-- 		THEN EXTRACT(hour FROM AGE(now(), f.date))::text || ' hours ago'
			-- 	WHEN AGE(now(), f.date) < '1 month'::interval
			-- 		THEN EXTRACT(day FROM AGE(now(), f.date))::text || ' days ago'
			-- 	ELSE to_char(f.date, 'DD Mon YYYY')
			-- END AS date,



			-- CASE WHEN f.source IS NOT NULL
			-- 	AND m.id IS NOT NULL
			-- 	AND (SELECT copy FROM mobilizations WHERE id = m.id) = TRUE
			-- 		THEN TRUE
			-- 		ELSE FALSE
			-- 	END AS is_forward,

			-- COALESCE(json_agg(json_build_object(
			-- 	'id', fmob.id, 
			-- 	'title', fmob.title, 
			-- 	'source', f.id, 
			-- 	'template', fmob.template,
			-- 	'count', (SELECT COUNT(p2.id) FROM pads p2 
			-- 		INNER JOIN mobilization_contributions mc2 
			-- 			ON p2.id = mc2.pad 
			-- 		WHERE p2.source = f.id 
			-- 		AND mc2.mobilization = fmob.id),
			-- 	'max', $8::INT
			-- )) FILTER (WHERE fmob.id IS NOT NULL AND fmob.copy = TRUE AND f.status >= 2), '[]') 
			-- AS forwards,

			-- COALESCE(
			-- 	(SELECT m.pad_limit - COUNT (id) FROM pads pp 
			-- 		WHERE pp.contributor IN (SELECT id FROM contributors WHERE country = c.country)
			-- 		AND pp.id IN (SELECT pad FROM mobilization_contributions WHERE mobilization = m.id)
			-- 		AND pp.status >= 2  
			-- 	), 1)::INT AS available_publications,

			-- THESE ARE THE ENGAGEMENT COUNTS
			$3:raw, 

			CASE WHEN f.owner IN ($2:csv)
				OR $4 > 2
					THEN TRUE
					ELSE FALSE
				END AS editable,
			
			-- THESE ARE THE ENGAGEMENT CASE STATEMENTS
			$5:raw

		FROM files f
		
		LEFT JOIN pads p
			ON f.source = p.id
		LEFT JOIN templates t
			ON t.id = p.template
		
		LEFT JOIN (
			SELECT docid, contributor, array_agg(DISTINCT type) AS types FROM engagement
			WHERE contributor = $1
				AND doctype = 'file'
			GROUP BY (docid, contributor)
		) e ON e.docid = f.id
		
		LEFT JOIN ($6:raw) ce ON ce.docid = f.id

		LEFT JOIN mobilization_contributions mc
			ON mc.pad = f.id
		LEFT JOIN mobilizations m
			ON m.id = mc.mobilization
		LEFT JOIN (
			SELECT id, title, source, template, copy FROM mobilizations
			WHERE status = 1
		) fmob
			ON fmob.source = m.id
		
		WHERE TRUE 
			$7:raw 
			$8:raw
			AND (m.id = (SELECT MAX(mc2.mobilization) FROM mobilization_contributions mc2 WHERE mc2.pad = f.id)
				OR m.id IS NULL)
		
		GROUP BY (
			f.id, 
			p.template,
			p.title,
			t.owner,
			m.id, 
			e.types, 
			m.title, 
			m.pad_limit,
			t.title,
			$9:raw
		)
		$10:raw
		LIMIT $11 OFFSET $12
	;`, [ 
		/* $1 */ uuid, 
		/* $2 */ collaborators_ids,
		/* $3 */ engagement.coalesce,
		/* $4 */ rights, 
		/* $5 */ engagement.cases,
		/* $6 */ engagement.query,
		/* $7 */ full_filters, 
		/* $8 */ f_space, 
		/* $9 */ engagement.list,
		/* $10 */ order, 
		/* $11 */ page_content_limit, 
		/* $12 */ (page - 1) * page_content_limit 
	]).then(async results => {
		// REMOVE THE follow_ups AND forwards FOR PADS THAT HAVE ALREADY BEEN FOLLOWED UP FOR A GIVEN MOBILIZATION
		results.forEach(d => {
			d.forwards = d.forwards?.filter(c => c.count < followup_count)
		})

		const data = await join.users(results, [ language, 'owner' ])

		return { 
			data,
			// count: (page - 1) * page_content_limit, 
			count: page * page_content_limit, 
			sections: [{ data }] // THIS IS A BIT USELESS BUT THE FRONT END STILL DEPENDS ON IT
		}
	}).catch(err => console.log(err))
}