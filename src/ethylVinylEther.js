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
  lower: [14.589, 7.497, 6.912, 2.164, 6.44, 3.72, 4.16, 4.2, 1.28],
  upper: [14.789, 7.697, 7.112, 2.364, 6.52, 3.81, 4.19, 4.23, 1.34],
};
const buildPredictionFile = directManager.tidyUpSimplifiedParameters();

const predicted = direct(
  objectiveFunction,
  boundaries.lower,
  boundaries.upper,
  { iterations: 25 },
);

// console.log(predicted);

fs.appendFileSync(`predicted-${new Date()}`, `${JSON.stringify(predicted)},`);

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
