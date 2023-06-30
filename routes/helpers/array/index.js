exports.sum = function (key = undefined) {
	if (this.length === 0) return 0
	if (!key) return this.reduce((accumulator, value) => +accumulator + +value)
	else {
		return this.reduce((accumulator, value) => {
			const obj = {}
			obj[key] = +accumulator[key] + +value[key]
			return obj
		})[key]
	}
}
exports.count = function (kwargs = {}) { // THIS IS A SIMPLIFIED VERSION OF nest WHERE WE DO NOT KEEP THE nested DATA
	let { key, keyname, keep } = kwargs
	if (!keyname) keyname = 'key'
	const arr = []
	
	this.forEach(d => {
		if (!key) {
			if (!arr.some(c => c[keyname] === d)) {
				const obj = {}
				obj[keyname] = d
				obj.count = 1
				arr.push(obj)
			} else arr.find(c => c[keyname] === d).count += 1
		} else {
			const groupby = typeof key === 'function' ? key(d) : d[key]
			if (!arr.find(c => c[keyname] === groupby)) {
				const obj = {}
				obj[keyname] = groupby
				obj.count = 1
				if (keep) {
					if (Array.isArray(keep)) keep.forEach(k => obj[k] = d[k])
					else obj[keep] = d[keep]
				}
				arr.push(obj)
			} else arr.find(c => c[keyname] === groupby).count ++
		}
	})
	return arr
}
exports.nest = function (kwargs = {}) {
	let { key, keyname, keep } = kwargs
	if (!keyname) keyname = 'key'
	const arr = []
	
	this.forEach(d => {
		const groupby = typeof key === 'function' ? key(d) : d[key]
		if (!arr.find(c => c[keyname] === groupby)) {
			const obj = {}
			obj[keyname] = groupby
			obj.values = [d]
			obj.count = 1
			
			if (keep) {
				if (Array.isArray(keep)) keep.forEach(k => obj[k] = d[k])
				else obj[keep] = d[keep]
			}
			arr.push(obj)
		} else { 
			arr.find(c => c[keyname] === groupby).values.push(d)
			arr.find(c => c[keyname] === groupby).count ++
		}
	})
	return arr
}
exports.unique = function (kwargs = {}) {
	const { key, onkey } = kwargs
	const arr = []
	this.forEach(d => {
		if (!key) {
			if (!arr.includes(d)) arr.push(d)
		} else {
			const groupby = typeof key === 'function' ? key(d) : d[key]
			if (onkey) { if (!arr.map(c => c).includes(groupby)) arr.push(groupby) }
			else { if (!arr.map(c => c[key]).includes(groupby)) arr.push(d) }
		}
	})
	return arr
}

// THE FUNCTIONS BELOW ARE NOT USED FOR NOW
exports.intersection = function (arr = []) {
	const intersection = []
	this.sort()
	arr.sort()
	for (let i = 0; i < this.length; i += 1) {
		if (arr.includes(this[i])){
			intersection.push(this[i])
		}
	}
	return intersection
}
exports.difference = function (V2) {
	const diff = []
	this.forEach(d => { if (!V2.includes(d)) diff.push(d) })
	V2.forEach(d => { if (!this.includes(d)) diff.push(d) })
	return diff
}
exports.chunk = function (size = 1) {
	const groups = []
	for (let i = 0; i < this.length; i += size) {
		groups.push(this.slice(i, i + size))
	}
	return groups
}
exports.group = function (kwargs = {}) {
	const { key, keep } = kwargs
	const arr = []
	this.forEach(d => {
		if (!key) {
			if (arr.map(c => c.key).indexOf(d) === -1) arr.push({ key: d, count: 1 })
			else arr.find(c => c.key === d).count += 1
		} else {
			if (arr.map(c => c.key).indexOf(d[key]) === -1) {
				const obj = {}
				obj.key = d[key]
				obj.count = 1
				if (keep) obj[keep] = [d[keep]]
				arr.push(obj)
			}
			else {
				const obj =  arr.find(c => c.key === d[key])
				obj.count += 1
				if (keep) obj[keep].push(d[keep])
			}
		}
	})
	arr.forEach(d => d.p = d.count / this.length)
	return arr
}
exports.shuffle = function () {
	let currentIndex = this.length, temporaryValue, randomIndex

	while (0 !== currentIndex) {
		randomIndex = Math.floor(Math.random() * currentIndex)
		currentIndex -= 1;
		temporaryValue = this[currentIndex]
		this[currentIndex] = this[randomIndex]
		this[randomIndex] = temporaryValue
	}
	return this
}