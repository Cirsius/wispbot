export interface BotConfig {
    token: string;
    ownerId: string;
    channels: { id: string; msgId: string | null }[];
}

export interface ServerEntry {
    url: string;
    location?: string | null;
}