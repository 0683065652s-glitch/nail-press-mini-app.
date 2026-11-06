const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor("#4D0A0A");
  tg.setBackgroundColor("#FDFBE8");
}

const fingers = ["Великий", "Вказівний", "Середній", "Безіменний", "Мізинець"];

function renderMeasurements(hand, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = fingers.map((finger, index) => {
    const id = `${hand}-${index}`;
    return `
      <div class="measure-row">
        <label for="${id}">${finger}, мм <span>*</span></label>
        <input id="${id}" type="number" inputmode="decimal" min="1" max="40" step="0.1"
          placeholder="Напр. 14" required aria-label="${hand === "left" ? "Ліва" : "Права"} рука, ${finger}">
      </div>`;
  }).join("");
}

renderMeasurements("left", "left-measurements");
renderMeasurements("right", "right-measurements");

const form = document.getElementById("order-form");
const submitButton = document.getElementById("submit-button");
const statusBox = document.getElementById("form-status");

function showStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = `form-status show ${type}`;
}

function collectHand(hand) {
  return fingers.map((_, index) => {
    const value = Number(document.getElementById(`${hand}-${index}`).value);
    return value;
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusBox.className = "form-status";

  const instagram = document.getElementById("instagram-design").value.trim();
  const description = document.getElementById("design-description").value.trim();

  if (!instagram && !description) {
    showStatus("Додай посилання на дизайн з Instagram або опиши власну ідею.", "error");
    document.getElementById("instagram-design").focus();
    return;
  }

  if (!tg?.initData) {
    showStatus("Відкрий цю форму через Telegram-бота, щоб надіслати заявку.", "error");
    return;
  }

  const left = collectHand("left");
  const right = collectHand("right");
  const allMeasurements = [...left, ...right];

  if (allMeasurements.some((value) => !Number.isFinite(value) || value <= 0 || value > 40)) {
    showStatus("Перевір усі 10 замірів: кожне значення має бути числом від 1 до 40 мм.", "error");
    return;
  }

  const payload = {
    initData: tg.initData,
    customer: {
      name: document.getElementById("name").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      telegram: document.getElementById("telegram").value.trim()
    },
    delivery: {
      novaPoshta: document.getElementById("nova-poshta").value.trim()
    },
    measurements: { left, right },
    design: { instagram, description }
  };

  submitButton.disabled = true;
  submitButton.textContent = "НАДСИЛАННЯ...";

  try {
    const response = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok || !result.ok) throw new Error(result.message || "Помилка надсилання.");

    showStatus("Заявку успішно надіслано! Дякуємо за замовлення 💅", "success");
    form.reset();
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
  } catch (error) {
    showStatus(error.message || "Не вдалося надіслати заявку. Спробуй ще раз.", "error");
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'НАДІСЛАТИ ЗАЯВКУ <span>↗</span>';
  }
});
