// BloodLink language translations (English / Kinyarwanda)
// NOTE: per the SRS, two Kinyarwanda speakers should check these in Sprint 4.

const translations = {
    en: {
        // Navigation
        home: "Home",
        howItWorks: "How It Works",
        getInvolved: "Get Involved",
        help: "Help",
        findDonor: "Find a Donor",
        donate: "Donate",

        // Homepage hero
        heroBadge: "● Connecting Donors Across Rwanda",
        heroTitle: "Donate Blood.",
        heroLine2: "Save Lives.",
        heroLine3: "Instantly.",
        heroDescription: "Connect with willing blood donors across Rwanda through a platform that helps people find donors by blood type and district.",
        needBlood: "♥ I Need Blood →",
        wantDonate: "♡ I Want to Donate →",
        donorConsent: "✓ Donor Consent",
        communitySupport: "♡ Community Support",
        acrossRwanda: "📍 Across Rwanda",

    },

    rw: {
        // Navigation
        home: "Ahabanza",
        howItWorks: "Uko Bikora",
        getInvolved: "Tanga Umusanzu",
        help: "Ubufasha",
        findDonor: "Shaka Utanga Amaraso",
        donate: "Tanga Amaraso",

        // Homepage hero
        heroBadge: "● Duhuza Abatanga Amaraso mu Rwanda",
        heroTitle: "Tanga Amaraso.",
        heroLine2: "Kiza Ubuzima.",
        heroLine3: "Ako kanya.",
        heroDescription: "Huza abantu bakeneye amaraso n'abemeye kuyatanga mu Rwanda, ukurikije ubwoko bw'amaraso n'akarere.",
        needBlood: "♥ Nkeneye Amaraso →",
        wantDonate: "♡ Ndashaka Gutanga Amaraso →",
        donorConsent: "✓ Uruhushya rw'Utanga Amaraso",
        communitySupport: "♡ Ubufatanye bw'Abaturage",
        acrossRwanda: "📍 Mu Rwanda Hose",

    }
};

const LANGUAGE_KEY = "bloodlinkLanguage";

function getLanguage() {
    try {
        const saved = localStorage.getItem(LANGUAGE_KEY);
        if (saved && translations[saved]) return saved;
    } catch (error) {
        // localStorage can be blocked; English is the default
    }
    return "en";
}

// Translate one key, e.g. t("resultsCount", { n: 3 })
function t(key, values = {}) {
    const language = getLanguage();
    let text = translations[language][key] || translations.en[key] || key;

    Object.keys(values).forEach((name) => {
        text = text.replace(`{${name}}`, values[name]);
    });
    return text;
}

// Function to change the website language
function changeLanguage(language) {
    if (!translations[language]) language = "en";

    try {
        localStorage.setItem(LANGUAGE_KEY, language);
    } catch (error) {
        // ignore
    }

    document.documentElement.lang = language === "rw" ? "rw" : "en";

    document.querySelectorAll("[data-translate]").forEach((element) => {
        const key = element.getAttribute("data-translate");
        if (translations[language][key] !== undefined) {
            element.textContent = translations[language][key];
        }
    });

    document.querySelectorAll("[data-translate-placeholder]").forEach((element) => {
        const key = element.getAttribute("data-translate-placeholder");
        if (translations[language][key] !== undefined) {
            element.placeholder = translations[language][key];
        }
    });

    const selector = document.getElementById("languageSelector");
    if (selector) selector.value = language;

    // Lets each page redraw messages and results built with JavaScript
    document.dispatchEvent(new CustomEvent("languagechange", { detail: { language } }));
}

// Listen for language selection and apply the saved language on every page
document.addEventListener("DOMContentLoaded", () => {
    const languageSelector = document.getElementById("languageSelector");

    if (languageSelector) {
        languageSelector.addEventListener("change", () => changeLanguage(languageSelector.value));
    }

    changeLanguage(getLanguage());
});
