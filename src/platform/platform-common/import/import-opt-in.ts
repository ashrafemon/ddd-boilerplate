import 'reflect-metadata';
import type { ImportDescriptor } from './import.types';

/**
 * Declares a business adapter as an import handler for one entity.
 * A duplicate entityKey still throws at registration (boot).
 */
export const IMPORT_OPT_IN_METADATA = 'import-opt-in';

export interface ImportOptInMeta {
  entityKey: string;
  descriptor: ImportDescriptor;
}

export const ImportOptIn = (meta: ImportOptInMeta): ClassDecorator => {
  return (target: object) => {
    Reflect.defineMetadata(IMPORT_OPT_IN_METADATA, meta, target);
  };
};
