const { page_content_limit, modules, DB } = include('config/')
const { checklanguage, datastructures, parsers, join } = include('routes/helpers/')

const filter = require('../filter').main

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	const { req } = kwargs || {}
	const { object, space } = req.params || {}
	const { uuid, rights, collaborators } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)

	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req)
	
	const module_rights = modules.find(d => d.type === object)?.rights
	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
	if (!collaborators_ids.length) collaborators_ids = [ uuid ]

	return conn.any(`
		SELECT p.id, p.owner, p.title, p.sections, p.template, 
			t.title AS template_title,

		-- GET DATE
			CASE
				WHEN AGE(now(), p.date) < '0 second'::interval
					THEN jsonb_build_object('interval', 'positive', 'date', to_char(p.date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(p.date, now())), 'hours', EXTRACT(hour FROM AGE(p.date, now())), 'days', EXTRACT(day FROM AGE(p.date, now())), 'months', EXTRACT(month FROM AGE(p.date, now())))
				ELSE jsonb_build_object('interval', 'negative', 'date', to_char(p.date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(now(), p.date)), 'hours', EXTRACT(hour FROM AGE(now(), p.date)), 'days', EXTRACT(day FROM AGE(now(), p.date)), 'months', EXTRACT(month FROM AGE(now(), p.date)))
			END AS date,


			-- CASE WHEN AGE(now(), p.date) < '1 hour'::interval
			-- 		THEN EXTRACT(minute FROM AGE(now(), p.date))::text || ' minutes ago'
			-- 	WHEN AGE(now(), p.date) < '1 day'::interval
			-- 		THEN EXTRACT(hour FROM AGE(now(), p.date))::text || ' hours ago'
			-- 	WHEN AGE(now(), p.date) < '1 month'::interval
			-- 		THEN EXTRACT(day FROM AGE(now(), p.date))::text || ' days ago'
			-- 	ELSE to_char(p.date, 'DD Mon YYYY')
			-- END AS date,

		-- GET STATUS
			COALESCE((SELECT status FROM reviews WHERE (review = p.id OR pad = p.id) AND reviewer = $1), -1) AS status,
			
		-- DETERMINE IF REVIEWER IS POOLED
			CASE WHEN $1 IN (
				SELECT reviewer FROM reviewer_pool 
				WHERE request IN (
					SELECT id FROM review_requests 
					WHERE pad = p.id
				)
			) OR $1 IN (SELECT reviewer FROM reviews WHERE review = p.id)
				THEN TRUE
				ELSE FALSE
			END AS reviewer_pooled,

		-- DETERMINE IF REVIEW
			CASE WHEN p.id IN (SELECT review FROM reviews WHERE reviewer = $1)
				THEN TRUE
				ELSE FALSE
			END AS is_review,

		-- GET SOURCE PAD IF REVIEW
			CASE WHEN p.id IN (SELECT review FROM reviews WHERE reviewer = $1)
				THEN p.source
				ELSE NULL
			END AS source,

		-- GET SOURCE TITLE IF REVIEW
			CASE WHEN p.id IN (SELECT review FROM reviews WHERE reviewer = $1)
				THEN (SELECT p2.title FROM pads p2 WHERE p2.id = p.source) 
				ELSE NULL
			END AS source_title,

		-- GET REVIEW TEMPLATE
			CASE 
			-- REVIEW HAS BEEN ACCEPTED
			WHEN p.id IN (SELECT review FROM reviews WHERE reviewer = $1) 
				THEN p.template
			-- REVIEW HAS NOT BEEN ACCEPTED
				ELSE (
					SELECT DISTINCT (template) FROM review_templates
					WHERE language IN (
						SELECT language FROM review_requests WHERE pad = p.id
					)
				)
			END AS review_template,

		-- COUNT ACTIVE REVIEWERS
			CASE WHEN p.id IN (SELECT review FROM reviews WHERE reviewer = $1)
				THEN COALESCE((SELECT COUNT (id)::INT
					FROM reviewer_pool 
					WHERE status = 1 
						AND request IN (SELECT id FROM review_requests WHERE pad = p.source))
				, 0) 
				ELSE COALESCE((SELECT COUNT (id)::INT
					FROM reviewer_pool 
					WHERE status = 1 
						AND request IN (SELECT id FROM review_requests WHERE pad = p.id))
				, 0)
			END AS reviewers,

		-- COUNT REMAINING AVAILABLE REVIEWERS IN POOL
			CASE WHEN p.id IN (SELECT review FROM reviews WHERE reviewer = $1)
				THEN COALESCE((SELECT COUNT (id)::INT 
					FROM reviewer_pool 
					WHERE status = 0
						AND request IN (SELECT id FROM review_requests WHERE pad = p.source))
				, 0)
				ELSE COALESCE((SELECT COUNT (id)::INT 
					FROM reviewer_pool 
					WHERE status = 0
						AND request IN (SELECT id FROM review_requests WHERE pad = p.id))
				, 0)
			END AS available_reviewers,

		-- DETERMINE IF REVIEW IS REQUIRED (BASED ON NUMBER OF AVAILABLE REVIEWERS IN POOL)
			CASE WHEN p.id IN (SELECT review FROM reviews WHERE reviewer = $1)
				THEN TRUE
				ELSE COALESCE((SELECT COUNT (id)::INT 
					FROM reviewer_pool 
					WHERE status = 0
						AND request IN (SELECT id FROM review_requests WHERE pad = p.id))
				, 0) <= $3
			END AS required,

		-- GET PUBLISHED REVIEWS FOR PADS THAT ARE NOT REVIEWS
			COALESCE (
				(SELECT jsonb_agg(id) FROM pads 
				WHERE id IN (SELECT review FROM reviews) 
					AND source = p.id
					AND status >= 2
				GROUP BY source
			)::TEXT, '[]')::JSONB AS reviews,
			
			CASE WHEN p.owner IN ($2:csv)
					THEN TRUE
					ELSE FALSE
				END AS editable
		
		FROM pads p

		LEFT JOIN templates t
			ON t.id = p.template

		WHERE TRUE
			$5:raw 
		
		$6:raw
		LIMIT $7 OFFSET $8
	;`, [ 
		/* $1 */ uuid,
		/* $2 */ collaborators_ids, 
		/* $3 */ modules.find(d => d.type === 'reviews').reviewers,
		/* $4 */ rights, 
		/* $5 */ full_filters, 
		/* $6 */ order, 
		/* $7 */ page_content_limit, 
		/* $8 */ (page - 1) * page_content_limit
	]).then(async results => {
		// REMOVE THE follow_ups AND forwards FOR PADS THAT HAVE ALREADY BEEN FOLLOWED UP FOR A GIVEN MOBILIZATION
		results.forEach(d => {
			d.img = parsers.getImg(d)
			d.sdgs = parsers.getSDGs(d)
			d.tags = parsers.getTags(d)
			d.txt = parsers.getTxt(d)
			delete d.sections // WE DO NOT NEED TO SEND ALL THE DATA (JSON PAD STRUCTURE) AS WE HAVE EXTRACTED THE NECESSARY INFO ABOVE
		})

		const data = await join.users(results.flat(), [ language, 'owner' ])
		return { 
			data,
			count: page_content_limit, 
			sections: [{ data }]
		}
	}).catch(err => console.log(err))
}