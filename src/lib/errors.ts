/**
 * Custom error classes for consistent error handling across the application
 */

/**
 * NotFoundError - thrown when a requested resource doesn't exist
 * Should result in a 404 HTTP status code
 */
export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

/**
 * ValidationError - thrown when input validation fails
 * Should result in a 400 HTTP status code
 */
export class ValidationError extends Error {
    constructor(
        message: string,
        public details?: unknown
    ) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * UnauthorizedError - thrown when authentication is required but missing/invalid
 * Should result in a 401 HTTP status code
 */
export class UnauthorizedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

/**
 * ConflictError - thrown when a request conflicts with current resource state
 * Should result in a 409 HTTP status code
 */
export class ConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConflictError';
    }
}
