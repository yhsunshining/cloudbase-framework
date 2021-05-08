import * as path from 'path';
import os from 'os';

export * from '../../generator/config/index';
export const sharedMaterialsDir = path.join(os.homedir(), '.weapps-materials');
