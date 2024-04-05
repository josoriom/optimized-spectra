/**
 * Preparata, F. P., & Shamos, M. I. (2012). Computational geometry: an introduction. Springer Science & Business Media.
 * @param {Array} x - The array with x coordinates of the points.
 * @param {Array} y - The array with y coordinates of the points.
 * @return {Array} The indices of the points of anticlockwise lower convex hull
 * @private
 */
function antiLowerConvexHull(x, y) {
  if (x.length !== y.length) {
    throw new RangeError('X and Y vectors has different dimensions');
  }

  const nbPoints = x.length - 1;
  if (nbPoints === 0) return [0];
  if (nbPoints === 1) return [0, 1];

  let currentPoint = 0;
  let result = new Array(x.length).fill(true);
  while (true) {
    const a = currentPoint;
    const b = moveOn(currentPoint, nbPoints, result);
    const c = moveOn(moveOn(currentPoint, nbPoints, result), nbPoints, result);

    const det =
      x[c] * (y[a] - y[b]) + x[a] * (y[b] - y[c]) + x[b] * (y[c] - y[a]);

    const leftTurn = det >= 0;

    if (leftTurn) {
      currentPoint = b;
    } else {
      result[b] = false;
      currentPoint = moveBack(currentPoint, nbPoints, result);
    }
    if (c === nbPoints) break;
  }

  return result
    .map((item, index) => (item === false ? false : index))
    .filter((item) => item !== false);
}

/**
 * @param {number} currentPoint - The index of the current point to make the move
 * @param {number} nbPoints - The total number of points in the array
 * @param {Array} vector - The array with the points
 * @return {number} the index of the point after the move
 * @private
 */

function moveBack(currentPoint, nbPoints, vector) {
  let counter = currentPoint - 1;
  while (vector[counter] === false) counter--;
  return currentPoint === 0 ? nbPoints : counter;
}

function moveOn(currentPoint, nbPoints, vector) {
  let counter = currentPoint + 1;
  while (vector[counter] === false) counter++;
  return currentPoint === nbPoints ? 0 : counter;
}

module.exports = { antiLowerConvexHull };
