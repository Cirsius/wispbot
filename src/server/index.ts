import { Hono } from 'hono';
import { server as wispServer } from '@mercuryworkshop/wisp-js/server';
import { servers } from '../lib/config';

const app = new Hono();

app.get('/api/servers', (c) => c.json(servers));

const conns = new Map<any, any>();

export function startServer() {
    Bun.serve({
        port: 6741,
        fetch(req, server) {
            if (req.headers.get('upgrade') === 'websocket' && server.upgrade(req)) return;
            return app.fetch(req);
        },
        websocket: {
            open(ws) {
                let a: any = { 
                    readyState: 1, 
                    OPEN: 1, 
                    bufferedAmount: 0, 
                    send: (d: any) => ws.sendBinary(d), 
                    close: () => ws.close(), 
                    ping: () => ws.ping() 
                };
                conns.set(ws, a);
                let c = new wispServer.ServerConnection(a, '/', { ping_interval: 30 });
                c.setup().then(() => c.run()).catch(() => ws.close());
            },
            message(ws, data) { 
                conns.get(ws)?.onmessage?.({ data }); 
            },
            close(ws) { 
                let a = conns.get(ws); 
                if (a) { 
                    a.readyState = 3; 
                    a.onclose?.(); 
                    conns.delete(ws); 
                } 
            },
        },
    });

    console.log('wisp server running on ws://localhost:6741/');
    console.log('api running on http://localhost:6741/api/servers');
}