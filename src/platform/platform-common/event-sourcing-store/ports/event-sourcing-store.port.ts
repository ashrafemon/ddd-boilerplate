/**
 * Event Sourcing Store port — DEFERRED.
 *
 * Domain events do not imply event sourcing. This port is a placeholder
 * for future event-stream persistence only if a specific requirement
 * for event replay and rebuilding aggregates from historical events arises.
 */
export abstract class EventSourcingStorePort {}
