/**
 * Логика для настроек анонимизации (popup.html)
 */

// Начальные настройки по умолчанию
const defaultSettings = {
    // Основные настройки
    SHOW_TOOLBAR: true,      // Показывать тулбар при выделении текста
    SHOW_LOCK_ICON: true,    // Показывать индикатор защиты в углу страницы

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

// Загрузка настроек
function loadSettings() {
    chrome.storage.sync.get('maskSettings', (data) => {
        const settings = data.maskSettings || defaultSettings;

        // Устанавливаем чекбоксы в соответствии с настройками
        Object.keys(settings).forEach(key => {
            const checkbox = document.querySelector(`[data-key="${key}"]`);
            if (checkbox) {
                checkbox.checked = settings[key];
            }
        });

        console.log("Настройки загружены:", settings);
    });
}

// Сохранение настроек
function saveSettings() {
    const settings = {};

    // Собираем значения всех чекбоксов
    document.querySelectorAll('.setting-item input[type="checkbox"]').forEach(checkbox => {
        const key = checkbox.dataset.key;
        settings[key] = checkbox.checked;
    });

    // Сохраняем в хранилище
    chrome.storage.sync.set({ maskSettings: settings }, () => {
        console.log("Настройки сохранены:", settings);

        // Показываем уведомление о сохранении
        showSaveStatus("Настройки успешно сохранены!", "success");

        // Применяем изменения к активным вкладкам
        applySettingsToActiveTabs(settings);
    });
}

// Сброс настроек до значений по умолчанию
function resetSettings() {
    // Устанавливаем все чекбоксы в соответствии с defaultSettings
    Object.keys(defaultSettings).forEach(key => {
        const checkbox = document.querySelector(`[data-key="${key}"]`);
        if (checkbox) {
            checkbox.checked = defaultSettings[key];
        }
    });

    // Показываем уведомление о сбросе
    showSaveStatus("Настройки сброшены до значений по умолчанию", "info");
}

// Применение настроек к активным вкладкам
function applySettingsToActiveTabs(settings) {
    // Получаем все активные вкладки и отправляем им обновленные настройки
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            try {
                chrome.tabs.sendMessage(tab.id, {
                    action: "updateSettings",
                    settings: settings
                });
            } catch (e) {
                console.error("Ошибка отправки настроек в вкладку:", e);
            }
        });
    });
}

// Выбрать все опции маскирования
function selectAll() {
    document.querySelectorAll('.setting-item input[type="checkbox"]').forEach(checkbox => {
        // Пропускаем основные настройки
        if (checkbox.dataset.key !== "SHOW_TOOLBAR" && checkbox.dataset.key !== "SHOW_LOCK_ICON") {
            checkbox.checked = true;
        }
    });

    showSaveStatus("Выбраны все типы данных", "info");
}

// Снять выбор со всех опций маскирования
function deselectAll() {
    document.querySelectorAll('.setting-item input[type="checkbox"]').forEach(checkbox => {
        // Пропускаем основные настройки
        if (checkbox.dataset.key !== "SHOW_TOOLBAR" && checkbox.dataset.key !== "SHOW_LOCK_ICON") {
            checkbox.checked = false;
        }
    });

    showSaveStatus("Выбор типов данных снят", "info");
}

// Проверка статуса сервера
async function checkServerStatus() {
    const statusIndicator = document.getElementById('server-indicator');
    const statusText = document.getElementById('server-status');

    // Устанавливаем индикатор в состояние "проверка"
    statusIndicator.className = 'status-indicator checking';
    statusText.textContent = 'Проверка сервера...';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch('http://localhost:5000/health', {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            // Сервер доступен
            statusIndicator.className = 'status-indicator active';
            statusText.textContent = 'AI-сервер запущен и готов к работе ✓';
            return true;
        } else {
            // Сервер недоступен (код ответа не 200)
            statusIndicator.className = 'status-indicator inactive';
            statusText.textContent = 'AI-сервер недоступен! Будут использованы только регулярные выражения.';
            return false;
        }
    } catch (error) {
        // Ошибка при подключении к серверу
        statusIndicator.className = 'status-indicator inactive';
        statusText.textContent = 'AI-сервер недоступен! Будут использованы только регулярные выражения.';
        console.error('Ошибка при проверке сервера:', error);
        return false;
    }
}

// Показать статус сохранения
function showSaveStatus(message, type = 'success') {
    const statusEl = document.getElementById('save-status');

    // Устанавливаем сообщение и тип
    statusEl.textContent = message;
    statusEl.className = 'save-status visible';

    if (type === 'error') {
        statusEl.classList.add('error');
    } else {
        statusEl.classList.remove('error');
    }

    // Скрываем статус через 3 секунды
    setTimeout(() => {
        statusEl.classList.remove('visible');
    }, 3000);
}

// Инициализация
document.addEventListener('DOMContentLoaded', function () {
    // Загружаем настройки
    loadSettings();

    // Проверяем статус сервера
    checkServerStatus();

    // Настраиваем обработчики событий
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('reset-settings').addEventListener('click', resetSettings);
    document.getElementById('select-all').addEventListener('click', selectAll);
    document.getElementById('deselect-all').addEventListener('click', deselectAll);
    document.getElementById('test-server').addEventListener('click', async () => {
        const serverStatus = await checkServerStatus();
        if (serverStatus) {
            showSaveStatus("AI-сервер доступен и работает", "success");
        } else {
            showSaveStatus("AI-сервер недоступен!", "error");
        }
    });
});