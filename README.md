# TubeSmart AI — تيوب سمارت | استوديو رفع وتحسين فيديوهات يوتيوب بالذكاء الاصطناعي

منصة متكاملة لإدارة ورفع الفيديوهات على **YouTube** مبنية بـ **Next.js (App Router) + Node.js + PostgreSQL (Drizzle ORM)**:

- ربط حقيقي بقناة اليوتيوب عبر **Google OAuth 2.0 & YouTube Data API v3** (مع وضع تجريبي فوري).
- رفع الفيديوهات مع استخراج الصورة المصغرة والمدة والدقة.
- تحليل المحتوى بالذكاء الاصطناعي (**OpenAI / Google Gemini / محرك سيو عربي مدمج بدون مفاتيح**).
- توليد **5 عناوين جذابة عالية النقر (CTR)** مع معاينة حية لنتائج بحث يوتيوب.
- توليد **وصف احترافي** بالفصول الزمنية والهاشتاجات.
- **تاجز وكلمات مفتاحية طويلة الذيل (Long-Tail)** مع عدّاد 500 حرف الرسمي.
- ضبط جميع إعدادات يوتيوب (اللغة، التصنيف، الخصوصية، الجدولة، الأطفال، الترخيص...).
- توليد وتحرير وتنزيل **ترجمات (`.srt` / `.vtt`)** بعدة لغات ورفعها مع الفيديو.
- نشر مباشر إلى YouTube عبر **Resumable Upload API**.

## النشر على Bonto (bonto.dev) من GitHub

1. **ارفع المشروع على GitHub**
   ```bash
   git init && git add . && git commit -m "TubeSmart AI"
   git branch -M main
   git remote add origin https://github.com/USERNAME/REPO.git
   git push -u origin main
   ```

2. **أنشئ قاعدة PostgreSQL مجانية** على [neon.tech](https://neon.tech) أو Supabase وانسخ `DATABASE_URL`.

3. **في [bonto.dev/dashboard](https://bonto.dev/dashboard)**: New App → Node.js → Import from GitHub، ثم في الإعدادات:
   - Node version: **22**
   - Build command: `npm run build:bonto`
   - Start command: `npm run start:bonto`

4. **Environment Variables** (انظر `.env.example`): `DATABASE_URL`, `APP_BASE_URL=https://your-app.bonto.page`, `APP_ENCRYPTION_KEY`, و(اختياري) `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.

5. **Google Cloud Console**: فعّل YouTube Data API v3 وأنشئ OAuth Client (Web) مع Redirect URI:
   `https://your-app.bonto.page/api/auth/youtube/callback`

> `build:bonto` ينشئ جداول قاعدة البيانات تلقائياً (`drizzle-kit push`) ثم يبني Next.js بوضع `standalone`. كل `git push` يعيد النشر تلقائياً.

### التشغيل محلياً
```bash
npm install
cp .env.example .env   # واضبط DATABASE_URL
npm run db:push
npm run dev
```
