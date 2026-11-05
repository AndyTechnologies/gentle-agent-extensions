import { EXTENSION_NAME } from "./constants.js";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface Logger {
	info(message: string): void;
	warn(message: string): void;
	error(message: string): void;
	debug(message: string): void;
}

function formatMessage(level: LogLevel, message: string): string {
	return `[${EXTENSION_NAME}] ${level.toUpperCase()}: ${message}`;
}

export const logger: Logger = {
	info(message: string): void {
		console.log(formatMessage("info", message));
	},
	warn(message: string): void {
		console.warn(formatMessage("warn", message));
	},
	error(message: string): void {
		console.error(formatMessage("error", message));
	},
	debug(message: string): void {
		if (process.env["DEBUG"]?.includes(EXTENSION_NAME)) {
			console.log(formatMessage("debug", message));
		}
	},
};

export function createPrefixedLogger(prefix: string): Logger {
	return {
		info(message: string): void {
			logger.info(`${prefix} ${message}`);
		},
		warn(message: string): void {
			logger.warn(`${prefix} ${message}`);
		},
		error(message: string): void {
			logger.error(`${prefix} ${message}`);
		},
		debug(message: string): void {
			logger.debug(`${prefix} ${message}`);
		},
	};
}