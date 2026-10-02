// Bilingual strings (Bangla default, English toggle). Plain, friendly language throughout.
const STR = {
  bn: {
    skipToContent: "মূল অংশে যান", search: "খুঁজুন", searchPlaceholder: "ইয়ারবাড, ৬৫W চার্জার, পাওয়ার ব্যাংক…", account: "অ্যাকাউন্ট", wishlist: "পছন্দের তালিকা", cart: "কার্ট",
    home: "হোম", shop: "শপ", about: "আমাদের কথা", contact: "যোগাযোগ", track: "অর্ডার ট্র্যাক",
    shopByCategory: "ক্যাটাগরি অনুযায়ী কিনুন", collections: "সেটআপ", shopTheSet: "সেটআপটি দেখুন", pieces: "{n}টি পণ্য", setPrice: "সব মিলিয়ে {price}", customerPhotos: "ক্রেতাদের রিভিউ", newArrivals: "নতুন এসেছে", bestSellers: "সবচেয়ে বেশি বিক্রি", viewAll: "সব দেখুন",
    happyParents: "ক্রেতারা যা বলছেন", noReviewsYet: "প্রথম রিভিউ আপনিই দিন — পণ্য হাতে পাওয়ার পর অর্ডার পেজ থেকে রিভিউ লিখতে পারবেন।",
    newsletter: "নতুন গ্যাজেট ও ডিলের খবর পান", newsletterSub: "মাসে ১–২টি মেসেজ, স্প্যাম নয়।", subscribe: "সাবস্ক্রাইব", emailOrPhone: "ইমেইল বা মোবাইল নম্বর",
    footerAbout: "ঢাকার গ্যাজেট ও টেক এক্সেসরিজের দোকান — অডিও, ওয়্যারেবল, পাওয়ার, মোবাইল এক্সেসরিজ, গেমিং, স্মার্ট হোম ও কম্পিউটার এক্সেসরিজ। পূর্ণ স্পেক শিট, ইনভয়েসে আসল ওয়ারেন্টি। সারা দেশে ক্যাশ অন ডেলিভারি।", policies: "নীতিমালা", visitUs: "আমাদের ঠিকানা",
    returnsPolicy: "রিটার্ন ও রিফান্ড", deliveryPolicy: "ডেলিভারি", privacyPolicy: "গোপনীয়তা", warrantyPolicy: "ওয়ারেন্টি নীতি", weAccept: "যেভাবে পেমেন্ট করবেন",
    chatWhatsApp: "হোয়াটসঅ্যাপে চ্যাট", callUs: "কল করুন",
    filters: "ফিল্টার", clearAll: "সব মুছুন", giftWrap: "গিফট বক্স", giftWrapAdd: "গিফট বক্সে দিন — বক্স, রিবন ও হাতে লেখা কার্ড (+{fee})", giftWrapNote: "চেকআউটে গিফট বক্স (+{fee}) যোগ করতে পারবেন", zoomHint: "বড় করে দেখতে ছবিতে চাপুন", category: "ক্যাটাগরি", brand: "ব্র্যান্ড", price: "দাম", min: "সর্বনিম্ন", max: "সর্বোচ্চ", apply: "প্রয়োগ করুন",
    inStockOnly: "শুধু স্টকে আছে", onSale: "ছাড়ে", sortBy: "সাজান", sort_newest: "নতুন আগে", sort_price_asc: "দাম: কম থেকে বেশি", sort_price_desc: "দাম: বেশি থেকে কম", sort_popular: "জনপ্রিয়", sort_rating: "রেটিং",
    results: "{n}টি পণ্য", noResults: "কিছু পাওয়া যায়নি", noResultsSub: "ফিল্টার কমিয়ে বা অন্য শব্দে খুঁজে দেখুন।", loadMore: "আরও দেখুন", searchResultsFor: "“{q}” এর ফলাফল",
    addToCart: "কার্টে যোগ করুন", buyNow: "এখনই কিনুন", added: "কার্টে যোগ হয়েছে", outOfStock: "স্টক শেষ", inStock: "স্টকে আছে", stockCount: "স্টকে {n}টি আছে", chooseOption: "একটি অপশন বেছে নিন",
    size: "অপশন", color: "রং", qty: "পরিমাণ", care: "জেনে রাখুন", description: "বিবরণ", reviews: "রিভিউ", writeReview: "রিভিউ লিখুন", relatedProducts: "এ ধরনের আরও",
    certified: "ট্রাস্ট ব্যাজ", certNote: "শুধু যে ব্যাজের প্রমাণ (ডকুমেন্ট) আমাদের কাছে আছে, সেগুলোই দেখানো হয়।", validUntil: "মেয়াদ", issuer: "প্রদানকারী",
    notifyMe: "স্টকে এলে জানান", notifyMeSub: "মোবাইল নম্বর দিন — স্টকে এলেই SMS পাবেন।", notifyDone: "স্টকে এলেই আপনাকে জানাবো।", share: "শেয়ার",
    codAvailable: "ক্যাশ অন ডেলিভারি", deliveryIn: "ডেলিভারি {eta}", easyReturns: "৭ দিনে রিটার্ন — বক্স ও সব এক্সেসরিজসহ",
    yourCart: "আপনার কার্ট", cartEmpty: "কার্ট খালি। চলুন একটা গ্যাজেট বেছে নিই!", continueShopping: "কেনাকাটা চালিয়ে যান", subtotal: "সাবটোটাল", discount: "ছাড়", delivery: "ডেলিভারি চার্জ", total: "মোট", vat: "ভ্যাট", vatIncluded: "ভ্যাট ({rate}%) অন্তর্ভুক্ত",
    free: "ফ্রি", freeDelivery: "ফ্রি ডেলিভারি", deliveryAuto: "ডেলিভারি চার্জ আপনার এলাকা অনুযায়ী চেকআউটে অটো হিসাব হবে", deliveryAtCheckout: "এলাকা বেছে নিলে হিসাব হবে", freeDeliveryCoupon: "কুপন", freeDeliveryItems: "এই পণ্যগুলোতে", popupClose: "বন্ধ করুন", proceedCheckout: "চেকআউট করুন", viewCart: "কার্ট দেখুন", remove: "সরান", coupon: "কুপন বা রেফারেল কোড", applyCoupon: "প্রয়োগ", couponApplied: "কোড প্রয়োগ হয়েছে", freeOver: "৳{n}+ অর্ডারে ফ্রি ডেলিভারি",
    checkout: "চেকআউট", contactDetails: "আপনার তথ্য", fullName: "পুরো নাম", mobile: "মোবাইল নম্বর", email: "ইমেইল (ঐচ্ছিক)", deliveryAddress: "ডেলিভারি ঠিকানা",
    division: "বিভাগ", district: "জেলা", upazila: "উপজেলা / থানা", area: "বাড়ি, রোড, এলাকা", areaHint: "যেমন: বাড়ি ১২, রোড ৩, সেকশন ১০", quickArea: "পোস্টকোড বা এলাকার নাম দিয়ে খুঁজুন", noAreaMatch: "মিল পাওয়া যায়নি", choose: "বেছে নিন",
    payment: "পেমেন্ট", cod: "ক্যাশ অন ডেলিভারি", codSub: "পণ্য হাতে পেয়ে টাকা দিন", card: "কার্ড (ভিসা/মাস্টারকার্ড)", cardSub: "নিরাপদ SSLCommerz পেজে", mfsSend: "{method} ({type}) নম্বরে ৳{total} Send Money করুন: {number}", trxId: "ট্রানজেকশন আইডি (TrxID)", payOnPage: "পরের ধাপে {method} পেজে পেমেন্ট করবেন",
    orderNote: "বিশেষ নির্দেশনা (ঐচ্ছিক)", giftMessage: "উপহার বার্তা (ঐচ্ছিক)", placeOrder: "অর্ডার করুন", placing: "অর্ডার হচ্ছে…",
    verifyPhone: "মোবাইল নম্বর যাচাই", sendCode: "কোড পাঠান", resend: "আবার পাঠান", enterCode: "৬ সংখ্যার কোড", verify: "যাচাই করুন", verified: "যাচাই হয়েছে ✓", verifyWhy: "ভুয়া অর্ডার ঠেকাতে ক্যাশ অন ডেলিভারির আগে নম্বর যাচাই করা হয়।", skipOtp: "SMS আসছে না? আমরা কল করে কনফার্ম করবো।",
    orderSummary: "অর্ডার সারাংশ", secureCheckout: "আপনার তথ্য নিরাপদ। কার্ডের তথ্য আমরা কখনো দেখি না।", registryShipNote: "",
    thankYou: "ধন্যবাদ! অর্ডারটি পেয়েছি", orderNumber: "অর্ডার নম্বর", invoice: "ইনভয়েস", downloadInvoice: "ইনভয়েস ডাউনলোড (PDF)", invoiceIsWarranty: "ইনভয়েসই আপনার ওয়ারেন্টি কার্ড — সংরক্ষণ করুন।", weWillCall: "অর্ডার কনফার্ম করতে আমরা শীঘ্রই আপনাকে কল করবো।", confirmedAuto: "আপনার অর্ডার কনফার্ম হয়েছে!",
    orderStatus: "অর্ডারের অবস্থা", trackOrder: "অর্ডার ট্র্যাক করুন", trackSub: "অর্ডার নম্বর ও মোবাইল নম্বর দিন", find: "খুঁজুন", courier: "কুরিয়ার", trackingId: "ট্র্যাকিং আইডি", trackWithCourier: "কুরিয়ারের সাইটে দেখুন",
    requestReturn: "রিটার্নের অনুরোধ", returnReason: "কারণ", reason_damaged: "ক্ষতিগ্রস্ত অবস্থায় এসেছে", reason_wrong_item: "ভুল পণ্য এসেছে", reason_not_working: "চালু হচ্ছে না / কাজ করছে না", reason_not_as_described: "বিবরণের সাথে মেলেনি", reason_changed_mind: "মত বদলেছি", reason_other: "অন্য কারণ", details: "বিস্তারিত", send: "পাঠান",
    rateProduct: "রেটিং দিন", yourReview: "আপনার অভিজ্ঞতা", yourName: "আপনার নাম", reviewThanks: "ধন্যবাদ! যাচাইয়ের পর রিভিউ দেখানো হবে।", verifiedPurchase: "যাচাইকৃত ক্রেতা",
    signIn: "সাইন ইন", register: "অ্যাকাউন্ট খুলুন", password: "পাসওয়ার্ড", forgotPassword: "পাসওয়ার্ড ভুলে গেছেন?", signOut: "সাইন আউট", newHere: "নতুন? অ্যাকাউন্ট খুলুন", haveAccount: "অ্যাকাউন্ট আছে? সাইন ইন করুন", resetPassword: "পাসওয়ার্ড রিসেট", newPassword: "নতুন পাসওয়ার্ড", code: "কোড",
    myOrders: "আমার অর্ডার", addresses: "ঠিকানা", returns: "রিটার্ন", referral: "বন্ধুকে রেফার করুন", profile: "প্রোফাইল", save: "সংরক্ষণ", saved: "সংরক্ষণ হয়েছে", cancel: "বাতিল", delete: "মুছুন", edit: "এডিট", addNew: "নতুন যোগ করুন",
    noOrders: "এখনো কোনো অর্ডার নেই।", label: "লেবেল", recipient: "প্রাপকের নাম", makeDefault: "ডিফল্ট ঠিকানা", defaultTag: "ডিফল্ট",
    copy: "কপি", copied: "কপি হয়েছে",
    referralHeadline: "বন্ধুকে ৳{friend} ছাড় দিন, আপনি পান ৳{reward}", referralSub: "বন্ধুর প্রথম অর্ডার (৳{min}+) ডেলিভারি হলেই আপনার রিওয়ার্ড কোড SMS এ আসবে।", yourCode: "আপনার কোড", uses: "ব্যবহার", rewards: "রিওয়ার্ড",
    budget: "বাজেট (৳)",
    notFound: "পেজটি পাওয়া যায়নি", backHome: "হোমে ফিরে যান", somethingWrong: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।", loading: "লোড হচ্ছে…", retry: "আবার চেষ্টা করুন",
    status_pending: "অপেক্ষমাণ", status_confirmation_attempted: "কনফার্মের অপেক্ষায়", status_confirmed: "কনফার্মড", status_packed: "প্যাক হয়েছে", status_shipped: "পাঠানো হয়েছে", status_delivered: "ডেলিভারি হয়েছে", status_cancelled: "বাতিল", status_refused: "ফেরত গেছে", status_returned: "রিটার্ন হয়েছে",
    pay_pending: "বাকি", pay_paid: "পরিশোধিত", pay_failed: "ব্যর্থ", pay_refunded: "ফেরত", pay_partially_refunded: "আংশিক ফেরত",
    installApp: "অ্যাপের মতো ব্যবহার করুন", enableUpdates: "অর্ডারের আপডেট নোটিফিকেশনে পান",
    next: "পরের ধাপ", back: "আগের ধাপ",
    myRoutine: "আবার কিনুন", myRoutineSub: "আপনি যে পণ্যগুলো আগে কিনেছেন — ক্যাবল বা কেস হারালে এক চাপে আবার অর্ডার করুন।", noRoutine: "কেনাকাটার পর আপনার পণ্যগুলো এখানে দেখাবে, সহজে আবার কেনার জন্য।", lastOrdered: "শেষ অর্ডার {d}", reorder: "আবার অর্ডার করুন", timesOrdered: "{n} বার কিনেছেন",
    // Gadget-specific
    worksWith: "সাপোর্ট করে", worksWithDevice: "{d} এর সাথে চলে", devices: "ডিভাইস", specs: "স্পেসিফিকেশন", highlights: "মূল ফিচার", inTheBox: "বক্সে যা আছে", howToUse: "সেটআপ / ব্যবহার",
    warranty: "ওয়ারেন্টি", warrantyMonths: "{n} মাস ওয়ারেন্টি", warrantyYears: "{n} বছর ওয়ারেন্টি", noWarranty: "ওয়ারেন্টি নেই", warrantyTerms: "ওয়ারেন্টির শর্ত", warrantyFromDelivery: "ডেলিভারির দিন থেকে, ইনভয়েসের ভিত্তিতে",
    madeIn: "উৎস: {c}", model: "মডেল",
    compare: "তুলনা", compareAdd: "তুলনায় যোগ করুন", compareAdded: "তুলনায় আছে", compareTitle: "স্পেক তুলনা", compareSub: "২–৩টি পণ্যের স্পেক পাশাপাশি — যেগুলো আলাদা সেগুলো হাইলাইট করা।", compareNeed2: "তুলনা করতে আরও একটি পণ্য বেছে নিন।", compareMax: "একসাথে সর্বোচ্চ ৩টি পণ্য তুলনা করা যায়।", compareNow: "তুলনা দেখুন ({n})", compareDiff: "শুধু পার্থক্য দেখান", compareClear: "সব সরান", notListed: "—",
    dealOfDay: "আজকের ডিল", dealOfDaySub: "আসল শেষ সময় আর আসল স্টকসহ — সময় শেষ হলে দাম আগের মতো।", dealEnds: "ডিল শেষ হতে", dealEndsOn: "ডিল চলবে {d} পর্যন্ত", dealEnded: "ডিল শেষ", days: "দিন", hours: "ঘণ্টা", mins: "মিনিট", secs: "সেকেন্ড", allDeals: "সব ডিল", deals: "ডিল",
    bundles: "কম্বো ডিল", bundle: "কম্বো", allBundles: "সব কম্বো", bundlesSub: "একসাথে কাজে লাগে এমন পণ্য, এক প্যাকেজে — আজকের দামে আলাদা কেনার চেয়ে কম।", bundleContains: "এই কম্বোতে আছে", bundleSeparate: "আলাদা কিনলে {price}", bundleSave: "কম্বোতে সাশ্রয় {price}", inBundles: "এই কম্বোগুলোতেও আছে", readyBundles: "তৈরি কম্বো",
    finder: "গ্যাজেট ফাইন্ডার", finderTitle: "আপনার ডিভাইসের জন্য গ্যাজেট খুঁজুন", finderSub: "কোন ডিভাইস ব্যবহার করেন আর বাজেট কত বলুন — প্রতিটি তাক থেকে স্টকে থাকা একটি করে মানানসই জিনিস সাজিয়ে দেবো।", finderStep1: "কোন ডিভাইস ব্যবহার করেন?", finderStep2: "আপনার বাজেট", finderResult: "আপনার সেটআপ", finderTotal: "সব মিলিয়ে", addAll: "সব কার্টে নিন", finderNone: "এই বাজেটে মানানসই পণ্য পাওয়া যায়নি — বাজেট একটু বাড়িয়ে দেখুন।", retake: "আবার শুরু করুন", showSetup: "আমার সেটআপ দেখুন", finderTeaser: "কোনটা আপনার ফোনে চলবে বুঝতে পারছেন না?",
    guides: "টেক গাইড", guidesTitle: "টেক গাইড", guidesSub: "কেনার আগে জানার মতো সহজ লেখা — ওয়াট, IP রেটিং, ওয়ারেন্টি।", readMore: "পড়ুন", byAuthor: "লিখেছেন {a}", productsInPost: "এই লেখায় যে পণ্যগুলোর কথা আছে", noPosts: "শীঘ্রই নতুন লেখা আসছে।",
    qa: "প্রশ্ন ও উত্তর", askQuestion: "প্রশ্ন করুন", yourQuestion: "আপনার প্রশ্ন", questionThanks: "ধন্যবাদ! উত্তরসহ আপনার প্রশ্নটি এখানে দেখানো হবে।", noQuestions: "এখনো কোনো প্রশ্ন নেই — প্রথম প্রশ্নটি আপনিই করুন।", answeredBy: "উত্তর দিয়েছেন {a}", answer: "উত্তর",
    spotlight: "সহজ ভাষায়", shopSpotlight: "{i} আছে এমন পণ্য", goesWellWith: "সাথে ভালো চলে", singleProducts: "একক পণ্য", bundleOnly: "শুধু কম্বো", productType: "ধরন",
    certificationsTitle: "আমাদের ট্রাস্ট ব্যাজ", certificationsSub: "যে প্রমাণ আমাদের কাছে আছে, শুধু সেগুলোই।", ourStory: "আমাদের গল্প", storyTitle: "স্মার্ট গ্যাজেট, সৎ স্পেক",
    storyBody: "আমরা প্রতিটি পণ্যের পূর্ণ স্পেক শিট দিই, ওয়ারেন্টি মাসে লিখি আর ইনভয়েসে ছাপি, আর স্টক বা অফারের সময় কখনো বানিয়ে লিখি না। পাঠানোর আগে প্রতিটি ইউনিট চালু করে দেখি, আর ক্লেইম হলে সিরিয়াল নম্বর মিলিয়ে দ্রুত সমাধান করি।",
    trustSpecs: "পূর্ণ স্পেক শিট", trustWarranty: "ইনভয়েসে আসল ওয়ারেন্টি", trustStock: "আসল স্টক, আসল ডিলের সময়", trustCod: "সারা দেশে ক্যাশ অন ডেলিভারি",
    // Account: warranty claims
    warrantyClaims: "ওয়ারেন্টি", claimNew: "ওয়ারেন্টি ক্লেইম করুন", claimPick: "কোন পণ্য?", claimIssue: "কী সমস্যা?", claimDetails: "কী হচ্ছে এক-দুই লাইনে লিখুন", serialNo: "সিরিয়াল নম্বর (বক্স বা ডিভাইসের লেবেলে)", serialOnFile: "আমাদের রেকর্ডে সিরিয়াল: {s}", claimSubmit: "ক্লেইম পাঠান", claimSent: "ক্লেইম পাঠানো হয়েছে",
    myClaims: "আমার ক্লেইম", noClaims: "কোনো ক্লেইম নেই।", noWarrantyItems: "ওয়ারেন্টিযুক্ত পণ্য ডেলিভারি হলে এখানে দেখাবে।", warrantyUntil: "ওয়ারেন্টি {d} পর্যন্ত", warrantyEnded: "ওয়ারেন্টি {d} তারিখে শেষ", claimOpen: "ক্লেইম {c} চলছে", claimWhatsCovered: "ম্যানুফ্যাকচারিং ত্রুটি কভার করে; পড়ে যাওয়া, ভাঙা বা রেটিংয়ের বেশি পানিতে ক্ষতি কভার করে না।",
    issue_not_charging: "চার্জ হচ্ছে না", issue_no_sound: "শব্দ নেই / এক দিকে শব্দ", issue_not_turning_on: "চালু হচ্ছে না", issue_connection: "কানেক্ট / পেয়ার হচ্ছে না", issue_battery: "ব্যাটারি দ্রুত শেষ হচ্ছে", issue_physical: "বাটন / বডির সমস্যা", issue_other: "অন্য সমস্যা",
    claim_submitted: "জমা হয়েছে", claim_under_review: "যাচাই চলছে", claim_approved: "অনুমোদিত", claim_rejected: "বাতিল", claim_resolved: "সমাধান হয়েছে",
    resolution_repair: "মেরামত", resolution_replace: "বদলে দেওয়া", resolution_refund: "টাকা ফেরত", resolution_none: "—", claimNote: "আমাদের নোট",
  },
  en: {
    skipToContent: "Skip to content", search: "Search", searchPlaceholder: "Earbuds, 65W charger, power bank…", account: "Account", wishlist: "Wishlist", cart: "Cart",
    home: "Home", shop: "Shop", about: "About us", contact: "Contact", track: "Track order",
    shopByCategory: "Shop by category", collections: "Setups", shopTheSet: "See the setup", pieces: "{n} products", setPrice: "{price} together", customerPhotos: "Customer reviews", newArrivals: "New arrivals", bestSellers: "Best sellers", viewAll: "View all",
    happyParents: "What customers say", noReviewsYet: "Be the first to review — once your order arrives you can write one from the order page.",
    newsletter: "Get new gadgets & deals first", newsletterSub: "1–2 messages a month. No spam.", subscribe: "Subscribe", emailOrPhone: "Email or mobile number",
    footerAbout: "A gadget and tech-accessories shop in Dhaka — audio, wearables, power, mobile accessories, gaming, smart home and computer accessories. Full spec sheets, real warranty on your invoice. Cash on Delivery across Bangladesh.", policies: "Policies", visitUs: "Visit us",
    returnsPolicy: "Returns & refunds", deliveryPolicy: "Delivery", privacyPolicy: "Privacy", warrantyPolicy: "Warranty policy", weAccept: "Ways to pay",
    chatWhatsApp: "Chat on WhatsApp", callUs: "Call us",
    filters: "Filters", clearAll: "Clear all", giftWrap: "Gift box", giftWrapAdd: "Gift-box it — box, ribbon and a handwritten card (+{fee})", giftWrapNote: "Add a gift box (+{fee}) at checkout", zoomHint: "Tap the photo to zoom", category: "Category", brand: "Brand", price: "Price", min: "Min", max: "Max", apply: "Apply",
    inStockOnly: "In stock only", onSale: "On sale", sortBy: "Sort", sort_newest: "Newest", sort_price_asc: "Price: low to high", sort_price_desc: "Price: high to low", sort_popular: "Popular", sort_rating: "Rating",
    results: "{n} products", noResults: "Nothing found", noResultsSub: "Try fewer filters or a different word.", loadMore: "Show more", searchResultsFor: "Results for “{q}”",
    addToCart: "Add to cart", buyNow: "Buy now", added: "Added to cart", outOfStock: "Out of stock", inStock: "In stock", stockCount: "{n} in stock", chooseOption: "Choose an option",
    size: "Option", color: "Colour", qty: "Quantity", care: "Good to know", description: "Description", reviews: "Reviews", writeReview: "Write a review", relatedProducts: "More like this",
    certified: "Trust badges", certNote: "We only show badges we hold documents for.", validUntil: "Valid until", issuer: "Issued by",
    notifyMe: "Notify me when back", notifyMeSub: "Leave your mobile number — we'll SMS you as soon as it's back.", notifyDone: "We'll let you know as soon as it's back.", share: "Share",
    codAvailable: "Cash on Delivery", deliveryIn: "Delivery in {eta}", easyReturns: "7-day returns with the box and all accessories",
    yourCart: "Your cart", cartEmpty: "Your cart is empty. Let's find you a gadget!", continueShopping: "Continue shopping", subtotal: "Subtotal", discount: "Discount", delivery: "Delivery", total: "Total", vat: "VAT", vatIncluded: "Includes VAT ({rate}%)",
    free: "Free", freeDelivery: "Free delivery", deliveryAuto: "Delivery charge is calculated automatically for your area at checkout", deliveryAtCheckout: "Calculated when you choose your area", freeDeliveryCoupon: "coupon", freeDeliveryItems: "on these items", popupClose: "Close", proceedCheckout: "Checkout", viewCart: "View cart", remove: "Remove", coupon: "Coupon or referral code", applyCoupon: "Apply", couponApplied: "Code applied", freeOver: "Free delivery over ৳{n}",
    checkout: "Checkout", contactDetails: "Your details", fullName: "Full name", mobile: "Mobile number", email: "Email (optional)", deliveryAddress: "Delivery address",
    division: "Division", district: "District", upazila: "Upazila / Thana", area: "House, road, area", areaHint: "e.g. House 12, Road 3, Section 10", quickArea: "Search by postcode or area name", noAreaMatch: "No match", choose: "Choose",
    payment: "Payment", cod: "Cash on Delivery", codSub: "Pay when it arrives", card: "Card (Visa/Mastercard)", cardSub: "On the secure SSLCommerz page", mfsSend: "Send Money ৳{total} to our {method} ({type}) number: {number}", trxId: "Transaction ID (TrxID)", payOnPage: "You'll pay on the {method} page next",
    orderNote: "Delivery instructions (optional)", giftMessage: "Gift message (optional)", placeOrder: "Place order", placing: "Placing order…",
    verifyPhone: "Verify your mobile", sendCode: "Send code", resend: "Resend", enterCode: "6-digit code", verify: "Verify", verified: "Verified ✓", verifyWhy: "We verify numbers before Cash on Delivery to stop fake orders.", skipOtp: "No SMS? We'll call you to confirm instead.",
    orderSummary: "Order summary", secureCheckout: "Your details are safe. We never see card numbers.", registryShipNote: "",
    thankYou: "Thank you! We've got your order", orderNumber: "Order number", invoice: "Invoice", downloadInvoice: "Download invoice (PDF)", invoiceIsWarranty: "Your invoice is your warranty card — keep it.", weWillCall: "We'll call you shortly to confirm your order.", confirmedAuto: "Your order is confirmed!",
    orderStatus: "Order status", trackOrder: "Track your order", trackSub: "Enter your order number and mobile number", find: "Find", courier: "Courier", trackingId: "Tracking ID", trackWithCourier: "Track on courier site",
    requestReturn: "Request a return", returnReason: "Reason", reason_damaged: "Arrived damaged", reason_wrong_item: "Wrong item sent", reason_not_working: "Doesn't turn on / doesn't work", reason_not_as_described: "Not as described", reason_changed_mind: "Changed my mind", reason_other: "Other", details: "Details", send: "Send",
    rateProduct: "Your rating", yourReview: "Your experience", yourName: "Your name", reviewThanks: "Thank you! Your review will appear after a quick check.", verifiedPurchase: "Verified purchase",
    signIn: "Sign in", register: "Create account", password: "Password", forgotPassword: "Forgot password?", signOut: "Sign out", newHere: "New here? Create an account", haveAccount: "Have an account? Sign in", resetPassword: "Reset password", newPassword: "New password", code: "Code",
    myOrders: "My orders", addresses: "Addresses", returns: "Returns", referral: "Refer a friend", profile: "Profile", save: "Save", saved: "Saved", cancel: "Cancel", delete: "Delete", edit: "Edit", addNew: "Add new",
    noOrders: "No orders yet.", label: "Label", recipient: "Recipient name", makeDefault: "Default address", defaultTag: "Default",
    copy: "Copy", copied: "Copied",
    referralHeadline: "Give a friend ৳{friend} off, get ৳{reward}", referralSub: "When your friend's first order (৳{min}+) is delivered, your reward code arrives by SMS.", yourCode: "Your code", uses: "Uses", rewards: "Rewards",
    budget: "Budget (৳)",
    notFound: "Page not found", backHome: "Back to home", somethingWrong: "Something went wrong. Please try again.", loading: "Loading…", retry: "Try again",
    status_pending: "Pending", status_confirmation_attempted: "Awaiting confirmation", status_confirmed: "Confirmed", status_packed: "Packed", status_shipped: "Shipped", status_delivered: "Delivered", status_cancelled: "Cancelled", status_refused: "Returned to us", status_returned: "Returned",
    pay_pending: "Due", pay_paid: "Paid", pay_failed: "Failed", pay_refunded: "Refunded", pay_partially_refunded: "Partly refunded",
    installApp: "Use it like an app", enableUpdates: "Get order updates as notifications",
    next: "Next", back: "Back",
    myRoutine: "Buy again", myRoutineSub: "Products you've bought before — lost a cable or cracked a case? Reorder in one tap.", noRoutine: "After you shop, your products will appear here so you can reorder easily.", lastOrdered: "Last ordered {d}", reorder: "Order again", timesOrdered: "Bought {n} times",
    // Gadget-specific
    worksWith: "Works with", worksWithDevice: "Works with {d}", devices: "Device", specs: "Specifications", highlights: "Key features", inTheBox: "In the box", howToUse: "Setup / how to use",
    warranty: "Warranty", warrantyMonths: "{n}-month warranty", warrantyYears: "{n}-year warranty", noWarranty: "No warranty", warrantyTerms: "Warranty terms", warrantyFromDelivery: "From the delivery date, against your invoice",
    madeIn: "Origin: {c}", model: "Model",
    compare: "Compare", compareAdd: "Add to compare", compareAdded: "In compare", compareTitle: "Spec comparison", compareSub: "2–3 products side by side — the rows that differ are highlighted.", compareNeed2: "Pick one more product to compare.", compareMax: "You can compare up to 3 products at a time.", compareNow: "Compare ({n})", compareDiff: "Only show differences", compareClear: "Clear all", notListed: "—",
    dealOfDay: "Deal of the Day", dealOfDaySub: "Real end time, real stock — when the timer ends, the price goes back.", dealEnds: "Deal ends in", dealEndsOn: "Deal runs until {d}", dealEnded: "Deal ended", days: "days", hours: "hrs", mins: "min", secs: "sec", allDeals: "All deals", deals: "Deals",
    bundles: "Combo deals", bundle: "Combo", allBundles: "All combos", bundlesSub: "Products that work together, in one package — for less than buying them separately at today's prices.", bundleContains: "What's in this combo", bundleSeparate: "{price} if bought separately", bundleSave: "You save {price} with the combo", inBundles: "Also in these combos", readyBundles: "Ready-made combos",
    finder: "Gadget finder", finderTitle: "Find gear for your device", finderSub: "Tell us which device you use and your budget — we'll pick one in-stock essential from each shelf that works with it.", finderStep1: "Which device do you use?", finderStep2: "Your budget", finderResult: "Your setup", finderTotal: "Total", addAll: "Add all to cart", finderNone: "Nothing suitable within this budget — try a slightly higher one.", retake: "Start again", showSetup: "Show my setup", finderTeaser: "Not sure what works with your phone?",
    guides: "Tech guides", guidesTitle: "Tech guides", guidesSub: "Simple reads before you buy — watts, IP ratings, warranty.", readMore: "Read", byAuthor: "By {a}", productsInPost: "Products in this guide", noPosts: "New guides coming soon.",
    qa: "Questions & answers", askQuestion: "Ask a question", yourQuestion: "Your question", questionThanks: "Thanks! Your question will appear here with our answer.", noQuestions: "No questions yet — ask the first one.", answeredBy: "Answered by {a}", answer: "Answer",
    spotlight: "Explained", shopSpotlight: "Products with {i}", goesWellWith: "Works well with", singleProducts: "Single products", bundleOnly: "Combos only", productType: "Type",
    certificationsTitle: "Our trust badges", certificationsSub: "Only the ones we hold proof for.", ourStory: "Our story", storyTitle: "Smart gear. Honest specs.",
    storyBody: "We publish the full spec sheet of every product, state the warranty in months and print it on your invoice, and never invent stock counts or offer timers. Every unit is powered on before it ships, and warranty claims are matched to the unit's serial number so they're sorted quickly.",
    trustSpecs: "Full spec sheets", trustWarranty: "Real warranty on your invoice", trustStock: "Real stock, real deal timers", trustCod: "Cash on Delivery across Bangladesh",
    // Account: warranty claims
    warrantyClaims: "Warranty", claimNew: "Make a warranty claim", claimPick: "Which item?", claimIssue: "What's wrong?", claimDetails: "Tell us what happens, in a sentence or two", serialNo: "Serial number (on the box or the device label)", serialOnFile: "Serial on our records: {s}", claimSubmit: "Send claim", claimSent: "Claim sent",
    myClaims: "My claims", noClaims: "No claims.", noWarrantyItems: "Items with a warranty will appear here once they're delivered.", warrantyUntil: "Warranty until {d}", warrantyEnded: "Warranty ended {d}", claimOpen: "Claim {c} in progress", claimWhatsCovered: "Covers manufacturing faults; not drops, cracks or water beyond the stated rating.",
    issue_not_charging: "Not charging", issue_no_sound: "No sound / sound on one side", issue_not_turning_on: "Won't turn on", issue_connection: "Won't connect / pair", issue_battery: "Battery drains fast", issue_physical: "Button / body problem", issue_other: "Something else",
    claim_submitted: "Submitted", claim_under_review: "Under review", claim_approved: "Approved", claim_rejected: "Rejected", claim_resolved: "Resolved",
    resolution_repair: "Repaired", resolution_replace: "Replaced", resolution_refund: "Refunded", resolution_none: "—", claimNote: "Our note",
  },
};

const KEY = "gmk_lang";
export function lang() {
  try {
    const q = new URL(location.href).searchParams.get("lang");
    if (q === "en" || q === "bn") return q;
    const v = localStorage.getItem(KEY);
    if (v === "en" || v === "bn") return v;
  } catch { /* storage blocked */ }
  return document.documentElement.getAttribute("data-default-lang") === "en" ? "en" : "bn";
}
export function setLang(l) {
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  document.cookie = `gmk_lang=${l}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = l;
}
export function t(key, vars = {}) {
  const s = STR[lang()][key] ?? STR.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
}
/** Picks the bilingual field: L(product, "name") → product.name_bn / name_en. */
export const L = (obj, field) => (obj ? (lang() === "bn" ? obj[`${field}_bn`] || obj[`${field}_en`] : obj[`${field}_en`] || obj[`${field}_bn`]) ?? "" : "");
/** Picks from {en, bn}. */
export const tt = (o) => (o ? (lang() === "bn" ? o.bn || o.en : o.en || o.bn) : "");

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const digits = (s) => (lang() === "bn" ? String(s).replace(/\d/g, (d) => BN_DIGITS[d]) : String(s));
export const num = (n) => digits(Number(n ?? 0).toLocaleString("en-IN"));
export const money = (n) => `৳${num(n)}`;
export const date = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(lang() === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/** Applies data-i18n / data-i18n-placeholder / data-i18n-label attributes in static HTML. */
export function applyStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder)));
  root.querySelectorAll("[data-i18n-label]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nLabel)));
}
