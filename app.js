/* =========================================================
   SUPABASE CONFIGURATION
========================================================= */

const SUPABASE_URL = "https://naemmskdifkbkvgyelge.supabase.co";


const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_kP-qgTjHEWoXES4plH5oAA_fn2g0arq";


const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    }
);


/* =========================================================
   USER CONFIGURATION
========================================================= */

/*
   Duffer = your OLD Supabase account.

   Khushi = your NEW Supabase account.

   Replace ONLY the Khushi email below with the Gmail
   you used when creating Khushi's Supabase user.

   The names shown in the app are Duffer and Khushi.
*/

const USERS = {
    Duffer: {
        email: "diludilwala333@gmail.com",
        name: "Duffer"
    },

    Khushi: {
        email: "fakharjokhio76@gmail.com",
        name: "Khushi"
    }
};


/* =========================================================
   APP STATE
========================================================= */

let currentUser = null;

let selectedPhoto = null;

let messages = [];
let unreadCount = 0;
let chatOpenLastRead = null;
const MESSAGE_PAGE_SIZE = 200;
let hasMoreOlder = true;

let photos = [];

let realtimeChannel = null;
let realtimeSubscribed = false;
let typingTimeout = null;
let remoteTypingTimeout = null;


/* =========================================================
   ELEMENTS
========================================================= */

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");

const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const togglePasswordButton =
    document.getElementById("togglePasswordButton");

const logoutButton = document.getElementById("logoutButton");

const currentUserDisplay =
    document.getElementById("currentUserDisplay");

const homePage = document.getElementById("homePage");
const uploadPage = document.getElementById("uploadPage");
const photosPage = document.getElementById("photosPage");
const messagePage = document.getElementById("messagePage");

const uploadPhotoButton =
    document.getElementById("uploadPhotoButton");

const uploadedPhotosButton =
    document.getElementById("uploadedPhotosButton");

const messageButton =
    document.getElementById("messageButton");

const photoInput = document.getElementById("photoInput");
const photoPreview = document.getElementById("photoPreview");
const previewImage = document.getElementById("previewImage");
const uploadButton = document.getElementById("uploadButton");
const uploadMessage = document.getElementById("uploadMessage");

const photosGrid = document.getElementById("photosGrid");
const photosLoading = document.getElementById("photosLoading");

const chatMessages = document.getElementById("chatMessages");
const chatLoading = document.getElementById("chatLoading");

const messageInput = document.getElementById("messageInput");
const sendMessageButton =
    document.getElementById("sendMessageButton");


/* =========================================================
   PAGE NAVIGATION
========================================================= */

function showPage(page) {

    if (page !== "message") {
        stopTyping();
        unreadCount = 0;          // new
        updateUnreadBadge();      // new

        const typingStatus =
            document.getElementById("chatTypingStatus");

        if (typingStatus) {
            typingStatus.classList.add("hidden");
        }
    }
    homePage.classList.add("hidden");
    uploadPage.classList.add("hidden");
    photosPage.classList.add("hidden");
    messagePage.classList.add("hidden");

    if (page === "home") {
        homePage.classList.remove("hidden");
        return;
    }

    if (page === "upload") {
        uploadPage.classList.remove("hidden");
        return;
    }

    if (page === "photos") {

        photosPage.classList.remove("hidden");

        loadPhotos();

        return;
    }

    if (page === "message") {

        messagePage.classList.remove("hidden");
        chatOpenLastRead = getLastReadTime();   // remember BEFORE it gets overwritten
        loadMessages().then(markChatRead);

        setTimeout(() => {
            messageInput.focus();
        }, 150);

        return;
    }
}


/* =========================================================
   LOGIN
========================================================= */

async function login() {

    const selectedName = usernameInput.value;
    const password = passwordInput.value.trim();

    loginMessage.textContent = "";

    if (!selectedName) {
        loginMessage.textContent = "Please choose your name.";
        loginMessage.style.color = "#d44768";
        return;
    }

    if (!password) {
        loginMessage.textContent = "Please enter your password.";
        loginMessage.style.color = "#d44768";
        return;
    }

    const selectedUser = USERS[selectedName];

    if (!selectedUser) {
        loginMessage.textContent = "User configuration error.";
        loginMessage.style.color = "#d44768";
        return;
    }

    loginButton.disabled = true;

    loginButton.innerHTML = `
        <span>Opening our world...</span>
        <span>💗</span>
    `;

    let data = null;
    let error = null;

    try {
        const result =
            await supabaseClient.auth.signInWithPassword({
                email: selectedUser.email,
                password: password
            });

        data = result.data;
        error = result.error;

    } catch (networkError) {
        error = networkError;
    }

    if (error) {

        console.error("LOGIN ERROR:", error);

        const looksLikeNetworkProblem =
            !navigator.onLine ||
            !error.status ||
            String(error.message).toLowerCase().includes("fetch");

        loginMessage.textContent = looksLikeNetworkProblem
            ? "Could not connect. Please check your internet and try again."
            : "The name or password is incorrect.";

        loginMessage.style.color = "#d44768";

        loginButton.disabled = false;

        loginButton.innerHTML = `
            <span>Enter Our World</span>
            <span>💗</span>
        `;

        return;
    }

    if (data && data.session && data.user) {

        currentUser = {
            id: data.user.id,
            name: selectedUser.name,
            email: selectedUser.email
        };

        loginScreen.classList.add("hidden");
        appScreen.classList.remove("hidden");

        passwordInput.value = "";
        loginMessage.textContent = "";

        currentUserDisplay.textContent =
            `Logged in as ${currentUser.name} ❤️`;

        subscribeToRealtime();
        refreshUnreadCount();
        showPage("home");
    }

    loginButton.disabled = false;

    loginButton.innerHTML = `
        <span>Enter Our World</span>
        <span>💗</span>
    `;
}

/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

    logoutButton.disabled = true;

    if (realtimeChannel) {

        await supabaseClient
            .removeChannel(realtimeChannel);

        realtimeChannel = null;
    }


    await supabaseClient.auth.signOut();


    currentUser = null;

    messages = [];
    unreadCount = 0;
    updateUnreadBadge();
    photos = [];

    appScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");

    usernameInput.value = "";
    passwordInput.value = "";
    if (passwordVisible) togglePassword();

    loginMessage.textContent = "";

    logoutButton.disabled = false;

    showPage("home");
}


/* =========================================================
   PASSWORD VISIBILITY
========================================================= */

let passwordVisible = false;

function togglePassword() {

    passwordVisible = !passwordVisible;

    if (passwordVisible) {

        passwordInput.style.setProperty(
            "-webkit-text-security",
            "none"
        );

        togglePasswordButton.textContent = "🙈";

        togglePasswordButton.setAttribute(
            "aria-label",
            "Hide password"
        );

    } else {

        passwordInput.style.setProperty(
            "-webkit-text-security",
            "disc"
        );

        togglePasswordButton.textContent = "👁️";

        togglePasswordButton.setAttribute(
            "aria-label",
            "Show password"
        );
    }
}

/* =========================================================
   PHOTO SELECTION
========================================================= */

function handlePhotoSelection(event) {

    const file = event.target.files[0];

    uploadMessage.textContent = "";

    if (!file) {

        selectedPhoto = null;

        uploadButton.disabled = true;

        photoPreview.classList.add("hidden");

        return;
    }


    if (!file.type.startsWith("image/")) {

        selectedPhoto = null;

        uploadButton.disabled = true;

        photoPreview.classList.add("hidden");

        uploadMessage.textContent =
            "Please choose an image file.";

        uploadMessage.style.color =
            "#d44768";

        return;
    }


    /*
       Supabase Storage bucket is configured for 5 MB.
       We check it here too so the user gets a friendly
       message instead of a backend error.
    */

    const maxSize =
        5 * 1024 * 1024;

    if (file.size > maxSize) {

        selectedPhoto = null;

        uploadButton.disabled = true;

        photoPreview.classList.add("hidden");

        uploadMessage.textContent =
            "Photo must be smaller than 5 MB.";

        uploadMessage.style.color =
            "#d44768";

        return;
    }


    selectedPhoto = file;


    if (previewImage.src) {

        URL.revokeObjectURL(
            previewImage.src
        );
    }


    const imageURL =
        URL.createObjectURL(file);

    previewImage.src = imageURL;

    photoPreview.classList.remove("hidden");

    uploadButton.disabled = false;

    uploadMessage.textContent = "";
}


/* =========================================================
   UPLOAD PHOTO
========================================================= */

async function uploadPhoto() {

    if (!selectedPhoto) {
        return;
    }

    if (!currentUser) {

        uploadMessage.textContent =
            "Please log in again.";

        uploadMessage.style.color =
            "#d44768";

        return;
    }


    uploadButton.disabled = true;

    uploadButton.innerHTML = `
        <span>Saving memory...</span>
        <span>💗</span>
    `;

    uploadMessage.textContent = "";


    try {

        /*
           Create a unique folder for each authenticated
           user. The database still records the display name.
        */

        const extension =
            getFileExtension(
                selectedPhoto.name,
                selectedPhoto.type
            );

        const fileName =
            `${Date.now()}-${crypto.randomUUID()}.${extension}`;

        const filePath =
            `${currentUser.id}/${fileName}`;


        /* -----------------------------------------------
           Upload image to Supabase Storage
        ------------------------------------------------ */

        const {
            error: storageError
        } = await supabaseClient
            .storage
            .from("photos")
            .upload(
                filePath,
                selectedPhoto,
                {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: selectedPhoto.type
                }
            );


        if (storageError) {

            throw storageError;
        }


        /* -----------------------------------------------
           Save photo information in database
        ------------------------------------------------ */

        const {
            data,
            error: databaseError
        } = await supabaseClient
            .from("photos")
            .insert({
                file_path: filePath,
                sender_id: currentUser.id,
                sender_name: currentUser.name
            })
            .select()
            .single();


        /*
           If database insert fails after storage upload,
           remove the uploaded file so we don't leave an
           unwanted orphan file behind.
        */

        if (databaseError) {

            await supabaseClient
                .storage
                .from("photos")
                .remove([filePath]);

            throw databaseError;
        }


        console.log(
            "PHOTO SAVED:",
            data
        );


        uploadMessage.textContent =
            "Memory saved successfully ❤️";

        uploadMessage.style.color =
            "#2d9b68";


        photoInput.value = "";

        selectedPhoto = null;

        uploadButton.disabled = true;

        photoPreview.classList.add("hidden");


        setTimeout(() => {

            uploadMessage.textContent = "";

            showPage("home");

        }, 900);


    } catch (error) {

        console.error(
            "PHOTO UPLOAD ERROR:",
            error
        );

        uploadMessage.textContent =
            "Could not save the photo. Please try again.";

        uploadMessage.style.color =
            "#d44768";

        uploadButton.disabled = false;

    }


    uploadButton.innerHTML = `
        <span>Save This Memory</span>
        <span>❤️</span>
    `;
}


/* =========================================================
   GET FILE EXTENSION
========================================================= */

function getFileExtension(fileName, mimeType) {

    const originalExtension =
        fileName
            .split(".")
            .pop()
            .toLowerCase();


    const validExtensions = [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "heic",
        "heif"
    ];


    if (
        validExtensions.includes(
            originalExtension
        )
    ) {
        return originalExtension;
    }


    const mimeMap = {

        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/heic": "heic",
        "image/heif": "heif"

    };


    return mimeMap[mimeType] || "jpg";
}


/* =========================================================
   LOAD PHOTOS
========================================================= */

async function loadPhotos() {

    photosLoading.classList.remove("hidden");

    photosGrid.innerHTML = "";


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("photos")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            throw error;
        }


        photos = data || [];

        await addSignedUrlsToPhotos();

        renderPhotos();


    } catch (error) {

        console.error(
            "LOAD PHOTOS ERROR:",
            error
        );

        photosGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💔</div>
                <h3>Couldn't open our memories</h3>
                <p>Please try again.</p>
            </div>
        `;

    } finally {

        photosLoading.classList.add("hidden");
    }
}


/* =========================================================
   CREATE SIGNED PHOTO URLS
========================================================= */

async function addSignedUrlsToPhotos() {

    for (const photo of photos) {

        const {
            data,
            error
        } = await supabaseClient
            .storage
            .from("photos")
            .createSignedUrl(
                photo.file_path,
                60 * 60
            );


        if (error) {

            console.error(
                "SIGNED URL ERROR:",
                error
            );

            photo.url = "";

            continue;
        }


        photo.url = data.signedUrl;
    }
}


/* =========================================================
   DISPLAY PHOTOS
========================================================= */


function renderPhotos() {
    photosGrid.innerHTML = "";

    if (photos.length === 0) {
        photosGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📷</div>
                <h3>No memories yet</h3>
                <p>Upload your first little memory together ❤️</p>
            </div>
        `;
        return;
    }

    photos.forEach(photo => {
        const card = document.createElement("div");
        card.className = "photo-card";

        const mine =
            currentUser &&
            String(photo.sender_id) === String(currentUser.id);

        const safeName = escapeHTML(
            photo.sender_name || "Duffer & Khushi"
        );

        const date = formatDate(photo.created_at);

        card.innerHTML = `
            ${photo.url
                ? `
                        <img
                            class="gallery-photo"
                            src="${photo.url}"
                            alt="Memory uploaded by ${safeName}"
                            loading="lazy"
                            tabindex="0"
                            role="button"
                            aria-label="Open photo full screen"
                        >
                    `
                : `
                        <div class="empty-state">
                            <div class="empty-icon">💔</div>
                            <p>Photo unavailable</p>
                        </div>
                    `
            }

            <div class="photo-card-footer">
                <div class="photo-sender">
                    ❤️ ${safeName}
                </div>

                <div class="photo-date">
                    ${escapeHTML(date)}
                </div>

                ${mine ? `
                    <button
                        type="button"
                        class="delete-photo-button"                       
                    >
                        Delete memory
                    </button>
                ` : ""}
                <button
                    type="button"
                    class="download-photo-button"
                    onclick="downloadPhoto('${photo.url}', '${photo.file_path}')"
                >
                    📥 Download
                </button>
            </div>
        `;

        const photoImage = card.querySelector(".gallery-photo");

        if (photoImage) {
            const openViewer = () => {
                openPhotoViewer(photo.id);
            };

            photoImage.addEventListener("click", openViewer);

            photoImage.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openViewer();
                }
            });
        }

        const deleteButton = card.querySelector(
            ".delete-photo-button"
        );

        if (deleteButton) {
            deleteButton.addEventListener("click", () => {
                deletePhoto(photo.id);
            });
        }

        photosGrid.appendChild(card);
    });
}
async function downloadPhoto(url, filePath) {
    try {
        // Fetch the image as a blob to bypass cross-origin restrictions
        const response = await fetch(url);
        const blob = await response.blob();

        // Create a temporary local object URL for the blob
        const blobUrl = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = blobUrl;

        // Extract a clean file name from the path
        const fileName = filePath.split("/").pop() || "memory.jpg";
        a.download = fileName;

        document.body.appendChild(a);
        a.click();

        // Clean up
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error("DOWNLOAD ERROR:", error);
        // Fallback: open in new tab if blob download fails
        window.open(url, "_blank");
    }
}

function openPhotoViewer(photoId) {

    const existingViewer = document.querySelector(".photo-viewer-overlay");

    if (existingViewer) {
        if (existingViewer.closeViewer) {
            existingViewer.closeViewer();
        } else {
            existingViewer.remove();
        }
    }

    const viewerPhotos = photos.filter(item => item.url);
    let index = viewerPhotos.findIndex(item => item.id === photoId);

    if (index === -1) return;

    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let hintTimer = null;

    /* ---------- Build the viewer ---------- */

    const overlay = document.createElement("div");
    overlay.className = "photo-viewer-overlay";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "photo-viewer-close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close photo");

    const counter = document.createElement("div");
    counter.className = "photo-viewer-counter";

    const prevButton = document.createElement("button");
    prevButton.type = "button";
    prevButton.className = "photo-viewer-arrow prev";
    prevButton.textContent = "‹";
    prevButton.setAttribute("aria-label", "Previous photo");

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "photo-viewer-arrow next";
    nextButton.textContent = "›";
    nextButton.setAttribute("aria-label", "Next photo");

    const image = document.createElement("img");
    image.className = "photo-viewer-image";
    image.draggable = false;

    const caption = document.createElement("div");
    caption.className = "photo-viewer-caption";

    const hint = document.createElement("div");
    hint.className = "photo-viewer-hint";
    hint.textContent = "👈 Swipe left or right to change photo 👉";

    overlay.appendChild(closeButton);
    overlay.appendChild(counter);
    overlay.appendChild(prevButton);
    overlay.appendChild(nextButton);
    overlay.appendChild(image);
    overlay.appendChild(caption);

    if (viewerPhotos.length > 1) {
        overlay.appendChild(hint);
        hintTimer = setTimeout(() => {
            hint.classList.add("fade-out");
        }, 4000);
    }

    document.body.appendChild(overlay);

    /* ---------- Zoom and move ---------- */

    function applyTransform(animate) {
        if (scale > 1) {
            const maxX = (image.clientWidth * (scale - 1)) / 2;
            const maxY = (image.clientHeight * (scale - 1)) / 2;

            translateX = Math.max(-maxX, Math.min(maxX, translateX));
            translateY = Math.max(-maxY, Math.min(maxY, translateY));
        } else {
            translateX = 0;
            translateY = 0;
        }

        image.style.transition = animate ? "transform 0.2s ease" : "none";
        image.style.transform =
            `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    function resetZoom() {
        scale = 1;
        translateX = 0;
        translateY = 0;
        applyTransform(false);
    }

    /* ---------- Show a photo ---------- */

    function showPhoto(newIndex) {
        index = newIndex;

        const item = viewerPhotos[index];
        const name = item.sender_name || "Duffer & Khushi";

        image.src = item.url;
        image.alt = "Full photo shared by " + name;
        caption.textContent = "❤️ Shared by " + name;

        counter.textContent = `${index + 1} / ${viewerPhotos.length}`;
        counter.classList.toggle("hidden", viewerPhotos.length < 2);

        prevButton.classList.toggle("hidden", index === 0);
        nextButton.classList.toggle("hidden", index === viewerPhotos.length - 1);

        resetZoom();
    }

    function hideHint() {
        hint.classList.add("fade-out");
    }

    function goNext() {
        if (index >= viewerPhotos.length - 1) return false;
        showPhoto(index + 1);
        hideHint();
        return true;
    }

    function goPrev() {
        if (index <= 0) return false;
        showPhoto(index - 1);
        hideHint();
        return true;
    }

    showPhoto(index);

    /* ---------- Touch: swipe, pinch, double-tap ---------- */

    let mode = "";
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let pinchStartDistance = 0;
    let pinchStartScale = 1;
    let lastTap = 0;

    function fingerDistance(touches) {
        return Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
    }

    function handleTap() {
        const now = Date.now();

        if (now - lastTap < 300) {
            lastTap = 0;
            translateX = 0;
            translateY = 0;
            scale = scale > 1 ? 1 : 2.5;
            applyTransform(true);
        } else {
            lastTap = now;
        }
    }

    overlay.addEventListener("touchstart", event => {
        if (event.target.closest("button")) return;

        if (event.touches.length === 2) {
            mode = "pinch";
            pinchStartDistance = fingerDistance(event.touches);
            pinchStartScale = scale;

        } else if (event.touches.length === 1) {
            const touch = event.touches[0];

            startX = touch.clientX;
            startY = touch.clientY;
            originX = translateX;
            originY = translateY;

            mode = scale > 1 ? "pan" : "swipe";
        }
    }, { passive: true });

    overlay.addEventListener("touchmove", event => {
        if (mode === "pinch" && event.touches.length === 2) {
            scale = Math.min(
                4,
                Math.max(1, pinchStartScale *
                    fingerDistance(event.touches) / pinchStartDistance)
            );
            applyTransform(false);

        } else if (mode === "pan" && event.touches.length === 1) {
            const touch = event.touches[0];

            translateX = originX + (touch.clientX - startX);
            translateY = originY + (touch.clientY - startY);
            applyTransform(false);

        } else if (mode === "swipe" && event.touches.length === 1) {
            // the photo follows your finger a little
            const dx = event.touches[0].clientX - startX;

            image.style.transition = "none";
            image.style.transform = `translateX(${dx}px)`;
        }
    }, { passive: true });

    overlay.addEventListener("touchend", event => {
        if (!mode) return;

        if (mode === "pinch") {
            if (event.touches.length < 2) {
                if (scale < 1.05) {
                    scale = 1;
                }
                applyTransform(true);
                mode = "";
            }
            return;
        }

        if (event.touches.length > 0) return;

        const touch = event.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const isTap = Math.abs(dx) < 10 && Math.abs(dy) < 10;

        if (isTap) {
            handleTap();
            applyTransform(true);

        } else if (
            mode === "swipe" &&
            Math.abs(dx) > 60 &&
            Math.abs(dx) > Math.abs(dy)
        ) {
            const changed = dx < 0 ? goNext() : goPrev();

            // first or last photo: slide back to the middle
            if (!changed) applyTransform(true);

        } else {
            applyTransform(true);
        }

        mode = "";
    }, { passive: true });

    /* ---------- Buttons and keyboard ---------- */

    function closeViewer() {
        clearTimeout(hintTimer);
        document.removeEventListener("keydown", handleKeydown);
        overlay.remove();
    }

    function handleKeydown(event) {
        if (event.key === "Escape") closeViewer();
        if (event.key === "ArrowRight") goNext();
        if (event.key === "ArrowLeft") goPrev();
    }

    overlay.closeViewer = closeViewer;

    closeButton.addEventListener("click", closeViewer);
    nextButton.addEventListener("click", goNext);
    prevButton.addEventListener("click", goPrev);

    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            closeViewer();
        }
    });

    document.addEventListener("keydown", handleKeydown);
}


/* =========================================================
   DELETE PHOTO
========================================================= */

async function deletePhoto(photoId) {

    const photo =
        photos.find(
            item => item.id === photoId
        );


    if (!photo) {
        return;
    }

    if (String(photo.sender_id) !== String(currentUser.id)) {
        showToast("You can only delete your own memories.");
        return;
    }


    const confirmed =
        await confirmDialog(
            "Delete this memory?"
        );


    if (!confirmed) {
        return;
    }


    try {

        /*
           Delete actual file from Storage.
        */

        const {
            error: storageError
        } = await supabaseClient
            .storage
            .from("photos")
            .remove([
                photo.file_path
            ]);


        if (storageError) {

            throw storageError;
        }


        /*
           Delete database record.
        */

        const {
            error: databaseError
        } = await supabaseClient
            .from("photos")
            .delete()
            .eq(
                "id",
                photoId
            )
            .eq(
                "sender_id",
                currentUser.id
            );


        if (databaseError) {

            throw databaseError;
        }


        photos =
            photos.filter(
                item => item.id !== photoId
            );


        renderPhotos();


    } catch (error) {

        console.error(
            "DELETE PHOTO ERROR:",
            error
        );

        showToast(
            "Could not delete the memory. Please try again."
        );
    }
}


/* =========================================================
   LOAD MESSAGES
========================================================= */

async function loadMessages() {
    chatLoading.classList.remove("hidden");
    chatMessages.innerHTML = "";

    try {
        const { data, error } = await supabaseClient
            .from("messages")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(MESSAGE_PAGE_SIZE);

        if (error) throw error;

        messages = (data || []).reverse();
        hasMoreOlder = (data || []).length === MESSAGE_PAGE_SIZE;
        renderMessages();

    } catch (error) {
        console.error("LOAD MESSAGES ERROR:", error);

        chatMessages.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💔</div>
                <h3>Couldn't open our messages</h3>
                <p>Please try again.</p>
            </div>
        `;

    } finally {
        chatLoading.classList.add("hidden");
    }
}



async function loadOlderMessages() {
    if (messages.length === 0) return;

    const oldest = messages[0].created_at;

    const { data, error } = await supabaseClient
        .from("messages")
        .select("*")
        .lt("created_at", oldest)
        .order("created_at", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);

    if (error) {
        showToast("Could not load older messages.");
        return;
    }

    if (!data || data.length === 0) {
        hasMoreOlder = false;
        const btn = chatMessages.querySelector(".load-older-button");
        if (btn) btn.remove();
        return;
    }

    hasMoreOlder = data.length === MESSAGE_PAGE_SIZE;

    const oldHeight = chatMessages.scrollHeight;

    messages = data.reverse().concat(messages);
    renderMessages();

    // stay at the same place instead of jumping to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight - oldHeight;
}

function getDayKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getDayLabel(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (getDayKey(date) === getDayKey(today)) return "Today";
    if (getDayKey(date) === getDayKey(yesterday)) return "Yesterday";

    return date.toLocaleDateString([], {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function createDateDivider(timestamp) {
    const divider = document.createElement("div");
    divider.className = "date-divider";

    const label = document.createElement("span");
    label.textContent = getDayLabel(timestamp);

    divider.appendChild(label);
    return divider;
}
/* =========================================================
   RENDER MESSAGES
========================================================= */


function renderMessages() {
    chatMessages.innerHTML = "";

    if (messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💌</div>
                <h3>No messages yet</h3>
                <p>Start your story with a little hello ❤️</p>
            </div>
        `;

        chatOpenLastRead = null;
        return;
    }

    if (hasMoreOlder) {
        const olderButton = document.createElement("button");
        olderButton.type = "button";
        olderButton.className = "load-older-button";
        olderButton.textContent = "⬆ Load older messages";
        olderButton.addEventListener("click", loadOlderMessages);
        chatMessages.appendChild(olderButton);
    }

    // Find the unread messages (only from your partner)
    let unreadMessages = [];

    if (chatOpenLastRead && currentUser) {
        const lastReadTime = new Date(chatOpenLastRead).getTime();

        unreadMessages = messages.filter(message =>
            String(message.sender_id) !== String(currentUser.id) &&
            new Date(message.created_at).getTime() > lastReadTime
        );
    }

    const firstUnread = unreadMessages[0] || null;
    let divider = null;
    let previousDay = null;
    messages.forEach(message => {

        // Date heading when the day changes
        const dayKey = getDayKey(message.created_at);

        if (dayKey !== previousDay) {
            chatMessages.appendChild(createDateDivider(message.created_at));
            previousDay = dayKey;
        }
        // Put the label right before the first unread message
        if (firstUnread && message === firstUnread) {
            divider = document.createElement("div");
            divider.className = "unread-divider";
            divider.textContent = unreadMessages.length === 1
                ? "1 unread message"
                : `${unreadMessages.length} unread messages`;

            chatMessages.appendChild(divider);
        }

        chatMessages.appendChild(
            createMessageElement(message)
        );
    });

    if (divider) {
        // Scroll so the label is at the top (or as high as possible)
        const distance =
            divider.getBoundingClientRect().top -
            chatMessages.getBoundingClientRect().top;

        chatMessages.scrollTop += distance - 8;

    } else {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Use this only once, when the chat is opened
    chatOpenLastRead = null;
}
function createMessageElement(message) {
    const mine =
        currentUser &&
        String(message.sender_id) === String(currentUser.id);

    const wrapper = document.createElement("div");

    wrapper.className =
        `chat-bubble-wrapper ${mine ? "mine" : "theirs"}`;

    wrapper.dataset.messageId = String(message.id);

    const senderName =
        message.sender_name || "Duffer & Khushi";

    const time = formatTime(message.created_at);

    wrapper.innerHTML = `
        <span class="sender-name">
            ${escapeHTML(senderName)}
        </span>

        <div class="chat-bubble ${mine ? "mine" : "theirs"}">
            ${escapeHTML(message.message)}

            <span class="chat-time">
                ${escapeHTML(time)}
            </span>
        </div>

        ${mine ? `
            <button
                type="button"
                class="delete-message-button"
            >
                🗑️ Delete
            </button>
        ` : ""}
    `;

    const deleteButton = wrapper.querySelector(
        ".delete-message-button"
    );

    if (deleteButton) {
        deleteButton.addEventListener("click", () => {
            deleteMessage(message.id);
        });
    }

    return wrapper;
}


function addMessageToChat(message, forceScroll = false) {
    if (!message || message.id == null) {
        return;
    }

    // Prevent duplicate messages when Realtime and sendMessage
    // receive the same message.
    const alreadyExists = messages.some(
        item => String(item.id) === String(message.id)
    );

    if (alreadyExists) {
        if (forceScroll) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        return;
    }

    const distanceFromBottom =
        chatMessages.scrollHeight -
        chatMessages.scrollTop -
        chatMessages.clientHeight;

    const wasNearBottom = distanceFromBottom < 100;
    const previousMessage = messages[messages.length - 1];
    messages.push(message);
    // Remove the empty-state message when the first message arrives.
    const emptyState = chatMessages.querySelector(".empty-state");

    if (emptyState) {
        chatMessages.innerHTML = "";
    }
    if (
        !previousMessage ||
        getDayKey(previousMessage.created_at) !== getDayKey(message.created_at)
    ) {
        chatMessages.appendChild(createDateDivider(message.created_at));
    }
    const messageElement = createMessageElement(message);

    // Insert in chronological order without rebuilding existing bubbles.
    const messageIndex = messages.findIndex(
        item => String(item.id) === String(message.id)
    );

    let nextElement = null;

    for (let i = messageIndex + 1; i < messages.length; i++) {
        const nextId = String(messages[i].id);

        nextElement = Array.from(
            chatMessages.querySelectorAll(".chat-bubble-wrapper")
        ).find(element =>
            element.dataset.messageId === nextId
        );

        if (nextElement) break;
    }

    if (nextElement) {
        chatMessages.insertBefore(messageElement, nextElement);
    } else {
        chatMessages.appendChild(messageElement);
    }

    // Don't interrupt someone who is reading older messages.
    if (forceScroll || wasNearBottom) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}
function removeEmptyDateDividers() {
    chatMessages.querySelectorAll(".date-divider").forEach(divider => {
        let next = divider.nextElementSibling;

        if (next && next.classList.contains("unread-divider")) {
            next = next.nextElementSibling;
        }

        if (!next || !next.classList.contains("chat-bubble-wrapper")) {
            divider.remove();
        }
    });
}

function removeMessageFromChat(messageId) {
    messages = messages.filter(
        message => String(message.id) !== String(messageId)
    );

    const elements = chatMessages.querySelectorAll(
        ".chat-bubble-wrapper"
    );

    elements.forEach(element => {
        if (element.dataset.messageId === String(messageId)) {
            element.remove();
        }
    });
    removeEmptyDateDividers();
    // Show the empty state only if no messages remain.
    if (messages.length === 0) {
        renderMessages();
    }
}



/* =========================================================
   SEND MESSAGE
========================================================= */


async function sendMessage() {
    const text = messageInput.value.trim();

    if (!text) return;

    stopTyping();

    if (!currentUser) {
        showToast("Please log in again.");
        return;
    }

    sendMessageButton.disabled = true;

    try {
        const { data, error } = await supabaseClient
            .from("messages")
            .insert({
                message: text,
                sender_id: currentUser.id,
                sender_name: currentUser.name
            })
            .select()
            .single();

        if (error) throw error;

        // Add the sent message if Realtime hasn't added it already.
        addMessageToChat(data, true);
        markChatRead();

        messageInput.value = "";

    } catch (error) {
        console.error("SEND MESSAGE ERROR:", error);

        showToast("Message could not be sent. Please try again.");

    } finally {
        sendMessageButton.disabled = false;
    }
}

/* =========================================================
   DELETE MESSAGE
========================================================= */

async function deleteMessage(messageId) {
    if (!currentUser) {
        showToast("Please log in again.");
        return;
    }

    const message = messages.find(
        item => String(item.id) === String(messageId)
    );

    if (!message || String(message.sender_id) !== String(currentUser.id)) {
        showToast("You can only delete your own messages.");
        return;
    }

    const confirmed = await confirmDialog(
        "Delete this message for both of you?"
    );

    if (!confirmed) return;

    try {
        const { error } = await supabaseClient
            .from("messages")
            .delete()
            .eq("id", messageId)
            .eq("sender_id", currentUser.id);

        if (error) throw error;

        // Remove only this message from the current screen.
        // Realtime will remove it from the other user's screen.
        removeMessageFromChat(messageId);

    } catch (error) {
        console.error("DELETE MESSAGE ERROR:", error);

        showToast(
            "Could not delete the message. Please try again."
        );
    }
}
function updateUnreadBadge() {
    const badge = document.getElementById("unreadBadge");

    if (badge) {
        badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
        badge.classList.toggle("hidden", unreadCount === 0);
    }

    // also shows the number in the browser tab title
    document.title = unreadCount > 0
        ? `(${unreadCount}) Duffer ❤️ Khushi`
        : "Duffer ❤️ Khushi";
}

function getLastReadKey() {
    return `lastRead_${currentUser.id}`;
}

// Saves "I have read up to the newest message I can see"
function markChatRead() {
    if (!currentUser || messages.length === 0) return;

    const newest = messages[messages.length - 1].created_at;

    try {
        localStorage.setItem(getLastReadKey(), newest);
    } catch (error) {
        console.error("Could not save last read time:", error);
    }
}
function getLastReadTime() {
    if (!currentUser) return null;

    try {
        return localStorage.getItem(getLastReadKey());
    } catch (error) {
        return null;
    }
}

// Counts messages from your partner that you have not read yet
async function refreshUnreadCount() {
    if (!currentUser) return;

    let lastRead = null;

    try {
        lastRead = localStorage.getItem(getLastReadKey());
    } catch (error) { }

    // First time on this phone: start counting from now
    if (!lastRead) {
        lastRead = new Date().toISOString();

        try {
            localStorage.setItem(getLastReadKey(), lastRead);
        } catch (error) { }
    }

    const { count, error } = await supabaseClient
        .from("messages")
        .select("id", { count: "exact", head: true })
        .gt("created_at", lastRead)
        .neq("sender_id", currentUser.id);

    if (error) {
        console.error("UNREAD COUNT ERROR:", error);
        return;
    }

    unreadCount = count || 0;
    updateUnreadBadge();
}
/* =========================================================
   REALTIME
========================================================= */

function subscribeToRealtime() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeSubscribed = false;

    ensureChatIndicators();

    realtimeChannel = supabaseClient
        .channel("private-love-app", {
            config: {
                presence: {
                    key: String(currentUser.id)
                }
            }
        })

        // New messages: add individually, without reloading history.
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "messages"
            },
            payload => {
                if (!messagePage.classList.contains("hidden")) {
                    addMessageToChat(payload.new);
                    markChatRead();

                } else if (
                    currentUser &&
                    payload.new &&
                    String(payload.new.sender_id) !== String(currentUser.id)
                ) {
                    unreadCount++;
                    updateUnreadBadge();
                }
            }
        )

        // Deleted messages: remove individually.
        .on(
            "postgres_changes",
            {
                event: "DELETE",
                schema: "public",
                table: "messages"
            },
            payload => {
                if (
                    !messagePage.classList.contains("hidden") &&
                    payload.old &&
                    payload.old.id != null
                ) {
                    removeMessageFromChat(payload.old.id);
                }
            }
        )

        // Existing photo updates.
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "photos"
            },
            async () => {
                if (!photosPage.classList.contains("hidden")) {
                    await loadPhotos();
                }
            }
        )

        // Online status updates.
        .on(
            "presence",
            { event: "sync" },
            () => {
                updateOnlineStatus();
            }
        )

        // Typing events.
        .on(
            "broadcast",
            { event: "typing" },
            event => {
                showRemoteTyping(event.payload);
            }
        )

        .subscribe(async status => {
            console.log("Realtime status:", status);

            if (status === "SUBSCRIBED") {
                realtimeSubscribed = true;

                try {
                    await realtimeChannel.track({
                        user_id: currentUser.id,
                        user_name: currentUser.name,
                        online_at: new Date().toISOString()
                    });

                    updateOnlineStatus();

                } catch (error) {
                    console.error(
                        "PRESENCE TRACKING ERROR:",
                        error
                    );
                }
            } else {
                realtimeSubscribed = false;
            }
        });
}

function ensureChatIndicators() {
    if (document.getElementById("chatLiveIndicators")) {
        return;
    }

    const indicators = document.createElement("div");
    indicators.id = "chatLiveIndicators";

    indicators.innerHTML = `
        <div id="chatOnlineStatus" class="chat-online-status">
            Checking online status...
        </div>
        <div id="chatTypingStatus" class="chat-typing-status hidden">
        </div>
    `;

    if (chatMessages && chatMessages.parentElement) {
        chatMessages.parentElement.insertBefore(
            indicators,
            chatMessages
        );
    }
}

function updateOnlineStatus() {
    const status = document.getElementById("chatOnlineStatus");

    if (!status || !currentUser || !realtimeChannel) {
        return;
    }

    const presence = realtimeChannel.presenceState();

    const people = Object.values(presence).flat();

    const otherUser = people.find(person =>
        String(person.user_id) !== String(currentUser.id)
    );

    const otherName = otherUser?.user_name ||
        (currentUser.name === "Duffer" ? "Khushi" : "Duffer");
    const contactName = document.getElementById("chatContactName");
    if (contactName) contactName.textContent = otherName;

    status.textContent = otherUser
        ? `🟢 ${otherName} is online`
        : `⚪ ${otherName} is offline`;

    status.classList.toggle("is-online", Boolean(otherUser));
}


function broadcastTyping(isTyping) {
    if (!realtimeChannel || !realtimeSubscribed || !currentUser) {
        return;
    }

    realtimeChannel.send({
        type: "broadcast",
        event: "typing",
        payload: {
            user_id: currentUser.id,
            user_name: currentUser.name,
            is_typing: isTyping
        }
    });
}


function stopTyping() {
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }

    broadcastTyping(false);
}


function showRemoteTyping(payload) {
    if (!currentUser || !payload) {
        return;
    }

    if (String(payload.user_id) === String(currentUser.id)) {
        return;
    }

    const typingStatus = document.getElementById("chatTypingStatus");

    if (!typingStatus) {
        return;
    }

    if (remoteTypingTimeout) {
        clearTimeout(remoteTypingTimeout);
        remoteTypingTimeout = null;
    }

    if (payload.is_typing) {
        typingStatus.textContent =
            `${payload.user_name || "Your person"} is typing… 💗`;

        typingStatus.classList.remove("hidden");

        remoteTypingTimeout = setTimeout(() => {
            typingStatus.classList.add("hidden");
        }, 2500);

    } else {
        typingStatus.classList.add("hidden");
    }
}


/* =========================================================
   DATE / TIME
========================================================= */

function formatTime(timestamp) {

    if (!timestamp) {
        return "";
    }


    return new Date(
        timestamp
    ).toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function formatDate(timestamp) {
    if (!timestamp) {
        return "";
    }

    return new Date(
        timestamp
    ).toLocaleDateString(
        [],
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

function showToast(message, type = "error") {
    let container = document.getElementById("toastContainer");

    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("toast-hide");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


function confirmDialog(message, confirmText = "Delete") {
    return new Promise(resolve => {

        const overlay = document.createElement("div");
        overlay.className = "confirm-overlay";

        const box = document.createElement("div");
        box.className = "confirm-box";

        const text = document.createElement("p");
        text.textContent = message;

        const buttons = document.createElement("div");
        buttons.className = "confirm-buttons";

        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "confirm-cancel";
        cancelButton.textContent = "Cancel";

        const okButton = document.createElement("button");
        okButton.type = "button";
        okButton.className = "confirm-ok";
        okButton.textContent = confirmText;

        function close(result) {
            document.removeEventListener("keydown", onKey);
            overlay.remove();
            resolve(result);
        }

        function onKey(event) {
            if (event.key === "Escape") close(false);
        }

        cancelButton.addEventListener("click", () => close(false));
        okButton.addEventListener("click", () => close(true));

        overlay.addEventListener("click", event => {
            if (event.target === overlay) close(false);
        });

        document.addEventListener("keydown", onKey);

        buttons.appendChild(cancelButton);
        buttons.appendChild(okButton);
        box.appendChild(text);
        box.appendChild(buttons);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        cancelButton.focus();
    });
}


/* =========================================================
   HTML ESCAPING
========================================================= */

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent =
        String(text ?? "");

    return div.innerHTML;
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

loginButton.addEventListener(
    "click",
    login
);


passwordInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            login();
        }

    }
);


usernameInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            passwordInput.focus();
        }

    }
);


togglePasswordButton.addEventListener(
    "click",
    togglePassword
);


logoutButton.addEventListener(
    "click",
    logout
);


uploadPhotoButton.addEventListener(
    "click",
    () => {
        showPage("upload");
    }
);


uploadedPhotosButton.addEventListener(
    "click",
    () => {
        showPage("photos");
    }
);


messageButton.addEventListener(
    "click",
    () => {
        showPage("message");
    }
);


document
    .querySelectorAll(".back-button")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                showPage(
                    button.dataset.page
                );

            }
        );

    });


photoInput.addEventListener(
    "change",
    handlePhotoSelection
);


uploadButton.addEventListener(
    "click",
    uploadPhoto
);



sendMessageButton.addEventListener("pointerdown", event => {
    event.preventDefault();
});

sendMessageButton.addEventListener("click", sendMessage);


messageInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();
        }

    }
);


messageInput.addEventListener("input", () => {
    if (messagePage.classList.contains("hidden")) {
        return;
    }

    if (messageInput.value.trim()) {
        broadcastTyping(true);

        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }

        typingTimeout = setTimeout(() => {
            broadcastTyping(false);
            typingTimeout = null;
        }, 1800);

    } else {
        stopTyping();
    }
});


/* =========================================================
   INITIALIZATION
========================================================= */

loginScreen.classList.remove("hidden");
appScreen.classList.add("hidden");

// Re-fetch messages when the device reconnects to the internet
window.addEventListener("online", () => {
    console.log("Connection restored. Fetching latest messages...");
    loadMessages();
});

// Re-fetch messages when the user returns to the app tab or wakes up their phone
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        console.log("App active again. Checking for missed messages...");
        loadMessages();
    }
});


/* Adjust the chat page when the Android keyboard changes
   the visible viewport. */
(function keepChatVisibleWithKeyboard() {
    const chatPage = document.getElementById("messagePage");
    const viewport = window.visualViewport;

    if (!chatPage || !viewport) return;

    function updateChatViewport() {
        chatPage.style.setProperty(
            "--chat-viewport-height",
            `${viewport.height}px`
        );

        chatPage.style.setProperty(
            "--chat-viewport-top",
            `${viewport.offsetTop}px`
        );
    }

    viewport.addEventListener("resize", updateChatViewport);
    viewport.addEventListener("scroll", updateChatViewport);
    window.addEventListener("resize", updateChatViewport);

    updateChatViewport();
})();