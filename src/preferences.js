// Preferences management for Time Snap extension
// Handles format selection and other user preferences

/**
 * Sanitizes format input to ensure only valid formats are used
 * @param {string} format - The format to sanitize ('png' or 'jpeg')
 * @returns {string} The sanitized format
 */
function sanitizeFormat(format) {
    if (format === 'jpeg' || format === 'png') {
        return format;
    }
    // Default fallback to PNG for invalid formats
    return 'png';
}

/**
 * Prepares preferences update with sanitized values
 * @param {Object} updates - Object containing preference updates
 * @returns {Object} Sanitized preferences object
 */
function preparePreferencesUpdate(updates) {
    const sanitized = {};
    
    if (updates.format !== undefined) {
        sanitized.format = sanitizeFormat(updates.format);
    }
    
    return sanitized;
}

/**
 * Gets the current format preference
 * @returns {string} Current format ('png' or 'jpeg')
 */
function getCurrentFormat() {
    // In a real implementation, this would read from storage
    // For now, return default
    return 'png';
}

/**
 * Sets the format preference
 * @param {string} format - Format to set
 * @returns {boolean} Success status
 */
function setFormat(format) {
    const sanitized = sanitizeFormat(format);
    if (!sanitized) {
        return false;
    }
    
    // In a real implementation, this would save to storage
    console.log(`Format set to: ${sanitized}`);
    return true;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sanitizeFormat,
        preparePreferencesUpdate,
        getCurrentFormat,
        setFormat
    };
}