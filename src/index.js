const fs = require('fs');

const DirectManager = require('direct-manager').default;
const direct = require('ml-direct');
const SD = require('./utils/spectra-data');

require('colors');
const { selectMolecule, pause, askIterations } = require('./utils/menu.js');

console.clear();

const main = async () => {
  const options = { molecule: null, iterations: null };
  do {
    const molecule = await selectMolecule();
    const iterations = await askIterations();
    options.molecule = molecule;
    options.iterations = iterations;
    await pause(molecule, parseInt(iterations));
  } while (!options.molecule || !options.iterations);

  const prediction = require(`../molecules/${options.molecule}/prediction.json`);
  const settings = require(`../molecules/${options.molecule}/settings.json`);
  const spectra = require(`../molecules/${options.molecule}/spectra.json`);

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
  const buildPredictionFile = directManager.tidyUpParameters();

  const objectiveFunction = (parameters) => {
    const testSignals = buildPredictionFile(parameters);
    const simulation = SD.NMR.fromSignals(testSignals, spectraProperties);
    simulation.setMinMax(0, 1);
    const simulated = simulation.getYData();
    let result = 0;
    for (let i = 0; i < target.length; i++) {
      result += (target[i] - simulated[i]) ** 2;
    }
    return result;
  };

  const predicted = direct(
    objectiveFunction,
    boundaries.lower,
    boundaries.upper,
    { iterations: options.iterations },
  );

  const result = {
    optima: predicted.optima,
    minFunctionValue: predicted.minFunctionValue,
    iterations: predicted.iterations,
    finalState: {
      fCalls: predicted.finalState.fCalls,
      numberOfRectangles: predicted.finalState.numberOfRectangles,
      totalIterations: predicted.finalState.totalIterations,
      originalCoordinates: predicted.finalState.originalCoordinates,
      middlePoint: Array.from(predicted.finalState.middlePoint),
      smallerDistance: predicted.finalState.smallerDistance,
      edgeSizes: predicted.finalState.edgeSizes.map((item) => Array.from(item)),
      diagonalDistances: predicted.finalState.diagonalDistances,
      functionValues: predicted.finalState.functionValues,
      differentDistances: predicted.finalState.differentDistances,
      smallerValuesByDistance: predicted.finalState.smallerValuesByDistance,
      choiceLimit: predicted.finalState.choiceLimit
    }
  };

  console.log(result)

  fs.writeFileSync(
    `src/results/${options.molecule}-${predicted.iterations}.json`,
    JSON.stringify({
      result,
      spectra,
      spectraProperties,
      prediction
    }, undefined, 2),
    { encoding: 'utf8' }
  );
};

main();
