"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateProgress = calculateProgress;
exports.determineOKRStatus = determineOKRStatus;
exports.slugify = slugify;
exports.isValidEmail = isValidEmail;
exports.formatDate = formatDate;
exports.parseDate = parseDate;
exports.isPastDate = isPastDate;
exports.isFutureDate = isFutureDate;
exports.getQuarter = getQuarter;
exports.getQuarterDateRange = getQuarterDateRange;
exports.truncate = truncate;
exports.deepClone = deepClone;
exports.randomColor = randomColor;
exports.delay = delay;
exports.retry = retry;
exports.chunk = chunk;
exports.unique = unique;
exports.groupBy = groupBy;
const types_1 = require("@okr-nexus/types");
function calculateProgress(startValue, currentValue, targetValue, metricType) {
    if (targetValue === startValue)
        return 0;
    let progress;
    switch (metricType) {
        case types_1.MetricType.INCREASE:
            progress = ((currentValue - startValue) / (targetValue - startValue)) * 100;
            break;
        case types_1.MetricType.DECREASE:
            progress = ((startValue - currentValue) / (startValue - targetValue)) * 100;
            break;
        case types_1.MetricType.REACH:
        case types_1.MetricType.MAINTAIN:
            progress = (currentValue / targetValue) * 100;
            break;
        default:
            progress = 0;
    }
    return Math.max(0, Math.min(100, progress));
}
function determineOKRStatus(progress, startDate, endDate, currentDate = new Date()) {
    if (progress >= 100)
        return types_1.OKRStatus.COMPLETED;
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = currentDate.getTime() - startDate.getTime();
    const timeProgress = (elapsed / totalDuration) * 100;
    if (timeProgress - progress > 15)
        return types_1.OKRStatus.OFF_TRACK;
    if (timeProgress - progress > 5)
        return types_1.OKRStatus.AT_RISK;
    return types_1.OKRStatus.ON_TRACK;
}
function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
function formatDate(date) {
    return date.toISOString();
}
function parseDate(dateString) {
    return new Date(dateString);
}
function isPastDate(date) {
    return date < new Date();
}
function isFutureDate(date) {
    return date > new Date();
}
function getQuarter(date) {
    return Math.floor(date.getMonth() / 3) + 1;
}
function getQuarterDateRange(year, quarter) {
    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    return { start, end };
}
function truncate(text, maxLength, suffix = '...') {
    if (text.length <= maxLength)
        return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
}
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
function randomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function retry(fn, maxAttempts = 3, delayMs = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await delay(delayMs * Math.pow(2, attempt - 1));
            }
        }
    }
    throw lastError;
}
function chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
function unique(array) {
    return Array.from(new Set(array));
}
function groupBy(array, key) {
    return array.reduce((result, item) => {
        const groupKey = String(item[key]);
        if (!result[groupKey]) {
            result[groupKey] = [];
        }
        result[groupKey].push(item);
        return result;
    }, {});
}
//# sourceMappingURL=index.js.map