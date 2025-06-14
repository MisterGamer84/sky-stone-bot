// index.js
const fetch = require('node-fetch');
const cheerio = require('cheerio');
require('dotenv').config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_IDS = process.env.CHAT_IDS?.split(',').map(id => id.trim()).filter(Boolean);
const CHECK_INTERVAL = Number(process.env.CHECK_INTERVAL || 20); // секунд

const CHAT_URL = "https://asstars.club/engine/ajax/controller.php?mod=light_chat";
const TARGET_USER = "ИИ Космический посикунчик";
const TARGET_PHRASE = "Шпион демонической секты отобрал 300 мешков с камнями духа, помогите их собрать";

let lastProcessedId = null;

async function fetchChat() {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    }
  });
  if (!res.ok) throw new Error("Чат недоступний: " + res.status);
  return await res.text();
}

function extractStoneMessageId(html) {
  const $ = cheerio.load(html);
  const items = $('[data-id]');
  let found = null;

  items.each((i, el) => {
    const $el = $(el);
    const user = $el.find('.lc_chat_li_autor').text().trim();
    const text = $el.find('.lc_chat_li_text').text().trim();
    const id = $el.attr('data-id');
    if (
      user === TARGET_USER &&
      text.includes(TARGET_PHRASE)
    ) {
      found = id;
    }
  });

  return found;
}

async function sendTelegramAlert(message) {
  if (!TELEGRAM_TOKEN || !CHAT_IDS?.length) return;
  for (const chatId of CHAT_IDS) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚠️ В чаті з’явилося повідомлення:\n\n<code>${message}</code>`,
        parse_mode: "HTML"
      })
    }).catch(console.error);
  }
}

async function check() {
  try {
    const html = await fetchChat();
    const msgId = extractStoneMessageId(html);
    if (msgId && msgId !== lastProcessedId) {
      lastProcessedId = msgId;
      const message = `Знайдено небесний камінь: ${msgId}`;
      console.log(`[SkyStone] ${message}`);
      await sendTelegramAlert(message);
    }
  } catch (e) {
    console.warn("[SkyStone] Error:", e.message);
  }
}

console.log(`[SkyStone] Старт сервера, интервал проверки: ${CHECK_INTERVAL} сек.`);
setInterval(check, CHECK_INTERVAL * 1000);
check();
