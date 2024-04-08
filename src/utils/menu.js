const inquirer = require('inquirer');
require('colors');

const menuOptions = [
  {
    type: 'list',
    name: 'selected',
    message: 'Select a molecule',
    choices: [
      {
        name: '1. Valine*',
        value: 'valine',
      },
      {
        name: '2. Arginine*',
        value: 'arginine',
      },
      {
        name: '3. Asparagine*',
        value: 'Asparagine',
      },
      {
        name: '4. Alanine*',
        value: 'alanine',
      },
      {
        name: '5. Tyrosine*',
        value: 'tyrosine',
      },
      {
        name: '6. Coumarin',
        value: 'coumarin',
      },
      {
        name: '7. Dopamine',
        value: 'dopamine',
      },
      {
        name: '8. Serotonin',
        value: 'serotonin',
      },
      {
        name: 'Exit',
        value: 'exit',
      },
    ],
  },
];

const selectMolecule = async () => {
  console.clear();
  console.log('===================================='.green);
  console.log('          Select a molecule         '.green);
  console.log('====================================\n'.green);
  const { selected } = await inquirer.prompt(menuOptions);
  return selected;
};

const pause = async (molecule, iterations) => {
  const question = [
    {
      type: 'input',
      name: 'enter',
      message: `Press ${'Enter'.blue} key to optimize ${molecule.red} with ${
        String(iterations).red
      } iterations. Otherwise type ${'Ctrl + C'.blue} to close this menu`,
    },
  ];

  console.log('\n');
  await inquirer.prompt(question);
};

const askIterations = async (message) => {
  const question = [
    {
      type: 'input',
      name: 'iterations',
      message,
      validate(value) {
        if (!value.trim().match(/^[0-9]+$/)) {
          return `${
            value.trim().red
          } is not integer. Please introduce a valid number of iterations. Otherwise type ${
            'Ctrl + C'.red
          } to close this menu.`;
        }
        return true;
      },
    },
  ];
  const { iterations } = await inquirer.prompt(question);
  return iterations.trim();
};

module.exports = { selectMolecule, pause, askIterations };
