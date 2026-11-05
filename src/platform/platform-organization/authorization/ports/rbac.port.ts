export interface RbacCheck {
  userId: string;
  resource: string;
  action: string;
}

/**
 * Role-based access control port.
 *
 * Port definition only — no implementation (IAM deferred). The platform
 * layer will provide a concrete adapter backed by role/permission data.
 *
 * Business modules inject this port to check whether the current user is
 * allowed to perform an action on a resource.
 */
export abstract class RbacPort {
  abstract can(check: RbacCheck): Promise<boolean>;
}
