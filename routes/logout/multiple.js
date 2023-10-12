const { app_title, DB } = include("config/");
const { sessionupdate } = include("routes/helpers/");

module.exports = async (req, res) => {
  const { referer } = req.headers || {};
  let { app } = req.body || {};
  const { uuid, is_trusted } = req.session || {};

  const referer_url = new URL(referer);
  const referer_params = new URLSearchParams(referer_url.search);

  const trust_device = app.includes("(on trusted device)") ? "true" : "false";
  app = app.split(" (")[0];

  await DB.general.tx(async (t) => {
    if (!is_trusted)
      referer_params.set(
        "u_errormessage",
        "This action can only be authorized on trusted devices."
      );
    if (!app && is_trusted) {
      // REMOVE ALL UNLABELED SESSIONS
      await sessionupdate({
        conn: t,
        queryValues: [uuid],
        whereClause: `sess ->> 'uuid' = $1 AND sess ->> 'app' IS NULL`,
      });
    } else if (app.toLowerCase() === "all" && is_trusted) {
      await sessionupdate({
        conn: t,
        queryValues: [uuid],
        whereClause: `sess ->> 'uuid' = $1`,
      });
    } else if (is_trusted) {
      await sessionupdate({
        conn: t,
        queryValues: [uuid, app, trust_device],
        whereClause: `sess ->> 'uuid' = $1 AND sess ->> 'app' = $2 AND sess -> 'device' ->> 'is_trusted' = $3`,
      });
    }
  });
  if (app === app_title && is_trusted) res.redirect("/");
  else res.redirect(`${referer_url.pathname}?${referer_params.toString()}`);
};
