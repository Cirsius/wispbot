import { Client, GatewayIntentBits, EmbedBuilder, TextChannel, Message } from 'discord.js';
import { config, servers, saveConfig, saveServers } from '../lib/config';
import { checkWisp, getLocation } from '../lib/wisp';
import type { ServerEntry } from '../lib/types';

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

function createEmbed() {
    let desc = 'no servers yet';
    if (servers.length > 0) {
        desc = servers.map(s => {
            if (typeof s === 'string') return s;
            return s.location ? `${s.url} (${s.location})` : s.url;
        }).join('\n');
    }
    const embed = new EmbedBuilder()
        .setTitle('wisp servers')
        .setColor('#5865F2')
        .setDescription(desc)
        .setFooter({ text: 'usage: !addwisp <url>' });
    return { embeds: [embed] };
}

async function updateEmbed() {
    for (let ch of config.channels) {
        let channel = client.channels.cache.get(ch.id) as TextChannel | undefined;
        if (!channel) continue;
        if (ch.msgId) {
            try {
                let msg = await channel.messages.fetch(ch.msgId);
                await msg.edit(createEmbed());
            } catch (e) {
                let msg = await channel.send(createEmbed());
                ch.msgId = msg.id;
                saveConfig();
            }
        } else {
            let msg = await channel.send(createEmbed());
            ch.msgId = msg.id;
            saveConfig();
        }
    }
}

async function recheckServers() {
    let results = await Promise.all(servers.map(async (s) => {
        let url = typeof s === 'string' ? s : s.url;
        let alive = await checkWisp(url);
        let loc = (s as ServerEntry).location;
        if (alive !== false && (typeof s === 'string' || !s.location || !s.location.includes(','))) {
            loc = await getLocation(url);
        }
        return { url, alive: alive !== false, location: loc };
    }));

    let removed: string[] = [];
    let newServers: ServerEntry[] = [];
    for (let r of results) {
        if (r.alive) {
            newServers.push({ url: r.url, location: r.location });
        } else {
            removed.push(r.url);
        }
    }

    if (removed.length > 0 || JSON.stringify(servers) !== JSON.stringify(newServers)) {
        servers.length = 0;
        servers.push(...newServers);
        saveServers();
        await updateEmbed();
    }
    if (removed.length > 0) console.log(`removed dead servers: ${removed.join(', ')}`);
}

export function setupBot() {
    client.once('clientReady', async () => {
        console.log(`logged in as ${client.user?.tag}`);
        await updateEmbed();
        await recheckServers();
        setInterval(recheckServers, 24 * 60 * 60 * 1000);
    });

    client.on('messageCreate', async (message: Message) => {
        if (message.author.bot) return;

        const args = message.content.split(' ');
        const command = args[0].toLowerCase();

        if (command === '!addwisp') {
            const url = args[1];
            if (!url) {
                await message.reply('usage: !addwisp <url>');
                return;
            }
            if (servers.some(s => (typeof s === 'string' ? s : s.url) === url)) {
                await message.reply('already in list');
                return;
            }

            await message.reply('checking');
            const result = await checkWisp(url);
            if (result !== false) {
                let loc = await getLocation(url);
                servers.push({ url: url, location: loc });
                saveServers();
                await updateEmbed();
                await message.reply(`added (${result}ms)`);
            } else {
                await message.reply('not a valid wisp server');
            }
        }

        if (command === '!removewisp') {
            if (message.author.id !== config.ownerId) return;
            const url = args[1];
            if (!url) {
                await message.reply('usage: !removewisp <url>');
                return;
            }
            const index = servers.findIndex(s => (typeof s === 'string' ? s : s.url) === url);
            if (index === -1) {
                await message.reply('not in list');
                return;
            }
            servers.splice(index, 1);
            saveServers();
            await updateEmbed();
            await message.reply(`removed ${url}`);
        }

        if (command === '!setchannel') {
            if (message.author.id !== config.ownerId) return;
            let exists = config.channels.find(c => c.id === message.channel.id);
            if (exists) {
                await message.reply('already set');
                return;
            }
            config.channels.push({ id: message.channel.id, msgId: null });
            saveConfig();
            await updateEmbed();
        }

        if (command === '!removechannel') {
            if (message.author.id !== config.ownerId) return;
            let idx = config.channels.findIndex(c => c.id === message.channel.id);
            if (idx === -1) {
                await message.reply('not set');
                return;
            }
            config.channels.splice(idx, 1);
            saveConfig();
            await message.reply('removed');
        }
    });

    client.login(config.token);
}