import worldCountries from 'world-countries';
import getSymbolFromCurrency from 'currency-symbol-map';

export const COUNTRY_OPTIONS = worldCountries.map(country => {
    const currencyCode = country.currencies
        ? Object.keys(country.currencies)[0]
        : 'USD';

    return {
        value: country.name.common,
        label: country.name.common,
        code: country.cca2,
        currency: currencyCode,
        currencySymbol: getSymbolFromCurrency(currencyCode) || '$',
    };
}).sort((a, b) => a.label.localeCompare(b.label));

export const ALL_CURRENCIES = (() => {
    const currencies = new Set<string>();
    COUNTRY_OPTIONS.forEach(c => { if (c.currency) currencies.add(c.currency); });
    return Array.from(currencies).sort().map(currency => ({
        value: currency,
        label: `${currency} - ${getSymbolFromCurrency(currency) || ''}`,
        symbol: getSymbolFromCurrency(currency) || currency,
    }));
})();

export const getStatesByCountry = (countryName: string): string[] => {
    const statesMap: { [key: string]: string[] } = {
        'India': ["Andhra Pradesh", "Karnataka", "Kerala", "Tamil Nadu", "Telangana",
            "Maharashtra", "Delhi", "Gujarat", "Rajasthan", "West Bengal",
            "Uttar Pradesh", "Madhya Pradesh", "Bihar", "Punjab", "Haryana"],
        'United States': ["California", "Texas", "Florida", "New York", "Pennsylvania",
            "Illinois", "Ohio", "Georgia", "North Carolina", "Michigan",
            "New Jersey", "Virginia", "Washington", "Massachusetts", "Arizona"],
        'United Kingdom': ["England", "Scotland", "Wales", "Northern Ireland"],
        'Canada': ["Ontario", "Quebec", "British Columbia", "Alberta",
            "Manitoba", "Saskatchewan", "Nova Scotia", "New Brunswick"],
        'Australia': ["New South Wales", "Victoria", "Queensland", "Western Australia",
            "South Australia", "Tasmania", "Australian Capital Territory"],
        'Germany': ["Berlin", "Bavaria", "Hamburg", "Hesse", "Lower Saxony",
            "North Rhine-Westphalia", "Baden-Württemberg"],
        'France': ["Paris", "Provence-Alpes-Côte d'Azur", "Auvergne-Rhône-Alpes",
            "Nouvelle-Aquitaine", "Occitanie", "Grand Est"],
        'Japan': ["Tokyo", "Osaka", "Kyoto", "Hokkaido", "Fukuoka", "Aichi", "Hyogo"],
        'Singapore': ["Singapore"],
        'United Arab Emirates': ["Abu Dhabi", "Dubai", "Sharjah", "Ajman",
            "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"],
    };
    return statesMap[countryName] || [];
};