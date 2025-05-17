/**
 * Background script для расширения анонимизации данных
 */

// Обработка сообщений от контент-скрипта
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Проверка на наличие чувствительных данных
    if (message.action === "checkSensitiveData") {
        // Отправляем сообщение назад в контент-скрипт
        chrome.tabs.sendMessage(sender.tab.id, {
            action: "showSensitiveDataWarning",
            text: message.text
        });

        return true; // Позволяет использовать асинхронный sendResponse
    }

    // Открыть настройки
    if (message.action === "openSettings") {
        // Открываем попап с настройками
        chrome.action.openPopup();
        return true;
    }
});

// Добавляем контекстное меню
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "anonymizeText",
        title: "Анонимизировать текст",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "checkSecurity",
        title: "Проверить статус защиты",
        contexts: ["page"]
    });
});

// Обработка клика на пункт меню
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "anonymizeText" && info.selectionText) {
        // Отправляем сообщение для анонимизации выделенного текста
        chrome.tabs.sendMessage(tab.id, {
            action: "anonymizeSelection",
            text: info.selectionText
        });
    }

    if (info.menuItemId === "checkSecurity") {
        // Отправляем сообщение для проверки статуса защиты
        chrome.tabs.sendMessage(tab.id, {
            action: "checkSecurityStatus"
        });
    }
});

// Обработка установки расширения
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        // Инициализируем настройки по умолчанию при первой установке
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

        chrome.storage.sync.set({ maskSettings: defaultSettings }, function () {
            console.log("Настройки инициализированы при установке");
        });

        // Открываем страницу с инструкциями
        chrome.tabs.create({
            url: "welcome.html"
        });
    }
});