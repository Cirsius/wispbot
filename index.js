const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { client: wisp } = require('@mercuryworkshop/wisp-js/client');
const fs = require('fs');

function loadConfig() {
    if (fs.existsSync('./bot-config.json')) {
        let cfg = JSON.parse(fs.readFileSync('./bot-config.json', 'utf8'));
        if (!cfg.channels) cfg.channels = [];
        return cfg;
    }
    const defaultConfig = {
        token: 'bot token',
        ownerId: 'ur user id',
        channels: []
    };
    fs.writeFileSync('./bot-config.json', JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
}

function loadServers() {
    if (fs.existsSync('./servers.json')) {
        return JSON.parse(fs.readFileSync('./servers.json', 'utf8'));
    }
    return [];
}

let config = loadConfig();
let servers = loadServers();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

function checkWisp(url) {
    return new Promise((resolve) => {
        let done = false;
        let start = Date.now();
        if (!url.endsWith('/')) url = url + '/';
        try {
            let conn = new wisp.ClientConnection(url);
            conn.onopen = () => {
                if (!done) {
                    done = true;
                    conn.close();
                    resolve(Date.now() - start);
                }
            };
            conn.onerror = () => {
                if (!done) {
                    done = true;
                    resolve(false);
                }
            };
            conn.onclose = () => {
                if (!done) {
                    done = true;
                    resolve(false);
                }
            };
            setTimeout(() => {
                if (!done) {
                    done = true;
                    resolve(false);
                }
            }, 5000);
        } catch (e) {
            resolve(false);
        }
    });
}

async function getLocation(url) {
    try {
        let host = new URL(url).hostname;
        let res = await fetch(`http://ip-api.com/json/${host}`);
        let data = await res.json();
        if (data.status === 'success') return `${data.countryCode}, ${data.city}`;
    } catch (e) { }
    return null;
}

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
        let channel = client.channels.cache.get(ch.id);
        if (!channel) continue;
        if (ch.msgId) {
            try {
                let msg = await channel.messages.fetch(ch.msgId);
                await msg.edit(createEmbed());
            } catch (e) {
                let msg = await channel.send(createEmbed());
                ch.msgId = msg.id;
                fs.writeFileSync('./bot-config.json', JSON.stringify(config, null, 2));
            }
        } else {
            let msg = await channel.send(createEmbed());
            ch.msgId = msg.id;
            fs.writeFileSync('./bot-config.json', JSON.stringify(config, null, 2));
        }
    }
}

async function recheckServers() {
    let results = await Promise.all(servers.map(async (s) => {
        let url = typeof s === 'string' ? s : s.url;
        let alive = await checkWisp(url);
        let loc = s.location;
        if (alive !== false && (typeof s === 'string' || !s.location || !s.location.includes(','))) {
            loc = await getLocation(url);
        }
        return { url, alive: alive !== false, location: loc };
    }));

    let removed = [];
    let newServers = [];
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
        fs.writeFileSync('./servers.json', JSON.stringify(servers, null, 2));
        await updateEmbed();
    }
    if (removed.length > 0) console.log(`removed dead servers: ${removed.join(', ')}`);
}

client.once('clientReady', async () => {
    console.log(`logged in as ${client.user.tag}`);
    await updateEmbed();
    await recheckServers();
    setInterval(recheckServers, 24 * 60 * 60 * 1000);
});

client.on('messageCreate', async message => {
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
            fs.writeFileSync('./servers.json', JSON.stringify(servers, null, 2));
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
        fs.writeFileSync('./servers.json', JSON.stringify(servers, null, 2));
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
        fs.writeFileSync('./bot-config.json', JSON.stringify(config, null, 2));
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
        fs.writeFileSync('./bot-config.json', JSON.stringify(config, null, 2));
        await message.reply('removed');
    }
});

client.login(config.token);
const { Hono } = require('hono');
const { server: { ServerConnection } } = require('@mercuryworkshop/wisp-js/server');

const app = new Hono();

app.get('/api/servers', (c) => c.json(servers));

let conns = new Map();

Bun.serve({
    port: 6741,
    fetch(req, server) {
        if (req.headers.get('upgrade') === 'websocket' && server.upgrade(req)) return;
        return app.fetch(req);
    },
    websocket: {
        open(ws) {
            let a = { readyState: 1, OPEN: 1, bufferedAmount: 0, send: d => ws.sendBinary(d), close: () => ws.close(), ping: () => ws.ping() };
            conns.set(ws, a);
            let c = new ServerConnection(a, '/', { ping_interval: 30 });
            c.setup().then(() => c.run()).catch(() => ws.close());
        },
        message(ws, data) { conns.get(ws)?.onmessage?.({ data }); },
        close(ws) { let a = conns.get(ws); if (a) { a.readyState = 3; a.onclose?.(); conns.delete(ws); } },
    },
});

console.log('wisp server running on ws://localhost:6741/');
console.log('api running on http://localhost:6741/api/servers');
