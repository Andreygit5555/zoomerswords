# Зумер-сканворд

Мини-приложение для Telegram Web Apps: статичная игра без бэкенда и сборки.

## Запуск

Откройте `index.html` в браузере или отдайте папку любым статичным сервером.

## Telegram

1. Загрузите содержимое папки на HTTPS-хостинг.
2. В BotFather укажите URL как Web App.
3. `index.html` уже подключает `telegram-web-app.js` и подстраивает цвета под тему Telegram, если приложение открыто внутри Telegram.

## Данные

Слова экспортируются из `/Users/Andrey/Downloads/zoomer_slang.xlsx` командой:

```bash
/Users/Andrey/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 export_slang_data.py
```
