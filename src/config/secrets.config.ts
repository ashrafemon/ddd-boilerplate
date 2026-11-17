import { registerAs } from '@nestjs/config';
import { booleanEnv } from '@common/application/utils/env.util';

export type ISecretsManagerConfig = { enabled: boolean; region: string; endpoint?: string };

/**
 * AWS Secrets Manager config. Opt-in (`SECRETS_MANAGER_ENABLED`) — the app
 * boots from env secrets by default; enabling this wires the client for the
 * platform secrets capability to use. Disabled is a legitimate production
 * choice, so there is no fail-closed on the flag itself; fail-closed applies
 * only when enabled but unreachable.
 */
export default registerAs('secretsManager', () => ({
  enabled: booleanEnv('SECRETS_MANAGER_ENABLED', false),
  region: process.env.SECRETS_MANAGER_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
  endpoint: process.env.SECRETS_MANAGER_ENDPOINT ?? '',
}));
