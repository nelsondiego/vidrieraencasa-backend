/**
 * Configuration for retry behavior
 */
interface RetryConfig {
  maxAttempts: number;
  delays: number[]; // Delay in milliseconds for each retry attempt
}

/**
 * Default retry configuration: 3 attempts with exponential backoff
 * Delays: 1s, 2s, 4s
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delays: [1000, 2000, 4000],
};

/**
 * Determines if an error should trigger a retry
 */
function shouldRetry(
  error: unknown,
  attempt: number,
  maxAttempts: number
): boolean {
  // Don't retry if we've exhausted all attempts
  if (attempt >= maxAttempts) {
    return false;
  }

  // Handle different error types
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();

    // Network errors - retry
    if (
      errorMessage.includes("network") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("econnrefused") ||
      errorMessage.includes("enotfound")
    ) {
      return true;
    }

    // Rate limit (429) - retry
    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      return true;
    }

    // Server errors (5xx) - retry
    if (errorMessage.includes("500") || errorMessage.includes("503")) {
      return true;
    }

    // Invalid API key - don't retry
    if (
      errorMessage.includes("api key") ||
      errorMessage.includes("unauthorized") ||
      errorMessage.includes("401")
    ) {
      return false;
    }

    // Other 4xx errors - don't retry
    if (errorMessage.includes("400") || errorMessage.includes("404")) {
      return false;
    }
  }

  // Default: retry for unknown errors
  return true;
}

/**
 * Delays execution for the specified number of milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a function with retry logic and exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      // Attempt to execute the function
      const result = await fn();

      // Success - return the result
      if (attempt > 1) {
        console.log(`Operation succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;

      // Log the error
      console.warn(`Attempt ${attempt}/${config.maxAttempts} failed:`, {
        error: error instanceof Error ? error.message : String(error),
      });

      // Check if we should retry
      if (!shouldRetry(error, attempt, config.maxAttempts)) {
        console.error("Error is not retryable, failing immediately");
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === config.maxAttempts) {
        console.error("All retry attempts exhausted");
        throw error;
      }

      // Wait before retrying (exponential backoff)
      const delayMs =
        config.delays[attempt - 1] || config.delays[config.delays.length - 1];
      console.log(`Retrying in ${delayMs}ms...`);
      await delay(delayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}
