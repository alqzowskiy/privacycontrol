from flask import Flask, request, jsonify
from flask_cors import CORS
import spacy
import re
import os

app = Flask(__name__)
CORS(app)  

print("Инициализация локальной AI модели...")

try:
    nlp = spacy.load("ru_core_news_md")
    print("✅ Загружена модель spaCy: ru_core_news_md")
except OSError:
    try:
        nlp = spacy.load("ru_core_news_sm")
        print("✅ Загружена модель spaCy: ru_core_news_sm")
    except OSError:
        print("Модели spaCy не найдены. Загрузка модели...")
        os.system("python -m spacy download ru_core_news_sm")
        nlp = spacy.load("ru_core_news_sm")
        print("✅ Загружена модель spaCy: ru_core_news_sm")


patterns = {
    "ИИН": r"\b\d{12}\b",
    "EMAIL": r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
    "ТЕЛЕФОН": r"(\+7|8)[0-9]{10}",
    "ПАСПОРТ": r"\b\d{9}\b",
    "КАРТА": r"\b\d{16}\b",
    "ДАТА РОЖДЕНИЯ": r"\b\d{2}[./-]\d{2}[./-]\d{4}\b",
    "АДРЕС": r"(?:ул\.|улица|проспект|пр\.|микрорайон|мкр\.|пр-т)\s+[\wА-Яа-я\-]+(?:\s*,?\s*(?:дом|д\.|уч\.)?\s*\d+)?(?:\s*,?\s*(?:кв\.|квартира|офис|оф\.)?\s*\d+)?",
    "PERSON": r"[А-Я][а-я]+ [А-Я][а-я]+(?:ов|ев|ин|ова|ева|ина|кызы|улы)?",
    "ORG": r"(?:TOO|ТОО|АО|ИП)\s+[\"'][\wА-Яа-я\s\-]+[\"']",
}

def analyze_text_with_regex(text):
    """Анализ текста с помощью регулярных выражений"""
    entities = []
    
    for label, pattern in patterns.items():
        for match in re.finditer(pattern, text):
            entities.append({
                "text": match.group(),
                "label": label
            })
    
    return entities

def analyze_text_with_spacy(text):
    """Анализ текста с помощью SpaCy"""
    doc = nlp(text)
    entities = []
    

    label_map = {
        "PER": "PERSON", 
        "PERSON": "PERSON",
        "ORG": "ORG",
        "LOC": "LOC",
        "GPE": "GPE",
        "MONEY": "ФИНАНСЫ",
        "DATE": "ДАТА"
    }
    
    for ent in doc.ents:
        if ent.label_ in label_map:
            entities.append({
                "text": ent.text,
                "label": label_map[ent.label_]
            })
    
    return entities

@app.route('/health', methods=['GET'])
def health_check():
    """Проверка работоспособности сервера"""
    return jsonify({"status": "ok"})

@app.route('/analyze', methods=['POST'])
def analyze():
    """Анализирует текст на наличие чувствительной информации"""
    try:
        data = request.json
        
        if not data or 'text' not in data:
            return jsonify({"error": "Необходимо предоставить текст в поле 'text'"}), 400
        
        text = data['text']
        print(f"Анализ текста ({len(text)} символов)")
        
        regex_entities = analyze_text_with_regex(text)
        spacy_entities = analyze_text_with_spacy(text)
        
        all_entities = regex_entities + spacy_entities
        unique_entities = []
        seen_texts = set()
        
        for entity in all_entities:
            entity_key = f"{entity['text']}_{entity['label']}"
            if entity_key not in seen_texts:
                seen_texts.add(entity_key)
                unique_entities.append(entity)
        
        print(f"Найдено {len(unique_entities)} сущностей")
        
        return jsonify({"entities": unique_entities})
    
    except Exception as e:
        print(f"Ошибка: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("🚀 Запуск AI-сервера для анонимизации на http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)