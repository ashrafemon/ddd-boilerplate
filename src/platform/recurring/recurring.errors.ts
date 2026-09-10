import { DomainException } from '@shared-kernel/exceptions/domain.exception';

/**
 * Thrown at template-save time when partyType doesn't correlate with
 * targetEntityType (Invoice -> Customer, PurchaseOrder/Bill -> Vendor).
 * Application-layer rule — no DB constraint can express it since partyId
 * has no FK (it points at different tables depending on partyType).
 */
export class InvalidPartyTypeError extends DomainException {
  constructor(targetEntityType: string, partyType: string) {
    super(
      `partyType '${partyType}' does not correlate with targetEntityType '${targetEntityType}'`,
      'INVALID_PARTY_TYPE',
      { targetEntityType, partyType },
    );
    this.name = 'InvalidPartyTypeError';
  }
}

/**
 * Thrown when a TIME template is missing frequency/interval/startDate, or an
 * EVENT template is missing eventName — mirrors
 * chk_recurring_templates_trigger_fields at the application layer.
 */
export class InvalidTriggerFieldsError extends DomainException {
  constructor(triggerType: string) {
    super(
      `triggerType '${triggerType}' requires its matching fields to be set`,
      'INVALID_TRIGGER_FIELDS',
      { triggerType },
    );
    this.name = 'InvalidTriggerFieldsError';
  }
}

/**
 * Thrown when a business module registers a targetEntityType a
 * second time — fail at boot, never silently overwrite.
 */
export class DuplicateGeneratorRegistrationError extends DomainException {
  constructor(targetEntityType: string) {
    super(
      `RecurringGenerator for targetEntityType '${targetEntityType}' already registered`,
      'DUPLICATE_GENERATOR_REGISTRATION',
      { targetEntityType },
    );
    this.name = 'DuplicateGeneratorRegistrationError';
  }
}

/** Thrown when a template names a targetEntityType with no registered generator. */
export class UnregisteredGeneratorError extends DomainException {
  constructor(targetEntityType: string) {
    super(
      `No RecurringGenerator registered for targetEntityType '${targetEntityType}'`,
      'UNREGISTERED_GENERATOR',
      { targetEntityType },
    );
    this.name = 'UnregisteredGeneratorError';
  }
}

/** Thrown when a templateNo collides with an existing template. */
export class DuplicateTemplateNoError extends DomainException {
  constructor(templateNo: string) {
    super(`RecurringTemplate.templateNo '${templateNo}' already exists`, 'DUPLICATE_TEMPLATE_NO', {
      templateNo,
    });
    this.name = 'DuplicateTemplateNoError';
  }
}
