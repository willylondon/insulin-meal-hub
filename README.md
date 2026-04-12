# Insulin-Smart Meal Hub 🍽️

A mobile-first PWA for managing insulin-sensitive Jamaican meals, tracking daily consumption, and exporting data for an ebook.

## 🌟 Features

- **3 Meal Categories**: Breakfast, Lunch, and Dinner suggestions daily
- **30 Pre-loaded Jamaican Recipes**: All designed for insulin sensitivity using local ingredients
- **Offline-First**: Uses Google Sheets as a headless CMS with local JSON fallback
- **Meal Logging**: Track which meals you've eaten with ratings
- **Ebook Data Export**: Export your meal logs as JSON for future analysis
- **Progressive Web App**: Installable on mobile with a native feel

## 📱 Live Demo

[![Vercel](https://vercel.com/button)](https://insulin-meal-hub.vercel.app)

> **Note**: Replace the Google Sheet ID with your own if you want to manage the data.

## 🚀 Quick Deployment

1. **Fork this repository** or create a new one and upload these files.
2. **Connect to Vercel**:
   - Sign in to [Vercel](https://vercel.com) with GitHub
   - Click "Add New..." → "Project"
   - Select your repository
   - Click "Deploy"
3. **Your app is live!** Visit the provided URL.

## 🔧 Configuration

### Google Sheets Integration (Optional)

The app uses a Google Sheet as a headless CMS. You can use the pre-configured public sheet or replace it with your own:

1. **Use the provided sheet**: Already configured in `app.js` (`CONFIG.SHEET_ID = '1yBxlRrZEjBy0z5A7K0T5UihVo3PmWVfm'`)
2. **Create your own sheet**:
   - Duplicate the [template](https://docs.google.com/spreadsheets/d/1yBxlRrZEjBy0z5A7K0T5UihVo3PmWVfm/edit)
   - Update `CONFIG.SHEET_ID` in `app.js` with your sheet ID
   - Make sure sharing settings are "Anyone with the link can view"

### Update Sheet Data

If you want to edit or add meals:

1. Open `UPDATE-SHEET-30-MEALS.html` for complete instructions
2. Use `30-meals-database.csv` to import all 30 meals
3. Use `25-new-meals.csv` to add only the 25 new meals (if keeping existing 5)

## 📁 File Structure

```
├── index.html              # Main app UI (mobile-optimized)
├── style.css               # Mobile-first responsive styles
├── app.js                  # Core application logic
├── manifest.json           # PWA manifest
├── favicon.ico            # App icon
├── vercel.json            # Vercel deployment config
├── package.json           # Project metadata
├── fallback-data.json     # Full 30-meal database (fallback)
├── 30-meals-database.csv  # CSV of all 30 meals
├── 25-new-meals.csv       # CSV of 25 new meals (excluding existing 5)
├── UPDATE-SHEET-30-MEALS.html  # Detailed sheet update guide
├── meal-catalog.html      # Visual gallery of all 30 meals
└── README.md              # This file
```

## 🍽️ Meal Database

The 30-meal database includes:

- **10 Breakfast meals** (BF001–BF010)
- **10 Lunch meals** (LH001–LH010)
- **10 Dinner meals** (DN001–DN010)

Each meal includes:
- Meal ID, Name, Type, Prep Time, Servings, Difficulty
- Ingredients, Instructions, Insulin Benefits, Nutrition Notes
- Tags (High-protein, Low-carb, Omega‑3, etc.)
- Image URL (from Unsplash)

## 📊 Data Flow

1. **Primary source**: Google Sheets → `=gviz/tq?sheet=21%20Recipes`
2. **Fallback**: `fallback-data.json` (same 30 meals)
3. **User logs**: Stored in `localStorage` under `insulinMealHub_logs`
4. **Export**: JSON download via "Export Ebook Data" button

## 🛠️ Development

### Local Testing

Simply open `index.html` in a browser (mobile view recommended). The app works without any build step.

### Customization

- **Colors**: Edit CSS variables in `style.css` (`:root`)
- **Meal categories**: Update `CONFIG.MEAL_TYPES` in `app.js`
- **Default ingredients**: Update the footer text in `index.html`

### Browser Compatibility

Works on all modern browsers (Chrome, Safari, Firefox, Edge) and mobile Safari/Chrome.

## 📝 License

MIT – free to use, modify, and distribute.

## 🙏 Credits

- **Icons**: Font Awesome 6
- **Fonts**: Inter & Poppins from Google Fonts
- **Images**: Unsplash (free stock photos)
- **Inspiration**: Jamaican cuisine and insulin‑sensitive nutrition research

## 🆘 Support

If you encounter issues:

1. Check the browser console for errors
2. Ensure your Google Sheet is publicly viewable
3. Try using the fallback data by disabling network

For questions, reach out via Telegram or GitHub Issues.