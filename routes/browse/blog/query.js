// Retrieve aggregate data from the database
const { page_content_limit } = include('config/')
const { parsers } = include('routes/helpers/')

const theWhereClause = (country, type )=> {
  let whereClause = '';
  
    if (country) {
      if (Array.isArray(country) && country.length > 0) {
        whereClause += ` AND country IN ('${country.join("','")}')`;
      } else if (typeof country === 'string') {
        whereClause += ` AND country = '${country}'`;
      }
    }
    
    if (type) {
      if (Array.isArray(type) && type.length > 0) {
        whereClause += ` AND article_type IN ('${type.join("','")}')`;
      } else if (typeof type === 'string') {
        whereClause += ` AND article_type = '${type}'`;
      }
    }
    

    return whereClause;
}

exports.blogAggQuery =`
    SELECT COUNT(*) AS totalBlogs
    FROM articles
    WHERE has_lab IS TRUE
;`;

exports.totalArticleTyle = `
    SELECT COUNT(DISTINCT article_type) AS totalArticleTypes
    FROM articles;
`

exports. totalCountries = `
    SELECT COUNT(DISTINCT country) AS totalCountries
    FROM articles WHERE has_lab IS TRUE;
`

exports.totalUnknownCountries = `
    SELECT COUNT(*) AS totalUnknownCountries
    FROM articles
    WHERE country IS NULL;
`

exports.searchBlogQuery = (searchText, page, country, type) => {
  let whereClause = theWhereClause(country, type);
  let values = [
    page_content_limit,
    (page - 1) * page_content_limit,
    page,
  ];
  const search = searchText ? parsers.regexQuery(searchText) : '';
  let searchTextCondition = '';

  if (searchText !== null && searchText !== undefined && searchText.length > 0) {
    searchTextCondition = `
      AND (title ~* ('\\m' || $3 || '\\M')
        OR content ~* ('\\m' || $3 || '\\M')
        OR all_html_content ~* ('\\m' || $3 || '\\M')
        OR country ~* ('\\m' || $3 || '\\M'))
    `;
    values.splice(2, 0, search);
  } else {
    searchTextCondition = `
      AND (article_type = 'blog' 
        AND content IS NOT NULL
        AND title IS NOT NULL)
    `;
    values.splice(2, 0, '');
  }

  return {
    text: `
      WITH search_results AS (
        SELECT id, url, country, article_type, title, posted_date, posted_date_str, language, created_at,
        CASE
          WHEN $3 = '' THEN (
            SELECT string_agg(substring(sentence, '(.*' || $3 || '.*)'), ' ')
            FROM (
              SELECT unnest(string_to_array(content, '.')) AS sentence
              OFFSET 1 LIMIT 2
            ) sub
          )
          WHEN content ~* $3  THEN (
            SELECT string_agg(substring(sentence, '(.*' || '.' || '.*)'), ' ')
            FROM (
              SELECT unnest(string_to_array(content, '.')) AS sentence
            ) sub
            WHERE sentence ~* $3 
          )
          WHEN all_html_content ~* $3 THEN (
            SELECT string_agg(substring(sentence, '(.*' || '.' || '.*)'), ' ')
            FROM (
              SELECT unnest(string_to_array(all_html_content, '.')) AS sentence
            ) sub
            WHERE sentence ~* $3 
          )
        END AS matched_texts
        FROM articles
        WHERE has_lab IS TRUE
        ${searchTextCondition}
        ${whereClause}
        ORDER BY posted_date DESC
        LIMIT $1 OFFSET $2
      ),
      total_count AS (
        SELECT COUNT(*) AS total_records
        FROM articles
        WHERE has_lab IS TRUE
        ${searchTextCondition}
        ${whereClause}
      )
      SELECT sr.*, tc.total_records, (CEIL(tc.total_records::numeric / $1)) AS total_pages, ${searchTextCondition ? '$4' : '$3'}  AS current_page
      FROM search_results sr
      CROSS JOIN total_count tc;
    `,
    values,
  };
};

exports.articleGroup = (searchText, country, type) => {
  let whereClause = theWhereClause(country, type);
  const search = searchText ? parsers.regexQuery(searchText) : '';
  let searchTextCondition = '';
  const values = [];
  if (searchText !== null && searchText !== undefined && searchText.length > 0) {
    searchTextCondition = `
      AND (title ~* ('\\m' || $1 || '\\M')
        OR content ~* ('\\m' || $1 || '\\M')
        OR country ~* ('\\m' || $1 || '\\M'))
    `;
    
    values.push(search);
  }

  return {
    text: `
      SELECT article_type, COUNT(*) AS recordCount
      FROM articles
      WHERE has_lab IS TRUE
        ${searchTextCondition}
        ${whereClause}
      GROUP BY article_type;
    `,
    values,
  };
};
exports.countryGroup = (searchText, country, type) => {
  let whereClause = theWhereClause(country, type);
  const search = searchText ? parsers.regexQuery(searchText) : '';
  let searchTextCondition = '';
  const values = [];
  if (searchText !== null && searchText !== undefined && searchText.length > 0) {
    searchTextCondition = `
      AND (title ~* ('\\m' || $1 || '\\M')
        OR content ~* ('\\m' || $1 || '\\M')
        OR all_html_content ~* ('\\m' || $1 || '\\M')
        OR country ~* ('\\m' || $1 || '\\M'))
    `;
    
    values.push(search);
  }

  return {
    text: `
      SELECT country, iso3, COUNT(*) AS recordCount
      FROM articles
      WHERE has_lab IS TRUE
        ${searchTextCondition}
        ${whereClause}
      GROUP BY country, iso3;
    `,
    values,
  };
};

  exports.statsQuery = (searchText, country, type) => {
    let whereClause = theWhereClause(country, type);
    const search = searchText ? parsers.regexQuery(searchText) : '';
    let searchTextCondition = '';
    const values = [];
    if (searchText !== null && searchText !== undefined && searchText.length > 0) {
      searchTextCondition = `
        AND (title ~* ('\\m' || $1 || '\\M')
          OR content ~* ('\\m' || $1 || '\\M')
          OR all_html_content ~* ('\\m' || $1 || '\\M')
          OR country ~* ('\\m' || $1 || '\\M'))
      `;
      
      values.push(search);
    }

    return {
      text: `
        WITH search_results AS (
          SELECT id, url, content, country, article_type, title, posted_date, posted_date_str, created_at, has_lab, iso3
          FROM articles
          WHERE has_lab IS TRUE
            ${searchTextCondition}
            ${whereClause}
        ),
        total_country_count AS (
          SELECT country, COUNT(*) AS count
          FROM search_results
          WHERE country IS NOT NULL AND has_lab IS TRUE
          GROUP BY country
        ),
        total_null_country_count AS (
          SELECT COUNT(*) AS count
          FROM search_results
          WHERE country IS NULL AND has_lab IS TRUE
        ),
        total_article_type_count AS (
          SELECT article_type, COUNT(*) AS count
          FROM search_results
          GROUP BY article_type
        ),
        total_count AS (
          SELECT COUNT(*) AS total_records
          FROM search_results
          WHERE has_lab IS TRUE
        )
        SELECT 
          (SELECT COUNT(DISTINCT country) FROM total_country_count) AS distinct_country_count,
          (SELECT count FROM total_null_country_count) AS null_country_count,
          (SELECT COUNT(DISTINCT article_type) FROM total_article_type_count) AS distinct_article_type_count,
          (SELECT total_records FROM total_count) AS total_records;
      `,
      values,
    };
  };
  
  exports.extractGeoQuery = (searchText, country, type) => {
    let whereClause = theWhereClause(country, type);
    const search = searchText ? parsers.regexQuery(searchText) : '';
    let searchTextCondition = '';
    const values = [];
    if (searchText !== null && searchText !== undefined && searchText.length > 0) {
      searchTextCondition = `
        AND (title ~* ('\\m' || $1 || '\\M')
          OR content ~* ('\\m' || $1 || '\\M')
          OR all_html_content ~* ('\\m' || $1 || '\\M')
          OR country ~* ('\\m' || $1 || '\\M'))
      `;
      
      values.push(search);
    }

    return {
      text: `
        WITH search_results AS (
          SELECT *
          FROM articles
          WHERE has_lab IS TRUE
          ${searchTextCondition}
          ${whereClause}
        )
        SELECT
          jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJson(ST_Centroid(ST_Collect(clusters.geo)))::jsonb,
            'properties', json_build_object(
              'pads', json_agg(clusters.cid),
              'count', COUNT(clusters.cid),
              'cid', clusters.cid
            )::jsonb
          ) AS json
        FROM (
          SELECT c.iso3 AS cid, c.has_lab, ST_Point(c.lng, c.lat) AS geo
          FROM search_results c
        ) AS clusters
        GROUP BY clusters.cid
        ORDER BY clusters.cid;
      `,
      values,
    };
  };