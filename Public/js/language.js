
// BloodLink language translations

const translations = {
    en: {
        home: "Home",
        howItWorks: "How It Works",
        getInvolved: "Get Involved",
        findDonor: "Find a Donor",
        donate: "Donate",
        heroBadge: "● Connecting Donors Across Rwanda",
        heroTitle: "Donate Blood.",
        heroLine2: "Save Lives.",
        heroLine3: "Instantly.",
        heroDescription: "Connect with willing blood donors across Rwanda through a platform that helps people find donors by blood type and district.",
        needBlood: "♥ I Need Blood →",
        wantDonate: "♡ I Want to Donate →",
        donorConsent: "✓ Donor Consent",
        communitySupport: "♡ Community Support",
        acrossRwanda: "📍 Across Rwanda"
    },

    rw: {
        home: "Ahabanza",
        howItWorks: "Uko Bikora",
        getInvolved: "Tanga Umusanzu",
        findDonor: "Shaka Utanga Amaraso",
        donate: "Tanga Amaraso",
        heroBadge: "● Duhuza Abatanga Amaraso mu Rwanda",
        heroTitle: "Tanga Amaraso.",
        heroLine2: "Kiza Ubuzima.",
        heroLine3: "Ako kanya.",
        heroDescription: "Huza abantu bakeneye amaraso n'abemeye kuyatanga mu Rwanda, ukurikije ubwoko bw'amaraso n'akarere.",
        needBlood: "♥ Nkeneye Amaraso →",
        wantDonate: "♡ Ndashaka Gutanga Amaraso →",
        donorConsent: "✓ Uruhushya rw'Utanga Amaraso",
        communitySupport: "♡ Ubufatanye bw'Abaturage",
        acrossRwanda: "📍 Mu Rwanda"
    }
};

// Get the language selector
const languageSelector = document.getElementById("languageSelector");

// Function to change the website language
function changeLanguage(language) {
    const elements = document.querySelectorAll("[data-translate]");

    elements.forEach((element) => {
        const key = element.getAttribute("data-translate");

        if (translations[language][key] !== undefined) {
            element.textContent = translations[language][key];
        }
    });
}

// Listen for language selection
if (languageSelector) {
    languageSelector.addEventListener("change", function () {
        changeLanguage(languageSelector.value);
    });
}
