import { commands, extensions } from '../../../.lintstagedrc.js';

export default {
  [`src/**/*.{${extensions}}`]: commands,
  [`test/**/*.{${extensions}}`]: commands,
};
