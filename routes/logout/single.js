const { DB } = include("config/");
const { sessionupdate } = include('routes/helpers')

module.exports = async (req, res) => {
  const { sessionID: sid } = req || {};
  await DB.general.tx(async (t) => {
	await sessionupdate({
        conn: t,
        queryValues: [sid],
        whereClause: `sid = $1`,
      });
  });
  res.redirect("/");
};
