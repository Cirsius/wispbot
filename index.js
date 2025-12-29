const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { client: wisp } = require('@mercuryworkshop/wisp-js/client');
const fs = require('fs');

function loadConfig() {
    if (fs.existsSync('./bot-config.json')) {
        return JSON.parse(fs.readFileSync('./bot-config.json', 'utf8'));
    }
    const defaultConfig = {
        token: 'bot token',
        ownerId: 'ur user id',
        channelId: null,
        embedMessageId: null
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

function createEmbed() {
    const embed = new EmbedBuilder()
        .setTitle('wisp servers')
        .setColor('#5865F2')
        .setDescription(servers.length > 0 ? servers.join('\n') : 'no servers yet')
        .setFooter({ text: 'usage: !addwisp <url>' });
    return { embeds: [embed] };
}

async function updateEmbed() {
    if (!config.channelId) return;
    const channel = client.channels.cache.get(config.channelId);
    if (!channel) return;

    if (config.embedMessageId) {
        try {
            const msg = await channel.messages.fetch(config.embedMessageId);
            await msg.edit(createEmbed());
        } catch (e) {
            const msg = await channel.send(createEmbed());
            config.embedMessageId = msg.id;
            fs.writeFileSync('./bot-config.json', JSON.stringify(config, null, 2));
        }
    } else {
        const msg = await channel.send(createEmbed());
        config.embedMessageId = msg.id;
        fs.writeFileSync('./bot-config.json', JSON.stringify(config, null, 2));
    }
}

async function recheckServers() {
    let removed = [];
    for (let i = servers.length - 1; i >= 0; i--) {
        const result = await checkWisp(servers[i]);
        if (result === false) {
            removed.push(servers[i]);
            servers.splice(i, 1);
        }
    }
    if (removed.length > 0) {
        fs.writeFileSync('./servers.json', JSON.stringify(servers, null, 2));
        await updateEmbed();
        console.log(`removed dead servers: ${removed.join(', ')}`);
    }
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
        if (servers.includes(url)) {
            await message.reply('already in list');
            return;
        }

        await message.reply('checking');
        const result = await checkWisp(url);
        if (result !== false) {
            servers.push(url);
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
        const index = servers.indexOf(url);
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
        config.channelId = message.channel.id;
        config.embedMessageId = null;
        fs.writeFileSync('./bot-config.json', JSON.stringify(config, null, 2));
        await updateEmbed();
    }
});

client.login(config.token);
const { Hono } = require('hono');
const app = new Hono();

app.get('/api/servers', (c) => c.json(servers));

Bun.serve({ port: 6741, fetch: app.fetch });
console.log('api running on http://localhost:6741');
