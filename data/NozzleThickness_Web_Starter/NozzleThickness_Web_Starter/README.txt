NOZZLE THICKNESS WEB APP

1. Copy your existing schedule_data.csv into the data folder.
2. The exact path must be: data/schedule_data.csv
3. Keep the CSV header and three columns in this order:
   size,schedule,thickness
4. Do not publish until the app has been tested with the examples below.

Expected checks (based on the supplied schedule data):
- Diameter 80, average 5.10 -> SCH 30, standard thickness 4.78 mm
- Diameter 80, average 5.25 -> SCH 40, standard thickness 5.49 mm
- Diameter 100, average 5.16 -> SCH Undefined, standard thickness 5.16 mm

To publish later:
- Upload the contents of this folder (including index.html and data/) to a GitHub repository.
- Enable GitHub Pages from Settings > Pages, using the main branch and root folder.
- GitHub Pages serves the site over HTTPS, which is needed for service-worker offline support.
- The repository and site contents will be publicly accessible. Do not include confidential files.

On iPhone:
1. Open the published HTTPS link in Safari.
2. Tap Share.
3. Choose Add to Home Screen, then Add.
4. Open the new Home Screen icon once while online. After the first successful load, test offline mode.

Note: This is a web app/PWA, not a native IPA or App Store app.
