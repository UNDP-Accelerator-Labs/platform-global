const { page_content_limit, modules, engagementtypes, DB } = include('config/')
const { checklanguage, engagementsummary, join } = include('routes/helpers/')

const filter = require('../filter').main

exports.main = kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	const { req } = kwargs || {}
	const { object } = req.params || {}
	const { uuid, rights, collaborators } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)

	// GET FILTERS
	const [ f_space, order, page, full_filters ] = filter(kwargs.req)

	const module_rights = modules.find(d => d.type === object)?.rights
	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
	if (!collaborators_ids.length) collaborators_ids = [ uuid ]

	const engagement = engagementsummary({ doctype: 'mobilization', engagementtypes, uuid })

	// THE tm PART ENSURES ONLY ONE FOLLOW UP AT A TIME: 
	// IF THE MOBILIZATION HAS AN ACTIVE FOLLOW UP (status = 1) THEN THE USER CANNOT ADD ANOTHER FOLLOW UP
	// TO DO: THE SAME FOR COPIES
	return conn.any(`
		SELECT m.id,
			m.owner,
			m.title, 
			m.status, 
			m.public,
			m.source,
			m.language,
			t.id AS template,
			t.title AS template_title, 
			t.description AS template_description,

			CASE 				
				WHEN AGE(now(), m.start_date) < '0 second'::interval
					THEN jsonb_build_object('type', 'start', 'interval', 'positive', 'date', to_char(m.start_date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(m.start_date, now())), 'hours', EXTRACT(hour FROM AGE(m.start_date, now())), 'days', EXTRACT(day FROM AGE(m.start_date, now())), 'months', EXTRACT(month FROM AGE(m.start_date, now())))
				ELSE jsonb_build_object('type', 'start', 'interval', 'negative', 'date', to_char(m.start_date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(now(), m.start_date)), 'hours', EXTRACT(hour FROM AGE(now(), m.start_date)), 'days', EXTRACT(day FROM AGE(now(), m.start_date)), 'months', EXTRACT(month FROM AGE(now(), m.start_date)))

				-- WHEN AGE(now(), m.start_date) < '1 hour'::interval
				-- 	THEN EXTRACT(minute FROM AGE(now(), m.start_date))::text || ' minutes ago'
				-- WHEN AGE(now(), m.start_date) < '1 day'::interval
				-- 	THEN EXTRACT(hour FROM AGE(now(), m.start_date))::text || ' hours ago'
				-- WHEN AGE(now(), m.start_date) < '1 month'::interval
				-- 	THEN EXTRACT(day FROM AGE(now(), m.start_date))::text || ' days ago'
				-- ELSE to_char(m.start_date, 'DD Mon YYYY')
			END AS start_date,

			CASE WHEN m.end_date IS NULL 
					THEN 'null'
				WHEN AGE(now(), m.end_date) < '0 second'::interval
					THEN jsonb_build_object('type', 'end', 'interval', 'positive', 'date', to_char(m.end_date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(m.end_date, now())), 'hours', EXTRACT(hour FROM AGE(m.end_date, now())), 'days', EXTRACT(day FROM AGE(m.end_date, now())), 'months', EXTRACT(month FROM AGE(m.end_date, now())))
				ELSE jsonb_build_object('type', 'end','interval', 'negative', 'date', to_char(m.end_date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(now(), m.end_date)), 'hours', EXTRACT(hour FROM AGE(now(), m.end_date)), 'days', EXTRACT(day FROM AGE(now(), m.end_date)), 'months', EXTRACT(month FROM AGE(now(), m.end_date)))

				-- WHEN AGE(now(), m.end_date) < '1 hour'::interval
				-- 	THEN EXTRACT(minute FROM AGE(now(), m.end_date))::text || ' minutes ago'
				-- WHEN AGE(now(), m.end_date) < '1 day'::interval
				-- 	THEN EXTRACT(hour FROM AGE(now(), m.end_date))::text || ' hours ago'
				-- WHEN AGE(now(), m.end_date) < '1 month'::interval
				-- 	THEN EXTRACT(day FROM AGE(now(), m.end_date))::text || ' days ago'
				-- ELSE to_char(m.end_date, 'DD Mon YYYY')
			END AS end_date,

			CASE WHEN m.source IS NOT NULL
				THEN (SELECT m2.title FROM mobilizations m2 WHERE m2.id = m.source) 
				ELSE NULL
			END AS source_title,
			
			CASE WHEN m.source IS NOT NULL
				AND m.copy = FALSE
				AND m.child = FALSE
					THEN TRUE
					ELSE FALSE
				END AS is_followup,

			CASE WHEN m.source IS NOT NULL
				AND m.copy = TRUE
				AND m.child = FALSE
					THEN TRUE
					ELSE FALSE
				END AS is_copy,

			CASE WHEN m.source IS NOT NULL
				AND m.copy = FALSE
				AND m.child = TRUE
					THEN TRUE
					ELSE FALSE
				END AS is_child,

			COALESCE((SELECT sm.title FROM mobilizations sm WHERE sm.id = m.source LIMIT 1), NULL) AS source,
			COALESCE((SELECT sm.id FROM mobilizations sm WHERE sm.id = m.source LIMIT 1), NULL) AS source_id, -- THIS IS NOT USED IN THE FRONT END: IT IS THE SETUP FOR LIMITING THE NUMBER OF COPIED MOBILIZATIONS
			
			COALESCE((SELECT tm.title FROM mobilizations tm WHERE tm.source = m.id LIMIT 1), NULL) AS target, -- NOT SURE THIS IS NEEDED
			COALESCE((SELECT tm.id FROM mobilizations tm WHERE tm.source = m.id LIMIT 1), NULL) AS target_id, 
			
			COALESCE((SELECT COUNT (DISTINCT(p.id)) FROM mobilization_contributions mc INNER JOIN pads p ON mc.pad = p.id WHERE p.status >= 2 AND mc.mobilization = m.id), 0)::INT AS associated_pads,
			COALESCE((SELECT COUNT (DISTINCT(p.id)) FROM mobilization_contributions mc INNER JOIN pads p ON mc.pad = p.id WHERE p.status < 2 AND mc.mobilization = m.id AND (p.owner = $1 OR $4 > 2)), 0)::INT AS private_associated_pads,
			
			CASE WHEN m.public = FALSE
				THEN COALESCE((SELECT COUNT (DISTINCT(p.owner)) FROM mobilization_contributions mc INNER JOIN pads p ON mc.pad = p.id WHERE p.status >= 2 AND mc.mobilization = m.id), 0)::INT
				ELSE NULL
			END AS contributors,

			CASE WHEN m.public = FALSE
				THEN COALESCE((SELECT COUNT (DISTINCT(mc.participant)) FROM mobilization_contributors mc WHERE mc.mobilization = m.id), 0)::INT
				ELSE NULL
			END AS participants,

			-- THESE ARE THE ENGAGEMENT COALESCE STATEMENTS
			$3:raw, 

			CASE WHEN m.owner IN ($2:csv)
				OR $4 > 2
					THEN TRUE
					ELSE FALSE
				END AS editable,

			-- THESE ARE THE ENGAGEMENT CASE STATEMENTS
			$5:raw
		
		FROM mobilizations m
		
		INNER JOIN templates t
			ON m.template = t.id
	
		LEFT JOIN (
			SELECT docid, contributor, array_agg(DISTINCT type) AS types FROM engagement
			WHERE contributor = $1
				AND doctype = 'mobilization'
			GROUP BY (docid, contributor)
		) e ON e.docid = m.id

		LEFT JOIN ($6:raw) ce ON ce.docid = m.id
		
		WHERE (m.owner = $1
			OR $1 IN (SELECT mc.participant FROM mobilization_contributors mc WHERE mc.mobilization = m.id)
			OR $4 > 2)
			$7:raw
		
		GROUP BY (
			m.id, 
			t.id,
			associated_pads,
			e.types,
			$8:raw
		)
		$9:raw
		LIMIT $10 OFFSET $11
	;`, [
		/* $1 */ uuid, 
		/* $2 */ collaborators_ids, 
		/* $3 */ engagement.coalesce, 
		/* $4 */ rights, 
		/* $5 */ engagement.cases, 
		/* $6 */ engagement.query, 
		/* $7 */ full_filters, 
		/* $8 */ engagement.list, 
		/* $9 */ order,
		/* $10 */ page_content_limit, 
		/* $11 */ (page - 1) * page_content_limit
	]).then(async results => {
		const data = await join.users(results, [ language, 'owner' ])
		data.forEach(d => {
			//d.date = `${d.start_date} – ${d.end_date}`
		})

		return { 
			data,
			count: page * page_content_limit, 
			sections: [{ data }]			
		}
	}).catch(err => console.log(err))
}