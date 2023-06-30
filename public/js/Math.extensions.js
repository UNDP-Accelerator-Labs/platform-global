function polarToCartesian (angle, length, offset) {
	if (!offset) offset = [0, 0];
	var x = Math.cos(angle) * length + offset[0];
	var y = Math.sin(angle) * length + offset[1];
	return [x, y];
}

function cartesianToPolar (x, y, offset) {
	if (!offset) offset = [0, 0];
	x = x - offset[0];
	y = y - offset[1];
	var angle = Math.atan2(y, x);
	var length = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
	return [angle, length];
}


function degreeToRadian (degree) {
	var radian = degree * (Math.PI / 180);
	return radian;
}
function radianToDegree (radian) {
	return (radian >= 0 ? radian : (2 * Math.PI + radian)) * 360 / (2 * Math.PI)
}