 exports.statsQuery = `
 SELECT
 (SELECT COUNT(DISTINCT iso3) FROM countries WHERE has_lab = true) AS lab_count,
 (SELECT COUNT(DISTINCT iso3) FROM countries) AS country_count,
 (SELECT COUNT(*) FROM pinboards) AS pinboard_count;
`
exports.pinboad_list =`
    SELECT pb.id, pb.title, pb.date, pb.owner, db.url_prefix,
        CASE WHEN EXISTS (
            SELECT 1 FROM exploration WHERE linked_pinboard = pb.id
        ) THEN TRUE ELSE FALSE END AS is_exploration,
        distinct_contributions.count
    FROM pinboards pb
    INNER JOIN (
        SELECT pc.pinboard, pc.db, COUNT(*) AS count
        FROM pinboard_contributions pc
        GROUP BY pc.pinboard, pc.db
    ) AS distinct_contributions
    ON distinct_contributions.pinboard = pb.id
    INNER JOIN extern_db db
    ON distinct_contributions.db = db.id
    WHERE pb.status > 2;
;`
