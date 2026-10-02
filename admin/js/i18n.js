// Admin copy — plain language for a non-technical team. Bangla default, English toggle.
const dict = {
  en: {
    dashboard: "Dashboard", orders: "Orders", products: "Products", categories: "Categories", customers: "Customers", coupons: "Coupons & discounts",
    inventory: "Inventory & stock", banners: "Banners & logo", reviews: "Reviews", staff: "Staff & roles", reports: "Reports", settings: "Settings",
    zones: "Delivery zones", audit: "Activity log", help: "Help center", catalog: "Catalogue", sales: "Sales", marketing: "Marketing", system: "System",
    collapse: "Collapse menu", search: "Search invoice no, phone, name, SKU…", invoiceNo: "Invoice no", orderNo: "Order no", profile: "Profile settings", signOut: "Sign out", notifications: "Notifications",
    onlineNow: "Online now", onlyYou: "Only you are online.", newOrders: "New orders", lowStock: "Low stock", pendingReviews: "Reviews waiting",
    nothingNew: "Nothing new right now.",
    todayOrders: "Today's orders", todayRevenue: "Today's sales", monthRevenue: "This month's sales", pendingCod: "Waiting for confirmation", lowStockItems: "Low-stock items", newCustomers: "New customers (7 days)",
    vsYesterday: "vs yesterday", vsLastMonth: "vs last month", vsLastWeek: "vs last week", ofVariants: "of {n} variants", codCount: "{n} are Cash on Delivery",
    salesChart: "Monthly sales", recentOrders: "Recent orders", topProducts: "Top sellers (30 days)", viewAll: "View all", orderMix: "Last 30 days by status",
    add: "Add new", edit: "Edit", delete: "Delete", restore: "Restore", deleteForever: "Delete forever", save: "Save", cancel: "Cancel", close: "Close", yes: "Yes", back: "Back",
    saving: "Saving…", confirmDelete: "Move \"{name}\" to Trash? You can restore it later.", confirmPurge: "Delete \"{name}\" forever? This cannot be undone.",
    active: "Active", trash: "Trash", all: "All", searchPlaceholder: "Search…", noItems: "Nothing here yet.", noItemsSub: "Items you add will show up here.",
    loadError: "Couldn't load. Check the internet and try again.", retry: "Try again", prev: "Previous", next: "Next", pageOf: "Page {p} of {n}",
    actions: "Actions", status: "Status", date: "Date", total: "Total", customer: "Customer", phone: "Phone", payment: "Payment", items: "Items", courier: "Courier", tracking: "Tracking ID",
    s_pending: "Pending", s_confirmed: "Confirmed", s_packed: "Packed", s_shipped: "Shipped", s_delivered: "Delivered", s_returned: "Returned", s_cancelled: "Cancelled",
    moveTo: "Move to", markAs: "Mark as", orderDetail: "Order", printInvoice: "Print invoice", printLabel: "Print shipping label", sendAgain: "Send SMS again",
    shipDialog: "Ship this order", chooseCourier: "Courier", bookSteadfast: "Book with Steadfast automatically", orEnterTracking: "Or type the tracking ID from the courier",
    notifyCustomer: "Send SMS to the customer", note: "Note (optional)", refund: "Record a refund", refundAmount: "Refund amount (৳)", refundReason: "Reason",
    markPaid: "Mark as paid", paymentRef: "Payment reference / TrxID", adminNotes: "Staff notes (customer can't see)", history: "History", messages: "Messages sent",
    customerHistory: "This customer: {n} orders, {f} cancelled/returned", deliverTo: "Deliver to", subtotal: "Subtotal", discount: "Discount", deliveryFee: "Delivery",
    bulkSelected: "{n} selected", bulkConfirm: "Confirm selected", bulkPack: "Mark selected packed",
    exportCsv: "Export CSV", importCsv: "Import CSV", importHelp: "One row per size/colour. Required columns: slug, name_en, name_bn, category_slug, price, size, color, stock.", importDone: "{n} products imported.",
    duplicate: "Duplicate", images: "Photos", uploadImage: "Add photo", uploading: "Uploading…", firstIsCover: "The first photo is the cover.",
    variants: "Sizes, colours & stock", addVariant: "Add size/colour", basics: "Basic details", descriptions: "Descriptions", pricing: "Price", seo: "Search engine (SEO)",
    aiWrite: "Write with AI", aiWorking: "Writing…",
    adjustStock: "Adjust stock", setTo: "Set to", addQty: "Add", removeQty: "Remove", reason: "Reason", restock: "New stock arrived", adjustment: "Correction", returnR: "Customer return",
    stockLog: "Stock history", lowOnly: "Low stock", outOnly: "Out of stock",
    dragHint: "Drag ⋮⋮ to reorder. Drop onto another category to make it a sub-category.", saveOrder: "Save order", addSub: "Add sub-category",
    from: "From", to: "To", groupBy: "Group by", byDay: "Day", byMonth: "Month", byCategory: "Category", byProduct: "Product", byPayment: "Payment method", byZone: "Delivery zone",
    salesReport: "Sales", bestCustomers: "Best customers", courierPerf: "Courier performance", orders_: "Orders", revenue: "Revenue", avgOrder: "Average order",
    storeInfo: "Store information", paymentsSettings: "Payment methods", notifSettings: "Customer messages", smsTemplates: "Message templates", seoDefaults: "SEO defaults", integrations: "Connected services",
    connected: "Connected", notConnected: "Not connected", secretsNote: "API keys are kept safely as Cloudflare secrets (ask your developer). They are never shown here.",
    manual: "Manual (customer sends money, types TrxID)", api: "Automatic (API)", number: "Receiving number", accountType: "Account type",
    templatesHelp: "You can use {name}, {order_no}, {invoice_no}, {total}, {courier}, {tracking}, {store}.",
    signInTitle: "Staff sign in", email: "Email", loginId: "Username or email", password: "Password", signIn: "Sign in", signingIn: "Signing in…",
    currentPassword: "Current password", newPassword: "New password (min 10 characters)", roleMatrix: "What each role can do",
    saved: "Saved.", deleted: "Moved to Trash.", restored: "Restored.", forbidden: "You don't have permission for this.",
    helpIntro: "Short guides for everyday tasks. Tap a question to open it.",
    yesNo_1: "Yes", yesNo_0: "No",
  },
  bn: {
    dashboard: "ড্যাশবোর্ড", orders: "অর্ডার", products: "পণ্য", categories: "ক্যাটাগরি", customers: "গ্রাহক", coupons: "কুপন ও ছাড়",
    inventory: "স্টক ও ইনভেন্টরি", banners: "ব্যানার ও লোগো", reviews: "রিভিউ", staff: "স্টাফ ও রোল", reports: "রিপোর্ট", settings: "সেটিংস",
    zones: "ডেলিভারি জোন", audit: "কার্যক্রমের লগ", help: "সাহায্য", catalog: "ক্যাটালগ", sales: "বিক্রি", marketing: "মার্কেটিং", system: "সিস্টেম",
    collapse: "মেনু ছোট করুন", search: "ইনভয়েস নং, মোবাইল, নাম, SKU খুঁজুন…", invoiceNo: "ইনভয়েস নং", orderNo: "অর্ডার নং", profile: "প্রোফাইল সেটিংস", signOut: "সাইন আউট", notifications: "নোটিফিকেশন",
    onlineNow: "এখন অনলাইনে", onlyYou: "শুধু আপনি অনলাইনে আছেন।", newOrders: "নতুন অর্ডার", lowStock: "স্টক কম", pendingReviews: "অপেক্ষমাণ রিভিউ",
    nothingNew: "এই মুহূর্তে নতুন কিছু নেই।",
    todayOrders: "আজকের অর্ডার", todayRevenue: "আজকের বিক্রি", monthRevenue: "এই মাসের বিক্রি", pendingCod: "কনফার্মের অপেক্ষায়", lowStockItems: "স্টক কম এমন আইটেম", newCustomers: "নতুন গ্রাহক (৭ দিন)",
    vsYesterday: "গতকালের তুলনায়", vsLastMonth: "গত মাসের তুলনায়", vsLastWeek: "গত সপ্তাহের তুলনায়", ofVariants: "{n}টি ভ্যারিয়েন্টের মধ্যে", codCount: "{n}টি ক্যাশ অন ডেলিভারি",
    salesChart: "মাসিক বিক্রি", recentOrders: "সাম্প্রতিক অর্ডার", topProducts: "সেরা বিক্রিত (৩০ দিন)", viewAll: "সব দেখুন", orderMix: "গত ৩০ দিনের অবস্থা",
    add: "নতুন যোগ করুন", edit: "সম্পাদনা", delete: "মুছুন", restore: "ফিরিয়ে আনুন", deleteForever: "স্থায়ীভাবে মুছুন", save: "সংরক্ষণ করুন", cancel: "বাতিল", close: "বন্ধ করুন", yes: "হ্যাঁ", back: "ফিরে যান",
    saving: "সংরক্ষণ হচ্ছে…", confirmDelete: "\"{name}\" ট্র্যাশে পাঠাবেন? পরে ফিরিয়ে আনা যাবে।", confirmPurge: "\"{name}\" স্থায়ীভাবে মুছে ফেলবেন? এটি আর ফেরত আনা যাবে না।",
    active: "চালু", trash: "ট্র্যাশ", all: "সব", searchPlaceholder: "খুঁজুন…", noItems: "এখানে এখনো কিছু নেই।", noItemsSub: "যা যোগ করবেন তা এখানে দেখা যাবে।",
    loadError: "লোড হয়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।", retry: "আবার চেষ্টা করুন", prev: "আগের", next: "পরের", pageOf: "পৃষ্ঠা {p} / {n}",
    actions: "কাজ", status: "অবস্থা", date: "তারিখ", total: "মোট", customer: "গ্রাহক", phone: "ফোন", payment: "পেমেন্ট", items: "পণ্য", courier: "কুরিয়ার", tracking: "ট্র্যাকিং আইডি",
    s_pending: "অপেক্ষমাণ", s_confirmed: "কনফার্মড", s_packed: "প্যাকড", s_shipped: "পাঠানো হয়েছে", s_delivered: "ডেলিভারড", s_returned: "ফেরত", s_cancelled: "বাতিল",
    moveTo: "পরের ধাপ", markAs: "চিহ্নিত করুন", orderDetail: "অর্ডার", printInvoice: "ইনভয়েস প্রিন্ট", printLabel: "শিপিং লেবেল প্রিন্ট", sendAgain: "আবার SMS পাঠান",
    shipDialog: "অর্ডারটি পাঠান", chooseCourier: "কুরিয়ার", bookSteadfast: "স্টেডফাস্টে অটোমেটিক বুক করুন", orEnterTracking: "অথবা কুরিয়ারের ট্র্যাকিং আইডি লিখুন",
    notifyCustomer: "গ্রাহককে SMS পাঠান", note: "নোট (ঐচ্ছিক)", refund: "রিফান্ড রেকর্ড করুন", refundAmount: "রিফান্ডের পরিমাণ (৳)", refundReason: "কারণ",
    markPaid: "পেমেন্ট পেয়েছি", paymentRef: "পেমেন্ট রেফারেন্স / TrxID", adminNotes: "স্টাফ নোট (গ্রাহক দেখবেন না)", history: "ইতিহাস", messages: "পাঠানো মেসেজ",
    customerHistory: "এই গ্রাহক: {n}টি অর্ডার, {f}টি বাতিল/ফেরত", deliverTo: "ডেলিভারির ঠিকানা", subtotal: "পণ্যের দাম", discount: "ছাড়", deliveryFee: "ডেলিভারি",
    bulkSelected: "{n}টি নির্বাচিত", bulkConfirm: "নির্বাচিতগুলো কনফার্ম করুন", bulkPack: "নির্বাচিতগুলো প্যাকড করুন",
    exportCsv: "CSV এক্সপোর্ট", importCsv: "CSV ইমপোর্ট", importHelp: "প্রতি সাইজ/রঙের জন্য একটি সারি। আবশ্যক কলাম: slug, name_en, name_bn, category_slug, price, size, color, stock।", importDone: "{n}টি পণ্য ইমপোর্ট হয়েছে।",
    duplicate: "কপি করুন", images: "ছবি", uploadImage: "ছবি যোগ করুন", uploading: "আপলোড হচ্ছে…", firstIsCover: "প্রথম ছবিটি কভার হিসেবে দেখাবে।",
    variants: "সাইজ, রং ও স্টক", addVariant: "সাইজ/রং যোগ করুন", basics: "মূল তথ্য", descriptions: "বিবরণ", pricing: "দাম", seo: "সার্চ ইঞ্জিন (SEO)",
    aiWrite: "AI দিয়ে লিখুন", aiWorking: "লেখা হচ্ছে…",
    adjustStock: "স্টক পরিবর্তন", setTo: "নির্দিষ্ট করুন", addQty: "যোগ", removeQty: "বাদ", reason: "কারণ", restock: "নতুন স্টক এসেছে", adjustment: "সংশোধন", returnR: "গ্রাহক ফেরত",
    stockLog: "স্টকের ইতিহাস", lowOnly: "স্টক কম", outOnly: "স্টক শেষ",
    dragHint: "ক্রম বদলাতে ⋮⋮ টেনে আনুন। অন্য ক্যাটাগরির উপর ছাড়লে সেটির সাব-ক্যাটাগরি হবে।", saveOrder: "ক্রম সংরক্ষণ", addSub: "সাব-ক্যাটাগরি যোগ",
    from: "শুরু", to: "শেষ", groupBy: "ভাগ করুন", byDay: "দিন", byMonth: "মাস", byCategory: "ক্যাটাগরি", byProduct: "পণ্য", byPayment: "পেমেন্ট পদ্ধতি", byZone: "ডেলিভারি জোন",
    salesReport: "বিক্রি", bestCustomers: "সেরা গ্রাহক", courierPerf: "কুরিয়ারের পারফরম্যান্স", orders_: "অর্ডার", revenue: "আয়", avgOrder: "গড় অর্ডার",
    storeInfo: "দোকানের তথ্য", paymentsSettings: "পেমেন্ট পদ্ধতি", notifSettings: "গ্রাহককে মেসেজ", smsTemplates: "মেসেজের টেমপ্লেট", seoDefaults: "SEO", integrations: "সংযুক্ত সার্ভিস",
    connected: "সংযুক্ত", notConnected: "সংযুক্ত নয়", secretsNote: "API কী নিরাপদে Cloudflare secret হিসেবে রাখা হয় (ডেভেলপারকে বলুন)। এখানে কখনো দেখানো হয় না।",
    manual: "ম্যানুয়াল (গ্রাহক টাকা পাঠিয়ে TrxID দেবেন)", api: "অটোমেটিক (API)", number: "টাকা গ্রহণের নম্বর", accountType: "অ্যাকাউন্টের ধরন",
    templatesHelp: "ব্যবহার করতে পারেন: {name}, {order_no}, {invoice_no}, {total}, {courier}, {tracking}, {store}",
    signInTitle: "স্টাফ সাইন ইন", email: "ইমেইল", loginId: "ইউজারনেম বা ইমেইল", password: "পাসওয়ার্ড", signIn: "সাইন ইন", signingIn: "সাইন ইন হচ্ছে…",
    currentPassword: "বর্তমান পাসওয়ার্ড", newPassword: "নতুন পাসওয়ার্ড (কমপক্ষে ১০ অক্ষর)", roleMatrix: "কোন রোল কী করতে পারে",
    saved: "সংরক্ষণ হয়েছে।", deleted: "ট্র্যাশে পাঠানো হয়েছে।", restored: "ফিরিয়ে আনা হয়েছে।", forbidden: "এই কাজের অনুমতি আপনার নেই।",
    helpIntro: "প্রতিদিনের কাজের ছোট গাইড। প্রশ্নে চাপ দিয়ে খুলুন।",
    yesNo_1: "হ্যাঁ", yesNo_0: "না",
  },
};

// ---- Shop additions ----
Object.assign(dict.en, {
  collections: "Collections", abandoned: "Abandoned checkouts", returns: "Returns & refunds", landing: "Campaign pages", referrals: "Referrals",
  s_confirmation_attempted: "Call attempted", s_refused: "Refused at delivery", s_returned: "Returned",
  attention: "Needs your attention today", healthCheck: "What's connected", setupTitle: "Let's set up your shop", setupSub: "Six small steps — each takes a minute.", dismiss: "Hide",
  callsToMake: "Orders waiting for a confirmation call", abandonedToFollow: "Abandoned checkouts to follow up", paymentsToVerify: "Mobile payments to check (TrxID)", returnRequests: "Return requests", backInStock: "Back in stock — people are waiting",
  allClear: "All clear — nothing waiting. 🎉", pendingCodKpi: "Cash still to collect (COD)", activeRegistries: "Combos sold this month", abandonedKpi: "Abandoned checkouts",
  call: "Call", whatsapp: "WhatsApp", noAnswer: "No answer", confirmedCall: "Customer confirmed", declined: "Customer said no",
  logCall: "How did the call go?", confirmGateNo: "Can't confirm yet", dispatchGateNo: "Call before shipping", verifiedNumber: "Number verified by SMS", notVerified: "Number not verified",
  risk: "Risk", riskReason: "Why", courierHistory: "Courier history", recheck: "Check again", flags: "Warnings",
  markContacted: "I contacted them", markRecovered: "Recovered", notInterested: "Not interested", sendRecovery: "Send recovery message", reopen: "Reopen", lastStep: "Got as far as", cart: "Cart",
  step_cart: "Cart", step_contact: "Contact details", step_address: "Address", step_payment: "Payment",
  bulkShip: "Mark selected shipped", bulkConfirmMsg: "You're about to mark {n} orders as {s} — continue?", downloadInvoice: "Invoice PDF",
  certifications: "Trust badges", certHelp: "Tick a badge only if you hold proof — the brand's warranty letter, BTRC approval, distribution letter or QC sheet. Attach this product's own document here, or leave it blank if the business-wide document (Trust badges menu) covers it. Without either, the badge is saved but not shown in the shop.", attachDoc: "Attach document (PDF/photo)", docAttached: "Document attached", docMissing: "Attach the document to enable this badge",
  ageRanges: "Works with", occasions: "Works with", weight: "Option", weightHint: "Capacity, length or the phone model it fits — e.g. 1 m, 20000 mAh, iPhone 15 Pro.", material: "Specs", giftItem: "Featured", sizeChart: "",
  skuAuto: "Leave blank — we'll create it (e.g. GAD-EB-SON-BLK-0007)", notifyWaiting: "Notify {n} waiting", waiting: "waiting",
  approve: "Approve", reject: "Reject", received: "Item received", refunded: "Refund sent", reply: "Reply",
  twoFaTitle: "Two-step sign-in", twoFaSetup: "Protect your account: scan this code with Google Authenticator (or any authenticator app), then type the 6-digit code.", twoFaKey: "Or type this key", code: "6-digit code", confirm: "Confirm",
  phoneLogin: "Sign in with phone (staff)", passwordLogin: "Sign in with password", sendCode: "Send code", otpSent: "Code sent by SMS.",
  runJobs: "Run background jobs now", backupNow: "Back up now", viewShop: "View shop", reset2fa: "Reset 2FA",
  concerns: "Works with (devices)", heroIngredients: "Key features (up to 4)", heroHelp: "The features you call out on the product page, each with one short line (e.g. “Hybrid ANC — cuts bus and fan noise, up to 35 dB”).", howToUse: "Setup / how to use (one step per line)", caution: "Good to know / cautions", pao: "Warranty (months)", origin: "Origin", noClaims: "Write what the spec sheet supports. Never type stock counts, “people viewing”, “offer ends today”, “lifetime warranty”, “100% waterproof” (give the IP rating) or “best in Bangladesh” — copy like that is refused when you save. The shop shows real stock and real deal timers by itself.", volume: "Amount", unit: "Unit",
  batches: "Stock lots", receiveBatch: "Receive stock (lot)", batchNo: "Lot / supplier-invoice number", expiry: "Expiry date (only for dated items)", mfgDate: "Manufactured on", supplier: "Supplier", costPrice: "Cost price (৳)", qtyReceived: "Received", qtyLeft: "Left", daysLeft: "Days left", writeOff: "Write off", writeOffWhy: "Why? (dead on arrival, damaged in transit, display unit…)", expiringSoon: "Expiring soon", expired: "Expired", nextExpiry: "Next expiry", fefoNote: "Orders are packed from the oldest lot first. Gadgets don't expire — leave the expiry empty; only dated items (e.g. batteries sold by date) need one.", expiringBatchesKpi: "Dated lots expiring within {n} days", expiringToSell: "Dated lots expiring soon — sell first",
  spotlightSettings: "Home page tech explainer", expirySettings: "Lot expiry warnings",
  fraudSettings: "Fake-order protection", abandonedSettings: "Abandoned checkouts", automationSettings: "Automatic messages", taxSettings: "VAT on invoices", referralSettings: "Refer-a-friend", trackingSettings: "Ads & tracking", waTemplates: "WhatsApp quick replies",
  specsLabel: "Spec sheet", specsHelp: "One line per spec. Pick a standard name so it lines up in the comparison table (Battery, Bluetooth, Water resistance …) or type your own. Copy values exactly as printed on the box.", specAdd: "Add a spec line", specKey: "Spec", specValue: "Value", inBox: "In the box", inBoxHelp: "Everything inside the retail box, separated by commas.", warrantyMonths: "Warranty (months)", warrantyHelp: "0 = no warranty. Printed on the product page and the invoice; claims are checked against it.", dealUntil: "Deal of the Day ends on", dealHelp: "Optional. Needs a sale price or discount. The home page counts down to the end of this day (Bangladesh time) and the sale price ends automatically.", compatibleHelp: "Tick every device it works with — this drives the “Works with” filter and the gadget finder.", kitItems: "Bundle contents", kitHelp: "Make this product a combo deal: pick the products packed inside it (at least 2). The combo is stocked and packed as one box; the shop shows what's inside and the real saving against buying them separately.", kitAdd: "Add a product to the bundle", notKit: "Not a bundle — an ordinary product.", kit: "Bundle", disclaimerNote: "Every product page shows the warranty terms (Settings → Store information).", aiPreview: "Preview with warranty terms", writeOffsReport: "Write-offs", kitsKpi: "Combos sold (30 days)", posts: "Tech guides", journal: "Tech guides",
  warranty: "Warranty claims", questions: "Product Q&A", serials: "Serial numbers", openClaimsKpi: "Open warranty claims", claimsToReview: "Warranty claims to handle", questionsToAnswer: "Questions to answer", warrantyReport: "Warranty claims by product", logSerials: "Log serial numbers", serialsHelp: "Paste the serials of units already on the shelf, one per line. Logged serials are picked when an order is packed and printed on the invoice.", assignSerials: "Serial numbers for this line", unserialised: "Units without a serial",
});
Object.assign(dict.bn, {
  collections: "সংগ্রহ", abandoned: "অসম্পূর্ণ চেকআউট", returns: "রিটার্ন ও রিফান্ড", landing: "ক্যাম্পেইন পেজ", referrals: "রেফারেল",
  s_confirmation_attempted: "কল করা হয়েছে", s_refused: "ডেলিভারিতে নেননি", s_returned: "ফেরত এসেছে",
  attention: "আজ যা দেখতে হবে", healthCheck: "কী কী যুক্ত আছে", setupTitle: "চলুন দোকান সাজাই", setupSub: "ছয়টি ছোট ধাপ — প্রতিটি এক মিনিট।", dismiss: "লুকান",
  callsToMake: "কনফার্ম কলের অপেক্ষায় অর্ডার", abandonedToFollow: "অসম্পূর্ণ চেকআউট — যোগাযোগ করুন", paymentsToVerify: "মোবাইল পেমেন্ট যাচাই (TrxID)", returnRequests: "রিটার্নের অনুরোধ", backInStock: "স্টকে ফিরেছে — গ্রাহক অপেক্ষায়",
  allClear: "সব ঠিক আছে — কিছু অপেক্ষায় নেই। 🎉", pendingCodKpi: "যে ক্যাশ এখনো আসবে (COD)", activeRegistries: "এই মাসে বিক্রি হওয়া কম্বো", abandonedKpi: "অসম্পূর্ণ চেকআউট",
  call: "কল", whatsapp: "হোয়াটসঅ্যাপ", noAnswer: "ধরেননি", confirmedCall: "গ্রাহক কনফার্ম করেছেন", declined: "গ্রাহক না বলেছেন",
  logCall: "কল কেমন হলো?", confirmGateNo: "এখনো কনফার্ম করা যাবে না", dispatchGateNo: "পাঠানোর আগে কল করুন", verifiedNumber: "SMS এ নম্বর যাচাই হয়েছে", notVerified: "নম্বর যাচাই হয়নি",
  risk: "ঝুঁকি", riskReason: "কেন", courierHistory: "কুরিয়ার রেকর্ড", recheck: "আবার দেখুন", flags: "সতর্কতা",
  markContacted: "যোগাযোগ করেছি", markRecovered: "অর্ডার হয়েছে", notInterested: "আগ্রহী নন", sendRecovery: "রিকভারি মেসেজ পাঠান", reopen: "আবার খুলুন", lastStep: "কোন পর্যন্ত এসেছিলেন", cart: "কার্ট",
  step_cart: "কার্ট", step_contact: "যোগাযোগের তথ্য", step_address: "ঠিকানা", step_payment: "পেমেন্ট",
  bulkShip: "নির্বাচিতগুলো শিপড করুন", bulkConfirmMsg: "{n}টি অর্ডার \"{s}\" করতে যাচ্ছেন — চালিয়ে যাবেন?", downloadInvoice: "ইনভয়েস PDF",
  certifications: "ট্রাস্ট ব্যাজ", certHelp: "প্রমাণ থাকলেই কেবল ব্যাজে টিক দিন — ব্র্যান্ডের ওয়ারেন্টি চিঠি, বিটিআরসি অনুমোদন, পরিবেশন চিঠি বা QC শিট। এই পণ্যের নিজস্ব ডকুমেন্ট এখানে যুক্ত করুন, অথবা পুরো ব্যবসার ডকুমেন্ট (ট্রাস্ট ব্যাজ মেনু) থাকলে খালি রাখুন। কোনোটিই না থাকলে ব্যাজ সংরক্ষণ হবে, কিন্তু দোকানে দেখাবে না।", attachDoc: "ডকুমেন্ট যুক্ত করুন (PDF/ছবি)", docAttached: "ডকুমেন্ট যুক্ত আছে", docMissing: "ব্যাজ চালু করতে ডকুমেন্ট যুক্ত করুন",
  ageRanges: "সাপোর্ট করে", occasions: "সাপোর্ট করে", weight: "অপশন", weightHint: "ক্যাপাসিটি, দৈর্ঘ্য বা কোন ফোন মডেলে লাগে — যেমন ১ মি, ২০০০০ mAh, iPhone 15 Pro।", material: "স্পেক", giftItem: "ফিচার্ড", sizeChart: "",
  skuAuto: "খালি রাখুন — আমরা তৈরি করে দেবো (যেমন GAD-EB-SON-BLK-0007)", notifyWaiting: "{n} জনকে জানান", waiting: "অপেক্ষায়",
  approve: "অনুমোদন", reject: "বাতিল", received: "পণ্য ফেরত পেয়েছি", refunded: "টাকা ফেরত দিয়েছি", reply: "উত্তর",
  twoFaTitle: "দুই-ধাপের সাইন-ইন", twoFaSetup: "অ্যাকাউন্ট সুরক্ষিত করুন: Google Authenticator (বা যেকোনো অথেন্টিকেটর অ্যাপ) দিয়ে কোডটি স্ক্যান করে ৬ সংখ্যার কোড লিখুন।", twoFaKey: "অথবা এই কী লিখুন", code: "৬ সংখ্যার কোড", confirm: "নিশ্চিত করুন",
  phoneLogin: "ফোন দিয়ে সাইন ইন (স্টাফ)", passwordLogin: "পাসওয়ার্ড দিয়ে সাইন ইন", sendCode: "কোড পাঠান", otpSent: "SMS এ কোড পাঠানো হয়েছে।",
  runJobs: "ব্যাকগ্রাউন্ড কাজ এখন চালান", backupNow: "এখনই ব্যাকআপ নিন", viewShop: "দোকান দেখুন", reset2fa: "2FA রিসেট",
  concerns: "সাপোর্ট করে (ডিভাইস)", heroIngredients: "মূল ফিচার (সর্বোচ্চ ৪টি)", heroHelp: "পণ্য পেজে যে ফিচারগুলো আলাদা করে দেখাবেন, প্রতিটির একটি ছোট বাক্য (যেমন “হাইব্রিড ANC — বাস ও ফ্যানের শব্দ কমায়, ৩৫ dB পর্যন্ত”)।", howToUse: "সেটআপ / ব্যবহার (প্রতি লাইনে একটি ধাপ)", caution: "জেনে রাখুন / সতর্কতা", pao: "ওয়ারেন্টি (মাস)", origin: "উৎস", noClaims: "স্পেক শিটে যা আছে তাই লিখুন। স্টকের সংখ্যা, “জন দেখছেন”, “অফার আজই শেষ”, “লাইফটাইম ওয়ারেন্টি”, “১০০% ওয়াটারপ্রুফ” (IP রেটিং দিন) বা “দেশের সবচেয়ে সস্তা” লিখবেন না — এমন লেখা সংরক্ষণ হবে না। আসল স্টক ও আসল ডিলের সময় দোকান নিজেই দেখায়।", volume: "পরিমাণ", unit: "একক",
  batches: "স্টক লট", receiveBatch: "স্টক গ্রহণ (লট)", batchNo: "লট / সাপ্লায়ার-ইনভয়েস নম্বর", expiry: "মেয়াদ (শুধু তারিখযুক্ত পণ্যে)", mfgDate: "উৎপাদনের তারিখ", supplier: "সরবরাহকারী", costPrice: "ক্রয়মূল্য (৳)", qtyReceived: "গ্রহণ", qtyLeft: "বাকি", daysLeft: "দিন বাকি", writeOff: "বাদ দিন", writeOffWhy: "কেন? (পৌঁছেই নষ্ট, পথে ক্ষতিগ্রস্ত, ডিসপ্লে ইউনিট…)", expiringSoon: "শীঘ্রই মেয়াদ শেষ", expired: "মেয়াদ শেষ", nextExpiry: "পরবর্তী মেয়াদ", fefoNote: "সবচেয়ে পুরনো লট থেকে আগে অর্ডার প্যাক হয়। গ্যাজেটের মেয়াদ নেই — মেয়াদ খালি রাখুন; শুধু তারিখযুক্ত পণ্যে (যেমন তারিখসহ ব্যাটারি) দিন।", expiringBatchesKpi: "{n} দিনের মধ্যে মেয়াদ শেষ হবে এমন লট", expiringToSell: "শীঘ্রই মেয়াদ শেষ — আগে বিক্রি করুন",
  spotlightSettings: "হোম পেজের টেক পরিচিতি", expirySettings: "লটের মেয়াদ সতর্কতা",
  fraudSettings: "ভুয়া অর্ডার সুরক্ষা", abandonedSettings: "অসম্পূর্ণ চেকআউট", automationSettings: "স্বয়ংক্রিয় মেসেজ", taxSettings: "ইনভয়েসে ভ্যাট", referralSettings: "বন্ধুকে রেফার", trackingSettings: "বিজ্ঞাপন ও ট্র্যাকিং", waTemplates: "হোয়াটসঅ্যাপ দ্রুত উত্তর",
  specsLabel: "স্পেক শিট", specsHelp: "প্রতি লাইনে একটি স্পেক। তুলনা টেবিলে মিলিয়ে দেখাতে আদর্শ নাম বেছে নিন (ব্যাটারি, ব্লুটুথ, পানি প্রতিরোধ …) অথবা নিজের নাম লিখুন। মান বক্সে যেভাবে লেখা হুবহু তাই দিন।", specAdd: "স্পেক লাইন যোগ করুন", specKey: "স্পেক", specValue: "মান", inBox: "বক্সে যা আছে", inBoxHelp: "রিটেইল বক্সের ভেতরের সব কিছু, কমা দিয়ে আলাদা করে।", warrantyMonths: "ওয়ারেন্টি (মাস)", warrantyHelp: "০ = ওয়ারেন্টি নেই। পণ্যের পাতা ও ইনভয়েসে ছাপা হয়; ক্লেইম এর ভিত্তিতে যাচাই হয়।", dealUntil: "আজকের ডিল শেষ হবে", dealHelp: "ঐচ্ছিক। ছাড়ের দাম বা ডিসকাউন্ট লাগবে। হোম পেজ এই দিনের শেষ পর্যন্ত (বাংলাদেশ সময়) কাউন্টডাউন দেখাবে আর সময় শেষে ছাড়ের দাম নিজেই উঠে যাবে।", compatibleHelp: "যে যে ডিভাইসে চলে সব টিক দিন — এতেই “সাপোর্ট করে” ফিল্টার ও গ্যাজেট ফাইন্ডার চলে।", kitItems: "কম্বোতে যা আছে", kitHelp: "পণ্যটিকে কম্বো ডিল বানাতে ভেতরের পণ্যগুলো বেছে নিন (অন্তত ২টি)। কম্বো একটি বক্স হিসেবে স্টক ও প্যাক হয়; দোকানে ভেতরের পণ্য আর আলাদা কেনার তুলনায় আসল সাশ্রয় দেখাবে।", kitAdd: "কম্বোতে পণ্য যোগ করুন", notKit: "কম্বো নয় — সাধারণ পণ্য।", kit: "কম্বো", disclaimerNote: "প্রতিটি পণ্য পেজে ওয়ারেন্টির শর্ত দেখায় (সেটিংস → দোকানের তথ্য)।", aiPreview: "ওয়ারেন্টির শর্তসহ প্রিভিউ", writeOffsReport: "বাদ দেওয়া স্টক", kitsKpi: "বিক্রি হওয়া কম্বো (৩০ দিন)", posts: "টেক গাইড", journal: "টেক গাইড",
  warranty: "ওয়ারেন্টি ক্লেইম", questions: "পণ্যের প্রশ্নোত্তর", serials: "সিরিয়াল নম্বর", openClaimsKpi: "চলমান ওয়ারেন্টি ক্লেইম", claimsToReview: "যে ওয়ারেন্টি ক্লেইম দেখতে হবে", questionsToAnswer: "উত্তর দিতে হবে এমন প্রশ্ন", warrantyReport: "পণ্য অনুযায়ী ওয়ারেন্টি ক্লেইম", logSerials: "সিরিয়াল নম্বর যোগ করুন", serialsHelp: "শেলফে থাকা ইউনিটের সিরিয়াল পেস্ট করুন, প্রতি লাইনে একটি। অর্ডার প্যাক করার সময় এগুলো বেছে নেওয়া হয় আর ইনভয়েসে ছাপা হয়।", assignSerials: "এই লাইনের সিরিয়াল নম্বর", unserialised: "সিরিয়াল ছাড়া ইউনিট",
});

let current = (() => { try { return localStorage.getItem("gmk_admin_lang") || "bn"; } catch { return "bn"; } })();
export const lang = () => current;
export function setLang(l) {
  current = l === "en" ? "en" : "bn";
  try { localStorage.setItem("gmk_admin_lang", current); } catch { /* ignore */ }
  document.documentElement.lang = current;
}
export function t(key, vars) {
  let s = dict[current][key] ?? dict.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
  return s;
}
/** Bilingual literal: tt({ en: "…", bn: "…" }) */
export const tt = (o) => (o ? o[current] ?? o.en ?? "" : "");
const nf = { bn: new Intl.NumberFormat("bn-BD"), en: new Intl.NumberFormat("en-IN") };
export const num = (n) => nf[current].format(n ?? 0);
export const money = (n) => `৳${num(n)}`;
export const dt = (iso, time = false) =>
  iso ? new Date(iso).toLocaleString(current === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) }) : "—";
