import { BadRequestException, Injectable } from '@nestjs/common';
import { KeyedRegistryBase } from '@shared-kernel/utils/keyed-registry.base';
import { ImportHandler } from './ports/import-handler.port';
import { ImportDescriptor } from './import.types';

interface RegisteredEntry {
  entityKey: string;
  descriptor: ImportDescriptor;
  handler: ImportHandler;
}

/**
 * Map<entityKey, { descriptor, handler }>, resolved by string key at runtime —
 * the same service-locator pattern as BatchOperationHandlerRegistry. Populated
 * by the owning domain modules' bootstrap registration; every pipeline
 * component resolves through this and never branches on entityKey itself.
 */
@Injectable()
export class ImportHandlerRegistry extends KeyedRegistryBase<RegisteredEntry> {
  /**
   * Called once per entityKey at boot. Validates the descriptor here so a
   * malformed field list fails the build, not the first import that hits it.
   */
  register(entityKey: string, descriptor: ImportDescriptor, handler: ImportHandler): void {
    if (this.has(entityKey)) {
      throw new Error(`ImportHandler for entityKey '${entityKey}' already registered`);
    }

    this.assertDescriptorValid(entityKey, descriptor);

    this.entries.set(entityKey, { entityKey, descriptor, handler });
  }

  resolveHandler(entityKey: string): ImportHandler {
    return this.entry(entityKey).handler;
  }

  /** The registered descriptor — snapshotted onto a job at creation, never read from later. */
  resolveDescriptor(entityKey: string): ImportDescriptor {
    return this.entry(entityKey).descriptor;
  }

  /** Health indicator — makes "why can't I import Customers" a five-second diagnosis. */
  health(): Array<{
    entityKey: string;
    descriptorVersion: number;
    fieldCount: number;
    requiredFields: string[];
  }> {
    return [...this.entries.values()].map(({ entityKey, descriptor }) => ({
      entityKey,
      descriptorVersion: descriptor.version,
      fieldCount: descriptor.fields.length,
      requiredFields: descriptor.fields.filter(f => f.required).map(f => f.targetField),
    }));
  }

  private entry(entityKey: string): RegisteredEntry {
    return this.requireEntry(
      entityKey,
      () => new Error(`No ImportHandler registered for entityKey '${entityKey}'`),
    );
  }

  private assertDescriptorValid(entityKey: string, descriptor: ImportDescriptor): void {
    const reasons: string[] = [];

    if (descriptor.entityKey !== entityKey) {
      reasons.push(
        `descriptor.entityKey '${descriptor.entityKey}' does not match registration key '${entityKey}'`,
      );
    }
    if (descriptor.fields.length === 0) {
      reasons.push('declares no fields');
    }

    const targetFields = descriptor.fields.map(f => f.targetField);
    const duplicates = [...new Set(targetFields.filter((f, i) => targetFields.indexOf(f) !== i))];
    if (duplicates.length > 0) {
      reasons.push(`declares duplicate targetFields: ${duplicates.join(', ')}`);
    }

    const known = new Set(targetFields);
    const unknownUpsertKeys = [
      ...new Set(descriptor.upsertKeys.flat().filter(field => !known.has(field))),
    ];
    if (unknownUpsertKeys.length > 0) {
      reasons.push(`upsertKeys reference undeclared fields: ${unknownUpsertKeys.join(', ')}`);
    }

    if (descriptor.maxRows <= 0) {
      reasons.push('maxRows must be greater than 0');
    }
    if (descriptor.maxFileSizeBytes <= 0) {
      reasons.push('maxFileSizeBytes must be greater than 0');
    }
    if (descriptor.executionChunkSize <= 0) {
      reasons.push('executionChunkSize must be greater than 0');
    }

    if (reasons.length > 0) {
      throw new BadRequestException(
        `Invalid import descriptor for '${entityKey}': ${reasons.join(', ')}`,
      );
    }
  }
}
