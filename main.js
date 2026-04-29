// ==================== FIREBASE CONFIG (Zëvendëso me të dhënat e tua) ====================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Import Firebase (përshkak se skedari është modul)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ==================== TMDB CONFIG ====================
const API_KEY = '7a98db423d6e3a5ee922a3e51a09d135';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const BACKDROP = 'https://image.tmdb.org/t/p/original';

// ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let userData = null;
let activePreviewBox = null;

// ==================== FUNKSIONET NDIHMËSE ====================
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// RENDER KARTELA me ikona për favorite/watchlater
function createMovieCard(movie, rowId) {
  const cardDiv = document.createElement("div");
  cardDiv.className = "card";
  cardDiv.setAttribute("data-id", movie.id);
  cardDiv.setAttribute("data-title", movie.title);
  cardDiv.setAttribute("data-poster", movie.poster_path);
  cardDiv.innerHTML = `
    <div class="card-icons">
      <i class="far fa-heart" data-action="favorite" data-id="${movie.id}" data-title="${movie.title}" data-poster="${movie.poster_path}"></i>
      <i class="far fa-clock" data-action="watchlater" data-id="${movie.id}" data-title="${movie.title}" data-poster="${movie.poster_path}"></i>
    </div>
    <img src="${IMG + movie.poster_path}" alt="${movie.title}">
  `;
  cardDiv.addEventListener("mouseenter", () => showRichPreview(movie, cardDiv));
  cardDiv.addEventListener("mouseleave", () => removePreview());
  cardDiv.addEventListener("click", (e) => {
    if (e.target.tagName === 'I') return;
    window.location.href = `watch.html?id=${movie.id}`;
  });
  
  // Eventet për ikona
  cardDiv.querySelectorAll("[data-action]").forEach(icon => {
    icon.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!currentUser) { showToast("Hyni së pari!"); return; }
      const action = icon.dataset.action;
      const movieObj = { id: parseInt(icon.dataset.id), title: icon.dataset.title, poster: icon.dataset.poster };
      if (action === "favorite") await toggleFavorite(movieObj);
      if (action === "watchlater") await toggleWatchlist(movieObj);
    });
  });
  
  document.getElementById(rowId).appendChild(cardDiv);
}

// HOVER i pasur me trailer dhe detaje
async function showRichPreview(movie, cardElement) {
  removePreview();
  // Marrim trailer dhe aktorët
  const [videoRes, creditsRes] = await Promise.all([
    fetch(`${BASE_URL}/movie/${movie.id}/videos?api_key=${API_KEY}`).then(r=>r.json()),
    fetch(`${BASE_URL}/movie/${movie.id}/credits?api_key=${API_KEY}`).then(r=>r.json())
  ]);
  const trailer = videoRes.results.find(v => v.type === "Trailer" && v.site === "YouTube");
  const cast = creditsRes.cast.slice(0, 3).map(c => c.name).join(", ");
  
  const preview = document.createElement("div");
  preview.className = "preview-rich";
  preview.innerHTML = `
    <div class="preview-trailer">
      ${trailer ? `<iframe src="https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1" frameborder="0" allow="autoplay; encrypted-media"></iframe>` : '<div style="height:180px; background:#111; display:flex; align-items:center; justify-content:center;">No trailer</div>'}
    </div>
    <div class="preview-info">
      <h4>${movie.title} (${movie.release_date?.split('-')[0] || 'N/A'})</h4>
      <div class="preview-meta">
        <span>⭐ ${movie.vote_average?.toFixed(1)}/10</span>
        <span>🎬 ${movie.runtime || '?'} min</span>
      </div>
      <div class="preview-overview">${movie.overview?.substring(0, 120)}...</div>
      <div class="preview-cast"><strong>Aktorë:</strong> ${cast || 'N/A'}</div>
    </div>
  `;
  document.body.appendChild(preview);
  activePreviewBox = preview;
  const rect = cardElement.getBoundingClientRect();
  preview.style.top = rect.top + "px";
  preview.style.left = rect.left + "px";
}
function removePreview() {
  if (activePreviewBox) activePreviewBox.remove();
  activePreviewBox = null;
}

// ==================== FIREBASE OPERACIONET ====================
async function toggleFavorite(movie) {
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  let favs = snap.data()?.favorites || [];
  const exists = favs.some(f => f.id === movie.id);
  if (exists) {
    await updateDoc(userRef, { favorites: arrayRemove(movie) });
    showToast(`❌ "${movie.title}" u hoq nga favoritet`);
  } else {
    await updateDoc(userRef, { favorites: arrayUnion(movie) });
    showToast(`❤️ "${movie.title}" u shtua në favorit`);
  }
}
async function toggleWatchlist(movie) {
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  let wl = snap.data()?.watchlist || [];
  const exists = wl.some(w => w.id === movie.id);
  if (exists) {
    await updateDoc(userRef, { watchlist: arrayRemove(movie) });
    showToast(`⏰ "${movie.title}" u hoq nga Watch Later`);
  } else {
    await updateDoc(userRef, { watchlist: arrayUnion(movie) });
    showToast(`📌 "${movie.title}" u ruajt për më vonë`);
  }
}
async function addPoints(points) {
  if (!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  const current = snap.data()?.points || 0;
  await setDoc(userRef, { points: current + points }, { merge: true });
  showToast(`+${points} pikë! Gjithsej: ${current + points}`);
}
async function redeemAdFree() {
  if (!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  const points = snap.data()?.points || 0;
  if (points >= 2000) {
    const adFreeUntil = new Date();
    adFreeUntil.setDate(adFreeUntil.getDate() + 30);
    await updateDoc(userRef, { points: points - 2000, adFreeUntil: adFreeUntil.toISOString() });
    showToast("🏆 Reklamat janë hequr për 30 ditë!");
    location.reload();
  } else {
    showToast("Nuk ke mjaft pikë. Duhen 2000 pikë.");
  }
}

// ==================== NGARKIMI I FILMAVE NË RRESHTA ====================
async function loadRow(endpoint, rowId, limit = 12) {
  const res = await fetch(`${BASE_URL}${endpoint}?api_key=${API_KEY}&language=en-US`);
  const data = await res.json();
  const movies = data.results.slice(0, limit);
  document.getElementById(rowId).innerHTML = "";
  movies.forEach(m => createMovieCard(m, rowId));
}
async function loadTrending() { loadRow("/trending/movie/week", "trendingRow"); }
async function loadTopRated() { loadRow("/movie/top_rated", "topRatedRow"); }
async function loadUpcoming() { loadRow("/movie/upcoming", "upcomingRow"); }

async function loadGenre(genreId) {
  const res = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}`);
  const data = await res.json();
  document.getElementById("trendingRow").innerHTML = "";
  data.results.slice(0, 12).forEach(m => createMovieCard(m, "trendingRow"));
}
async function searchMovies(query) {
  if (query.length < 2) return;
  const res = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${query}`);
  const data = await res.json();
  const container = document.getElementById("searchRowContainer");
  const row = document.getElementById("searchRow");
  row.innerHTML = "";
  if (data.results.length === 0) {
    container.style.display = "none";
    return;
  }
  data.results.slice(0, 12).forEach(m => createMovieCard(m, "searchRow"));
  container.style.display = "block";
}

// ==================== EVENTET DHE LOGJINË E UI ====================
function setupEventListeners() {
  document.getElementById("searchInput").addEventListener("keyup", (e) => searchMovies(e.target.value));
  document.querySelectorAll("#genreButtons button").forEach(btn => {
    btn.addEventListener("click", () => loadGenre(btn.dataset.genre));
  });
  document.getElementById("userIcon").onclick = () => document.getElementById("authModal").style.display = "flex";
  document.querySelector(".close-modal").onclick = () => document.getElementById("authModal").style.display = "none";
  document.getElementById("loginBtn").onclick = async () => {
    const email = document.getElementById("loginEmail").value;
    const pwd = document.getElementById("loginPassword").value;
    try { await signInWithEmailAndPassword(auth, email, pwd); closeModal(); showToast("Hyrja u krye!"); } 
    catch(e) { showToast(e.message); }
  };
  document.getElementById("registerBtn").onclick = async () => {
    const email = document.getElementById("regEmail").value;
    const pwd = document.getElementById("regPassword").value;
    try { await createUserWithEmailAndPassword(auth, email, pwd); closeModal(); showToast("Llogaria u krijua!"); } 
    catch(e) { showToast(e.message); }
  };
  document.getElementById("googleLoginBtn").onclick = async () => {
    try { await signInWithPopup(auth, provider); closeModal(); } 
    catch(e) { showToast(e.message); }
  };
  document.getElementById("logoutBtn").onclick = () => signOut(auth);
  document.getElementById("redeemAdFreeBtn").onclick = redeemAdFree;
  document.getElementById("closePanel").onclick = () => document.getElementById("userPanel").style.display = "none";
  
  function closeModal() { document.getElementById("authModal").style.display = "none"; }
  // Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
      document.getElementById(btn.dataset.tab === "login" ? "loginForm" : "registerForm").classList.add("active");
    };
  });
}

// Auth state observer
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  const panel = document.getElementById("userPanel");
  const userPointsSpan = document.getElementById("userPoints");
  const favoritesDiv = document.getElementById("favoritesList");
  const watchlistDiv = document.getElementById("watchlistList");
  const adFreeStatus = document.getElementById("adFreeStatus");
  if (user) {
    panel.style.display = "block";
    document.getElementById("userName").innerText = user.email.split('@')[0];
    const userRef = doc(db, "users", user.uid);
    onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        userData = docSnap.data();
        userPointsSpan.innerText = userData.points || 0;
        const isAdFree = userData.adFreeUntil && new Date(userData.adFreeUntil) > new Date();
        adFreeStatus.innerText = isAdFree ? "✅ Pa reklama (aktive)" : "⚠️ Reklamat shfaqen. Përdor 2000 pikë për 30 ditë pa reklama.";
        // Populate favorites
        favoritesDiv.innerHTML = (userData.favorites || []).map(f => `<div>🎬 ${f.title} <button class="remove-fav" data-id="${f.id}">🗑️</button></div>`).join("");
        watchlistDiv.innerHTML = (userData.watchlist || []).map(w => `<div>⏰ ${w.title} <button class="remove-wl" data-id="${w.id}">❌</button></div>`).join("");
        // shto evente per remove
      } else {
        setDoc(userRef, { points: 0, favorites: [], watchlist: [], adFreeUntil: null });
      }
    });
  } else {
    panel.style.display = "none";
  }
});

// ==================== INIT ====================
loadTrending();
loadTopRated();
loadUpcoming();
setupEventListeners();

// Eksportojmë funksionin për watch.html që të marrë pikë
window.addPoints = addPoints;
