const { body, param, query, validationResult } = require('express-validator');
const { validators } = require('../config/security');

/**
 * Input Validation Middleware
 * Provides comprehensive validation for all API inputs
 */
class ValidationMiddleware {
    /**
     * Handle validation errors
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static handleValidationErrors(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(error => ({
                field: error.path,
                message: error.msg,
                value: error.value
            }));

            console.warn('[VALIDATION] Input validation failed:', {
                errors: errorMessages,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date().toISOString()
            });

            return res.status(400).json({
                error: true,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: errorMessages
            });
        }
        next();
    }

    /**
     * Sanitize input data
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static sanitizeInput(req, res, next) {
        try {
            // Sanitize body
            if (req.body) {
                Object.keys(req.body).forEach(key => {
                    if (typeof req.body[key] === 'string') {
                        req.body[key] = validators.sanitizeInput(req.body[key]);
                    }
                });
            }

            // Sanitize query parameters
            if (req.query) {
                Object.keys(req.query).forEach(key => {
                    if (typeof req.query[key] === 'string') {
                        req.query[key] = validators.sanitizeInput(req.query[key]);
                    }
                });
            }

            // Sanitize URL parameters
            if (req.params) {
                Object.keys(req.params).forEach(key => {
                    if (typeof req.params[key] === 'string') {
                        req.params[key] = validators.sanitizeInput(req.params[key]);
                    }
                });
            }

            next();
        } catch (error) {
            console.error('[VALIDATION] Sanitization error:', error);
            return res.status(500).json({
                error: true,
                message: 'Input sanitization failed',
                code: 'SANITIZATION_ERROR'
            });
        }
    }

    /**
     * Client registration validation rules
     */
    static clientRegistrationRules() {
        return [
            body('clientFullName')
                .trim()
                .isLength({ min: 2, max: 100 })
                .withMessage('Client name must be between 2 and 100 characters')
                .matches(/^[a-zA-Z\s\-']+$/)
                .withMessage('Client name can only contain letters, spaces, hyphens, and apostrophes')
                .customSanitizer(value => validators.sanitizeInput(value)),

            body('email')
                .trim()
                .isEmail()
                .withMessage('Please provide a valid email address')
                .normalizeEmail()
                .customSanitizer(value => validators.sanitizeInput(value)),

            body('phone')
                .trim()
                .matches(/^[\+]?[1-9][\d]{0,15}$/)
                .withMessage('Please provide a valid phone number')
                .customSanitizer(value => validators.sanitizeInput(value)),

            body('address')
                .trim()
                .isLength({ min: 5, max: 500 })
                .withMessage('Address must be between 5 and 500 characters')
                .customSanitizer(value => validators.sanitizeInput(value)),

            body('serviceType')
                .optional()
                .trim()
                .isLength({ min: 2, max: 100 })
                .withMessage('Service type must be between 2 and 100 characters')
                .customSanitizer(value => validators.sanitizeInput(value)),

            body('responsable')
                .optional()
                .trim()
                .isLength({ min: 2, max: 100 })
                .withMessage('Responsable must be between 2 and 100 characters')
                .customSanitizer(value => validators.sanitizeInput(value)),

            body('customerStatus')
                .optional()
                .isIn(['Active', 'Pending', 'Inactive'])
                .withMessage('Status must be Active, Pending, or Inactive')
        ];
    }

    /**
     * User authentication validation rules
     */
    static authenticationRules() {
        return [
            body('email')
                .trim()
                .isEmail()
                .withMessage('Please provide a valid email address')
                .normalizeEmail()
                .customSanitizer(value => validators.sanitizeInput(value)),

            body('password')
                .isLength({ min: 8 })
                .withMessage('Password must be at least 8 characters long')
                .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
                .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
        ];
    }

    /**
     * User registration validation rules
     */
    static userRegistrationRules() {
        return [
            body('fullName')
                .trim()
                .isLength({ min: 2, max: 100 })
                .withMessage('Full name must be between 2 and 100 characters')
                .matches(/^[a-zA-Z\s\-']+$/)
                .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes')
                .customSanitizer(value => validators.sanitizeInput(value)),

            body('email')
                .trim()
                .isEmail()
                .withMessage('Please provide a valid email address')
                .normalizeEmail()
                .customSanitizer(value => validators.sanitizeInput(value)),

            body('password')
                .isLength({ min: 8 })
                .withMessage('Password must be at least 8 characters long')
                .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
                .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

            body('confirmPassword')
                .custom((value, { req }) => {
                    if (value !== req.body.password) {
                        throw new Error('Password confirmation does not match password');
                    }
                    return true;
                }),

            body('role')
                .optional()
                .isIn(['admin', 'user', 'inspector'])
                .withMessage('Role must be admin, user, or inspector'),

            body('company')
                .optional()
                .trim()
                .isLength({ min: 2, max: 100 })
                .withMessage('Company must be between 2 and 100 characters')
                .customSanitizer(value => validators.sanitizeInput(value))
        ];
    }

    /**
     * Client search validation rules
     */
    static clientSearchRules() {
        return [
            query('search')
                .optional()
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('Search term must be between 1 and 100 characters')
                .customSanitizer(value => validators.sanitizeInput(value)),

            query('company')
                .optional()
                .trim()
                .isLength({ min: 2, max: 100 })
                .withMessage('Company must be between 2 and 100 characters')
                .customSanitizer(value => validators.sanitizeInput(value)),

            query('status')
                .optional()
                .isIn(['Active', 'Pending', 'Inactive'])
                .withMessage('Status must be Active, Pending, or Inactive'),

            query('page')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Page must be a positive integer'),

            query('limit')
                .optional()
                .isInt({ min: 1, max: 100 })
                .withMessage('Limit must be between 1 and 100')
        ];
    }

    /**
     * Client ID validation rules
     */
    static clientIdRules() {
        return [
            param('clientId')
                .trim()
                .isLength({ min: 1, max: 50 })
                .withMessage('Client ID must be between 1 and 50 characters')
                .matches(/^[a-zA-Z0-9\-_]+$/)
                .withMessage('Client ID can only contain letters, numbers, hyphens, and underscores')
                .customSanitizer(value => validators.sanitizeInput(value))
        ];
    }

    /**
     * Report creation validation rules
     */
    static reportCreationRules() {
        return [
            body('clientName')
                .trim()
                .isLength({ min: 2, max: 100 })
                .withMessage('Client name must be between 2 and 100 characters')
                .matches(/^[a-zA-Z\s\-']+$/)
                .withMessage('Client name can only contain letters, spaces, hyphens, and apostrophes')
                .customSanitizer(value => validators.sanitizeInput(value)),

            body('inspectorName')
                .trim()
                .isLength({ min: 2, max: 100 })
                .withMessage('Inspector name must be between 2 and 100 characters')
                .matches(/^[a-zA-Z\s\-']+$/)
                .withMessage('Inspector name can only contain letters, spaces, hyphens, and apostrophes')
                .customSanitizer(value => validators.sanitizeInput(value)),

            body('inspectionDate')
                .optional()
                .isISO8601()
                .withMessage('Inspection date must be a valid ISO 8601 date'),

            body('observations')
                .optional()
                .isLength({ max: 2000 })
                .withMessage('Observations must not exceed 2000 characters')
                .customSanitizer(value => validators.sanitizeInput(value)),

            body('recommendations')
                .optional()
                .isLength({ max: 2000 })
                .withMessage('Recommendations must not exceed 2000 characters')
                .customSanitizer(value => validators.sanitizeInput(value)),

            body('company')
                .optional()
                .trim()
                .isLength({ min: 2, max: 100 })
                .withMessage('Company must be between 2 and 100 characters')
                .customSanitizer(value => validators.sanitizeInput(value))
        ];
    }

    /**
     * File upload validation rules
     */
    static fileUploadRules() {
        return [
            body('fileType')
                .optional()
                .isIn(['image', 'document'])
                .withMessage('File type must be image or document'),

            body('maxSize')
                .optional()
                .isInt({ min: 1, max: 10485760 }) // 10MB
                .withMessage('Max file size must be between 1 and 10MB')
        ];
    }

    /**
     * Pagination validation rules
     */
    static paginationRules() {
        return [
            query('page')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Page must be a positive integer'),

            query('limit')
                .optional()
                .isInt({ min: 1, max: 100 })
                .withMessage('Limit must be between 1 and 100'),

            query('sortBy')
                .optional()
                .isLength({ min: 1, max: 50 })
                .withMessage('Sort field must be between 1 and 50 characters')
                .customSanitizer(value => validators.sanitizeInput(value)),

            query('sortOrder')
                .optional()
                .isIn(['asc', 'desc'])
                .withMessage('Sort order must be asc or desc')
        ];
    }

    /**
     * Date range validation rules
     */
    static dateRangeRules() {
        return [
            query('startDate')
                .optional()
                .isISO8601()
                .withMessage('Start date must be a valid ISO 8601 date'),

            query('endDate')
                .optional()
                .isISO8601()
                .withMessage('End date must be a valid ISO 8601 date')
                .custom((value, { req }) => {
                    const startDate = req.query.startDate;
                    if (startDate && new Date(value) <= new Date(startDate)) {
                        throw new Error('End date must be after start date');
                    }
                    return true;
                })
        ];
    }

    /**
     * Email validation rules
     */
    static emailRules() {
        return [
            body('email')
                .trim()
                .isEmail()
                .withMessage('Please provide a valid email address')
                .normalizeEmail()
                .customSanitizer(value => validators.sanitizeInput(value))
        ];
    }

    /**
     * Password change validation rules
     */
    static passwordChangeRules() {
        return [
            body('currentPassword')
                .isLength({ min: 8 })
                .withMessage('Current password must be at least 8 characters long'),

            body('newPassword')
                .isLength({ min: 8 })
                .withMessage('New password must be at least 8 characters long')
                .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
                .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
                .custom((value, { req }) => {
                    if (value === req.body.currentPassword) {
                        throw new Error('New password must be different from current password');
                    }
                    return true;
                }),

            body('confirmNewPassword')
                .custom((value, { req }) => {
                    if (value !== req.body.newPassword) {
                        throw new Error('Password confirmation does not match new password');
                    }
                    return true;
                })
        ];
    }

    /**
     * API key validation rules
     */
    static apiKeyRules() {
        return [
            body('apiKey')
                .trim()
                .isLength({ min: 32, max: 64 })
                .withMessage('API key must be between 32 and 64 characters')
                .matches(/^[a-zA-Z0-9]+$/)
                .withMessage('API key can only contain letters and numbers')
                .customSanitizer(value => validators.sanitizeInput(value))
        ];
    }
}

module.exports = ValidationMiddleware; 