const {
    page_content_limit,
    apps_in_suite,
    modules,
    metafields,
    engagementtypes,
    lazyload,
    map,
    browse_display,
    welcome_module,
    DB,
  } = include("config/");
  const { array, datastructures, checklanguage, fetcher, join, parsers } =
    include("routes/helpers/");
  
  const filter = require("./filter.js").main;
  
  exports.main = async (req, res) => {
    let { mscale, display, pinboard, source } = req.query || {};
    if (!source || !apps_in_suite.some((d) => d.key === source))
      source = apps_in_suite[0].key;
    const { object, instance } = req.params || {};
    const path = req.path.substring(1).split("/");
    const activity = path[1];
    if (instance) pinboard = res.locals.instance_vars?.pinboard;
  
    // GET FILTERS
    const [f_space, order, page, full_filters] = await filter(req, res);
    const baseurl = DB.conns.find((d) => d.key === source).baseurl;
    let { search } = req.query || {};
  
    const queryString = datastructures.constructQueryString({ search, full_filters });
  
    const urls = [
      `${baseurl}/apis/fetch/pads-data?${queryString}`,
      `${baseurl}/apis/fetch/menu-filters?${queryString}`,
      `${baseurl}/apis/fetch/statistics?${queryString}`,
      `${baseurl}/apis/fetch/map-data?${queryString}`,
      `${baseurl}/apis/fetch/pinboard-list?${queryString}`,
    ];
  
    const requests = urls.map((url) => fetcher(req, url));
    const responses = await Promise.all(requests);
  
    let max = 10;
    if (welcome_module === "mosaic") max = 46;
    responses[4] = await responses[4].filter((d) => d.img?.length).slice(0, max);
  
    let [data, filters_menu, statistics, clusters, sample_images] = responses;
  
    const { sections } = data;
    const stats = {
      total: statistics.total,
      filtered: statistics.filtered,
  
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
    let aggr_data = Object.assign(metadata, {
      sections,
      clusters,
      sample_images,
      stats,
      filters_menu,
    });
  
    const global_urls = DB.conns
      .map((d) => [
        {
          key: d.key,
          url: `${d.baseurl}/apis/fetch/global-data?full_filters=${full_filters}`,
        },
      ])
      .flat();
  
    const global_requests = global_urls.map((url) =>
      fetcher(req, url.url)
        .then((results) => ({
          ...results,
          key: url.key,
        }))
        .catch((err) => console.log(err))
    );
  
    const global_info = await Promise.all(global_requests)
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
            mergeObjValues(results.map((c) => c.filters_menu[i]).filter((c) => c))
          );
  
        return global_info;
      })
      .catch((err) => console.log(err));
  
    const pinboards_list = [];
    const uniqueboard = null;
  
    aggr_data.metadata.page.display =
      uniqueboard?.slideshow && (!uniqueboard?.editable || activity === "preview")
        ? "slideshow"
        : display;
  
    res.render(
      "browse/",
      Object.assign(aggr_data, {
        global_info,
        pinboards_list,
        pinboard: uniqueboard,
      })
    );
  };
  