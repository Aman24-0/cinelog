# 🎬 Cinelog 

Cinelog is a blazing-fast, personalized movie and TV show tracking universe. Built with **SolidJS** and **Firebase**, it allows users to search for media, track their watch progress, organize franchises, view personal analytics, and seamlessly stream content via integrated third-party streaming nodes.

![Cinelog Preview](public/icons/android-chrome-512x512.png) ## ✨ Features

* **🌌 The Vault (Watchlist):** Track your movies and series with advanced filtering (Grid & Timeline views), custom tags, and personal ratings.
* **📺 Advanced TV Tracking:** Track individual episodes, season timelines, and auto-resume where you left off.
* **▶️ Direct Play Streaming:** Built-in video player using customizable third-party embed servers (VidZee, Vidsrc, AutoEmbed, etc.) or custom Direct Play URLs.
* **📊 Personal Analytics:** Visual insights into your watching habits, total watch time, top genres, and favorite actors.
* **📁 Franchises & Lists:** Group movies and series into custom collections (e.g., "Marvel Cinematic Universe", "Favorites").
* **📅 Upcoming Releases:** Track unreleased movies and upcoming TV seasons directly in your dashboard.
* **🎨 Dynamic Themes:** Choose from multiple themes (Sage, Matrix, Netflix, Cinematic, etc.) to customize your UI.
* **🔄 Data Sync:** Easily export your entire vault to JSON and import it back anytime.
* **📱 PWA Ready:** Install Cinelog as a Progressive Web App on your mobile device for a native app experience.

## 🛠 Tech Stack

* **Frontend:** [SolidJS](https://www.solidjs.com/) (Reactive UI) + Vite
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) + Custom CSS Variables
* **Database & Auth:** [Firebase](https://firebase.google.com/) (Firestore & Google Auth)
* **APIs:** TMDB (The Movie Database) & OMDb (Open Movie Database)
* **Deployment:** Netlify

## 📂 Project Structure

```text
cinelog-main/
├── public/                 # Static assets, PWA manifest, and icons
├── src/
│   ├── components/         # Reusable UI components (MovieCard, DirectPlayPlayer, etc.)
│   ├── hooks/              # Custom SolidJS hooks (Modal state, TMDB fetchers, etc.)
│   ├── modals/             # Overlay screens (DetailsModal, SearchModal, Settings)
│   ├── services/           # External API & Database logic
│   ├── views/              # Main app pages (Dashboard, Vault, Analytics, etc.)
│   ├── App.jsx             # Main application layout and router logic
│   ├── firebase.js         # Firebase initialization and config
│   ├── main.jsx            # SolidJS entry point
│   ├── utils.jsx           # Helper functions, formatters, and API constants
│   └── index.css           # Tailwind imports and global theme variables
├── .env.example            # Example environment variables
├── tailwind.config.js      # Tailwind configuration
└── vite.config.js          # Vite configuration
