const { fetcher } = include("routes/helpers/");
const { modules, DB, apps_in_suite } = include('config/')

exports.pin = (req, res) => {
	const { object_id,  } = req.body || {}
	// THE SOURCE IS PASSED IN THE object_id

	let { source } = req.query || {};
  	if (!source || !apps_in_suite.some((d) => d.key === source))
    source = apps_in_suite[0].key;
	let baseurl = DB.conns.find((d) => d.key === source).baseurl;

	if(object_id.source){
		baseurl = DB.conns.find((d) => d.key === object_id.source).baseurl;
		req.body.object_id = object_id.id
	}
	else if( Array.isArray(object_id)){
		req.body.object_id = object_id.map(p => p.id)
	}

	const url = `${baseurl}/apis/fetch/pin`;

	fetcher(req, url, "POST", req.body)
	.then(result=> res.json(result))
	.catch(err => res.redirect('/module-error'))

}

