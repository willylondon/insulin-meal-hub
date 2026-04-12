# Deployment Guide for Insulin-Smart Meal Hub

## Application Summary

A customizable meal-planning system for users with:
- Insulin resistance / type 2 diabetes support (HbA1c: 6.7%, Fasting glucose: 5.6 mmol/L)
- Elevated cholesterol (Total: 6.04 mmol/L, LDL: 3.62 mmol/L)
- Mildly elevated uric acid (0.44 mmol/L)
- On medications: Metformin, Febuxostat, Rosuvastatin

## Deployment Options

### Option 1: Deploy to Vercel (Recommended)

1. **Create a GitHub repository:**
   ```bash
   # Create new repo on GitHub.com
   # Or use GitHub CLI if installed:
   gh repo create insulin-meal-hub --public --description "Customizable meal planning for insulin resistance"
   ```

2. **Push code to GitHub:**
   ```bash
   # Remove old remote if exists
   git remote remove test-origin
   
   # Add your new GitHub repo
   git remote add origin https://github.com/YOUR_USERNAME/insulin-meal-hub.git
   
   # Push code
   git push -u origin main
   ```

3. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect the `vercel.json` configuration
   - Deploy with default settings

### Option 2: Deploy to Netlify

1. **Push to GitHub** (as above)
2. **Go to [netlify.com](https://netlify.com)**
3. **Import from GitHub**
4. **Build settings:**
   - Build command: (leave empty - static site)
   - Publish directory: `.`
   - Deploy site

### Option 3: Manual Hosting (Any static hosting)

1. **Upload all files** to any web hosting service:
   - `index.html`
   - `app.js`
   - `style.css`
   - `manifest.json`
   - `icon-192.svg`, `icon-512.svg`
   - `fallback-data.json`
   - All other supporting files

2. **Ensure proper MIME types:**
   - SVG files should have `image/svg+xml` MIME type
   - JSON files should have `application/json` MIME type

## Local Development

```bash
# Install dependencies (optional)
npm install

# Start local server
npm start
# Or use Python:
python -m http.server 8000
# Or use PHP:
php -S localhost:8000
```

## Configuration Notes

### Google Sheets Integration
The app fetches meal data from a Google Sheet. To update the data source:
1. Edit `CONFIG.GOOGLE_SHEET_ID` in `app.js:5`
2. Edit `CONFIG.SHEET_NAME` in `app.js:6`
3. Make sure the Google Sheet is publicly accessible

### PWA Icons
- Current icons are in SVG format
- For better browser compatibility, convert to PNG:
  - `icon-192.svg` → `icon-192.png` (192×192)
  - `icon-512.svg` → `icon-512.png` (512×512)
- Update `manifest.json` to reference PNG files

### Health Profile Customization
To customize for a different user:
1. Edit `HEALTH_PROFILE` in `app.js:14-38`
2. Adjust scoring thresholds in `scoreMeal` function
3. Update medication considerations as needed

## Security Notes

✅ **XSS Protection:** Implemented with `escapeHtml()` function
✅ **No Sensitive Data:** All data stored locally or in public Google Sheets
✅ **No API Keys:** No external API keys required
⚠️ **Google Sheets Dependency:** Single point of failure - has fallback data

## Features Deployed

1. **Enhanced Health Scoring:**
   - Blood sugar friendliness (HbA1c 6.7% optimized)
   - Insulin resistance support
   - Heart/cholesterol friendliness
   - Gout friendliness with uric acid considerations

2. **Medication-Aware Features:**
   - Metformin: High-carb meal flags
   - Febuxostat: High-purine food flags
   - Rosuvastatin: High-saturated fat flags

3. **Customization Settings:**
   - Budget, meal timing, ingredients on hand
   - Carb tolerance, weight loss goals
   - Jamaican cuisine preferences
   - Meal prep options

4. **Portion Guidance:**
   - Carb portion recommendations
   - Protein optimization tips
   - Practical eating guidelines
   - Meal prep instructions

5. **Jamaican-Accessible Focus:**
   - Local superfoods prioritized
   - Traditional ingredients scoring
   - Budget-friendly options

## Testing After Deployment

1. **Load the application** in a browser
2. **Check settings panel** customization
3. **Test meal generation** for breakfast/lunch/dinner
4. **Verify scoring display** in recipe modals
5. **Test PWA installation** (if supported)
6. **Verify offline functionality** with fallback data

## Troubleshooting

**Issue:** Google Sheets not loading
**Solution:** Check internet connection, verify Sheet is public, fallback data should load

**Issue:** Icons not displaying in PWA
**Solution:** Convert SVG to PNG, update manifest.json

**Issue:** Settings not saving
**Solution:** Check browser localStorage permissions, clear cache

**Issue:** Meal scoring seems incorrect
**Solution:** Verify health profile settings match user metrics

## Support

For issues or enhancements:
1. Check existing issues in GitHub
2. Review code comments for customization
3. Test with different health profiles
4. Adjust scoring thresholds as needed

---
*Last updated: April 12, 2026*