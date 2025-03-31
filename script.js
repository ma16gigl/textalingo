const supabase = window.supabase.createClient(
    'https://uxvgqoskjjiwwvbpicrf.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dmdxb3Nramppd3d2YnBpY3JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0Mzk5OTMsImV4cCI6MjA1ODAxNTk5M30.cLhkued4GU774EhTotpFLAfGIH_iPDhVZp2CqRJxUq8'
);

let currentLanguage = null;
let currentStory = [];
let messageIndex = 0;
let translations = {};
let currentPage = 1;
let hasMoreStories = true;
let isAdmin = false;
let fontSizeIndex = 0;
const fontSizes = [1, 1.5, 2];
let adminMessageCount = 1;
let editMessageCount = 0;
let currentStoryId = null;
let instructionState = 0;
let currentSeriesTitle = null; // Tracks the series being generated
let currentEpisodeNumber = 0; // Tracks the episode count

const initialSplashScreen = document.getElementById("initial-splash");
const languageSplashScreen = document.getElementById("language-splash");
const homeScreen = document.getElementById("home");
const storyScreen = document.getElementById("story-screen");
const myWordsScreen = document.getElementById("my-words-screen");
const profileScreen = document.getElementById("profile-screen");
const adminScreen = document.getElementById("admin-screen");
const storyTiles = document.getElementById("story-tiles");
const messagesDiv = document.getElementById("messages");
const backBtn = document.getElementById("back-btn");
const myWordsBackBtn = document.getElementById("my-words-back-btn");
const profileBackBtn = document.getElementById("profile-back-btn");
const favoriteWordsDiv = document.getElementById("favorite-words");
const profileInfoDiv = document.getElementById("profile-info");
const fontSizeBtn = document.getElementById("font-size-btn");
const wordsBtn = document.getElementById("words-btn");
const languageIcon = document.getElementById("language-icon");
const languageDropdown = document.getElementById("language-dropdown");
const languageMenu = document.getElementById("language-menu");
const getStartedBtn = document.getElementById("get-started-btn");

const rtlLanguages = ['hebrew'];

function updateFontSize() {
    const messages = document.querySelectorAll(".message");
    messages.forEach(msg => {
        msg.style.fontSize = `${fontSizes[fontSizeIndex]}rem`;
    });
    console.log("Font size set to:", fontSizes[fontSizeIndex]);
}

async function signOut() {
    await supabase.auth.signOut();
    isAdmin = false;
    adminScreen.classList.add("hidden");
    homeScreen.classList.add("hidden");
    initialSplashScreen.classList.remove("hidden");
    languageDropdown.classList.add("hidden");
}

function showAdmin() {
    homeScreen.classList.add("hidden");
    adminScreen.classList.remove("hidden");
    loadStoryList();
}

function hideAdmin() {
    adminScreen.classList.add("hidden");
    homeScreen.classList.remove("hidden");
    loadHomeScreen(true);
}

function showProfile() {
    homeScreen.classList.add("hidden");
    profileScreen.classList.remove("hidden");
    loadProfile();
}

function hideProfile() {
    profileScreen.classList.add("hidden");
    homeScreen.classList.remove("hidden");
}

async function selectLanguage(lang) {
    currentLanguage = lang;
    currentPage = 1;
    hasMoreStories = true;
    storyTiles.innerHTML = "";
    await loadTranslations();
    languageSplashScreen.classList.add("hidden");
    homeScreen.classList.remove("hidden");
    await loadHomeScreen(true);
    document.documentElement.lang = rtlLanguages.includes(lang) ? 'he' : 'en';
    await updateDropdown();
}

async function loadTranslations() {
    const { data, error } = await supabase.from('message_translations').select('message_text, translation').eq('language', currentLanguage);
    if (error) {
        console.error("Error loading translations:", error.message);
        return;
    }
    translations = {};
    if (data) {
        data.forEach(item => translations[item.message_text.toLowerCase()] = item.translation);
    }
}

async function updateUserSubscription(sessionId) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const userId = userData.user.id;
    const response = await fetch(`/.netlify/functions/verify-session?session_id=${sessionId}`);
    const { status, plan, subscriptionId } = await response.json();

    if (status === 'paid' || status === 'active') {
        await supabase.from('user_subscriptions').upsert({
            user_id: userId,
            plan: plan,
            status: status,
            stripe_sub_id: subscriptionId,
            updated_at: new Date().toISOString()
        });
    }
}

async function loadHomeScreen(clearTiles = false) {
    if (clearTiles) storyTiles.innerHTML = "";
    languageIcon.src = `/Assets/${currentLanguage}.png`;
    
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
        console.error("Error fetching user:", userError.message);
    }
    const user = userData?.user;
    let isPremiumUser = false;

    if (user) {
        const { data: subData, error: subError } = await supabase
            .from('user_subscriptions')
            .select('status')
            .eq('user_id', user.id)
            .limit(1);
        if (subError) {
            console.error("Error fetching subscription:", subError.message);
        } else if (subData && subData.length > 0) {
            isPremiumUser = subData[0].status === 'active' || subData[0].status === 'paid';
        }
    }

    console.log("Fetching stories for language:", currentLanguage);
    const { data: stories, count, error } = await supabase
        .from('stories')
        .select('*', { count: 'exact' })
        .eq('language', currentLanguage)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching stories:", error.message);
        storyTiles.innerHTML = `<p>Error loading stories: ${error.message}</p>`;
        return;
    }

    console.log("Fetched stories:", stories);
    console.log("Total story count:", count);

    hasMoreStories = count > currentPage * 10;

    if (!stories || stories.length === 0) {
        console.log("No stories found for language:", currentLanguage);
        storyTiles.innerHTML = "<p>No stories available for this language yet.</p>";
        return;
    }

    const categories = { "Popular Now": [] };
    stories.forEach(story => {
        const cat = story.category || "Other";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(story);
        if (story.popular_now) categories["Popular Now"].push(story);
    });

    console.log("Categories populated:", categories);

    const categoryOrder = ["Popular Now", "Series", "Romance", "Thriller", "Horror", "Action/Adventure", "SciFi", "Comedy", "Business/Professional", "Mystery", "Other"];
    const orderedCategories = {};
    categoryOrder.forEach(cat => {
        if (categories[cat]) orderedCategories[cat] = categories[cat];
    });

    for (const [category, catStories] of Object.entries(orderedCategories)) {
        console.log(`Rendering category: ${category} with ${catStories.length} stories`);
        const section = document.createElement("div");
        section.classList.add("category-section");

        const header = document.createElement("div");
        header.classList.add("category-header");
        header.innerHTML = `<h2>${category}</h2>`;
        
        const seeMoreBtn = document.createElement("button");
        seeMoreBtn.classList.add("see-more-btn");
        seeMoreBtn.textContent = "See More";
        seeMoreBtn.addEventListener("click", () => showCategoryStories(category));
        header.appendChild(seeMoreBtn);

        section.appendChild(header);

        const carousel = document.createElement("div");
        carousel.classList.add("carousel");

        const track = document.createElement("div");
        track.classList.add("carousel-track");

        catStories.forEach(story => {
            const tile = document.createElement("div");
            tile.classList.add("story-tile");
            if (story.is_new) tile.classList.add("new");
            if (story.premium) tile.classList.add("premium");
            if (story.category === "Series") tile.classList.add("series");
            tile.innerHTML = `
                <img src="${story.cover_photo || 'https://via.placeholder.com/200x300?text=No+Image'}" alt="${story.title}">
                <div class="title">${story.title}</div>
            `;
            tile.addEventListener("click", async () => {
                if (story.premium && !isPremiumUser) {
                    window.location.href = "getpremium.html";
                    return;
                }
                const { data } = await supabase.from('messages').select('*').eq('story_id', story.id);
                currentStory = data;
                currentStoryId = story.id;
                messageIndex = 0;
                messagesDiv.innerHTML = "";
                homeScreen.classList.add("hidden");
                storyScreen.classList.remove("hidden");
                instructionState = localStorage.getItem("hasSeenStoryInstructions") ? 0 : 1;
                showNextMessage();
                if (instructionState === 1) showInstruction();
            });
            track.appendChild(tile);
        });

        carousel.appendChild(track);
        section.appendChild(carousel);
        storyTiles.appendChild(section);
    }

    let loadMoreBtn = document.getElementById("load-more-btn");
    if (!loadMoreBtn && hasMoreStories) {
        loadMoreBtn = document.createElement("button");
        loadMoreBtn.id = "load-more-btn";
        loadMoreBtn.textContent = "Load More";
        loadMoreBtn.addEventListener("click", () => {
            currentPage++;
            loadHomeScreen();
        });
        storyTiles.appendChild(loadMoreBtn);
    }
    if (loadMoreBtn) loadMoreBtn.style.display = hasMoreStories ? "block" : "none";

    await updateDropdown();
}
async function showCategoryStories(category) {
    const categoryScreen = document.createElement("div");
    categoryScreen.id = "category-screen";
    categoryScreen.classList.add("screen");
    categoryScreen.innerHTML = `
        <button id="category-back-btn">Back</button>
        <h1>${category} Stories</h1>
        <div id="category-tiles" class="story-tiles-grid"></div>
    `;
    document.body.appendChild(categoryScreen);

    homeScreen.classList.add("hidden");
    categoryScreen.classList.remove("hidden");

    const backBtn = categoryScreen.querySelector("#category-back-btn");
    backBtn.addEventListener("click", () => {
        categoryScreen.remove();
        homeScreen.classList.remove("hidden");
    });

    const tilesDiv = categoryScreen.querySelector("#category-tiles");
    const query = category === "Popular Now" 
        ? supabase.from('stories').select('*').eq('language', currentLanguage).eq('popular_now', true)
        : supabase.from('stories').select('*').eq('language', currentLanguage).eq('category', category === "Other" ? null : category);

    const { data: stories, error } = await query.order('created_at', { ascending: false });
    if (error) {
        console.error("Error fetching category stories:", error.message);
        tilesDiv.innerHTML = "<p>Failed to load stories. Please try again later.</p>";
        return;
    }

    if (!stories || stories.length === 0) {
        tilesDiv.innerHTML = "<p>No stories available in this category.</p>";
        return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    let isPremiumUser = false;

    if (user) {
        const { data: subData } = await supabase
            .from('user_subscriptions')
            .select('status')
            .eq('user_id', user.id)
            .single();
        isPremiumUser = subData && (subData.status === 'active' || subData.status === 'paid');
    }

    stories.forEach(story => {
        const tile = document.createElement("div");
        tile.classList.add("story-tile");
        if (story.is_new) tile.classList.add("new");
        if (story.premium) tile.classList.add("premium");
        if (story.category === "Series") tile.classList.add("series");
        tile.innerHTML = `
            <img src="${story.cover_photo || 'https://via.placeholder.com/200x300?text=No+Image'}" alt="${story.title}">
            <div class="title">${story.title}</div>
        `;
        tile.addEventListener("click", async () => {
            if (story.premium && !isPremiumUser) {
                window.location.href = "getpremium.html";
                return;
            }
            const { data } = await supabase.from('messages').select('*').eq('story_id', story.id);
            currentStory = data;
            currentStoryId = story.id;
            messageIndex = 0;
            messagesDiv.innerHTML = "";
            categoryScreen.classList.add("hidden");
            storyScreen.classList.remove("hidden");
            instructionState = localStorage.getItem("hasSeenStoryInstructions") ? 0 : 1;
            showNextMessage();
            if (instructionState === 1) showInstruction();
        });
        tilesDiv.appendChild(tile);
    });
}

async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
        const { data: subData } = await supabase
            .from('user_subscriptions')
            .select('plan, status')
            .eq('user_id', userData.user.id)
            .single();
        profileInfoDiv.innerHTML = `
            <p>Email: ${userData.user.email}</p>
            <p>User ID: ${userData.user.id}</p>
            <p>Subscription: ${subData ? `${subData.plan} (${subData.status})` : 'None'}</p>
            ${subData && (subData.plan === 'monthly' || subData.plan === 'annual') && subData.status === 'active' ? '<button id="cancel-sub-btn">Cancel Subscription</button>' : ''}
        `;
        if (subData && (subData.plan === 'monthly' || subData.plan === 'annual') && subData.status === 'active') {
            document.getElementById("cancel-sub-btn").addEventListener("click", cancelSubscription);
        }
    } else {
        profileInfoDiv.innerHTML = "<p>Error loading profile. Please sign in again.</p>";
    }
}

function showInstruction() {
    let instructionDiv = document.querySelector(".story-instruction");
    if (!instructionDiv) {
        instructionDiv = document.createElement("div");
        instructionDiv.className = "story-instruction";
        instructionDiv.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #F40673;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 1.2rem;
            z-index: 100;
        `;
        storyScreen.appendChild(instructionDiv);
    }

    if (instructionState === 1) {
        instructionDiv.textContent = "Tap the screen to generate the next text";
    } else if (instructionState === 2) {
        instructionDiv.textContent = "Tap a text to see the translation";
    }
}

storyScreen.addEventListener("click", (e) => {
    if (e.target.tagName !== "BUTTON" && 
        !e.target.closest(".button-container") && 
        !e.target.closest(".message")) {
        if (instructionState === 1) {
            instructionState = 2;
            showInstruction();
        } else if (instructionState === 2) {
            instructionState = 0;
            const instructionDiv = document.querySelector(".story-instruction");
            if (instructionDiv) storyScreen.removeChild(instructionDiv);
            localStorage.setItem("hasSeenStoryInstructions", "true");
            showNextMessage();
        } else {
            showNextMessage();
        }
    }
});

function showNextMessage() {
    if (!currentStory || currentStory.length === 0) {
        console.error("No messages to display for story:", currentStoryId);
        return;
    }

    if (messageIndex < currentStory.length) {
        const msg = currentStory[messageIndex];
        console.log("Displaying message:", msg);
        addMessage(msg.text, msg.sender);
        messageIndex++;
    } else {
        console.log("Story completed for storyId:", currentStoryId);
    }
}

function addMessage(text, sender) {
    console.log("Adding message - Text:", text, "Sender:", sender);
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", sender);
    if (rtlLanguages.includes(currentLanguage)) {
        msgDiv.classList.add("rtl");
    }
    const translation = translations[text.toLowerCase()] || "Translation not available";
    msgDiv.innerHTML = `
        <div class="flip-container">
            <div class="front-container ${sender}">${text}</div>
            <div class="back-container ${sender}">${translation}</div>
        </div>
    `;
    msgDiv.style.fontSize = `${fontSizes[fontSizeIndex]}rem`;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    msgDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        console.log("Message clicked, toggling flip for:", text);
        msgDiv.classList.toggle("flipped");
    });
}

function getStoryWords() {
    const words = new Set();
    currentStory.forEach(msg => {
        msg.text.split(/\s+/).forEach(word => {
            const cleanWord = word.replace(/[.,!?]/g, '').toLowerCase();
            if (cleanWord) words.add(cleanWord);
        });
    });
    return Array.from(words);
}

function showWordsModal() {
    let wordsModal = document.getElementById("words-modal");
    if (wordsModal) wordsModal.remove();

    wordsModal = document.createElement("div");
    wordsModal.id = "words-modal";
    wordsModal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #fff;
        color: #000;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        max-width: 80%;
        max-height: 80vh;
        overflow-y: auto;
        z-index: 200;
    `;

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "X";
    closeBtn.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: transparent;
        color: #000;
        border: none;
        font-size: 1.2rem;
        font-weight: bold;
        padding: 0;
        width: 20px;
        height: 20px;
        line-height: 20px;
        text-align: center;
        cursor: pointer;
    `;
    closeBtn.addEventListener("click", () => wordsModal.remove());

    const wordsList = document.createElement("div");
    const words = getStoryWords();

    supabase.auth.getUser().then(async ({ data: userData }) => {
        const user = userData?.user;
        let isPremiumUser = false;

        if (user) {
            const { data: subData } = await supabase
                .from('user_subscriptions')
                .select('status')
                .eq('user_id', user.id)
                .single();
            isPremiumUser = subData && (subData.status === 'active' || subData.status === 'paid');
        }

        if (!isPremiumUser) {
            wordsList.innerHTML = "<p>Saving words is a Premium feature. <a href='getpremium.html'>Upgrade to Premium</a> to unlock this!</p>";
        } else {
            words.forEach(word => {
                const wordItem = document.createElement("div");
                wordItem.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 5px 0;
                    border-bottom: 1px solid #eee;
                `;
                const wordText = document.createElement("span");
                wordText.textContent = word;
                const heartBtn = document.createElement("button");
                heartBtn.innerHTML = checkFavorite(word) ? "❤️" : "🤍";
                heartBtn.style.cssText = `
                    background: none;
                    border: none;
                    font-size: 1.2rem;
                    cursor: pointer;
                `;
                heartBtn.addEventListener("click", () => {
                    const translation = translations[word] || "Translation not available";
                    toggleFavorite(word, translation);
                    heartBtn.innerHTML = checkFavorite(word) ? "❤️" : "🤍";
                });
                wordItem.appendChild(wordText);
                wordItem.appendChild(heartBtn);
                wordsList.appendChild(wordItem);
            });
        }

        wordsModal.appendChild(closeBtn);
        wordsModal.appendChild(wordsList);
        document.body.appendChild(wordsModal);
    });
}

async function updateDropdown() {
    languageDropdown.innerHTML = "";
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
        console.error("Error fetching user data:", userError.message);
    }

    const user = userData?.user;

    if (!user) {
        const signInBtn = document.createElement("button");
        signInBtn.textContent = "Sign In";
        signInBtn.addEventListener("click", () => {
            window.location.href = "signin.html";
            languageDropdown.classList.add("hidden");
        });

        const changeLangBtn = document.createElement("button");
        changeLangBtn.textContent = "Change Language";
        changeLangBtn.addEventListener("click", () => {
            homeScreen.classList.add("hidden");
            languageSplashScreen.classList.remove("hidden");
            languageDropdown.classList.add("hidden");
        });

        const getPremiumBtn = document.createElement("button");
        getPremiumBtn.textContent = "Get Premium";
        getPremiumBtn.addEventListener("click", () => {
            window.location.href = "getpremium.html";
            languageDropdown.classList.add("hidden");
        });

        languageDropdown.appendChild(signInBtn);
        languageDropdown.appendChild(changeLangBtn);
        languageDropdown.appendChild(getPremiumBtn);
    } else {
        const profileBtn = document.createElement("button");
        profileBtn.textContent = "Profile";
        profileBtn.addEventListener("click", () => {
            showProfile();
            languageDropdown.classList.add("hidden");
        });

        const myWordsBtn = document.createElement("button");
        myWordsBtn.textContent = "My Words";
        myWordsBtn.addEventListener("click", () => {
            homeScreen.classList.add("hidden");
            myWordsScreen.classList.remove("hidden");
            loadFavoriteWords();
            languageDropdown.classList.add("hidden");
        });

        const changeLangBtn = document.createElement("button");
        changeLangBtn.textContent = "Change Language";
        changeLangBtn.addEventListener("click", () => {
            homeScreen.classList.add("hidden");
            languageSplashScreen.classList.remove("hidden");
            languageDropdown.classList.add("hidden");
        });

        const signOutBtn = document.createElement("button");
        signOutBtn.textContent = "Sign Out";
        signOutBtn.addEventListener("click", () => {
            signOut();
            languageDropdown.classList.add("hidden");
        });

        languageDropdown.appendChild(profileBtn);
        languageDropdown.appendChild(myWordsBtn);
        languageDropdown.appendChild(changeLangBtn);
        languageDropdown.appendChild(signOutBtn);

        if (isAdmin) {
            const adminBtn = document.createElement("button");
            adminBtn.textContent = "Admin Panel";
            adminBtn.addEventListener("click", () => {
                showAdmin();
                languageDropdown.classList.add("hidden");
            });
            languageDropdown.appendChild(adminBtn);
        }
    }
}

languageIcon.addEventListener("click", async (e) => {
    e.stopPropagation();
    await updateDropdown();
    languageDropdown.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
    if (!languageMenu.contains(e.target)) {
        languageDropdown.classList.add("hidden");
    }
});

wordsBtn.addEventListener("click", showWordsModal);

getStartedBtn.addEventListener("click", () => {
    initialSplashScreen.classList.add("hidden");
    languageSplashScreen.classList.remove("hidden");
});

myWordsBackBtn.addEventListener("click", () => {
    myWordsScreen.classList.add("hidden");
    homeScreen.classList.remove("hidden");
});

profileBackBtn.addEventListener("click", hideProfile);

backBtn.addEventListener("click", () => {
    storyScreen.classList.add("hidden");
    homeScreen.classList.remove("hidden");
    messageIndex = 0;
    instructionState = 0;
});

fontSizeBtn.addEventListener("click", () => {
    fontSizeIndex = (fontSizeIndex + 1) % fontSizes.length;
    updateFontSize();
});
function toggleEpisodeField() {
    const category = document.getElementById("bulk-story-category").value;
    const episodeRow = document.getElementById("episode-row");
    episodeRow.style.display = category === "Series" ? "flex" : "none";
}
async function loadSeriesOptions() {
    const language = document.getElementById("bulk-story-language").value;
    const seriesSelect = document.getElementById("bulk-series-select");
    seriesSelect.innerHTML = '<option value="">-- Select an existing series --</option>';

    const { data: seriesStories, error } = await supabase
        .from('stories')
        .select('title')
        .eq('language', language)
        .eq('category', 'Series')
        .order('title');

    if (error) {
        console.error("Error loading series options:", error.message);
        return;
    }

    if (seriesStories && seriesStories.length > 0) {
        const seriesTitles = new Set();
        seriesStories.forEach(story => {
            const match = story.title.match(/^(.*?)\s*(Ep|Episode)\s*\d+$/i);
            const baseTitle = match ? match[1].trim() : story.title;
            seriesTitles.add(baseTitle);
        });

        seriesTitles.forEach(title => {
            const option = document.createElement("option");
            option.value = title;
            option.textContent = title;
            seriesSelect.appendChild(option);
        });
    }
}
function selectExistingSeries() {
    const selectedSeries = document.getElementById("bulk-series-select").value;
    if (selectedSeries) {
        document.getElementById("bulk-story-category").value = "Series";
        toggleEpisodeField();
        document.getElementById("bulk-story-title").value = selectedSeries;
        document.getElementById("bulk-story-text").value = "";
        currentSeriesTitle = selectedSeries;

        // Fetch the highest episode number for this series
        supabase
            .from('stories')
            .select('title')
            .eq('language', document.getElementById("bulk-story-language").value)
            .eq('category', 'Series')
            .like('title', `${selectedSeries}%`)
            .then(({ data, error }) => {
                if (error) {
                    console.error("Error fetching series episodes:", error.message);
                    return;
                }
                let maxEpisode = 0;
                data.forEach(story => {
                    const match = story.title.match(/Ep(?:isode)?\s*(\d+)/i);
                    if (match) {
                        const episodeNum = Number(match[1]);
                        maxEpisode = Math.max(maxEpisode, episodeNum);
                    }
                });
                currentEpisodeNumber = maxEpisode;
                document.getElementById("bulk-story-episode").value = maxEpisode + 1;
                document.getElementById("generate-next-episode-btn").disabled = false;
            });
    }
}

document.getElementById("add-story-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const language = document.getElementById("admin-language").value;
    const title = document.getElementById("admin-title").value;
    const isNew = document.getElementById("admin-is-new").value === "1";
    const popularNow = document.getElementById("admin-popular-now").value === "1";
    const premium = document.getElementById("admin-premium").value === "1";
    const category = document.getElementById("admin-category").value || null;
    const coverPhoto = document.getElementById("admin-cover-photo").value || null;
    const messages = [];
    for (let i = 0; i < adminMessageCount; i++) {
        messages.push({
            text: document.getElementById(`message-${i}-text`).value,
            sender: document.getElementById(`message-${i}-sender`).value,
            delay: Number(document.getElementById(`message-${i}-delay`).value)
        });
    }
    console.log("Adding story with data:", { language, title, is_new: isNew, popular_now: popularNow, premium, category, cover_photo: coverPhoto });
    const { data: story, error: storyError } = await supabase
        .from('stories')
        .insert({ language, title, is_new: isNew, popular_now: popularNow, premium, category, cover_photo: coverPhoto })
        .select()
        .single();
    if (storyError) {
        console.error("Error adding story:", storyError);
        alert("Failed to add story: " + storyError.message);
        return;
    }
    const storyId = story.id;
    const { error: messageError } = await supabase.from('messages').insert(messages.map(msg => ({ story_id: storyId, ...msg })));
    if (messageError) {
        console.error("Error adding messages:", messageError.message);
        alert("Failed to add messages: " + messageError.message);
        return;
    }
    alert("Story added!");
    document.getElementById("add-story-form").reset();
    adminMessageCount = 1;
    document.getElementById("admin-messages").innerHTML = `
        <label>Message 1 Text:</label>
        <textarea id="message-0-text" required></textarea>
        <label>Sender:</label>
        <select id="message-0-sender">
            <option value="received">Received</option>
            <option value="sent">Sent</option>
        </select>
        <label>Delay (ms):</label>
        <input id="message-0-delay" type="number" value="2000">
    `;
});

function addAdminMessage() {
    const messagesDiv = document.getElementById("admin-messages");
    const newMessage = document.createElement("div");
    newMessage.innerHTML = `
        <label>Message ${adminMessageCount + 1} Text:</label>
        <textarea id="message-${adminMessageCount}-text" required></textarea>
        <label>Sender:</label>
        <select id="message-${adminMessageCount}-sender">
            <option value="received">Received</option>
            <option value="sent">Sent</option>
        </select>
        <label>Delay (ms):</label>
        <input id="message-${adminMessageCount}-delay" type="number" value="2000">
    `;
    messagesDiv.appendChild(newMessage);
    adminMessageCount++;
}

document.getElementById("bulk-translation-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const language = document.getElementById("bulk-translation-language").value;
    const text = document.getElementById("bulk-translation-text").value.trim();
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const translationData = lines.map(line => {
        const [message_text, translation] = line.split(',').map(part => part.trim());
        if (!message_text || !translation) {
            throw new Error(`Invalid format in line: "${line}". Expected "sentence,translation".`);
        }
        return { language, message_text: message_text.toLowerCase(), translation };
    });

    const { error } = await supabase.from('message_translations').insert(translationData);
    if (error) {
        console.error("Error adding bulk translations:", error.message);
        alert("Failed to add translations: " + error.message);
        return;
    }

    if (language === currentLanguage) {
        translationData.forEach(({ message_text, translation }) => {
            translations[message_text] = translation;
        });
    }
    
    alert(`Added ${translationData.length} translations successfully!`);
    document.getElementById("bulk-translation-text").value = "";
});

async function generateStory() {
    const language = document.getElementById("bulk-story-language").value;
    const category = document.getElementById("bulk-story-category").value || "General";
    const title = document.getElementById("bulk-story-title").value.trim();
    const episode = category === "Series" ? Number(document.getElementById("bulk-story-episode").value) : 1;

    try {
        const response = await fetch('/.netlify/functions/generate-story', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ language, category, title, episode }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        const storyText = data.story;
        document.getElementById("bulk-story-text").value = storyText;
        alert(`Story${category === "Series" ? ` Episode ${episode}` : ""} generated successfully!`);

        if (category === "Series") {
            currentSeriesTitle = title;
            currentEpisodeNumber = episode;
            document.getElementById("generate-next-episode-btn").disabled = false;
            document.getElementById("bulk-story-episode").value = episode + 1; // Auto-increment for next episode
        }
    } catch (error) {
        console.error("Error generating story:", error);
        alert("Failed to generate story: " + error.message);
    }
}

async function generateNextEpisode() {
    if (!currentSeriesTitle) {
        alert("Please generate the first episode of a series before continuing.");
        return;
    }

    const language = document.getElementById("bulk-story-language").value;
    const title = currentSeriesTitle;
    currentEpisodeNumber = Number(document.getElementById("bulk-story-episode").value);

    try {
        const response = await fetch('/.netlify/functions/generate-story', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                language, 
                category: "Series", 
                title, 
                episode: currentEpisodeNumber 
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        const storyText = data.story;
        document.getElementById("bulk-story-text").value = storyText;
        alert(`Episode ${currentEpisodeNumber} of "${title}" generated successfully!`);
        document.getElementById("bulk-story-episode").value = currentEpisodeNumber + 1; // Auto-increment
    } catch (error) {
        console.error("Error generating next episode:", error);
        alert("Failed to generate next episode: " + error.message);
    }
}

async function addEpisode() {
    const category = document.getElementById("bulk-story-category").value;
    if (category !== "Series") {
        alert("Please select the 'Series' category to add an episode.");
        return;
    }

    const title = document.getElementById("bulk-story-title").value.trim();
    const seriesSelect = document.getElementById("bulk-series-select").value;
    const episodeInput = document.getElementById("bulk-story-episode");

    if (!title && !seriesSelect) {
        alert("Please enter a series title or select an existing series before adding an episode.");
        return;
    }

    let baseTitle = title || seriesSelect;
    let episodeNum;

    if (currentSeriesTitle && (currentSeriesTitle === baseTitle || baseTitle.startsWith(currentSeriesTitle))) {
        episodeNum = currentEpisodeNumber + 1;
    } else {
        // If no current series or switching to a new one, check for existing episodes
        currentSeriesTitle = baseTitle;
        const { data, error } = await supabase
            .from('stories')
            .select('title')
            .eq('language', document.getElementById("bulk-story-language").value)
            .eq('category', 'Series')
            .like('title', `${baseTitle}%`);
        
        if (error) {
            console.error("Error checking existing episodes:", error.message);
            episodeNum = 1;
        } else {
            let maxEpisode = 0;
            data.forEach(story => {
                const match = story.title.match(/Ep(?:isode)?\s*(\d+)/i);
                if (match) {
                    const num = Number(match[1]);
                    maxEpisode = Math.max(maxEpisode, num);
                }
            });
            episodeNum = maxEpisode + 1;
        }
    }

    document.getElementById("bulk-story-title").value = `${baseTitle} Episode ${episodeNum}`;
    document.getElementById("bulk-story-text").value = ""; // Clear previous text
    document.getElementById("bulk-story-episode").value = episodeNum;
    document.getElementById("generate-next-episode-btn").disabled = false;
    currentEpisodeNumber = episodeNum;
}

async function generateCoverPhoto() {
    const storyText = document.getElementById("bulk-story-text").value.trim();
    const title = document.getElementById("bulk-story-title").value.trim();
    const category = document.getElementById("bulk-story-category").value || "General";

    if (!storyText || !title) {
        alert("Please provide both a story and a title before generating a cover photo.");
        return;
    }

    const prompt = `Ultra photorealistic image for a ${category} story "${title}". Capture a vivid, detailed scene with realistic lighting and textures, reflecting the mood and setting from: "${storyText.substring(0, 200)}..."`;
    
    if (prompt.length > 1000) {
        console.warn("Prompt exceeds 1000 characters, truncating:", prompt.length);
        prompt = prompt.substring(0, 999);
    }
    console.log("Prompt length:", prompt.length, "characters");
    console.log("Generated prompt:", prompt);

    try {
        const payload = {
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json"
        };
        console.log("Sending request to OpenAI with payload:", JSON.stringify(payload));
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` // Use environment variable
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI Image API error: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const imageBase64 = data.data[0].b64_json;

        const byteCharacters = atob(imageBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });

        const fileName = `${Date.now()}-${title.replace(/\s+/g, '-').toLowerCase()}.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('cover-photos')
            .upload(fileName, blob, {
                contentType: 'image/png'
            });

        if (uploadError) {
            console.error("Error uploading image to Supabase:", uploadError.message);
            throw new Error(`Failed to upload cover photo: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
            .from('cover-photos')
            .getPublicUrl(fileName);

        const coverPhotoUrl = urlData.publicUrl;
        document.getElementById("bulk-cover-photo").value = coverPhotoUrl;
        alert("Cover photo generated and uploaded successfully!");
    } catch (error) {
        console.error("Error generating cover photo:", error);
        alert("Failed to generate cover photo: " + error.message);
    }
}

document.getElementById("bulk-story-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Bulk story form submitted");

    const language = document.getElementById("bulk-story-language").value;
    const title = document.getElementById("bulk-story-title").value.trim();
    const isNew = document.getElementById("bulk-story-is-new").value === "1";
    const popularNow = document.getElementById("bulk-popular-now").value === "1";
    const premium = document.getElementById("bulk-premium").value === "1";
    const category = document.getElementById("bulk-story-category").value || null;
    const coverPhoto = document.getElementById("bulk-cover-photo").value || null;
    const delay = Number(document.getElementById("bulk-story-delay").value);
    const text = document.getElementById("bulk-story-text").value.trim();

    if (!title) {
        console.error("Title is missing");
        alert("Please enter a title for the story.");
        return;
    }

    if (!text) {
        console.error("Story text is missing");
        alert("Please generate or enter story text.");
        return;
    }

    console.log("Form data:", { language, title, isNew, popularNow, premium, category, coverPhoto, delay, text });

    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const messages = [];
    const translationsData = [];

    try {
        lines.forEach((line, index) => {
            const match = line.match(/^(.*)\s*\((.*)\)\s*(received|sent)$/i);
            if (!match) {
                console.error(`Invalid format in line ${index + 1}: "${line}"`);
                throw new Error(`Invalid format in line ${index + 1}: "${line}". Expected "foreign sentence (English translation) received or sent".`);
            }

            const [_, foreignText, englishTranslation, sender] = match;
            if (!foreignText || !englishTranslation || !sender) {
                console.error(`Missing data in line ${index + 1}: "${line}"`);
                throw new Error(`Missing data in line ${index + 1}: "${line}". All fields are required.`);
            }
            if (!['received', 'sent'].includes(sender.toLowerCase())) {
                console.error(`Invalid sender in line ${index + 1}: "${line}"`);
                throw new Error(`Invalid sender in line ${index + 1}: "${line}". Expected "received" or "sent".`);
            }

            messages.push({ text: foreignText.trim(), sender: sender.toLowerCase(), delay });
            translationsData.push({ language, message_text: foreignText.trim().toLowerCase(), translation: englishTranslation.trim() });
        });

        console.log("Parsed messages:", messages);
        console.log("Parsed translations:", translationsData);

        console.log("Inserting story into Supabase...");
        const { data: story, error: storyError } = await supabase
            .from('stories')
            .insert([{ language, title, is_new: isNew, popular_now: popularNow, premium, category, cover_photo: coverPhoto, created_at: new Date().toISOString() }])
            .select()
            .single();
        if (storyError) {
            console.error("Story insertion error:", storyError);
            throw new Error(`Failed to add story: ${storyError.message}`);
        }
        const storyId = story.id;
        console.log("Story inserted with ID:", storyId);

        console.log("Inserting messages into Supabase...");
        const { error: messageError } = await supabase
            .from('messages')
            .insert(messages.map(msg => ({ story_id: storyId, text: msg.text, sender: msg.sender, delay: msg.delay })));
        if (messageError) {
            console.error("Message insertion error:", messageError);
            throw new Error(`Failed to add messages: ${messageError.message}`);
        }

        console.log("Inserting translations into Supabase...");
        const { error: translationError } = await supabase
            .from('message_translations')
            .insert(translationsData);
        if (translationError) {
            console.error("Translation insertion error:", translationError);
            throw new Error(`Failed to add translations: ${translationError.message}`);
        }

        if (language === currentLanguage) {
            translationsData.forEach(({ message_text, translation }) => {
                translations[message_text] = translation;
            });
            console.log("Updated local translations:", translations);
        }

        console.log("Story successfully saved!");
        alert(`Added story "${title}" with ${messages.length} messages and translations successfully!`);
        
        document.getElementById("bulk-story-text").value = "";
        document.getElementById("bulk-story-title").value = "";
        document.getElementById("bulk-cover-photo").value = "";

        hideAdmin();
        if (currentLanguage === language) {
            console.log("Reloading home screen for language:", language);
            loadHomeScreen(true);
        } else {
            console.log("Language mismatch - not reloading home screen. Current:", currentLanguage, "Story:", language);
        }
    } catch (error) {
        console.error("Submission error:", error);
        alert(error.message);
    }
});

async function loadStoryList() {
    const language = document.getElementById("edit-story-language").value;
    console.log("Selected language:", language);
    const { data: stories, error } = await supabase.from('stories').select('id, title, category').eq('language', language).order('title');
    
    console.log("Stories fetched from Supabase:", stories);
    console.log("Error (if any):", error);

    if (error) {
        console.error("Error loading stories:", error.message);
        alert("Failed to load stories: " + error.message);
        return;
    }

    const storyList = document.getElementById("story-list");
    storyList.innerHTML = "";
    if (!stories || stories.length === 0) {
        storyList.innerHTML = "<p>No stories found for this language.</p>";
        console.log("No stories found for language:", language);
        return;
    }

    // Group series by title prefix (assuming episodes are titled like "Series Name Ep 1")
    const seriesGroups = {};
    const nonSeriesStories = [];
    stories.forEach(story => {
        if (story.category === "Series") {
            const match = story.title.match(/^(.*?)\s*(Ep|Episode)\s*(\d+)/i);
            const seriesTitle = match ? match[1].trim() : story.title;
            if (!seriesGroups[seriesTitle]) seriesGroups[seriesTitle] = [];
            seriesGroups[seriesTitle].push(story);
        } else {
            nonSeriesStories.push(story);
        }
    });

    // Render series groups
    for (const [seriesTitle, episodes] of Object.entries(seriesGroups)) {
        const groupDiv = document.createElement("div");
        groupDiv.classList.add("series-group");
        groupDiv.innerHTML = `
            <button class="series-toggle" onclick="this.nextElementSibling.classList.toggle('hidden')">${seriesTitle} (${episodes.length} Episodes)</button>
            <div class="series-episodes hidden"></div>
        `;
        const episodesDiv = groupDiv.querySelector(".series-episodes");
        episodes.sort((a, b) => {
            const aNum = Number(a.title.match(/Ep(?:isode)?\s*(\d+)/i)?.[1] || 0);
            const bNum = Number(b.title.match(/Ep(?:isode)?\s*(\d+)/i)?.[1] || 0);
            return aNum - bNum;
        });
        episodes.forEach(story => {
            const item = document.createElement("div");
            item.classList.add("story-item");
            item.innerHTML = `
                <span>${story.title}</span>
                <div>
                    <button onclick="editStory('${story.id}')">Edit</button>
                    <button class="delete-btn" onclick="deleteStory('${story.id}')">Delete</button>
                </div>
            `;
            episodesDiv.appendChild(item);
        });
        storyList.appendChild(groupDiv);
    }

    // Render non-series stories
    nonSeriesStories.forEach(story => {
        const item = document.createElement("div");
        item.classList.add("story-item");
        item.innerHTML = `
            <span>${story.title}</span>
            <div>
                <button onclick="editStory('${story.id}')">Edit</button>
                <button class="delete-btn" onclick="deleteStory('${story.id}')">Delete</button>
            </div>
        `;
        storyList.appendChild(item);
    });
    console.log("Story list populated with", stories.length, "stories");
}
async function deleteStory(storyId) {
    if (!confirm("Are you sure you want to delete this story? This action cannot be undone.")) {
        return;
    }

    const { error: messageError } = await supabase.from('messages').delete().eq('story_id', storyId);
    if (messageError) {
        console.error("Error deleting messages:", messageError.message);
        alert("Failed to delete messages: " + messageError.message);
        return;
    }

    const { error: storyError } = await supabase.from('stories').delete().eq('id', storyId);
    if (storyError) {
        console.error("Error deleting story:", storyError.message);
        alert("Failed to delete story: " + storyError.message);
        return;
    }

    alert("Story deleted successfully!");
    loadStoryList();
}

async function editStory(storyId) {
    const { data: story, error: storyError } = await supabase.from('stories').select('*').eq('id', storyId).single();
    if (storyError) {
        console.error("Error loading story:", storyError.message);
        alert("Failed to load story: " + storyError.message);
        return;
    }

    const { data: messages, error: messageError } = await supabase.from('messages').select('*').eq('story_id', storyId);
    if (messageError) {
        console.error("Error loading messages:", messageError.message);
        alert("Failed to load messages: " + messageError.message);
        return;
    }

    const { data: translationsData, error: transError } = await supabase
        .from('message_translations')
        .select('message_text, translation')
        .eq('language', story.language);
    const translationsMap = {};
    if (translationsData) {
        translationsData.forEach(item => {
            translationsMap[item.message_text.toLowerCase()] = item.translation;
        });
    }

    const form = document.getElementById("edit-story-form");
    form.classList.remove("hidden");
    document.getElementById("edit-story-id").value = story.id;
    document.getElementById("edit-language").value = story.language;
    document.getElementById("edit-story-title").value = story.title;
    document.getElementById("edit-story-is-new").value = story.is_new ? "1" : "0";
    document.getElementById("edit-popular-now").value = story.popular_now ? "1" : "0";
    document.getElementById("edit-premium").value = story.premium ? "1" : "0";
    document.getElementById("edit-story-category").value = story.category || "";
    document.getElementById("edit-cover-photo").value = story.cover_photo || "";

    const messagesDiv = document.getElementById("edit-messages");
    messagesDiv.innerHTML = "";
    editMessageCount = 0;
    messages.forEach((msg, index) => {
        const translation = translationsMap[msg.text.toLowerCase()] || "";
        const msgDiv = document.createElement("div");
        msgDiv.innerHTML = `
            <label>Message ${index + 1} Text:</label>
            <textarea id="edit-message-${index}-text" required>${msg.text}</textarea>
            <label>Translation:</label>
            <textarea id="edit-message-${index}-translation">${translation}</textarea>
            <label>Sender:</label>
            <select id="edit-message-${index}-sender">
                <option value="received" ${msg.sender === 'received' ? 'selected' : ''}>Received</option>
                <option value="sent" ${msg.sender === 'sent' ? 'selected' : ''}>Sent</option>
            </select>
            <label>Delay (ms):</label>
            <input id="edit-message-${index}-delay" type="number" value="${msg.delay}">
            <button type="button" onclick="this.parentElement.remove()">Remove</button>
        `;
        messagesDiv.appendChild(msgDiv);
        editMessageCount = index + 1;
    });
}

function addEditMessage() {
    const messagesDiv = document.getElementById("edit-messages");
    const newMessage = document.createElement("div");
    newMessage.innerHTML = `
        <label>Message ${editMessageCount + 1} Text:</label>
        <textarea id="edit-message-${editMessageCount}-text" required></textarea>
        <label>Translation:</label>
        <textarea id="edit-message-${editMessageCount}-translation"></textarea>
        <label>Sender:</label>
        <select id="edit-message-${editMessageCount}-sender">
            <option value="received">Received</option>
            <option value="sent">Sent</option>
        </select>
        <label>Delay (ms):</label>
        <input id="edit-message-${editMessageCount}-delay" type="number" value="2000">
        <button type="button" onclick="this.parentElement.remove()">Remove</button>
    `;
    messagesDiv.appendChild(newMessage);
    editMessageCount++;
}

document.getElementById("edit-story-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const storyId = document.getElementById("edit-story-id").value;
    const language = document.getElementById("edit-language").value;
    const title = document.getElementById("edit-story-title").value;
    const isNew = document.getElementById("edit-story-is-new").value === "1";
    const popularNow = document.getElementById("edit-popular-now").value === "1";
    const premium = document.getElementById("edit-premium").value === "1";
    const category = document.getElementById("edit-story-category").value || null;
    const coverPhoto = document.getElementById("edit-cover-photo").value || null;

    const messages = [];
    const translationsToUpdate = [];
    for (let i = 0; i < editMessageCount; i++) {
        const textEl = document.getElementById(`edit-message-${i}-text`);
        const translationEl = document.getElementById(`edit-message-${i}-translation`);
        const senderEl = document.getElementById(`edit-message-${i}-sender`);
        const delayEl = document.getElementById(`edit-message-${i}-delay`);
        if (textEl && senderEl && delayEl) {
            const messageText = textEl.value;
            messages.push({
                text: messageText,
                sender: senderEl.value,
                delay: Number(delayEl.value)
            });
            if (translationEl && translationEl.value) {
                translationsToUpdate.push({
                    language,
                    message_text: messageText.toLowerCase(),
                    translation: translationEl.value
                });
            }
        }
    }

    console.log("Updating story with data:", { id: storyId, language, title, is_new: isNew, popular_now: popularNow, premium, category, cover_photo: coverPhoto });
    const { error: storyError } = await supabase
        .from('stories')
        .upsert({ id: storyId, language, title, is_new: isNew, popular_now: popularNow, premium, category, cover_photo: coverPhoto });
    if (storyError) {
        console.error("Error updating story:", storyError);
        alert("Failed to update story: " + storyError.message);
        return;
    }

    const { error: deleteMessageError } = await supabase.from('messages').delete().eq('story_id', storyId);
    if (deleteMessageError) {
        console.error("Error deleting old messages:", deleteMessageError.message);
        alert("Failed to delete old messages: " + deleteMessageError.message);
        return;
    }

    const { error: messageError } = await supabase.from('messages').insert(messages.map(msg => ({ story_id: storyId, ...msg })));
    if (messageError) {
        console.error("Error updating messages:", messageError.message);
        alert("Failed to update messages: " + messageError.message);
        return;
    }

    if (translationsToUpdate.length > 0) {
        const { error: deleteTransError } = await supabase.from('message_translations').delete().eq('language', language);
        if (deleteTransError) {
            console.error("Error deleting old translations:", deleteTransError.message);
            alert("Failed to delete old translations: " + deleteTransError.message);
            return;
        }

        const { error: transError } = await supabase.from('message_translations').insert(translationsToUpdate);
        if (transError) {
            console.error("Error saving translations:", transError.message);
            alert("Failed to save translations: " + transError.message);
            return;
        }
    }

    alert(`Story "${title}" updated with ${messages.length} messages!`);
    document.getElementById("edit-story-form").classList.add("hidden");
    loadStoryList();
});

function toggleFavorite(word, translation) {
    const key = `${currentLanguage}_favorites`;
    let favorites = JSON.parse(localStorage.getItem(key)) || [];
    const index = favorites.findIndex(item => item.word === word);
    if (index === -1) {
        favorites.push({ word, translation });
    } else {
        favorites.splice(index, 1);
    }
    localStorage.setItem(key, JSON.stringify(favorites));
}

function checkFavorite(word) {
    const key = `${currentLanguage}_favorites`;
    const favorites = JSON.parse(localStorage.getItem(key)) || [];
    return favorites.some(item => item.word === word);
}

function loadFavoriteWords() {
    const key = `${currentLanguage}_favorites`;
    const favorites = JSON.parse(localStorage.getItem(key)) || [];
    favoriteWordsDiv.innerHTML = "";
    favorites.forEach(({ word, translation }) => {
        const item = document.createElement("div");
        item.classList.add("word-item");
        item.innerHTML = `<span>${word} - ${translation}</span>`;
        favoriteWordsDiv.appendChild(item);
    });
    if (favorites.length === 0) {
        favoriteWordsDiv.innerHTML = "<p>No favorite words yet!</p>";
    }
}

async function handlePaymentSuccess(sessionId) {
    console.log("Handling payment success for session:", sessionId);
    try {
        await updateUserSubscription(sessionId);
        console.log("Subscription updated, redirecting to home");
        window.location.href = "/";
    } catch (error) {
        console.error("Error in handlePaymentSuccess:", error);
        window.location.href = "/"; // Redirect anyway as fallback
    }
}

async function cancelSubscription() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
        alert("Please sign in to manage your subscription.");
        return;
    }

    const userId = userData.user.id;
    const { data: subData } = await supabase
        .from('user_subscriptions')
        .select('plan, status')
        .eq('user_id', userId)
        .single();

    if (!subData || subData.status !== 'active') {
        alert("No active subscription found to cancel.");
        return;
    }

    if (subData.plan === 'lifetime') {
        alert("Lifetime plans cannot be canceled as they are one-time purchases.");
        return;
    }

    try {
        const response = await fetch('/.netlify/functions/cancel-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Cancellation failed: ${errorText}`);
        }

        const result = await response.json();
        console.log("Cancellation result:", result);
        alert("Your subscription has been canceled. You’ll retain access until the end of your current billing period.");
        loadProfile(); // Refresh profile display
    } catch (error) {
        console.error("Error canceling subscription:", error);
        alert("Failed to cancel subscription. Please try again or contact support.");
    }
}

(async function checkUserOnLoad() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
        console.error("Error checking user on load:", userError.message);
    }

    const user = userData?.user;

    if (user) {
        // Don’t call loadHomeScreen immediately; wait for language selection
        initialSplashScreen.classList.add("hidden");
        languageSplashScreen.classList.remove("hidden");
        const { data: adminData, error: adminError } = await supabase.from('admins').select('user_id').eq('user_id', user.id).single();
        if (adminError) console.error("Admin check error:", adminError.message);
        isAdmin = !!adminData;
    } else {
        initialSplashScreen.classList.remove("hidden");
        languageSplashScreen.classList.add("hidden");
    }
    await updateDropdown();
})();