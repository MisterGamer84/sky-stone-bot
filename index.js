const fetch = require('node-fetch');
const TelegramBot = require('node-telegram-bot-api');

const LOGIN = process.env.LOGIN;
const PASSWORD = process.env.PASSWORD;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_IDS = process.env.CHAT_IDS.split(',').map(id => id.trim());

const CHAT_URL = 'https://asstars.club/engine/ajax/controller.php?mod=light_chat';

let sessionCookie = null;
let lastId = null;

const bot = new TelegramBot(TELEGRAM_TOKEN);

// --- Получаем куки авторизации через форму входа ---
async function loginAndGetCookie() {
    // Обрати внимание на поля формы!
    const body = `login_name=${encodeURIComponent(LOGIN)}&login_password=${encodeURIComponent(PASSWORD)}&login=submit`;
    const resp = await fetch('https://asstars.club/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0'
        },
        body
    });
    // Собираем ВСЕ куки (а не только первую)
    const setCookie = resp.headers.raw()['set-cookie'];
    if (!setCookie) throw new Error('No cookie received');
    sessionCookie = setCookie.map(s => s.split(';')[0]).join('; ');
    console.log('[SkyStone] Получена кука:', sessionCookie);
}

async function fetchChat() {
    if (!sessionCookie) await loginAndGetCookie();
    let resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
            'Cookie': sessionCookie,
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'do=update&page_id=' // <- важно! иначе будет 403!
    });
    if (resp.status === 403 || resp.status === 401) {
        console.log('[SkyStone] Кука устарела, пробую логиниться заново...');
        await loginAndGetCookie();
        resp = await fetch(CHAT_URL, {
            method: 'POST',
            headers: {
                'Cookie': sessionCookie,
                'User-Agent': 'Mozilla/5.0',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'do=update&page_id='
        });
    }
    if (!resp.ok) throw new Error('Чат недоступен: ' + resp.status);
    return await resp.text();
}

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

// --- СТАРТ ---
async function main() {
    try {
        await loginAndGetCookie();

        setInterval(async () => {
            try {
                const html = await fetchChat();
                const messages = parseChat(html);

                if (messages.length) {
                    const last = messages[messages.length - 1];
                    console.log(`[SkyStone] ${last.author}: ${last.text}`);
                    // Тут можешь добавить отправку в Телегу
                }
            } catch (err) {
                console.error('[SkyStone] Ошибка при обновлении чата:', err);
            }
        }, 20000);
    } catch (err) {
        console.error('[SkyStone] Не удалось запустить:', err);
        process.exit(1);
    }
}

main();
