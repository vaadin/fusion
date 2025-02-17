/* eslint-disable import/export */
import { AutoCrud as _AutoCrud } from './autocrud.js';
import { featureRegistration } from './util.js';

export * from './autocrud.js';

export const AutoCrud: typeof _AutoCrud = featureRegistration(_AutoCrud, 'AutoCrud');
