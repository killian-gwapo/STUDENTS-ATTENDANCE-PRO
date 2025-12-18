
# 📱 AttendanceQR Pro

A professional, high-performance attendance management system built with React, Tailwind CSS, and Google Gemini AI.

## ✨ Features
- **Section Management**: Organize students by classes or groups.
- **AI Bulk Import**: Upload `.txt` files and let Gemini AI parse names, IDs, and contact info.
- **Bulk QR Generation**: Generate and download QR codes individually or as a ZIP.
- **Real-time Scanning**: High-speed QR scanning via device camera.
- **Parent Notifications**: One-tap SMS notification to parents upon successful check-in.
- **Dark Mode**: Fully responsive, accessible, and theme-aware UI.
- **Offline Ready**: Uses local storage for data persistence.

## 🛠 Tech Stack
- **Frontend**: React (ESM)
- **Styling**: Tailwind CSS
- **AI**: Google Gemini API (@google/genai)
- **Scanning**: Html5-Qrcode
- **Native Wrapper**: Capacitor (Targeting Android APK)

## 📦 How to build the APK
1. Push this code to a GitHub Repository.
2. Install Capacitor CLI: `npm install @capacitor/cli @capacitor/android`.
3. Add Android platform: `npx cap add android`.
4. Open in Android Studio: `npx cap open android`.
5. Build > Build Bundle(s) / APK(s) > Build APK(s).

## 🔑 Environment Variables
- `API_KEY`: Your Google Gemini API Key (Configured in GitHub Secrets for CI/CD).
