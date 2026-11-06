require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { Telegraf } = require("telegraf");

const { BOT_TOKEN, ADMIN_CHAT_ID, PORT = 3000 } = process.env;

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
  console.error("Заповни BOT_TOKEN та ADMIN_CHAT_ID у файлі .env");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(express.json({ limit: "30kb" }));
const fs = require("fs");

const publicFolder = fs.existsSync(path.join(__dirname, "public", "index.html"))
  ? path.join(__dirname, "public")
  : __dirname;

app.use(express.static(publicFolder));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicFolder, "index.html"));
});

function verifyTelegramInitData(initData) {
  if (!initData) return false;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHash, "hex"),
      Buffer.from(hash, "hex")
    );
  } catch {
    return false;
  }
}

bot.start((ctx) => {
  ctx.reply(
    "Вітаємо у NAIL.PRESS! Натисніть кнопку меню, щоб відкрити форму замовлення."
  );
});

bot.catch((err) => console.error("Помилка Telegram-бота:", err));

app.post("/api/order", async (req, res) => {
  try {
    const { initData, customer, delivery, measurements, design } = req.body;

    if (!verifyTelegramInitData(initData)) {
      return res.status(401).json({
        ok: false,
        message: "Не вдалося підтвердити запуск через Telegram. Відкрийте форму з меню бота."
      });
    }

    const required = [
      customer?.name,
      customer?.phone,
      customer?.telegram,
      delivery?.novaPoshta,
      design?.description || design?.instagram
    ];

    if (required.some((value) => !String(value || "").trim())) {
      return res.status(400).json({ ok: false, message: "Заповніть усі обов'язкові поля." });
    }

    const fingers = [
      "Великий", "Вказівний", "Середній", "Безіменний", "Мізинець"
    ];

    for (const hand of ["left", "right"]) {
      if (!Array.isArray(measurements?.[hand]) ||
          measurements[hand].length !== 5 ||
          measurements[hand].some((v) => !Number.isFinite(Number(v)) || Number(v) <= 0 || Number(v) > 40)) {
        return res.status(400).json({ ok: false, message: "Перевірте всі 10 замірів у міліметрах." });
      }
    }

    const formatHand = (label, values) =>
      `${label}: ${values.map((v, i) => `${fingers[i]} — ${v} мм`).join("; ")}`;

    const message = [
      "💅 НОВА ЗАЯВКА — NAIL.PRESS",
      "",
      `👤 ПІБ: ${customer.name}`,
      `📞 Телефон: ${customer.phone}`,
      `✈️ Telegram: ${customer.telegram}`,
      `📦 Нова пошта: ${delivery.novaPoshta}`,
      "",
      "📏 ЗАМІРИ:",
      formatHand("Ліва рука", measurements.left),
      formatHand("Права рука", measurements.right),
      "",
      "🎨 ДИЗАЙН:",
      design.instagram ? `Instagram: ${design.instagram}` : "",
      design.description ? `Опис: ${design.description}` : "",
      "",
      `🕒 Час: ${new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}`
    ].filter(Boolean).join("\n");

    await bot.telegram.sendMessage(ADMIN_CHAT_ID, message, {
      disable_web_page_preview: true
    });

    return res.json({ ok: true, message: "Заявку успішно надіслано!" });
  } catch (error) {
    console.error("Помилка надсилання заявки:", error);
    return res.status(500).json({
      ok: false,
      message: "Не вдалося надіслати заявку. Спробуйте ще раз трохи пізніше."
    });
  }
});

bot.launch().then(() => console.log("Telegram-бот запущено"));
app.listen(PORT, () => console.log(`Сервер працює на порту ${PORT}`));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
