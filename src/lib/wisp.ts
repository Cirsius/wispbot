import { client as wisp } from '@mercuryworkshop/wisp-js/client';

export function checkWisp(url: string): Promise<number | false> {
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

export async function getLocation(url: string): Promise<string | null> {
    try {
        let host = new URL(url).hostname;
        let res = await fetch(`http://ip-api.com/json/${host}`);
        let data = await res.json() as { status: string; countryCode: string; city: string };
        if (data.status === 'success') return `${data.countryCode}, ${data.city}`;
    } catch (e) { }
    return null;
}