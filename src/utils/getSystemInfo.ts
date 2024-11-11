import childProcess from 'child_process';
import { SYSTEM_VERSION_PLIST_PATH } from '../constants.js';
import { invariant } from './invariant.js';

export interface SystemVersionInfo {
  iOSSupportVersion: string;
  ProductBuildVersion: string;
  ProductCopyright: string;
  ProductName: string;
  ProductUserVisibleVersion: string;
  ProductVersion: string;
}

/** Read the system version info from `SystemVersion.plist` */
export const getSystemInfo = async () =>
  new Promise<SystemVersionInfo>((resolve, reject) => {
    childProcess.exec(`plutil -convert json -r -o - -- "${SYSTEM_VERSION_PLIST_PATH}"`, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        try {
          const data: SystemVersionInfo = JSON.parse(stdout);
          invariant('ProductVersion' in data, 'missing ProductVersion');
          invariant('ProductBuildVersion' in data, 'missing ProductBuildVersion');
          resolve(data);
        } catch (parseErr) {
          reject(parseErr);
        }
      }
    });
  });
