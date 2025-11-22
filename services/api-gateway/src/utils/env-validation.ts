/**
 * Environment Variable Validation
 * 
 * Validates required environment variables at startup.
 * Fails fast with clear error messages if required variables are missing.
 */

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

/**
 * Validates that a required environment variable is set
 * @param key - Environment variable key
 * @param value - Environment variable value
 * @param description - Description of what this variable is for
 * @throws EnvValidationError if value is missing or invalid
 */
export function validateRequiredEnv(
  key: string,
  value: string | undefined,
  description?: string,
): string {
  if (!value || value.trim() === '') {
    const desc = description ? ` (${description})` : '';
    throw new EnvValidationError(
      `Required environment variable ${key} is not set${desc}. ` +
      `Please set ${key} in your environment variables or .env file.`,
    );
  }
  return value;
}

/**
 * Validates that JWT_SECRET is set and not equal to the default value
 * @param value - JWT_SECRET value
 * @throws EnvValidationError if value is missing, empty, or equals 'default-secret'
 */
export function validateJwtSecret(value: string | undefined): string {
  const secret = validateRequiredEnv('JWT_SECRET', value, 'JWT signing secret');
  
  if (secret === 'default-secret') {
    throw new EnvValidationError(
      'JWT_SECRET cannot be set to "default-secret". ' +
      'Please set a secure, random value for JWT_SECRET in your environment variables or .env file.',
    );
  }
  
  if (secret.length < 32) {
    throw new EnvValidationError(
      `JWT_SECRET must be at least 32 characters long (current length: ${secret.length}). ` +
      'Please set a secure, random value for JWT_SECRET.',
    );
  }
  
  return secret;
}

/**
 * Validates all required environment variables for API Gateway
 * @throws EnvValidationError if any required variable is missing
 */
export function validateApiGatewayEnv(): void {
  const errors: string[] = [];
  
  try {
    validateJwtSecret(process.env.JWT_SECRET);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      errors.push(error.message);
    } else {
      errors.push(`JWT_SECRET validation failed: ${(error as Error).message}`);
    }
  }
  
  if (errors.length > 0) {
    throw new EnvValidationError(
      `Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`,
    );
  }
}

