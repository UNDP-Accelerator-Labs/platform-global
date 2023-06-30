function getMediaSize () {
	// https://www.w3schools.com/howto/howto_js_media_queries.asp
	return [{ label: 'xs', size: 480 }, { label: 'sm', size: 768 }, { label: 'm', size: 1024 }, { label: 'lg', size: 1200 }]
	.find(d => {
		if (d.label !== 'lg') return window.matchMedia(`(max-width: ${d.size}px)`).matches
		else return window.matchMedia(`(min-width: ${d.size}px)`).matches
	})?.label
}
const jsonQueryHeader = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
function GET (_uri, _expectJSON = true) {
	return new Promise(async resolve => {
		fetch(_uri, { method: 'GET', headers: jsonQueryHeader })
			.then(response => {
				if (_expectJSON) return response.json()
				else return response
			})
			.then(results => resolve(results))
			.catch(err => { if (err) throw (err) })
	})
}
function POST (_uri, _q, _expectJSON = true) {
	return new Promise(resolve => 
		fetch(_uri, { method: 'POST', headers: jsonQueryHeader, body: JSON.stringify(_q) })
			.then(response => {
				if (_expectJSON) return response.json()
				else return response
			})
			.then(results => resolve(results))
			.catch(err => { if (err) throw (err) })
	)
}
function PUT (_uri, _q, _expectJSON = true) {
	return new Promise(resolve => 
		fetch(_uri, { method: 'PUT', headers: jsonQueryHeader, body: JSON.stringify(_q) })
			.then(response => {
				if (_expectJSON) return response.json()
				else return response
			})
			.then(results => resolve(results))
			.catch(err => { if (err) throw (err) })
	)
}
function DELETE (_uri, _q, _expectJSON = true) {
	return new Promise(resolve => 
		fetch(_uri, { method: 'DELETE', headers: jsonQueryHeader, body: JSON.stringify(_q) })
			.then(response => {
				if (_expectJSON) return response.json()
				else return response
			})
			.then(results => resolve(results))
			.catch(err => { if (err) throw (err) })
	)
}
function toggleClass (node, classname) {
	d3.select(node).classed(classname, function () { return !d3.select(this).classed(classname) })
}
function fixLabel (node) {
	d3.select(node).classed('has-value', node.value?.trim().length)
}
function multiSelection (sel, targets) {
	const body = d3.select('body')
	let sels
	let ox, oy, dx, dy, x, y = 0
	let bbox = { x: x, y: y, w: 0, h: 0 } // THIS IS TO HOLD AN INSTANCE OF THE RECTANGLE DRAWN, IN ORDER NOT TO HAVE TO USE GetClientBoundingRect

	sel.on('mousedown.multiSelect', function () {
		const evt = d3.event
		// const body = d3.select('body')
		if (!targets.constraint || (targets.constraint && targets.constraint(evt))) {
			body.classed('select', true)
			ox = x = evt.x || evt.clientX
			oy = y = evt.y || evt.clientY

			if (!evt.shiftKey) d3.selectAll('.selecting, .selected').classed('selecting, selected', false)

			body.addElems('div', 'selection-veil')
				.classed('unselectable', true)
			.addElems('div', 'selection-box', [{ x: x, y: y, w: 0, h: 0 }])
				.styles({ 'transform': d => `translate(${d.x}px, ${d.y}px)`, 'width': d => `${d.w}px`, 'height': d => `${d.h}px` })
			document.body.addEventListener('mousemove', selecting)
		}
	}).on('mouseup.multiSelect', function () {
		document.body.removeEventListener('mousemove', selecting)
		body.classed('select', false)
		if (targets.class) {
			sels = d3.selectAll(targets.class)
			sels.filter(function () { return d3.select(this).classed('selecting') }).classed('selecting', false).classed('selected', true)
		}
		d3.select('div.selection-veil').remove()
	})
	function selecting (evt) {
		const selection = d3.select('div.selection-box')
		x = evt.x || evt.clientX
		y = evt.y || evt.clientY
		dx = x - ox
		dy = y - oy
		ox = x
		oy = y

		selection.styles({ 
			'transform': d => {
				if (d.w < 0) d.x = x
				if (d.h < 0) d.y = y
				bbox.x = d.x
				bbox.y = d.y
				return `translate(${d.x}px, ${d.y}px)`
			},
			'width': d => {
				d.w += dx
				bbox.w = Math.abs(d.w)
				return `${Math.abs(d.w)}px`
			},
			'height': d => {
				d.h += dy
				bbox.h = Math.abs(d.h)
				return `${Math.abs(d.h)}px`
			}
		})
		// MAYBE MOVE THIS UP TO ONLY CALCULATE ONCE (BUT THIS WOULD BE AN ISSUE IF THE USER SCROLLS MID SELECTION)
		if (targets.class) {
			sels = d3.selectAll(targets.class)
			if (targets.filter) sels = sels.filter(d => targets.filter(d))
			sels.classed('selecting', function (d) { 
				const rect = this.getBoundingClientRect()

				if (
					(
					(rect.left >= bbox.x && rect.left <= bbox.x + bbox.w)
					|| (rect.left <= bbox.x && rect.right >= bbox.x + bbox.w)
					|| (rect.left <= bbox.x && rect.right >= bbox.x && rect.right <= bbox.x + bbox.w)
					) && (
					(rect.top >= bbox.y && rect.top <= bbox.y + bbox.h) 
					|| (rect.bottom >= bbox.y && rect.bottom <= bbox.y + bbox.h)
					|| (rect.top <= bbox.y && rect.bottom >= bbox.y + bbox.h)
					)
				) {
					return true
				} else return false
			})
		}
	}
}