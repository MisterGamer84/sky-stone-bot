const fetch = require('node-fetch');
const TelegramBot = require('node-telegram-bot-api');

const LOGIN = process.env.LOGIN;
const PASSWORD = process.env.PASSWORD;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_IDS = process.env.CHAT_IDS.split(',').map(id => id.trim());

const CHAT_URL = 'https://asstars.club/engine/ajax/controller.php?mod=light_chat';

let sessionCookie = null;

const bot = new TelegramBot(TELEGRAM_TOKEN);

async function loginAndGetCookie() {
    const resp = await fetch('https://asstars.club/login/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0'
        },
        body: `login=${encodeURIComponent(LOGIN)}&password=${encodeURIComponent(PASSWORD)}`
    });
    // Cookie обычно приходит в set-cookie (может быть массив)
    const setCookie = resp.headers.raw()['set-cookie'];
    if (!setCookie) throw new Error('No cookie received');
    // Обычно нужная PHPSESSID или похожее
    sessionCookie = setCookie.map(s => s.split(';')[0]).join('; ');
    console.log('[SkyStone] Получена кука:', sessionCookie);
}

async function fetchChat() {
    if (!sessionCookie) await loginAndGetCookie();
    let resp = await fetch(CHAT_URL, {
        headers: {
            'Cookie': sessionCookie,
            'User-Agent': 'Mozilla/5.0'
        }
    });
    if (resp.status === 403 || resp.status === 401) {
        console.log('[SkyStone] Кука устарела, пробую логиниться заново...');
        await loginAndGetCookie();
        resp = await fetch(CHAT_URL, {
            headers: {
                'Cookie': sessionCookie,
                'User-Agent': 'Mozilla/5.0'
            }
        });
    }
    if (!resp.ok) throw new Error('Чат недоступен: ' + resp.status);
    return await resp.text();
}

let lastId = null;

function parseChat(html) {
    const regex = /<li data-id="(\d+)"[\s\S]+?<a [^>]+class="lc_chat_li_autor[^"]*"[^>]*>(.*?)<\/a>[\s\S]+?<div class="lc_chat_li_text"[^>]*>(.*?)<\/div>/g;
    let messages = [];
    let m;
    while ((m = regex.exec(html))) {
        messages.push({
            id: m[1],
            author: m[2].replace(/(<([^>]+)>)/gi, '').trim(),
            text: m[3].replace(/(<([^>]+)>)/gi, '').trim()
        });
    }
    return messages;
}

// Какая фраза нам нужна:
const KEY_PH
