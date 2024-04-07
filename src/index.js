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
    lineWidth: 1.2,
    nbPoints: 16384,
    maxClusterSize: 8,
    output: 'xy',
  };

  const target = spectra.y;
  const directManager = new DirectManager(prediction);
  const boundaries = getBoundaries(settings.boundaries, directManager);
  const buildPredictionFile = tidyUpParameters(directManager.signals, directManager.couplings, settings.boundaries);

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

function getBoundaries(parameters, instance, options  = {} ) {
  const { error = 0.1 } = options;
  instance.signals = getSignals(instance.prediction);
  if (parameters) {
    const currentParameters = parameters.slice();
    for (let i = 0; i < parameters.length; i++) {
      currentParameters[i].value.assessment = parameters[i].value.assessment;
      currentParameters[i].value.selected = parameters[i].value.selected;
      currentParameters[i].value.lower = parameters[i].value.lower;
      currentParameters[i].value.upper = parameters[i].value.upper;
    }
    instance.parameters = currentParameters;
  } else {
    instance.parameters = instance.suggestBoundaries({ error });
  }
  updateSignals(instance.parameters, instance);
  const result = { lower: [], upper: [] };
  for (const parameter of instance.parameters) {
    if (!parameter.value.selected) continue;
    result.lower.push(parameter.value.lower);
    result.upper.push(parameter.value.upper);
  }
  return result;
}

function getSignals(json) {
  const predictions = JSON.parse(JSON.stringify(json));
  for (const prediction of predictions) {
    prediction.selected =
      typeof prediction.selected === 'boolean' ? prediction.selected : true;
    for (const coupling of prediction.j) {
      coupling.selected =
        typeof coupling.selected === 'boolean' ? coupling.selected : true;
    }
  }
  return predictions;
}


function updateSignals(parameters, instance) {
  if (parameters === undefined) return;
  for (const parameter of parameters) {
    const atoms = parameter.atoms;
    const deltaIndex = instance.signals.findIndex(
      (item) => item.diaIDs[0] === atoms[0],
    );
    if (parameter.type === 'delta') {
      instance.signals[deltaIndex].selected = parameter.value.selected;
      instance.signals[deltaIndex].delta = parameter.value.assessment;
    } else if (parameter.type === 'coupling') {
      const jOneIndex = getCouplingIndex(
        atoms[1],
        parameter.value.prediction,
        instance.prediction[deltaIndex].j,
      );
      const delta2Index = instance.signals.findIndex(
        (item) => {
          return item.diaIDs[0] === atoms[1]
        },
      );
      
      const jTwoIndex = getCouplingIndex(
        atoms[0],
        parameter.value.prediction,
        instance.prediction[delta2Index].j,
      );
      for (const index of jOneIndex) {
        instance.signals[deltaIndex].j[index].selected = parameter.value.selected;
        instance.signals[deltaIndex].j[index].coupling =
          parameter.value.assessment;
      }

      for (const index of jTwoIndex) {
        instance.signals[delta2Index].j[index].selected =
          parameter.value.selected;
          instance.signals[delta2Index].j[index].coupling =
          parameter.value.assessment;
      }
    }
  }
  instance.couplings = getCouplings(instance.signals);
}

function getCouplingIndex(id, value, couplings) {
  let counter = 0;
  const couplingId = [];
  for (const coupling of couplings) {
    if (coupling.diaID === id) {
      if (coupling.coupling === value) {
        couplingId.push(counter);
        continue;
      }
      if (coupling.coupling.toPrecision(2) === value.toPrecision(2)) {
        couplingId.push(counter);
      }
    }
    counter++;
  }
  return couplingId;
}

function tidyUpParameters(signals, coup, settings) {
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
        atom.delta = parameters[getDeltaIndex(atom.diaIDs[0], settings)];
        counter++;
      }

      for (const jcoupling of atom.j) {
        const coupling = findCoupling(jcoupling.diaID, relatedAtoms);
        jcoupling.coupling =
          coupling.length === 0 ? jcoupling.coupling : coupling[0].coupling;
      }
    }
    counter = 0;
    // console.log(result);
    // console.log(result.map((item) => (item.j)));
    return result;

    function getDeltaIndex(id, settings) {
      let result = 0;
      for (let i = 0; i < settings.length; i++) {
        const item = settings[i];
        if (item.atoms.length === 1) {
          const atomID = item.atoms[0];
          if (id === atomID) {
            result = i;
          }
        }
      }
      return result;
    }
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

function getCouplings(json) {
  const predictions = JSON.parse(JSON.stringify(json));
  const parameters = [];
  for (const prediction of predictions) {
    for (const coupling of prediction.j) {
      const item = { ids: [], coupling: 0, selected: true };
      item.ids = JSON.parse(JSON.stringify(prediction.diaIDs));
      item.ids.push(coupling.diaID);
      item.coupling = coupling.coupling;
      item.selected =
        typeof coupling.selected === 'boolean' ? coupling.selected : true;
      parameters.push(item);
    }
  }

  const test = [];
  const result = parameters.filter((currentValue) => {
    if (!test.find((item) => item === currentValue.coupling)) {
      test.push(currentValue.coupling);
      return true;
    } else {
      return false;
    }
  }, test);
  return result;
}