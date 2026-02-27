# 🎮 CLOUD GAMING223 | AI-Core V2.5
> **Advanced Digital Assistant for the CLOUD GAMING-223.**
> Powered by Starlink 🛰️ & Google Gemini 🧠

![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Location](https://img.shields.io/badge/Mali-Bamako-green?style=for-the-badge)

---

## 🚀 The 13-Plugin Engine
This framework uses a modular dynamic loader. Add any `.js` file to `/plugins` and the system installs it instantly with full console logging.

### 🧠 AI & Media Modules
* **Vision**: Deep image analysis via Gemini 2.0 Flash.
* **TikTok Live**: 🔴 **(NEW)** Real-time stream monitoring and automated Discord notifications.
* **TRT**: Instant translation for French, Arabic, English, and more.
* **TTS**: High-quality voice note generation.

### 🛠️ Utility & Gaming
* **Weather**: Real-time updates for Bamako and global cities.
* **Alive**: System heartbeat and Starlink latency tracking.
* **Menu**: Dynamic command dashboard.
* **Ping/Clear**: Core performance and chat management tools.

### ⚖️ Moderation & Safety
* **Ban/Kick**: Full administrative control for community safety.
* **Contact**: Direct line to the dev team via `.env` OWNER_ID.
* **Owner**: Social hub (TikTok, IG, WhatsApp).

---

## 🛠️ Deployment
1. **Fork** the repository.
2. **Setup Environment**: Copy `.env.example` to `.env`.
3. **Fill in your secrets** in the `.env` file:
   ```env
   # --- DISCORD ---
   DISCORD_TOKEN=your_bot_token_here
   OWNER_ID=your_discord_user_id
   CHANNEL_ID=notification_channel_id
   PREFIX=,

   # --- API KEYS ---
   GEMINI_API_KEY=your_google_ai_key
   WEATHER_API_KEY=your_weather_api_key

   # --- TIKTOK ---
   TIKTOK_USERNAME=your_tiktok_username
   CHECK_INTERVAL_MS=120000

---


## ⚖️ Disclaimer & License

**Notice to Users:** This bot framework is provided "as-is" without any warranties. By deploying this template, you agree that:
* **Responsibility:** You are solely responsible for the content, data, and activities of your bot instance.
* **API Usage:** You must comply with the Terms of Service for Discord and Google (Gemini AI).
* **Privacy:** Ensure you handle user data according to your local laws (such as GDPR or regional Sahel regulations).
* **Liability:** The original creator (<@1284944736620253296>) is not liable for any damages, data leaks, or server costs resulting from the use of this code.

**License:** This project is open-source. You are free to modify and redistribute it, but you must maintain the original creator's credits in the `ready` event logic.
