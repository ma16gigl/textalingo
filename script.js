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
let currentSeriesTitle = null;
let currentEpisodeNumber = 0;

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
const dropZone = document.getElementById("drop-zone");
const coverPhotoInput = document.getElementById("cover-photo-input");
const coverPhotoPreview = document.getElementById("cover-photo-preview");
const bulkCoverPhoto = document.getElementById("bulk-cover-photo");
let selectedFile = null;

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
        data.forEach(item => {
            translations[item.message_text.toLowerCase()] = item.translation;
        });
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

    // Group series episodes
    const seriesGroups = {};
    const nonSeriesStories = [];
    stories.forEach(story => {
        if (story.category === "Series") {
            const match = story.title.match(/^(.*?)(?:\s*(Ep|Episode)\s*(\d+))?$/i);
            const seriesTitle = match ? match[1].trim() : story.title;
            if (!seriesGroups[seriesTitle]) {
                seriesGroups[seriesTitle] = [];
            }
            seriesGroups[seriesTitle].push(story);
        } else {
            nonSeriesStories.push(story);
        }
    });

    const categories = { "Popular Now": [] };
    nonSeriesStories.forEach(story => {
        const cat = story.category || "Other";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(story);
        if (story.popular_now) categories["Popular Now"].push(story);
    });

    // Add series as a single grouped entry under "Series" category
    if (Object.keys(seriesGroups).length > 0) {
        categories["Series"] = Object.entries(seriesGroups).map(([title, episodes]) => ({ title, episodes }));
    }

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

        catStories.forEach(item => {
            const tile = document.createElement("div");
            tile.classList.add("story-tile");

            if (category === "Series") {
                // Series tile with stacked effect
                const series = item;
                const episodeCount = series.episodes.length;
                tile.classList.add("series-deck");
                tile.innerHTML = `
                    <div class="card-stack">
                        <div class="card card-1"><img src="${series.episodes[0].cover_photo || 'https://via.placeholder.com/200x300?text=No+Image'}" alt="${series.title}"></div>
                        ${episodeCount > 1 ? '<div class="card card-2"></div>' : ''}
                        ${episodeCount > 2 ? '<div class="card card-3"></div>' : ''}
                    </div>
                    <div class="title">${series.title} (${episodeCount} Episodes)</div>
                `;
                tile.addEventListener("click", () => showSeriesEpisodesFrontend(series.title, series.episodes, isPremiumUser));
            } else {
                // Non-series tile
                const story = item;
                if (story.is_new) tile.classList.add("new");
                if (story.premium) tile.classList.add("premium");
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
            }
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

async function showSeriesEpisodesFrontend(seriesTitle, episodes, isPremiumUser) {
    const seriesScreen = document.createElement("div");
    seriesScreen.id = "series-screen";
    seriesScreen.classList.add("screen");
    seriesScreen.innerHTML = `
        <button id="series-back-btn">Back</button>
        <h1>${seriesTitle} (${episodes.length} Episodes)</h1>
        <div id="series-episodes-tiles" class="story-tiles-grid"></div>
    `;
    document.body.appendChild(seriesScreen);

    homeScreen.classList.add("hidden");
    seriesScreen.classList.remove("hidden");

    const backBtn = seriesScreen.querySelector("#series-back-btn");
    backBtn.addEventListener("click", () => {
        seriesScreen.remove();
        homeScreen.classList.remove("hidden");
    });

    const tilesDiv = seriesScreen.querySelector("#series-episodes-tiles");

    episodes.forEach(story => {
        const tile = document.createElement("div");
        tile.classList.add("story-tile");
        if (story.is_new) tile.classList.add("new");
        if (story.premium) tile.classList.add("premium");
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
            seriesScreen.classList.add("hidden");
            storyScreen.classList.remove("hidden");
            instructionState = localStorage.getItem("hasSeenStoryInstructions") ? 0 : 1;
            showNextMessage();
            if (instructionState === 1) showInstruction();
        });
        tilesDiv.appendChild(tile);
    });
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
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
        console.error("Error loading user for profile:", userError?.message);
        profileInfoDiv.innerHTML = "<p>Error loading profile. Please sign in again.</p>";
        return;
    }

    const user = userData.user;
    console.log("Loading profile for user:", user.email, "ID:", user.id);

    const { data: subData, error: subError } = await supabase
        .from('user_subscriptions')
        .select('plan, status')
        .eq('user_id', user.id)
        .single();

    if (subError && subError.code !== 'PGRST116') {
        console.error("Error fetching subscription:", subError.message, "Code:", subError.code);
        profileInfoDiv.innerHTML = `
            <p>Email: ${user.email}</p>
            <p>User ID: ${user.id}</p>
            <p>Subscription: Error loading subscription data (${subError.message})</p>
        `;
    } else {
        const hasActiveSubscription = subData && (subData.plan === 'monthly' || subData.plan === 'annual') && subData.status === 'active';
        profileInfoDiv.innerHTML = `
            <p>Email: ${user.email}</p>
            <p>User ID: ${user.id}</p>
            <p>Subscription: ${subData ? `${subData.plan} (${subData.status})` : 'None'}</p>
            ${hasActiveSubscription ? '<button id="cancel-sub-btn">Cancel Subscription</button>' : ''}
        `;
        
        const cancelBtn = document.getElementById("cancel-sub-btn");
        if (cancelBtn) {
            cancelBtn.addEventListener("click", cancelSubscription);
            console.log("Cancel Subscription button added and listener attached.");
        } else {
            console.log("No active subscription, Cancel button not added.");
        }
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
    console.log("Starting updateDropdown...");
    languageDropdown.innerHTML = "";
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
        console.error("Error fetching user in updateDropdown:", userError.message);
    }

    const user = userData?.user;

    if (!user) {
        console.log("No user logged in, adding guest options.");
        const signInBtn = document.createElement("button");
        signInBtn.textContent = "Sign In";
        signInBtn.addEventListener("click", () => {
            console.log("Sign In clicked.");
            window.location.href = "signin.html";
            languageDropdown.classList.add("hidden");
        });

        const changeLangBtn = document.createElement("button");
        changeLangBtn.textContent = "Change Language";
        changeLangBtn.addEventListener("click", () => {
            console.log("Change Language clicked.");
            homeScreen.classList.add("hidden");
            languageSplashScreen.classList.remove("hidden");
            languageDropdown.classList.add("hidden");
        });

        const getPremiumBtn = document.createElement("button");
        getPremiumBtn.textContent = "Get Premium";
        getPremiumBtn.addEventListener("click", () => {
            console.log("Get Premium clicked.");
            window.location.href = "getpremium.html";
            languageDropdown.classList.add("hidden");
        });

        languageDropdown.appendChild(signInBtn);
        languageDropdown.appendChild(changeLangBtn);
        languageDropdown.appendChild(getPremiumBtn);
        console.log("Guest dropdown options added: Sign In, Change Language, Get Premium");
    } else {
        console.log("User logged in - Email:", user.email, "ID:", user.id);

        const ADMIN_USER_ID = 'b88bb10f-064d-412d-a03f-83d7b1282c11';
        isAdmin = user.id === ADMIN_USER_ID;
        console.log("Hardcoded admin check - User ID:", user.id, "Matches", ADMIN_USER_ID, "?", isAdmin);

        const profileBtn = document.createElement("button");
        profileBtn.textContent = "Profile";
        profileBtn.addEventListener("click", () => {
            console.log("Profile clicked.");
            showProfile();
            languageDropdown.classList.add("hidden");
        });

        const myWordsBtn = document.createElement("button");
        myWordsBtn.textContent = "My Words";
        myWordsBtn.addEventListener("click", () => {
            console.log("My Words clicked.");
            homeScreen.classList.add("hidden");
            myWordsScreen.classList.remove("hidden");
            loadFavoriteWords();
            languageDropdown.classList.add("hidden");
        });

        const changeLangBtn = document.createElement("button");
        changeLangBtn.textContent = "Change Language";
        changeLangBtn.addEventListener("click", () => {
            console.log("Change Language clicked.");
            homeScreen.classList.add("hidden");
            languageSplashScreen.classList.remove("hidden");
            languageDropdown.classList.add("hidden");
        });

        const signOutBtn = document.createElement("button");
        signOutBtn.textContent = "Sign Out";
        signOutBtn.addEventListener("click", () => {
            console.log("Sign Out clicked.");
            signOut();
            languageDropdown.classList.add("hidden");
        });

        languageDropdown.appendChild(profileBtn);
        languageDropdown.appendChild(myWordsBtn);
        languageDropdown.appendChild(changeLangBtn);
        languageDropdown.appendChild(signOutBtn);
        console.log("Basic user options added: Profile, My Words, Change Language, Sign Out");

        if (isAdmin) {
            const adminBtn = document.createElement("button");
            adminBtn.textContent = "Admin Panel";
            adminBtn.addEventListener("click", () => {
                console.log("Admin Panel clicked.");
                showAdmin();
                languageDropdown.classList.add("hidden");
            });
            languageDropdown.appendChild(adminBtn);
            console.log("Admin Panel button added to dropdown.");
        } else {
            console.log("isAdmin is false, skipping Admin Panel button.");
        }
    }

    console.log("updateDropdown completed. Dropdown HTML:", languageDropdown.innerHTML);
}

languageIcon.addEventListener("click", async (e) => {
    e.stopPropagation();
    console.log("Language icon clicked, updating and toggling dropdown.");
    await updateDropdown();
    languageDropdown.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
    if (!languageMenu.contains(e.target)) {
        console.log("Clicked outside language menu, hiding dropdown.");
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

    console.log("Series stories fetched:", seriesStories);

    if (seriesStories && seriesStories.length > 0) {
        const seriesTitles = new Set();
        seriesStories.forEach(story => {
            const match = story.title.match(/^(.*?)(?:\s*(Ep|Episode)\s*\d+)?$/i);
            const baseTitle = match ? match[1].trim() : story.title;
            seriesTitles.add(baseTitle);
        });

        seriesTitles.forEach(title => {
            const option = document.createElement("option");
            option.value = title;
            option.textContent = title;
            seriesSelect.appendChild(option);
        });
    } else {
        console.log("No series found for language:", language);
    }
}

function selectExistingSeries() {
    const selectedSeries = document.getElementById("bulk-series-select").value;
    console.log("Selected series:", selectedSeries);
    if (selectedSeries) {
        document.getElementById("bulk-story-category").value = "Series";
        toggleEpisodeField();
        document.getElementById("bulk-story-title").value = selectedSeries;
        document.getElementById("bulk-story-text").value = "";
        currentSeriesTitle = selectedSeries;

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
                console.log("Matching series episodes:", data);
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
    } else {
        console.log("No series selected");
    }
}

async function generateStory() {
    const language = document.getElementById("bulk-story-language").value;
    const category = document.getElementById("bulk-story-category").value || "General";
    const title = document.getElementById("bulk-story-title").value.trim();
    const episode = category === "Series" ? Number(document.getElementById("bulk-story-episode").value) : 1;

    try {
        const response = await fetch('/.netlify/functions/generate-story', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ language, category, title, episode })
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
            document.getElementById("bulk-story-episode").value = episode + 1;
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
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                language, 
                category: "Series", 
                title, 
                episode: currentEpisodeNumber 
            })
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
        document.getElementById("bulk-story-episode").value = currentEpisodeNumber + 1;
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
    document.getElementById("bulk-story-text").value = "";
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
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
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

dropZone.addEventListener("click", () => coverPhotoInput.click());

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
        handleFile(file);
    }
});

coverPhotoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
});

function handleFile(file) {
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        coverPhotoPreview.src = e.target.result;
        coverPhotoPreview.style.display = "block";
        dropZone.querySelector("p").style.display = "none";
    };
    reader.readAsDataURL(file);
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
    let coverPhoto = bulkCoverPhoto.value || null;
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

    if (selectedFile) {
        const fileName = `${Date.now()}-${title.replace(/\s+/g, '-').toLowerCase()}.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('cover-photos')
            .upload(fileName, selectedFile, {
                contentType: selectedFile.type
            });

        if (uploadError) {
            console.error("Error uploading image:", uploadError.message);
            alert("Failed to upload cover photo: " + uploadError.message);
            return;
        }

        const { data: urlData } = supabase.storage
            .from('cover-photos')
            .getPublicUrl(fileName);
        coverPhoto = urlData.publicUrl;
        bulkCoverPhoto.value = coverPhoto;
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const messages = [];
    const translationsData = [];

    try {
        lines.forEach((line, index) => {
            const match = line.match(/^(.*)\s*\((.*)\)\s*(received|sent)$/i);
            if (!match) {
                throw new Error(`Invalid format in line ${index + 1}: "${line}". Expected "foreign sentence (English translation) received or sent".`);
            }

            const [_, foreignText, englishTranslation, sender] = match;
            if (!foreignText || !englishTranslation || !sender) {
                throw new Error(`Missing data in line ${index + 1}: "${line}". All fields are required.`);
            }
            if (!['received', 'sent'].includes(sender.toLowerCase())) {
                throw new Error(`Invalid sender in line ${index + 1}: "${line}". Expected "received" or "sent".`);
            }

            messages.push({ text: foreignText.trim(), sender: sender.toLowerCase(), delay });
            translationsData.push({ language, message_text: foreignText.trim().toLowerCase(), translation: englishTranslation.trim() });
        });

        const { data: story, error: storyError } = await supabase
            .from('stories')
            .insert([{ language, title, is_new: isNew, popular_now: popularNow, premium, category, cover_photo: coverPhoto, created_at: new Date().toISOString() }])
            .select()
            .single();
        if (storyError) {
            throw new Error(`Failed to add story: ${storyError.message}`);
        }
        const storyId = story.id;

        const { error: messageError } = await supabase
            .from('messages')
            .insert(messages.map(msg => ({ story_id: storyId, text: msg.text, sender: msg.sender, delay: msg.delay })));
        if (messageError) {
            throw new Error(`Failed to add messages: ${messageError.message}`);
        }

        const { error: translationError } = await supabase
            .from('message_translations')
            .insert(translationsData);
        if (translationError) {
            throw new Error(`Failed to add translations: ${translationError.message}`);
        }

        if (language === currentLanguage) {
            translationsData.forEach(({ message_text, translation }) => {
                translations[message_text] = translation;
            });
        }

        alert(`Added story "${title}" with ${messages.length} messages and translations successfully!`);
        
        document.getElementById("bulk-story-text").value = "";
        document.getElementById("bulk-story-title").value = "";
        bulkCoverPhoto.value = "";
        selectedFile = null;
        coverPhotoPreview.style.display = "none";
        dropZone.querySelector("p").style.display = "block";

        hideAdmin();
        if (currentLanguage === language) {
            loadHomeScreen(true);
        }
    } catch (error) {
        console.error("Submission error:", error);
        alert(error.message);
    }
});

async function loadStoryList() {
    const language = document.getElementById("edit-story-language").value;
    console.log("Loading stories for language:", language);

    const individualStoriesDiv = document.getElementById("individual-stories");
    const seriesListDiv = document.getElementById("series-list");

    if (!individualStoriesDiv || !seriesListDiv) {
        console.error("DOM elements not found: individual-stories or series-list missing");
        alert("Error: Required DOM elements not found. Check HTML structure.");
        return;
    }

    const { data: stories, error } = await supabase
        .from('stories')
        .select('id, title, category')
        .eq('language', language)
        .order('title');

    if (error) {
        console.error("Error fetching stories:", error.message);
        alert("Failed to load stories: " + error.message);
        individualStoriesDiv.innerHTML = `<p>Error: ${error.message}</p>`;
        seriesListDiv.innerHTML = `<p>Error: ${error.message}</p>`;
        return;
    }

    console.log("Fetched stories:", stories);

    individualStoriesDiv.innerHTML = "";
    seriesListDiv.innerHTML = "";

    if (!stories || stories.length === 0) {
        individualStoriesDiv.innerHTML = "<p>No individual stories found for this language.</p>";
        seriesListDiv.innerHTML = "<p>No series found for this language.</p>";
        console.log("No stories found for language:", language);
        return;
    }

    const seriesGroups = {};
    const nonSeriesStories = [];

    stories.forEach(story => {
        console.log("Processing story:", story);
        if (story.category === "Series") {
            const match = story.title.match(/^(.*?)(?:\s*(Ep|Episode)\s*(\d+))?$/i);
            const seriesTitle = match ? match[1].trim() : story.title;
            if (!seriesGroups[seriesTitle]) seriesGroups[seriesTitle] = [];
            seriesGroups[seriesTitle].push(story);
        } else {
            nonSeriesStories.push(story);
        }
    });

    console.log("Non-series stories:", nonSeriesStories);
    console.log("Series groups:", seriesGroups);

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
        individualStoriesDiv.appendChild(item);
    });

    for (const [seriesTitle, episodes] of Object.entries(seriesGroups)) {
        const groupDiv = document.createElement("div");
        groupDiv.classList.add("series-group");
        const toggleBtn = document.createElement("button");
        toggleBtn.classList.add("series-toggle");
        toggleBtn.textContent = `${seriesTitle} (${episodes.length} Episodes)`;
        toggleBtn.addEventListener("click", () => {
            console.log("Series toggle clicked for:", seriesTitle);
            showSeriesEpisodes(seriesTitle, episodes);
        });
        groupDiv.appendChild(toggleBtn);
        seriesListDiv.appendChild(groupDiv);
    }

    console.log("Stories rendered - Individual:", nonSeriesStories.length, "Series:", Object.keys(seriesGroups).length);
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

function switchTab(tab) {
    document.getElementById("individual-tab").classList.remove("active");
    document.getElementById("series-tab").classList.remove("active");
    document.getElementById("individual-stories").classList.add("hidden");
    document.getElementById("series-stories").classList.add("hidden");

    document.getElementById(`${tab}-tab`).classList.add("active");
    document.getElementById(`${tab}-stories`).classList.remove("hidden");

    if (tab === "series") {
        document.getElementById("series-episodes").classList.add("hidden");
        document.getElementById("series-list").classList.remove("hidden");
    }
}

async function showSeriesEpisodes(seriesTitle, episodes) {
    console.log("Showing episodes for series:", seriesTitle, "Episodes:", episodes);
    const language = document.getElementById("edit-story-language").value;
    document.getElementById("series-list").classList.add("hidden");
    const seriesEpisodesDiv = document.getElementById("series-episodes");
    seriesEpisodesDiv.classList.remove("hidden");

    document.getElementById("series-title").textContent = seriesTitle;
    const episodeList = document.getElementById("episode-list");
    episodeList.innerHTML = "";

    episodes.forEach((episode, index) => {
        const episodeDiv = document.createElement("div");
        episodeDiv.classList.add("episode-item");
        episodeDiv.dataset.id = episode.id;
        episodeDiv.innerHTML = `
            <span class="hamburger">☰</span>
            <input type="text" value="${episode.title}" data-original="${episode.title}">
            <button onclick="editEpisode('${episode.id}')">Edit</button>
            <button class="delete-btn" onclick="deleteStory('${episode.id}')">Delete</button>
        `;
        episodeList.appendChild(episodeDiv);
    });

    new Sortable(episodeList, {
        animation: 150,
        handle: '.hamburger',
        onEnd: () => console.log("Episode order changed")
    });
}

function editEpisode(storyId) {
    editStory(storyId);
}

function addNewEpisode() {
    const seriesTitle = document.getElementById("series-title").textContent;
    const language = document.getElementById("edit-story-language").value;
    const episodeList = document.getElementById("episode-list").children;
    let maxEpisode = 0;

    for (let episodeDiv of episodeList) {
        const title = episodeDiv.querySelector("input").value;
        const match = title.match(/Ep(?:isode)?\s*(\d+)/i);
        if (match) maxEpisode = Math.max(maxEpisode, Number(match[1]));
    }
    const newEpisodeNum = maxEpisode + 1;

    let episodeForm = document.getElementById("add-episode-form");
    if (episodeForm) episodeForm.remove();

    episodeForm = document.createElement("form");
    episodeForm.id = "add-episode-form";
    episodeForm.classList.add("admin-form");
    episodeForm.innerHTML = `
        <h3>Add Episode to "${seriesTitle}"</h3>
        <div class="form-row">
            <label for="add-episode-language">Language:</label>
            <select id="add-episode-language" disabled>
                <option value="${language}">${language.charAt(0).toUpperCase() + language.slice(1)}</option>
            </select>
            <input type="hidden" name="add-episode-language" value="${language}">
        </div>
        <div class="form-row">
            <label for="add-episode-title">Title:</label>
            <input id="add-episode-title" type="text" value="${seriesTitle} Episode ${newEpisodeNum}" required>
        </div>
        <div class="form-row">
            <label for="add-episode-is-new">Is New:</label>
            <select id="add-episode-is-new">
                <option value="0">No</option>
                <option value="1">Yes</option>
            </select>
        </div>
        <div class="form-row">
            <label for="add-episode-popular-now">Popular Now:</label>
            <select id="add-episode-popular-now">
                <option value="0">No</option>
                <option value="1">Yes</option>
            </select>
        </div>
        <div class="form-row">
            <label for="add-episode-premium">Premium:</label>
            <select id="add-episode-premium">
                <option value="0">No</option>
                <option value="1">Yes</option>
            </select>
        </div>
        <div class="form-row">
            <label for="add-episode-category">Category:</label>
            <select id="add-episode-category" disabled>
                <option value="Series">Series</option>
            </select>
            <input type="hidden" name="add-episode-category" value="Series">
        </div>
        <div class="form-row">
            <label for="add-episode-number">Episode:</label>
            <input id="add-episode-number" type="number" min="1" value="${newEpisodeNum}" required>
        </div>
        <div class="form-row">
            <label for="add-episode-cover-photo">Cover Photo:</label>
            <div id="add-episode-drop-zone" class="drop-zone">
                <p>Drag & drop an image here or click to upload</p>
                <input type="file" id="add-episode-cover-photo-input" accept="image/*" style="display: none;">
                <img id="add-episode-cover-photo-preview" class="cover-preview" style="display: none; max-width: 100%; max-height: 200px;">
            </div>
            <input id="add-episode-cover-photo" type="hidden">
        </div>
        <div class="form-row form-button-row">
            <label></label>
            <button type="button" onclick="generateCoverPhotoForEpisode()">Generate Cover Photo</button>
        </div>
        <div class="form-row">
            <label for="add-episode-delay">Delay (ms):</label>
            <input id="add-episode-delay" type="number" value="2000" required>
        </div>
        <div class="form-row textarea-row">
            <label for="add-episode-text">Messages and Translations:</label>
            <textarea id="add-episode-text" rows="10" placeholder="Format each line as: foreign sentence (English translation) sender\ne.g.\nCiao (Hello) received\nCome stai? (How are you?) sent" required></textarea>
        </div>
        <div class="form-buttons">
            <button type="button" onclick="generateEpisodeStory()">Generate Story</button>
            <button type="submit">Save Episode</button>
            <button type="button" onclick="document.getElementById('add-episode-form').remove()">Cancel</button>
        </div>
    `;
    document.getElementById("series-episodes").appendChild(episodeForm);

    const dropZone = document.getElementById("add-episode-drop-zone");
    const coverPhotoInput = document.getElementById("add-episode-cover-photo-input");
    const coverPhotoPreview = document.getElementById("add-episode-cover-photo-preview");
    let selectedFile = null;

    dropZone.addEventListener("click", () => coverPhotoInput.click());
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            selectedFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                coverPhotoPreview.src = e.target.result;
                coverPhotoPreview.style.display = "block";
                dropZone.querySelector("p").style.display = "none";
            };
            reader.readAsDataURL(file);
        }
    });
    coverPhotoInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                coverPhotoPreview.src = e.target.result;
                coverPhotoPreview.style.display = "block";
                dropZone.querySelector("p").style.display = "none";
            };
            reader.readAsDataURL(file);
        }
    });

    episodeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const language = document.getElementById("add-episode-language").value;
        const title = document.getElementById("add-episode-title").value.trim();
        const isNew = document.getElementById("add-episode-is-new").value === "1";
        const popularNow = document.getElementById("add-episode-popular-now").value === "1";
        const premium = document.getElementById("add-episode-premium").value === "1";
        const category = document.getElementById("add-episode-category").value;
        const episode = Number(document.getElementById("add-episode-number").value);
        let coverPhoto = document.getElementById("add-episode-cover-photo").value || null;
        const delay = Number(document.getElementById("add-episode-delay").value);
        const text = document.getElementById("add-episode-text").value.trim();

        if (!text) {
            alert("Please enter or generate story text.");
            return;
        }

        if (selectedFile) {
            const fileName = `${Date.now()}-${title.replace(/\s+/g, '-').toLowerCase()}.png`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('cover-photos')
                .upload(fileName, selectedFile, { contentType: selectedFile.type });
            if (uploadError) {
                alert("Failed to upload cover photo: " + uploadError.message);
                return;
            }
            const { data: urlData } = supabase.storage.from('cover-photos').getPublicUrl(fileName);
            coverPhoto = urlData.publicUrl;
        }

        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const messages = [];
        const translationsData = [];

        try {
            lines.forEach((line, index) => {
                const match = line.match(/^(.*)\s*\((.*)\)\s*(received|sent)$/i);
                if (!match) throw new Error(`Invalid format in line ${index + 1}: "${line}"`);
                const [_, foreignText, englishTranslation, sender] = match;
                messages.push({ text: foreignText.trim(), sender: sender.toLowerCase(), delay });
                translationsData.push({ language, message_text: foreignText.trim().toLowerCase(), translation: englishTranslation.trim() });
            });

            const { data: story, error: storyError } = await supabase
                .from('stories')
                .insert([{ language, title, is_new: isNew, popular_now: popularNow, premium, category, cover_photo: coverPhoto, created_at: new Date().toISOString() }])
                .select()
                .single();
            if (storyError) throw new Error(`Failed to add episode: ${storyError.message}`);

            const storyId = story.id;
            const { error: messageError } = await supabase
                .from('messages')
                .insert(messages.map(msg => ({ story_id: storyId, ...msg })));
            if (messageError) throw new Error(`Failed to add messages: ${messageError.message}`);

            const { error: translationError } = await supabase
                .from('message_translations')
                .insert(translationsData);
            if (translationError) throw new Error(`Failed to add translations: ${translationError.message}`);

            alert(`Episode "${title}" added successfully!`);
            episodeForm.remove();
            showSeriesEpisodes(seriesTitle, [...episodes, { id: storyId, title, category: "Series" }]);
        } catch (error) {
            console.error("Error saving episode:", error);
            alert("Failed to save episode: " + error.message);
        }
    });
}

async function generateEpisodeStory() {
    const language = document.getElementById("add-episode-language").value;
    const title = document.getElementById("add-episode-title").value.trim();
    const episode = Number(document.getElementById("add-episode-number").value);

    try {
        const response = await fetch('/.netlify/functions/generate-story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language, category: "Series", title, episode })
        });

        if (!response.ok) throw new Error(`Server error: ${await response.text()}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        document.getElementById("add-episode-text").value = data.story;
        alert(`Episode ${episode} generated successfully!`);
    } catch (error) {
        console.error("Error generating episode:", error);
        alert("Failed to generate episode: " + error.message);
    }
}

async function generateCoverPhotoForEpisode() {
    const storyText = document.getElementById("add-episode-text").value.trim();
    const title = document.getElementById("add-episode-title").value.trim();
    const category = document.getElementById("add-episode-category").value || "Series";

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
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
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
            .upload(fileName, blob, { contentType: 'image/png' });

        if (uploadError) {
            console.error("Error uploading image to Supabase:", uploadError.message);
            throw new Error(`Failed to upload cover photo: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage.from('cover-photos').getPublicUrl(fileName);
        const coverPhotoUrl = urlData.publicUrl;
        document.getElementById("add-episode-cover-photo").value = coverPhotoUrl;
        alert("Cover photo generated and uploaded successfully!");
    } catch (error) {
        console.error("Error generating cover photo:", error);
        alert("Failed to generate cover photo: " + error.message);
    }
}

async function saveSeriesChanges() {
    const language = document.getElementById("edit-story-language").value;
    const episodeList = document.getElementById("episode-list").children;
    const seriesTitle = document.getElementById("series-title").textContent;

    for (let episodeDiv of episodeList) {
        const storyId = episodeDiv.dataset.id;
        const newTitle = episodeDiv.querySelector("input").value;
        const originalTitle = episodeDiv.querySelector("input").dataset.original;

        if (storyId.startsWith("new-")) {
            const { data: story, error: storyError } = await supabase
                .from('stories')
                .insert([{ language, title: newTitle, category: "Series" }])
                .select()
                .single();
            if (storyError) {
                console.error("Error adding new episode:", storyError.message);
                alert("Failed to add new episode: " + storyError.message);
                return;
            }
            episodeDiv.dataset.id = story.id;
        } else if (newTitle !== originalTitle) {
            const { error: storyError } = await supabase
                .from('stories')
                .update({ title: newTitle })
                .eq('id', storyId);
            if (storyError) {
                console.error("Error updating episode:", storyError.message);
                alert("Failed to update episode: " + storyError.message);
                return;
            }
            episodeDiv.querySelector("input").dataset.original = newTitle;
        }
    }
    alert("Series changes saved successfully!");
    backToSeriesList();
}

function backToSeriesList() {
    document.getElementById("series-episodes").classList.add("hidden");
    document.getElementById("series-list").classList.remove("hidden");
    loadStoryList();
}

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

async function loadFavoriteWords() {
    const key = `${currentLanguage}_favorites`;
    const favorites = JSON.parse(localStorage.getItem(key)) || [];
    favoriteWordsDiv.innerHTML = "";

    if (favorites.length === 0) {
        favoriteWordsDiv.innerHTML = "<p>No favorite words saved yet.</p>";
        return;
    }

    favorites.forEach(item => {
        const wordDiv = document.createElement("div");
        wordDiv.classList.add("favorite-word");
        wordDiv.innerHTML = `
            <span>${item.word} - ${item.translation}</span>
            <button onclick="toggleFavorite('${item.word}', '${item.translation}'); loadFavoriteWords();">Remove</button>
        `;
        favoriteWordsDiv.appendChild(wordDiv);
    });
}

async function cancelSubscription() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user.id;

    const { data: subData, error: subError } = await supabase
        .from('user_subscriptions')
        .select('stripe_sub_id')
        .eq('user_id', userId)
        .single();

    if (subError || !subData) {
        console.error("Error fetching subscription:", subError?.message);
        alert("Failed to load subscription data.");
        return;
    }

    const stripeSubId = subData.stripe_sub_id;

    try {
        const response = await fetch('/.netlify/functions/cancel-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: stripeSubId })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${errorText}`);
        }

        const result = await response.json();
        if (result.error) {
            throw new Error(result.error);
        }

        await supabase
            .from('user_subscriptions')
            .update({ status: 'canceled', updated_at: new Date().toISOString() })
            .eq('user_id', userId);

        alert("Subscription canceled successfully!");
        loadProfile();
    } catch (error) {
        console.error("Error canceling subscription:", error);
        alert("Failed to cancel subscription: " + error.message);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const addNewEpisodeBtn = document.getElementById("add-new-episode-btn");
    if (addNewEpisodeBtn) {
        addNewEpisodeBtn.addEventListener("click", addNewEpisode);
    }
});