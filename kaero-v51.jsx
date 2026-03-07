import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { authApi, userApi, listingApi, offerApi, chatApi, categoryApi, transactionApi, walletApi, notificationApi, reviewApi, uploadApi, referralApi, favoriteApi, setStoredTokens, setStoredUser, getStoredUser, getStoredTokens, clearAuth } from "./web/api.js";

/* ═══════════════════════════════════════════════════════════
   KAERO v38 — OFFICIAL KAERO COLOR SYSTEM
   Kaero Green #019F45 — primary brand, buttons, trust, active
   Warm Teal #14B8A6/#2DD4BF — AI/voice features, CTAs, accents
   Slate #475569 — secondary text, metadata, support elements
   Off-Black #0F172A — dark bg, light text, depth
   Soft Gray #F1F5F9 — light bg surfaces, hover states
   Pure White #FFFFFF — cards (light), text (dark)
═══════════════════════════════════════════════════════════ */

/* ── AI HELPER — routes through Kaero backend (OpenAI GPT-4o-mini) ── */
async function callClaude(userPrompt, systemPrompt = "") {
  try {
    const tok = localStorage.getItem("kaero_access_token");
    if (!tok) return null;
    const API = import.meta.env?.VITE_API_URL || "http://localhost:3000/api/v1";
    const fullPrompt = systemPrompt
      ? systemPrompt + "\n\n" + userPrompt + "\n\nRespond ONLY with valid JSON."
      : userPrompt + "\n\nRespond ONLY with valid JSON.";
    const res = await fetch(API + "/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
      body: JSON.stringify({ message: fullPrompt }),
    });
    const data = await res.json();
    const text = data?.reply || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    return null;
  }
}

/* ── TIME AGO HELPER ── */
function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
}

/* ── BACKEND → UI ADAPTERS ── */
function adaptListing(l) {
  if (!l) return null;
  // Already adapted (has _raw) — return as-is
  if (l._raw) return l;
  return {
    id: l.id,
    name: l.user_edited_title || l.ai_generated_title || l.title || 'Untitled',
    brand: '',
    price: Number(l.final_price ?? l.price ?? 0),
    km: Number(l.distance_km ?? 0),
    rating: Number(l.seller_trust_score ?? l.trust_score ?? 4.5),
    reviews: Number(l.seller_total_reviews ?? l.total_reviews ?? 0),
    condition: l.condition || 'good',
    img: l.primary_image_url || l.image_url || 'https://placehold.co/400x400/019F45/white?text=Kaero',
    additionalImgs: Array.isArray(l.additional_images) ? l.additional_images : [],
    seller: l.seller_name || l.seller?.full_name || '',
    sellerRating: Number(l.seller_trust_score ?? l.seller?.trust_score ?? 4.5),
    sellerReviews: Number(l.seller_total_reviews ?? l.seller?.total_reviews ?? 0),
    sellerTrust: Math.round(Number(l.seller_trust_score ?? l.seller?.trust_score ?? 80)),
    sellerId: l.seller_id || l.seller?.id || '',
    sellerImg: l.seller_avatar || l.seller?.avatar_url || '',
    desc: l.user_edited_description || l.ai_generated_description || l.description || '',
    category: l.category_name || l.category_id?.toString() || 'other',
    categoryId: l.category_id,
    views: Number(l.view_count ?? 0),
    aiPrice: Number(l.ai_suggested_price ?? l.final_price ?? 0),
    sold: l.status === 'sold',
    status: l.status || 'active',
    createdAt: l.created_at,
    lat: l.lat ? Number(l.lat) : null,
    lng: l.lng ? Number(l.lng) : null,
    _raw: l,
  };
}

function adaptOffer(o) {
  if (!o) return null;
  if (o._raw) return o;
  return {
    id: o.id,
    buyer: o.buyer_name || o.buyer?.full_name || 'Buyer',
    av: (o.buyer_name || o.buyer?.full_name || 'B')[0].toUpperCase(),
    avImg: o.buyer_avatar || o.buyer?.avatar_url || '',
    price: Number(o.offered_price ?? o.price ?? 0),
    km: 0,
    rating: Number(o.buyer_trust_score ?? o.buyer?.trust_score ?? 4.0),
    reviews: 0,
    note: o.message || '',
    exchange: o.is_exchange_proposal ? (o.exchange_listing_title || 'Exchange item') : null,
    exchangeImg: o.exchange_listing_image || null,
    exchangeVal: Number(o.exchange_listing_value ?? 0),
    time: timeAgo(o.created_at),
    status: o.status || 'pending',
    counterPrice: o.counter_price ? Number(o.counter_price) : null,
    listingId: o.listing_id,
    buyerId: o.buyer_id,
    _raw: o,
  };
}

function adaptChat(c) {
  if (!c) return null;
  if (c._raw) return c;
  return {
    id: c.id,
    buyer: c.other_user_name || c.buyer_name || c.seller_name || 'User',
    av: (c.other_user_name || c.buyer_name || c.seller_name || 'U')[0].toUpperCase(),
    avImg: c.other_user_avatar || '',
    item: {
      id: c.listing_id,
      name: c.listing_title || 'Item',
      price: Number(c.listing_price ?? 0),
      img: c.listing_image || 'https://placehold.co/400x400/019F45/white?text=Kaero',
    },
    price: Number(c.listing_price ?? 0),
    lastMsg: c.last_message || '',
    time: c.last_message_at ? timeAgo(c.last_message_at) : '',
    unread: c.unread_count || 0,
    listingId: c.listing_id,
    _raw: c,
  };
}

function adaptMessage(m, currentUserId) {
  if (!m) return null;
  return {
    from: m.sender_id === currentUserId ? 'me' : 'them',
    text: m.content || '',
    time: m.created_at ? timeAgo(m.created_at) : '',
    offer: m.message_type === 'offer',
    type: m.message_type || 'text',
    mediaUrl: m.media_url || null,
    _raw: m,
  };
}

function adaptNotification(n) {
  if (!n) return null;
  const iconMap = {
    new_offer: '💬', offer_accepted: '✅', offer_rejected: '❌', offer_countered: '🔄',
    payment_received: '💰', review_received: '⭐', referral_joined: '👥',
    referral_transacted: '🎁', new_listing_nearby: '📍', new_message: '💬',
    transaction_completed: '✅', dispute_opened: '⚠️', dispute_resolved: '⚖️',
  };
  return {
    ic: iconMap[n.type] || '🔔',
    text: (n.title || '') + (n.body ? ': ' + n.body : ''),
    time: timeAgo(n.created_at),
    unread: !n.is_read,
    ai: n.type?.startsWith('kaero_') || n.type === 'new_listing_nearby',
    col: null,
    _raw: n,
  };
}

function adaptTransaction(t) {
  if (!t) return null;
  if (t._raw) return t;
  return {
    id: t.id,
    name: t.listing_title || 'Transaction',
    price: Number(t.agreed_price ?? 0),
    type: t.buyer_id === t._currentUserId ? 'Bought' : 'Sold',
    time: timeAgo(t.created_at),
    status: t.payment_status || 'pending',
    paymentMethod: t.payment_method,
    buyerId: t.buyer_id,
    sellerId: t.seller_id,
    listingId: t.listing_id,
    _raw: t,
  };
}

/* ── WEB SPEECH API HOOK ── */
function useVoice({ onResult, onEnd, lang = "ar-EG" } = {}) {
  const recogRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setSupported(false); return; }
    const r = new SpeechRecognition();
    r.continuous = false;
    r.interimResults = true;
    r.lang = lang;
    r.onresult = (e) => {
      const t = Array.from(e.results).map(x => x[0].transcript).join("");
      setTranscript(t);
      if (e.results[e.results.length - 1].isFinal) {
        onResult && onResult(t);
      }
    };
    r.onend = () => { setListening(false); onEnd && onEnd(); };
    r.onerror = () => setListening(false);
    recogRef.current = r;
    return () => { try { r.stop(); } catch(e) {} };
  }, [lang]);

  const start = useCallback(() => {
    if (!recogRef.current) return;
    try { recogRef.current.start(); setListening(true); setTranscript(""); } catch(e) {}
  }, []);
  const stop = useCallback(() => {
    if (!recogRef.current) return;
    try { recogRef.current.stop(); } catch(e) {}
    setListening(false);
  }, []);
  const toggle = useCallback(() => { listening ? stop() : start(); }, [listening]);

  return { listening, transcript, supported, start, stop, toggle };
}

/* ═══════════════════════════════════════════════════════════
   KAERO — "CAIRO TRUST" PALETTE 2026
   ① bg  ② surface  ③ text  ④ muted  ⑤ accent #2979FF  ⑥ green #019F45
═══════════════════════════════════════════════════════════ */

/* ── DATABASE LAYER (persisted + API-backed) ── */
const _STORE = {};
const DB = {
  _get(k) {
    try { const v = localStorage.getItem('kaero_' + k); return v ? JSON.parse(v) : (_STORE['kaero_' + k] ?? null); } catch { return _STORE['kaero_' + k] ?? null; }
  },
  _set(k, v) { _STORE['kaero_' + k] = v; try { localStorage.setItem('kaero_' + k, JSON.stringify(v)); } catch (e) {} },
  getUser() {
    const apiUser = getStoredUser();
    if (apiUser) return apiUser;
    return this._get('user') || { name: 'Ahmed K.', bio: 'Buying & selling tech in Cairo 🇪🇬', phone: '+20 100 234 5678', email: 'ahmed@kaero.eg', location: 'Cairo, Egypt', trustScore: 96, rating: 4.9, reviews: 127, sales: 47, verified: true, avatar: 'https://placehold.co/400x400/019F45/white?text=Kaero' }; },
  setUser(u) { this._set('user', u); },
  getTheme() { return this._get('theme') ?? true; },
  setTheme(dark) { this._set('theme', dark); },
  getLang() { return this._get('lang') || 'en'; },
  setLang(l) { this._set('lang', l); },
  getWallet() { return this._get('wallet') || { total: 45320, released: 32000, escrow: 13320, disputes: 0 }; },
  setWallet(w) { this._set('wallet', w); },
  getMessages() { return this._get('messages') || []; },
  addMessage(m) { const msgs = this.getMessages(); msgs.push(m); this._set('messages', msgs); },
  getOfferHistory() { return this._get('offerHistory') || []; },
  addOffer(o) { const h = this.getOfferHistory(); h.push(o); this._set('offerHistory', h); },
};

/* ── TRANSLATIONS (COMPLETE) ── */
const TR = {
  en: {
    home: "Home", market: "Market", sell: "Sell", chat: "Chat", profile: "Profile",
    myStore: "My Store", buy: "BUY", sellBtn: "SELL", tapOrSpeak: "tap or speak",
    exploreMarket: "Explore Market", kaeroInsights: "KAERO INSIGHTS",
    hotNearYou: "🔥 Hot Near You", seeAll: "See all →", recentActivity: "🔔 Recent Activity",
    escrowWallet: "💳 Escrow Wallet", released: "Released", inEscrow: "In Escrow",
    disputes: "Disputes", active: "active", addItem: "Add Item",
    verified: "Verified", trustScore: "Trust Score", idVerified: "ID Verified",
    phoneVerified: "Phone Verified", topSeller: "Top Seller",
    browseAndBuy: "Browse & Buy", allCategories: "ALL CATEGORIES",
    featuredNearYou: "FEATURED NEAR YOU", voiceSearch: "Kaero Voice Search",
    tapToSpeak: "Tap to speak", listening: "🔴 Listening…",
    trySaying: "TRY SAYING", resultsFound: "results found by Kaero",
    productInfo: "Description", seller: "Seller", reviews: "Reviews", safety: "Safety",
    makeOffer: "Make Offer", buySafely: "🛡️ Buy Safely",
    priceOffer: "Your Price Offer (EGP)", paymentMethod: "Payment Method",
    escrow: "Escrow", cash: "Cash", card: "Card", safest: "Safest",
    meetInPerson: "Meet in person", visaMC: "Visa/MC",
    addExchange: "Add Exchange Item (optional)", noExchange: "No Exchange",
    sendOffer: "🚀 Send Offer →", offerSent: "Offer Sent!",
    openCamera: "Open Camera", takePhoto: "Take Photo",
    describeItem: "Describe your item", kaeroAnalyzing: "Kaero Analyzing…",
    kaeroPriceSugg: "KAERO PRICE SUGGESTION", publish: "🚀 Publish → My Store",
    searchRadius: "Search radius", itemsWithin: "items within",
    securePayment: "Secure Payment", agreement: "Agreement",
    voiceRecord: "Voice Record", payment: "Payment", confirmation: "Confirmation",
    paySecurely: "🔒 Pay Securely", paymentSuccess: "Payment Successful!",
    confirmCode: "Confirmation Code", enterCode: "Enter code from seller",
    confirmReceipt: "Confirm Receipt", codeInfo: "Share this code with the buyer after delivery",
    settings: "Settings", editProfile: "Edit Profile", notifications: "Notifications",
    darkMode: "Dark Mode", language: "Language", signOut: "🚪 Sign Out",
    login: "Login", signup: "Sign Up", email: "Email", password: "Password",
    forgotPassword: "Forgot Password?", noAccount: "Don't have an account?",
    hasAccount: "Already have an account?", fullName: "Full Name",
    phone: "Phone Number", enterOTP: "Enter OTP",
    otpSentPhone: "OTP sent to your phone", otpSentEmail: "OTP sent to your email",
    verifyPhone: "Verify Phone", verifyEmail: "Verify Email",
    uploadID: "Upload National ID", createPassword: "Create Password",
    next: "Next →", verify: "Verify", submit: "Submit", skip: "Skip",
    welcomeBack: "Welcome Back", welcomeKaero: "Welcome to Kaero",
    localCommerce: "SMART LOCAL COMMERCE",
    messages: "Messages", online: "Online", typeMsg: "Type a message…",
    items: "items", km: "km", egp: "EGP", ago: "ago",
    accept: "✓ Accept", decline: "Decline", counter: "Counter",
    analytics: "Analytics", offers: "Offers", overview: "Overview", history: "History",
    quickSale: "Quick Sale", marketAvg: "Market Avg", maximum: "Maximum",
    all: "All", phones: "Phones", laptops: "Laptops", audio: "Audio",
    gaming: "Gaming", cameras: "Cameras", tablets: "Tablets", drones: "Drones",
    arabic: "العربية", english: "English",
    price: "Price", distance: "Distance", rating: "Rating",
    kaeroTips: "💡 Kaero Tips", kaeroReady: "Kaero Listing Ready!",
    protection7day: "🛡️ 7-Day Buyer Protection",
    account: "ACCOUNT", preferences: "PREFERENCES", kaeroSearch: "KAERO & SEARCH",
    payments: "PAYMENTS", security: "SECURITY", about: "ABOUT",
    // v9 additions
    nearby: "nearby", subcategories: "subcategories", featured: "FEATURED",
    searchAnything: "Search anything: phones, laptops, PS5…",
    tapToVoiceSearch: "Tap to voice search", listeningSpeak: "🔴 Listening… Speak now",
    listeningTry: "🔴 Listening: try \"Find iPhone 13 under 20,000 EGP near me\"",
    noResults: "No items match your search. Try adjusting price or distance.",
    verifiedPhotos: "Verified Photos", protected: "Protected",
    info: "Info", sellerTab: "Seller", reviewsTab: "Reviews", safetyTab: "Safety",
    brand: "Brand", condition: "Condition",
    viewStore: "View Store →", chat2: "Chat",
    offerSentMsg: "Your offer was sent to the seller.",
    backToItem: "← Back to Item",
    makeAnOffer: "Make an Offer",
    exchangeOffer: "EXCHANGE OFFER", tapToView: "tap item to view →",
    total: "Total",
    safeBuyGuide: "Safe Buy Guide",
    meetSeller: "Meet the Seller", inspectItem: "Inspect the Item",
    payViaEscrow: "Pay via Escrow", confirmReceiptTitle: "Confirm Receipt",
    meetDesc: "Always meet in a public, busy place: a mall, café, or police station parking lot.",
    inspectDesc: "Test all functions. Check serial numbers match. Verify IMEI for phones.",
    escrowDesc: "Never pay cash before inspecting. Use Kaero escrow, your money stays safe.",
    confirmDesc: "After inspection, release payment from app. Protection lasts 7 days.",
    gotItNext: "Got it, Next →", itemLooksGood: "Item looks good →",
    payWithEscrow: "Pay with Escrow →", proceedPayment: "Proceed to Payment",
    sellAnItem: "Sell an Item",
    photo: "Photo", describe: "Describe", kaeroScan: "Kaero Scan",
    inAppCamera: "In-App Camera",
    orDescribeVoice: "Or describe by voice (Arabic / English)",
    goodLighting: "Good lighting: Kaero identifies faster",
    includeBrand: "Include brand & model",
    voiceHelps: "Voice description helps Kaero write better copy",
    inAppOnly: "In app only: guarantees listing authenticity",
    photoCaptured: "Photo captured ✓",
    letKaeroAnalyze: "🤖 Let Kaero Analyze →",
    identifyingProduct: "Identifying product type…",
    checkingPrices: "Checking live market prices…",
    writingDesc: "Writing optimized description…",
    finalizing: "Finalizing listing…",
    reviewPublish: "Review and publish in one tap",
    edit: "Edit",
    itemPublished: "Item Published!",
    nowLive: "Now live on Kaero. Buyers near you can see it",
    publishedSuccess: "Item Published Successfully",
    title: "Title", category: "Category",
    listingsLabel: "Listings", offersLabel: "Offers", viewsLabel: "Views", ratingLabel: "Rating",
    addNewListing: "+ Add New Listing",
    noOffersYet: "No offers yet. Your listing is live!",
    offerAccepted: "✅ Offer accepted · payment in escrow",
    buyerInspect: "Buyer has 3 days to inspect. Funds release after confirmation.",
    accepted: "✅ Accepted · Payment in escrow", declined: "Declined",
    counterOffer: "Your counter-offer (EGP)",
    viewsThisWeek: "Views this week", avgOffer: "Avg offer received",
    conversionRate: "Conversion rate", kaeroFairPrice: "Kaero fair price",
    kaeroWatching: "Kaero is watching for you",
    basedOnSearch: "Based on your search behavior",
    unread: "unread",
    whenMeet: "When can you meet?", priceNegotiable: "Is price negotiable?",
    canDeliver: "Can you deliver?", stillAvailable: "Still available?",
    protectionActive: "🛡️ 7-Day Protection Active",
    paymentHeld: "Your payment is held safely in escrow",
    inspectDays: "3 days to inspect before funds release",
    fullRefund: "Full refund if item differs from listing",
    voiceRequired: "Voice recording required as legal proof",
    agreeAndContinue: "Agree & Continue →",
    voiceAgreement: "Voice Agreement Required",
    stateNameItem: "State your name, item, and agreed price. This protects both parties.",
    tapToRecord: "Tap to Record Agreement",
    recording: "🔴 Recording…",
    recordingSaved: "Recording Saved!",
    sayAgree: "Say: 'I agree to buy [item] for [price] EGP'",
    verbalCaptured: "Verbal agreement captured & encrypted",
    continuePayment: "Continue to Payment →",
    itemPrice: "Item price", platformFee: "Platform fee (2%)",
    deliveryCode: "🔐 Delivery Confirmation Code",
    shareCode: "Share this code with the buyer after delivery. The buyer must enter it to confirm receipt.",
    buyerConfirm: "📦 Buyer: Confirm Receipt",
    enterDigitCode: "Enter the 6-digit code from the seller to confirm you received the item.",
    confirm: "Confirm", codeNoMatch: "❌ Code does not match. Please try again.",
    receiptConfirmed: "Receipt Confirmed!",
    fundsReleased: "Funds will be released to the seller within 24 hours.",
    transactionId: "Transaction ID", amount: "Amount",
    escrowRelease: "Escrow release", afterBuyerConfirms: "After buyer confirms",
    disputeDeadline: "Dispute deadline", hoursAfter: "72 hours after receipt",
    backHome: "← Back to Home",
    myProfile: "My Profile", memberSince: "Member since Jan 2024",
    totalSales: "Total Sales", activeListings: "Active Listings",
    avgSale: "Avg. Sale EGP", responseRate: "Response Rate",
    trustBreakdown: "🛡️ Trust Score Breakdown",
    successfulTx: "Successful Transactions", positiveReviews: "Positive Reviews",
    responseSpeed: "Response Speed", noDisputes: "No Disputes",
    verificationStatus: "Verification Status",
    phoneNumber2: "Phone Number", nationalId: "National ID",
    voiceSample: "Voice Sample", notVerified: "Not verified",
    sold: "Sold", bought: "Bought",
    pushNotifications: "Push Notifications", offersDeals: "Offers, deals, activity",
    onRecommended: "On (recommended)", off: "Off",
    arabicInterface: "Arabic Interface",
    currency: "Currency",
    defaultSearchRadius: "Default Search Radius",
    listingsWithin: "Listings within", shownFirst: "shown first",
    kaeroPriceSuggestions: "Kaero Price Suggestions", autoPrice: "Auto-price your listings",
    kaeroSmartNotifs: "Kaero Smart Notifications", alertsBehavior: "Alerts based on your behavior",
    voiceSearchLang: "Voice Search Language",
    paymentMethods: "Payment Methods",
    escrowWalletLabel: "Escrow Wallet", available: "available",
    transactionHistory: "Transaction History", showingLast: "Showing last 30 transactions",
    twoFa: "Two-Factor Authentication", smsAuth: "SMS + Authenticator",
    biometricLogin: "Biometric Login", faceId: "Face ID / Fingerprint",
    changePassword: "Change Password",
    termsOfService: "Terms of Service", privacyPolicy: "Privacy Policy",
    rateKaero: "Rate Kaero on App Store", contactSupport: "Contact Support",
    liveChat: "Live chat · Arabic & English",
    identityVerification: "Identity Verification",
    voiceVerification: "Voice Verification",
    addPaymentMethod: "+ Add Payment Method",
    changePw: "Change Password",
    saveChanges: "Save Changes", changePhoto: "Change Photo",
    name: "Name", bio: "Bio", location: "Location",
    profileSaved: "Profile saved ✅",
    kaeroVerified: "Kaero Verified", trusted: "Trusted",
    powerSeller: "Power Seller",
    allScreens: "ALL SCREENS", techSpec: "TECH SPEC",
    mapVoice: "Map + Voice",
    instant: "Instant", within1hr: "Within 1 hr",
    visa: "Visa / Mastercard", vodafoneCash: "Vodafone Cash",
    fawryCash: "Fawry Cash", instaPay: "InstaPay",
    auto: "Auto",
    back: "← Back",
    idUploaded: "ID Uploaded ✓", tapToUpload: "Tap to upload",
    uploadIdDesc: "Upload your national ID for verification",
    strongPassword: "Create a strong password",
    searchMarketVoice: "Search market by voice…",
    kaeroAutoIdentify: "🤖 Kaero will auto-identify your item",
    identifyingCondition: "Identifying product, condition & fair market price",
    orDescribeItem: "Or describe by voice",
    listeningDescribe: "🔴 Listening… describe your item",
    // additional full i18n keys
    chooseProfilePhoto: "Choose your profile photo",
    yourFullName: "Your full name",
    description: "Description",
    viewStore2: "View Store",
    verified2: "VERIFIED",
    trustScore2: "Trust Score",
    verifiedSeller: "Verified Seller",
    sellerInfo: "Seller Info",
    safe: "Safe",
    noExchange2: "No Exchange",
    paymentMethod2: "Payment Method",
    exchangeItem: "Exchange Item",
    makeAnOfferBtn: "Make Offer",
    sold2: "SOLD",
    sold3: "Sold",
    bought2: "Bought",
    default2: "Default",
    featuredLabel: "FEATURED",
    allCategoriesLabel: "ALL CATEGORIES",
    featuredNearYouLabel: "FEATURED NEAR YOU",
    voiceAgreementReq: "Voice Agreement Required",
    stateNameItem2: "State your name, item, and agreed price. This protects both parties.",
    tapToRecord2: "Tap to Record Agreement",
    recordingSaved2: "Recording Saved!",
    verbalCaptured2: "Verbal agreement captured & encrypted",
    sayAgree2: "Say: 'I agree to buy [item] for [price] EGP'",
    paymentSuccess2: "Payment Successful!",
    paymentHeldEscrow: "Your payment is safely held in escrow. You have 3 days to inspect the item.",
    deliveryCode2: "🔐 Delivery Confirmation Code",
    shareCodeDesc: "Share this code with the buyer after delivery. The buyer must enter it to confirm receipt.",
    buyerConfirm2: "📦 Buyer: Confirm Receipt",
    enterCodeDesc: "Enter the 6 digit code from the seller to confirm you received the item.",
    codeNoMatch2: "❌ Code does not match. Please try again.",
    receiptConfirmed2: "Receipt Confirmed!",
    fundsReleased2: "Funds will be released to the seller within 24 hours.",
    transactionId2: "Transaction ID",
    amount2: "Amount",
    escrowRelease2: "Escrow release",
    afterBuyerConfirms2: "After buyer confirms",
    disputeDeadline2: "Dispute deadline",
    hoursAfter2: "72 hours after receipt",
    backToHome: "← Back to Home",
    verificationStatus2: "Verification Status",
    phoneNumber3: "Phone Number",
    nationalId2: "National ID",
    voiceSample2: "Voice Sample",
    email2: "Email",
    verified3: "Verified",
    notVerified2: "Not verified",
    editProfile2: "Edit Profile",
    changePhoto2: "Change Photo",
    name2: "Name",
    bio2: "Bio",
    saveChanges2: "Save Changes",
    profileSaved2: "Profile saved ✅",
    pushNotifs: "Push Notifications",
    offersDealsActivity: "Offers, deals, activity",
    currency2: "Currency",
    defaultSearchRadius2: "Default Search Radius",
    listingsWithin2: "Listings within",
    shownFirst2: "shown first",
    voiceSearchLang2: "Voice Search Language",
    paymentMethods2: "Payment Methods",
    escrowWalletLabel2: "Escrow Wallet",
    available2: "available",
    twoFa2: "Two Factor Authentication",
    smsAuth2: "SMS + Authenticator",
    biometricLogin2: "Biometric Login",
    faceId2: "Face ID / Fingerprint",
    changePassword2: "Change Password",
    signOut2: "🚪 Sign Out",
    kaeroVersion: "Kaero v10.0.0 · Cairo, Egypt",
    kaeroWatching2: "Kaero is watching for you",
    basedOnSearch2: "Based on your search behavior",
    addPaymentMethod2: "+ Add Payment Method",
    searchRadius2: "Search radius",
    itemsWithin2: "items within",
    accept2: "Accept",
    decline2: "Decline",
    counter2: "Counter",
    counterOffer2: "Your counter offer (EGP)",
    noOffersYet2: "No offers yet. Your listing is live!",
    accepted2: "Accepted",
    declined2: "Declined",
    viewsThisWeek2: "Views this week",
    avgOffer2: "Avg offer received",
    conversionRate2: "Conversion rate",
    kaeroFairPrice2: "Kaero fair price",
    addNewListing2: "+ Add New Listing",
    rateKaero2: "Rate Kaero",
    yourFeedback: "Your feedback helps us improve",
    yourKaeroStats: "📊 Your Kaero Stats",
    yourRating: "Your Rating",
    income: "Income (EGP)",
    totalSales2: "Total Sales",
    recentUserRatings: "🌟 Recent User Ratings",
    submitRating: "Submit Rating",
    totalIncome: "Total Income (EGP)",
    transactions: "Transactions",
    phone2: "📞 Phone",
    email3: "📧 Email",
    supportHours: "🕐 Support Hours",
    satToThu: "Saturday to Thursday: 9:00 AM to 9:00 PM",
    friday: "Friday: 2:00 PM to 9:00 PM",
    cairoTimezone: "Cairo, Egypt (EET/GMT+2)",
    weRespond: "We respond within 24 hours",
    available9to9: "Available 9 AM to 9 PM (Cairo time)",
    itemPrice2: "Item price",
    platformFee2: "Platform fee (2%)",
    total2: "Total",
    paySecurely2: "🔒 Pay Securely",
    addItem2: "+ Add Item",
    kaeroPriceSuggLabel: "KAERO PRICE SUGGESTION",
    quickSale2: "Quick Sale",
    marketAvg2: "Market Avg",
    maximum2: "Maximum",
    photoCaptured2: "Photo captured ✓",
    inAppCamera2: "In App Camera",
    kaeroListingReady: "Kaero Listing Ready!",
    reviewPublish2: "Review and publish in one tap",
    itemPublishedSuccess: "Item Published Successfully",
    nowLiveKaero: "Now live on Kaero. Buyers near you can see it",
    openCamera2: "Open Camera",
    takePhoto2: "Take Photo",
    inAppOnlyGuarantee: "In app only: guarantees listing authenticity",
    describeYourItem: "Describe your item",
    orDescVoice: "Or describe by voice",
    kaeroAnalyzing2: "Kaero Analyzing…",
    identifyingCond: "Identifying product, condition & fair market price",
    kaeroTips2: "💡 Kaero Tips",
    sellAnItem2: "Sell an Item",
    photoLabel: "Photo",
    describeLabel: "Describe",
    kaeroScanLabel: "Kaero Scan",
    publishLabel: "Publish",
    protection7dayActive: "🛡️ 7 Day Buyer Protection",
    d1: "D1",
    d1Desc: "Payment captured, held in escrow",
    d1d3: "D1 to D3",
    d1d3Desc: "3 day inspection window for buyer",
    d3: "D3",
    d3Desc: "Dispute deadline: police report required",
    d7: "D7",
    d7Desc: "Resolution & automatic payout to seller",
    speakArabicEnglish: "Speak in Arabic or English. Kaero understands item, price, distance & location",
    understandsFields: "Understands: item name · max price · distance · color · location",
    meetSeller2: "Meet the Seller",
    inspectItem2: "Inspect the Item",
    payViaEscrow2: "Pay via Escrow",
    confirmReceipt2: "Confirm Receipt",
    meetDesc2: "Always meet in a public, busy place: a mall, café, or police station parking lot. Never at private homes for first meetings.",
    inspectDesc2: "Test all functions. Check serial numbers match. Verify IMEI for phones. Take your time, don't rush.",
    escrowDesc2: "Never pay cash before inspecting. Use Kaero escrow, your money stays safe until you confirm the item.",
    confirmDesc2: "After inspection, release payment from app. Both parties get a review request. Your protection lasts 7 days.",
    gotItNext2: "Got it, Next →",
    itemLooksGood2: "Item looks good →",
    payWithEscrow2: "Pay with Escrow →",
    proceedPayment2: "Proceed to Payment",
    accountSection: "ACCOUNT",
    preferencesSection: "PREFERENCES",
    kaeroSearchSection: "KAERO & SEARCH",
    paymentsSection: "PAYMENTS",
    securitySection: "SECURITY",
  },
  ar: {
    home: "الرئيسية", market: "السوق", sell: "بيع", chat: "محادثة", profile: "الملف",
    myStore: "متجري", buy: "شراء", sellBtn: "بيع", tapOrSpeak: "اضغط أو تحدث",
    exploreMarket: "استكشف السوق", kaeroInsights: "تحليلات كايرو",
    hotNearYou: "🔥 رائج بالقرب منك", seeAll: "عرض الكل ←", recentActivity: "🔔 النشاط الأخير",
    escrowWallet: "💳 محفظة الضمان", released: "تم الإصدار", inEscrow: "في الضمان",
    disputes: "نزاعات", active: "نشط", addItem: "إضافة منتج",
    verified: "موثق", trustScore: "نقاط الثقة", idVerified: "الهوية موثقة",
    phoneVerified: "الهاتف موثق", topSeller: "بائع متميز",
    browseAndBuy: "تصفح واشتري", allCategories: "جميع الفئات",
    featuredNearYou: "مميز بالقرب منك", voiceSearch: "بحث كايرو الصوتي",
    tapToSpeak: "اضغط للتحدث", listening: "🔴 جاري الاستماع…",
    trySaying: "جرب أن تقول", resultsFound: "نتائج بواسطة كايرو",
    productInfo: "الوصف", seller: "البائع", reviews: "التقييمات", safety: "الأمان",
    makeOffer: "قدم عرض", buySafely: "🛡️ شراء آمن",
    priceOffer: "عرض السعر (جنيه)", paymentMethod: "طريقة الدفع",
    escrow: "ضمان", cash: "نقد", card: "بطاقة", safest: "الأكثر أماناً",
    meetInPerson: "مقابلة شخصية", visaMC: "فيزا/ماستركارد",
    addExchange: "إضافة منتج للتبادل (اختياري)", noExchange: "بدون تبادل",
    sendOffer: "🚀 إرسال العرض ←", offerSent: "تم إرسال العرض!",
    openCamera: "فتح الكاميرا", takePhoto: "التقط صورة",
    describeItem: "صف المنتج", kaeroAnalyzing: "كايرو يحلل…",
    kaeroPriceSugg: "اقتراح سعر كايرو", publish: "🚀 نشر → متجري",
    searchRadius: "نطاق البحث", itemsWithin: "منتجات ضمن",
    securePayment: "دفع آمن", agreement: "الاتفاق",
    voiceRecord: "تسجيل صوتي", payment: "الدفع", confirmation: "التأكيد",
    paySecurely: "🔒 ادفع بأمان", paymentSuccess: "تم الدفع بنجاح!",
    confirmCode: "رمز التأكيد", enterCode: "أدخل الرمز من البائع",
    confirmReceipt: "تأكيد الاستلام", codeInfo: "شارك هذا الرمز مع المشتري بعد التسليم",
    settings: "الإعدادات", editProfile: "تعديل الملف", notifications: "الإشعارات",
    darkMode: "الوضع الداكن", language: "اللغة", signOut: "🚪 تسجيل الخروج",
    login: "تسجيل الدخول", signup: "إنشاء حساب", email: "البريد الإلكتروني", password: "كلمة المرور",
    forgotPassword: "نسيت كلمة المرور؟", noAccount: "ليس لديك حساب؟",
    hasAccount: "لديك حساب بالفعل؟", fullName: "الاسم الكامل",
    phone: "رقم الهاتف", enterOTP: "أدخل رمز التحقق",
    otpSentPhone: "تم إرسال رمز التحقق لهاتفك", otpSentEmail: "تم إرسال رمز التحقق لبريدك",
    verifyPhone: "تحقق من الهاتف", verifyEmail: "تحقق من البريد",
    uploadID: "تحميل بطاقة الهوية", createPassword: "إنشاء كلمة مرور",
    next: "التالي ←", verify: "تحقق", submit: "إرسال", skip: "تخطي",
    welcomeBack: "مرحباً بعودتك", welcomeKaero: "مرحباً في كايرو",
    localCommerce: "تجارة محلية ذكية",
    messages: "الرسائل", online: "متصل", typeMsg: "اكتب رسالة…",
    items: "منتجات", km: "كم", egp: "ج.م", ago: "منذ",
    accept: "✓ قبول", decline: "رفض", counter: "عرض مضاد",
    analytics: "التحليلات", offers: "العروض", overview: "نظرة عامة", history: "السجل",
    quickSale: "بيع سريع", marketAvg: "متوسط السوق", maximum: "أقصى",
    all: "الكل", phones: "هواتف", laptops: "لابتوب", audio: "صوتيات",
    gaming: "ألعاب", cameras: "كاميرات", tablets: "تابلت", drones: "درون",
    arabic: "العربية", english: "English",
    price: "السعر", distance: "المسافة", rating: "التقييم",
    kaeroTips: "💡 نصائح كايرو", kaeroReady: "القائمة جاهزة من كايرو!",
    protection7day: "🛡️ حماية المشتري 7 أيام",
    account: "الحساب", preferences: "التفضيلات", kaeroSearch: "كايرو والبحث",
    payments: "المدفوعات", security: "الأمان", about: "حول",
    // v9 additions
    nearby: "بالقرب", subcategories: "فئات فرعية", featured: "مميز",
    searchAnything: "ابحث عن أي شيء: هواتف، لابتوب، PS5…",
    tapToVoiceSearch: "اضغط للبحث الصوتي", listeningSpeak: "🔴 جاري الاستماع… تحدث الآن",
    listeningTry: "🔴 جاري الاستماع: جرب \"ابحث عن ايفون ١٣ بأقل من ٢٠ ألف جنيه\"",
    noResults: "لا توجد نتائج مطابقة. جرب تعديل السعر أو المسافة.",
    verifiedPhotos: "صور موثقة", protected: "محمي",
    info: "معلومات", sellerTab: "البائع", reviewsTab: "التقييمات", safetyTab: "الأمان",
    brand: "العلامة التجارية", condition: "الحالة",
    viewStore: "عرض المتجر →", chat2: "محادثة",
    offerSentMsg: "تم إرسال عرضك إلى البائع.",
    backToItem: "← العودة للمنتج",
    makeAnOffer: "تقديم عرض",
    exchangeOffer: "عرض تبادل", tapToView: "اضغط للعرض →",
    total: "المجموع",
    safeBuyGuide: "دليل الشراء الآمن",
    meetSeller: "قابل البائع", inspectItem: "افحص المنتج",
    payViaEscrow: "ادفع عبر الضمان", confirmReceiptTitle: "تأكيد الاستلام",
    meetDesc: "قابل دائماً في مكان عام ومزدحم: مول أو كافيه أو موقف الشرطة.",
    inspectDesc: "اختبر جميع الوظائف. تحقق من الأرقام التسلسلية. تحقق من IMEI للهواتف.",
    escrowDesc: "لا تدفع نقداً قبل الفحص. استخدم ضمان كايرو، أموالك آمنة.",
    confirmDesc: "بعد الفحص، حرّر الدفع من التطبيق. الحماية تستمر 7 أيام.",
    gotItNext: "فهمت، التالي →", itemLooksGood: "المنتج جيد →",
    payWithEscrow: "ادفع عبر الضمان →", proceedPayment: "متابعة الدفع",
    sellAnItem: "بيع منتج",
    photo: "صورة", describe: "وصف", kaeroScan: "فحص كايرو",
    inAppCamera: "كاميرا التطبيق",
    orDescribeVoice: "أو صف بالصوت (عربي / إنجليزي)",
    goodLighting: "إضاءة جيدة: كايرو يتعرف أسرع",
    includeBrand: "أضف العلامة التجارية والموديل",
    voiceHelps: "الوصف الصوتي يساعد كايرو بكتابة نص أفضل",
    inAppOnly: "من التطبيق فقط: يضمن أصالة المنتج",
    photoCaptured: "تم التقاط الصورة ✓",
    letKaeroAnalyze: "🤖 دع كايرو يحلل →",
    identifyingProduct: "جاري تحديد نوع المنتج…",
    checkingPrices: "فحص أسعار السوق الحية…",
    writingDesc: "كتابة وصف محسّن…",
    finalizing: "إنهاء القائمة…",
    reviewPublish: "راجع وانشر بنقرة واحدة",
    edit: "تعديل",
    itemPublished: "تم نشر المنتج!",
    nowLive: "متاح الآن على كايرو. المشترون بالقرب منك يمكنهم رؤيته",
    publishedSuccess: "تم النشر بنجاح",
    title: "العنوان", category: "الفئة",
    listingsLabel: "المنتجات", offersLabel: "العروض", viewsLabel: "المشاهدات", ratingLabel: "التقييم",
    addNewListing: "+ إضافة منتج جديد",
    noOffersYet: "لا عروض بعد. منتجك متاح!",
    offerAccepted: "✅ تم قبول العرض · الدفع في الضمان",
    buyerInspect: "لدى المشتري 3 أيام للفحص. يتم تحرير الأموال بعد التأكيد.",
    accepted: "✅ مقبول · الدفع في الضمان", declined: "مرفوض",
    counterOffer: "عرضك المضاد (جنيه)",
    viewsThisWeek: "المشاهدات هذا الأسبوع", avgOffer: "متوسط العرض المستلم",
    conversionRate: "معدل التحويل", kaeroFairPrice: "سعر كايرو العادل",
    kaeroWatching: "كايرو يراقب من أجلك",
    basedOnSearch: "بناءً على سلوك بحثك",
    unread: "غير مقروء",
    whenMeet: "متى يمكننا المقابلة؟", priceNegotiable: "هل السعر قابل للتفاوض؟",
    canDeliver: "هل يمكنك التوصيل؟", stillAvailable: "هل لا يزال متاحاً؟",
    protectionActive: "🛡️ حماية 7 أيام نشطة",
    paymentHeld: "دفعتك محفوظة بأمان في الضمان",
    inspectDays: "3 أيام للفحص قبل تحرير الأموال",
    fullRefund: "استرداد كامل إذا اختلف المنتج عن القائمة",
    voiceRequired: "تسجيل صوتي مطلوب كدليل قانوني",
    agreeAndContinue: "موافق ومتابعة →",
    voiceAgreement: "مطلوب اتفاق صوتي",
    stateNameItem: "اذكر اسمك والمنتج والسعر المتفق عليه. هذا يحمي الطرفين.",
    tapToRecord: "اضغط لتسجيل الاتفاق",
    recording: "🔴 جاري التسجيل…",
    recordingSaved: "تم حفظ التسجيل!",
    sayAgree: "قل: 'أوافق على شراء [المنتج] بسعر [السعر] جنيه'",
    verbalCaptured: "تم التقاط الاتفاق الصوتي وتشفيره",
    continuePayment: "متابعة الدفع →",
    itemPrice: "سعر المنتج", platformFee: "رسوم المنصة (2%)",
    deliveryCode: "🔐 رمز تأكيد التسليم",
    shareCode: "شارك هذا الرمز مع المشتري بعد التسليم. يجب على المشتري إدخاله لتأكيد الاستلام.",
    buyerConfirm: "📦 المشتري: تأكيد الاستلام",
    enterDigitCode: "أدخل الرمز المكون من 6 أرقام من البائع لتأكيد استلامك للمنتج.",
    confirm: "تأكيد", codeNoMatch: "❌ الرمز غير مطابق. حاول مرة أخرى.",
    receiptConfirmed: "تم تأكيد الاستلام!",
    fundsReleased: "سيتم تحرير الأموال للبائع خلال 24 ساعة.",
    transactionId: "رقم المعاملة", amount: "المبلغ",
    escrowRelease: "تحرير الضمان", afterBuyerConfirms: "بعد تأكيد المشتري",
    disputeDeadline: "الموعد النهائي للنزاع", hoursAfter: "72 ساعة بعد الاستلام",
    backHome: "← العودة للرئيسية",
    myProfile: "ملفي الشخصي", memberSince: "عضو منذ يناير 2024",
    totalSales: "إجمالي المبيعات", activeListings: "المنتجات النشطة",
    avgSale: "متوسط البيع ج.م", responseRate: "معدل الاستجابة",
    trustBreakdown: "🛡️ تفاصيل نقاط الثقة",
    successfulTx: "المعاملات الناجحة", positiveReviews: "التقييمات الإيجابية",
    responseSpeed: "سرعة الاستجابة", noDisputes: "بدون نزاعات",
    verificationStatus: "حالة التوثيق",
    phoneNumber2: "رقم الهاتف", nationalId: "بطاقة الهوية",
    voiceSample: "عينة صوتية", notVerified: "غير موثق",
    sold: "تم البيع", bought: "تم الشراء",
    pushNotifications: "الإشعارات الفورية", offersDeals: "العروض والصفقات والنشاط",
    onRecommended: "مفعّل (موصى به)", off: "متوقف",
    arabicInterface: "الواجهة العربية",
    currency: "العملة",
    defaultSearchRadius: "نطاق البحث الافتراضي",
    listingsWithin: "المنتجات ضمن", shownFirst: "تظهر أولاً",
    kaeroPriceSuggestions: "اقتراحات أسعار كايرو", autoPrice: "تسعير تلقائي لمنتجاتك",
    kaeroSmartNotifs: "إشعارات كايرو الذكية", alertsBehavior: "تنبيهات بناءً على سلوكك",
    voiceSearchLang: "لغة البحث الصوتي",
    paymentMethods: "طرق الدفع",
    escrowWalletLabel: "محفظة الضمان", available: "متاح",
    transactionHistory: "سجل المعاملات", showingLast: "عرض آخر 30 معاملة",
    twoFa: "المصادقة الثنائية", smsAuth: "SMS + مصادقة",
    biometricLogin: "تسجيل دخول بيومتري", faceId: "Face ID / بصمة",
    changePassword: "تغيير كلمة المرور",
    termsOfService: "شروط الخدمة", privacyPolicy: "سياسة الخصوصية",
    rateKaero: "قيّم كايرو على المتجر", contactSupport: "اتصل بالدعم",
    liveChat: "محادثة مباشرة · عربي وإنجليزي",
    identityVerification: "توثيق الهوية",
    voiceVerification: "التحقق الصوتي",
    addPaymentMethod: "+ إضافة طريقة دفع",
    changePw: "تغيير كلمة المرور",
    saveChanges: "حفظ التغييرات", changePhoto: "تغيير الصورة",
    name: "الاسم", bio: "النبذة", location: "الموقع",
    profileSaved: "تم حفظ الملف ✅",
    kaeroVerified: "موثق من كايرو", trusted: "موثوق",
    powerSeller: "بائع متميز",
    allScreens: "جميع الشاشات", techSpec: "المواصفات",
    mapVoice: "خريطة + صوت",
    instant: "فوري", within1hr: "خلال ساعة",
    visa: "فيزا / ماستركارد", vodafoneCash: "فودافون كاش",
    fawryCash: "فوري كاش", instaPay: "إنستاباي",
    auto: "تلقائي",
    back: "← رجوع",
    idUploaded: "تم تحميل الهوية ✓", tapToUpload: "اضغط للتحميل",
    uploadIdDesc: "حمّل بطاقة هويتك الوطنية للتوثيق",
    strongPassword: "أنشئ كلمة مرور قوية",
    searchMarketVoice: "ابحث في السوق بالصوت…",
    kaeroAutoIdentify: "🤖 كايرو سيتعرف على منتجك تلقائياً",
    identifyingCondition: "تحديد المنتج والحالة والسعر العادل",
    orDescribeItem: "أو صف بالصوت",
    listeningDescribe: "🔴 جاري الاستماع… صف منتجك",
    // additional full i18n keys
    chooseProfilePhoto: "اختر صورة ملفك الشخصي",
    yourFullName: "اسمك الكامل",
    description: "الوصف",
    viewStore2: "عرض المتجر",
    verified2: "موثّق",
    trustScore2: "درجة الثقة",
    verifiedSeller: "بائع موثّق",
    sellerInfo: "معلومات البائع",
    safe: "آمن",
    noExchange2: "بدون تبديل",
    paymentMethod2: "طريقة الدفع",
    exchangeItem: "عنصر التبديل",
    makeAnOfferBtn: "قدّم عرض",
    sold2: "تم البيع",
    sold3: "مباع",
    bought2: "مشترى",
    default2: "افتراضي",
    featuredLabel: "مميز",
    allCategoriesLabel: "جميع الفئات",
    featuredNearYouLabel: "مميز بالقرب منك",
    voiceAgreementReq: "مطلوب اتفاق صوتي",
    stateNameItem2: "اذكر اسمك والمنتج والسعر المتفق عليه. هذا يحمي الطرفين.",
    tapToRecord2: "اضغط لتسجيل الاتفاق",
    recordingSaved2: "تم حفظ التسجيل!",
    verbalCaptured2: "تم التقاط الاتفاق الصوتي وتشفيره",
    sayAgree2: "قل: 'أوافق على شراء [المنتج] بسعر [السعر] جنيه'",
    paymentSuccess2: "تمت عملية الدفع بنجاح!",
    paymentHeldEscrow: "دفعتك محفوظة بأمان في الضمان. لديك 3 أيام لفحص المنتج.",
    deliveryCode2: "🔐 رمز تأكيد التسليم",
    shareCodeDesc: "شارك هذا الرمز مع المشتري بعد التسليم. يجب على المشتري إدخاله لتأكيد الاستلام.",
    buyerConfirm2: "📦 المشتري: تأكيد الاستلام",
    enterCodeDesc: "أدخل الرمز المكون من 6 أرقام من البائع لتأكيد استلام المنتج.",
    codeNoMatch2: "❌ الرمز غير مطابق. حاول مرة أخرى.",
    receiptConfirmed2: "تم تأكيد الاستلام!",
    fundsReleased2: "سيتم تحويل الأموال للبائع خلال 24 ساعة.",
    transactionId2: "رقم المعاملة",
    amount2: "المبلغ",
    escrowRelease2: "تحرير الضمان",
    afterBuyerConfirms2: "بعد تأكيد المشتري",
    disputeDeadline2: "موعد النزاع",
    hoursAfter2: "72 ساعة بعد الاستلام",
    backToHome: "← العودة للرئيسية",
    verificationStatus2: "حالة التوثيق",
    phoneNumber3: "رقم الهاتف",
    nationalId2: "الهوية الوطنية",
    voiceSample2: "عينة صوتية",
    email2: "البريد الإلكتروني",
    verified3: "موثّق",
    notVerified2: "غير موثّق",
    editProfile2: "تعديل الملف الشخصي",
    changePhoto2: "تغيير الصورة",
    name2: "الاسم",
    bio2: "النبذة",
    saveChanges2: "حفظ التغييرات",
    profileSaved2: "تم حفظ الملف ✅",
    pushNotifs: "الإشعارات",
    offersDealsActivity: "العروض والصفقات والنشاط",
    currency2: "العملة",
    defaultSearchRadius2: "نطاق البحث الافتراضي",
    listingsWithin2: "المنتجات ضمن",
    shownFirst2: "تظهر أولاً",
    voiceSearchLang2: "لغة البحث الصوتي",
    paymentMethods2: "طرق الدفع",
    escrowWalletLabel2: "محفظة الضمان",
    available2: "متاح",
    twoFa2: "المصادقة الثنائية",
    smsAuth2: "رسالة + تطبيق المصادقة",
    biometricLogin2: "تسجيل بيومتري",
    faceId2: "بصمة الوجه / الإصبع",
    changePassword2: "تغيير كلمة المرور",
    signOut2: "🚪 تسجيل الخروج",
    kaeroVersion: "Kaero v10.0.0 · القاهرة، مصر",
    kaeroWatching2: "كايرو يراقب لك",
    basedOnSearch2: "بناءً على سلوك البحث الخاص بك",
    addPaymentMethod2: "+ إضافة طريقة دفع",
    searchRadius2: "نطاق البحث",
    itemsWithin2: "المنتجات ضمن",
    accept2: "قبول",
    decline2: "رفض",
    counter2: "عرض مضاد",
    counterOffer2: "عرضك المضاد (جنيه)",
    noOffersYet2: "لا عروض بعد. منتجك متاح!",
    accepted2: "مقبول",
    declined2: "مرفوض",
    viewsThisWeek2: "المشاهدات هذا الأسبوع",
    avgOffer2: "متوسط العرض المستلم",
    conversionRate2: "معدل التحويل",
    kaeroFairPrice2: "سعر كايرو العادل",
    addNewListing2: "+ إضافة منتج جديد",
    rateKaero2: "قيّم كايرو",
    yourFeedback: "تقييمك يساعدنا على التحسين",
    yourKaeroStats: "📊 إحصائياتك على كايرو",
    yourRating: "تقييمك",
    income: "الدخل (جنيه)",
    totalSales2: "إجمالي المبيعات",
    recentUserRatings: "🌟 تقييمات المستخدمين الأخيرة",
    submitRating: "إرسال التقييم",
    totalIncome: "إجمالي الدخل (جنيه)",
    transactions: "المعاملات",
    phone2: "📞 الهاتف",
    email3: "📧 البريد الإلكتروني",
    supportHours: "🕐 ساعات الدعم",
    satToThu: "السبت إلى الخميس: 9:00 صباحاً إلى 9:00 مساءً",
    friday: "الجمعة: 2:00 ظهراً إلى 9:00 مساءً",
    cairoTimezone: "القاهرة، مصر (توقيت شرق أوروبا)",
    weRespond: "نرد خلال 24 ساعة",
    available9to9: "متاح من 9 صباحاً إلى 9 مساءً (بتوقيت القاهرة)",
    itemPrice2: "سعر المنتج",
    platformFee2: "رسوم المنصة (2%)",
    total2: "الإجمالي",
    paySecurely2: "🔒 ادفع بأمان",
    addItem2: "+ إضافة منتج",
    kaeroPriceSuggLabel: "اقتراح سعر كايرو",
    quickSale2: "بيع سريع",
    marketAvg2: "متوسط السوق",
    maximum2: "الأقصى",
    photoCaptured2: "تم التقاط الصورة ✓",
    inAppCamera2: "كاميرا التطبيق",
    kaeroListingReady: "إعلان كايرو جاهز!",
    reviewPublish2: "راجع وانشر بنقرة واحدة",
    itemPublishedSuccess: "تم نشر المنتج بنجاح",
    nowLiveKaero: "متاح الآن على كايرو. المشترون بالقرب منك يمكنهم رؤيته",
    openCamera2: "فتح الكاميرا",
    takePhoto2: "التقاط صورة",
    inAppOnlyGuarantee: "من التطبيق فقط: يضمن أصالة المنتج",
    describeYourItem: "صف منتجك",
    orDescVoice: "أو صف بالصوت",
    kaeroAnalyzing2: "كايرو يحلل…",
    identifyingCond: "تحديد المنتج والحالة والسعر العادل",
    kaeroTips2: "💡 نصائح كايرو",
    sellAnItem2: "بيع منتج",
    photoLabel: "صورة",
    describeLabel: "وصف",
    kaeroScanLabel: "فحص كايرو",
    publishLabel: "نشر",
    protection7dayActive: "🛡️ حماية المشتري 7 أيام",
    d1: "ي1",
    d1Desc: "تم استلام الدفع وحفظه في الضمان",
    d1d3: "ي1 إلى ي3",
    d1d3Desc: "نافذة فحص 3 أيام للمشتري",
    d3: "ي3",
    d3Desc: "موعد النزاع: مطلوب تقرير شرطة",
    d7: "ي7",
    d7Desc: "الحل والدفع التلقائي للبائع",
    speakArabicEnglish: "تحدث بالعربية أو الإنجليزية. كايرو يفهم المنتج والسعر والمسافة والموقع",
    understandsFields: "يفهم: اسم المنتج · أقصى سعر · المسافة · اللون · الموقع",
    meetSeller2: "قابل البائع",
    inspectItem2: "افحص المنتج",
    payViaEscrow2: "ادفع عبر الضمان",
    confirmReceipt2: "تأكيد الاستلام",
    meetDesc2: "قابل دائماً في مكان عام ومزدحم: مول أو كافيه أو موقف الشرطة. لا تقابل في منازل خاصة.",
    inspectDesc2: "اختبر جميع الوظائف. تحقق من الأرقام التسلسلية. تحقق من IMEI للهواتف. خذ وقتك.",
    escrowDesc2: "لا تدفع نقداً قبل الفحص. استخدم ضمان كايرو، أموالك آمنة حتى تأكيد الاستلام.",
    confirmDesc2: "بعد الفحص، حرّر الدفع من التطبيق. كلا الطرفين يحصلان على طلب تقييم. حمايتك 7 أيام.",
    gotItNext2: "فهمت، التالي →",
    itemLooksGood2: "المنتج جيد →",
    payWithEscrow2: "ادفع عبر الضمان →",
    proceedPayment2: "متابعة الدفع",
    accountSection: "الحساب",
    preferencesSection: "التفضيلات",
    kaeroSearchSection: "كايرو والبحث",
    paymentsSection: "المدفوعات",
    securitySection: "الأمان",
  }
};

/* ══════════════════════════════════════════════════════════════
   KAERO — "CAIRO TRUST" PALETTE

   Trust & Security · AI Innovation · Community Warmth · Efficiency

   ① #0E0D0D / #F5F8FA  Background — deep/light base
   ② #1E2124 / #FFFFFF   Surface — cards, panels
   ③ #FFFFFF / #000000   Text — primary
   ④ #6F787E             Muted — secondary / disabled
   ⑤ #2979FF             Accent — actions, links, info
   ⑥ #019F45             Green — logo green, trust, buy, verified, success (light + dark)

   Law:
   · Emerald  = trust signal (buy, sell, confirm, verified ✓)
   · Cyan     = attention/CTA (prices, voice AI, quick actions)
   · Indigo   = intelligence layer (AI, map, analytics, Kaero brain)
   · Teal     = community / local (radius, distance, neighborhood)
   · Amber    = pending / escrow hold
   · Rose     = fraud / dispute / danger
══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   KAERO — COLOR SYSTEM
   ① bg      dark:#0D0F0D   light:#F4F6F4  — near-black greenish / off-white
   ② surface dark:#181A18   light:#FFFFFF  — card dark / card light
   ③ text    dark:#FFFFFF   light:#0D0F0D  — primary text
   ④ muted   dark:#6B7270   light:#8A9290  — secondary / disabled
   ⑤ gold    #C8961A  — Top Seller, star ratings, seller tiers, escrow badge
   ⑥ green   #019F45  — logo green, buy/sell, verified, prices, active nav
   ⑦ cyan    #00B4FF  — AI/voice, Kaero scan, map/distance, filters, chat ticks
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   KAERO v38 — OFFICIAL COLOR SYSTEM 2026
   Primary:   Kaero Green  #019F45  — brand, buttons, trust, prices, nav active
   Secondary: Slate        #475569  — secondary buttons, metadata, support text
   Accent:    Warm Teal     #14B8A6  — CTAs, AI/voice features, notifications
   Neutral1:  Pure White   #FFFFFF  — backgrounds (light), cards, text (dark)
   Neutral2:  Off-Black    #0F172A  — text (light), backgrounds (dark), depth
   Neutral3:  Soft Gray    #F1F5F9  — surfaces, dividers, hover, inputs
═══════════════════════════════════════════════════════════ */
const THEMES = {
  dark: {
    // ── OFF-BLACK BASE — balanced, warm-neutral, comfortable ──
    bg:       "#0F172A",   // Off-Black — anchor, unchanged
    surface:  "#162332",   // Gentle lift — warm-neutral card surfaces
    card:     "#162332",   // Gentle lift — cards
    cardHi:   "#1D2C3E",   // Elevated card — hover/active
    cardTop:  "#26374C",   // Inputs / dividers
    border:   "#34465D",   // Soft but visible border
    border2:  "#445870",   // Stronger border

    text:   "#FFFFFF",     // Pure White — primary text
    text2:  "#9CB2C6",     // Warm-neutral secondary — comfortable reading
    muted:  "#607890",     // Balanced muted — not too dim
    muted2: "#162332",     // bg muted

    // ── PRIMARY: KAERO GREEN ──
    green:     "#019F45",
    green2:    "#019F45",
    greenDim:  "rgba(1,159,69,.15)",
    greenGlow: "rgba(1,159,69,.30)",

    // ── ACCENT: WARM TEAL (AI/CTA/Voice features) ──
    accent:     "#2DD4BF",   // Warm teal accent for dark mode
    accentDim:  "rgba(45,212,191,.15)",
    accentGlow: "rgba(45,212,191,.32)",

    // ── CYAN (alias = accent in dark) ──
    cyan:      "#2DD4BF",
    cyanDim:   "rgba(45,212,191,.15)",
    cyanGlow:  "rgba(45,212,191,.30)",

    // ── LEGACY ALIASES — mapped to Kaero palette ──
    indigo:    "#2DD4BF", indigoDim: "rgba(45,212,191,.15)", indigoGlow: "rgba(45,212,191,.32)",
    teal:      "#019F45", tealDim:   "rgba(1,159,69,.15)", tealGlow:   "rgba(1,159,69,.30)",
    blue:      "#2DD4BF", blueDim:   "rgba(45,212,191,.15)", blueGlow:   "rgba(45,212,191,.30)",
    gold:      "#019F45", goldDim:   "rgba(1,159,69,.15)", goldGlow:   "rgba(1,159,69,.30)",
    purple:    "#2DD4BF", purpleDim: "rgba(45,212,191,.15)", purpleGlow: "rgba(45,212,191,.32)",
    coral:     "#2DD4BF", coralDim:  "rgba(45,212,191,.15)",
    error:     "#EF4444", errorDim:  "rgba(239,68,68,.15)",  errorGlow:  "rgba(239,68,68,.30)",
    warning:   "#F59E0B", warningDim:"rgba(245,158,11,.15)",
    neonPink:  "#2DD4BF", orange:    "#019F45",

    shadow:       "rgba(0,0,0,.45)",
    shadowSm:     "rgba(0,0,0,.22)",
    topBarBg:     "rgba(15,23,42,.96)",
    topBarText:   "#FFFFFF",
    topBarBorder: "#34465D",
    glass:        "rgba(22,35,50,.88)",
    glassStrong:  "rgba(22,35,50,.97)",
    glassBorder:  "#34465D",
    glassShadow:  "0 8px 32px rgba(0,0,0,.40)",
  },
  light: {
    // ── PURE WHITE BASE — clean, premium, airy ──
    bg:       "#F1F5F9",   // Soft Gray — main background
    surface:  "#FFFFFF",   // Pure White — card surfaces
    card:     "#FFFFFF",   // Pure White — cards
    cardHi:   "rgba(1,159,69,.06)",  // Green-tinted hover
    cardTop:  "rgba(15,23,42,.04)",    // Off-Black tinted inputs
    border:   "#E2E8F0",   // Slate-200 — subtle border
    border2:  "#CBD5E1",   // Slate-300 — stronger border

    text:   "#0F172A",     // Off-Black — primary text (AAA contrast)
    text2:  "#475569",     // Slate — secondary text (AAA contrast)
    muted:  "#94A3B8",     // Slate-400 — muted text
    muted2: "#F1F5F9",     // Soft Gray — bg muted

    // ── PRIMARY: KAERO GREEN ──
    green:     "#019F45",
    green2:    "#017A35",   // Even darker hover
    greenDim:  "rgba(1,159,69,.10)",
    greenGlow: "rgba(1,159,69,.20)",

    // ── ACCENT: WARM TEAL ──
    accent:     "#14B8A6",   // Warm teal accent for light mode
    accentDim:  "rgba(22,184,166,.10)",
    accentGlow: "rgba(22,184,166,.20)",

    // ── CYAN (alias = accent in light) ──
    cyan:      "#14B8A6",
    cyanDim:   "rgba(22,184,166,.10)",
    cyanGlow:  "rgba(22,184,166,.20)",

    // ── LEGACY ALIASES — mapped to Kaero palette ──
    indigo:    "#14B8A6", indigoDim: "rgba(22,184,166,.10)", indigoGlow: "rgba(22,184,166,.20)",
    teal:      "#019F45", tealDim:   "rgba(1,159,69,.10)", tealGlow:  "rgba(1,159,69,.20)",
    blue:      "#14B8A6", blueDim:   "rgba(22,184,166,.10)",  blueGlow:  "rgba(22,184,166,.20)",
    gold:      "#019F45", goldDim:   "rgba(1,159,69,.10)", goldGlow:  "rgba(1,159,69,.20)",
    purple:    "#14B8A6", purpleDim: "rgba(22,184,166,.10)",  purpleGlow:"rgba(22,184,166,.20)",
    coral:     "#14B8A6", coralDim:  "rgba(22,184,166,.10)",
    error:     "#EF4444", errorDim:  "rgba(239,68,68,.10)",  errorGlow: "rgba(239,68,68,.18)",
    warning:   "#F59E0B", warningDim:"rgba(245,158,11,.10)",
    neonPink:  "#14B8A6", orange:    "#019F45",

    shadow:       "rgba(15,23,42,.08)",
    shadowSm:     "rgba(15,23,42,.04)",
    topBarBg:     "rgba(255,255,255,.98)",
    topBarText:   "#0F172A",
    topBarBorder: "#E2E8F0",
    glass:        "rgba(255,255,255,.82)",
    glassStrong:  "rgba(255,255,255,.97)",
    glassBorder:  "#E2E8F0",
    glassShadow:  "0 8px 32px rgba(15,23,42,.07)",
  }
};

/* helper — resolves current theme. Reassigned synchronously in KaeroApp render. */
let G = { ...THEMES.dark };

/* ── Official Kaero Logo (green K with leaf shapes + AERO wordmark) ── */
const KAERO_LOGO_B64 = "https://placehold.co/400x400/019F45/white?text=Kaero";

const Logo = ({ size = 28, dark = true }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.08 }}>
    <img
      src={KAERO_LOGO_B64}
      alt="K"
      style={{
        width: size, height: size,
        objectFit: "contain", display: "block",
        borderRadius: size * 0.12,
        background: dark ? "transparent" : "#FFFFFF",
      }}
    />
    <span style={{
      fontSize: size * 0.62, fontWeight: 900,
      letterSpacing: "-0.4px",
      fontFamily: "'Outfit','Inter',-apple-system,sans-serif",
      color: dark ? "#FFFFFF" : "#000000",
      lineHeight: 1,
    }}>aero</span>
  </div>
);

/* ── K-only logo mark (no wordmark) ── */
const LogoK = ({ size = 28, dark = true }) => (
  <img
    src={KAERO_LOGO_B64}
    alt="K"
    style={{
      width: size, height: size,
      objectFit: "contain", display: "block",
      borderRadius: size * 0.12,
      background: dark ? "transparent" : "#FFFFFF",
    }}
  />
);

/* ── SVG ICON SYSTEM — replaces all emojis for a clean consistent look ── */
const Icon = {
  Home: ({ size = 20, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <polyline points="9,21 9,12 15,12 15,21"/>
    </svg>
  ),
  Market: ({ size = 20, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  Plus: ({ size = 24, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Chat: ({ size = 20, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  Profile: ({ size = 20, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Bell: ({ size = 18, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  ),
  Settings: ({ size = 18, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
  Cart: ({ size = 20, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.57l1.65-7.43H6"/>
    </svg>
  ),
  Tag: ({ size = 20, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  Pin: ({ size = 14, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Phone: ({ size = 14, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.5a19.79 19.79 0 01-3.07-8.67A2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.29 6.29l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  Store: ({ size = 18, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1-6h16l1 6"/>
      <path d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0"/>
      <path d="M5 9v12h14V9"/>
      <rect x="9" y="14" width="6" height="7"/>
    </svg>
  ),
  Eye: ({ size = 12, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Msg: ({ size = 12, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  Shield: ({ size = 14, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Back: ({ size = 20, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15,18 9,12 15,6"/>
    </svg>
  ),
  Search: ({ size = 18, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Mic: ({ size = 18, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
      <path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  Camera: ({ size = 18, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  Map: ({ size = 18, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/>
      <line x1="8" y1="2" x2="8" y2="18"/>
      <line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  ),
  Fire: ({ size = 14, col = G.green }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={col}>
      <path d="M12 2C12 2 8 6 8 10c0 1.5.5 2.8 1.3 3.8C8.5 13 8 11.5 8 10c-2 2-3 4.5-3 7a7 7 0 0014 0c0-4-2.5-7.5-7-15z"/>
    </svg>
  ),
  Star: ({ size = 12, col = G.cyan }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={col}>
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
    </svg>
  ),
  Wallet: ({ size = 20, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
      <path d="M16 14a2 2 0 100-4 2 2 0 000 4z" fill={col}/>
      <path d="M16 3v4"/>
    </svg>
  ),
  ChevronRight: ({ size = 16, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9,18 15,12 9,6"/>
    </svg>
  ),
  Check: ({ size = 12, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  ),
  Moon: ({ size = 14, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  ),
  Sun: ({ size = 14, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  Insights: ({ size = 18, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
    </svg>
  ),
  Trend: ({ size = 14, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
      <polyline points="17,6 23,6 23,12"/>
    </svg>
  ),
  Zap: ({ size = 14, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={col}>
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
    </svg>
  ),
  Target: ({ size = 14, col = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
};

/* ── Atoms ── */
const Stars = ({ n = 4.8, size = 12 }) => (
  <span style={{ color: G.cyan, fontSize: size, letterSpacing: -.5, whiteSpace: "nowrap" }}>
    {"★".repeat(Math.floor(n))}
    <span style={{ color: G.muted2 }}>{"★".repeat(5 - Math.floor(n))}</span>
    <span style={{ color: G.muted, fontSize: size - 1, marginLeft: 3 }}>{n}</span>
  </span>
);

const Chip = ({ children, col = G.green, sm, onClick, active }) => (
  <span onClick={onClick} style={{
    display: "inline-flex", alignItems: "center", gap: 3,
    background: active ? col : col + "22",
    color: active ? "#fff" : col,
    border: `1.5px solid ${col}${active ? "" : "38"}`,
    borderRadius: 99, padding: sm ? "3px 9px" : "5px 13px",
    fontSize: sm ? 10 : 12, fontWeight: 700, letterSpacing: .3,
    cursor: onClick ? "pointer" : "default", whiteSpace: "nowrap", transition: "all .15s",
  }}>{children}</span>
);

const Btn = ({ children, col = G.green, outline, full, small, onClick, disabled, style: s = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: full ? "100%" : "auto",
    background: disabled ? G.border2 : outline ? "transparent" : `linear-gradient(135deg, ${col}, ${col}dd)`,
    border: `1.5px solid ${disabled ? G.border2 : outline ? col + '44' : 'transparent'}`,
    borderRadius: 16, padding: small ? "10px 18px" : "14px 22px",
    color: disabled ? G.muted : outline ? col : "#fff",
    fontWeight: 700, fontSize: small ? 13 : 14, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'Outfit',inherit", letterSpacing: .2, transition: "all .2s",
    boxShadow: disabled || outline ? "none" : `0 4px 16px ${col}33`, ...s,
  }}>{children}</button>
);

const Av = ({ letter, size = 40, col = G.green, img }) => img ? (
  <img src={img} style={{
    width: size, height: size, borderRadius: "50%", objectFit: "cover",
    border: `2px solid ${col}50`, flexShrink: 0
  }} onError={e => { e.target.style.display = "none"; }} />
) : (
  <div style={{
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    background: `linear-gradient(135deg, ${col}33, ${col}18)`,
    border: `2px solid ${col}44`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 900, fontSize: size / 2.5, color: col
  }}>
    {letter}
  </div>
);

const ProductImg = ({ src, size = 64, radius = 12 }) => (
  <div style={{
    width: size, height: size, borderRadius: radius, overflow: "hidden",
    background: G.cardHi, border: `1px solid ${G.border}`, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * .35
  }}>
    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
      onError={e => e.target.style.display = "none"} />
  </div>
);

/* TopBar with glassmorphism */
const TopBar = ({ title, onBack, onHome, right }) => (
  <div style={{
    background: G.topBarBg, backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    padding: "12px 16px",
    borderBottom: `1px solid ${G.topBarBorder}`,
    display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
  }}>
    {onBack && (
      <button onClick={onBack} style={{
        width: 36, height: 36, borderRadius: 12,
        background: G.glass, border: `1px solid ${G.glassBorder}`,
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: G.text, flexShrink: 0
      }}><Icon.Back size={18} col={G.text} /></button>
    )}
    <div style={{ fontSize: 17, fontWeight: 700, color: G.text, flex: 1, fontFamily: "'Outfit',inherit", letterSpacing: -.3 }}>{title}</div>
    {onHome && (
      <button onClick={onHome} style={{
        width: 34, height: 34, borderRadius: 12,
        background: G.greenDim, border: `1px solid ${G.green}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", flexShrink: 0, color: G.green
      }}><Icon.Home size={16} col={G.green} /></button>
    )}
    {right}
  </div>
);

/* Badge for notifications */
const Badge = ({ n }) => n > 0 ? (
  <div style={{
    position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%",
    background: G.green, border: `2px solid ${G.bg}`, display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#fff"
  }}>{n > 9 ? "9+" : n}</div>
) : null;

/* ── Section Header ── */
const SH = ({ title, action, onAction }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: G.text, fontFamily: "'Outfit',inherit", letterSpacing: -.2 }}>{title}</div>
    {action && <button onClick={onAction} style={{
      fontSize: 11, fontWeight: 600, color: G.green,
      background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit',inherit"
    }}>{action}</button>}
  </div>
);

/* ── Monochrome Icon — wraps emoji in desaturated muted style ── */
const Ic = ({ children, size = 16, style: s = {} }) => (
  <span className="emoji-mono" style={{ fontSize: size, lineHeight: 1, ...s }}>{children}</span>
);

/* ── Filter Pill Row ── */
const FilterRow = ({ options, value, onChange }) => (
  <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
    {options.map(o => (
      <button key={o.v} onClick={() => onChange(o.v)} style={{
        flexShrink: 0,
        background: value === o.v ? G.green : G.cardHi,
        border: `1px solid ${value === o.v ? G.green : G.border}`,
        borderRadius: 99, padding: "6px 13px", cursor: "pointer",
        fontSize: 11, fontWeight: 700,
        color: value === o.v ? "#fff" : G.text2, fontFamily: "inherit", transition: "all .15s",
        boxShadow: value === o.v ? `0 2px 8px ${G.green}55` : "none",
      }}>{o.l}</button>
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════════════════ */
/* ── SELLER PORTRAITS — real photos for seller avatars ── */
const SELLER_IMGS = {
  "A":  "https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=200&q=80",
  "S":  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
  "O":  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80",
  "N":  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80",
  "K":  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
  "AR": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
  "Z":  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80",
  "L":  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
  "Y":  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
};

const PRODUCTS = [
  {
    id: 1, name: "iPhone 15 Pro Max", brand: "Apple", price: 32000, km: 0.3, rating: 4.9, reviews: 127, condition: "Like New",
    img: "https://placehold.co/400x400/019F45/white?text=Kaero",
    seller: "Ahmed K.", sellerRating: 4.9, sellerReviews: 127, sellerTrust: 96, sellerId: "A",
    sellerImg: "https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=200&q=80",
    desc: "256GB Natural Titanium. 4 months old, full warranty remaining. Pristine screen, minor edge wear.",
    category: "phones"
  },
  {
    id: 2, name: "MacBook Pro M3 14\"", brand: "Apple", price: 68000, km: 1.2, rating: 4.8, reviews: 54, condition: "Excellent",
    img: "https://placehold.co/400x400/019F45/white?text=Kaero",
    seller: "Sara M.", sellerRating: 4.7, sellerReviews: 89, sellerTrust: 91, sellerId: "S",
    sellerImg: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
    desc: "16GB RAM, 512GB SSD, Space Gray. Barely used, purchased for a project that got cancelled.",
    category: "computers"
  },
  {
    id: 3, name: "Sony WH-1000XM5", brand: "Sony", price: 8500, km: 0.8, rating: 4.8, reviews: 64, condition: "Good",
    img: "https://placehold.co/400x400/019F45/white?text=Kaero",
    seller: "Omar F.", sellerRating: 4.8, sellerReviews: 64, sellerTrust: 88, sellerId: "O",
    sellerImg: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80",
    desc: "Noise-cancelling over-ear headphones. Works flawlessly, comes with original case and cable.",
    category: "audio"
  },
  {
    id: 4, name: "Canon EOS R50", brand: "Canon", price: 18000, km: 2.1, rating: 4.6, reviews: 43, condition: "Like New",
    img: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400&q=80",
    seller: "Nour A.", sellerRating: 4.6, sellerReviews: 43, sellerTrust: 85, sellerId: "N",
    sellerImg: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80",
    desc: "Mirrorless with 18-45mm kit lens. Only 200 shutter actuations, all accessories included.",
    category: "cameras"
  },
  {
    id: 5, name: "iPad Pro 12.9\" M2", brand: "Apple", price: 38000, km: 0.8, rating: 4.9, reviews: 88, condition: "Like New",
    img: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&q=80",
    seller: "Karim H.", sellerRating: 5.0, sellerReviews: 200, sellerTrust: 99, sellerId: "K",
    sellerImg: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
    desc: "WiFi+Cellular, 256GB. Apple Pencil 2nd gen included. Screen protector applied from day 1.",
    category: "tablets"
  },
  {
    id: 6, name: "PS5 Console + 2 Games", brand: "Sony", price: 28000, km: 0.5, rating: 4.9, reviews: 55, condition: "Excellent",
    img: "https://placehold.co/400x400/019F45/white?text=Kaero",
    seller: "Ahmed R.", sellerRating: 4.8, sellerReviews: 76, sellerTrust: 93, sellerId: "AR",
    sellerImg: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
    desc: "Disc version, includes Spider-Man 2 and God of War Ragnarok. Perfect condition.",
    category: "gaming"
  },
  {
    id: 7, name: "DJI Mini 4 Pro", brand: "DJI", price: 25000, km: 3.4, rating: 4.7, reviews: 31, condition: "Like New",
    img: "https://placehold.co/400x400/019F45/white?text=Kaero",
    seller: "Ziad M.", sellerRating: 4.7, sellerReviews: 52, sellerTrust: 87, sellerId: "Z",
    sellerImg: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80",
    desc: "With RC2 controller. Only 5 flights total. All original accessories and ND filter set.",
    category: "drones"
  },
  {
    id: 8, name: "Samsung Galaxy S24 Ultra", brand: "Samsung", price: 29000, km: 1.7, rating: 4.7, reviews: 62, condition: "Good",
    img: "https://placehold.co/400x400/019F45/white?text=Kaero",
    seller: "Layla S.", sellerRating: 4.5, sellerReviews: 31, sellerTrust: 82, sellerId: "L",
    sellerImg: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
    desc: "512GB Titanium Black, S-Pen included. Tiny scratch on back visible under direct light only.",
    category: "phones"
  },
];

const MY_STORE = [
  {
    id: 101, name: "iPhone 13 Pro", brand: "Apple", price: 17000, km: 0, rating: 4.7, condition: "Good", sold: false,
    img: "https://placehold.co/400x400/019F45/white?text=Kaero",
    views: 234, aiPrice: 16800,
    offers: [
      { id: 1, buyer: "Youssef M.", av: "Y", avImg: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80", price: 16000, km: 1.2, rating: 4.9, reviews: 87, note: "Cash ready, can meet today at City Stars.", exchange: null, time: "2m ago" },
      { id: 2, buyer: "Lina K.", av: "L", avImg: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80", price: 13800, km: 3.1, rating: 4.6, reviews: 43, note: "AirPods Pro worth 3,200 EGP + 13,800 cash = 17,000 total.", exchange: "AirPods Pro 3rd Gen", exchangeImg: "https://images.unsplash.com/photo-1588423771073-b8903fead85b?w=100&q=60", exchangeVal: 3200, time: "15m ago" },
      { id: 3, buyer: "Omar F.", av: "O", avImg: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80", price: 15500, km: 0.8, rating: 4.8, reviews: 121, note: "Best time is evening. Very serious buyer.", exchange: null, time: "1h ago" },
    ]
  },
  {
    id: 102, name: "Sony WH-1000XM5", brand: "Sony", price: 8500, km: 0, rating: 4.8, condition: "Good", sold: false,
    img: "https://placehold.co/400x400/019F45/white?text=Kaero",
    views: 167, aiPrice: 8200,
    offers: [
      { id: 1, buyer: "Karim H.", av: "K", avImg: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80", price: 8000, km: 0.5, rating: 5.0, reviews: 200, note: "Want ASAP, very motivated buyer!", exchange: null, time: "30m ago" },
      { id: 2, buyer: "Sara B.", av: "S", avImg: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80", price: 3500, km: 2.2, rating: 4.5, reviews: 34, note: "iPad mini worth 5,000 EGP + 3,500 cash = 8,500 total.", exchange: "iPad mini 6 (64GB)", exchangeImg: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=100&q=60", exchangeVal: 5000, time: "2h ago" },
    ]
  },
  {
    id: 103, name: "MacBook Air M2", brand: "Apple", price: 45000, km: 0, rating: 4.9, condition: "Like New", sold: true,
    img: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=300&q=80",
    views: 389, aiPrice: 44500, offers: []
  },
  {
    id: 104, name: "Samsung 4K TV 55\"", brand: "Samsung", price: 22000, km: 0, rating: 4.5, condition: "Good", sold: false,
    img: "https://placehold.co/400x400/019F45/white?text=Kaero",
    views: 89, aiPrice: 21000,
    offers: [
      { id: 1, buyer: "Nour A.", av: "N", avImg: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80", price: 20000, km: 3.0, rating: 4.4, reviews: 19, note: "Need delivery included please.", exchange: null, time: "4h ago" },
    ]
  },
  {
    id: 105, name: "PS5 Console", brand: "Sony", price: 28000, km: 0, rating: 4.9, condition: "Excellent", sold: false,
    img: "https://placehold.co/400x400/019F45/white?text=Kaero",
    views: 312, aiPrice: 27500,
    offers: [
      { id: 1, buyer: "Ahmed R.", av: "A", avImg: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80", price: 27000, km: 0.4, rating: 4.8, reviews: 76, note: "Meet at Carrefour City Stars?", exchange: null, time: "1h ago" },
      { id: 2, buyer: "Ziad M.", av: "Z", avImg: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80", price: 20000, km: 1.8, rating: 4.7, reviews: 52, note: "Nintendo Switch OLED worth 8,000 + 20,000 cash = 28,000 total.", exchange: "Nintendo Switch OLED", exchangeImg: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=100&q=60", exchangeVal: 8000, time: "3h ago" },
    ]
  },
];

const CATS = [
  { id: "all", emoji: "⚡", label: "All" }, { id: "phones", emoji: "📱", label: "Phones" },
  { id: "computers", emoji: "💻", label: "Laptops" }, { id: "audio", emoji: "🎧", label: "Audio" },
  { id: "gaming", emoji: "🎮", label: "Gaming" }, { id: "cameras", emoji: "📷", label: "Cameras" },
  { id: "tablets", emoji: "📟", label: "Tablets" }, { id: "drones", emoji: "🚁", label: "Drones" },
  { id: "furniture", emoji: "🛋️", label: "Furniture" }, { id: "vehicles", emoji: "🚗", label: "Cars" },
];

/* ═══════════════════════════════════════════════════════════
   SPLASH
═══════════════════════════════════════════════════════════ */
function Splash({ done }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setTimeout(done, 3000);
    const interval = setInterval(() => setProgress(p => Math.min(p + 1.8, 100)), 45);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, []);
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "#0F172A",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden"
    }}>
      {/* Slate surface layer — depth */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(30,41,59,0.9) 0%, transparent 70%)",
        pointerEvents: "none"
      }} />

      {/* Primary green orb — top center, large, dominant */}
      <div style={{
        position: "absolute", width: 480, height: 480, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(1,159,69,0.22) 0%, rgba(1,159,69,0.06) 50%, transparent 72%)",
        top: "-5%", left: "50%", transform: "translateX(-50%)",
        animation: "splashOrb1 4.5s ease-in-out infinite alternate"
      }} />

      {/* Warm teal orb — bottom left, accent */}
      <div style={{
        position: "absolute", width: 320, height: 320, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(45,212,191,0.14) 0%, rgba(45,212,191,0.04) 55%, transparent 75%)",
        top: "68%", left: "5%", transform: "translate(-50%,-50%)",
        animation: "splashOrb2 5.5s ease-in-out infinite alternate"
      }} />

      {/* Secondary green orb — bottom right, warm fill */}
      <div style={{
        position: "absolute", width: 280, height: 280, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(1,159,69,0.12) 0%, transparent 70%)",
        top: "70%", left: "90%", transform: "translate(-50%,-50%)",
        animation: "splashOrb2 6.5s ease-in-out 0.8s infinite alternate"
      }} />

      {/* Warm teal micro-orb — top right balance */}
      <div style={{
        position: "absolute", width: 180, height: 180, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(45,212,191,0.10) 0%, transparent 70%)",
        top: "12%", left: "88%", transform: "translate(-50%,-50%)",
        animation: "splashOrb1 3.8s ease-in-out 1.2s infinite alternate"
      }} />

      {/* Pulsing ring — green primary */}
      <div style={{
        position: "absolute", width: 280, height: 280, borderRadius: "50%",
        border: "1px solid rgba(1,159,69,0.20)",
        top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        animation: "splashRing 2.8s ease-out infinite"
      }} />
      {/* Pulsing ring — warm teal inner */}
      <div style={{
        position: "absolute", width: 200, height: 200, borderRadius: "50%",
        border: "1px solid rgba(45,212,191,0.22)",
        top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        animation: "splashRing 2.8s ease-out 0.9s infinite"
      }} />

      {/* logo card — slate surface */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        animation: "splashEntry .9s cubic-bezier(.22,1,.36,1) both",
        zIndex: 2
      }}>
        <div style={{
          background: "rgba(30,41,59,0.80)",
          borderRadius: 32, padding: "28px 44px 24px",
          border: "1px solid rgba(1,159,69,0.22)",
          boxShadow: "0 0 60px rgba(1,159,69,0.16), 0 0 30px rgba(45,212,191,0.08), 0 24px 64px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column", alignItems: "center",
          marginBottom: 28
        }}>
          <Logo size={80} dark={true} />
          <div style={{
            fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 4,
            fontWeight: 600, marginTop: 14, textTransform: "uppercase"
          }}>SMART LOCAL COMMERCE</div>
        </div>

        {/* progress bar — green → warm teal gradient */}
        <div style={{
          width: 160, height: 2.5, background: "rgba(255,255,255,0.07)",
          borderRadius: 99, overflow: "hidden",
          animation: "fadeUp .4s .5s both"
        }}>
          <div style={{
            height: "100%", borderRadius: 99,
            background: "linear-gradient(90deg, #017A35, #019F45, #2DD4BF)",
            width: `${progress}%`, transition: "width .04s linear",
            boxShadow: "0 0 12px rgba(1,159,69,0.7)"
          }} />
        </div>

        <div style={{
          fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 2.5,
          marginTop: 16, animation: "fadeUp .5s .7s both"
        }}>Egypt's Trusted Marketplace</div>
      </div>

      {/* bottom trust badge */}
      <div style={{
        position: "absolute", bottom: 32,
        display: "flex", alignItems: "center", gap: 8,
        animation: "fadeUp .5s 1s both"
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: "50%", background: "#019F45",
          boxShadow: "0 0 8px rgba(1,159,69,0.9)"
        }} />
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: 2.5, fontWeight: 600 }}>SECURED BY KAERO ESCROW</span>
        <div style={{
          width: 5, height: 5, borderRadius: "50%", background: "#2DD4BF",
          boxShadow: "0 0 8px rgba(45,212,191,0.7)"
        }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LOGIN / SIGNUP
═══════════════════════════════════════════════════════════ */
function LoginPage({ onLogin, onSignup, T, isDark = true }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const handleOtpChange = (i, v) => {
    const next = [...otp]; next[i] = v.slice(-1);
    setOtp(next);
    if (v && i < 5) document.getElementById(`login-otp-${i + 1}`)?.focus();
  };
  const handleRequestOTP = async () => {
    const p = phone.trim().replace(/\s/g, "");
    if (!p) return;
    setLoading(true); setErr("");
    try {
      await authApi.requestOTP(p);
      setOtpSent(true);
      setOtp(["", "", "", "", "", ""]);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to send OTP.");
    } finally { setLoading(false); }
  };
  const handleVerifyOTP = async () => {
    const code = otp.join("").trim();
    if (code.length !== 6) return;
    const p = phone.trim().replace(/\s/g, "");
    setLoading(true); setErr("");
    try {
      const { data } = await authApi.verifyOTP(p, code);
      setStoredTokens(data.accessToken, data.refreshToken);
      const u = data.user;
      const appUser = { id: u.id, name: u.full_name || "User", phone: u.phone, avatar: "", email: "", bio: "", location: "Cairo, Egypt", trustScore: u.trust_score ?? 96, rating: 4.9, reviews: 0, sales: 0, verified: !!u.is_phone_verified };
      setStoredUser(appUser);
      DB.setUser(appUser);
      onLogin();
    } catch (e) {
      setErr(e.response?.data?.error || "Invalid OTP.");
    } finally { setLoading(false); }
  };
  return (
    <div style={{ width: "100%", height: "100%", background: G.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 28px" }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ margin: "0 auto 16px", display: "flex", justifyContent: "center" }}><LogoK size={64} dark={isDark} /></div>
        <div style={{ fontSize: 24, fontWeight: 900, color: G.text, letterSpacing: -0.5 }}>{T.welcomeBack}</div>
        <div style={{ fontSize: 12, color: G.muted, marginTop: 4, letterSpacing: 2, textTransform: "uppercase" }}>{T.localCommerce}</div>
      </div>
      {err && <div style={{ width: "100%", fontSize: 12, color: "#EF4444", marginBottom: 12 }}>{err}</div>}
      {!otpSent ? (
        <>
          <div style={{ width: "100%", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: G.muted, marginBottom: 6, fontWeight: 600 }}>{T.phone || "Phone"}</div>
            <input value={phone} onChange={e => { setPhone(e.target.value); setErr(""); }} placeholder="+20 123 456 7890"
              style={{ width: "100%", background: G.card, border: `2px solid ${G.border}`, borderRadius: 14, padding: "14px 16px", fontSize: 14, color: G.text, outline: "none", fontFamily: "inherit" }} />
          </div>
          <Btn full col={G.green} onClick={handleRequestOTP} disabled={!phone.trim() || loading} style={{ marginBottom: 20 }}>{loading ? "Sending…" : T.login}</Btn>
        </>
      ) : (
        <>
          <div style={{ width: "100%", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: G.muted, marginBottom: 8, fontWeight: 600 }}>Enter 6-digit code</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {otp.map((v, i) => (
                <input key={i} id={`login-otp-${i}`} value={v} onChange={e => handleOtpChange(i, e.target.value)}
                  maxLength={1} style={{ width: 44, height: 52, textAlign: "center", fontSize: 22, fontWeight: 900, background: G.card, border: `2px solid ${v ? G.green : G.border}`, borderRadius: 12, color: G.green, outline: "none", fontFamily: "inherit" }} />
              ))}
            </div>
          </div>
          <Btn full col={G.green} onClick={handleVerifyOTP} disabled={otp.join("").length !== 6 || loading} style={{ marginBottom: 10 }}>{loading ? "Verifying…" : T.verify || "Verify"}</Btn>
          <button onClick={() => { setOtpSent(false); setErr(""); }} style={{ background: "none", border: "none", fontSize: 13, color: G.muted, cursor: "pointer", fontFamily: "inherit" }}>← Change phone</button>
        </>
      )}
      <div style={{ marginTop: 20, fontSize: 13, color: G.muted }}>
        {T.noAccount} <button onClick={onSignup} style={{ background: "none", border: "none", color: G.green, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>{T.signup}</button>
      </div>
    </div>
  );
}

function SignupPage({ onLogin, onComplete, T: initialT, lang: initialLang, setLang: externalSetLang }) {
  const [step, setStep] = useState(0);
  const [selectedLang, setSelectedLang] = useState(initialLang || "en");
  const T = TR[selectedLang];
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [pass, setPass] = useState("");
  const [idUploaded, setIdUploaded] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authErr, setAuthErr] = useState("");

  const handleRequestOTP = async () => {
    const p = phone.trim().replace(/\s/g, "");
    if (!p) return;
    setAuthLoading(true); setAuthErr("");
    try {
      await authApi.requestOTP(p);
      setOtpSent(true);
      setOtp(["", "", "", "", "", ""]);
    } catch (e) {
      setAuthErr(e.response?.data?.error || e.message || "Failed to send OTP. Check backend.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    const code = otp.join("").trim();
    if (code.length !== 6) return;
    const p = phone.trim().replace(/\s/g, "");
    setAuthLoading(true); setAuthErr("");
    try {
      const { data } = await authApi.verifyOTP(p, code);
      setStoredTokens(data.accessToken, data.refreshToken);
      const apiUser = data.user;
      const appUser = { id: apiUser.id, name: apiUser.full_name || name.trim() || "User", phone: apiUser.phone, avatar: selectedAvatar, email: email.trim(), bio: "Member on Kaero 🇪🇬", location: "Cairo, Egypt", trustScore: apiUser.trust_score ?? 96, rating: 4.9, reviews: 0, sales: 0, verified: !!apiUser.is_phone_verified };
      setStoredUser(appUser);
      await userApi.updateMe({ full_name: appUser.name, preferred_language: selectedLang === "ar" ? "ar" : "en" }).catch(() => {});
      DB.setUser(appUser);
      DB.setLang(selectedLang);
      if (externalSetLang) externalSetLang(selectedLang);
      onComplete(appUser, selectedLang);
    } catch (e) {
      setAuthErr(e.response?.data?.error || "Invalid or expired OTP.");
    } finally {
      setAuthLoading(false);
    }
  };

  const AVATARS = [
    "https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=200&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80",
    "https://images.unsplash.com/photo-1545167622-3a6ac756afa4?w=200&q=80",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&q=80",
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80",
  ];

  const handleOtpChange = (i, v) => {
    const next = [...otp]; next[i] = v.slice(-1);
    setOtp(next);
    if (v && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  };

  const steps = [
    { title: T.language, icon: "🌍" },
    { title: T.fullName, icon: "👤" },
    { title: T.verifyPhone, icon: "📞" },
    { title: T.verifyEmail, icon: "📧" },
    { title: T.uploadID, icon: "🪪" },
    { title: T.createPassword, icon: "🔐" },
  ];

  const OtpInputs = () => (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
      {otp.map((v, i) => (
        <input key={i} id={`otp-${i}`} value={v} onChange={e => handleOtpChange(i, e.target.value)}
          maxLength={1} style={{
            width: 44, height: 52, textAlign: "center", fontSize: 22, fontWeight: 900,
            background: G.card, border: `2px solid ${v ? G.green : G.border}`,
            borderRadius: 12, color: G.green, outline: "none", fontFamily: "inherit"
          }} />
      ))}
    </div>
  );

  const getInitials = (n) => {
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase() || "?";
  };

  const handleComplete = () => {
    const userData = {
      name: name.trim(),
      bio: `Member on Kaero 🇪🇬`,
      phone: phone.trim(),
      email: email.trim(),
      location: 'Cairo, Egypt',
      trustScore: 96,
      rating: 4.9,
      reviews: 0,
      sales: 0,
      verified: true,
      avatar: selectedAvatar,
    };
    DB.setUser(userData);
    DB.setLang(selectedLang);
    if (externalSetLang) externalSetLang(selectedLang);
    onComplete(userData, selectedLang);
  };

  return (
    <div style={{ width: "100%", height: "100%", background: G.bg, display: "flex", flexDirection: "column", direction: selectedLang === "ar" ? "rtl" : "ltr" }}>
      {/* progress */}
      <div style={{ display: "flex", alignItems: "center", padding: "16px 14px 8px", flexShrink: 0 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", flex: i < 5 ? 1 : "initial", alignItems: "center" }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: step > i ? G.green : step === i ? G.greenDim : G.card,
              border: `2px solid ${step >= i ? G.green : G.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: step > i ? 10 : 12, transition: "all .3s"
            }}>{step > i ? "✓" : s.icon}</div>
            {i < 5 && <div style={{ flex: 1, height: 2, margin: "0 2px", background: step > i ? G.green : G.border }} />}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 24px" }}>

        {/* Step 0: Language selection */}
        {step === 0 && (<>
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18, background: G.greenDim,
              border: `2px solid ${G.green}44`, display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", boxShadow: `0 8px 32px ${G.greenGlow}`
            }}><Logo size={40} dark={G.bg === "#000000"} /></div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: G.text, marginBottom: 4, textAlign: "center" }}>{TR.en.welcomeKaero}</div>
          <div style={{ fontSize: 12, color: G.muted, marginBottom: 28, textAlign: "center", letterSpacing: 1 }}>Choose your language / اختر لغتك</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { code: "en", label: "English", flag: "🇬🇧", desc: "Continue in English" },
              { code: "ar", label: "العربية", flag: "🇪🇬", desc: "المتابعة بالعربية" },
            ].map(l => (
              <button key={l.code} onClick={() => setSelectedLang(l.code)} style={{
                width: "100%", background: selectedLang === l.code ? G.greenDim : G.card,
                border: `2px solid ${selectedLang === l.code ? G.green : G.border}`,
                borderRadius: 16, padding: "18px 20px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 14, fontFamily: "inherit",
                boxShadow: selectedLang === l.code ? `0 4px 20px ${G.greenGlow}` : "none",
                transition: "all .2s"
              }}>
                <span style={{ fontSize: 32 }}>{l.flag}</span>
                <div style={{ textAlign: "left", flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: selectedLang === l.code ? G.green : G.text }}>
                    {l.label}
                  </div>
                  <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>{l.desc}</div>
                </div>
                {selectedLang === l.code && <div style={{ width: 24, height: 24, borderRadius: "50%", background: G.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff" }}>✓</div>}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <Btn full col={G.green} onClick={() => setStep(1)}>{TR[selectedLang].next}</Btn>
          </div>
        </>)}

        {/* Step 1: Name + Avatar */}
        {step === 1 && (<>
          <div style={{ fontSize: 22, fontWeight: 900, color: G.text, marginBottom: 6 }}>{T.welcomeKaero}</div>
          <div style={{ fontSize: 13, color: G.muted, marginBottom: 20 }}>{T.fullName}</div>

          {/* Avatar picker */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ position: "relative", display: "inline-block", marginBottom: 14 }}>
              {selectedAvatar ? (
                <img src={selectedAvatar} style={{
                  width: 80, height: 80, borderRadius: "50%", objectFit: "cover",
                  border: `3px solid ${G.green}`, boxShadow: `0 0 24px ${G.greenGlow}`
                }} onError={e => e.target.style.display = "none"} />
              ) : (
                <div style={{
                  width: 80, height: 80, borderRadius: "50%", background: G.greenDim,
                  border: `3px dashed ${G.green}66`, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: name ? 24 : 28, fontWeight: 900, color: G.green
                }}>{name ? getInitials(name) : "📷"}</div>
              )}
            </div>
            <div style={{ fontSize: 11, color: G.muted, marginBottom: 10 }}>Choose your profile photo</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {AVATARS.map((url, i) => (
                <img key={i} src={url} onClick={() => setSelectedAvatar(url)}
                  style={{
                    width: 48, height: 48, borderRadius: "50%", objectFit: "cover", cursor: "pointer",
                    border: `3px solid ${selectedAvatar === url ? G.green : G.border}`,
                    opacity: selectedAvatar === url ? 1 : 0.65, transition: "all .2s",
                    boxShadow: selectedAvatar === url ? `0 2px 12px ${G.greenGlow}` : "none"
                  }}
                  onError={e => e.target.style.display = "none"} />
              ))}
            </div>
          </div>

          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name"
            style={{ width: "100%", background: G.card, border: `2px solid ${G.border}`, borderRadius: 14, padding: "14px 16px", fontSize: 15, color: G.text, outline: "none", fontFamily: "inherit", marginBottom: 20 }} />
          <Btn full col={G.green} onClick={() => name.trim() && setStep(2)} disabled={!name.trim()}>{T.next}</Btn>
        </>)}
        {/* Step 2: Phone OTP — wired to Kaero backend */}
        {step === 2 && (<>
          <div style={{ fontSize: 22, fontWeight: 900, color: G.text, marginBottom: 6 }}>{T.verifyPhone}</div>
          <div style={{ fontSize: 13, color: G.muted, marginBottom: 20 }}>{otpSent ? T.otpSentPhone : T.phone}</div>
          {authErr && <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 12 }}>{authErr}</div>}
          {!otpSent ? (<>
            <input value={phone} onChange={e => { setPhone(e.target.value); setAuthErr(""); }} placeholder="+20 123 456 7890"
              style={{ width: "100%", background: G.card, border: `2px solid ${G.border}`, borderRadius: 14, padding: "14px 16px", fontSize: 15, color: G.text, outline: "none", fontFamily: "inherit", marginBottom: 20 }} />
            <Btn full col={G.green} onClick={handleRequestOTP} disabled={!phone.trim() || authLoading}>{authLoading ? "Sending…" : T.verify}</Btn>
          </>) : (<>
            <OtpInputs />
            <Btn full col={G.green} onClick={handleVerifyOTP} disabled={otp.join("").length !== 6 || authLoading}>{authLoading ? "Verifying…" : T.verify}</Btn>
            <button onClick={() => { setOtpSent(false); setAuthErr(""); }} style={{ width: "100%", marginTop: 10, background: "none", border: "none", fontSize: 13, color: G.muted, cursor: "pointer", fontFamily: "inherit" }}>← {T.phone}</button>
          </>)}
        </>)}
        {/* Step 3: Email OTP */}
        {step === 3 && (<>
          <div style={{ fontSize: 22, fontWeight: 900, color: G.text, marginBottom: 6 }}>{T.verifyEmail}</div>
          <div style={{ fontSize: 13, color: G.muted, marginBottom: 20 }}>{otpSent ? T.otpSentEmail : T.email}</div>
          {!otpSent ? (<>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" type="email"
              style={{ width: "100%", background: G.card, border: `2px solid ${G.border}`, borderRadius: 14, padding: "14px 16px", fontSize: 15, color: G.text, outline: "none", fontFamily: "inherit", marginBottom: 20 }} />
            <Btn full col={G.green} onClick={() => { setOtpSent(true); setOtp(["", "", "", "", "", ""]); }}>{T.verify}</Btn>
          </>) : (<>
            <OtpInputs />
            <Btn full col={G.green} onClick={() => { setOtpSent(false); setStep(4); setOtp(["", "", "", "", "", ""]); }}>{T.verify}</Btn>
          </>)}
        </>)}
        {/* Step 4: ID Upload */}
        {step === 4 && (<>
          <div style={{ fontSize: 22, fontWeight: 900, color: G.text, marginBottom: 6 }}>{T.uploadID}</div>
          <div style={{ fontSize: 13, color: G.muted, marginBottom: 24 }}>{T.uploadIdDesc}</div>
          <button onClick={() => setIdUploaded(true)} style={{
            width: "100%", height: 160, borderRadius: 18,
            border: `2px dashed ${idUploaded ? G.green : G.border2}`,
            background: idUploaded ? G.greenDim : G.card,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
            cursor: "pointer", fontFamily: "inherit", marginBottom: 20
          }}>
            <div style={{ fontSize: 40 }}>{idUploaded ? "✅" : "🪪"}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: idUploaded ? G.green : G.muted }}>{idUploaded ? T.idUploaded : T.tapToUpload}</div>
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn col={G.green} outline onClick={() => setStep(5)} style={{ flex: 1 }}>{T.skip}</Btn>
            <Btn col={G.green} onClick={() => setStep(5)} style={{ flex: 2 }}>{T.next}</Btn>
          </div>
        </>)}
        {/* Step 5: Password */}
        {step === 5 && (<>
          <div style={{ fontSize: 22, fontWeight: 900, color: G.text, marginBottom: 6 }}>{T.createPassword}</div>
          <div style={{ fontSize: 13, color: G.muted, marginBottom: 24 }}>{T.strongPassword}</div>
          <input value={pass} onChange={e => setPass(e.target.value)} type="password" placeholder="••••••••"
            style={{ width: "100%", background: G.card, border: `2px solid ${G.border}`, borderRadius: 14, padding: "14px 16px", fontSize: 15, color: G.text, outline: "none", fontFamily: "inherit", marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: pass.length >= i * 2 ? G.green : G.border }} />
            ))}
          </div>
          <Btn full col={G.green} onClick={handleComplete} disabled={pass.length < 6}>{T.submit}</Btn>
        </>)}
        {step > 0 && step < 5 && (
          <button onClick={() => setStep(s => s - 1)} style={{ width: "100%", marginTop: 12, background: "none", border: "none", fontSize: 13, color: G.muted, cursor: "pointer", fontFamily: "inherit" }}>← {T.back}</button>
        )}
        {step === 0 && (
          <div style={{ marginTop: 20, fontSize: 13, color: G.muted, textAlign: "center" }}>
            {T.hasAccount} <button onClick={onLogin} style={{ background: "none", border: "none", color: G.green, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>{T.login}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HOME — Full reimagined
═══════════════════════════════════════════════════════════ */
function Home({ go, T, isDark, setIsDark, lang, setLang, user }) {
  const [storeFilter, setStoreFilter] = useState("price");
  const [activeNav, setActiveNav] = useState("home");
  const [voiceActive, setVoiceActive] = useState(false);

  // Real data state (with mock fallbacks)
  const [nearbyListings, setNearbyListings] = useState([]);
  const [myStoreItems, setMyStoreItems] = useState([]);
  const [wallet, setWallet] = useState({ total: 0, released: 0, escrow: 0, disputes: 0 });
  const [notifCount, setNotifCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [chatUnread, setChatUnread] = useState(0);
  const [nearbyCount, setNearbyCount] = useState(0);

  // Fetch real data on mount
  useEffect(() => {
    const fetchData = async () => {
      // Wallet
      walletApi.me().then(r => {
        setWallet({
          total: Number(r.data.balance ?? 0) + Number(r.data.pending ?? 0),
          released: Number(r.data.balance ?? 0),
          escrow: Number(r.data.pending ?? 0),
          disputes: 0,
        });
      }).catch(() => {});

      // Notifications (badge + recent activity)
      notificationApi.list().then(r => {
        setNotifCount(r.data.unread_count || 0);
        if (r.data.notifications?.length > 0) {
          setRecentActivity(r.data.notifications.slice(0, 4).map(n => ({
            txt: (n.title || '') + (n.body ? ': ' + n.body : ''),
            time: timeAgo(n.created_at),
            dot: G.green,
            unread: !n.is_read,
          })));
        }
      }).catch(() => {});

      // Chat unread count
      chatApi.list().then(r => {
        const total = (r.data.chats || []).reduce((s, c) => s + (c.unread_count || 0), 0);
        setChatUnread(total);
      }).catch(() => {});

      // My Store items
      if (user?.id) {
        listingApi.byUser(user.id).then(r => {
          if (r.data.listings?.length > 0) {
            const adapted = r.data.listings.map(l => ({
              ...adaptListing(l),
              offers: [],
            }));
            setMyStoreItems(adapted);
            // Fetch offers for each listing
            adapted.forEach(item => {
              if (item._raw?.id) {
                offerApi.byListing(item._raw.id).then(or => {
                  if (or.data.offers?.length > 0) {
                    setMyStoreItems(prev => prev.map(si =>
                      si.id === item.id ? { ...si, offers: or.data.offers.map(adaptOffer) } : si
                    ));
                  }
                }).catch(() => {});
              }
            });
          }
        }).catch(() => {});
      }

      // Nearby listings
      const doFetchListings = (lat, lng) => {
        listingApi.nearby({ lat, lng, radius: 50000, limit: 20, sort: 'distance' })
          .then(r => {
            if (r.data.listings?.length > 0) {
              setNearbyListings(r.data.listings.map(adaptListing));
              setNearbyCount(r.data.listings.length);
            }
          })
          .catch(() => {});
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            doFetchListings(pos.coords.latitude, pos.coords.longitude);
            // Update user location on backend
            userApi.updateLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
          },
          () => doFetchListings(30.0444, 31.2357),
          { timeout: 5000 }
        );
      } else {
        doFetchListings(30.0444, 31.2357);
      }
    };

    fetchData();
  }, [user?.id]);

  const totalOffers = myStoreItems.reduce((s, l) => s + (l.offers?.length || 0), 0);

  const userName = user?.name || user?.full_name || 'User';
  const userInitials = (() => {
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return userName.slice(0, 2).toUpperCase() || '?';
  })();

  const sortedStore = [...myStoreItems].filter(i => !i.sold).sort((a, b) => {
    const bestOffer = (item) => {
      if (!item.offers?.length) return { price: 0, km: 999, rating: 0 };
      if (storeFilter === "price") return item.offers.reduce((b, o) => o.price > b.price ? o : b);
      if (storeFilter === "distance") return item.offers.reduce((b, o) => o.km < b.km ? o : b);
      if (storeFilter === "trust") return item.offers.reduce((b, o) => o.rating > b.rating ? o : b);
      return item.offers.reduce((b, o) => o.price > b.price ? o : b);
    };
    const ba = bestOffer(a), bb = bestOffer(b);
    if (storeFilter === "price") return bb.price - ba.price;
    if (storeFilter === "distance") return ba.km - bb.km;
    if (storeFilter === "trust") return bb.rating - ba.rating;
    return bb.price - ba.price;
  });

  const getBestOfferLabel = (item) => {
    if (!item.offers?.length) return null;
    if (storeFilter === "price") {
      const best = item.offers.reduce((b, o) => o.price > b.price ? o : b);
      return `Best: ${(best.price / 1000).toFixed(0)}K`;
    }
    if (storeFilter === "distance") {
      const best = item.offers.reduce((b, o) => o.km < b.km ? o : b);
      return `📍 ${best.km}km away`;
    }
    if (storeFilter === "trust") {
      const best = item.offers.reduce((b, o) => o.rating > b.rating ? o : b);
      return `Trust: ★${best.rating}`;
    }
    return null;
  };

  const navItems = [
    { id: "home", Ic: Icon.Home, label: T.home },
    { id: "market", Ic: Icon.Market, label: T.market },
    { id: "sell", Ic: Icon.Plus, label: T.sell, big: true },
    { id: "chat", Ic: Icon.Chat, label: T.chat, badge: chatUnread },
    { id: "profile", Ic: Icon.Profile, label: T.profile },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>

      {/* ── TOP BAR WITH LOGO + LANG + THEME + NOTIFS ── */}
      <div style={{
        background: G.topBarBg, padding: "6px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        borderBottom: `1px solid ${G.topBarBorder}`, boxShadow: `0 1px 6px ${G.shadowSm}`
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Logo size={26} dark={isDark} />
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Language toggle */}
          <button onClick={() => setLang(lang === "en" ? "ar" : "en")} style={{
            background: G.greenDim, border: `1px solid ${G.green}44`,
            borderRadius: 8, padding: "4px 8px", cursor: "pointer",
            fontSize: 10, fontWeight: 800, color: G.green, fontFamily: "inherit"
          }}>{lang === "en" ? "عربي" : "EN"}</button>
          {/* Dark/Light toggle */}
          <div style={{ display: "flex", background: G.card, borderRadius: 20, padding: 2, gap: 1, border: `1px solid ${G.border}` }}>
            <button onClick={() => setIsDark(true)} style={{
              width: 28, height: 24, borderRadius: 18, border: "none",
              background: isDark ? G.green : "transparent", cursor: "pointer", fontSize: 11, display: "flex",
              alignItems: "center", justifyContent: "center"
            }}><Icon.Moon size={13} col={isDark ? "#fff" : G.muted} /></button>
            <button onClick={() => setIsDark(false)} style={{
              width: 28, height: 24, borderRadius: 18, border: "none",
              background: !isDark ? G.green : "transparent", cursor: "pointer", fontSize: 11, display: "flex",
              alignItems: "center", justifyContent: "center"
            }}><Icon.Sun size={13} col={!isDark ? "#fff" : G.muted} /></button>
          </div>
          <div style={{ position: "relative", cursor: "pointer" }}
            onClick={() => go("notifications")}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: G.greenDim, border: `1px solid ${G.green}44`,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}><Icon.Bell size={15} col={G.green} /></div>
            <Badge n={notifCount} />
          </div>
          <div onClick={() => go("settings")} style={{
            width: 30, height: 30, borderRadius: "50%",
            background: G.greenDim, border: `1px solid ${G.green}44`, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer"
          }}><Icon.Settings size={15} col={G.green} /></div>
        </div>
      </div>

      {/* ── SCROLL AREA ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px 80px" }}>

        {/* ── PROFILE CARD — matches screenshot design ── */}
        <div onClick={() => go("profile")} style={{
          background: G.card, borderRadius: 18, padding: "16px 16px", marginBottom: 10,
          border: `1px solid ${G.border}`, cursor: "pointer"
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {user?.avatar ? (
                <img src={user.avatar} style={{
                  width: 62, height: 62, borderRadius: "50%", objectFit: "cover",
                  border: `2.5px solid ${G.green}60`
                }} onError={e => { e.target.style.display = "none"; }} />
              ) : (
                <div style={{
                  width: 62, height: 62, borderRadius: "50%", background: G.green,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -1
                }}>{userInitials}</div>
              )}
              <div style={{
                position: "absolute", bottom: 0, right: 0, width: 15, height: 15,
                borderRadius: "50%", background: G.green, border: `2px solid ${G.card}`,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}><Icon.Check size={8} col="#fff" /></div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: G.text, letterSpacing: -.3 }}>{userName}</span>
                <div style={{
                  background: G.green + "22", border: `1px solid ${G.green}44`,
                  borderRadius: 99, padding: "3px 9px", display: "flex", alignItems: "center", gap: 4
                }}>
                  <Icon.Star size={11} col={G.cyan} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: G.cyan }}>{user?.rating || 4.8}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                <Icon.Pin size={12} col={G.cyan} />
                <span style={{ fontSize: 12, color: G.text2 }}>Cairo, Egypt</span>
                <span style={{ fontSize: 12, color: G.muted }}>·</span>
                <Icon.Phone size={12} col={G.muted} />
                <span style={{ fontSize: 12, color: G.muted }}>+20 123 456 7890</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{
                  background: G.greenDim, border: `1px solid ${G.green}44`,
                  borderRadius: 99, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: G.green }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: G.green }}>Verified</span>
                </div>
                <div style={{
                  background: G.cyanDim, border: `1px solid ${G.cyan}44`,
                  borderRadius: 99, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4
                }}>
                  <Icon.Fire size={12} col={G.cyan} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: G.cyan }}>Top Seller</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── MY STORE CARD with filter + horizontal scroll ── */}
        <div style={{
          background: G.card, borderRadius: 18, padding: "14px 14px",
          marginBottom: 10, border: `1px solid ${G.border}`,
          boxShadow: `0 4px 24px ${G.shadow}`
        }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, background: G.greenDim,
                border: `1px solid ${G.green}33`, display: "flex", alignItems: "center", justifyContent: "center"
              }}><Icon.Store size={15} col={G.green} /></div>
              <span style={{ fontSize: 15, fontWeight: 800, color: G.text }}>{T.myStore}</span>
            </div>
            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <div style={{ background: G.greenDim, border: `1px solid ${G.green}44`, borderRadius: 99, padding: "3px 10px" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: G.green }}>
                  {myStoreItems.length} items
                </span>
              </div>
              <button onClick={() => go("store")} style={{
                background: "none", border: "none",
                color: G.green, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit"
              }}>
                {T.seeAll}
              </button>
            </div>
          </div>

          {/* filter widget */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[
              { v: "price",    l: "Price",      ic: "💸", col: G.green,   dim: G.greenDim,   glow: G.greenGlow   },
              { v: "distance", l: "Distance",   ic: "📍", col: G.green,   dim: G.greenDim,   glow: G.greenGlow   },
              { v: "trust",    l: "Trust Score", ic: "🛡️", col: G.green,   dim: G.greenDim,   glow: G.greenGlow   },
            ].map(o => {
              const active = storeFilter === o.v;
              return (
                <button key={o.v} onClick={() => setStoreFilter(o.v)} style={{
                  flex: 1,
                  background: active ? o.dim : G.cardHi,
                  border: `1.5px solid ${active ? o.col : G.border}`,
                  borderRadius: 10, padding: "7px 4px", cursor: "pointer",
                  fontFamily: "inherit", transition: "all .2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  boxShadow: active ? `0 2px 10px ${o.glow}` : "none",
                }}>
                  <span style={{ fontSize: 12, lineHeight: 1, filter: active ? "none" : "grayscale(1) opacity(0.5)" }}>{o.ic}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: active ? o.col : G.text2 }}>{o.l}</span>
                </button>
              );
            })}
          </div>

          {/* horizontal scroll of items */}
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {sortedStore.map((item) => (
              <div key={item.id} onClick={() => go("store_offers", item)}
                style={{
                  flexShrink: 0, width: 110, background: G.cardHi, borderRadius: 14,
                  overflow: "hidden", cursor: "pointer", border: `1px solid ${G.border}`,
                  transition: "all .15s"
                }}>
                {/* image */}
                <div style={{
                  width: "100%", height: 80, overflow: "hidden",
                  background: G.bg, position: "relative"
                }}>
                  <img src={item.img} alt={item.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={e => e.target.style.display = "none"} />
                  {(item.offers?.length || 0) > 0 && (
                    <div style={{
                      position: "absolute", top: 5, right: 5,
                      width: 20, height: 20, borderRadius: "50%", background: G.green,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 900, color: "#fff"
                    }}>
                      {item.offers.length}
                    </div>
                  )}
                </div>
                <div style={{ padding: "8px 9px 10px" }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: G.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    marginBottom: 3
                  }}>{item.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: G.green }}>
                    {(item.price / 1000).toFixed(0)}K EGP
                  </div>
                  <div style={{ fontSize: 9, color: G.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon.Eye size={10} col={G.muted} /> {item.views}
                    <span style={{ color: G.border2 }}>·</span>
                    <Icon.Msg size={10} col={G.muted} /> {item.offers?.length || 0} offers
                  </div>
                  {getBestOfferLabel(item) && (() => {
                    const labelCol = G.green;
                    return (
                      <div style={{
                        fontSize: 9, fontWeight: 800, color: labelCol, marginTop: 3,
                        background: `${labelCol}18`, borderRadius: 6, padding: "2px 5px",
                        display: "inline-block"
                      }}>
                        {getBestOfferLabel(item)}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
            {/* add listing card */}
            <div onClick={() => go("sell")} style={{
              flexShrink: 0, width: 100, height: 152,
              borderRadius: 14, border: `1.5px dashed ${G.border2}`,
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", cursor: "pointer", gap: 6
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: G.green + "22", border: `1px solid ${G.green}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, color: G.green
              }}>+</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: G.muted, textAlign: "center" }}>
                {T.addItem}
              </div>
            </div>
          </div>
        </div>

        {/* ── BUY / SELL BUTTONS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <button onClick={() => go("buy_cats")} style={{
            background: isDark ? G.surface : G.green,
            border: isDark ? `1.5px solid #2C2F33` : "none",
            borderRadius: 22, padding: "18px 14px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: isDark ? `0 2px 12px rgba(0,0,0,.4)` : `0 6px 22px rgba(0,168,107,.28)`,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: "50%",
              background: isDark ? G.cardHi : "rgba(255,255,255,0.20)",
              border: isDark ? "1.5px solid #36393E" : "1.5px solid rgba(255,255,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}><Icon.Mic size={21} col={isDark ? G.green : "#fff"} /></div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: 0.6 }}>{T.buy}</div>
              <div style={{ fontSize: 10, color: isDark ? G.muted : "rgba(255,255,255,0.70)" }}>{T.tapOrSpeak}</div>
            </div>
          </button>

          <button onClick={() => go("sell")} style={{
            background: isDark ? G.surface : G.green,
            border: isDark ? `1.5px solid #2C2F33` : "none",
            borderRadius: 22, padding: "18px 14px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: isDark ? `0 2px 12px rgba(0,0,0,.4)` : `0 6px 22px rgba(0,168,107,.28)`,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: "50%",
              background: isDark ? G.cardHi : "rgba(255,255,255,0.20)",
              border: isDark ? "1.5px solid #36393E" : "1.5px solid rgba(255,255,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}><Icon.Mic size={21} col={isDark ? G.green : "#fff"} /></div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: 0.6 }}>{T.sellBtn}</div>
              <div style={{ fontSize: 10, color: isDark ? G.muted : "rgba(255,255,255,0.70)" }}>{T.tapOrSpeak}</div>
            </div>
          </button>
        </div>

        {/* ── EXPLORE MARKET BANNER ── */}
        <button onClick={() => go("market")}
          style={{
            width: "100%", background: G.card, border: `1px solid ${G.border}`,
            borderRadius: 18, padding: "16px 18px", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
            fontFamily: "inherit", boxShadow: `0 4px 20px ${G.shadow}`
          }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, background: G.indigoDim,
            border: `1px solid ${G.indigo}44`, display: "flex", alignItems: "center",
            justifyContent: "center"
          }}><Icon.Map size={24} col={G.indigo} /></div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: G.text }}>
              {T.exploreMarket} <span style={{ color: G.indigo }}>2km</span>
            </div>
            <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>{nearbyCount || nearbyListings.length} {T.items} · Map + Voice</div>
          </div>
          <Icon.ChevronRight size={20} col={G.muted} />
        </button>



        {/* ── HOT NEAR YOU ── */}
        <SH title={T.hotNearYou} action={T.seeAll} onAction={() => go("buy_cats")} />
        <div style={{ display: "flex", gap: 11, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
          {[...nearbyListings].sort((a, b) => a.km - b.km).slice(0, 6).map(p => (
            <div key={p.id} onClick={() => go("product", p)}
              style={{
                flexShrink: 0, width: 148, background: G.card, borderRadius: 16,
                overflow: "hidden", cursor: "pointer", border: `1px solid ${G.border}`
              }}>
              <div style={{ height: 100, background: G.bg, position: "relative", overflow: "hidden" }}>
                <img src={p.img} alt={p.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={e => e.target.style.display = "none"} />
                <div style={{ position: "absolute", top: 6, left: 6 }}>
                  <span style={{
                    background: G.green, color: "#fff", fontSize: 8, fontWeight: 800,
                    borderRadius: 99, padding: "2px 6px"
                  }}>✓ VERIFIED</span>
                </div>
                <div style={{
                  position: "absolute", bottom: 6, right: 6,
                  background: "rgba(0,0,0,.65)", color: "#fff", fontSize: 9,
                  fontWeight: 700, borderRadius: 99, padding: "2px 7px"
                }}>📍{p.km}km</div>
              </div>
              <div style={{ padding: "9px 10px 11px" }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: G.text, marginBottom: 2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>{p.name}</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: G.green, marginBottom: 3 }}>
                  {p.price.toLocaleString()} EGP
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: G.cyan, fontSize: 10 }}>★</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: G.text2 }}>{p.rating}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── RECENT ACTIVITY ── */}
        <SH title={T.recentActivity} />
        {(recentActivity.length > 0 ? recentActivity : [
          { txt: "No recent activity yet", time: "", dot: G.muted, unread: false },
        ]).map((n, i) => (
          <div key={i} style={{
            background: G.card, borderRadius: 13, padding: "11px 13px",
            marginBottom: 7, border: `1px solid ${n.unread ? n.dot + "40" : G.border}`,
            display: "flex", gap: 10, alignItems: "center",
            boxShadow: n.unread ? `0 2px 10px ${n.dot}22` : "none"
          }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: n.dot, flexShrink: 0 }} />
            <div style={{
              flex: 1, fontSize: 12, color: n.unread ? G.text : G.text2,
              lineHeight: 1.45, fontWeight: n.unread ? 600 : 400
            }}>{n.txt}</div>
            <div style={{ fontSize: 10, color: G.muted, flexShrink: 0 }}>{n.time} ago</div>
          </div>
        ))}

        {/* ── WALLET WIDGET ── */}
        <div style={{
          background: `linear-gradient(135deg, rgba(1,159,69,.12) 0%, rgba(22,184,166,.08) 50%, rgba(15,23,42,1) 80%)`,
          borderRadius: 18, padding: "14px 16px", marginTop: 4,
          border: `1px solid ${G.green}33`
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: G.muted, fontWeight: 700 }}>{T.escrowWallet}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: G.text }}>{wallet.total.toLocaleString()} <span style={{ fontSize: 13, color: G.muted }}>EGP</span></div>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 14, background: G.greenDim,
              border: `1px solid ${G.green}44`, display: "flex", alignItems: "center",
              justifyContent: "center"
            }}><Icon.Wallet size={22} col={G.green} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { ic: "✓", lb: T.released, v: wallet.released.toLocaleString(), col: G.green },
              { ic: "~", lb: T.inEscrow, v: wallet.escrow.toLocaleString(), col: G.green },
              { ic: "!", lb: T.disputes, v: String(wallet.disputes), col: G.muted },
            ].map(({ ic, lb, v, col }) => (
              <div key={lb} style={{ background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "8px 10px", border: `1px solid ${col}22` }}>
                <div style={{ fontSize: 11, color: col, fontWeight: 800 }}>{ic}</div>
                <div style={{ fontSize: 10, color: G.muted, marginTop: 2 }}>{lb}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: G.text }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: G.topBarBg, backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderTop: `1px solid ${G.topBarBorder}`,
        display: "flex", alignItems: "center", height: 64, paddingBottom: 4,
        zIndex: 10
      }}>
        {navItems.map(nav => (
          nav.big ? (
            <div key={nav.id} style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <button onClick={() => go("sell")}
                style={{
                  width: 50, height: 50, borderRadius: 18, background: `linear-gradient(135deg, ${G.green}, ${G.green}cc)`,
                  border: "none", cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 4px 20px ${G.greenGlow}`, marginBottom: 4
                }}><Icon.Plus size={26} col="#fff" /></button>
            </div>
          ) : (
            <button key={nav.id} onClick={() => {
              setActiveNav(nav.id);
              if (nav.id !== "home") go(nav.id === "profile" ? "profile" : nav.id);
            }} style={{
              flex: 1, background: "none", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 3, fontFamily: "'Outfit',inherit", paddingTop: 8, position: "relative"
            }}>
              <nav.Ic size={20} col={activeNav === nav.id ? G.green : G.muted} />
              {nav.badge && <Badge n={nav.badge} />}
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: activeNav === nav.id ? G.green : G.muted
              }}>{nav.label}</span>
              {activeNav === nav.id && (
                <div style={{ width: 20, height: 2.5, borderRadius: 99, background: G.green, marginTop: 1 }} />
              )}
            </button>
          )
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BUY — CATEGORIES (Full e-commerce + subcategories)
═══════════════════════════════════════════════════════════ */
const FULL_CATS = [
  {
    id: "phones", emoji: "📱", label: "Phones & Tablets",
    subs: ["iPhones", "Samsung", "Tablets", "iPad", "Android Phones", "Accessories"]
  },
  {
    id: "computers", emoji: "💻", label: "Computers",
    subs: ["MacBooks", "Windows Laptops", "Desktops", "Monitors", "Components", "Accessories"]
  },
  {
    id: "audio", emoji: "🎧", label: "Audio",
    subs: ["Headphones", "Earbuds", "Speakers", "Home Theater", "Microphones", "DJ Equipment"]
  },
  {
    id: "gaming", emoji: "🎮", label: "Gaming",
    subs: ["PlayStation", "Xbox", "Nintendo", "PC Gaming", "Games", "Controllers", "VR"]
  },
  {
    id: "cameras", emoji: "📷", label: "Cameras & Drones",
    subs: ["DSLR", "Mirrorless", "Action Cams", "Drones", "Lenses", "Accessories"]
  },
  {
    id: "tv", emoji: "📺", label: "TV & Home Electronics",
    subs: ["Smart TVs", "Projectors", "Streaming Devices", "Home Security", "Smart Home"]
  },
  {
    id: "vehicles", emoji: "🚗", label: "Vehicles",
    subs: ["Cars", "Motorcycles", "Bicycles", "Electric Scooters", "Parts & Accessories"]
  },
  {
    id: "furniture", emoji: "🛋️", label: "Furniture & Home",
    subs: ["Living Room", "Bedroom", "Kitchen", "Garden", "Lighting", "Décor"]
  },
  {
    id: "fashion", emoji: "👗", label: "Fashion",
    subs: ["Men's Clothing", "Women's Clothing", "Shoes", "Bags", "Watches", "Jewelry"]
  },
  {
    id: "books", emoji: "📚", label: "Books & Hobbies",
    subs: ["Books", "Music Instruments", "Art Supplies", "Toys", "Board Games", "Collectibles"]
  },
  {
    id: "sports", emoji: "⚽", label: "Sports & Outdoors",
    subs: ["Gym Equipment", "Bikes", "Camping", "Water Sports", "Team Sports", "Fitness"]
  },
  {
    id: "baby", emoji: "🍼", label: "Baby & Kids",
    subs: ["Baby Gear", "Toys", "Clothing", "Strollers", "Car Seats", "Learning"]
  },
  {
    id: "beauty", emoji: "💄", label: "Beauty & Health",
    subs: ["Skincare", "Makeup", "Hair Care", "Perfumes", "Health Devices", "Fitness"]
  },
  {
    id: "appliances", emoji: "🏠", label: "Home Appliances",
    subs: ["Washing Machines", "Refrigerators", "AC", "Kitchen Appliances", "Vacuums"]
  },
];

function BuyCats({ go, back, T }) {
  const [q, setQ] = useState("");
  const [selectedCat, setSelectedCat] = useState(null);
  const [featuredListings, setFeaturedListings] = useState([]);
  const voice = useVoice({ lang: "ar-EG", onResult: (t) => setQ(t) });
  const handleVoice = () => { voice.toggle(); };

  // Fetch featured listings
  useEffect(() => {
    listingApi.nearby({ lat: 30.0444, lng: 31.2357, radius: 50000, limit: 6, sort: 'distance' })
      .then(r => { if (r.data.listings?.length > 0) setFeaturedListings(r.data.listings.map(adaptListing)); })
      .catch(() => {});
  }, []);

  if (selectedCat) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
        <TopBar title={selectedCat.label} onBack={() => setSelectedCat(null)} onHome={back} />
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          <div style={{ fontSize: 11, color: G.muted, letterSpacing: 1.5, fontWeight: 700, marginBottom: 12 }}>
            {selectedCat.emoji} SUBCATEGORIES
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {selectedCat.subs.map(sub => (
              <button key={sub} onClick={() => go("buy_list", { cat: { id: selectedCat.id, label: sub } })}
                style={{
                  background: G.card, border: `1.5px solid ${G.border}`,
                  borderRadius: 14, padding: "14px 12px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit",
                  transition: "all .15s", textAlign: "left"
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = G.green; e.currentTarget.style.background = G.greenDim; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.background = G.card; }}>
                <span style={{ fontSize: 20 }}>{selectedCat.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: G.text2 }}>{sub}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: G.muted, letterSpacing: 1.5, fontWeight: 700, marginBottom: 12 }}>FEATURED</div>
          {featuredListings.filter(p => p.category === selectedCat.id || selectedCat.id === "phones" && p.category === "phones").slice(0, 4).map(p => (
            <BuyCard key={p.id} item={p} onClick={() => go("product", p)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title="Browse & Buy" onBack={back} onHome={back} />
      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {/* Big search + voice */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            background: G.card, borderRadius: 16,
            border: `2px solid ${voice.listening ? G.green : G.border}`,
            display: "flex", alignItems: "center", padding: "0 14px", gap: 10,
            transition: "border .2s", marginBottom: 10,
            boxShadow: `0 2px 12px ${G.shadow}`
          }}>
            <span style={{ fontSize: 18, color: G.muted, display: "flex" }}><Icon.Search size={18} col={G.muted} /></span>
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search anything: phones, laptops, PS5…"
              style={{
                flex: 1, border: "none", outline: "none", fontSize: 15,
                color: G.text, padding: "16px 0", background: "transparent", fontFamily: "inherit",
                fontWeight: 500
              }} />
            {q && <button onClick={() => setQ("")} style={{ background: "none", border: "none", color: G.muted, cursor: "pointer", fontSize: 18 }}>✕</button>}
          </div>
          <button onClick={handleVoice} style={{
            width: "100%", height: 48, borderRadius: 14,
            background: voice.listening ? G.cyan : G.green, border: "none", cursor: "pointer", fontSize: 15,
            fontWeight: 800, color: "#fff", fontFamily: "inherit",
            boxShadow: `0 4px 14px ${voice.listening ? G.cyan : G.green}55`,
            animation: voice.listening ? "rippleGreen 1s infinite" : "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background .3s"
          }}>
            <Icon.Mic size={20} col="#fff" />
            {voice.listening ? "🔴 Listening… Speak now" : "Tap to voice search"}
          </button>
        </div>
        {voice.listening && (
          <div style={{
            background: G.cyanDim, border: `1px solid ${G.cyan}44`, borderRadius: 12,
            padding: "10px 14px", marginBottom: 12, fontSize: 12, color: G.cyan, fontWeight: 700
          }}>
            🔴 Listening — try "Find iPhone 13 under 20,000 EGP near me"
          </div>
        )}
        <div style={{ fontSize: 11, color: G.muted, letterSpacing: 1.5, fontWeight: 700, marginBottom: 12 }}>ALL CATEGORIES</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 20 }}>
          {FULL_CATS.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCat(cat)}
              style={{
                background: G.card, border: `1.5px solid ${G.border}`,
                borderRadius: 14, padding: "13px 12px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit",
                transition: "all .15s", textAlign: "left"
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = G.green; e.currentTarget.style.background = G.greenDim; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.background = G.card; }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{cat.emoji}</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: G.text }}>{cat.label}</div>
                <div style={{ fontSize: 9, color: G.muted, marginTop: 2 }}>{cat.subs.length} subcategories</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: G.muted, letterSpacing: 1.5, fontWeight: 700, marginBottom: 12 }}>FEATURED NEAR YOU</div>
        {featuredListings.slice(0, 3).map(p => (
          <BuyCard key={p.id} item={p} onClick={() => go("product", p)} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BUY — LIST
═══════════════════════════════════════════════════════════ */
function BuyList({ go, back, data, T }) {
  const [sort, setSort] = useState("distance");
  const [q, setQ] = useState("");
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const searchQuery = data?.query || q;
    if (searchQuery) {
      listingApi.search({ q: searchQuery, limit: 50 })
        .then(r => { if (r.data.listings?.length > 0) setAllItems(r.data.listings.map(adaptListing)); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      listingApi.nearby({ lat: 30.0444, lng: 31.2357, radius: 50000, limit: 50, sort: 'distance' })
        .then(r => { if (r.data.listings?.length > 0) setAllItems(r.data.listings.map(adaptListing)); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [data?.query]);

  const items = [...allItems]
    .filter(p => {
      if (data?.cat?.id && data.cat.id !== "all") {
        if (!p.name.toLowerCase().includes(data.cat.id) && p.category !== data.cat.id) {
          const label = (data.cat.label || "").toLowerCase();
          if (!p.name.toLowerCase().includes(label.split(" ")[0]) && p.category !== data.cat.id) return false;
        }
      }
      if (q) return p.name.toLowerCase().includes(q.toLowerCase()) || (p.brand || '').toLowerCase().includes(q.toLowerCase());
      return true;
    })
    .sort((a, b) => sort === "price" ? a.price - b.price : sort === "rating" ? b.rating - a.rating : a.km - b.km);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title={data?.cat?.label || "All Items"} onBack={back} onHome={back} />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{
            flex: 1, background: G.card, borderRadius: 13,
            border: `1.5px solid ${G.border}`, display: "flex",
            alignItems: "center", padding: "0 12px", gap: 8
          }}>
            <span style={{ color: G.muted }}>🔍</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
              style={{
                flex: 1, border: "none", outline: "none", fontSize: 13,
                color: G.text, padding: "11px 0", background: "transparent", fontFamily: "inherit"
              }} />
          </div>
          <button onClick={() => go("voice_search")} style={{
            width: 44, height: 44,
            borderRadius: 12, background: G.green, border: "none", cursor: "pointer",
            fontSize: 18, boxShadow: `0 3px 10px ${G.greenGlow}`
          }}>🎙️</button>
        </div>
        <FilterRow options={[{ v: "distance", l: "Distance" }, { v: "price", l: "Price" }, { v: "rating", l: "Rating" }]}
          value={sort} onChange={setSort} />
        {items.map(p => <BuyCard key={p.id} item={p} onClick={() => go("product", p)} />)}
      </div>
    </div>
  );
}

function BuyCard({ item: p, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: G.card, border: `1px solid ${G.border}`,
      borderRadius: 16, padding: 13, marginBottom: 10, display: "flex", gap: 12,
      cursor: "pointer", boxShadow: `0 2px 12px ${G.shadow}`, transition: "all .15s"
    }}>
      <ProductImg src={p.img} size={76} radius={13} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }}>{p.name}</div>
        <div style={{ fontSize: 15, fontWeight: 900, color: G.green, marginBottom: 5 }}>
          {p.price.toLocaleString()} EGP
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Stars n={p.rating} size={11} />
          <Chip col={G.green} sm>📍 {p.km} km</Chip>
          <Chip col={G.green} sm>✓ Verified</Chip>
        </div>
        <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>{p.condition} · {p.seller}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   VOICE SEARCH — Smart Kaero filter
═══════════════════════════════════════════════════════════ */
function VoiceSearch({ back, go, T }) {
  const [phase, setPhase] = useState(0); // 0=idle 1=listening 2=processing 3=results
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const examples = [
    '"Find me an iPhone 13 under 20,000 EGP within 2 km"',
    '"Sony headphones under 9,000 EGP near Maadi"',
    '"Best MacBook Air deals around me"',
    '"بيع أيفون قريب مني بأقل سعر"',
  ];

  const voice = useVoice({
    lang: "ar-EG",
    onResult: (t) => { setQuery(t); },
    onEnd: () => {
      if (query || voice.transcript) {
        const q = voice.transcript || query;
        if (q.trim().length > 2) runAiSearch(q);
      }
    },
  });

  // Fetch real listings for search pool
  const [searchPool, setSearchPool] = useState([]);
  useEffect(() => {
    listingApi.nearby({ lat: 30.0444, lng: 31.2357, radius: 50000, limit: 50 })
      .then(r => { if (r.data.listings?.length > 0) setSearchPool(r.data.listings.map(adaptListing)); })
      .catch(() => {});
  }, []);

  const localFilter = (q) => {
    const lq = q.toLowerCase();
    let filtered = [...searchPool];

    // Extract item/brand/category keywords
    const catKeywords = {
      "iphone": ["phones"], "samsung": ["phones"], "galaxy": ["phones"], "phone": ["phones"], "phones": ["phones"],
      "macbook": ["computers"], "laptop": ["computers"], "computer": ["computers"],
      "sony": ["audio"], "headphones": ["audio"], "earbuds": ["audio"], "speaker": ["audio"],
      "ps5": ["gaming"], "playstation": ["gaming"], "xbox": ["gaming"], "nintendo": ["gaming"], "gaming": ["gaming"],
      "ipad": ["tablets"], "tablet": ["tablets"],
      "canon": ["cameras"], "camera": ["cameras"], "nikon": ["cameras"],
      "dji": ["drones"], "drone": ["drones"],
    };
    let matchedName = false;
    for (const kw of Object.keys(catKeywords)) {
      if (lq.includes(kw)) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(kw) || p.brand.toLowerCase().includes(kw) || catKeywords[kw].includes(p.category));
        matchedName = true;
        break;
      }
    }

    // Extract max price - support various formats
    const pricePatterns = [
      /under\s+([\d,]+)/i, /less\s+than\s+([\d,]+)/i, /below\s+([\d,]+)/i,
      /أقل\s+من\s+([\d,]+)/i, /max\s+([\d,]+)/i, /budget\s+([\d,]+)/i,
      /under\s+([\d]+)k/i, /below\s+([\d]+)k/i,
    ];
    for (const pat of pricePatterns) {
      const m = q.match(pat);
      if (m) {
        let maxP = parseInt(m[1].replace(/,/g, ""));
        if (q.match(/\d+k/i) && maxP < 1000) maxP *= 1000;
        if (!isNaN(maxP)) filtered = filtered.filter(p => p.price <= maxP);
        break;
      }
    }

    // Extract distance
    const distMatch = q.match(/within\s+([\d.]+)\s*km|(\d+)\s*km/i);
    if (distMatch) {
      const maxKm = parseFloat(distMatch[1] || distMatch[2]);
      if (!isNaN(maxKm)) filtered = filtered.filter(p => p.km <= maxKm);
    }

    // Extract color
    const colors = ["black", "white", "silver", "gold", "green", "blue", "red", "titanium", "gray", "grey", "space gray"];
    for (const c of colors) {
      if (lq.includes(c)) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(c) || p.desc?.toLowerCase().includes(c));
        break;
      }
    }

    return filtered.sort((a, b) => a.km - b.km);
  };

  const runAiSearch = async (q) => {
    setPhase(3);
    setAiThinking(true);
    const localRes = localFilter(q);
    const productsSummary = searchPool.slice(0, 12).map(p =>
      `id:${p.id} name:"${p.name}" price:${p.price} km:${p.km} category:${p.category || ''}`
    ).join("\n");
    const ai = await callClaude(
      `User voice query: "${q}"\n\nAvailable products:\n${productsSummary}\n\nReturn JSON: { "matchedIds": [array of best matching product ids in order], "explanation": "why these match" }`,
      "You are Kaero's AI voice search. Analyze the user's spoken query and find the best matching products. Consider item type, price constraints, distance, brand. Return only JSON."
    );
    setAiThinking(false);
    if (ai?.matchedIds?.length > 0) {
      const ordered = ai.matchedIds.map(id => searchPool.find(p => p.id === id)).filter(Boolean);
      const rest = localRes.filter(p => !ai.matchedIds.includes(p.id));
      setResults([...ordered, ...rest]);
      setAiExplanation(ai.explanation || "");
    } else {
      setResults(localRes);
    }
  };

  const handleStart = () => {
    if (!voice.supported) {
      // fallback demo
      const q = "Find me an iPhone 13 under 30,000 EGP within 2 km";
      setQuery(q);
      setPhase(1);
      setTimeout(() => runAiSearch(q), 1500);
    } else {
      setPhase(1);
      voice.start();
    }
  };

  const handleStop = () => {
    voice.stop();
    if (voice.transcript || query) {
      runAiSearch(voice.transcript || query);
    }
  };

  const handleExample = (ex) => {
    const clean = ex.replace(/"/g, "");
    setQuery(clean);
    setPhase(1);
    setTimeout(() => runAiSearch(clean), 800);
  };

  const isListening = voice.listening || phase === 1;
  const showResults = phase === 3;
  const liveTranscript = voice.transcript || query;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title="Kaero Voice Search" onBack={back} onHome={back} />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div onClick={isListening ? handleStop : handleStart} style={{
            width: 110, height: 110,
            borderRadius: "50%", background: isListening ? G.greenDim : aiThinking ? G.greenDim : "#FFFFFF",
            border: `3px solid ${isListening ? G.cyan : aiThinking ? G.green : G.green}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", cursor: "pointer",
            transition: "all .3s",
            boxShadow: isListening ? `0 0 0 16px ${G.accent}20,0 0 32px ${G.accent}44` : `0 0 24px ${G.greenGlow}`,
            animation: isListening ? "rippleGreen 1.2s ease infinite" : aiThinking ? "pulse 1s ease infinite" : "none"
          }}>
            {isListening ? <Icon.Mic size={44} col={G.cyan} /> : aiThinking ? <LogoK size={52} dark={false} /> : <LogoK size={64} />}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: G.text, marginBottom: 6 }}>
            {isListening ? "🔴 Listening… tap to stop" : aiThinking ? "🤖 Kaero AI Analyzing…" : showResults ? "✅ Results found!" : "Tap to speak"}
          </div>
          {liveTranscript && isListening && (
            <div style={{ background: G.cyanDim, border: `1px solid ${G.cyan}44`, borderRadius: 12, padding: "8px 14px", marginTop: 8, fontSize: 13, color: G.cyan, fontStyle: "italic" }}>
              "{liveTranscript}"
            </div>
          )}
          <div style={{ fontSize: 13, color: G.muted, marginTop: 6 }}>
            {isListening ? "Speak in Arabic or English. Tap again to stop" : "Understands: item name · max price · distance · color · location"}
          </div>
          {showResults && query && (
            <div style={{ background: G.cyanDim, border: `1px solid ${G.cyan}44`, borderRadius: 12, padding: "10px 14px", marginTop: 14, fontSize: 13, color: G.cyan, fontWeight: 700 }}>
              🔍 "{query}"
              {aiExplanation ? <div style={{ fontSize: 11, color: G.muted, marginTop: 4, fontWeight: 400 }}>🤖 {aiExplanation}</div> : null}
            </div>
          )}
        </div>

        {/* Kaero filter chips */}
        {showResults && results.length > 0 && (() => {
          const lq = query.toLowerCase();
          const chips = [];
          const items = ["iphone", "macbook", "sony", "samsung", "ps5", "ipad", "canon", "dji", "headphones"];
          for (const kw of items) { if (lq.includes(kw)) { chips.push({ ic: "📱", lb: kw.charAt(0).toUpperCase() + kw.slice(1) + "s", col: G.green }); break; } }
          const pm = query.match(/under\s+([\d,]+)/i); if (pm) chips.push({ ic: "💰", lb: `Under ${pm[1]} EGP`, col: G.green });
          const dm = query.match(/within\s+([\d.]+)\s*km/i); if (dm) chips.push({ ic: "📍", lb: `Within ${dm[1]}km`, col: G.cyan });
          return chips.length > 0 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, justifyContent: "center" }}>
              {chips.map((c, i) => <Chip key={i} col={c.col} sm>{c.ic} {c.lb}</Chip>)}
            </div>
          ) : null;
        })()}

        {!isListening && !aiThinking && !showResults && (
          <div>
            <div style={{ fontSize: 11, color: G.muted, letterSpacing: 1.5, fontWeight: 700, marginBottom: 10 }}>TRY SAYING</div>
            {examples.map((ex, i) => (
              <div key={i} onClick={() => handleExample(ex)} style={{
                background: G.card, border: `1px solid ${G.border}`, borderRadius: 13,
                padding: "12px 14px", marginBottom: 8, fontSize: 13, color: G.text2, fontStyle: "italic", cursor: "pointer"
              }}>{ex}</div>
            ))}
            {!voice.supported && (
              <div style={{ background: G.cyanDim, borderRadius: 12, padding: "10px 14px", marginTop: 8, fontSize: 12, color: G.cyan }}>
                💡 Voice not supported in this browser — tap an example above or type below
              </div>
            )}
          </div>
        )}

        {aiThinking && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            {[["🔍", "Parsing your voice query…"], ["🤖", "Matching items with AI…"], ["📍", "Sorting by proximity…"]].map(([ic, lb], i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", background: G.card, borderRadius: 12, padding: "10px 16px", marginBottom: 8, animation: `fadeUp .3s ${i * 0.15}s both` }}>
                <span style={{ fontSize: 16 }}>{ic}</span>
                <span style={{ fontSize: 13, color: G.text2 }}>{lb}</span>
                <div style={{ marginLeft: "auto", width: 16, height: 16, borderRadius: "50%", border: `2px solid ${G.green}`, borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
              </div>
            ))}
          </div>
        )}

        {showResults && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: G.muted }}>{results.length} results found by Kaero AI</div>
              <div onClick={() => { setPhase(0); setQuery(""); setResults([]); setAiExplanation(""); }} style={{ fontSize: 12, color: G.cyan, cursor: "pointer", fontWeight: 700 }}>🎙️ New Search</div>
            </div>
            {results.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 20px", color: G.muted, fontSize: 14 }}>
                <div style={{ marginBottom: 12, fontSize: 40 }}>🔍</div>
                No items match your search. Try adjusting price or distance.
              </div>
            ) : results.map(p => (
              <BuyCard key={p.id} item={p} onClick={() => go("product", p)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PRODUCT DETAIL — with carousel, reviews, offer page
═══════════════════════════════════════════════════════════ */
const PRODUCT_IMGS = {
  1: [
    "https://placehold.co/400x400/019F45/white?text=Kaero",
    "https://placehold.co/400x400/019F45/white?text=Kaero",
    "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=400&q=80",
  ],
  2: [
    "https://placehold.co/400x400/019F45/white?text=Kaero",
    "https://placehold.co/400x400/019F45/white?text=Kaero",
    "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400&q=80",
  ],
  3: [
    "https://placehold.co/400x400/019F45/white?text=Kaero",
    "https://placehold.co/400x400/019F45/white?text=Kaero",
    "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&q=80",
  ],
  4: [
    "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400&q=80",
    "https://images.unsplash.com/photo-1519638399535-1b036603ac77?w=400&q=80",
    "https://images.unsplash.com/photo-1587732608058-5ccfedd35c2c?w=400&q=80",
  ],
  5: [
    "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&q=80",
    "https://images.unsplash.com/photo-1589003077984-894e133dabab?w=400&q=80",
    "https://images.unsplash.com/photo-1561154464-82e9adf32764?w=400&q=80",
  ],
  6: [
    "https://placehold.co/400x400/019F45/white?text=Kaero",
    "https://placehold.co/400x400/019F45/white?text=Kaero",
    "https://images.unsplash.com/photo-1622297845775-5ff3fef71d13?w=400&q=80",
  ],
  7: [
    "https://placehold.co/400x400/019F45/white?text=Kaero",
    "https://placehold.co/400x400/019F45/white?text=Kaero",
    "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=400&q=80",
  ],
  8: [
    "https://placehold.co/400x400/019F45/white?text=Kaero",
    "https://placehold.co/400x400/019F45/white?text=Kaero",
    "https://placehold.co/400x400/019F45/white?text=Kaero",
  ],
};

function ProductDetail({ item, back, go, T }) {
  const p = item || { name: "Item", price: 0, img: "", seller: "Seller", sellerTrust: 0, desc: "", km: 0, rating: 0, condition: "Good" };
  const imgs = useMemo(() => {
    if (p.additionalImgs?.length > 0) return [p.img, ...p.additionalImgs].filter(Boolean);
    if (PRODUCT_IMGS[p.id]) return PRODUCT_IMGS[p.id];
    return [p.img].filter(Boolean);
  }, [p]);
  const [imgIdx, setImgIdx] = useState(0);
  const [liked, setLiked] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [tab, setTab] = useState("info");
  const [safetyStep, setSafetyStep] = useState(0);
  const [showSafety, setShowSafety] = useState(false);
  const [sellerReviews, setSellerReviews] = useState([]);
  const [sellerStats, setSellerStats] = useState(null);

  // Fetch seller reviews and stats
  useEffect(() => {
    if (p.sellerId && typeof p.sellerId === 'string') {
      userApi.get(p.sellerId).then(r => {
        const u = r.data.user || r.data;
        setSellerStats({
          trustScore: u.trust_score,
          totalReviews: u.total_reviews || 0,
          rating: u.trust_score,
        });
      }).catch(() => {});

      reviewApi.byUser(p.sellerId).then(r => {
        if (r.data.reviews?.length > 0) {
          setSellerReviews(r.data.reviews.map(rv => ({
            from: rv.reviewer_name || 'User',
            av: (rv.reviewer_name || 'U')[0].toUpperCase(),
            rating: rv.rating,
            text: rv.review_text || '',
            time: timeAgo(rv.created_at),
          })));
        }
      }).catch(() => {});
    }

    // Toggle favorite
    if (p._raw?.id && liked) {
      favoriteApi.toggle(p._raw.id).catch(() => {});
    }
  }, [p.sellerId]);

  const handleLike = () => {
    setLiked(!liked);
    if (p._raw?.id) favoriteApi.toggle(p._raw.id).catch(() => {});
  };

  if (offerOpen) return (
    <OfferPage p={p} back={() => setOfferOpen(false)} go={go} />
  );

  if (showSafety) return (
    <SafetyMeeting p={p} back={() => setShowSafety(false)} go={go} />
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      {/* Image carousel */}
      <div style={{ position: "relative", height: 240, background: G.card, flexShrink: 0, overflow: "hidden" }}>
        <img src={imgs[imgIdx]} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={e => e.target.style.display = "none"} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(13,17,23,.8) 0%,transparent 60%)" }} />
        {/* Carousel dots */}
        {imgs.length > 1 && (
          <div style={{ position: "absolute", bottom: 52, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
            {imgs.map((_, i) => (
              <div key={i} onClick={() => setImgIdx(i)} style={{
                width: i === imgIdx ? 20 : 7, height: 7,
                borderRadius: 99, background: i === imgIdx ? "#fff" : "rgba(255,255,255,.4)",
                cursor: "pointer", transition: "all .2s"
              }} />
            ))}
          </div>
        )}
        {/* prev/next */}
        {imgs.length > 1 && imgIdx > 0 && (
          <button onClick={() => setImgIdx(i => i - 1)} style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,.55)", border: "none",
            cursor: "pointer", fontSize: 16, color: "#fff"
          }}>‹</button>
        )}
        {imgs.length > 1 && imgIdx < imgs.length - 1 && (
          <button onClick={() => setImgIdx(i => i + 1)} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,.55)", border: "none",
            cursor: "pointer", fontSize: 16, color: "#fff"
          }}>›</button>
        )}
        <button onClick={back} style={{
          position: "absolute", top: 14, left: 14, width: 38, height: 38,
          borderRadius: 12, background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)",
          border: "none", cursor: "pointer", fontSize: 20, color: G.text
        }}>‹</button>
        <button onClick={() => go("home")} style={{
          position: "absolute", top: 14, right: 54, width: 38, height: 38,
          borderRadius: 12, background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)",
          border: "none", cursor: "pointer", fontSize: 16
        }}>🏠</button>
        <button onClick={handleLike} style={{
          position: "absolute", top: 14, right: 10, width: 38, height: 38,
          borderRadius: 12, background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)",
          border: "none", cursor: "pointer", fontSize: 20
        }}>{liked ? "❤️" : "🤍"}</button>
        <div style={{ position: "absolute", bottom: 12, left: 14 }}>
          <Chip col={G.green}>✓ {imgs.length} Verified Photos</Chip>
        </div>
        <div style={{ position: "absolute", bottom: 12, right: 14 }}>
          <Chip col={G.green}>🛡️ Protected</Chip>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 110px" }}>
        <div style={{ fontSize: 21, fontWeight: 900, color: G.text, marginBottom: 4 }}>{p.name}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: G.green, marginBottom: 8 }}>
          {p.price.toLocaleString()} EGP
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
          <Chip col={G.green}>{p.condition}</Chip>
          <Chip col={G.green}>📍 {p.km} km</Chip>
          <Chip col={G.indigo}>🛡️ 7-Day Escrow</Chip>
        </div>
        <div style={{
          display: "flex", background: G.card, borderRadius: 12, padding: 4, marginBottom: 16,
          border: `1px solid ${G.border}`
        }}>
          {["info", "seller", "reviews", "protection"].map(t => (
            <div key={t} onClick={() => setTab(t)} style={{
              flex: 1, textAlign: "center",
              padding: "7px", borderRadius: 10,
              background: tab === t ? G.cardHi : "transparent",
              color: tab === t ? G.green : G.muted, fontSize: 10, fontWeight: 700,
              cursor: "pointer", transition: "all .2s"
            }}>
              {t === "info" ? "ℹ️ Info" : t === "seller" ? "👤 Seller" : t === "reviews" ? "⭐ Reviews" : "🛡️ Safety"}
            </div>
          ))}
        </div>
        {tab === "info" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 8 }}>Description</div>
            <div style={{ fontSize: 13, color: G.text2, lineHeight: 1.8, marginBottom: 16 }}>{p.desc}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["Brand", p.brand], ["Condition", p.condition], ["Distance", `${p.km} km`], ["Rating", `${p.rating} ★`]].map(([k, v]) => (
                <div key={k} style={{
                  background: G.card, borderRadius: 12, padding: "10px 12px",
                  border: `1px solid ${G.border}`
                }}>
                  <div style={{ fontSize: 10, color: G.muted, marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "seller" && (
          <div>
            <div style={{
              background: G.card, borderRadius: 16, padding: 14,
              border: `1px solid ${G.border}`, marginBottom: 12
            }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <Av letter={p.sellerId[0]} size={50} img={p.sellerImg || SELLER_IMGS[p.sellerId]} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: G.text, fontSize: 15 }}>{p.seller}</div>
                  <Stars n={p.sellerRating} />
                  <div style={{ fontSize: 11, color: G.muted }}>{p.sellerReviews} reviews</div>
                </div>
                <button onClick={() => go("chat", p)} style={{
                  background: G.greenDim,
                  border: `1.5px solid ${G.green}44`, borderRadius: 10,
                  padding: "8px 13px", fontSize: 12, fontWeight: 700,
                  color: G.green, cursor: "pointer", fontFamily: "inherit"
                }}>💬 Chat</button>
              </div>
              <div style={{
                background: G.cardHi, borderRadius: 10, padding: "10px 12px",
                border: `1px solid ${G.border}`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: G.muted }}>Trust Score</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: G.green }}>{p.sellerTrust}/100</span>
                </div>
                <div style={{ background: G.border, borderRadius: 99, height: 5, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${p.sellerTrust}%`,
                    background: `linear-gradient(90deg,${G.green},${G.green})`, borderRadius: 99
                  }} />
                </div>
              </div>
            </div>
            <Btn full col={G.green} onClick={() => go("seller_store", p)}>
              View {p.seller.split(" ")[0]}'s Store →
            </Btn>
          </div>
        )}
        {tab === "reviews" && (
          <div>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
              background: G.card, borderRadius: 14, padding: 14, border: `1px solid ${G.border}`
            }}>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: G.cyan }}>{p.rating}</div>
                <div style={{ color: G.cyan, fontSize: 14 }}>{"★".repeat(Math.floor(p.rating))}</div>
                <div style={{ fontSize: 10, color: G.muted }}>{p.reviews} reviews</div>
              </div>
              <div style={{ flex: 1 }}>
                {[5, 4, 3, 2, 1].map(star => (
                  <div key={star} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: G.muted, width: 8 }}>{star}</span>
                    <div style={{ flex: 1, background: G.border, borderRadius: 99, height: 5, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", background: G.cyan, borderRadius: 99,
                        width: `${star === 5 ? 70 : star === 4 ? 20 : star === 3 ? 7 : 3}%`
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {(sellerReviews.length > 0 ? sellerReviews : [
              { from: "Youssef M.", av: "Y", rating: 5, text: "Item exactly as described! Very honest seller, quick meetup.", time: "3 days ago" },
              { from: "Sara K.", av: "S", rating: 5, text: "Fast response, great condition, no issues at all.", time: "1 week ago" },
              { from: "Karim H.", av: "K", rating: 4, text: "Legit seller, minor delay but communicated well throughout.", time: "2 weeks ago" },
            ]).map((r, i) => (
              <div key={i} style={{
                background: G.card, borderRadius: 14, padding: 14,
                marginBottom: 10, border: `1px solid ${G.border}`
              }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <Av letter={r.av} size={36} img={SELLER_IMGS[r.av]} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: G.text, fontSize: 13 }}>{r.from}</div>
                    <div style={{ color: G.cyan, fontSize: 11 }}>{"★".repeat(r.rating)}</div>
                  </div>
                  <div style={{ fontSize: 10, color: G.muted }}>{r.time}</div>
                </div>
                <div style={{ fontSize: 13, color: G.text2, lineHeight: 1.5 }}>{r.text}</div>
              </div>
            ))}
          </div>
        )}
        {tab === "protection" && (
          <div>
            <div style={{
              background: G.greenDim, border: `1.5px solid ${G.green}44`,
              borderRadius: 16, padding: 16, marginBottom: 12
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: G.green, marginBottom: 10 }}>
                🛡️ 7-Day Buyer Protection
              </div>
              {[["D1", "Payment captured, held in escrow"],
              ["D1 to D3", "3 day inspection window for buyer"],
              ["D3", "Dispute deadline: police report required"],
              ["D7", "Resolution & automatic payout to seller"],
              ].map(([day, desc]) => (
                <div key={day} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                  <div style={{
                    width: 32, height: 22, borderRadius: 6, background: G.green,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0
                  }}>{day}</div>
                  <div style={{ fontSize: 12, color: G.text2, paddingTop: 2 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{
        background: G.surface, borderTop: `1px solid ${G.border}`,
        padding: "12px 16px 18px", flexShrink: 0
      }}>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn col={G.green} outline style={{ flex: 1 }} onClick={() => setOfferOpen(true)}>Make Offer</Btn>
          <Btn col={G.green} style={{ flex: 2 }} onClick={() => { setTab("reviews"); setTimeout(() => setShowSafety(true), 800); }}>🛡️ Buy Safely</Btn>
        </div>
      </div>
    </div>
  );
}

/* ── Offer Page: exchange items + price + payment method ── */
function OfferPage({ p, back, go }) {
  const [offerAmt, setOfferAmt] = useState(String(p.price - 1000));
  const [payMethod, setPayMethod] = useState("escrow");
  const [selectedItem, setSelectedItem] = useState(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [myItems, setMyItems] = useState([]);

  // Fetch user's own listings for exchange
  useEffect(() => {
    const user = getStoredUser();
    if (user?.id) {
      listingApi.byUser(user.id).then(r => {
        if (r.data.listings?.length > 0) {
          setMyItems(r.data.listings.map(adaptListing).filter(l => !l.sold));
        }
      }).catch(() => {});
    }
  }, []);

  const handleSendOffer = async () => {
    setSending(true);
    const listingId = p._raw?.id || p.id;
    // If mock data (integer id), just do local flow
    if (typeof listingId === 'number') { setSent(true); setSending(false); return; }
    try {
      await offerApi.create({
        listing_id: listingId,
        offered_price: Number(offerAmt),
        message: '',
        is_exchange_proposal: !!selectedItem,
        exchange_listing_id: selectedItem?._raw?.id || undefined,
      });
      setSent(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Could not send offer');
    } finally {
      setSending(false);
    }
  };

  if (sent) return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title="Offer Sent" onBack={back} />
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: 24, textAlign: "center"
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%", background: G.greenDim,
          border: `3px solid ${G.green}`, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, marginBottom: 16, animation: "pulse 2s ease infinite",
          boxShadow: `0 0 30px ${G.greenGlow}`
        }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: G.text, marginBottom: 8 }}>Offer Sent!</div>
        <div style={{ fontSize: 13, color: G.muted, marginBottom: 24 }}>
          Your offer of {Number(offerAmt).toLocaleString()} EGP{selectedItem ? ` + ${selectedItem.name}` : ""} was sent to the seller.
        </div>
        <Btn full col={G.green} onClick={back}>← Back to Item</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title="Make an Offer" onBack={back} />
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 20px" }}>
        {/* Item being offered on */}
        <div style={{
          background: G.card, borderRadius: 14, padding: 12, marginBottom: 16,
          border: `1px solid ${G.border}`, display: "flex", gap: 12
        }}>
          <ProductImg src={p.img} size={52} radius={10} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{p.name}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: G.green }}>{p.price.toLocaleString()} EGP</div>
          </div>
        </div>

        {/* Price offer */}
        <div style={{ fontSize: 12, fontWeight: 700, color: G.text2, marginBottom: 8 }}>Your Price Offer (EGP)</div>
        <input value={offerAmt} onChange={e => setOfferAmt(e.target.value)}
          style={{
            width: "100%", background: G.cardHi, border: `2px solid ${G.green}`,
            borderRadius: 12, padding: "14px 16px", fontSize: 20, fontWeight: 900,
            color: G.green, outline: "none", fontFamily: "inherit", marginBottom: 16
          }} />

        {/* Payment method */}
        <div style={{ fontSize: 12, fontWeight: 700, color: G.text2, marginBottom: 10 }}>Payment Method</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[{ v: "escrow", ic: "🛡️", lb: "Escrow", sub: "Safest" }, { v: "cash", ic: "💵", lb: "Cash", sub: "Meet in person" }, { v: "visa", ic: "💳", lb: "Card", sub: "Visa/MC" }].map(m => (
            <button key={m.v} onClick={() => setPayMethod(m.v)} style={{
              background: payMethod === m.v ? G.greenDim : G.cardHi,
              border: `2px solid ${payMethod === m.v ? G.green : G.border}`,
              borderRadius: 12, padding: "11px 6px", cursor: "pointer", fontFamily: "inherit",
              textAlign: "center", transition: "all .2s"
            }}>
              <div style={{ fontSize: 20, marginBottom: 3 }}>{m.ic}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: payMethod === m.v ? G.green : G.text }}>{m.lb}</div>
              <div style={{ fontSize: 9, color: G.muted }}>{m.sub}</div>
            </button>
          ))}
        </div>

        {/* Exchange offer - my items */}
        <div style={{ fontSize: 12, fontWeight: 700, color: G.text2, marginBottom: 10 }}>
          Add Exchange Item (optional)
        </div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
          <div onClick={() => setSelectedItem(null)} style={{
            flexShrink: 0, width: 80, height: 90,
            borderRadius: 12, border: `2px solid ${!selectedItem ? G.green : G.border}`,
            background: !selectedItem ? G.greenDim : G.cardHi,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexDirection: "column", gap: 4
          }}>
            <div style={{ fontSize: 20 }}>🚫</div>
            <div style={{ fontSize: 9, color: G.muted, fontWeight: 700 }}>No Exchange</div>
          </div>
          {myItems.map(mi => (
            <div key={mi.id} onClick={() => setSelectedItem(mi)}
              style={{
                flexShrink: 0, width: 80, borderRadius: 12,
                border: `2px solid ${selectedItem?.id === mi.id ? G.green : G.border}`,
                background: selectedItem?.id === mi.id ? G.greenDim : G.cardHi,
                overflow: "hidden", cursor: "pointer"
              }}>
              <div style={{ height: 55, overflow: "hidden" }}>
                <img src={mi.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={e => e.target.style.display = "none"} />
              </div>
              <div style={{ padding: "5px 6px" }}>
                <div style={{
                  fontSize: 8, fontWeight: 700, color: G.text,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>{mi.name}</div>
                <div style={{ fontSize: 9, fontWeight: 900, color: G.green }}>{(mi.price / 1000).toFixed(0)}K</div>
              </div>
            </div>
          ))}
        </div>

        {selectedItem && (
          <div style={{
            background: G.greenDim, border: `1.5px solid ${G.green}55`,
            borderRadius: 12, padding: "10px 14px", marginBottom: 16,
            display: "flex", gap: 10, alignItems: "center"
          }}>
            <span style={{ fontSize: 16 }}>🔄</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: G.green }}>Exchange: {selectedItem.name}</div>
              <div style={{ fontSize: 11, color: G.muted }}>≈ {selectedItem.price.toLocaleString()} EGP + {Number(offerAmt).toLocaleString()} EGP cash</div>
            </div>
          </div>
        )}

        <Btn full col={G.green} onClick={handleSendOffer} disabled={sending}>
          🚀 Send Offer →
        </Btn>
      </div>
    </div>
  );
}

/* ── Safety Meeting flow ── */
function SafetyMeeting({ p, back, go, T }) {
  const [step, setStep] = useState(0);
  const steps = [
    { ic: "👥", title: "Meet the Seller", desc: "Always meet in a public, busy place: a mall, café, or police station parking lot. Never at private homes for first meetings.", btn: "Got it, Next →" },
    { ic: "🔍", title: "Inspect the Item", desc: "Test all functions. Check serial numbers match. Verify IMEI for phones. Take your time, don't rush.", btn: "Item looks good →" },
    { ic: "🛡️", title: "Pay via Escrow", desc: "Never pay cash before inspecting. Use Kaero escrow, your money stays safe until you confirm the item.", btn: "Pay with Escrow →" },
    { ic: "✅", title: "Confirm Receipt", desc: "After inspection, release payment from app. Both parties get a review request. Your protection lasts 7 days.", btn: "Proceed to Payment" },
  ];
  const cur = steps[step];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title="Safe Buy Guide" onBack={back} />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px" }}>
        {/* progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 99,
              background: i <= step ? G.green : G.border, transition: "background .3s"
            }} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%", background: G.greenDim,
            border: `3px solid ${G.green}`, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, margin: "0 auto 16px", boxShadow: `0 4px 20px ${G.greenGlow}`
          }}>{cur.ic}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: G.text, marginBottom: 10 }}>{cur.title}</div>
          <div style={{ fontSize: 14, color: G.text2, lineHeight: 1.7 }}>{cur.desc}</div>
        </div>
        {/* Item summary */}
        <div style={{
          background: G.card, borderRadius: 14, padding: 13, marginBottom: 20,
          border: `1px solid ${G.border}`, display: "flex", gap: 12
        }}>
          <ProductImg src={p.img} size={52} radius={10} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{p.name}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: G.green }}>{p.price.toLocaleString()} EGP</div>
            <div style={{ fontSize: 11, color: G.muted }}>📍 {p.km} km away · {p.seller}</div>
          </div>
        </div>
        <Btn full col={G.green} onClick={() => step < 3 ? setStep(s => s + 1) : go("payment", p)}>
          {cur.btn}
        </Btn>
        {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{
          width: "100%", marginTop: 10, background: "none", border: "none",
          fontFamily: "inherit", fontSize: 13, color: G.muted, cursor: "pointer", padding: 8
        }}>← Back</button>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SELL — KAERO FLOW with Camera Simulator
═══════════════════════════════════════════════════════════ */
function Sell({ back, go, T }) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [flash, setFlash] = useState(false);
  const [description, setDescription] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCondition, setEditCondition] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrice, setEditPrice] = useState(17000);
  const [aiResult, setAiResult] = useState(null);

  const defaultResult = {
    title: "iPhone 13 Pro 256GB Alpine Green", category: "Electronics › Smartphones",
    price: 17000, condition: "Like New",
    priceRange: { low: 15500, avg: 16800, high: 18200 },
    desc: "Excellent condition iPhone 13 Pro in Alpine Green. 256GB storage. All original accessories and box included. Screen pristine, minor cosmetic wear on edges only. 8 months old.",
  };
  const result = aiResult || defaultResult;

  const voice = useVoice({
    lang: "ar-EG",
    onResult: (t) => setDescription(prev => prev ? prev + " " + t : t),
  });

  useEffect(() => {
    if (step === 2) {
      let p = 0;
      const iv = setInterval(() => {
        p += 1.6; setProgress(Math.min(p, 100));
        if (p >= 100) {
          clearInterval(iv);
          runKaeroAnalysis().then(() => setTimeout(() => setStep(3), 500));
        }
      }, 50);
      return () => clearInterval(iv);
    }
  }, [step]);

  const runKaeroAnalysis = async () => {
    const ai = await callClaude(
      `Analyze this item listing for a second-hand marketplace in Egypt.\nSeller description: "${description || "iPhone like new with box"}\nReturn JSON: { "title": "...", "category": "...", "condition": "Like New|Good|Fair|Used", "desc": "2-sentence listing", "price": <EGP number>, "priceRange": { "low": n, "avg": n, "high": n } }`,
      "You are Kaero AI Egypt marketplace assistant. Return only valid JSON."
    );
    if (ai?.title) {
      setAiResult(ai);
      setEditTitle(ai.title); setEditCategory(ai.category || ""); setEditCondition(ai.condition || "");
      setEditDesc(ai.desc || ""); setEditPrice(ai.price || 17000);
    } else {
      setEditTitle(defaultResult.title); setEditCategory(defaultResult.category);
      setEditCondition(defaultResult.condition); setEditDesc(defaultResult.desc); setEditPrice(defaultResult.price);
    }
  };

  const openEdit = () => {
    setEditTitle(result.title); setEditCategory(result.category); setEditCondition(result.condition);
    setEditDesc(result.desc); setEditPrice(result.price); setEditMode(true);
  };
  const saveEdit = () => {
    setAiResult({ ...result, title: editTitle, category: editCategory, condition: editCondition, desc: editDesc, price: editPrice });
    setEditMode(false);
  };
  const fileInputRef = useRef(null);

  const takePhoto = () => {
    setFlash(true); setTimeout(() => setFlash(false), 300);
    setTimeout(() => { setCapturedPhoto("https://placehold.co/400x400/019F45/white?text=Kaero"); setCameraOpen(false); setStep(1); }, 400);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1];
        try {
          const r = await uploadApi.base64(base64, file.type || 'image/jpeg');
          setCapturedPhoto(r.data.url);
        } catch {
          setCapturedPhoto(ev.target.result); // Use data URI as fallback
        }
        setCameraOpen(false);
        setStep(1);
      };
      reader.readAsDataURL(file);
    } catch {
      setCapturedPhoto("https://placehold.co/400x400/019F45/white?text=Kaero");
      setCameraOpen(false);
      setStep(1);
    }
  };

  const conditionMap = { "Like New": "like_new", "Excellent": "like_new", "Good": "good", "Fair": "fair", "Poor": "poor", "New": "new", "Used": "fair" };

  const handlePublish = async () => {
    setStep(4);
    try {
      await listingApi.create({
        user_edited_title: result.title,
        user_edited_description: result.desc,
        final_price: result.price,
        condition: conditionMap[result.condition] || 'good',
        lat: 30.0444,
        lng: 31.2357,
        primary_image_url: capturedPhoto || 'https://placehold.co/400x400/019F45/white?text=Kaero',
        verification_images: [{
          url: capturedPhoto || 'https://placehold.co/400x400/019F45/white?text=Kaero',
          timestamp: new Date().toISOString(),
          exif_data: null,
          hash: 'web-upload',
        }],
        ai_generated_title: aiResult?.title || result.title,
        ai_generated_description: aiResult?.desc || result.desc,
        ai_suggested_price: aiResult?.price || result.price,
        is_ai_generated: !!aiResult,
      });
      setTimeout(() => go("store"), 1500);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to publish. Please try again.');
      setStep(3);
    }
  };

  if (editMode) return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title="✏️ Edit Listing" onBack={() => setEditMode(false)} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 32px" }}>
        <div style={{ background: G.greenDim, borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: G.green }}>
          ✏️ Edit any field — tap Save when done
        </div>
        {[["Title", editTitle, setEditTitle], ["Category", editCategory, setEditCategory], ["Condition", editCondition, setEditCondition]].map(([lbl, val, set]) => (
          <div key={lbl} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: G.muted, textTransform: "uppercase", letterSpacing: .6, marginBottom: 5 }}>{lbl}</div>
            <input value={val} onChange={e => set(e.target.value)} style={{ width: "100%", background: G.card, border: `1.5px solid ${G.green}66`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: G.text, outline: "none", fontFamily: "inherit" }} />
          </div>
        ))}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: G.muted, textTransform: "uppercase", letterSpacing: .6, marginBottom: 5 }}>Description</div>
          <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ width: "100%", background: G.card, border: `1.5px solid ${G.green}66`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: G.text, outline: "none", fontFamily: "inherit", resize: "none", height: 100, lineHeight: 1.5 }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: G.muted, textTransform: "uppercase", letterSpacing: .6, marginBottom: 5 }}>Price (EGP)</div>
          <input type="number" value={editPrice} onChange={e => setEditPrice(Number(e.target.value))} style={{ width: "100%", background: G.card, border: `1.5px solid ${G.green}66`, borderRadius: 12, padding: "12px 14px", fontSize: 16, color: G.green, outline: "none", fontFamily: "inherit", fontWeight: 700 }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn col={G.muted} outline full onClick={() => setEditMode(false)}>Cancel</Btn>
          <Btn col={G.green} full onClick={saveEdit}>💾 Save Changes</Btn>
        </div>
      </div>
    </div>
  );

  if (cameraOpen) return (
    <div style={{ height: "100%", background: "#000", display: "flex", flexDirection: "column", position: "relative" }}>
      {flash && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: .8, zIndex: 20, pointerEvents: "none" }} />}
      <div style={{ flex: 1, position: "relative", background: "#000000", overflow: "hidden" }}>
        <img src="https://images.unsplash.com/photo-1696446700974-e4d18e396bcf?w=600&q=70" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: .75 }} />
        {[33, 66].map(p => (<div key={p}><div style={{ position: "absolute", top: 0, left: `${p}%`, width: 1, height: "100%", background: "rgba(255,255,255,.2)" }} /><div style={{ position: "absolute", top: `${p}%`, left: 0, width: "100%", height: 1, background: "rgba(255,255,255,.2)" }} /></div>))}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 120, height: 120 }}>
          {[{ top: 0, left: 0, bt: "top", bl: "left" }, { top: 0, right: 0, bt: "top", bl: "right" }, { bottom: 0, left: 0, bt: "bottom", bl: "left" }, { bottom: 0, right: 0, bt: "bottom", bl: "right" }].map((c, i) => (<div key={i} style={{ position: "absolute", width: 22, height: 22, borderTop: c.bt === "top" ? `2px solid ${G.green}` : "none", borderBottom: c.bt === "bottom" ? `2px solid ${G.green}` : "none", borderLeft: c.bl === "left" ? `2px solid ${G.green}` : "none", borderRight: c.bl === "right" ? `2px solid ${G.green}` : "none", ...c }} />))}
        </div>
        <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center" }}><div style={{ display: "inline-block", background: "rgba(0,0,0,.6)", borderRadius: 99, padding: "6px 14px", fontSize: 11, color: G.green, fontWeight: 700 }}>🤖 Kaero will auto-identify your item</div></div>
        <div style={{ position: "absolute", top: 14, left: 14, right: 14, display: "flex", justifyContent: "space-between" }}>
          <button onClick={() => setCameraOpen(false)} style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(0,0,0,.6)", border: "none", cursor: "pointer", fontSize: 18, color: "#fff" }}>✕</button>
          <div style={{ display: "flex", gap: 8 }}>{["⚡", "↩️", "⬜"].map((ic, i) => (<div key={i} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, cursor: "pointer" }}>{ic}</div>))}</div>
        </div>
      </div>
      <div style={{ background: "#111", padding: "20px 0 28px", display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
        <div onClick={() => fileInputRef.current?.click()} style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, cursor: "pointer" }}>📁</div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
        <button onClick={takePhoto} style={{ width: 72, height: 72, borderRadius: "50%", background: "#fff", border: "5px solid rgba(255,255,255,.3)", cursor: "pointer", boxShadow: "0 4px 20px rgba(255,255,255,.3)" }} />
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, cursor: "pointer" }}>🔄</div>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title={T?.sellAnItem2 || "Sell an Item"} onBack={back} onHome={back} />
      <div style={{ display: "flex", alignItems: "center", padding: "10px 16px 0", flexShrink: 0 }}>
        {["📸", "🎙️", "🤖", "🚀"].map((ic, i) => (
          <div key={i} style={{ display: "flex", flex: i < 3 ? 1 : "initial", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: step > i ? G.green : step === i ? G.greenDim : G.card, border: `2px solid ${step >= i ? G.green : G.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: step > i ? 14 : 16, transition: "all .3s" }}>{step > i ? "✓" : ic}</div>
              <div style={{ fontSize: 9, color: step === i ? G.green : G.muted, marginTop: 4, fontWeight: step === i ? 800 : 400 }}>{["Photo", "Voice", "AI Scan", "Publish"][i]}</div>
            </div>
            {i < 3 && <div style={{ flex: 1, height: 2, margin: "0 4px", background: step > i ? G.green : G.border, marginBottom: 14, transition: "background .4s" }} />}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }}>

        {step === 0 && (
          <>
            <button onClick={() => setCameraOpen(true)} style={{ width: "100%", background: `linear-gradient(135deg,${G.greenDim},${G.cardHi})`, border: `2px solid ${G.green}55`, borderRadius: 22, padding: "36px 20px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 14, fontFamily: "inherit" }}>
              <div style={{ width: 76, height: 76, borderRadius: "50%", background: G.greenDim, border: `2px solid ${G.green}55`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 24px ${G.greenGlow}` }}><Icon.Camera size={34} col={G.green} /></div>
              <div style={{ fontSize: 17, fontWeight: 800, color: G.text }}>Open Camera</div>
              <div style={{ fontSize: 12, color: G.muted, textAlign: "center" }}>In app only: guarantees listing authenticity</div>
              <div style={{ background: G.green, borderRadius: 12, padding: "10px 24px", color: "#fff", fontWeight: 800, fontSize: 14, boxShadow: `0 4px 16px ${G.greenGlow}` }}>📸 Take Photo</div>
            </button>
            <div style={{ background: G.greenDim, border: `1px solid ${G.green}30`, borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: G.green, marginBottom: 8 }}>💡 Kaero Tips</div>
              {["Good lighting: Kaero identifies faster", "Include brand & model in frame", "Voice description helps Kaero write better copy"].map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, color: G.text2, marginBottom: 4 }}><span style={{ color: G.green, flexShrink: 0 }}>✓</span>{t}</div>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ background: G.card, borderRadius: 18, padding: 16, marginBottom: 14, border: `1px solid ${G.border}` }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
                <div style={{ width: 70, height: 70, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
                  <img src={capturedPhoto || "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=200&q=80"} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div><div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 4 }}>Photo captured ✓</div><Chip col={G.green} sm>In-App Camera</Chip></div>
              </div>
              <div style={{ background: G.cardHi, borderRadius: 14, padding: 14, textAlign: "center", marginBottom: 12, border: `1px solid ${voice.listening ? G.cyan : G.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: G.text2, marginBottom: 10 }}>🎙️ Describe by Voice (Arabic / English)</div>
                <button onClick={voice.toggle} style={{ width: 60, height: 60, borderRadius: "50%", background: voice.listening ? G.accentDim : G.greenDim, border: `2px solid ${voice.listening ? G.accent : G.green}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontFamily: "inherit", boxShadow: `0 4px 16px ${voice.listening ? G.accent : G.green}55`, animation: voice.listening ? "rippleGreen 1s infinite" : "none", transition: "all .3s" }}><Icon.Mic size={26} col={voice.listening ? G.accent : G.green} /></button>
                <div style={{ fontSize: 12, color: voice.listening ? G.cyan : G.muted, marginTop: 8, fontWeight: voice.listening ? 700 : 400 }}>{voice.listening ? "🔴 Listening… tap to stop" : "Tap to speak"}</div>
                {voice.transcript && <div style={{ background: G.accentDim, borderRadius: 10, padding: "8px 12px", marginTop: 8, fontSize: 12, color: G.accent, fontStyle: "italic" }}>"{voice.transcript}"</div>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: G.text2, marginBottom: 6 }}>Or type:</div>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. iPhone 13 Pro, 256GB, Alpine Green, Like New…" style={{ width: "100%", background: G.bg, border: `1.5px solid ${G.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: G.text, outline: "none", fontFamily: "inherit", resize: "none", height: 80, lineHeight: 1.5 }} />
            </div>
            <Btn full col={G.green} onClick={() => setStep(2)}>🤖 Let Kaero Analyze →</Btn>
          </>
        )}

        {step === 2 && (
          <div style={{ textAlign: "center", paddingTop: 16 }}>
            <div style={{ width: 90, height: 90, borderRadius: "50%", background: "#FFFFFF", border: `3px solid ${G.green}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", animation: "pulse 1.2s ease infinite", boxShadow: `0 0 32px ${G.greenGlow}` }}><LogoK size={52} dark={false} /></div>
            <div style={{ fontSize: 20, fontWeight: 900, color: G.text, marginBottom: 6 }}>Kaero Analyzing…</div>
            <div style={{ fontSize: 13, color: G.muted, marginBottom: 22 }}>Identifying product, condition & fair market price</div>
            <div style={{ background: G.border2, borderRadius: 99, height: 8, marginBottom: 20, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg,${G.green},${G.green})`, width: `${progress}%`, transition: "width .05s linear" }} /></div>
            {[["🔍", "Identifying product type…", 20], ["💰", "Checking live market prices…", 50], ["✍️", "Writing optimized description…", 75], ["✅", "Finalizing listing…", 100]].map(([ic, lb, th], i) => (
              <div key={i} style={{ background: G.card, borderRadius: 12, padding: "10px 16px", marginBottom: 8, display: "flex", gap: 10, alignItems: "center", opacity: progress >= th ? 1 : .3, transition: "opacity .4s" }}>
                <span style={{ fontSize: 16 }}>{ic}</span><span style={{ fontSize: 13, color: progress >= th ? G.text : G.muted, flex: 1, textAlign: "left" }}>{lb}</span>
                {progress >= th && <span style={{ color: G.green }}>✓</span>}
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <>
            <div style={{ background: G.greenDim, border: `1.5px solid ${G.green}44`, borderRadius: 14, padding: 12, marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 22 }}>✅</span>
              <div><div style={{ fontSize: 14, fontWeight: 800, color: G.green }}>Kaero Listing Ready!</div><div style={{ fontSize: 12, color: G.muted }}>Review and publish — click ✏️ Edit to change anything</div></div>
            </div>
            <div style={{ background: G.card, borderRadius: 16, padding: 14, marginBottom: 12, border: `1.5px solid ${G.green}44` }}>
              <div style={{ fontSize: 11, color: G.green, marginBottom: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: "#000", border: `1px solid ${G.green}44`, display: "flex", alignItems: "center", justifyContent: "center" }}><LogoK size={14} dark={true} /></div>
                KAERO PRICE SUGGESTION
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[{ lb: "Quick Sale", val: result.priceRange?.low || 15500, col: G.green, sub: "↓8%" }, { lb: "Market Avg", val: result.priceRange?.avg || 16800, col: G.green, sub: "Best" }, { lb: "Maximum", val: result.priceRange?.high || 18200, col: G.green, sub: "↑8%" }].map((r, i) => (
                  <div key={i} style={{ background: i === 1 ? G.greenDim : G.cardHi, border: `1.5px solid ${i === 1 ? G.green : G.border}`, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: G.muted, marginBottom: 4 }}>{r.lb}</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: r.col }}>{((r.val || 17000) / 1000).toFixed(1)}K</div>
                    <div style={{ fontSize: 9, color: r.col, marginTop: 2 }}>{r.sub}</div>
                  </div>
                ))}
              </div>
            </div>
            {[["Title", result.title], ["Category", result.category], ["Condition", result.condition], ["Price", `EGP ${(result.price || 17000).toLocaleString()}`], ["Description", result.desc]].map(([lbl, val], i) => (
              <div key={i} style={{ background: G.card, border: `1.5px solid ${G.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: G.muted, textTransform: "uppercase", letterSpacing: .6, marginBottom: 5 }}>{lbl}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: G.text, lineHeight: 1.5 }}>{val}</div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <Btn col={G.green} outline onClick={openEdit} style={{ flex: 1 }}>✏️ Edit</Btn>
              <Btn col={G.green} onClick={handlePublish} style={{ flex: 2 }}>🚀 Publish → My Store</Btn>
            </div>
          </>
        )}

        {step === 4 && (
          <div style={{ textAlign: "center", paddingTop: 30 }}>
            <div style={{ width: 70, height: 70, borderRadius: "50%", background: "#019F45", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px", animation: "pulse 1.5s ease infinite", boxShadow: `0 0 30px ${G.greenGlow}` }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: G.text, marginBottom: 6 }}>Item Published!</div>
            <div style={{ fontSize: 12, color: G.muted, marginBottom: 20 }}>Now live on Kaero — buyers near you can see it</div>
            <div style={{ background: "#019F45", borderRadius: 14, padding: "10px 16px", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: `0 4px 16px ${G.greenGlow}`, animation: "fadeUp .5s both" }}>
              <span style={{ fontSize: 14 }}>✅</span><span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>Item Published Successfully</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Market({ back, go, T }) {
  const [radius, setRadius] = useState(5);
  const [cat, setCat] = useState("All");
  const [listening, setListening] = useState(false);
  const [voiceQ, setVoiceQ] = useState("");
  const [mapListings, setMapListings] = useState([]);

  // Fetch nearby listings for map
  useEffect(() => {
    const doFetch = (lat, lng) => {
      listingApi.nearby({ lat, lng, radius: radius * 1000, limit: 30, sort: 'distance' })
        .then(r => { if (r.data.listings?.length > 0) setMapListings(r.data.listings.map(adaptListing)); })
        .catch(() => {});
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => doFetch(pos.coords.latitude, pos.coords.longitude),
        () => doFetch(30.0444, 31.2357),
        { timeout: 5000 }
      );
    } else {
      doFetch(30.0444, 31.2357);
    }
  }, [radius]);

  const categoryEmojis = { phones: "📱", computers: "💻", audio: "🎧", cameras: "📷", gaming: "🎮", drones: "🚁", tablets: "📱", vehicles: "🚗", furniture: "🛋️", fashion: "👕", other: "📦" };

  const pins = mapListings.map((item, idx) => ({
    x: 15 + ((idx * 37) % 70),
    y: 15 + ((idx * 23) % 65),
    em: categoryEmojis[item.category] || "📦",
    p: item.price >= 1000 ? `${(item.price / 1000).toFixed(0)}K` : String(item.price),
    name: (item.name || '').split(' ').slice(0, 2).join(' '),
    item: item,
    km: item.km,
  }));

  const handleVoice = () => {
    setListening(true);
    setTimeout(() => { setListening(false); setVoiceQ("iPhone under 30K within 2km"); }, 2800);
  };
  const catMap = { "Electronics": ["phones", "computers", "audio", "cameras", "tablets", "drones"], "Vehicles": ["vehicles"], "Furniture": ["furniture"], "Fashion": ["fashion"], "Gaming": ["gaming"] };
  const filteredPins = pins
    .filter(pin => pin.km <= radius)
    .filter(pin => cat === "All" || (catMap[cat] && catMap[cat].includes(pin.item.category)));
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title="Market" onBack={back} onHome={back} />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        <div style={{
          background: G.card, border: `1.5px solid ${G.border}`,
          borderRadius: 16, padding: "12px 14px", marginBottom: 12
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1, fontSize: 13, color: voiceQ ? G.text : G.muted, fontStyle: voiceQ ? "normal" : "italic" }}>
              {voiceQ ? `🔍 "${voiceQ}"` : listening ? "🔴 Listening…" : "Search market by voice…"}
            </div>
            <button onClick={handleVoice} style={{
              width: 42, height: 42, borderRadius: 12,
              background: listening ? G.cyan : G.green, border: "none", cursor: "pointer",
              fontSize: 20, flexShrink: 0, boxShadow: `0 3px 10px ${G.green}44`,
              animation: listening ? "rippleGreen 1s infinite" : "none",
              transition: "background .3s"
            }}>🎙️</button>
          </div>
        </div>
        <div style={{
          background: G.card, borderRadius: 16, padding: "13px 16px",
          marginBottom: 11, border: `1px solid ${G.border}`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
            <span style={{ fontSize: 13, color: G.text2, fontWeight: 600 }}>Search radius</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: G.green }}>{radius} km</span>
          </div>
          <input type="range" min={.1} max={10} step={.1} value={radius}
            onChange={e => setRadius(+e.target.value)} style={{ width: "100%", accentColor: G.green }} />
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 10, color: G.muted, marginTop: 3
          }}>
            <span>100m</span><span>5km</span><span>10km</span>
          </div>
        </div>
        <FilterRow
          options={["All", "Electronics", "Vehicles", "Furniture", "Fashion", "Gaming"].map(c => ({ v: c, l: c }))}
          value={cat} onChange={setCat} />
        {/* Map */}
        <div style={{
          background: G.surface, borderRadius: 20, height: 255,
          position: "relative", overflow: "hidden",
          border: `1px solid ${G.border}`, boxShadow: `0 4px 20px ${G.shadow}`,
          marginBottom: 16
        }}>
          {[...Array(9)].map((_, i) => (
            <div key={i} style={{
              position: "absolute", top: 0, left: `${i * 12.5}%`,
              width: 1, height: "100%", background: "rgba(255,255,255,.04)"
            }} />
          ))}
          {[...Array(7)].map((_, i) => (
            <div key={i} style={{
              position: "absolute", left: 0, top: `${i * 16.7}%`,
              width: "100%", height: 1, background: "rgba(255,255,255,.04)"
            }} />
          ))}
          <div style={{
            position: "absolute", top: "42%", left: 0, width: "100%", height: 5,
            background: "rgba(255,255,255,.08)", borderRadius: 4
          }} />
          <div style={{
            position: "absolute", left: "37%", top: 0, width: 5, height: "100%",
            background: "rgba(255,255,255,.08)", borderRadius: 4
          }} />
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            width: `${Math.min(radius * 22, 90)}%`, paddingTop: `${Math.min(radius * 22, 90)}%`,
            borderRadius: "50%", border: `2px dashed ${G.green}66`,
            background: `${G.green}08`, transition: "all .3s"
          }} />
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)", zIndex: 2
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%", background: G.green,
              border: "3px solid #fff",
              boxShadow: `0 0 0 6px ${G.green}33,0 0 14px ${G.greenGlow}`
            }} />
          </div>
          {filteredPins.map((pin, i) => (
            <div key={i} onClick={() => go("product", pin.item)}
              style={{
                position: "absolute", left: `${pin.x}%`, top: `${pin.y}%`,
                transform: "translate(-50%,-100%)", cursor: "pointer", zIndex: 3
              }}>
              <div style={{
                background: G.card, border: `2px solid ${G.green}`,
                borderRadius: 11, padding: "4px 9px", display: "flex",
                alignItems: "center", gap: 4, boxShadow: `0 4px 14px ${G.shadow}`, whiteSpace: "nowrap"
              }}>
                <span style={{ fontSize: 13 }}>{pin.em}</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: G.green }}>{pin.p}</span>
              </div>
              <div style={{
                width: 0, height: 0, borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent", borderTop: `7px solid ${G.green}`,
                margin: "0 auto"
              }} />
            </div>
          ))}
          <div style={{ position: "absolute", bottom: 10, right: 10 }}>
            <Chip col={G.green} sm>{filteredPins.length} nearby</Chip>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 10 }}>
          {filteredPins.length} items within {radius} km
        </div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
          {filteredPins.map((pin, i) => (
            <div key={i} onClick={() => go("product", pin.item)}
              style={{
                flexShrink: 0, width: 128, background: G.card,
                border: `1px solid ${G.border}`, borderRadius: 16,
                overflow: "hidden", cursor: "pointer"
              }}>
              <div style={{
                background: G.cardHi, height: 78, display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 32
              }}>{pin.em}</div>
              <div style={{ padding: "9px 10px 11px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 2 }}>{pin.name}</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: G.green }}>{pin.p} EGP</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MY STORE
═══════════════════════════════════════════════════════════ */
function MyStore({ back, go, T, user }) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("price");
  const [storeItems, setStoreItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const userName = user?.name || user?.full_name || "User";
  const userInitials = (() => {
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return userName.slice(0, 2).toUpperCase() || "?";
  })();

  useEffect(() => {
    if (!user?.id) {
      setStoreItems([]);
      setLoading(false);
      return;
    }
    listingApi.byUser(user.id).then(r => {
      if (r.data.listings?.length > 0) {
        const adapted = r.data.listings.map(l => ({ ...adaptListing(l), offers: [] }));
        setStoreItems(adapted);
        // Fetch offers for each listing
        adapted.forEach(item => {
          if (item._raw?.id) {
            offerApi.byListing(item._raw.id).then(or => {
              if (or.data.offers?.length > 0) {
                setStoreItems(prev => prev.map(si =>
                  si.id === item.id ? { ...si, offers: or.data.offers.map(adaptOffer) } : si
                ));
              }
            }).catch(() => {});
          }
        });
      } else {
        setStoreItems([]);
      }
    }).catch(() => setStoreItems([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const totalOffers = storeItems.reduce((s, l) => s + (l.offers?.length || 0), 0);
  const sorted = [...storeItems]
    .filter(l => filter === "sold" ? l.sold : filter === "active" ? !l.sold : true)
    .sort((a, b) => sort === "price" ? b.price - a.price : sort === "km" ? a.km - b.km : b.rating - a.rating);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title={T?.myStore || "My Store"} onBack={back} onHome={back} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ margin: "12px 14px 0", background: G.card, borderRadius: 18, padding: "14px 16px", border: `1px solid ${G.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            {user?.avatar
              ? <img src={user.avatar} style={{ width: 52, height: 52, borderRadius: 14, objectFit: "cover", border: `2px solid ${G.green}55` }} onError={e => e.target.style.display = "none"} />
              : <div style={{ width: 52, height: 52, borderRadius: 14, background: G.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#fff", boxShadow: `0 4px 16px ${G.greenGlow}` }}>{userInitials}</div>
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: G.text }}>{userName}'s Store</div>
              <div style={{ fontSize: 12, color: G.muted }}>📍 {user?.location || "Cairo"} · ⭐ {user?.rating || "4.9"} · Verified Seller</div>
            </div>
            <Chip col={G.cyan}>🏆 Power Seller</Chip>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {[["🏷️", storeItems.length, "Listings"], ["💬", totalOffers, "Offers"], ["👁️", "1,247", "Views"], ["⭐", user?.rating || "4.9", "Rating"]].map(([ic, v, l]) => (
              <div key={l} style={{ background: G.cardHi, borderRadius: 10, padding: "10px 8px", textAlign: "center", border: `1px solid ${G.border}` }}>
                <div style={{ fontSize: 17 }}>{ic}</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: G.green }}>{v}</div>
                <div style={{ fontSize: 9, color: G.muted, marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "12px 14px 0" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {[["all", T?.all || "All"], ["active", T?.active || "Active"], ["sold", "Sold"]].map(([k, lb]) => (
              <button key={k} onClick={() => setFilter(k)} style={{ flex: 1, background: filter === k ? G.green : G.card, border: `1.5px solid ${filter === k ? G.green : G.border}`, borderRadius: 10, padding: "8px 4px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: filter === k ? "#fff" : G.muted, cursor: "pointer", transition: "all .15s", boxShadow: filter === k ? `0 2px 10px ${G.green}55` : "none" }}>{lb}</button>
            ))}
          </div>
          <FilterRow options={[{ v: "price", l: "Price" }, { v: "km", l: "Distance" }, { v: "rating", l: "Rating" }]} value={sort} onChange={setSort} />
        </div>
        <div style={{ padding: "0 14px 16px" }}>
          {sorted.map(item => (<StoreCard key={item.id} item={item} onClick={() => go("store_offers", item)} />))}
          <button onClick={() => go("sell")} style={{ width: "100%", background: G.card, border: `2px dashed ${G.border2}`, borderRadius: 18, padding: "16px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: G.green, cursor: "pointer", marginTop: 4 }}>+ {T?.addItem || "Add New Listing"}</button>
        </div>
      </div>
    </div>
  );
}

function StoreCard({ item, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: G.card, border: `1.5px solid ${G.border}`,
      borderRadius: 18, marginBottom: 11, cursor: "pointer",
      overflow: "hidden", display: "flex", transition: "box-shadow .15s"
    }}>
      <div style={{ width: 90, height: 90, flexShrink: 0, background: G.bg, position: "relative" }}>
        <img src={item.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={e => e.target.style.display = "none"} />
        {item.sold && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,.65)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: 1
          }}>SOLD</div>
        )}
        {(item.offers?.length || 0) > 0 && !item.sold && (
          <div style={{
            position: "absolute", top: 5, right: 5, width: 22, height: 22,
            borderRadius: "50%", background: G.green, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff"
          }}>
            {item.offers.length}
          </div>
        )}
      </div>
      <div style={{ flex: 1, padding: "10px 12px", minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 800, color: G.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2
        }}>
          {item.name}
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: G.green, marginBottom: 5 }}>
          {item.price.toLocaleString()} EGP
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {item.rating > 0 && <Stars n={item.rating} size={11} />}
          {item.views > 0 && <Chip col={G.muted} sm>👁 {item.views}</Chip>}
          {(item.offers?.length || 0) > 0 && !item.sold && (
            <Chip col={G.cyan} sm>💬 {item.offers.length} offer{item.offers.length > 1 ? "s" : ""}</Chip>
          )}
          {item.sold && <Chip col={G.muted} sm>Sold</Chip>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", paddingRight: 12, color: G.green, fontSize: 22 }}>›</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STORE OFFERS — with prominent exchange
═══════════════════════════════════════════════════════════ */
function StoreOffers({ item, back, go, T }) {
  const it = item || { name: "Item", price: 0, img: "", offers: [] };
  const [tab, setTab] = useState("offers");
  const [accepted, setAccepted] = useState([]);
  const [declined, setDeclined] = useState([]);
  const [counter, setCounter] = useState({});
  const [counterOpen, setCounterOpen] = useState(null);
  const [offers, setOffers] = useState(it.offers || []);

  // Fetch real offers
  useEffect(() => {
    const listingId = it._raw?.id || it.id;
    if (typeof listingId === 'string') {
      offerApi.byListing(listingId).then(r => {
        if (r.data.offers?.length > 0) setOffers(r.data.offers.map(adaptOffer));
      }).catch(() => {});
    }
  }, [it._raw?.id, it.id]);

  const handleAccept = async (offerId, idx) => {
    try {
      await offerApi.accept(offerId);
      setAccepted(a => [...a, idx]);
      setCounterOpen(null);
    } catch (e) {
      // Fallback to local state
      setAccepted(a => [...a, idx]);
      setCounterOpen(null);
    }
  };

  const handleDecline = async (offerId, idx) => {
    try {
      await offerApi.reject(offerId);
      setDeclined(d => [...d, idx]);
    } catch (e) {
      setDeclined(d => [...d, idx]);
    }
  };

  const handleCounter = async (offerId, idx) => {
    const price = Number(counter[idx]);
    if (!price) return;
    try {
      await offerApi.counter(offerId, price);
      setCounterOpen(null);
      setOffers(prev => prev.map((o, i) => i === idx ? { ...o, status: 'countered', counterPrice: price } : o));
    } catch (e) {
      setCounterOpen(null);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title={it.name} onBack={back} onHome={back} />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {/* mini product card */}
        <div style={{
          background: G.card, borderRadius: 16, padding: 13,
          border: `1px solid ${G.border}`, display: "flex", gap: 12,
          marginBottom: 14, boxShadow: `0 2px 12px ${G.shadow}`
        }}>
          <ProductImg src={it.img} size={64} radius={10} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: G.text }}>{it.name}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: G.green }}>
              {it.price.toLocaleString()} EGP
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <Chip col={G.muted} sm>👁 {it.views} views</Chip>
              <Chip col={G.cyan} sm>🤖 Kaero: {it.aiPrice?.toLocaleString()} EGP</Chip>
            </div>
          </div>
        </div>

        {/* tabs */}
        <div style={{
          display: "flex", background: G.card, borderRadius: 12, padding: 4, marginBottom: 14,
          border: `1px solid ${G.border}`
        }}>
          {["offers", "analytics"].map(t => (
            <div key={t} onClick={() => setTab(t)} style={{
              flex: 1, textAlign: "center", padding: "9px",
              borderRadius: 10, background: tab === t ? G.green : "transparent",
              color: tab === t ? "#fff" : G.muted, fontSize: 12, fontWeight: 700,
              cursor: "pointer", transition: "all .2s"
            }}>
              {t === "offers" ? `💬 Offers (${offers.length})` : "📊 Analytics"}
            </div>
          ))}
        </div>

        {tab === "offers" && (
          <>
            {offers.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: G.muted, fontSize: 14 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>😴</div>No offers yet. Your listing is live!
              </div>
            )}
            {accepted.length > 0 && (
              <div style={{
                background: G.greenDim, border: `1.5px solid ${G.green}44`,
                borderRadius: 14, padding: 14, marginBottom: 14
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: G.green }}>✅ Offer accepted — payment in escrow</div>
                <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>Buyer has 3 days to inspect. Funds release after confirmation.</div>
              </div>
            )}
            {offers.map((of, i) => {
              const isAcc = accepted.includes(i), isDec = declined.includes(i), isCtr = counterOpen === i;
              const hasExchange = !!of.exchange;
              return (
                <div key={of.id} style={{
                  background: G.card,
                  border: `1.5px solid ${isAcc ? G.green : hasExchange && !isDec ? G.green + "66" : G.border}`,
                  borderRadius: 18, padding: 14, marginBottom: 12,
                  boxShadow: hasExchange ? `0 4px 20px ${G.green}22` : isAcc ? `0 4px 20px ${G.green}22` : `0 2px 10px ${G.shadow}`,
                  opacity: isDec ? .5 : 1
                }}>

                  {/* buyer info */}
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                    <Av letter={of.av} size={46} img={of.avImg || SELLER_IMGS[of.av]} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, color: G.text, fontSize: 15 }}>{of.buyer}</div>
                      <Stars n={of.rating} />
                      <span style={{ fontSize: 11, color: G.muted }}> · {of.reviews} reviews · 📍 {of.km} km</span>
                      <div style={{ fontSize: 11, color: G.muted2, marginTop: 2 }}>{of.time}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: G.green }}>
                        {of.price.toLocaleString()} EGP
                      </div>
                      <div style={{ fontSize: 11, color: G.muted }}>
                        asked {it.price.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* buyer note */}
                  <div style={{
                    background: G.cardHi, borderRadius: 10, padding: "9px 12px",
                    fontSize: 13, color: G.text2, marginBottom: hasExchange ? 10 : 12
                  }}>
                    💬 "{of.note}"
                  </div>

                  {/* EXCHANGE OFFER — cyan card */}
                  {hasExchange && (
                    <div style={{
                      background: `linear-gradient(135deg,${G.greenDim},rgba(13,15,13,.95))`,
                      border: `2px solid ${G.green}55`, borderRadius: 14,
                      padding: "12px 14px", marginBottom: 12
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, background: G.greenDim,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 16
                        }}>🔄</div>
                        <span style={{ fontSize: 12, fontWeight: 800, color: G.green }}>
                          EXCHANGE OFFER
                        </span>
                        <span style={{ fontSize: 10, color: G.muted, marginLeft: "auto" }}>tap item to view →</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {of.exchangeImg && (
                          <div onClick={() => {
                            const syntheticItem = { id: 900 + of.id, name: of.exchange, brand: "", price: of.exchangeVal || 0, km: of.km, rating: of.rating, reviews: of.reviews, condition: "Good", img: of.exchangeImg, seller: of.buyer, sellerRating: of.rating, sellerReviews: of.reviews, sellerTrust: 85, sellerId: of.av, desc: `Exchange item offered by ${of.buyer}. Valued at ${(of.exchangeVal || 0).toLocaleString()} EGP.`, category: "phones" };
                            go && go("product", syntheticItem);
                          }}
                            style={{
                              width: 52, height: 52, borderRadius: 10, overflow: "hidden",
                              flexShrink: 0, border: `1px solid ${G.green}44`, cursor: "pointer"
                            }}>
                            <img src={of.exchangeImg} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              onError={e => e.target.style.display = "none"} />
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>
                            {of.exchange}
                          </div>
                          <div style={{ fontSize: 12, color: G.green, fontWeight: 800, marginTop: 2 }}>
                            ≈ {of.exchangeVal?.toLocaleString()} EGP
                          </div>
                          <div style={{ fontSize: 11, color: G.muted, marginTop: 1 }}>
                            + {of.price.toLocaleString()} EGP cash
                          </div>
                        </div>
                        <div style={{
                          background: G.green, borderRadius: 10, padding: "6px 10px",
                          fontSize: 11, fontWeight: 800, color: "#fff", textAlign: "center"
                        }}>
                          Total<br />{((of.exchangeVal || 0) + of.price).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}

                  {isCtr && !isAcc && !isDec && (
                    <div style={{ background: G.cardHi, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: G.muted, marginBottom: 6 }}>Your counter-offer (EGP)</div>
                      <input value={counter[i] || ""} onChange={e => setCounter(c => ({ ...c, [i]: e.target.value }))}
                        placeholder={it.price.toLocaleString()}
                        style={{
                          width: "100%", background: G.bg, border: `2px solid ${G.green}`,
                          borderRadius: 10, padding: "10px 12px", fontSize: 16, fontWeight: 800,
                          color: G.green, outline: "none", fontFamily: "inherit"
                        }} />
                    </div>
                  )}

                  {isAcc ? (
                    <div style={{
                      background: G.greenDim, borderRadius: 12, padding: 10,
                      textAlign: "center", color: G.green, fontWeight: 800, fontSize: 13
                    }}>
                      ✅ Accepted — Payment in escrow
                    </div>
                  ) : isDec ? (
                    <div style={{
                      background: G.cardHi, borderRadius: 12, padding: 10,
                      textAlign: "center", color: G.muted, fontWeight: 700, fontSize: 13
                    }}>Declined</div>
                  ) : (
                    <div style={{ display: "flex", gap: 7 }}>
                      <button onClick={() => handleDecline(of._raw?.id || of.id, i)}
                        style={{
                          flex: 1, background: G.cardHi, border: `1.5px solid ${G.border}`,
                          borderRadius: 11, padding: "9px", fontFamily: "inherit",
                          fontSize: 12, fontWeight: 700, color: G.muted, cursor: "pointer"
                        }}>Decline</button>
                      <button onClick={() => isCtr ? handleCounter(of._raw?.id || of.id, i) : setCounterOpen(i)}
                        style={{
                          flex: 1, background: G.greenDim, border: `1.5px solid ${G.green}44`,
                          borderRadius: 11, padding: "9px", fontFamily: "inherit",
                          fontSize: 12, fontWeight: 700, color: G.green, cursor: "pointer"
                        }}>{isCtr ? "Send" : "Counter"}</button>
                      <button onClick={() => handleAccept(of._raw?.id || of.id, i)}
                        style={{
                          flex: 2, background: G.green, border: "none",
                          borderRadius: 11, padding: "9px", fontFamily: "inherit",
                          fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer"
                        }}>✓ Accept</button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {tab === "analytics" && (
          <>
            {[
              { label: "Views this week", value: "234", change: "+18%", col: G.green },
              { label: "Avg offer received", value: `${Math.round(it.offers.reduce((s, o) => s + o.price, 0) / (it.offers.length || 1)).toLocaleString()} EGP`, change: "vs asking", col: G.green },
              { label: "Conversion rate", value: "12.4%", change: "+5%", col: G.green },
              { label: "Kaero fair price", value: `${it.aiPrice?.toLocaleString()} EGP`, change: "Market data", col: G.green },
            ].map((s, i) => (
              <div key={i} style={{
                background: G.card, border: `1px solid ${G.border}`,
                borderRadius: 14, padding: 16, marginBottom: 10
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: G.muted, marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: s.col }}>{s.value}</div>
                  </div>
                  <Chip col={G.green} sm>{s.change}</Chip>
                </div>
                <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 32 }}>
                  {[28, 44, 36, 72, 52, 88, 64].map((h, j) => (
                    <div key={j} style={{
                      flex: 1, height: `${h}%`,
                      background: j === 6 ? s.col : s.col + "33", borderRadius: "3px 3px 0 0"
                    }} />
                  ))}
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 9, color: G.muted, marginTop: 3
                }}>
                  {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => <span key={d}>{d}</span>)}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CHAT — Conversation list + chat view
═══════════════════════════════════════════════════════════ */
const CONVERSATIONS = [
  { id: 1, buyer: "Youssef M.", av: "Y", avImg: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80", item: PRODUCTS[0], price: 16000, lastMsg: "Cash ready, can meet today!", time: "2m", unread: 2 },
  { id: 2, buyer: "Lina K.", av: "L", avImg: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80", item: PRODUCTS[2], price: 8000, lastMsg: "Would you take less if I add AirPods?", time: "15m", unread: 1 },
  { id: 3, buyer: "Omar F.", av: "O", avImg: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80", item: PRODUCTS[4], price: 36000, lastMsg: "Deal! When can we meet?", time: "1h", unread: 0 },
  { id: 4, buyer: "Karim H.", av: "K", avImg: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80", item: PRODUCTS[5], price: 27000, lastMsg: "Can you hold it for tomorrow?", time: "3h", unread: 0 },
  { id: 5, buyer: "Sara M.", av: "S", avImg: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80", item: PRODUCTS[1], price: 65000, lastMsg: "Is the battery in good health?", time: "5h", unread: 0 },
];

function Chat({ item, back, isDark, T }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [chatId, setChatId] = useState(null);
  const currentUserId = getStoredUser()?.id;
  const p = activeConvo?.item || item || { name: "Item", price: 0, img: "" };
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [offerMode, setOfferMode] = useState(false);
  const [offerAmt, setOfferAmt] = useState(String(p.price - 1000));
  const [attachOpen, setAttachOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [flash, setFlash] = useState(false);
  const [chatMyItems, setChatMyItems] = useState([]);
  const endRef = useRef(null);
  const timerRef = useRef(null);
  const quickReplies = [T?.when || "When can you meet?", T?.isNegotiable || "Is price negotiable?", "Can you deliver?", "Still available?"];
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  // Fetch user's own listings for exchange tray
  useEffect(() => {
    const u = getStoredUser();
    if (u?.id) {
      listingApi.byUser(u.id).then(r => {
        if (r.data.listings?.length > 0) setChatMyItems(r.data.listings.map(adaptListing));
      }).catch(() => {});
    }
  }, []);

  // Fetch chat list
  useEffect(() => {
    chatApi.list().then(r => {
      if (r.data.chats?.length > 0) {
        const adapted = r.data.chats.map(adaptChat);
        setConversations(adapted);
        // If opened from product detail (item prop), find matching chat or create one
        if (item?._raw?.id) {
          const existing = adapted.find(c => c.listingId === item._raw.id);
          if (existing) {
            setActiveConvo(existing);
            setChatId(existing._raw?.id || existing.id);
          } else {
            chatApi.create(item._raw.id).then(cr => {
              setChatId(cr.data.chat.id);
              setActiveConvo({ ...adaptChat(cr.data.chat), item: p });
            }).catch(() => {});
          }
        } else if (!activeConvo && adapted.length > 0) {
          setActiveConvo(adapted[0]);
          setChatId(adapted[0]._raw?.id || adapted[0].id);
        }
      }
    }).catch(() => {});
  }, []);

  // Fetch messages when chatId changes
  useEffect(() => {
    if (!chatId || typeof chatId === 'number') {
      // Mock fallback
      setMsgs([
        { from: "them", text: `Hi! Is the ${p.name} still available?`, time: "10:14", offer: false },
        { from: "me", text: "Yes it is! Just listed it today.", time: "10:16", offer: false },
        { from: "them", text: `Would you take ${(p.price - 2000).toLocaleString()} EGP?`, time: "10:18", offer: true },
        { from: "me", text: "Deal! When can we meet?", time: "10:22", offer: false },
      ]);
      return;
    }
    chatApi.messages(chatId).then(r => {
      if (r.data.messages?.length > 0) {
        setMsgs(r.data.messages.map(m => adaptMessage(m, currentUserId)));
      }
    }).catch(() => {});
  }, [chatId]);

  // Poll for new messages every 5s
  useEffect(() => {
    if (!chatId || typeof chatId === 'number') return;
    const poll = setInterval(() => {
      chatApi.messages(chatId).then(r => {
        if (r.data.messages?.length > 0) {
          setMsgs(r.data.messages.map(m => adaptMessage(m, currentUserId)));
        }
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(poll);
  }, [chatId]);

  // Call timer
  useEffect(() => {
    if (callActive) {
      timerRef.current = setInterval(() => setCallTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setCallTimer(0);
    }
    return () => clearInterval(timerRef.current);
  }, [callActive]);

  const fmtTime = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const send = () => {
    if (!input.trim()) return;
    const text = input;
    setMsgs(m => [...m, { from: "me", text, time: "now", offer: false }]);
    setInput("");
    if (chatId && typeof chatId === 'string') {
      chatApi.sendMessage(chatId, { message_type: 'text', content: text }).catch(() => {});
    }
  };

  const sendOffer = () => {
    const text = `Offer: ${Number(offerAmt).toLocaleString()} EGP for ${p.name}`;
    setMsgs(m => [...m, { from: "me", text, time: "now", offer: true }]);
    setOfferMode(false);
    if (chatId && typeof chatId === 'string') {
      chatApi.sendMessage(chatId, { message_type: 'offer', content: text }).catch(() => {});
    }
  };

  const sendItemOffer = (storeItem) => {
    const text = `Exchange offer: My ${storeItem.name} (${storeItem.price.toLocaleString()} EGP) for yours`;
    setMsgs(m => [...m, { from: "me", text, time: "now", offer: true, isExchange: true }]);
    setAttachOpen(false);
    if (chatId && typeof chatId === 'string') {
      chatApi.sendMessage(chatId, { message_type: 'offer', content: text }).catch(() => {});
    }
  };

  const takePhoto = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
    setTimeout(() => {
      setMsgs(m => [...m, { from: "me", text: "📷 [Photo sent]", time: "now", offer: false, isPhoto: true, photoUrl: "https://images.unsplash.com/photo-1696446700974-e4d18e396bcf?w=200&q=70" }]);
      setCameraOpen(false);
    }, 500);
  };

  // CALL SCREEN
  if (callActive) return (
    <div style={{ height: "100%", background: `linear-gradient(145deg,#000000,${G.surface})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", letterSpacing: 2, textTransform: "uppercase" }}>Kaero Call · {fmtTime(callTimer)}</div>
      <Av letter={activeConvo?.av || "A"} size={90} col={G.green} img={activeConvo?.avImg || SELLER_IMGS[activeConvo?.av]} />
      <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{activeConvo?.buyer || "Buyer"}</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>🔒 Kaero encrypted call</div>
      <div style={{ display: "flex", gap: 24, marginTop: 20 }}>
        {[["🔇", "Mute", false], ["📢", "Speaker", false], ["📷", "Camera", false]].map(([ic, lb]) => (
          <div key={lb} style={{ textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, cursor: "pointer", marginBottom: 4 }}>{ic}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>{lb}</div>
          </div>
        ))}
      </div>
      <button onClick={() => setCallActive(false)} style={{ width: 68, height: 68, borderRadius: "50%", background: G.green, border: "none", fontSize: 26, cursor: "pointer", marginTop: 10, boxShadow: `0 4px 20px ${G.greenGlow}` }}>📵</button>
    </div>
  );

  // CAMERA SCREEN
  if (cameraOpen) return (
    <div style={{ height: "100%", background: "#000", display: "flex", flexDirection: "column", position: "relative" }}>
      {flash && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: .8, zIndex: 20, pointerEvents: "none" }} />}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <img src="https://images.unsplash.com/photo-1596742578443-7682ef5251cd?w=600&q=70" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: .8 }} />
        {[33,66].map(p => (<div key={p}><div style={{ position: "absolute", top: 0, left: `${p}%`, width: 1, height: "100%", background: "rgba(255,255,255,.2)" }}/><div style={{ position: "absolute", top: `${p}%`, left: 0, width: "100%", height: 1, background: "rgba(255,255,255,.2)" }}/></div>))}
        <button onClick={() => setCameraOpen(false)} style={{ position: "absolute", top: 14, left: 14, width: 36, height: 36, borderRadius: 11, background: "rgba(0,0,0,.6)", border: "none", cursor: "pointer", fontSize: 18, color: "#fff" }}>✕</button>
        <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ display: "inline-block", background: "rgba(0,0,0,.6)", borderRadius: 99, padding: "5px 12px", fontSize: 11, color: G.green, fontWeight: 700 }}>📷 Send photo to {activeConvo?.buyer || "buyer"}</div>
        </div>
      </div>
      <div style={{ background: "#111", padding: "20px 0 28px", display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🌅</div>
        <button onClick={takePhoto} style={{ width: 72, height: 72, borderRadius: "50%", background: "#fff", border: "5px solid rgba(255,255,255,.3)", cursor: "pointer", boxShadow: "0 4px 20px rgba(255,255,255,.3)" }} />
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🔄</div>
      </div>
    </div>
  );

  // CONVERSATION LIST
  if (!activeConvo) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
        <div style={{ background: G.surface, padding: "12px 16px", borderBottom: `1.5px solid ${G.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0, boxShadow: `0 2px 10px ${G.shadowSm}` }}>
          <button onClick={back} style={{ width: 36, height: 36, borderRadius: 11, background: G.greenDim, border: `1px solid ${G.green}44`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: G.text }}>‹</button>
          <div style={{ fontSize: 16, fontWeight: 800, color: G.text, flex: 1 }}>{T?.messages || "Messages"}</div>
          <Chip col={G.indigo} sm>{conversations.reduce((s, c) => s + (c.unread || 0), 0)} unread</Chip>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
          {conversations.map(c => (
            <div key={c.id} onClick={() => { setActiveConvo(c); setChatId(c._raw?.id || c.id); }} style={{ background: G.card, borderRadius: 16, padding: 13, marginBottom: 10, border: `1.5px solid ${c.unread ? G.green + "44" : G.border}`, display: "flex", gap: 12, cursor: "pointer", boxShadow: c.unread ? `0 2px 12px ${G.green}22` : `0 1px 6px ${G.shadow}` }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <Av letter={c.av} size={46} img={c.avImg || SELLER_IMGS[c.av]} />
                {c.unread > 0 && <div style={{ position: "absolute", top: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: G.cyan, border: `2px solid ${G.bg}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#fff" }}>{c.unread}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: G.text }}>{c.buyer}</div>
                  <div style={{ fontSize: 10, color: G.muted }}>{c.time} ago</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, background: G.cardHi, borderRadius: 8, padding: "5px 8px" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                    <img src={c.item.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: G.text2, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.item.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: G.green }}>{c.price.toLocaleString()} EGP</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: c.unread ? G.text : G.muted, fontWeight: c.unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.lastMsg}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // CHAT VIEW
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${G.green}, ${G.cyan})`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, boxShadow: `0 2px 10px rgba(0,0,0,.2)` }}>
        <button onClick={() => setActiveConvo(null)} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,.15)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: "#fff" }}>‹</button>
        <ProductImg src={p.img} size={38} radius={19} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{activeConvo.buyer}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.75)" }}>🟢 {T?.online || "Online"} · {p.name}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div onClick={() => setCallActive(true)} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer", color: "#fff" }}>📞</div>
          <div onClick={() => setCallActive(true)} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer", color: "#fff" }}>📹</div>
        </div>
      </div>

      {/* Product mini bar */}
      <div style={{ background: G.card, padding: "8px 14px", borderBottom: `1px solid ${G.border}`, flexShrink: 0, display: "flex", gap: 10, alignItems: "center" }}>
        <ProductImg src={p.img} size={32} radius={8} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: G.text }}>{p.name}</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: G.green }}>{p.price.toLocaleString()} EGP</div>
        </div>
        <Chip col={G.green} sm>🛡️ Escrow</Chip>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", background: isDark ? G.bg : G.border }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.from === "me" ? "flex-end" : "flex-start", marginBottom: 6 }}>
            <div style={{ maxWidth: "78%", background: m.from === "me" ? (m.offer ? G.green : (isDark ? G.surface : G.border)) : (isDark ? G.card : "#FFFFFF"), padding: m.isPhoto ? "4px 4px 6px" : "8px 10px 6px", borderRadius: m.from === "me" ? "12px 12px 3px 12px" : "12px 12px 12px 3px", color: m.from === "me" ? (m.offer ? "#fff" : (isDark ? G.bg : "#000000")) : G.text, fontSize: 13.5, lineHeight: 1.4, boxShadow: `0 1px 2px rgba(0,0,0,.12)` }}>
              {m.isPhoto && m.photoUrl ? (
                <div><img src={m.photoUrl} alt="" style={{ width: 160, height: 110, objectFit: "cover", borderRadius: 8, display: "block" }} /><div style={{ fontSize: 10, color: G.muted, marginTop: 4, textAlign: "right" }}>📷 Photo · {m.time}</div></div>
              ) : <>{m.text}<div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 2, marginTop: 2 }}><span style={{ fontSize: 10, color: m.from === "me" ? (isDark ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.4)") : G.muted }}>{m.time}</span>{m.from === "me" && <span style={{ fontSize: 11, color: G.cyan, marginLeft: 2 }}>✓✓</span>}</div></>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Quick replies */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "6px 14px 0", flexShrink: 0 }}>
        {quickReplies.map((r, i) => (
          <button key={i} onClick={() => { setInput(r); }} style={{ flexShrink: 0, background: G.greenDim, border: `1px solid ${G.green}44`, borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 600, color: G.green, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{r}</button>
        ))}
      </div>

      {/* Offer money panel */}
      {offerMode && (
        <div style={{ background: G.greenDim, border: `1px solid ${G.green}44`, padding: "10px 14px", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: G.green, fontWeight: 700, marginBottom: 6 }}>💰 Make a Price Offer</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={offerAmt} onChange={e => setOfferAmt(e.target.value)} placeholder={`Your offer (e.g. ${p.price - 1000})`} style={{ flex: 1, background: G.bg, border: `2px solid ${G.green}`, borderRadius: 12, padding: "10px 12px", fontSize: 15, fontWeight: 800, color: G.green, outline: "none", fontFamily: "inherit" }} />
            <button onClick={sendOffer} style={{ background: G.green, border: "none", borderRadius: 12, padding: "10px 16px", fontFamily: "inherit", fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer" }}>Send</button>
            <button onClick={() => setOfferMode(false)} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: "10px", cursor: "pointer", fontSize: 16, color: G.muted }}>✕</button>
          </div>
        </div>
      )}

      {/* Attach items tray — MY_STORE items as exchange offer */}
      {attachOpen && (
        <div style={{ background: G.surface, borderTop: `1.5px solid ${G.border}`, padding: "12px 14px", flexShrink: 0, maxHeight: 200 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: G.text }}>🔄 Send as Exchange Offer</div>
            <button onClick={() => setAttachOpen(false)} style={{ background: "none", border: "none", fontSize: 16, color: G.muted, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {chatMyItems.filter(i => !i.sold).map(si => (
              <div key={si.id} onClick={() => sendItemOffer(si)} style={{ flexShrink: 0, width: 90, cursor: "pointer", textAlign: "center" }}>
                <div style={{ width: 90, height: 70, borderRadius: 10, overflow: "hidden", border: `1.5px solid ${G.green}44`, marginBottom: 4 }}>
                  <img src={si.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} />
                </div>
                <div style={{ fontSize: 9, color: G.text, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{si.name}</div>
                <div style={{ fontSize: 10, color: G.green, fontWeight: 800 }}>{si.price.toLocaleString()} EGP</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div style={{ display: "flex", gap: 8, padding: "8px 10px 14px", borderTop: `1px solid ${G.border}`, background: G.surface, flexShrink: 0 }}>
        <button onClick={() => setOfferMode(o => !o)} title="Make Price Offer" style={{ width: 40, height: 40, borderRadius: "50%", background: offerMode ? G.green : G.greenDim, border: `1px solid ${G.green}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer", flexShrink: 0, transition: "all .2s" }}>💰</button>
        <div style={{ flex: 1, background: G.card, borderRadius: 24, border: `1.5px solid ${G.border}`, display: "flex", alignItems: "center", padding: "0 14px", gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder={T?.typeMsg || "Type a message…"} style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: G.text, padding: "10px 0", background: "transparent", fontFamily: "inherit" }} />
          <span onClick={() => { setAttachOpen(a => !a); setOfferMode(false); }} title="Send item as offer" style={{ fontSize: 16, cursor: "pointer", color: attachOpen ? G.green : G.muted, transition: "color .2s" }}>📎</span>
          <span onClick={() => { setCameraOpen(true); setAttachOpen(false); setOfferMode(false); }} title="Send photo" style={{ fontSize: 16, cursor: "pointer", color: G.muted }}>📷</span>
        </div>
        <button onClick={send} style={{ width: 40, height: 40, borderRadius: "50%", background: G.green, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 3px 10px ${G.greenGlow}`, color: "#fff" }}>➤</button>
      </div>
    </div>
  );
}

function Payment({ item, back, T }) {
  const p = item || { name: "Item", price: 0, img: "", seller: "Seller", sellerTrust: 0, desc: "" };
  const [step, setStep] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recDone, setRecDone] = useState(false);
  const [method, setMethod] = useState("visa");
  const [confirmCode] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [enteredCode, setEnteredCode] = useState("");
  const [codeConfirmed, setCodeConfirmed] = useState(false);
  const [paying, setPaying] = useState(false);

  const txId = p?.transactionId || p?._raw?.transactionId;

  const handlePaySecurely = async () => {
    if (!txId) { setStep(3); return; } // No real transaction, mock flow
    const paymentMethodMap = { visa: 'wallet', vodafone: 'vodafone_cash', fawry: 'fawry', instapay: 'instapay' };
    setPaying(true);
    try {
      await transactionApi.payment(txId, paymentMethodMap[method] || 'cash');
      setStep(3);
    } catch (err) {
      alert(err.response?.data?.error || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (enteredCode !== confirmCode) { alert('Code does not match'); return; }
    if (txId) {
      try { await transactionApi.confirm(txId); } catch (e) { /* continue anyway for UI */ }
    }
    setCodeConfirmed(true);
  };

  useEffect(() => {
    if (recording) { const t = setTimeout(() => { setRecording(false); setRecDone(true); }, 3000); return () => clearTimeout(t); }
  }, [recording]);

  const steps = ["Agreement", "Voice Record", "Payment", "Confirmation"];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title="Secure Payment" onBack={back} onHome={back} />
      <div style={{
        display: "flex", alignItems: "center", padding: "10px 16px",
        borderBottom: `1px solid ${G.border}`, flexShrink: 0
      }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", flex: i < 3 ? 1 : "initial", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: step > i ? G.green : step === i ? G.greenDim : G.card,
                border: `2px solid ${step >= i ? G.green : G.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: step > i ? 12 : 11, fontWeight: 800,
                color: step >= i ? G.green : G.muted
              }}>{step > i ? "✓" : i + 1}</div>
              <div style={{
                fontSize: 9, color: step === i ? G.green : G.muted,
                marginTop: 3, whiteSpace: "nowrap", fontWeight: step === i ? 800 : 400
              }}>{s}</div>
            </div>
            {i < 3 && <div style={{
              flex: 1, height: 2, margin: "0 3px",
              background: step > i ? G.green : G.border, marginBottom: 14
            }} />}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px 24px" }}>
        {step === 0 && (
          <>
            <div style={{
              background: G.card, borderRadius: 16, padding: 14,
              marginBottom: 16, border: `1px solid ${G.border}`, display: "flex", gap: 12
            }}>
              <ProductImg src={p.img} size={64} radius={10} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: G.text }}>{p.name}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: G.green }}>
                  {p.price.toLocaleString()} EGP
                </div>
                <div style={{ fontSize: 12, color: G.muted }}>Seller: {p.seller} · ⭐ {p.sellerRating}</div>
              </div>
            </div>
            <div style={{
              background: G.greenDim, border: `1.5px solid ${G.green}44`,
              borderRadius: 16, padding: 16, marginBottom: 16
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: G.green, marginBottom: 10 }}>🛡️ 7-Day Protection Active</div>
              {["Your payment is held safely in escrow",
                "3 days to inspect before funds release",
                "Full refund if item differs from listing",
                "Voice recording required as legal proof"].map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 7, fontSize: 12, color: G.text2, marginBottom: 5 }}>
                    <span style={{ color: G.green }}>✓</span>{t}
                  </div>
                ))}
            </div>
            <Btn full col={G.green} onClick={() => setStep(1)}>Agree & Continue →</Btn>
          </>
        )}

        {step === 1 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: G.text, marginBottom: 6 }}>Voice Agreement Required</div>
            <div style={{ fontSize: 13, color: G.muted, marginBottom: 24, lineHeight: 1.6 }}>
              State your name, item, and agreed price. This protects both parties.
            </div>
            <div onClick={() => !recDone && setRecording(r => !r)}
              style={{
                width: 110, height: 110, borderRadius: "50%",
                background: recording ? G.indigoDim : recDone ? G.greenDim : G.greenDim,
                border: `3px solid ${recording ? G.green : G.green}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px", cursor: recDone ? "default" : "pointer",
                fontSize: 44, transition: "all .3s",
                boxShadow: recording ? `0 0 0 16px ${G.indigo}20,0 0 32px ${G.indigo}44` : `0 0 24px ${G.greenGlow}`,
                animation: recording ? "rippleGreen 1s infinite" : "none"
              }}>{recDone ? "✅" : "🎙️"}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: recording ? G.green : recDone ? G.green : G.text, marginBottom: 6 }}>
              {recording ? "🔴 Recording…" : recDone ? "Recording Saved!" : "Tap to Record Agreement"}
            </div>
            <div style={{ fontSize: 12, color: G.muted, marginBottom: 28 }}>
              {recording ? "Say: 'I agree to buy [item] for [price] EGP'" :
                recDone ? "Verbal agreement captured & encrypted" :
                  "State your name, item, and agreed price"}
            </div>
            {recDone && <Btn full col={G.green} onClick={() => setStep(2)}>Continue to Payment →</Btn>}
          </div>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 12 }}>Payment Method</div>
            {[["visa", "💳", "Visa / Mastercard", "Instant"],
            ["vodafone", "📱", "Vodafone Cash", "Instant"],
            ["fawry", "🏪", "Fawry Cash", "Within 1 hr"],
            ["instapay", "🏦", "InstaPay", "Instant"],
            ].map(([k, ic, lb, sp]) => (
              <div key={k} onClick={() => setMethod(k)}
                style={{
                  background: G.card, border: `2px solid ${method === k ? G.green : G.border}`,
                  borderRadius: 14, padding: "13px 16px", marginBottom: 9,
                  display: "flex", gap: 12, alignItems: "center", cursor: "pointer",
                  boxShadow: method === k ? `0 3px 12px ${G.green}33` : "none", transition: "all .15s"
                }}>
                <span style={{ fontSize: 24 }}>{ic}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>{lb}</div>
                  <div style={{ fontSize: 11, color: G.muted }}>{sp}</div>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  border: `2px solid ${method === k ? G.green : G.border}`,
                  background: method === k ? G.green : G.card,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {method === k && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                </div>
              </div>
            ))}
            <div style={{
              background: G.card, borderRadius: 14, padding: 14,
              marginBottom: 16, border: `1px solid ${G.border}`
            }}>
              {[["Item price", `${p.price.toLocaleString()} EGP`],
              ["Platform fee (2%)", `${Math.round(p.price * .02).toLocaleString()} EGP`],
              ["", ""],
              ["Total", `${Math.round(p.price * 1.02).toLocaleString()} EGP`]].map(([k, v], i) => (
                i === 2 ? <div key={i} style={{ height: 1, background: G.border, margin: "8px 0" }} /> :
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: G.muted }}>{k}</span>
                    <span style={{ fontWeight: i === 3 ? 900 : 700, color: i === 3 ? G.green : G.text, fontSize: i === 3 ? 15 : 13 }}>{v}</span>
                  </div>
              ))}
            </div>
            <Btn full col={G.green} onClick={handlePaySecurely} disabled={paying}>
              {paying ? 'Processing...' : `🔒 Pay Securely — ${Math.round(p.price * 1.02).toLocaleString()} EGP`}
            </Btn>
          </>
        )}

        {step === 3 && (
          <div style={{ textAlign: "center", paddingTop: 20 }}>
            <div style={{
              width: 90, height: 90, borderRadius: "50%", background: G.greenDim,
              border: `3px solid ${G.green}`, display: "flex", alignItems: "center",
              justifyContent: "center", margin: "0 auto 18px", fontSize: 44,
              animation: "pulse 2s ease infinite",
              boxShadow: `0 0 40px ${G.greenGlow}`
            }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: G.text, marginBottom: 6 }}>Payment Successful!</div>
            <div style={{ fontSize: 13, color: G.muted, marginBottom: 16, lineHeight: 1.7 }}>
              Your payment is safely held in escrow.<br />You have 3 days to inspect the item.
            </div>

            {/* Seller confirmation code */}
            <div style={{
              background: G.card, borderRadius: 16, padding: 16,
              marginBottom: 14, border: `2px solid ${G.green}44`
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: G.green, marginBottom: 8 }}>🔐 Delivery Confirmation Code</div>
              <div style={{ fontSize: 11, color: G.muted, marginBottom: 12, lineHeight: 1.5 }}>
                Share this code with the buyer after delivery. The buyer must enter it to confirm receipt.
              </div>
              <div style={{
                background: G.greenDim, borderRadius: 14, padding: "14px 18px",
                border: `2px dashed ${G.green}66`, marginBottom: 12
              }}>
                <div style={{ letterSpacing: 12, fontSize: 32, fontWeight: 900, color: G.green, textAlign: "center" }}>
                  {confirmCode}
                </div>
              </div>
            </div>

            {/* Buyer enters code */}
            {!codeConfirmed ? (
              <div style={{
                background: G.card, borderRadius: 16, padding: 16,
                marginBottom: 14, border: `1px solid ${G.border}`, textAlign: "left"
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 8 }}>📦 Buyer: Confirm Receipt</div>
                <div style={{ fontSize: 11, color: G.muted, marginBottom: 12 }}>
                  Enter the 6-digit code from the seller to confirm you received the item.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={enteredCode} onChange={e => setEnteredCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter code" maxLength={6}
                    style={{
                      flex: 1, background: G.bg, border: `2px solid ${enteredCode.length === 6 ? G.green : G.border}`,
                      borderRadius: 12, padding: "12px 14px", fontSize: 18, fontWeight: 900,
                      color: G.green, outline: "none", fontFamily: "inherit", textAlign: "center", letterSpacing: 8
                    }} />
                  <button onClick={handleConfirmReceipt}
                    disabled={enteredCode.length !== 6}
                    style={{
                      background: enteredCode.length === 6 ? G.green : G.border,
                      border: "none", borderRadius: 12, padding: "12px 18px",
                      fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "inherit"
                    }}>Confirm</button>
                </div>
                {enteredCode.length === 6 && enteredCode !== confirmCode && (
                  <div style={{ fontSize: 11, color: G.error || "#EF4444", marginTop: 6 }}>❌ Code does not match. Please try again.</div>
                )}
              </div>
            ) : (
              <div style={{
                background: G.greenDim, borderRadius: 16, padding: 16,
                marginBottom: 14, border: `2px solid ${G.green}`, textAlign: "center"
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: G.green, marginBottom: 4 }}>Receipt Confirmed!</div>
                <div style={{ fontSize: 12, color: G.muted }}>Funds will be released to the seller within 24 hours.</div>
              </div>
            )}

            <div style={{
              background: G.card, borderRadius: 16, padding: 16,
              marginBottom: 16, textAlign: "left", border: `1px solid ${G.border}`
            }}>
              {[["Transaction ID", "#KR-2026-08441"],
              ["Amount", `${Math.round(p.price * 1.02).toLocaleString()} EGP`],
              ["Escrow release", "After buyer confirms"],
              ["Dispute deadline", "72 hours after receipt"],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between",
                  marginBottom: 8, fontSize: 13
                }}>
                  <span style={{ color: G.muted }}>{k}</span>
                  <span style={{ fontWeight: 700, color: G.text }}>{v}</span>
                </div>
              ))}
            </div>
            <Btn full col={G.green} onClick={back}>← Back to Home</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PROFILE — Complete
═══════════════════════════════════════════════════════════ */
function Profile({ back, go, user, T }) {
  const profileUser = user || DB.getUser();
  const profileName = profileUser?.name || profileUser?.full_name || 'User';
  const profileInitials = (() => {
    const parts = profileName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return profileName.slice(0, 2).toUpperCase() || '?';
  })();
  const [tab, setTab] = useState("overview");
  const [reviews, setReviews] = useState([
    { from: "Youssef M.", rating: 5, text: "Perfect transaction! Very honest seller, item exactly as described.", time: "2 days ago", av: "Y" },
    { from: "Sara K.", rating: 5, text: "Super fast response, met on time. Highly recommend!", time: "1 week ago", av: "S" },
    { from: "Karim H.", rating: 4, text: "Good seller, small delay but communicated well.", time: "2 weeks ago", av: "K" },
    { from: "Nour A.", rating: 5, text: "Genuinely the best marketplace experience I've had.", time: "1 month ago", av: "N" },
  ]);
  const [profileStats, setProfileStats] = useState(null);
  const [txHistory, setTxHistory] = useState([]);

  useEffect(() => {
    // Fetch real user data
    userApi.me().then(r => {
      const u = r.data;
      setProfileStats({
        totalSales: u.total_sales || 0,
        trustScore: Math.round(u.trust_score || 0),
        totalReviews: u.total_reviews || 0,
        activeListings: 0,
        rating: u.trust_score || 0,
      });
    }).catch(() => {});

    // Fetch reviews
    if (profileUser?.id) {
      reviewApi.byUser(profileUser.id).then(r => {
        if (r.data.reviews?.length > 0) {
          setReviews(r.data.reviews.map(rv => ({
            from: rv.reviewer_name || 'User',
            av: (rv.reviewer_name || 'U')[0].toUpperCase(),
            rating: rv.rating,
            text: rv.review_text || '',
            time: timeAgo(rv.created_at),
          })));
        }
      }).catch(() => {});
    }

    // Fetch transaction history
    transactionApi.list({ limit: 10 }).then(r => {
      if (r.data.transactions?.length > 0) {
        const userId = profileUser?.id;
        setTxHistory(r.data.transactions.map(t => ({
          name: t.listing_title || 'Transaction',
          price: Number(t.agreed_price || 0),
          type: t.buyer_id === userId ? 'Bought' : 'Sold',
          time: timeAgo(t.created_at),
        })));
      }
    }).catch(() => {});
  }, [profileUser?.id]);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title={T?.myProfile || "My Profile"} onBack={back} onHome={back}
        right={
          <button onClick={() => go("settings")} style={{
            width: 34, height: 34, borderRadius: 10,
            background: G.card, border: `1px solid ${G.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer"
          }}><Icon.Settings size={16} col={G.muted} /></button>
        } />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* profile hero */}
        <div style={{
          background: `linear-gradient(180deg,${G.green}22 0%,${G.bg} 100%)`,
          padding: "24px 20px 16px", textAlign: "center"
        }}>
          <div style={{ position: "relative", display: "inline-block", marginBottom: 14 }}>
            {profileUser?.avatar ? (
              <img src={profileUser.avatar} style={{
                width: 80, height: 80, borderRadius: "50%", objectFit: "cover",
                border: `3px solid ${G.green}`, boxShadow: `0 0 32px ${G.greenGlow}`, margin: "0 auto", display: "block"
              }} onError={e => e.target.style.display = "none"} />
            ) : (
              <div style={{
                width: 80, height: 80, borderRadius: "50%", background: G.green,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, fontWeight: 900, color: "#fff",
                boxShadow: `0 0 32px ${G.greenGlow}`, margin: "0 auto"
              }}>{profileInitials}</div>
            )}
            <div style={{
              position: "absolute", bottom: 2, right: 2, width: 22, height: 22,
              borderRadius: "50%", background: G.green, border: `2px solid ${G.bg}`,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}><Icon.Check size={11} col="#fff" /></div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: G.text }}>{profileName}</div>
          <div style={{ fontSize: 12, color: G.muted, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <Icon.Pin size={12} col={G.green} />
            {profileUser?.location || 'Cairo, Egypt'} · {T?.memberSince || 'Member since Jan 2024'}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
            <span style={{ color: G.cyan, fontSize: 16 }}>★★★★★</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: G.cyan }}>{profileStats?.rating?.toFixed(1) || profileUser?.rating || '4.9'}</span>
            <span style={{ fontSize: 12, color: G.muted }}>({profileStats?.totalReviews || reviews.length} reviews)</span>
          </div>
          {/* badges */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
            {[
              { Ic: Icon.Check, lb: "Verified", col: G.green },
              { Ic: Icon.Fire, lb: "Top Seller", col: G.cyan },
              { Ic: Icon.Zap, lb: "Kaero Verified", col: G.green },
              { Ic: Icon.Shield, lb: "Trusted", col: G.green },
            ].map((b, i) => (
              <div key={i} style={{
                background: b.col + "22", border: `1px solid ${b.col}44`,
                borderRadius: 99, padding: "4px 11px", display: "flex", alignItems: "center", gap: 5
              }}>
                <b.Ic size={11} col={b.col} />
                <span style={{ fontSize: 10, fontWeight: 700, color: b.col }}>{b.lb}</span>
              </div>
            ))}
          </div>
        </div>

        {/* stats grid */}
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { v: String(profileStats?.totalSales ?? 0), lb: "Total Sales", Ic: Icon.Tag, col: G.green },
              { v: String(profileStats?.trustScore ?? 0), lb: "Trust Score", Ic: Icon.Shield, col: G.green },
              { v: String(profileStats?.totalReviews ?? reviews.length), lb: "Reviews", Ic: Icon.Star, col: G.cyan },
              { v: String(profileStats?.activeListings ?? 0), lb: "Active Listings", Ic: Icon.Store, col: G.green },
              { v: "—", lb: "Avg. Sale EGP", Ic: Icon.Wallet, col: G.green },
              { v: "—", lb: "Response Rate", Ic: Icon.Chat, col: G.cyan },
            ].map((s, i) => (
              <div key={i} style={{
                background: G.card, borderRadius: 14,
                padding: "12px 10px", textAlign: "center", border: `1px solid ${G.border}`
              }}>
                <div style={{ display: "flex", justifyContent: "center" }}><s.Ic size={20} col={s.col} /></div>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.col, marginTop: 4 }}>{s.v}</div>
                <div style={{ fontSize: 9, color: G.muted, marginTop: 2 }}>{s.lb}</div>
              </div>
            ))}
          </div>

          {/* Trust score bar */}
          <div style={{
            background: G.card, borderRadius: 16, padding: 16,
            border: `1px solid ${G.border}`, marginBottom: 14
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: G.text }}>🛡️ Trust Score Breakdown</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: G.green }}>{profileStats?.trustScore ?? 0}/100</span>
            </div>
            {[
              { lb: "Successful Transactions", val: 90, max: 100, col: G.green },
              { lb: "Positive Reviews", val: 100, max: 100, col: G.cyan },
              { lb: "Response Speed", val: 95, max: 100, col: G.green },
              { lb: "No Disputes", val: 100, max: 100, col: G.green },
            ].map((s, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 11, color: G.muted }}>
                  <span>{s.lb}</span><span style={{ color: s.col, fontWeight: 700 }}>{s.val}%</span>
                </div>
                <div style={{ background: G.border, borderRadius: 99, height: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${s.val}%`, background: s.col, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>

          {/* tabs */}
          <div style={{
            display: "flex", background: G.card, borderRadius: 12, padding: 4, marginBottom: 14,
            border: `1px solid ${G.border}`
          }}>
            {["overview", "reviews", "history"].map(t => (
              <div key={t} onClick={() => setTab(t)} style={{
                flex: 1, textAlign: "center", padding: "8px",
                borderRadius: 10, background: tab === t ? G.green : "transparent",
                color: tab === t ? "#fff" : G.muted, fontSize: 11, fontWeight: 700, cursor: "pointer",
                transition: "all .2s", textTransform: "capitalize"
              }}>{t}</div>
            ))}
          </div>

          {tab === "overview" && (
            <div>
              <div style={{ background: G.card, borderRadius: 16, padding: 14, border: `1px solid ${G.border}`, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 10 }}>Verification Status</div>
                {[["📞", "Phone Number", "Verified", G.green],
                ["🪪", "National ID", "Verified", G.green],
                ["🎙️", "Voice Sample", "Verified", G.green],
                ["📧", "Email", "Not verified", G.muted]].map(([ic, lb, st, col]) => (
                  <div key={lb} style={{
                    display: "flex", gap: 10, alignItems: "center", padding: "8px 0",
                    borderBottom: `1px solid ${G.border}`
                  }}>
                    <span style={{ fontSize: 18 }}>{ic}</span>
                    <span style={{ flex: 1, fontSize: 13, color: G.text }}>{lb}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: col }}>{st}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "reviews" && (
            <div>
              {reviews.map((r, i) => (
                <div key={i} style={{
                  background: G.card, borderRadius: 14, padding: 14,
                  marginBottom: 10, border: `1px solid ${G.border}`
                }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                    <Av letter={r.av} size={36} img={SELLER_IMGS[r.av]} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: G.text, fontSize: 13 }}>{r.from}</div>
                      <div style={{ color: G.cyan, fontSize: 12 }}>{"★".repeat(r.rating)}</div>
                    </div>
                    <div style={{ fontSize: 10, color: G.muted }}>{r.time}</div>
                  </div>
                  <div style={{ fontSize: 13, color: G.text2, lineHeight: 1.5 }}>"{r.text}"</div>
                </div>
              ))}
            </div>
          )}

          {tab === "history" && (
            <div>
              {(txHistory.length > 0 ? txHistory : [
                { name: "No transactions yet", price: 0, type: "", time: "", col: G.muted },
              ]).map((tx, i) => (
                <div key={i} style={{
                  background: G.card, borderRadius: 14, padding: "12px 14px",
                  marginBottom: 8, border: `1px solid ${G.border}`,
                  display: "flex", alignItems: "center", gap: 12
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: tx.col + "22",
                    border: `1px solid ${tx.col}44`, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 16
                  }}>
                    {tx.type === "Sold" ? "📤" : "📥"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{tx.name}</div>
                    <div style={{ fontSize: 11, color: G.muted }}>{tx.time}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: tx.col }}>
                      {tx.type === "Sold" ? "+" : ""}{tx.price.toLocaleString()} EGP
                    </div>
                    <Chip col={tx.col} sm>{tx.type}</Chip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS — Fully functional
═══════════════════════════════════════════════════════════ */
function Settings({ back, go, user, T, isDark, setIsDark, lang, setLang }) {
  const settingsUser = user || DB.getUser();
  const settingsInitials = (() => {
    const parts = (settingsUser?.name || 'U').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (settingsUser?.name || 'U').slice(0, 2).toUpperCase();
  })();
  const [notifs, setNotifs] = useState(true);
  const [twoFa, setTwoFa] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [kaeroPrice, setKaeroPrice] = useState(true);
  const [kaeroNotifs, setKaeroNotifs] = useState(true);
  const [radius, setRadius] = useState(2);
  const [language, setLanguage] = useState("auto");
  const [currency, setCurrency] = useState("EGP");
  const [showPayments, setShowPayments] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [name, setName] = useState(settingsUser?.name || 'User');
  const [bio, setBio] = useState(settingsUser?.bio || 'Member on Kaero 🇪🇬');

  const [walletBalance, setWalletBalance] = useState(0);
  const [settingsTxList, setSettingsTxList] = useState([]);
  const [totalIncome, setTotalIncome] = useState(0);

  useEffect(() => {
    walletApi.me().then(r => {
      const bal = Number(r.data.balance ?? 0) + Number(r.data.pending ?? 0);
      setWalletBalance(bal);
      setTotalIncome(Number(r.data.total_earned ?? bal));
    }).catch(() => {});
    // Fetch transaction history
    transactionApi.list({ limit: 30 }).then(r => {
      if (r.data.transactions?.length > 0) {
        const uid = settingsUser?.id;
        setSettingsTxList(r.data.transactions.map(t => ({
          name: t.listing_title || 'Transaction',
          price: Number(t.agreed_price || 0),
          type: t.buyer_id === uid ? 'Bought' : 'Sold',
          time: timeAgo(t.created_at),
          col: G.green,
          buyer: t.buyer_id === uid ? (t.seller_name || 'Seller') : (t.buyer_name || 'Buyer'),
          method: t.payment_method || 'Escrow',
        })));
      }
    }).catch(() => {});
  }, []);

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 2500); };

  const Toggle = ({ val, onChange }) => (
    <div onClick={() => { onChange(!val); }} style={{
      width: 44, height: 24, borderRadius: 99,
      background: val ? G.green : G.border, cursor: "pointer", position: "relative",
      transition: "background .2s", flexShrink: 0
    }}>
      <div style={{
        position: "absolute", top: 2, left: val ? 22 : 2, width: 20, height: 20,
        borderRadius: "50%", background: "#fff", transition: "left .2s",
        boxShadow: "0 1px 4px rgba(0,0,0,.3)"
      }} />
    </div>
  );

  const Section = ({ title }) => (
    <div style={{
      fontSize: 10, fontWeight: 800, color: G.muted, letterSpacing: 1.5,
      marginTop: 20, marginBottom: 8
    }}>{title}</div>
  );

  const Row = ({ icon, label, sub, right, onClick, col }) => (
    <div onClick={onClick} style={{
      background: G.card, borderRadius: 14, padding: "13px 14px",
      marginBottom: 8, border: `1px solid ${G.border}`,
      display: "flex", alignItems: "center", gap: 12, cursor: onClick ? "pointer" : "default"
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: G.cardHi,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: col || G.text }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: G.muted }}>{sub}</div>}
      </div>
      {right !== undefined ? right : <span style={{ color: G.muted, fontSize: 18 }}>›</span>}
    </div>
  );

  if (showEditProfile) return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title={T?.editProfile2 || "Edit Profile"} onBack={() => setShowEditProfile(false)} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 20, position: "relative" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", background: G.green,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 900, color: "#fff", margin: "0 auto 10px",
            boxShadow: `0 4px 16px ${G.greenGlow}`
          }}>{settingsUser?.avatar ? null : settingsInitials}</div>
          {settingsUser?.avatar && <img src={settingsUser.avatar} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: `3px solid ${G.green}`, position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", boxShadow: `0 4px 16px ${G.greenGlow}` }} onError={e => e.target.style.display = "none"} />}
          <button style={{
            fontSize: 12, color: G.green, background: "none", border: "none",
            cursor: "pointer", fontFamily: "inherit", fontWeight: 700
          }}>  {T?.changePhoto2 || "Change Photo"}</button>
        </div>
        {[[T?.name2 || "Name", name, setName], [T?.bio2 || "Bio", bio, setBio]].map(([lb, val, setter]) => (
          <div key={lb} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: G.muted, marginBottom: 6 }}>{lb}</div>
            <input value={val} onChange={e => setter(e.target.value)}
              style={{
                width: "100%", background: G.card, border: `1.5px solid ${G.border}`,
                borderRadius: 12, padding: "12px 14px", fontSize: 13, color: G.text,
                outline: "none", fontFamily: "inherit"
              }} />
          </div>
        ))}
        {[["Location", "Cairo, Egypt"], ["Phone", "+20 123 456 7890"], ["Email", "ahmed@email.com"]].map(([lb, val]) => (
          <div key={lb} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: G.muted, marginBottom: 6 }}>{lb}</div>
            <input defaultValue={val}
              style={{
                width: "100%", background: G.card, border: `1.5px solid ${G.border}`,
                borderRadius: 12, padding: "12px 14px", fontSize: 13, color: G.text,
                outline: "none", fontFamily: "inherit"
              }} />
          </div>
        ))}
        <Btn full col={G.green} onClick={async () => {
          try {
            await userApi.updateMe({ full_name: name, bio });
            const updated = { ...settingsUser, name, full_name: name, bio };
            setStoredUser(updated);
            showToast(T?.profileSaved2 || "Profile saved ✅");
            setShowEditProfile(false);
          } catch (e) {
            showToast("Save failed: " + (e.response?.data?.error || "Unknown error"));
          }
        }}>
          {T?.saveChanges2 || "Save Changes"}
        </Btn>
      </div>
    </div>
  );

  /* ── Privacy Policy Sub-page ── */
  if (showPrivacy) return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title={T?.privacyPolicy || "Privacy Policy"} onBack={() => setShowPrivacy(false)} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }}>
        <div style={{ background: G.card, borderRadius: 16, padding: 18, border: `1px solid ${G.border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: G.green, marginBottom: 12 }}>🔒 Kaero Privacy Policy</div>
          <div style={{ fontSize: 11, color: G.muted, marginBottom: 14 }}>Last updated: February 2026 · Compliant with Egyptian Data Protection Law No. 151 of 2020</div>
          {[
            { title: "1. Data Collection", text: "Kaero collects your name, phone number, email, national ID (for verification), location data, transaction history, and voice recordings (for agreements). We only collect data necessary for providing our services." },
            { title: "2. Purpose of Processing", text: "Your data is used for identity verification, secure transactions, escrow services, dispute resolution, price suggestions, and improving our platform. We never sell your personal data to third parties." },
            { title: "3. Data Storage & Security", text: "All data is stored on encrypted servers within Egypt in compliance with local regulations. We use AES 256 encryption for sensitive data. Voice recordings are encrypted end to end." },
            { title: "4. User Rights", text: "Under Egyptian law, you have the right to access, correct, or delete your personal data. You may request data export at any time. Contact us at kaero.mail@gmail.com for data requests." },
            { title: "5. Cookies & Tracking", text: "Kaero uses minimal tracking for app functionality. We do not use third party advertising trackers. Analytics data is anonymized." },
            { title: "6. Data Sharing", text: "We share limited data with: payment processors (for transactions), law enforcement (when legally required), and verified buyers/sellers (name, rating, verification status only)." },
            { title: "7. Minors", text: "Kaero services are available only to users aged 18 and above, in compliance with Egyptian commerce regulations." },
            { title: "8. Data Retention", text: "Account data is retained for 5 years after account closure for legal compliance. Transaction records are kept for 10 years per Egyptian tax law." },
            { title: "9. Contact", text: "Data Protection Officer: kaero.mail@gmail.com · Phone: +20114354227 · Address: Cairo, Egypt" },
          ].map((s, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: G.text, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: G.text2, lineHeight: 1.6 }}>{s.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── Terms of Service Sub-page ── */
  if (showTerms) return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title={T?.termsOfService || "Terms of Service"} onBack={() => setShowTerms(false)} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }}>
        <div style={{ background: G.card, borderRadius: 16, padding: 18, border: `1px solid ${G.border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: G.green, marginBottom: 12 }}>📋 Kaero Terms of Service</div>
          <div style={{ fontSize: 11, color: G.muted, marginBottom: 14 }}>Effective: February 2026 · Governed by Egyptian Commercial Law</div>
          {[
            { title: "1. Acceptance", text: "By using Kaero, you agree to these terms. Kaero is a peer to peer marketplace platform operating under Egyptian commercial regulations." },
            { title: "2. Account Requirements", text: "Users must be 18+ and provide valid Egyptian National ID for verification. You are responsible for all activity under your account." },
            { title: "3. Listings & Sales", text: "All items listed must be legal under Egyptian law. Kaero reserves the right to remove listings that violate our policies. Sellers must accurately describe item condition." },
            { title: "4. Escrow & Payments", text: "Kaero holds payments in escrow until buyer confirms receipt. Platform fee is 4% (2% buyer + 2% seller). Funds are released within 24 hours of confirmation." },
            { title: "5. Buyer Protection", text: "Buyers have 7 days of protection and 3 days to inspect items. Full refund is available if the item significantly differs from the listing description." },
            { title: "6. Disputes", text: "Disputes must be filed within 72 hours of receipt confirmation. Kaero mediates disputes using voice agreements, photos, and transaction records." },
            { title: "7. Prohibited Items", text: "Weapons, illegal substances, counterfeit goods, stolen property, and items restricted under Egyptian law are strictly prohibited." },
            { title: "8. Account Suspension", text: "Kaero may suspend accounts for fraud, policy violations, or illegal activity. Users may appeal within 14 days." },
            { title: "9. Limitation of Liability", text: "Kaero is a marketplace platform and is not liable for the quality of items sold between users. Our liability is limited to the escrow amount." },
            { title: "10. Governing Law", text: "These terms are governed by the laws of the Arab Republic of Egypt. Disputes shall be resolved in Cairo courts." },
          ].map((s, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: G.text, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: G.text2, lineHeight: 1.6 }}>{s.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── Contact Support Sub-page ── */
  if (showContact) return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title={T?.contactSupport || "Contact Support"} onBack={() => setShowContact(false)} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }}>
        <div style={{ textAlign: "center", padding: "24px 0 16px" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: G.greenDim, border: `3px solid ${G.green}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 36 }}>💬</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: G.text, marginBottom: 4 }}>{T?.contactSupport || "Contact Support"}</div>
          <div style={{ fontSize: 12, color: G.muted }}>{T?.liveChat || "Live chat · Arabic & English"}</div>
        </div>
        <div style={{ background: G.card, borderRadius: 16, padding: 16, border: `1px solid ${G.border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: G.text, marginBottom: 14 }}>📞 Phone</div>
          <div style={{ background: G.greenDim, borderRadius: 12, padding: "14px 16px", border: `1px solid ${G.green}44`, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>📱</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: G.green, letterSpacing: 1 }}>+20114354227</div>
              <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>Available 9 AM to 9 PM (Cairo time)</div>
            </div>
          </div>
        </div>
        <div style={{ background: G.card, borderRadius: 16, padding: 16, border: `1px solid ${G.border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: G.text, marginBottom: 14 }}>📧 Email</div>
          <div style={{ background: G.greenDim, borderRadius: 12, padding: "14px 16px", border: `1px solid ${G.green}44`, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>✉️</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: G.green }}>kaero.mail@gmail.com</div>
              <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>We respond within 24 hours</div>
            </div>
          </div>
        </div>
        <div style={{ background: G.card, borderRadius: 16, padding: 16, border: `1px solid ${G.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: G.text, marginBottom: 8 }}>🕐 Support Hours</div>
          <div style={{ fontSize: 12, color: G.text2, lineHeight: 1.7 }}>
            Saturday to Thursday: 9:00 AM to 9:00 PM<br />
            Friday: 2:00 PM to 9:00 PM<br />
            Cairo, Egypt (EET/GMT+2)
          </div>
        </div>
      </div>
    </div>
  );

  /* ── Rate Kaero Sub-page ── */
  if (showRate) return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title={T?.rateKaero || "Rate Kaero"} onBack={() => setShowRate(false)} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }}>
        <div style={{ textAlign: "center", padding: "20px 0 16px" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: G.greenDim, border: `3px solid ${G.green}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <LogoK size={48} dark={isDark} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: G.text, marginBottom: 4 }}>Rate Kaero</div>
          <div style={{ fontSize: 12, color: G.muted }}>Your feedback helps us improve</div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} style={{ fontSize: 36, cursor: "pointer", filter: s <= 4 ? "none" : "opacity(0.3)", transition: "all .2s" }}>⭐</div>
          ))}
        </div>
        <div style={{ background: G.card, borderRadius: 16, padding: 16, border: `1px solid ${G.border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: G.text, marginBottom: 12 }}>📊 Your Kaero Stats</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { v: `${(settingsUser?.rating || 4.9)}`, lb: "Your Rating", ic: "⭐", col: G.cyan },
              { v: `${settingsUser?.reviews || 0}`, lb: "Reviews", ic: "💬", col: G.cyan },
              { v: `${settingsUser?.sales || 0}`, lb: "Total Sales", ic: "🏷️", col: G.green },
              { v: totalIncome.toLocaleString(), lb: "Income (EGP)", ic: "💰", col: G.indigo },
            ].map((s, i) => (
              <div key={i} style={{ background: G.cardHi, borderRadius: 12, padding: "12px 10px", textAlign: "center", border: `1px solid ${G.border}` }}>
                <div style={{ fontSize: 18 }}>{s.ic}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: s.col, marginTop: 4 }}>{s.v}</div>
                <div style={{ fontSize: 10, color: G.muted, marginTop: 2 }}>{s.lb}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: G.card, borderRadius: 16, padding: 16, border: `1px solid ${G.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: G.text, marginBottom: 10 }}>🌟 Recent User Ratings</div>
          {[
            { from: "Youssef M.", stars: 5, text: "Amazing app! Made buying so safe.", time: "2 days ago" },
            { from: "Sara K.", stars: 5, text: "Best marketplace in Egypt!", time: "1 week ago" },
            { from: "Karim H.", stars: 4, text: "Great experience, wish delivery was built in.", time: "2 weeks ago" },
          ].map((r, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: i < 2 ? `1px solid ${G.border}` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: G.text }}>{r.from}</span>
                <span style={{ fontSize: 10, color: G.muted }}>{r.time}</span>
              </div>
              <div style={{ color: G.cyan, fontSize: 12, marginBottom: 3 }}>{"⭐".repeat(r.stars)}</div>
              <div style={{ fontSize: 12, color: G.text2 }}>"{r.text}"</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Btn full col={G.green} onClick={() => { showToast("Thank you for rating Kaero! 🌟"); setShowRate(false); }}>Submit Rating</Btn>
        </div>
      </div>
    </div>
  );

  /* ── Transaction History Sub-page ── */
  if (showTransactions) return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title={T?.transactionHistory || "Transaction History"} onBack={() => setShowTransactions(false)} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 24px" }}>
        <div style={{ background: `linear-gradient(135deg,${G.greenDim},${G.card})`, borderRadius: 16, padding: 16, border: `1px solid ${G.green}33`, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: G.muted, marginBottom: 4 }}>{T?.showingLast || "Showing last 30 transactions"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: G.green }}>{totalIncome.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: G.muted }}>Total Income (EGP)</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: G.green }}>{settingsTxList.length}</div>
              <div style={{ fontSize: 10, color: G.muted }}>Transactions</div>
            </div>
          </div>
        </div>
        {(settingsTxList.length > 0 ? settingsTxList : [
          { name: "No transactions yet", price: 0, type: "", time: "", col: G.muted, buyer: "", method: "" },
        ]).map((tx, i) => (
          <div key={i} style={{
            background: G.card, borderRadius: 14, padding: "12px 14px",
            marginBottom: 8, border: `1px solid ${G.border}`,
            display: "flex", alignItems: "center", gap: 12
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: tx.col + "22",
              border: `1px solid ${tx.col}44`, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 18
            }}>
              {tx.type === "Sold" ? "📤" : "📥"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{tx.name}</div>
              <div style={{ fontSize: 11, color: G.muted }}>{tx.buyer} · {tx.method} · {tx.time}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: tx.col }}>
                {tx.type === "Sold" ? "+" : ""}{tx.price.toLocaleString()} EGP
              </div>
              <Chip col={tx.col} sm>{tx.type}</Chip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      {toastMsg && (
        <div style={{
          position: "absolute", bottom: 80, left: 20, right: 20, zIndex: 100,
          background: "#019F45", borderRadius: 14, padding: "12px 16px",
          display: "flex", gap: 10, alignItems: "center",
          boxShadow: `0 4px 16px ${G.greenGlow}`, animation: "fadeUp .3s both"
        }}>
          <span style={{ fontSize: 16 }}>✅</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{toastMsg}</div>
        </div>
      )}
      <TopBar title={T?.settings || "Settings"} onBack={back} onHome={back} />
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px 24px" }}>

        <Section title={T?.accountSection || "ACCOUNT"} />
        <Row icon="👤" label={T?.editProfile2 || "Edit Profile"} sub={name} onClick={() => setShowEditProfile(true)} />
        <Row icon="📞" label={T?.phoneNumber3 || "Phone Number"} sub="+20 123 456 7890" onClick={() => showToast(T?.verified3 || "Phone verified ✅")} />
        <Row icon="🪪" label={T?.identityVerification || "Identity Verification"} sub={`${T?.verified3 || 'Verified'} ✅`} onClick={() => showToast(T?.verified3 || "ID verified ✅")} />
        <Row icon="🎙️" label={T?.voiceSample2 || "Voice Verification"} sub={`${T?.verified3 || 'Recorded'} ✅`} onClick={() => showToast(T?.verified3 || "Voice sample on file ✅")} />

        <Section title={T?.preferencesSection || "PREFERENCES"} />
        <Row icon="🔔" label={T?.pushNotifs || "Push Notifications"} sub={T?.offersDealsActivity || "Offers, deals, activity"}
          right={<Toggle val={notifs} onChange={(v) => { setNotifs(v); showToast(v ? "Notifications on" : "Notifications off"); }} />} />
        <Row icon="🌙" label={T?.darkMode || "Dark Mode"} sub={isDark ? (T?.onRecommended || "On (recommended)") : (T?.off || "Off")}
          right={<Toggle val={isDark} onChange={(v) => { if (setIsDark) setIsDark(v); showToast(v ? "Dark mode on" : "Light mode on"); }} />} />
        <Row icon="🇪🇬" label={T?.arabicInterface || "Arabic Interface"} sub="بالعربي"
          right={<Toggle val={lang === 'ar'} onChange={(v) => { if (setLang) setLang(v ? 'ar' : 'en'); DB.setLang(v ? 'ar' : 'en'); showToast(v ? "تم تفعيل العربية" : "English mode"); }} />} />
        <div style={{
          background: G.card, borderRadius: 14, padding: "13px 14px",
          marginBottom: 8, border: `1px solid ${G.border}`
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: G.muted, marginBottom: 8 }}>{T?.currency2 || "Currency"}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["EGP", "USD", "EUR"].map(c => (
              <button key={c} onClick={() => { setCurrency(c); showToast(`Currency set to ${c}`); }} style={{
                flex: 1, padding: "8px", borderRadius: 10, fontFamily: "inherit",
                background: currency === c ? G.green : G.cardHi, border: `1.5px solid ${currency === c ? G.green : G.border}`,
                color: currency === c ? "#fff" : G.text2, fontSize: 12, fontWeight: 700, cursor: "pointer"
              }}>{c}</button>
            ))}
          </div>
        </div>

        <Section title={T?.kaeroSearchSection || "KAERO & SEARCH"} />
        <div style={{
          background: G.card, borderRadius: 14, padding: "13px 14px",
          marginBottom: 8, border: `1px solid ${G.border}`
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: "#000", border: `1px solid ${G.green}44`,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}><LogoK size={24} dark={true} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{T?.defaultSearchRadius2 || "Default Search Radius"}</div>
              <div style={{ fontSize: 11, color: G.muted }}>{T?.listingsWithin2 || "Listings within"} {radius} km {T?.shownFirst2 || "shown first"}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 900, color: G.green }}>{radius}km</span>
          </div>
          <input type="range" min={.1} max={10} step={.1} value={radius}
            onChange={e => { setRadius(+e.target.value); }} style={{ width: "100%", accentColor: G.green }} />
        </div>
        <Row icon="🎯" label="Kaero Price Suggestions" sub="Auto-price your listings"
          right={<Toggle val={kaeroPrice} onChange={(v) => { setKaeroPrice(v); showToast(v ? "Kaero pricing on" : "Kaero pricing off"); }} />} />
        <Row icon="🤖" label="Kaero Smart Notifications" sub="Alerts based on your behavior"
          right={<Toggle val={kaeroNotifs} onChange={(v) => { setKaeroNotifs(v); showToast(v ? "Kaero alerts on" : "Kaero alerts off"); }} />} />
        <div style={{
          background: G.card, borderRadius: 14, padding: "13px 14px",
          marginBottom: 8, border: `1px solid ${G.border}`
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: G.muted, marginBottom: 8 }}>{T?.voiceSearchLang2 || "Voice Search Language"}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["auto", "🌐 Auto"], ["ar", "🇸🇦 Arabic"], ["en", "🇬🇧 English"]].map(([v, l]) => (
              <button key={v} onClick={() => { setLanguage(v); showToast(`Voice: ${l}`); }} style={{
                flex: 1, padding: "8px 4px", borderRadius: 10, fontFamily: "inherit",
                background: language === v ? G.green : G.cardHi, border: `1.5px solid ${language === v ? G.green : G.border}`,
                color: language === v ? "#fff" : G.text2, fontSize: 10, fontWeight: 700, cursor: "pointer"
              }}>{l}</button>
            ))}
          </div>
        </div>

        <Section title={T?.paymentsSection || "PAYMENTS"} />
        <Row icon="💳" label="Payment Methods" sub="Visa •••• 1234 · Vodafone Cash"
          onClick={() => setShowPayments(!showPayments)} />
        {showPayments && (
          <div style={{
            background: G.cardHi, borderRadius: 14, padding: 14, marginBottom: 8,
            border: `1px solid ${G.border}`
          }}>
            {[{ ic: "💳", lb: "Visa •••• 1234", sub: "Expires 09/27", def: true },
            { ic: "📱", lb: "Vodafone Cash", sub: "+20 123 456 7890", def: false },
            { ic: "🏦", lb: "InstaPay", sub: "ahmed@instapay", def: false }].map((pm, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, alignItems: "center", padding: "10px 0",
                borderBottom: i < 2 ? `1px solid ${G.border}` : "none"
              }}>
                <span style={{ fontSize: 22 }}>{pm.ic}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{pm.lb}</div>
                  <div style={{ fontSize: 11, color: G.muted }}>{pm.sub}</div>
                </div>
                {pm.def && <Chip col={G.green} sm>{T?.default2 || "Default"}</Chip>}
              </div>
            ))}
            <button onClick={() => showToast("Payment method added!")} style={{
              marginTop: 10, width: "100%",
              background: G.greenDim, border: `1.5px dashed ${G.green}55`, borderRadius: 10,
              padding: "10px", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              color: G.green, cursor: "pointer"
            }}>+ Add Payment Method</button>
          </div>
        )}
        <Row icon="🏦" label={T?.escrowWalletLabel2 || "Escrow Wallet"} sub={`${walletBalance.toLocaleString()} EGP ${T?.available2 || 'available'}`}
          onClick={() => showToast(`Escrow: ${walletBalance.toLocaleString()} EGP safe`)} />
        <Row icon="📊" label={T?.transactionHistory || "Transaction History"} onClick={() => setShowTransactions(true)} />

        <Section title={T?.securitySection || "SECURITY"} />
        <Row icon="🔐" label={T?.twoFa2 || "Two Factor Authentication"} sub={T?.smsAuth2 || "SMS + Authenticator"}
          right={<Toggle val={twoFa} onChange={(v) => { setTwoFa(v); showToast(v ? "2FA enabled 🔐" : "2FA disabled"); }} />} />
        <Row icon="👆" label={T?.biometricLogin2 || "Biometric Login"} sub={T?.faceId2 || "Face ID / Fingerprint"}
          right={<Toggle val={biometric} onChange={(v) => { setBiometric(v); showToast(v ? "Biometric on 👆" : "Biometric off"); }} />} />
        <Row icon="🔑" label={T?.changePassword2 || "Change Password"} onClick={() => showToast("Password reset email sent!")} />

        <Section title={T?.about || "ABOUT"} />
        <Row icon="📋" label={T?.termsOfService || "Terms of Service"} onClick={() => setShowTerms(true)} />
        <Row icon="🔒" label={T?.privacyPolicy || "Privacy Policy"} onClick={() => setShowPrivacy(true)} />
        <Row icon="⭐" label={T?.rateKaero || "Rate Kaero on App Store"} onClick={() => setShowRate(true)} />
        <Row icon="💬" label={T?.contactSupport || "Contact Support"} sub={T?.liveChat || "Live chat · Arabic & English"} onClick={() => setShowContact(true)} />

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={() => { clearAuth(); go("__signout__"); }} style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: G.green
          }}>
            {T?.signOut2 || "🚪 Sign Out"}
          </button>
          <div style={{ fontSize: 10, color: G.muted, marginTop: 8 }}>
            {T?.kaeroVersion || "Kaero v9.0.0 · Cairo, Egypt"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NOTIFICATIONS — Kaero behavior tracking
═══════════════════════════════════════════════════════════ */
function Notifications({ back, T }) {
  const [tab, setTab] = useState("all");
  const [notifs, setNotifs] = useState([
    { ic: "🤖", text: "Kaero Alert: New iPhone 13 Pro listed 0.4km away at 16,500 EGP, matches your search history!", time: "just now", col: G.green, unread: true, ai: true },
    { ic: "💬", text: "Youssef M. made an offer: 16,000 EGP for iPhone 13 Pro", time: "2m", col: G.green, unread: true },
    { ic: "🔄", text: "Lina K. added exchange offer: AirPods Pro + 16,500 EGP, view now", time: "15m", col: G.green, unread: true },
    { ic: "✅", text: "MacBook Air sold! 45,000 EGP released from escrow", time: "2h", col: G.green, unread: false },
  ]);

  // Fetch real notifications
  useEffect(() => {
    notificationApi.list().then(r => {
      if (r.data.notifications?.length > 0) {
        setNotifs(r.data.notifications.map(n => adaptNotification(n)));
      }
    }).catch(() => {});
    // Mark all as read
    notificationApi.readAll().catch(() => {});
  }, []);

  const handleNotifTap = (notif) => {
    if (notif.unread && notif._raw?.id) {
      notificationApi.readOne(notif._raw.id).catch(() => {});
      setNotifs(prev => prev.map(n => n === notif ? { ...n, unread: false } : n));
    }
  };

  const aiNotifs = notifs.filter(n => n.ai);
  const shown = tab === "ai" ? aiNotifs : notifs;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: G.bg }}>
      <TopBar title={T?.notifications || "Notifications"} onBack={back} onHome={back} />
      {/* Kaero Behavior Card */}
      <div style={{
        background: `linear-gradient(135deg,${G.greenDim},${G.card})`,
        padding: "12px 14px", borderBottom: `1px solid ${G.border}`
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, background: "#000",
            border: `1px solid ${G.green}44`, display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <LogoK size={22} dark={true} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: G.green }}>{T?.kaeroWatching2 || "Kaero is watching for you"}</div>
            <div style={{ fontSize: 10, color: G.muted }}>{T?.basedOnSearch2 || "Based on your search behavior"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["📱", "iPhone 13", "~20K EGP"], ["🎧", "AirPods Pro", "<5K"], ["💻", "MacBook", "<50K"]].map(([ic, item, pr]) => (
            <div key={item} style={{
              background: G.card, borderRadius: 10, padding: "5px 10px",
              border: `1px solid ${G.green}33`, display: "flex", alignItems: "center", gap: 5
            }}>
              <span style={{ fontSize: 13 }}>{ic}</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: G.text }}>{item}</div>
                <div style={{ fontSize: 9, color: G.muted }}>{pr}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", background: G.card, padding: 4, borderBottom: `1px solid ${G.border}` }}>
        {[["all", "All"], ["ai", "🤖 Kaero Alerts"]].map(([v, l]) => (
          <div key={v} onClick={() => setTab(v)} style={{
            flex: 1, textAlign: "center", padding: "8px",
            borderRadius: 10, background: tab === v ? G.green : "transparent",
            color: tab === v ? "#fff" : G.muted, fontSize: 12, fontWeight: 700, cursor: "pointer"
          }}>{l}</div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {shown.map((n, i) => (
          <div key={i} onClick={() => handleNotifTap(n)} style={{
            background: n.ai ? `linear-gradient(135deg,${G.greenDim},${G.card})` : G.card,
            borderRadius: 14, padding: "12px 13px",
            marginBottom: 8, border: `1.5px solid ${n.unread ? (n.col || G.green) + "44" : G.border}`,
            display: "flex", gap: 10, cursor: "pointer",
            boxShadow: n.unread ? `0 2px 12px ${(n.col || G.green)}22` : "none"
          }}>
            {n.ai ? (
              <div style={{
                width: 38, height: 38, borderRadius: "50%", background: "#000",
                border: `2px solid ${G.green}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <LogoK size={24} dark={true} />
              </div>
            ) : (
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: n.col + "22", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 18, flexShrink: 0
              }}>{n.ic}</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 12, color: n.unread ? G.text : G.text2,
                lineHeight: 1.45, fontWeight: n.unread ? 600 : 400
              }}>{n.text}</div>
              <div style={{ fontSize: 11, color: G.muted, marginTop: 3 }}>{n.time} ago</div>
            </div>
            {n.unread && <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: n.col, flexShrink: 0, marginTop: 6
            }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════ */
function KaeroApp() {
  const [screen, setScreen] = useState("splash");
  const [payload, setPayload] = useState(null);
  const [history, setHistory] = useState([]);
  const [isDark, setIsDark] = useState(true);
  const [lang, setLang] = useState(DB.getLang() || "en");
  const [authed, setAuthed] = useState(false);
  const [authScreen, setAuthScreen] = useState("login");
  const [user, setUser] = useState(() => {
    const u = DB.getUser();
    return u && u.name ? u : { name: '', avatar: '', email: '', phone: '', bio: '', location: 'Cairo, Egypt', trustScore: 96, rating: 4.9, reviews: 0, sales: 0, verified: true };
  });

  /* Apply theme SYNCHRONOUSLY before render — fixes the glitch */
  Object.assign(G, THEMES[isDark ? "dark" : "light"]);

  const T = TR[lang];

  const go = (to, data = null) => {
    if (to === '__signout__') {
      clearAuth();
      setUser(null);
      setAuthed(false);
      setScreen('login');
      setHistory([]);
      setPayload(null);
      return;
    }
    setHistory(h => [...h, { screen, payload }]);
    setPayload(data);
    setScreen(to);
  };
  const back = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setScreen(prev.screen);
      setPayload(prev.payload);
    } else {
      setScreen("home");
      setPayload(null);
      setHistory([]);
    }
  };
  const goHome = () => { setScreen("home"); setPayload(null); setHistory([]); };

  const commonProps = { T, isDark, setIsDark, lang, setLang, user, setUser };

  return (
    <div style={{
      minHeight: "100vh",
      background: isDark ? "#FFFFFF" : "#EAECEF",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", padding: "20px 14px",
      direction: lang === "ar" ? "rtl" : "ltr"
    }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&display=swap');
        @keyframes popIn{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{from{opacity:.2;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes rippleGreen{0%{box-shadow:0 0 0 0 #019F4555}70%{box-shadow:0 0 0 18px transparent}100%{box-shadow:0 0 0 0 transparent}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes splashEntry{from{opacity:0;transform:translateY(32px) scale(.92)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes splashRing{0%{opacity:.7;transform:translate(-50%,-50%) scale(.7)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.6)}}
        @keyframes splashOrb1{from{transform:translateX(-50%) scale(1)}to{transform:translateX(-50%) scale(1.18)}}
        @keyframes splashOrb2{from{opacity:.6;transform:translate(-50%,-50%) scale(.9)}to{opacity:1;transform:translate(-50%,-50%) scale(1.1)}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:4px;background:${G.border};}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#019F45;cursor:pointer;box-shadow:0 2px 8px #019F4566;}
        ::-webkit-scrollbar{width:0;height:0;}
        button,input,textarea{font-family:'Outfit','Inter',-apple-system,'Helvetica Neue',sans-serif;}
        *{scrollbar-width:none;font-family:'Outfit','Inter',-apple-system,'Helvetica Neue',sans-serif;}
        /* Monochrome emoji system — desaturates all emoji to unified look */
        .emoji-mono{filter:grayscale(1) brightness(1.4) contrast(.9);opacity:.7;font-style:normal;}
      `}</style>

      <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>

        {/* ── PHONE SHELL ── */}
        <div key={isDark ? "dark" : "light"} style={{
          width: 375, height: 812, borderRadius: 52, background: G.bg,
          boxShadow: isDark
            ? `0 40px 80px rgba(0,0,0,.5), 0 0 0 10px #111311, 0 0 0 12px ${G.border}`
            : `0 40px 80px rgba(0,0,0,.18), 0 0 0 10px #d0d4d0, 0 0 0 12px #b8bcb8`,
          overflow: "hidden", position: "relative", flexShrink: 0
        }}>

          {/* status bar */}
          <div style={{
            height: 46, background: G.bg, borderBottom: `1px solid ${G.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 22px", fontSize: 13, fontWeight: 700, color: G.text
          }}>
            <span>9:41</span>
            <div style={{
              width: 110, height: 24, background: isDark ? G.cardHi : G.border, borderRadius: 20,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: isDark ? G.cardTop : G.border2 }} />
            </div>
            <span style={{ letterSpacing: .4, color: G.text2 }}>●●● 🔋</span>
          </div>

          {/* screen */}
          <div style={{ height: 766, overflowY: "auto", overflowX: "hidden", background: G.bg }}>
            {screen === "splash" && <Splash done={() => setScreen(authed ? "home" : "login")} />}
            {screen === "login" && <LoginPage T={T} isDark={isDark} onLogin={() => { const u = DB.getUser(); if (u && u.name) setUser(u); setAuthed(true); setScreen("home"); }} onSignup={() => setScreen("signup")} />}
            {screen === "signup" && <SignupPage T={T} lang={lang} setLang={setLang} onLogin={() => setScreen("login")} onComplete={(userData, selectedLang) => { setUser(userData); if (selectedLang) setLang(selectedLang); setAuthed(true); setScreen("home"); }} />}
            {screen === "home" && <Home go={go} {...commonProps} />}
            {screen === "buy_cats" && <BuyCats go={go} back={goHome} {...commonProps} />}
            {screen === "buy_list" && <BuyList go={go} back={back} data={payload} {...commonProps} />}
            {screen === "voice_search" && <VoiceSearch back={back} go={go} {...commonProps} />}
            {screen === "product" && <ProductDetail item={payload} back={back} go={go} {...commonProps} />}
            {screen === "sell" && <Sell back={goHome} {...commonProps} go={go} />}
            {screen === "market" && <Market back={goHome} go={go} {...commonProps} />}
            {screen === "store" && <MyStore back={goHome} go={go} {...commonProps} />}
            {screen === "store_offers" && <StoreOffers item={payload} back={back} go={go} {...commonProps} />}
            {screen === "chat" && <Chat item={payload} back={back} {...commonProps} />}
            {screen === "payment" && <Payment item={payload} back={back} {...commonProps} />}
            {screen === "notifications" && <Notifications back={back} {...commonProps} />}
            {screen === "profile" && <Profile back={goHome} go={go} user={user} T={T} />}
            {screen === "settings" && <Settings back={back} go={go} {...commonProps} />}
            {screen === "seller_store" && <BuyList go={go} back={back}
              data={{ cat: { label: `${payload?.seller?.split(" ")[0]}'s Store` } }} />}
          </div>
        </div>

        {/* ── SIDEBAR ── */}
        <div style={{ width: 242, animation: "fadeUp 1s .3s both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{
              background: "rgba(0,0,0,.85)", borderRadius: 14, padding: 8,
              border: "1px solid rgba(99,102,241,.3)"
            }}>
              <LogoK size={30} dark={true} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>KAERO</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,.4)", letterSpacing: 2 }}>SMART LOCAL COMMERCE</div>
            </div>
          </div>

          <div style={{
            fontSize: 9, color: "rgba(255,255,255,.35)", letterSpacing: 2,
            fontWeight: 700, marginBottom: 8, marginTop: 20
          }}>ALL SCREENS</div>

          {[
            { id: "login", label: "🔐 Login", desc: "Auth flow" },
            { id: "signup", label: "📝 Sign Up", desc: "OTP + ID" },
            { id: "home", label: "🏠 Home", desc: "Hub + activity feed" },
            { id: "buy_cats", label: "🛍️ Browse", desc: "Categories" },
            { id: "buy_list", label: "📋 Listings", desc: "Grid with filters" },
            { id: "voice_search", label: "🎙️ Voice Search", desc: "Kaero voice queries" },
            { id: "product", label: "🛒 Product Detail", desc: "3-tab item view", data: PRODUCTS[0] },
            { id: "chat", label: "💬 Chat", desc: "Messaging + offers", data: PRODUCTS[0] },
            { id: "payment", label: "💳 Payment", desc: "Escrow flow", data: PRODUCTS[0] },
            { id: "sell", label: "📸 SELL", desc: "Camera + Kaero listing" },
            { id: "market", label: "🗺️ MARKET", desc: "Map + radius" },
            { id: "store", label: "🏪 My Store", desc: "Listings + analytics" },
            { id: "store_offers", label: "🔄 Store Offers", desc: "Offers + exchange", data: MY_STORE[0] },
            { id: "notifications", label: "🔔 Notifications", desc: "Activity feed" },
            { id: "profile", label: "👤 Profile", desc: "Complete profile" },
            { id: "settings", label: "⚙️ Settings", desc: "Prefs + security" },
          ].map(s => (
            <div key={s.id} onClick={() => go(s.id, s.data || null)}
              style={{
                background: screen === s.id ? "rgba(1,159,69,.14)" : "rgba(255,255,255,.04)",
                border: `1px solid ${screen === s.id ? "rgba(1,159,69,.45)" : "rgba(255,255,255,.07)"}`,
                borderRadius: 11, padding: "7px 11px", marginBottom: 4,
                cursor: "pointer", transition: "all .2s",
                boxShadow: screen === s.id ? `0 2px 12px rgba(1,159,69,.30)` : "none"
              }}>
              <div style={{
                fontSize: 11, fontWeight: 700,
                color: screen === s.id ? "#019F45" : "rgba(255,255,255,.8)"
              }}>{s.label}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,.35)" }}>{s.desc}</div>
            </div>
          ))}

          <div style={{
            marginTop: 14, background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: 12
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: G.indigo,
              letterSpacing: 2, marginBottom: 8
            }}>TECH SPEC</div>
            {[["🤖", "Kaero Listing", "60 sec"], ["🛡️", "Escrow", "7-day"],
            ["📍", "Radius", "100m to 10km"], ["🔊", "Voice", "AR + EN"],
            ["🔄", "Exchange", "Items + cash"], ["💰", "Fee", "4% (2+2)"],
            ["⚡", "Kaero Fraud", "< 200ms"], ["🔒", "Verified", "Phone+ID+Voice"],
            ].map(([ic, k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
                <span style={{ color: "rgba(255,255,255,.4)" }}>{ic} {k}</span>
                <span style={{ color: "rgba(255,255,255,.85)", fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default KaeroApp;
