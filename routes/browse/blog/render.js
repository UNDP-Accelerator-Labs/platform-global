const { page_content_limit, apps_in_suite, map } = include("config/");
const { datastructures } = include("routes/helpers/");

const fetch = require("node-fetch");
const filterpage = require("../pads/filter.js").main;

exports.main = async (req, res) => {
  const { BLOG_API_URL, BLOG_API_SECRET } = process.env;
  const [ f_space, order, page, full_filters ] = await filterpage(req, res)

  let { mscale, source, search, country, type } = req.query || {};
  if (!source || !apps_in_suite.some((d) => d.key === source))
    source = apps_in_suite[0].key;

  const queryString = datastructures.constructQueryString({ search, country, type });
  const endpoint = `${BLOG_API_URL}/v2/api/blog/${page_content_limit}/${page}?${queryString}`;

  let metadata;

  const data = await fetch(endpoint, {
    method: "get",
    headers: {
      "Content-Type": "application/json",
      "token-authorization": BLOG_API_SECRET,
    },
  })
    .then(async (response) => {
      const results = await response.json();
      metadata = await datastructures.pagemetadata({
        req,
        res,
        page,
        pagecount: +results[1]["total_pages"] || 1,
        map,
        mscale,
        source,
        display: "blog",
      });

      if (!metadata?.metadata?.page?.query["search"]) {
        metadata.metadata.page.query.search = "";
      }

      return results;
    })
    .catch((err) => console.log(err));

  res.render(
    "browse/blogs/",
    Object.assign(metadata, { data, clusters: [data?.[2]?.["geoData"]] || [] })
  );
};
