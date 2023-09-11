const { page_content_limit, apps_in_suite, map, welcome_module, DB } =
  include("config/");
const { array, datastructures, fetcher, checklanguage } =
  include("routes/helpers/");

const filter = require("./filter.js");

exports.main = async (req, res) => {
  
  let { mscale, display, pinboard, source } = req.query || {};
  if (!source || !apps_in_suite.some((d) => d.key === source))
    source = apps_in_suite[0].key;
  
  const path = req.path.substring(1).split("/");
  const activity = path[1];
  const language = checklanguage(req.params?.language || req.session.language);

  const filters = await filter.body(req, res);
  const [f_space, order, page, full_filters] = await filter.main(req, res);

  let aggr_data,
    global_info,
    pinboards_list = [],
    uniqueboard = null;

  const baseurl = DB.conns.find((d) => d.key === source).baseurl;
  try {
    const url = `${baseurl}/apis/fetch/global`;
    const responses = await fetcher(req, url, "POST", {
      filters,
    });

    let max = 10;
    if (welcome_module === "mosaic") max = 46;
    if (responses) {
      if (Array.isArray(responses[4])) {
        responses[4] = responses[4].filter((d) => d?.img?.length).slice(0, max);
      }
    }

    let [data, filters_menu, statistics, clusters, sample_images] = responses;

    const { sections } = data;
    const updatedSections = sections?.map((section) => {
      const updatedData = section?.data?.map((dataObject) => ({
        ...dataObject,
        link: `${baseurl}/${language}/view/pad?id=${dataObject?.id}`,
      }));

      return { ...section, data: updatedData };
    });

    const stats = {
      total: array.sum.call(statistics.total, "count"),
      filtered: array.sum.call(statistics.filtered, "count"),

      private: statistics.private,
      curated: statistics.curated,
      shared: statistics.shared,
      reviewing: statistics.reviewing,
      public: statistics.public,

      displayed: data.count,
      breakdown: statistics.filtered,
      persistent_breakdown: statistics.persistent,
      contributors: statistics.contributors,
      tags: statistics.tags,
    };

    const metadata = await datastructures.pagemetadata({
      req,
      res,
      page,
      pagecount: Math.ceil((stats.filtered || 0) / page_content_limit),
      map,
      mscale,
      source,
    });

    aggr_data = Object.assign(metadata, {
      sections: updatedSections,
      clusters,
      sample_images,
      stats,
      filters_menu,
    });
  } catch (err) {
    console.log("An error occoured ", err);
    return res.redirect('/module-error')
  }

  try {
    const global_urls = DB.conns
      .map((d) => [
        {
          key: d.key,
          url: `${d.baseurl}/apis/fetch/global-data`,
        },
      ])
      .flat();

    const global_requests = global_urls.map((url) =>
      fetcher(req, url.url, "POST", { filters })
        .then((results) => ({
          ...results,
          key: url.key,
        }))
        .catch((err) => console.log(err))
    );

    global_info = await Promise.all(global_requests)
      .then((results) => {
        const global_info = {};
        global_info.statistics = results;
        global_info.pads = results.map((d) => d.pads).flat();
        global_info.filtered = array.sum.call(
          results.map((d) => d.stats),
          "filtered"
        );
        global_info.shared = array.sum.call(
          results.map((d) => d.stats),
          "shared"
        );
        global_info.public = array.sum.call(
          results.map((d) => d.stats),
          "public"
        );

        function mergeObjValues(arr) {
          if (arr?.length) {
            const allkeys = arr.map((d) => Object.keys(d)).flat();
            const commonkeys = array.unique
              .call(allkeys)
              .reduce((accumulator, value) => {
                if (allkeys.filter((d) => d === value).length >= 2)
                  accumulator.push(value);
                return accumulator;
              }, []);
            const uniquekeys = array.unique
              .call(allkeys)
              .reduce((accumulator, value) => {
                if (allkeys.filter((d) => d === value).length === 1)
                  accumulator.push(value);
                return accumulator;
              }, []);

            const obj = {};
            commonkeys.forEach((d) => {
              const values = arr
                .map((c) => c[d])
                .filter((c) => c)
                .flat();

              const usekey = values.every(
                (c) => ![null, undefined].includes(c.key)
              );
              obj[d] = [];
              values.forEach((c) => {
                const preventry = obj[d].find((b) =>
                  usekey ? b.key === c.key : b.id === c.id
                );
                if (preventry) preventry.count += c.count;
                else obj[d].push(c);
              });
              if (usekey) obj[d].sort((a, b) => a.key - b.key);
              else obj[d].sort((a, b) => a.name.localeCompare(b.name));
            });

            uniquekeys.forEach((d) => {
              obj[d] = arr.find((c) => c[d])[d];
            });

            return obj;
          } else return null;
        }
        global_info.filters_menu = new Array(
          Math.max(...results.map((d) => d.filters_menu.length))
        )
          .fill(0)
          .map((d, i) =>
            mergeObjValues(
              results.map((c) => c.filters_menu[i]).filter((c) => c)
            )
          );

        return global_info;
      })
      .catch((err) => {
        console.log(err);
        return null;
      });

    aggr_data.metadata.page.display =
      uniqueboard?.slideshow &&
      (!uniqueboard?.editable || activity === "preview")
        ? "slideshow"
        : display;
  } catch (err) {
    console.log("An error occurred ", err);
    return res.redirect('/module-error')
  }

  res.render(
    "browse/",
    Object.assign(aggr_data, {
      global_info,
      pinboards_list,
      pinboard: uniqueboard,
    })
  );
};
