# 🚀 PulseCore Analytics Dashboard

PulseCore is a high-performance, **Cyberpunk-inspired** smart dashboard designed for modern enterprise data intelligence. Built with **FastAPI** and **Next.js**, it features AI-powered insights, dynamic data mapping, and real-time market projections.

![Cyberpunk Dashboard UI](https://img.shields.io/badge/UI-Cyberpunk-blueviolet?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Frontend-Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)

## ✨ Key Features
- **🧠 AI Analyst Insights**: Real-time structured data observations and growth identification.
- **📊 Dynamic Data Mapping**: Support for universal CSV structures—map any column to Date, Sales, or Product.
- **📈 Market Projection Engine**: Predictive analytics for future revenue using linear regression.
- **⚡ High Performance**: Optimized for datasets with 500,000+ rows (limit-aware parsing).
- **📱 Responsive Glassmorphism UI**: Beautifully designed for both desktop and mobile views.
- **📥 Universal CSV Handling**: Automatic cleaning of currency symbols, commas, and varied encodings.

## 🛠️ Tech Stack
- **Frontend**: Next.js, React, Recharts, Lucide-React, Tailwind (Vanilla CSS Custom Styles)
- **Backend**: Python, FastAPI, Pandas, NumPy, Scikit-learn
- **Data Source**: CSV-based repository with in-memory caching.

## 🚀 Getting Started

### Backend Setup
1. Navigate to `/backend`
2. Install dependencies: `pip install -r requirements.txt`
3. Start the server: `python main.py`

### Frontend Setup
1. Navigate to `/frontend`
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`

## 🌍 Deployment
This project is configured for seamless deployment:
- **Backend**: Optimized for [Render](https://render.com) (includes `requirements.txt` and dynamic port binding).
- **Frontend**: Optimized for [Vercel](https://vercel.com) (environment variable support for API URLs).

---
*Developed with ❤️ as a showcase for high-velocity data intelligence.*
