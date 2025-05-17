/**
 * Content script для расширения анонимизации данных
 * Кейс #2: Локальная анонимизация данных (AZ GROUP)
 */

// Глобальные настройки маскирования (загружаются из хранилища)
let maskSettings = {
  // Основные настройки
  SHOW_TOOLBAR: true,  // Показывать тулбар при выделении текста
  SHOW_LOCK_ICON: true,  // Показывать индикатор защиты в углу страницы

  // Типы данных для маскирования
  ИИН: true,
  EMAIL: true,
  ТЕЛЕФОН: true,
  ПАСПОРТ: true,
  КАРТА: true,
  "ДАТА РОЖДЕНИЯ": true,
  PERSON: true,
  ORG: true,
  LOC: true,
  GPE: true,
  ADDRESS: true
};

// Находим правильные селекторы для текстовых полей и кнопок отправки
function findChatElements() {
  // Селекторы для различных версий интерфейса
  const possibleInputSelectors = [
    'div[contenteditable="true"]', // Стандартный селектор
    'div[data-slate-editor="true"]', // Альтернативный селектор
    'textarea', // На некоторых версиях используется textarea
    '.text-input-with-focus' // Еще один возможный класс
  ];

  const possibleButtonSelectors = [
    '[data-testid="send-button"]',
    'button[aria-label="Send message"]',
    'button.send-button',
    'button.submit',
    'button.primary' // Общий селектор для основной кнопки
  ];

  // Поиск текстового поля
  let input = null;
  for (const selector of possibleInputSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      input = element;
      break;
    }
  }

  // Поиск кнопки отправки
  let sendButton = null;
  for (const selector of possibleButtonSelectors) {
    const button = document.querySelector(selector);
    if (button) {
      sendButton = button;
      break;
    }
  }

  return { input, sendButton };
}

// Загружаем настройки из хранилища при инициализации
function loadSettings() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get('maskSettings', (data) => {
        if (data.maskSettings) {
          maskSettings = data.maskSettings;
          console.log("Настройки загружены:", maskSettings);

          // Обновляем индикатор защиты после загрузки настроек
          if (maskSettings.SHOW_LOCK_ICON) {
            createSecurityIndicator();
          } else {
            removeSecurityIndicator();
          }
        } else {
          // Если настроек нет, сохраняем текущие
          try {
            chrome.storage.sync.set({ maskSettings });
            console.log("Настройки инициализированы:", maskSettings);
          } catch (e) {
            console.error("Ошибка при сохранении настроек:", e);
          }
        }
      });
    } else {
      console.warn("API хранилища Chrome недоступен");
    }
  } catch (e) {
    console.error("Ошибка при загрузке настроек:", e);
  }
}

// Удаление индикатора защиты
function removeSecurityIndicator() {
  const indicator = document.getElementById('anon-security-indicator');
  if (indicator) {
    indicator.style.opacity = "0";
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.remove();
      }
    }, 300);
  }
}

// Функция для проверки наличия чувствительных данных
function containsSensitiveData(text) {
  if (!text) return false;

  // Расширенное регулярное выражение для лучшего обнаружения
  const sensitiveDataRegex = /\b\d{12}\b|@|(\+7|8)[0-9]{10}|\b\d{16}\b|\b\d{9}\b|\b\d{2}[./-]\d{2}[./-]\d{4}\b/;
  return sensitiveDataRegex.test(text);
}

// Функция для маскирования чувствительных данных
function maskSensitiveData(text, aiEntities = []) {
  // Маскирование с помощью регулярных выражений
  if (maskSettings.ИИН) text = text.replace(/\b\d{12}\b/g, "[ИИН]");
  if (maskSettings.EMAIL) text = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[EMAIL]");
  if (maskSettings.ТЕЛЕФОН) text = text.replace(/(\+7|8)[0-9]{10}/g, "[ТЕЛЕФОН]");
  if (maskSettings.ПАСПОРТ) text = text.replace(/\b\d{9}\b/g, "[ПАСПОРТ]");
  if (maskSettings.КАРТА) text = text.replace(/\b\d{16}\b/g, "[КАРТА]");
  if (maskSettings["ДАТА РОЖДЕНИЯ"]) text = text.replace(/\b\d{2}[./-]\d{2}[./-]\d{4}\b/g, "[ДАТА РОЖДЕНИЯ]");
  if (maskSettings.ADDRESS) text = text.replace(/(?:ул\.|улица|проспект|пр\.|микрорайон|мкр\.|пр-т)\s+[\wА-Яа-я\-]+(?:\s*,?\s*(?:дом|д\.|уч\.)?\s*\d+)?(?:\s*,?\s*(?:кв\.|квартира|офис|оф\.)?\s*\d+)?/gi, "[ADDRESS]");

  // Маскирование с помощью данных от AI
  aiEntities.forEach(({ text: entityText, label }) => {
    if (maskSettings[label]) {
      const escaped = entityText.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const re = new RegExp(escaped, "g");
      text = text.replace(re, `[${label}]`);
    }
  });

  return text;
}

// Функция для анализа текста с использованием локального AI
async function analyzeWithLocalAI(text) {
  try {
    // Отображаем индикатор состояния
    showStatus("Анализ текста с помощью локальной AI...");

    const res = await fetch("http://localhost:5000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!res.ok) {
      throw new Error(`Сервер вернул ошибку: ${res.status}`);
    }

    const data = await res.json();

    // Очищаем статус
    hideStatus();

    return data.entities || [];
  } catch (err) {
    console.warn("⚠️ AI-сервер недоступен", err);
    // Показываем сообщение об ошибке
    showStatus("AI-сервер недоступен! ⚠️", "error");
    setTimeout(hideStatus, 3000);
    return [];
  }
}

// Функции для отображения статуса
let statusTimeout;

function showStatus(message, type = "info") {
  // Очищаем предыдущий таймаут, если есть
  if (statusTimeout) clearTimeout(statusTimeout);

  // Находим или создаем элемент статуса
  let statusEl = document.getElementById("anon-status");

  if (!statusEl) {
    statusEl = document.createElement("div");
    statusEl.id = "anon-status";
    statusEl.style = `
      position: fixed;
      z-index: 10000;
      bottom: 20px;
      right: 20px;
      background: #222;
      color: white;
      padding: 10px 15px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.2s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border-left: 4px solid #0d6efd;
    `;
    document.body.appendChild(statusEl);

    // Позволяем пользователю закрыть статус по клику
    statusEl.addEventListener("click", hideStatus);
  }

  // Меняем цвет границы в зависимости от типа
  if (type === "error") {
    statusEl.style.borderLeft = "4px solid #dc3545";
  } else if (type === "success") {
    statusEl.style.borderLeft = "4px solid #198754";
  } else {
    statusEl.style.borderLeft = "4px solid #0d6efd";
  }

  // Устанавливаем сообщение и показываем элемент
  statusEl.textContent = message;

  // Небольшая задержка перед показом для эффекта
  setTimeout(() => {
    statusEl.style.opacity = "1";
  }, 10);
}

function hideStatus() {
  const statusEl = document.getElementById("anon-status");
  if (statusEl) {
    statusEl.style.opacity = "0";
    statusTimeout = setTimeout(() => {
      if (statusEl.parentNode) {
        statusEl.remove();
      }
    }, 300);
  }
}

// Обработчик выделения текста
let toolbarActive = false;
let selectionTimeout;

// Функция для обновления тулбара при выделении текста
function updateToolbar() {
  // Проверяем, включен ли тулбар в настройках
  if (!maskSettings.SHOW_TOOLBAR) {
    return;
  }

  const { input } = findChatElements();
  const sel = window.getSelection();

  // Проверяем, что у нас есть выделение в редактируемом элементе
  if (!sel || sel.isCollapsed || !sel.toString().trim() || !input || !input.contains(sel.anchorNode)) {
    // Если нет выделения, скрываем тулбар
    const toolbar = document.getElementById("anon-toolbar");
    if (toolbar) {
      toolbar.style.opacity = "0";
      toolbar.style.transform = "translateY(-10px) scale(0.95)";
      setTimeout(() => {
        if (toolbar && toolbar.parentNode) {
          toolbar.remove();
          toolbarActive = false;
        }
      }, 300);
    }
    return;
  }

  const text = sel.toString().trim();

  // Если текст пустой или тулбар уже активен, не делаем ничего
  if (!text || toolbarActive) {
    return;
  }

  // Удаляем старый тулбар, если есть
  const old = document.getElementById("anon-toolbar");
  if (old) old.remove();

  // Получаем положение выделения
  const rect = sel.getRangeAt(0).getBoundingClientRect();

  // Создаем тулбар
  const toolbar = document.createElement("div");
  toolbar.id = "anon-toolbar";

  toolbar.style = `
    position: fixed;
    top: ${window.scrollY + rect.top - 50}px;
    left: ${window.scrollX + rect.left + rect.width / 2 - 90}px;
    background: #1e1e1e;
    color: white;
    padding: 12px 15px;
    border-radius: 8px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, sans-serif;
    z-index: 9999;
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
    transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    opacity: 0;
    transform: translateY(10px) scale(0.95);
    border: 1px solid #333;
    min-width: 180px;
    text-align: center;
  `;

  // Отмечаем тулбар как активный
  toolbarActive = true;

  // Делаем тулбар видимым с анимацией
  setTimeout(() => {
    toolbar.style.opacity = "1";
    toolbar.style.transform = "translateY(0) scale(1)";
  }, 10);

  // Создаем кнопку анонимизации
  const btn = document.createElement("button");
  btn.innerText = "🔒 Анонимизировать";
  btn.style = `
    background: #0d6efd;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 12px;
    cursor: pointer;
    font-weight: 500;
    font-size: 14px;
    transition: all 0.2s;
    display: block;
    width: 100%;
    margin-bottom: 8px;
    text-align: center;
    box-shadow: 0 2px 6px rgba(13, 110, 253, 0.3);
  `;

  // Добавляем эффекты при наведении
  btn.addEventListener('mouseenter', function () {
    this.style.background = '#0b5ed7';
    this.style.transform = 'translateY(-2px)';
    this.style.boxShadow = '0 4px 10px rgba(13, 110, 253, 0.4)';
  });

  btn.addEventListener('mouseleave', function () {
    this.style.background = '#0d6efd';
    this.style.transform = 'translateY(0)';
    this.style.boxShadow = '0 2px 6px rgba(13, 110, 253, 0.3)';
  });

  // Статус для тулбара
  const status = document.createElement("div");
  status.style = `
    font-size: 13px;
    margin-top: 8px;
    color: #aaa;
    text-align: center;
    height: 16px;
    font-weight: 400;
  `;

  // Действие при клике на кнопку
  btn.onclick = async () => {
    try {
      // Обновляем кнопку и статус
      btn.innerHTML = '<span class="spinner"></span> Обработка...';
      btn.disabled = true;
      btn.style.background = '#6c757d';
      btn.style.opacity = '0.8';
      status.textContent = "Анализ данных...";

      // Добавляем спиннер
      const spinner = toolbar.querySelector('.spinner');
      spinner.style = `
        display: inline-block;
        width: 12px;
        height: 12px;
        border: 2px solid rgba(255,255,255,.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 1s ease-in-out infinite;
        margin-right: 6px;
      `;

      // Добавляем анимацию
      const style = document.createElement('style');
      style.innerHTML = `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);

      // Анализируем текст
      const aiEntities = await analyzeWithLocalAI(text);
      status.textContent = "Маскировка чувствительных данных...";

      // Маскируем данные
      const safe = maskSensitiveData(text, aiEntities);

      // Заменяем текст
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(safe));

      // Обновляем статус и скрываем тулбар с анимацией
      status.textContent = "✅ Готово!";
      status.style.color = "#4cd964";

      setTimeout(() => {
        toolbar.style.opacity = "0";
        toolbar.style.transform = "translateY(-10px) scale(0.95)";

        setTimeout(() => {
          toolbar.remove();
          toolbarActive = false;
        }, 300);
      }, 1000);

      // Очищаем выделение
      sel.removeAllRanges();

    } catch (error) {
      console.error("Ошибка при анонимизации:", error);
      status.textContent = "❌ Ошибка!";
      status.style.color = "#ff3b30";
      btn.innerHTML = "🔄 Повторить";
      btn.disabled = false;
      btn.style.background = '#0d6efd';
      btn.style.opacity = '1';
    }
  };

  // Кнопка закрытия тулбара
  const closeBtn = document.createElement("div");
  closeBtn.innerHTML = "×";
  closeBtn.style = `
    position: absolute;
    top: 5px;
    right: 8px;
    font-size: 18px;
    line-height: 14px;
    color: #aaa;
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
  `;

  closeBtn.addEventListener('mouseenter', function () {
    this.style.color = '#fff';
    this.style.background = 'rgba(255,255,255,0.1)';
  });

  closeBtn.addEventListener('mouseleave', function () {
    this.style.color = '#aaa';
    this.style.background = 'transparent';
  });

  closeBtn.onclick = (e) => {
    e.stopPropagation();
    toolbar.style.opacity = "0";
    toolbar.style.transform = "translateY(-10px) scale(0.95)";
    setTimeout(() => {
      toolbar.remove();
      toolbarActive = false;
    }, 300);
  };

  // Собираем все элементы
  toolbar.appendChild(closeBtn);
  toolbar.appendChild(btn);
  toolbar.appendChild(status);
  document.body.appendChild(toolbar);

  // Предотвращаем закрытие тулбара при клике на него
  toolbar.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });
}

// Обновляем событие selectionchange
document.addEventListener("selectionchange", () => {
  // Очищаем предыдущий таймаут, если есть
  if (selectionTimeout) {
    clearTimeout(selectionTimeout);
  }

  // Устанавливаем небольшую задержку для стабильности
  selectionTimeout = setTimeout(updateToolbar, 200);
});

// Обновляем обработчик клика для закрытия тулбара при клике вне
document.addEventListener("mousedown", (e) => {
  const toolbar = document.getElementById("anon-toolbar");
  if (toolbar && !toolbar.contains(e.target)) {
    // Плавно скрываем тулбар
    toolbar.style.opacity = "0";
    toolbar.style.transform = "translateY(-10px) scale(0.95)";
    setTimeout(() => {
      if (toolbar && toolbar.parentNode) {
        toolbar.remove();
        toolbarActive = false;
      }
    }, 300);
  }
});

// Обработчик нажатия Enter
document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter") return;
  if (e.shiftKey) return; // Пропускаем Shift+Enter (новая строка)

  const { input } = findChatElements();
  if (!input || document.activeElement !== input) return;

  const text = input.innerText || input.value || "";
  if (!text.trim()) return;

  // Прямая проверка и показ предупреждения
  if (containsSensitiveData(text.trim())) {
    e.preventDefault();
    e.stopImmediatePropagation();

    // Показываем предупреждение напрямую
    showWarningPopup(text.trim());
    console.log("Перехвачено сообщение с чувствительными данными (Enter)");
  }
}, true);

// Улучшенный обработчик клика на кнопку отправки
document.addEventListener("click", function (e) {
  // Находим кнопку отправки более надежным способом
  const { input, sendButton } = findChatElements();

  // Проверяем, был ли клик на кнопке отправки или её потомке
  let clickedSendButton = false;
  let target = e.target;

  // Проверяем, является ли целевой элемент или его родитель кнопкой отправки
  while (target) {
    if (target === sendButton) {
      clickedSendButton = true;
      break;
    }
    target = target.parentElement;
  }

  if (!clickedSendButton || !input) return;

  const text = input.innerText || input.value || "";
  if (!text.trim()) return;

  // Прямая проверка и показ предупреждения
  if (containsSensitiveData(text.trim())) {
    e.preventDefault();
    e.stopImmediatePropagation();

    // Показываем предупреждение напрямую
    showWarningPopup(text.trim());
    console.log("Перехвачено сообщение с чувствительными данными (клик)");
  }
}, true);

// Улучшенная функция для отправки сообщения как есть
function sendMessageAsIs() {
  const { sendButton } = findChatElements();

  if (sendButton) {
    console.log("Отправка сообщения как есть...");

    // Метод 1: Нативный клик
    try {
      sendButton.click();
    } catch (e) {
      console.error("Ошибка при клике:", e);
    }

    // Метод 2: Создание и отправка события
    try {
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        buttons: 1
      });
      sendButton.dispatchEvent(clickEvent);
    } catch (e) {
      console.error("Ошибка при отправке события:", e);
    }
  } else {
    console.error("Кнопка отправки не найдена!");
  }
}

// Создание и управление индикатором защиты (замочком)
function createSecurityIndicator() {
  // Проверяем, должен ли быть показан индикатор
  if (!maskSettings.SHOW_LOCK_ICON) {
    // Удаляем индикатор, если он существует и настройка отключена
    removeSecurityIndicator();
    return;
  }

  // Проверяем, существует ли уже индикатор
  let indicator = document.getElementById('anon-security-indicator');

  // Если индикатор уже существует, не создаем новый
  if (indicator) {
    return;
  }

  // Создаем контейнер для индикатора
  indicator = document.createElement('div');
  indicator.id = 'anon-security-indicator';
  indicator.style = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    width: 40px;
    height: 40px;
    background: rgba(30, 30, 30, 0.8);
    border-radius: 50%;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
    border: 1px solid #444;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    opacity: 0.7;
  `;

  // Создаем иконку замка
  const lockIcon = document.createElement('div');
  lockIcon.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d6efd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  `;

  // Добавляем иконку в индикатор
  indicator.appendChild(lockIcon);

  // Добавляем эффекты при наведении
  indicator.addEventListener('mouseenter', function () {
    this.style.opacity = '1';
    this.style.transform = 'scale(1.1)';
  });

  indicator.addEventListener('mouseleave', function () {
    this.style.opacity = '0.7';
    this.style.transform = 'scale(1)';
  });

  // Добавляем индикатор на страницу
  document.body.appendChild(indicator);

  // Добавляем клик по индикатору для показа/скрытия мини-меню
  indicator.addEventListener('click', toggleSecurityMenu);

  // Обновляем статус защиты
  updateSecurityStatus();
}

// Функция для обновления статуса защиты
function updateSecurityStatus() {
  const indicator = document.getElementById('anon-security-indicator');
  if (!indicator) return;

  // Проверяем доступность AI-сервера
  checkAIServerAvailability().then(isAvailable => {
    // Получаем иконку внутри индикатора
    const svg = indicator.querySelector('svg');

    if (isAvailable) {
      // Сервер доступен - зеленый замок
      svg.style.stroke = '#4cd964'; // Зеленый
      indicator.setAttribute('data-status', 'protected');
      indicator.title = 'Защита активна: AI-сервер доступен';
    } else {
      // Сервер недоступен - желтый замок (ограниченная защита)
      svg.style.stroke = '#ffcc00'; // Желтый
      indicator.setAttribute('data-status', 'limited');
      indicator.title = 'Ограниченная защита: AI-сервер недоступен, используются только регулярные выражения';
    }
  }).catch(() => {
    // Ошибка при проверке - красный замок
    const svg = indicator.querySelector('svg');
    svg.style.stroke = '#ff3b30'; // Красный
    indicator.setAttribute('data-status', 'error');
    indicator.title = 'Ошибка при проверке защиты';
  });
}

// Функция для проверки доступности AI-сервера
async function checkAIServerAvailability() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch("http://localhost:5000/health", {
      method: "GET",
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (err) {
    console.warn("AI-сервер недоступен:", err);
    return false;
  }
}

// Функция для показа/скрытия мини-меню
function toggleSecurityMenu(event) {
  event.stopPropagation();

  // Проверяем, существует ли уже меню
  let menu = document.getElementById('anon-security-menu');

  // Если меню уже существует, удаляем его
  if (menu) {
    menu.remove();
    return;
  }

  // Получаем индикатор
  const indicator = document.getElementById('anon-security-indicator');
  const status = indicator.getAttribute('data-status');

  // Создаем меню
  menu = document.createElement('div');
  menu.id = 'anon-security-menu';
  menu.style = `
    position: fixed;
    bottom: 70px;
    left: 20px;
    width: 240px;
    background: rgba(30, 30, 30, 0.95);
    border-radius: 10px;
    z-index: 9999;
    padding: 15px;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
    border: 1px solid #444;
    font-family: system-ui, -apple-system, sans-serif;
    color: white;
    font-size: 14px;
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.2s ease;
  `;

  // Заголовок меню
  const title = document.createElement('div');
  title.style = `
    font-weight: 600;
    font-size: 15px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #444;
    display: flex;
    align-items: center;
  `;

  let statusIcon, statusText;

  if (status === 'protected') {
    statusIcon = '<span style="color:#4cd964; margin-right:8px;">●</span>';
    statusText = 'Защита активна';
  } else if (status === 'limited') {
    statusIcon = '<span style="color:#ffcc00; margin-right:8px;">●</span>';
    statusText = 'Ограниченная защита';
  } else {
    statusIcon = '<span style="color:#ff3b30; margin-right:8px;">●</span>';
    statusText = 'Защита отключена';
  }

  title.innerHTML = `${statusIcon}${statusText}`;
  menu.appendChild(title);

  // Добавляем статус AI-сервера
  const serverStatus = document.createElement('div');
  serverStatus.style = `
    margin-bottom: 12px;
    font-size: 13px;
    color: #aaa;
  `;

  if (status === 'protected') {
    serverStatus.textContent = 'AI-сервер доступен и активен';
  } else if (status === 'limited') {
    serverStatus.textContent = 'AI-сервер недоступен, используются только регулярные выражения';
  } else {
    serverStatus.textContent = 'Проверка состояния защиты...';
  }

  menu.appendChild(serverStatus);

  // Добавляем действия
  const actions = document.createElement('div');
  actions.style = `display: flex; flex-direction: column; gap: 8px;`;

  // Кнопка "Проверить текст"
  const checkButton = document.createElement('button');
  checkButton.textContent = '🔍 Проверить выделенный текст';
  checkButton.style = `
    background: #0d6efd;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
    text-align: left;
  `;

  checkButton.addEventListener('mouseenter', function () {
    this.style.background = '#0b5ed7';
  });

  checkButton.addEventListener('mouseleave', function () {
    this.style.background = '#0d6efd';
  });

  checkButton.addEventListener('click', function () {
    const sel = window.getSelection();
    if (!sel.isCollapsed && sel.toString().trim()) {
      menu.remove();
      anonymizeSelectedText(sel.toString().trim(), sel);
    } else {
      serverStatus.textContent = 'Сначала выделите текст для проверки';
      serverStatus.style.color = '#ff3b30';
      setTimeout(() => {
        serverStatus.textContent = status === 'protected'
          ? 'AI-сервер доступен и активен'
          : 'AI-сервер недоступен, используются только регулярные выражения';
        serverStatus.style.color = '#aaa';
      }, 2000);
    }
  });

  actions.appendChild(checkButton);

  // Кнопка "Обновить статус"
  const refreshButton = document.createElement('button');
  refreshButton.textContent = '🔄 Обновить статус';
  refreshButton.style = `
    background: transparent;
    color: white;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
    text-align: left;
  `;

  refreshButton.addEventListener('mouseenter', function () {
    this.style.background = 'rgba(255,255,255,0.1)';
  });

  refreshButton.addEventListener('mouseleave', function () {
    this.style.background = 'transparent';
  });

  refreshButton.addEventListener('click', function () {
    refreshButton.textContent = '🔄 Обновление...';
    refreshButton.disabled = true;

    updateSecurityStatus();

    setTimeout(() => {
      const indicator = document.getElementById('anon-security-indicator');
      const newStatus = indicator.getAttribute('data-status');

      if (newStatus === 'protected') {
        serverStatus.textContent = 'AI-сервер доступен и активен';
        statusIcon = '<span style="color:#4cd964; margin-right:8px;">●</span>';
        statusText = 'Защита активна';
      } else if (newStatus === 'limited') {
        serverStatus.textContent = 'AI-сервер недоступен, используются только регулярные выражения';
        statusIcon = '<span style="color:#ffcc00; margin-right:8px;">●</span>';
        statusText = 'Ограниченная защита';
      } else {
        serverStatus.textContent = 'Ошибка при проверке защиты';
        statusIcon = '<span style="color:#ff3b30; margin-right:8px;">●</span>';
        statusText = 'Защита отключена';
      }

      title.innerHTML = `${statusIcon}${statusText}`;
      refreshButton.textContent = '🔄 Обновить статус';
      refreshButton.disabled = false;
    }, 1000);
  });

  actions.appendChild(refreshButton);

  menu.appendChild(actions);

  // Добавляем меню на страницу
  document.body.appendChild(menu);

  // Делаем меню видимым с анимацией
  setTimeout(() => {
    menu.style.opacity = '1';
    menu.style.transform = 'translateY(0)';
  }, 10);

  // Закрываем меню при клике вне него
  document.addEventListener('click', function closeMenu(e) {
    if (!menu.contains(e.target) && e.target !== indicator) {
      menu.style.opacity = '0';
      menu.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (menu.parentNode) {
          menu.remove();
        }
      }, 200);
      document.removeEventListener('click', closeMenu);
    }
  });
}

// Функция для анонимизации выделенного текста
async function anonymizeSelectedText(text, selection) {
  try {
    showStatus("Анализ выделенного текста...");

    // Анализируем текст
    const aiEntities = await analyzeWithLocalAI(text);

    // Маскируем данные
    const safe = maskSensitiveData(text, aiEntities);

    // Заменяем текст
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(safe));

    // Очищаем выделение
    selection.removeAllRanges();

    // Показываем статус успеха
    showStatus("✅ Текст анонимизирован", "success");
    setTimeout(hideStatus, 2000);

  } catch (error) {
    console.error("Ошибка при анонимизации выделенного текста:", error);
    showStatus("❌ Ошибка анонимизации", "error");
    setTimeout(hideStatus, 3000);
  }
}

// Функция для отображения предупреждения о чувствительных данных
function showWarningPopup(originalText) {
  if (document.getElementById("privacy-warning")) return;

  const overlay = document.createElement("div");
  overlay.id = "privacy-overlay";
  overlay.style = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 9998;
    backdrop-filter: blur(3px);
    animation: fadeIn 0.2s ease;
  `;

  const popup = document.createElement("div");
  popup.id = "privacy-warning";
  popup.style = `
    position: fixed;
    z-index: 9999;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.95);
    background: #222;
    color: white;
    padding: 25px;
    border-radius: 12px;
    width: 480px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    opacity: 0;
    box-shadow: 0 15px 50px rgba(0,0,0,0.5);
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    border: 1px solid #333;
  `;

  // Добавляем анимацию
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Анимация появления
  setTimeout(() => {
    popup.style.opacity = "1";
    popup.style.transform = "translate(-50%, -50%) scale(1)";
  }, 10);

  popup.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 15px;">
      <div style="background: #FFD43B; color: #000; padding: 8px; border-radius: 50%; margin-right: 12px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 9v4M12 17h.01"></path>
          <path d="M12 3c-1.2 0-2.4.6-3 1.7L3.3 16c-.7 1.3-.2 3 1.7 3h14c1.9 0 2.4-1.7 1.7-3L15 4.7c-.6-1.1-1.8-1.7-3-1.7z"></path>
        </svg>
      </div>
      <h3 style="margin:0; font-size:20px; font-weight:500;">Обнаружены чувствительные данные</h3>
    </div>
    
    <div style="background:#2a2a2a; padding:12px; border-radius:8px; max-height:140px; overflow:auto; white-space:pre-wrap; font-size:14px; border: 1px solid #333; margin-bottom:20px; font-family: 'JetBrains Mono', monospace, Menlo, Consolas, monospace;">
      ${originalText}
    </div>
    
    <div id="warning-actions" style="display:flex; gap:12px; margin-top:18px;">
      <button id="btn-mask-warning" style="flex:1; padding:12px; background:#0d6efd; color:white; border:none; border-radius:8px; font-weight:500; cursor:pointer; transition:all 0.2s; font-size:15px;">
        🔒 Анонимизировать
      </button>
      <button id="btn-send-warning" style="flex:1; padding:12px; background:#dc3545; color:white; border:none; border-radius:8px; font-weight:500; cursor:pointer; transition:all 0.2s; font-size:15px;">
        ⚠️ Отправить как есть
      </button>
      <button id="btn-cancel-warning" style="flex:1; padding:12px; background:#6c757d; color:white; border:none; border-radius:8px; font-weight:500; cursor:pointer; transition:all 0.2s; font-size:15px;">
        ❌ Отмена
      </button>
    </div>
    <div id="warning-status" style="margin-top:12px; text-align:center; height:20px; font-size:14px; color:#ffcc00;"></div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(popup);

  // Добавляем эффекты при наведении на кнопки
  const buttons = popup.querySelectorAll('button');
  buttons.forEach(btn => {
    btn.addEventListener('mouseenter', function () {
      const originalColor = this.style.background;
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';

      if (originalColor === '#0d6efd') {
        this.style.background = '#0b5ed7';
      } else if (originalColor === '#dc3545') {
        this.style.background = '#bb2d3b';
      } else if (originalColor === '#6c757d') {
        this.style.background = '#5c636a';
      }
    });

    btn.addEventListener('mouseleave', function () {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = 'none';

      if (this.id === 'btn-mask-warning') {
        this.style.background = '#0d6efd';
      } else if (this.id === 'btn-send-warning') {
        this.style.background = '#dc3545';
      } else if (this.id === 'btn-cancel-warning') {
        this.style.background = '#6c757d';
      }
    });
  });

  // Кнопка анонимизации
  const maskButton = popup.querySelector("#btn-mask-warning");
  const statusEl = popup.querySelector("#warning-status");

  maskButton.onclick = async () => {
    maskButton.innerHTML = '<span class="spinner"></span> Обработка...';
    maskButton.disabled = true;
    statusEl.textContent = "Анализ данных...";

    // Добавляем спиннер
    const spinner = maskButton.querySelector('.spinner');
    spinner.style = `
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s ease-in-out infinite;
      margin-right: 8px;
    `;

    try {
      const aiEntities = await analyzeWithLocalAI(originalText);
      statusEl.textContent = "Маскировка данных...";

      const masked = maskSensitiveData(originalText, aiEntities);

      // Находим поле ввода и заменяем текст
      const { input } = findChatElements();
      if (input) {
        input.focus();
        if (typeof input.value !== 'undefined') {
          input.value = masked;
          // Симулируем событие изменения
          input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          document.execCommand("selectAll", false, null);
          document.execCommand("insertText", false, masked);
        }
      }

      statusEl.textContent = "✅ Готово!";

      // Закрываем предупреждение
      setTimeout(() => {
        closeWarningPopup();
      }, 500);

    } catch (error) {
      console.error("Ошибка при анонимизации:", error);
      statusEl.textContent = "❌ Ошибка! Попробуйте снова";
      maskButton.innerHTML = '🔒 Анонимизировать';
      maskButton.disabled = false;
    }
  };

  // Кнопка отправки как есть
  popup.querySelector("#btn-send-warning").onclick = () => {
    closeWarningPopup();
    // Отправляем сообщение как есть
    setTimeout(sendMessageAsIs, 300);
  };

  // Кнопка отмены
  popup.querySelector("#btn-cancel-warning").onclick = closeWarningPopup;

  // Закрытие по клику на оверлей
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeWarningPopup();
    }
  });

  // Функция закрытия предупреждения
  function closeWarningPopup() {
    popup.style.opacity = "0";
    popup.style.transform = "translate(-50%, -50%) scale(0.95)";

    overlay.style.opacity = "0";

    setTimeout(() => {
      if (popup.parentNode) popup.remove();
      if (overlay.parentNode) overlay.remove();
    }, 300);
  }
}

// Обработчик сообщений от background.js
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "showSensitiveDataWarning") {
      showWarningPopup(message.text);
      sendResponse({ success: true });
      return true;
    } else if (message.action === "anonymizeSelection") {
      // Обработка запроса на анонимизацию выделенного текста из контекстного меню
      const sel = window.getSelection();
      if (!sel.isCollapsed && sel.toString().trim()) {
        const text = sel.toString().trim();
        anonymizeSelectedText(text, sel);
        sendResponse({ success: true });
      }
      return true;
    } else if (message.action === "updateSettings") {
      maskSettings = message.settings;

      // Обновляем индикатор защиты
      if (maskSettings.SHOW_LOCK_ICON) {
        createSecurityIndicator();
      } else {
        removeSecurityIndicator();
      }

      sendResponse({ success: true });
      return true;
    } else if (message.action === "checkSecurityStatus") {
      updateSecurityStatus();
      sendResponse({ success: true });
      return true;
    }
  });
}

// Создаем индикатор при загрузке страницы
window.addEventListener('load', () => {
  console.log("🔒 Расширение анонимизации данных загружено");

  // Загружаем настройки
  loadSettings();

  // Создаем индикатор защиты с задержкой
  setTimeout(() => {
    try {
      if (maskSettings.SHOW_LOCK_ICON) {
        createSecurityIndicator();
      }
    } catch (e) {
      console.error("Ошибка при создании индикатора:", e);
    }
  }, 1000);

  // Проверяем доступность AI-сервера
  checkAIServerAvailability().then(isAvailable => {
    if (isAvailable) {
      console.log("✅ AI-сервер доступен");
      showStatus("AI-сервер для анонимизации запущен", "success");
      setTimeout(hideStatus, 3000);
    } else {
      console.warn("⚠️ AI-сервер недоступен");
      showStatus("AI-сервер недоступен! Будут использованы только регулярные выражения.", "error");
      setTimeout(hideStatus, 5000);
    }
  }).catch(err => {
    console.error("Ошибка при проверке сервера:", err);
  });
});

// Добавляем глобальную обработку ошибок
window.addEventListener('error', function (event) {
  console.error("Глобальная ошибка в расширении анонимизации:", event.error);
});

console.log("🔄 Скрипт анонимизации данных инициализирован");