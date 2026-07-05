import io
import re
import base64
import asyncio
from fastapi import WebSocket
from typing import Dict
from deep_translator import GoogleTranslator
from gtts import gTTS

# Custom translation mappings to ensure high accuracy for Christian terminology and biblical proper names.
CHRISTIAN_MAPPINGS = {
    "en": {
        "Espírito Santo": "Holy Spirit",
        "Espirito Santo": "Holy Spirit",
        "Bíblia Sagrada": "Holy Bible",
        "Biblia Sagrada": "Holy Bible",
        "Tiago": "James",
        "Thiago": "James",
        "João": "John",
        "Pedro": "Peter",
        "Paulo": "Paul",
        "Mateus": "Matthew",
        "Marcos": "Mark",
        "Lucas": "Luke",
        "Moisés": "Moses",
        "Moises": "Moses",
        "Isaías": "Isaiah",
        "Isaias": "Isaiah",
        "Salomão": "Solomon",
        "Salomao": "Solomon",
        "Davi": "David",
        "Gênesis": "Genesis",
        "Genesis": "Genesis",
        "Êxodo": "Exodus",
        "Exodo": "Exodus",
        "Levítico": "Leviticus",
        "Levitico": "Leviticus",
        "Números": "Numbers",
        "Numeros": "Numbers",
        "Deuteronômio": "Deuteronomy",
        "Deuteronomio": "Deuteronomy",
        "Apocalipse": "Revelation",
        "Revelação": "Revelation",
        "Revelacao": "Revelation",
    },
    "nl": {
        "Espírito Santo": "Heilige Geest",
        "Espirito Santo": "Heilige Geest",
        "Bíblia Sagrada": "Heilige Bijbel",
        "Biblia Sagrada": "Heilige Bijbel",
        "Tiago": "Jakobus",
        "Thiago": "Jakobus",
        "João": "Johannes",
        "Pedro": "Petrus",
        "Paulo": "Paulus",
        "Mateus": "Matteüs",
        "Marcos": "Marcus",
        "Lucas": "Lucas",
        "Moisés": "Mozes",
        "Moises": "Mozes",
        "Isaías": "Jesaja",
        "Isaias": "Jesaja",
        "Salomão": "Salomo",
        "Salomao": "Salomo",
        "Davi": "David",
        "Gênesis": "Genesis",
        "Genesis": "Genesis",
        "Êxodo": "Exodus",
        "Exodo": "Exodus",
        "Levítico": "Leviticus",
        "Levitico": "Leviticus",
        "Números": "Numeri",
        "Numeros": "Numeri",
        "Deuteronômio": "Deuteronomium",
        "Deuteronomio": "Deuteronomium",
        "Apocalipse": "Openbaring",
    },
    "es": {
        "Espírito Santo": "Espíritu Santo",
        "Espirito Santo": "Espíritu Santo",
        "Bíblia Sagrada": "Sagrada Biblia",
        "Biblia Sagrada": "Sagrada Biblia",
        "Tiago": "Santiago",
        "Thiago": "Santiago",
        "João": "Juan",
        "Pedro": "Pedro",
        "Paulo": "Pablo",
        "Mateus": "Mateo",
        "Marcos": "Marcos",
        "Lucas": "Lucas",
        "Moisés": "Moisés",
        "Moises": "Moisés",
        "Isaías": "Isaías",
        "Isaias": "Isaías",
        "Salomão": "Salomón",
        "Salomao": "Salomón",
        "Davi": "David",
        "Gênesis": "Génesis",
        "Genesis": "Génesis",
        "Êxodo": "Éxodo",
        "Exodo": "Éxodo",
        "Levítico": "Levítico",
        "Levitico": "Levítico",
        "Números": "Números",
        "Numeros": "Números",
        "Deuteronômio": "Deuteronomio",
        "Deuteronomio": "Deuteronomio",
        "Apocalipse": "Apocalipsis",
    },
    "fr": {
        "Espírito Santo": "Saint-Esprit",
        "Espirito Santo": "Saint-Esprit",
        "Bíblia Sagrada": "Sainte Bible",
        "Biblia Sagrada": "Sainte Bible",
        "Tiago": "Jacques",
        "Thiago": "Jacques",
        "João": "Jean",
        "Pedro": "Pierre",
        "Paulo": "Paul",
        "Mateus": "Matthieu",
        "Marcos": "Marc",
        "Lucas": "Luc",
        "Moisés": "Moïse",
        "Moises": "Moïse",
        "Isaías": "Ésaïe",
        "Isaias": "Ésaïe",
        "Salomão": "Salomon",
        "Salomao": "Salomon",
        "Davi": "David",
        "Gênesis": "Genèse",
        "Genesis": "Genèse",
        "Êxodo": "Exode",
        "Exodo": "Exode",
        "Levítico": "Lévitique",
        "Levitico": "Lévitique",
        "Números": "Nombres",
        "Numeros": "Nombres",
        "Deuteronômio": "Deuteronome",
        "Deuteronomio": "Deuteronome",
        "Apocalipse": "Apocalypse",
    },
    "de": {
        "Espírito Santo": "Heilige Geist",
        "Espirito Santo": "Heilige Geist",
        "Bíblia Sagrada": "Heilige Schrift",
        "Biblia Sagrada": "Heilige Schrift",
        "Tiago": "Jakobus",
        "Thiago": "Jakobus",
        "João": "Johannes",
        "Pedro": "Petrus",
        "Paulo": "Paulus",
        "Mateus": "Matthäus",
        "Marcos": "Markus",
        "Lucas": "Lukas",
        "Moisés": "Mose",
        "Moises": "Mose",
        "Isaías": "Jesaja",
        "Isaias": "Jesaja",
        "Salomão": "Salomo",
        "Salomao": "Salomo",
        "Davi": "David",
        "Gênesis": "Genesis",
        "Genesis": "Genesis",
        "Êxodo": "Exodus",
        "Exodo": "Exodus",
        "Levítico": "Levitikus",
        "Levitico": "Levitikus",
        "Números": "Numeri",
        "Numeros": "Numeri",
        "Deuteronômio": "Deuteronomium",
        "Deuteronomio": "Deuteronomium",
        "Apocalipse": "Offenbarung",
    },
    "it": {
        "Espírito Santo": "Spirito Santo",
        "Espirito Santo": "Spirito Santo",
        "Bíblia Sagrada": "Sacra Bibbia",
        "Biblia Sagrada": "Sacra Bibbia",
        "Tiago": "Giacomo",
        "Thiago": "Giacomo",
        "João": "Giovanni",
        "Pedro": "Pietro",
        "Paulo": "Paolo",
        "Mateus": "Matteo",
        "Marcos": "Marco",
        "Lucas": "Luca",
        "Moisés": "Mosè",
        "Moises": "Mosè",
        "Isaías": "Isaia",
        "Isaias": "Isaia",
        "Salomão": "Salomone",
        "Salomao": "Salomone",
        "Davi": "Davide",
        "Gênesis": "Genesi",
        "Genesis": "Genesi",
        "Êxodo": "Esodo",
        "Exodo": "Esodo",
        "Levítico": "Levitico",
        "Levitico": "Levitico",
        "Números": "Numeri",
        "Numeros": "Numeri",
        "Deuteronômio": "Deuteronomio",
        "Deuteronomio": "Deuteronomio",
        "Apocalipse": "Apocalisse",
    }
}

class Connections:
    """Manages WebSocket connections and handles backend translation/TTS operations."""

    def __init__(self) -> None:
        """Initializes the Connections manager with an empty active connection dictionary."""
        # Maps WebSocket connection to a configuration dictionary: {websocket: {"language": "en"}}
        self.active_connections: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket) -> None:
        """Accepts an incoming WebSocket connection and registers it with the default language 'en'."""
        await websocket.accept()
        self.active_connections[websocket] = {"language": "en"}
    
    def disconnect(self, websocket: WebSocket) -> None:
        """Safely disconnects and unregisters a WebSocket connection from active tracked sessions."""
        if websocket in self.active_connections:
            del self.active_connections[websocket]

    async def set_language(self, websocket: WebSocket, language: str) -> None:
        """Updates the language preference for a specific active WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections[websocket]["language"] = language

    def _correct_christian_terms(self, text: str, lang: str) -> str:
        """Processes translated text to map literal translation names into correct Biblical equivalents.
        
        Args:
            text (str): The translated text.
            lang (str): The target language code (e.g. 'en', 'nl').
            
        Returns:
            str: The post-processed translation text with corrected names.
        """
        mappings = CHRISTIAN_MAPPINGS.get(lang, {})
        if not mappings:
            return text
        
        # Sort terms by length descending to replace multi-word phrases (e.g. "Espírito Santo") 
        # before single words (e.g. "Santo") to avoid partial replacements.
        sorted_keys = sorted(mappings.keys(), key=len, reverse=True)
        for key in sorted_keys:
            val = mappings[key]
            # Match word boundary case-insensitively, and replace it
            pattern = re.compile(r'\b' + re.escape(key) + r'\b', re.IGNORECASE)
            text = pattern.sub(val, text)
        return text

    def _translate_and_tts(self, text: str, lang: str) -> tuple[str, str]:
        """Translates a message to the target language and synthesizes its TTS audio payload.
        
        Args:
            text (str): The original transcription text.
            lang (str): The target translation language code.
            
        Returns:
            tuple[str, str]: A tuple containing the translated text and the base64-encoded audio data URL.
        """
        # 1. Translate from auto-detected/Portuguese (pt) to target language
        try:
            translation = GoogleTranslator(source='auto', target=lang).translate(text)
        except Exception as e:
            print(f"Translation error ({lang}): {e}")
            translation = text

        # 2. Run post-processing to ensure Christian terminology and biblical proper name accuracy
        translation = self._correct_christian_terms(translation, lang)

        # 3. TTS the translation in target language
        try:
            tts = gTTS(text=translation, lang=lang)
            fp = io.BytesIO()
            tts.write_to_fp(fp)
            fp.seek(0)
            audio_base64 = base64.b64encode(fp.read()).decode('utf-8')
            audio_data_url = f"data:audio/mp3;base64,{audio_base64}"
        except Exception as e:
            print(f"TTS error ({lang}): {e}")
            audio_data_url = ""

        return translation, audio_data_url

    async def broadcast(self, type: str, message_id: int, message: str) -> None:
        """Broadcasts messages to all connected WebSocket clients.
        
        For 'transcription' messages, this method offloads translating and TTS voice synthesis 
        to a thread-pool executor to prevent blocking the asynchronous event loop.
        
        Args:
            type (str): The event type (e.g. 'transcription', 'update', 'info').
            message_id (int): A unique identifier for the transcription line.
            message (str): The transcription text.
        """
        # Run translations and TTS in a thread pool to avoid blocking the event loop
        loop = asyncio.get_running_loop()
        
        for websocket, config in list(self.active_connections.items()):
            try:
                if type == "transcription":
                    lang = config.get("language", "en")
                    # Offload blocking operations to thread pool
                    translation, audio_url = await loop.run_in_executor(
                        None, self._translate_and_tts, message, lang
                    )
                    await websocket.send_json({
                        "type": type, 
                        "messageId": message_id, 
                        "message": message,
                        "translation": translation,
                        "audio": audio_url
                    })
                else:
                    await websocket.send_json({
                        "type": type, 
                        "messageId": message_id, 
                        "message": message
                    })
            except Exception as e:
                print(f"Error sending message to client: {e}")
                self.disconnect(websocket)