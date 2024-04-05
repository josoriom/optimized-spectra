const { xNorm, xMaxValue, xMinValue } = require('ml-spectra-processing');

const { antiLowerConvexHull } = require('./antiLowerConvexHull.js');

/**
 * Performs a global optimization of required parameters
 * It will return an object containing:
 * - `minFunctionValue`: The minimum value found for the objetive function
 * - `optima`: Array of Array of values for all the variables where the function reach its minimum value
 * - `iterations`: Number of iterations performed in the process
 * - `finalState`: Internal state allowing to continue optimization (initialState)
 * @param {function} objectiveFunction Function to evaluate. It should accept an array of variables
 * @param {Array} lowerBoundaries Array containing for each variable the lower boundary
 * @param {Array} upperBoundaries Array containing for each variable the higher boundary
 * @param {Object} [options={}]
 * @param {number} [options.iterations] - Number of iterations.
 * @param {number} [options.epsilon] - Tolerance to choose best current value.
 * @param {number} [options.tolerance] - Minimum tollerance of the function.
 * @param {number} [options.tolerance2] - Minimum tollerance of the function.
 * @param {Object} [options.initialState={}] - finalState of previous optimization.
 * @return {Object} {finalState, iterations, minFunctionValue}
 * */

function direct(
  objectiveFunction,
  lowerBoundaries,
  upperBoundaries,
  options = {},
) {
  const {
    iterations = 50,
    epsilon = 1e-4,
    tolerance = 1e-16,
    tolerance2 = 1e-12,
    initialState = {},
  } = options;

  if (
    objectiveFunction === undefined ||
    lowerBoundaries === undefined ||
    upperBoundaries === undefined
  ) {
    throw new RangeError('There is something undefined');
  }

  lowerBoundaries = new Float64Array(lowerBoundaries);
  upperBoundaries = new Float64Array(upperBoundaries);

  if (lowerBoundaries.length !== upperBoundaries.length) {
    throw new Error(
      'Lower bounds and Upper bounds for x are not of the same length',
    );
  }

  //-------------------------------------------------------------------------
  //                        STEP 1. Initialization
  //-------------------------------------------------------------------------
  let n = lowerBoundaries.length;
  let diffBorders = upperBoundaries.map((x, i) => x - lowerBoundaries[i]);

  let {
    numberOfRectangles = 0,
    totalIterations = 0,
    unitaryCoordinates = [new Float64Array(n).fill(0.5)],
    middlePoint = new Float64Array(n).map((value, index) => {
      return (
        lowerBoundaries[index] +
        unitaryCoordinates[0][index] * diffBorders[index]
      );
    }),
    bestCurrentValue = objectiveFunction(middlePoint),
    fCalls = 1,
    smallerDistance = 0,
    edgeSizes = [new Float64Array(n).fill(0.5)],
    diagonalDistances = [Math.sqrt(n * 0.5 ** 2)],
    functionValues = [bestCurrentValue],
    differentDistances = diagonalDistances,
    smallerValuesByDistance = [bestCurrentValue],
    choiceLimit = undefined,
  } = initialState;
  if (
    initialState.originalCoordinates &&
    initialState.originalCoordinates.length > 0
  ) {
    bestCurrentValue = xMinValue(functionValues);
    choiceLimit =
      epsilon * Math.abs(bestCurrentValue) > 1e-8
        ? epsilon * Math.abs(bestCurrentValue)
        : 1e-8;

    smallerDistance = getMinIndex(
      functionValues,
      diagonalDistances,
      choiceLimit,
      bestCurrentValue,
    );

    unitaryCoordinates = initialState.originalCoordinates.slice();
    for (let j = 0; j < unitaryCoordinates.length; j++) {
      for (let i = 0; i < lowerBoundaries.length; i++) {
        unitaryCoordinates[j][i] =
          (unitaryCoordinates[j][i] - lowerBoundaries[i]) / diffBorders[i];
      }
    }
  }

  let iteration = 0;
  //-------------------------------------------------------------------------
  //                          Iteration loop
  //-------------------------------------------------------------------------

  while (iteration < iterations) {
    //----------------------------------------------------------------------
    //  STEP 2. Identify the set S of all potentially optimal rectangles
    //----------------------------------------------------------------------

    let S1 = [];
    let idx = differentDistances.findIndex(
      // eslint-disable-next-line no-loop-func
      (e) => e === diagonalDistances[smallerDistance],
    );
    let counter = 0;
    for (let i = idx; i < differentDistances.length; i++) {
      for (let f = 0; f < functionValues.length; f++) {
        if (
          (functionValues[f] === smallerValuesByDistance[i]) &
          (diagonalDistances[f] === differentDistances[i])
        ) {
          S1[counter++] = f;
        }
      }
    }

    let optimumValuesIndex, S3;
    if (differentDistances.length - idx > 1) {
      let a1 = diagonalDistances[smallerDistance];
      let b1 = functionValues[smallerDistance];
      let a2 = differentDistances[differentDistances.length - 1];
      let b2 = smallerValuesByDistance[differentDistances.length - 1];
      let slope = (b2 - b1) / (a2 - a1);
      let constant = b1 - slope * a1;
      let S2 = new Uint32Array(counter);
      counter = 0;
      for (let i = 0; i < S2.length; i++) {
        let j = S1[i];
        if (
          functionValues[j] <=
          slope * diagonalDistances[j] + constant + tolerance2
        ) {
          S2[counter++] = j;
        }
      }

      let xHull = [];
      let yHull = [];
      for (let i = 0; i < counter; i++) {
        xHull.push(diagonalDistances[S2[i]]);
        yHull.push(functionValues[S2[i]]);
      }

      let lowerIndexHull = antiLowerConvexHull(xHull, yHull);

      S3 = [];
      for (let i = 0; i < lowerIndexHull.length; i++) {
        S3.push(S2[lowerIndexHull[i]]);
      }
    } else {
      S3 = S1.slice(0, counter);
    }
    optimumValuesIndex = S3;
    //--------------------------------------------------------------
    // STEPS 3,5: Select any rectangle j in S
    //--------------------------------------------------------------
    for (let k = 0; k < optimumValuesIndex.length; k++) {
      let j = optimumValuesIndex[k];
      let largerSide = xMaxValue(edgeSizes[j]);
      let largeSidesIndex = new Uint32Array(edgeSizes[j].length);
      counter = 0;
      for (let i = 0; i < edgeSizes[j].length; i++) {
        if (Math.abs(edgeSizes[j][i] - largerSide) < tolerance) {
          largeSidesIndex[counter++] = i;
        }
      }
      let delta = (2 * largerSide) / 3;
      let bestFunctionValues = [];
      for (let r = 0; r < counter; r++) {
        let i = largeSidesIndex[r];
        let firstMiddleCenter = unitaryCoordinates[j].slice();
        let secondMiddleCenter = unitaryCoordinates[j].slice();
        firstMiddleCenter[i] += delta;
        secondMiddleCenter[i] -= delta;
        let firstMiddleValue = new Float64Array(firstMiddleCenter.length);
        let secondMiddleValue = new Float64Array(secondMiddleCenter.length);
        for (let i = 0; i < firstMiddleCenter.length; i++) {
          firstMiddleValue[i] =
            lowerBoundaries[i] + firstMiddleCenter[i] * diffBorders[i];
          secondMiddleValue[i] =
            lowerBoundaries[i] + secondMiddleCenter[i] * diffBorders[i];
        }
        let firstMinValue = objectiveFunction(firstMiddleValue);
        let secondMinValue = objectiveFunction(secondMiddleValue);
        fCalls += 2;
        bestFunctionValues.push({
          minValue: Math.min(firstMinValue, secondMinValue),
          index: r,
        });
        // [Math.min(firstMinValue, secondMinValue), r];
        unitaryCoordinates.push(firstMiddleCenter, secondMiddleCenter);
        functionValues.push(firstMinValue, secondMinValue);
      }

      let b = bestFunctionValues.sort((a, b) => a.minValue - b.minValue);
      for (let r = 0; r < counter; r++) {
        let u = largeSidesIndex[b[r].index];
        let ix1 = numberOfRectangles + 2 * (b[r].index + 1) - 1;
        let ix2 = numberOfRectangles + 2 * (b[r].index + 1);
        edgeSizes[j][u] = delta / 2;
        edgeSizes[ix1] = edgeSizes[j].slice();
        edgeSizes[ix2] = edgeSizes[j].slice();
        diagonalDistances[j] = xNorm(edgeSizes[j]);
        diagonalDistances[ix1] = diagonalDistances[j];
        diagonalDistances[ix2] = diagonalDistances[j];
      }
      numberOfRectangles += 2 * counter;
    }

    //--------------------------------------------------------------
    //                  Update
    //--------------------------------------------------------------

    bestCurrentValue = xMinValue(functionValues);

    choiceLimit =
      epsilon * Math.abs(bestCurrentValue) > 1e-8
        ? epsilon * Math.abs(bestCurrentValue)
        : 1e-8;

    smallerDistance = getMinIndex(
      functionValues,
      diagonalDistances,
      choiceLimit,
      bestCurrentValue,
      iteration,
    );

    differentDistances = Array.from(new Set(diagonalDistances));
    differentDistances = differentDistances.sort((a, b) => a - b);

    smallerValuesByDistance = [];
    for (let i = 0; i < differentDistances.length; i++) {
      let minIndex;
      let minValue = Number.POSITIVE_INFINITY;
      for (let k = 0; k < diagonalDistances.length; k++) {
        if (diagonalDistances[k] === differentDistances[i]) {
          if (functionValues[k] < minValue) {
            minValue = functionValues[k];
            minIndex = k;
          }
        }
      }
      smallerValuesByDistance.push(functionValues[minIndex]);
    }

    let currentMin = [];
    for (let j = 0; j < functionValues.length; j++) {
      if (functionValues[j] === bestCurrentValue) {
        let temp = [];
        for (let i = 0; i < lowerBoundaries.length; i++) {
          temp.push(
            lowerBoundaries[i] + unitaryCoordinates[j][i] * diffBorders[i],
          );
        }
        currentMin.push(temp);
      }
    }
    let originalCoordinates = [];
    for (let j = 0; j < numberOfRectangles + 1; j++) {
      let pair = [];
      for (let i = 0; i < lowerBoundaries.length; i++) {
        pair.push(
          lowerBoundaries[i] + unitaryCoordinates[j][i] * diffBorders[i],
        );
      }
      originalCoordinates.push(pair);
    }
    let minimizer = [];
    for (let i = 0; i < functionValues.length; i++) {
      if (functionValues[i] === bestCurrentValue) {
        minimizer.push(originalCoordinates[i]);
      }
    }
    console.log('--------:::>>>>>', { iteration, bestCurrentValue, minimizer });
    iteration += 1;
  }
  //--------------------------------------------------------------
  //                  Saving results
  //--------------------------------------------------------------

  let result = {};
  result.minFunctionValue = bestCurrentValue;
  result.iterations = iteration;
  let originalCoordinates = [];
  for (let j = 0; j < numberOfRectangles + 1; j++) {
    let pair = [];
    for (let i = 0; i < lowerBoundaries.length; i++) {
      pair.push(lowerBoundaries[i] + unitaryCoordinates[j][i] * diffBorders[i]);
    }
    originalCoordinates.push(pair);
  }

  result.finalState = {
    numberOfRectangles,
    totalIterations: (totalIterations += iterations),
    originalCoordinates,
    middlePoint,
    fCalls,
    smallerDistance,
    edgeSizes,
    diagonalDistances,
    functionValues,
    differentDistances,
    smallerValuesByDistance,
    choiceLimit,
  };

  let minimizer = [];
  for (let i = 0; i < functionValues.length; i++) {
    if (functionValues[i] === bestCurrentValue) {
      minimizer.push(originalCoordinates[i]);
    }
  }

  result.optima = minimizer;
  console.log('--::>>', { bestCurrentValue, minimizer });
  return result;
}

module.exports = direct;

function getMinIndex(
  functionValues,
  diagonalDistances,
  choiceLimit,
  bestCurrentValue,
) {
  let item = [];
  for (let i = 0; i < functionValues.length; i++) {
    item[i] =
      Math.abs(functionValues[i] - (bestCurrentValue + choiceLimit)) /
      diagonalDistances[i];
  }
  const min = xMinValue(item);
  let result = item.findIndex((x) => x === min);
  return result;
}
