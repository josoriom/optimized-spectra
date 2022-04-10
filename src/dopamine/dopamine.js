/* eslint-disable no-console */
const fs = require('fs');

const DirectManager = require('direct-manager').default;
const direct = require('ml-direct');

const SD = require('../../../../spectra-data');
const prediction = require('../../predictions/dopamine.json');
const settings = require('../dopamine/settings.json');
const spectra = require('../../spectra/dopamine.json');

const spectraProperties = {
  frequency: 400,
  from: 0,
  to: 10,
  lineWidth: 1.1,
  nbPoints: 16384,
  maxClusterSize: 8,
  output: 'xy',
};

const target = spectra.y;
const directManager = new DirectManager(prediction);
const boundaries = directManager.getBoundaries(settings.boundaries);

// const boundaries = {
//   "lower": [1.3477, 5.6078, 4.5044, 6.765, 7.0842, 7.1827, 3.09, 3.29, 7.3094],
//   "upper": [1.8477, 6.0078, 4.9044, 6.965, 7.1042, 7.3827, 3.12, 3.315, 7.5094]
// }

const buildPredictionFile = directManager.tidyUpParameters();

console.time('Execution time: ');
const predicted = direct(
  objectiveFunction,
  boundaries.lower,
  boundaries.upper,
  { iterations: 1 },
);
console.timeEnd('Execution time: ');

let result = {
  optima: predicted.optima,
  minFunctionValue: predicted.minFunctionValue,
  iterations: predicted.iterations,
  functionCalls: predicted.finalState.fCalls,
};

console.log(result);

fs.appendFileSync(
  `../results/dopamine-${predicted.iterations}.json`,
  `${JSON.stringify(result)}`,
);

function objectiveFunction(parameters) {
  const testSignals = buildPredictionFile(parameters);
  const simulation = SD.NMR.fromSignals(testSignals, spectraProperties);
  simulation.setMinMax(0, 1);
  const simulated = simulation.getYData();
  let result = 0;
  for (let i = 0; i < target.length; i++) {
    result += (target[i] - simulated[i]) ** 2;
  }
  return result;
}
