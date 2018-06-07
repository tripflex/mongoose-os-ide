'use strict';

const fs = require('fs');
const Generator = require('yeoman-generator');

module.exports = class extends Generator {
  initializing() {
    if (fs.existsSync('mos.yml')) {
      this.env.error('There is already a Mongoose OS project!')
    }
  }
  prompting() {
    const prompts = [
      {
        type: 'input',
        name: 'name',
        message: 'What is you app name?',
        default: 'mongoose-os-app'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Describe your app',
        default: 'Mongoose OS app'
      },
      {
        type: 'list',
        name: 'arch',
        message: 'What architecture do you want to use?',
        choices: [
          { name: 'esp32', value: 'esp32' },
          { name: 'esp8266', value: 'esp8266' },
          { name: 'cc3220', value: 'cc3220' },
          { name: 'cc3200', value: 'cc3200' },
          { name: 'esp32', value: 'esp32' },
        ]
      },
    ];
    return this.prompt(prompts).then(props => {
      this.props = props;
    });
  }

  writing() {
    this.fs.copyTpl(
      this.templatePath('mos.yml'),
      this.destinationPath('mos.yml'),
      {
        name: this.props.name,
        description: this.props.description,
        arch: this.props.arch,
      }
    );
    this.fs.copy(
      this.templatePath('main.c'),
      this.destinationPath('src/main.c')
    );
    this.fs.copy(
      this.templatePath('README.md'),
      this.destinationPath('README.md')
    );
    this.fs.copy(
      this.templatePath('index.html'),
      this.destinationPath('fs/index.html')
    );
  }
};
