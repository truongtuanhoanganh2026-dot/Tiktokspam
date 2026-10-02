import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";

import {
  firebaseConfig
} from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser = null;
let currentChatUser = null;
let unsubscribeMessages = null;


/* ELEMENTS */

const authPage = document.getElementById("authPage");
const mainPage = document.getElementById("mainPage");

const email = document.getElementById("email");
const password = document.getElementById("password");
const username = document.getElementById("username");

const authStatus = document.getElementById("authStatus");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");

const logoutBtn = document.getElementById("logoutBtn");

const myId = document.getElementById("myId");

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

const searchResults = document.getElementById("searchResults");

const friendsList = document.getElementById("friendsList");

const chatHeader = document.getElementById("chatHeader");
const messages = document.getElementById("messages");

const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const sendCount = document.getElementById("sendCount");


/* REGISTER */

registerBtn.onclick = async () => {

  const mail = email.value.trim();
  const pass = password.value.trim();
  const name = username.value.trim().toLowerCase();

  if (!mail || !pass || !name) {
    authStatus.textContent = "Hãy nhập đủ thông tin.";
    return;
  }

  if (name.length < 3) {
    authStatus.textContent = "ID phải có ít nhất 3 ký tự.";
    return;
  }

  try {

    const check = await getDocs(
      query(
        collection(db, "users"),
        where("username", "==", name)
      )
    );

    if (!check.empty) {
      authStatus.textContent = "ID này đã được sử dụng.";
      return;
    }

    const credential =
      await createUserWithEmailAndPassword(
        auth,
        mail,
        pass
      );

    await setDoc(
      doc(db, "users", credential.user.uid),
      {
        uid: credential.user.uid,
        username: name,
        email: mail,
        createdAt: serverTimestamp()
      }
    );

    authStatus.textContent =
      "Tạo tài khoản thành công.";

  } catch (error) {

    authStatus.textContent =
      firebaseError(error);

  }

};


/* LOGIN */

loginBtn.onclick = async () => {

  try {

    await signInWithEmailAndPassword(
      auth,
      email.value.trim(),
      password.value
    );

  } catch (error) {

    authStatus.textContent =
      firebaseError(error);

  }

};


/* LOGOUT */

logoutBtn.onclick = async () => {

  await signOut(auth);

};


/* AUTH STATE */

onAuthStateChanged(auth, async user => {

  if (user) {

    currentUser = user;

    authPage.classList.add("hidden");
    mainPage.classList.remove("hidden");

    const snap =
      await getDoc(
        doc(db, "users", user.uid)
      );

    if (snap.exists()) {

      myId.textContent =
        "@" + snap.data().username;

    }

    loadFriends();

  } else {

    currentUser = null;

    authPage.classList.remove("hidden");
    mainPage.classList.add("hidden");

  }

});


/* SEARCH USER */

searchBtn.onclick = searchUser;

searchInput.addEventListener(
  "keydown",
  e => {
    if (e.key === "Enter") searchUser();
  }
);


async function searchUser() {

  const name =
    searchInput.value.trim().toLowerCase();

  if (!name) return;

  searchResults.innerHTML =
    "<div>Đang tìm...</div>";

  const result =
    await getDocs(
      query(
        collection(db, "users"),
        where("username", "==", name)
      )
    );

  searchResults.innerHTML = "";

  if (result.empty) {

    searchResults.innerHTML =
      "<div class='search-user'>Không tìm thấy người dùng.</div>";

    return;
  }

  result.forEach(snap => {

    const user = snap.data();

    if (user.uid === currentUser.uid) return;

    const box =
      document.createElement("div");

    box.className = "search-user";

    box.innerHTML = `
      <span>@${escapeHTML(user.username)}</span>
      <button>Chat</button>
    `;

    box.querySelector("button").onclick =
      () => openChat(user);

    searchResults.appendChild(box);

  });

}


/* FRIENDS */

async function loadFriends() {

  friendsList.innerHTML = "";

  const users =
    await getDocs(
      collection(db, "users")
    );

  users.forEach(snap => {

    const user = snap.data();

    if (user.uid === currentUser.uid)
      return;

    addFriend(user);

  });

}


function addFriend(user) {

  const item =
    document.createElement("div");

  item.className = "friend";

  item.innerHTML = `
    <div class="avatar">
      ${escapeHTML(
        user.username
          .substring(0, 1)
          .toUpperCase()
      )}
    </div>

    <div class="friend-info">
      <b>@${escapeHTML(user.username)}</b>
      <small>Nhắn tin</small>
    </div>
  `;

  item.onclick =
    () => openChat(user);

  friendsList.appendChild(item);

}


/* CHAT */

function chatId(a, b) {

  return [a, b]
    .sort()
    .join("_");

}


async function openChat(user) {

  currentChatUser = user;

  chatHeader.innerHTML =
    `<b>@${escapeHTML(user.username)}</b>`;

  messages.innerHTML = "";

  if (unsubscribeMessages)
    unsubscribeMessages();

  const id =
    chatId(
      currentUser.uid,
      user.uid
    );

  const messagesRef =
    collection(
      db,
      "chats",
      id,
      "messages"
    );

  const q =
    query(
      messagesRef,
      orderBy("createdAt")
    );

  unsubscribeMessages =
    onSnapshot(q, snapshot => {

      messages.innerHTML = "";

      snapshot.forEach(snap => {

        const msg = snap.data();

        renderMessage(msg);

      });

      messages.scrollTop =
        messages.scrollHeight;

    });

}


/* RENDER MESSAGE */

function renderMessage(msg) {

  const row =
    document.createElement("div");

  row.className =
    "msg " +
    (msg.senderId === currentUser.uid
      ? "me"
      : "");

  const bubble =
    document.createElement("div");

  bubble.className = "bubble";

  if (msg.type === "link") {

    bubble.innerHTML =
      `<a href="${escapeAttribute(msg.text)}"
          target="_blank"
          rel="noopener">
          ${escapeHTML(msg.text)}
       </a>`;

  } else {

    bubble.textContent =
      msg.text || "";

  }

  const time =
    document.createElement("small");

  time.textContent =
    msg.createdAt?.toDate
      ? msg.createdAt.toDate()
          .toLocaleTimeString()
      : "";

  bubble.appendChild(time);

  row.appendChild(bubble);

  messages.appendChild(row);

}


/* SEND */

sendBtn.onclick = sendMessage;

messageInput.addEventListener(
  "keydown",
  e => {

    if (e.key === "Enter") {

      e.preventDefault();

      sendMessage();

    }

  }
);


async function sendMessage() {

  if (!currentChatUser) {

    alert("Hãy chọn người để chat.");

    return;
  }

  const text =
    messageInput.value.trim();

  if (!text) return;

  const count =
    Number(sendCount.value);

  const id =
    chatId(
      currentUser.uid,
      currentChatUser.uid
    );

  const messagesRef =
    collection(
      db,
      "chats",
      id,
      "messages"
    );

  const type =
    /^https?:\/\//i.test(text)
      ? "link"
      : "text";


  for (let i = 0; i < count; i++) {

    await addDoc(
      messagesRef,
      {
        senderId: currentUser.uid,
        receiverId: currentChatUser.uid,
        text,
        type,
        createdAt: serverTimestamp()
      }
    );

  }

  messageInput.value = "";

}


/* FIREBASE ERROR */

function firebaseError(error) {

  const code = error.code || "";

  const map = {

    "auth/email-already-in-use":
      "Email này đã được sử dụng.",

    "auth/invalid-email":
      "Email không hợp lệ.",

    "auth/weak-password":
      "Mật khẩu quá yếu.",

    "auth/invalid-credential":
      "Email hoặc mật khẩu không đúng.",

    "auth/network-request-failed":
      "Không có kết nối mạng."

  };

  return map[code] ||
    "Có lỗi xảy ra: " + code;

}


/* SECURITY */

function escapeHTML(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function escapeAttribute(value) {

  return String(value)
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

}