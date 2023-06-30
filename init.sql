CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE EXTENSION IF NOT EXISTS dblink;
CREATE EXTENSION IF NOT EXISTS postgis;

-- CREATE TABLE contributors (
-- 	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
-- 	name VARCHAR(99),
-- 	position VARCHAR(99),
-- 	country VARCHAR(99),
-- 	email VARCHAR(99) UNIQUE,
-- 	password VARCHAR(99) NOT NULL,
-- 	uuid uuid UNIQUE DEFAULT uuid_generate_v4(),
-- 	rights SMALLINT DEFAULT 0,
-- 	lang VARCHAR(9) DEFAULT 'en'
-- );
-- CREATE TABLE centerpoints (
-- 	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
-- 	country VARCHAR(99),
-- 	lat DOUBLE PRECISION,
-- 	lng DOUBLE PRECISION
-- );
CREATE TABLE templates (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	medium VARCHAR(9),
	title VARCHAR(99),
	description TEXT,
	sections JSONB,
	full_text TEXT,
	language VARCHAR(9),
	status INT DEFAULT 0,
	"date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	"update_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	-- contributor INT REFERENCES contributors(id) ON UPDATE CASCADE ON DELETE CASCADE,
	owner uuid,
	-- published BOOLEAN DEFAULT FALSE,
	source INT REFERENCES templates(id) ON UPDATE CASCADE ON DELETE CASCADE,
	slideshow BOOLEAN DEFAULT FALSE,
	imported BOOLEAN DEFAULT FALSE
);
CREATE TABLE pads (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	title VARCHAR(99),
	sections JSONB,
	full_text TEXT,
	-- location JSONB,
	-- sdgs JSONB,
	-- tags JSONB,
	-- impact SMALLINT,
	-- personas JSONB,
	status INT DEFAULT 0,
	"date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	"update_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	-- contributor INT REFERENCES contributors(id) ON UPDATE CASCADE ON DELETE CASCADE,
	owner uuid,
	template INT REFERENCES templates(id) DEFAULT NULL,
	-- published BOOLEAN DEFAULT FALSE,
	source INT REFERENCES pads(id) ON UPDATE CASCADE ON DELETE CASCADE
	-- review_status INT DEFAULT 0
);
CREATE TABLE files (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	name VARCHAR(99),
	path TEXT,
	vignette TEXT,
	full_text TEXT,
	-- location JSONB,
	sdgs JSONB,
	tags JSONB,
	status INT DEFAULT 1,
	"date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	"update_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	-- contributor INT REFERENCES contributors(id) ON UPDATE CASCADE ON DELETE CASCADE,
	owner uuid,
	published BOOLEAN DEFAULT FALSE,
	source INT REFERENCES pads(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE TABLE locations (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	pad INT REFERENCES pads(id) ON UPDATE CASCADE ON DELETE CASCADE,
	lat DOUBLE PRECISION,
	lng DOUBLE PRECISION
);
ALTER TABLE locations ADD CONSTRAINT unique_pad_lnglat UNIQUE (pad, lng, lat);
-- CREATE TABLE skills (
-- 	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
-- 	category VARCHAR(99),
-- 	name VARCHAR(99),
-- 	label VARCHAR(99),
--	language VARCHAR(9) DEFAULT 'en'
-- );
-- CREATE TABLE methods (
-- 	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
-- 	name VARCHAR(99),
-- 	label VARCHAR(99),
--	language VARCHAR(9) DEFAULT 'en'
-- );
-- CREATE TABLE datasources (
-- 	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
-- 	name CITEXT UNIQUE,
-- 	description VARCHAR(99),
-- 	contributor INT,
--	language VARCHAR(9) DEFAULT 'en'
-- );
-- CREATE TABLE tags (
-- 	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
--	key INT,
-- 	name CITEXT,
-- 	description TEXT,
-- 	contributor uuid,
--	type VARCHAR(19)
--	language VARCHAR(9) DEFAULT 'en'
-- );
--	ALTER TABLE tags ADD CONSTRAINT name_type UNIQUE (name, type);
CREATE TABLE cohorts (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	-- source INT REFERENCES contributors(id) ON UPDATE CASCADE ON DELETE CASCADE,
	-- target INT REFERENCES contributors(id) ON UPDATE CASCADE ON DELETE CASCADE
	host uuid,
	contributor uuid
);
ALTER TABLE cohorts ADD CONSTRAINT unique_host_contributor UNIQUE (host, contributor);

CREATE TABLE mobilizations (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	title VARCHAR(99),
	-- host INT REFERENCES contributors(id) ON UPDATE CASCADE ON DELETE CASCADE,
	owner uuid,
	template INT REFERENCES templates(id) ON UPDATE CASCADE ON DELETE CASCADE,
	status INT DEFAULT 1, 
	public BOOLEAN DEFAULT FALSE,
	start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	end_date TIMESTAMPTZ,
	source INT REFERENCES mobilizations(id) ON UPDATE CASCADE ON DELETE CASCADE,
	copy BOOLEAN DEFAULT FALSE,
	child BOOLEAN DEFAULT FALSE,
	pad_limit INT DEFAULT 1,
	description TEXT,
	language VARCHAR(9)
);
CREATE TABLE mobilization_contributors (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	-- contributor INT REFERENCES contributors(id) ON UPDATE CASCADE ON DELETE CASCADE,
	participant uuid,
	mobilization INT REFERENCES mobilizations(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE TABLE mobilization_contributions (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	pad INT REFERENCES pads(id) ON UPDATE CASCADE ON DELETE CASCADE,
	mobilization INT REFERENCES mobilizations(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE pinboards (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	title VARCHAR(99),
	description TEXT,
	owner uuid,
	status INT DEFAULT 0,
	display_filters BOOLEAN DEFAULT FALSE,
	display_map BOOLEAN DEFAULT FALSE,
	display_fullscreen BOOLEAN DEFAULT FALSE,
	slideshow BOOLEAN DEFAULT FALSE,
	"date" TIMESTAMPTZ NOT NULL DEFAULT NOW()
	-- mobilization INT REFERENCES mobilizations(id) ON UPDATE CASCADE ON DELETE CASCADE -- THIS IS TO CONNECT A PINBOARD DIRECTLY TO A MOBILIZATION
);
ALTER TABLE pinboards ADD CONSTRAINT unique_pinboard_owner UNIQUE (title, owner);

CREATE TABLE pinboard_contributors (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	-- contributor INT REFERENCES contributors(id) ON UPDATE CASCADE ON DELETE CASCADE,
	participant uuid,
	pinboard INT REFERENCES pinboards(id) ON UPDATE CASCADE ON DELETE CASCADE	
);
ALTER TABLE pinboard_contributors ADD CONSTRAINT unique_pinboard_contributor UNIQUE (participant, pinboard);

CREATE TABLE pinboard_contributions (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	pad INT,
	source VARCHAR(99),
	pinboard INT REFERENCES pinboards(id) ON UPDATE CASCADE ON DELETE CASCADE
);
ALTER TABLE pinboard_contributions ADD CONSTRAINT unique_pad_pinboard UNIQUE (pad, source, pinboard);

CREATE TABLE tagging (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	pad INT REFERENCES pads(id) ON UPDATE CASCADE ON DELETE CASCADE,
	tag_id INT NOT NULL,
	-- tag_name TEXT NOT NULL,
	type VARCHAR(19)
);
ALTER TABLE tagging ADD CONSTRAINT unique_pad_tag_type UNIQUE (pad, tag_id, type);

CREATE TABLE metafields (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	pad INT REFERENCES pads(id) ON UPDATE CASCADE ON DELETE CASCADE,
	type VARCHAR(19),
	name CITEXT,
	key INT,
	value TEXT,
	CONSTRAINT pad_value_type UNIQUE (pad, value, type)
);

-- TO DO
-- CREATE TABLE engagement_pads (
CREATE TABLE engagement (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	-- contributor INT REFERENCES contributors(id) ON UPDATE CASCADE ON DELETE CASCADE,
	contributor uuid,
	-- pad INT REFERENCES pads(id) ON UPDATE CASCADE ON DELETE CASCADE,
	doctype VARCHAR(19),
	docid INT,
	type VARCHAR(19),
	date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	-- message TEXT,
	CONSTRAINT unique_engagement UNIQUE (contributor, doctype, docid, type)
);
CREATE TABLE comments (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	contributor uuid,
	doctype VARCHAR(19),
	docid INT,
	date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	message TEXT,
	source INT REFERENCES comments(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE TABLE review_templates (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	template INT REFERENCES templates(id) NOT NULL,
	language VARCHAR(9) UNIQUE
);
-- CREATE TABLE review_pads (
-- 	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
-- 	pad INT REFERENCES pad(id) NOT NULL,
-- );
CREATE TABLE review_requests (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	pad INT UNIQUE REFERENCES pads(id) NOT NULL,
	language VARCHAR(9),
	status INT DEFAULT 0,
	"date" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE reviewer_pool (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	reviewer uuid,
	request INT REFERENCES review_requests(id) ON UPDATE CASCADE ON DELETE CASCADE,
	rank INT DEFAULT 0,
	status INT DEFAULT 0,
	invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT unique_reviewer_pad UNIQUE (reviewer, request)
);
CREATE TABLE reviews (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	pad INT REFERENCES pads(id) ON UPDATE CASCADE ON DELETE CASCADE,
	review INT REFERENCES pads(id) ON UPDATE CASCADE ON DELETE CASCADE,
	reviewer uuid,
	status INT DEFAULT 0
	-- CONSTRAINT unique_reviewer UNIQUE (pad, reviewer)
);

CREATE TABLE "session" (
 	"sid" varchar NOT NULL COLLATE "default",
	"sess" json NOT NULL,
	"expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "IDX_session_expire" ON "session" ("expire");