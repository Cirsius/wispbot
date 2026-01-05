import * as fs from 'fs';
import type { BotConfig, ServerEntry } from './types';

export let config: BotConfig;
export let servers: ServerEntry[] = [];

export function loadConfig(): BotConfig {
    if (fs.existsSync('./bot-config.json')) {
        let cfg = JSON.parse(fs.readFileSync('./bot-config.json', 'utf8'));
        if (!cfg.channels) cfg.channels = [];
        return cfg;
    }
    const defaultConfig: BotConfig = {
        token: 'bot token',
        ownerId: 'ur user id',
        channels: []
    };
    fs.writeFileSync('./bot-config.json', JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
}

export function loadServers(): ServerEntry[] {
    if (fs.existsSync('./servers.json')) {
        return JSON.parse(fs.readFileSync('./servers.json', 'utf8'));
    }
    return [];
}

export function saveConfig() {
    fs.writeFileSync('./bot-config.json', JSON.stringify(config, null, 2));
}

export function saveServers() {
    fs.writeFileSync('./servers.json', JSON.stringify(servers, null, 2));
}

export function init() {
    config = loadConfig();
    servers.push(...loadServers());
}