const fs = require('fs');

const DirectManager = require('direct-manager').default;
const direct = require('./utils/direct.js');
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
    frequency: 500,
    from: 0.5,
    to: 4,
    lineWidth: 0.8,
    nbPoints: 16384,
    maxClusterSize: 8,
    output: 'xy',
  };

  const target = spectra.y;
  const directManager = new DirectManager(prediction);
  const boundaries = directManager.getBoundaries(settings.boundaries);
  const buildPredictionFile = tidyUpParameters(directManager.signals, directManager.couplings);

  let counter = 0;
  const objectiveFunction = (parameters) => {
    const testSignals = buildPredictionFile(parameters);
    const simulation = SD.NMR.fromSignals(testSignals, spectraProperties);
    simulation.setMinMax(0, 1);
    const simulated = simulation.getYData();
    let result = 0;
    for (let i = 0; i < target.length; i++) {
      result += (target[i] - simulated[i]) ** 2;
    }
    console.log({ i: counter, min: result, p: Array.from(parameters) });
    counter++;
    return result;
  };

  console.time('time: ');
  const predicted = direct(
    objectiveFunction,
    boundaries.lower,
    boundaries.upper,
    { iterations: options.iterations },
  );
  console.timeEnd('time: ');

  console.log({ boundaries });

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
      choiceLimit: predicted.finalState.choiceLimit,
    },
  };

  fs.writeFileSync(
    `src/results/${options.molecule}-${predicted.iterations}.json`,
    JSON.stringify(
      {
        result,
        spectra,
        spectraProperties,
        prediction,
        settings,
        signals: directManager.getSignals(),
        couplings: directManager.couplings,
      },
      undefined,
      2,
    ),
    { encoding: 'utf8' },
  );
};

main();


function tidyUpParameters(signals, coup) {
  const result = signals.slice();
  const couplings = coup.slice();
  let counter = 0;
  return (parameters) => {
    for (const coupling of couplings) {
      if (!coupling.selected) continue;
      coupling.coupling = parameters[counter];
      counter++;
    }
    for (const atom of result) {
      const relatedAtoms = findCoupling(atom.diaIDs[0], couplings);
      if (atom.selected) {
        atom.delta = parameters[counter];
        counter++;
      }

      for (const jcoupling of atom.j) {
        const coupling = findCoupling(jcoupling.diaID, relatedAtoms);
        jcoupling.coupling =
          coupling.length === 0 ? jcoupling.coupling : coupling[0].coupling;
      }
    }
    counter = 0;
    return result;
  };
}

function findCoupling(id, couplings) {
  const result = [];
  for (const coupling of couplings) {
    for (const value of coupling.ids) {
      if (value.toLowerCase() === id.toLowerCase()) result.push(coupling);
    }
  }
  return result;
}