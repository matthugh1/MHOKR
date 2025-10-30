import { OKRStatus, MetricType } from '@okr-nexus/types';
export declare function calculateProgress(startValue: number, currentValue: number, targetValue: number, metricType: MetricType): number;
export declare function determineOKRStatus(progress: number, startDate: Date, endDate: Date, currentDate?: Date): OKRStatus;
export declare function slugify(text: string): string;
export declare function isValidEmail(email: string): boolean;
export declare function formatDate(date: Date): string;
export declare function parseDate(dateString: string): Date;
export declare function isPastDate(date: Date): boolean;
export declare function isFutureDate(date: Date): boolean;
export declare function getQuarter(date: Date): number;
export declare function getQuarterDateRange(year: number, quarter: number): {
    start: Date;
    end: Date;
};
export declare function truncate(text: string, maxLength: number, suffix?: string): string;
export declare function deepClone<T>(obj: T): T;
export declare function randomColor(): string;
export declare function delay(ms: number): Promise<void>;
export declare function retry<T>(fn: () => Promise<T>, maxAttempts?: number, delayMs?: number): Promise<T>;
export declare function chunk<T>(array: T[], size: number): T[][];
export declare function unique<T>(array: T[]): T[];
export declare function groupBy<T>(array: T[], key: keyof T): Record<string, T[]>;
//# sourceMappingURL=index.d.ts.map