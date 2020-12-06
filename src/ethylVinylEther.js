/* eslint-disable no-console */
const fs = require('fs');

const DirectManager = require('direct-manager');
const direct = require('ml-direct');

const SD = require('../../spectra-data');
const prediction = require('../predictions/ethylVinylEther.json');
const spectra = require('../spectra/ethylVinylEther.json');

const spectraProperties = {
  frequency: 400,
  from: 0,
  to: 10,
  lineWidth: 3,
  nbPoints: 4096,
  maxClusterSize: 8,
  output: 'xy',
};

const target = spectra.y; // ethylVinylEther
const directManager = new DirectManager(prediction);
const boundaries = {
  lower: [14.248, 6.934, 6.718, 1.772, 6.373, 3.671, 4.097, 3.899, 1.208],
  upper: [14.448, 7.134, 6.918, 1.972, 6.573, 3.871, 4.297, 4.099, 1.408],
};
const buildPredictionFile = directManager.tidyUpParameters();

console.time('Execution time: ');
const predicted = direct(
  objectiveFunction,
  boundaries.lower,
  boundaries.upper,
  { iterations: 25 },
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
  `../results/ethylVinylEther-${predicted.iterations}.json`,
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
