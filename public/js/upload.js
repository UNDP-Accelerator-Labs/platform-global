function uploadPDF (form, lang = 'en') {
	const ellipsis = d3.select('.media-layout').addElems('div', 'lds-ellipsis')
	ellipsis.addElem('div')
	ellipsis.addElem('div')
	ellipsis.addElem('div')
	ellipsis.addElem('div')

	console.log('uploading pdf')
	console.log((form))

	fetch(form.action, {
		method: form.method,
		body: new FormData(form)
	}).then(res => res.json())
	.then(json => {
		ellipsis.remove()
		return json
	}).then(files => {
		const errs = files.filter(d => d.status !== 200)
		if (errs.length) console.log(errs)
		else return location.reload()
	}).catch(err => { if (err) throw err })
}