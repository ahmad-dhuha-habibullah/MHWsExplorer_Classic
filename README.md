# Marine Heatwave Explorer - Southern Bali

A web application for visualizing Sea Surface Temperature (SST) data and detecting Marine Heatwaves (MHWs) for three locations in Southern Bali: Jimbaran, Nusa Dua, and Sanur.

## Features

- **Real-time SST Data**: Fetches data from Open-Meteo API with fallback to local data
- **Marine Heatwave Detection**: Automatically detects and categorizes marine heatwaves
- **Interactive Charts**: Professional Chart.js visualizations with customizable time ranges
- **Data Archiving**: Automatic daily data updates stored in localStorage
- **Multiple Locations**: Switch between Jimbaran, Nusa Dua, and Sanur
- **Responsive Design**: Works on desktop and mobile devices

## Data Sources

- **SST Data**: Open-Meteo Marine API (https://marine-api.open-meteo.com/)
- **Baseline Data**: Local CSV file with climatological means and 90th percentiles
- **Fallback Data**: Local JSON file for offline testing

## Marine Heatwave Categories

- **Heat Spike**: SST > 90th percentile for ≥5 days
- **Category I**: SST > 90th percentile + 1°C for ≥5 days
- **Category II**: SST > 90th percentile + 2°C for ≥5 days
- **Category III**: SST > 90th percentile + 3°C for ≥5 days
- **Category IV**: SST > 90th percentile + 4°C for ≥5 days

## Usage

1. Open `index.html` in a web browser
2. Select a location from the dropdown
3. Adjust the date range using the date pickers
4. Modify Y-axis limits as needed
5. Click "Apply" buttons to update the chart
6. Use "Update Data" to fetch fresh data from the API

## Technical Details

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js with date-fns adapter
- **Data Processing**: PapaParse for CSV parsing
- **API Calls**: Axios for HTTP requests
- **Storage**: localStorage for data persistence

## File Structure

```
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── script.js           # JavaScript application logic
├── baseline.csv        # Climatological baseline data
├── current_sst.csv     # Archived SST data (editable)
├── sst_example.json    # Fallback SST data
├── heatwave_plot.png   # Reference visualization
└── README.md           # This file
```

## Data Management

### CSV Data Format

The archived SST data is stored in `current_sst.csv` with the following format:

```csv
date,jimbaran,nusadua,sanur
2025-01-01,28.5,28.3,28.4
2025-01-02,28.7,28.5,28.6
...
```

### Manual Data Editing

1. **Export CSV**: Click "Export CSV" to download the current archived data
2. **Edit Data**: Open the CSV file in Excel, Google Sheets, or any text editor
3. **Import CSV**: Use "Import CSV" to upload your edited data back to the application
4. **Add Historical Data**: Add rows for historical dates with temperature values
5. **Update Data**: The application will merge imported data with existing archives

### Data Sources

- **Primary**: Open-Meteo Marine API (automatic updates)
- **Secondary**: Manual CSV import/export for historical data
- **Fallback**: sst_example.json for offline testing

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Data Update Schedule

The application automatically checks for data updates every 24 hours. Manual updates can be triggered using the "Update Data" button.

## Current Time Reference

The application uses September 10, 2025, 01:19 PM WIB as the current time reference for "now" line positioning.
