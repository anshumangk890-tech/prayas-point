const en = {
  home: "Home", courses: "My Courses", downloads: "Downloads", chat: "Chat", more: "More",
  library: "My Library", dailyQuiz: "Daily Quiz", mockTest: "Mock Test", syllabus: "Syllabus", progress: "My Progress",
  papers: "Previous Papers", quizzes: "Practice Quizzes", tests: "Mock Tests", bookmarks: "Saved Items", alerts: "Job Alerts",
  paidCourses: "Paid Courses", youtubeCourses: "YouTube Courses", testSeries: "Test Series", books: "Books", shorts: "Shorts", jobAlerts: "Job Alerts",
  notifications: "Notifications", settings: "Settings", profile: "My Profile", purchases: "Purchases", support: "Help & Support", privacy: "Privacy Policy", terms: "Terms & Conditions",
  logout: "Logout", share: "Share App", rate: "Rate App", exams: "Govt. Exams", selectCategory: "Select Category", searchHere: "Search here",
  yourGoal: "Your Goal", comingSoon: "Coming Soon", contentSoon: "Content coming soon", startLearning: "Start learning", explore: "Explore", viewAll: "View all",
  todayPlan: "Today's Study Plan", continueLearning: "Continue Learning", subjectProgress: "Subject-wise Progress", recentTests: "Recently Attempted Tests", savedQuestions: "Saved Questions", examUpdates: "Important Exam Updates",
  completeTopic: "Mark complete", completed: "Completed", save: "Save", saved: "Saved", startTest: "Start test", retry: "Try again", submit: "Submit test",
  next: "Next", previous: "Previous", clear: "Clear response", review: "Mark for review", results: "Results", questions: "Questions",
  back: "Back", edit: "Edit", delete: "Delete", cancel: "Cancel", search: "Search", all: "All", active: "Active",
  signIn: "Sign in", sendOtp: "Send OTP", verifyOtp: "Verify OTP", resendOtp: "Resend OTP", demo: "Explore demo", register: "Complete registration",
  name: "Full name", email: "Email address", state: "Select your state", goal: "Select your exam goal", mobile: "Mobile number",
  noAds: "No ads. Just learning.", studentSpace: "Your learning space", officialNote: "Always verify recruitment updates on the official RRB website.",
} as const;
const hi: Record<keyof typeof en, string> = {
  home: "होम", courses: "मेरे कोर्स", downloads: "डाउनलोड", chat: "चैट", more: "और",
  library: "मेरी लाइब्रेरी", dailyQuiz: "डेली क्विज़", mockTest: "मॉक टेस्ट", syllabus: "पाठ्यक्रम", progress: "मेरी प्रगति",
  papers: "पिछले प्रश्न पत्र", quizzes: "अभ्यास क्विज़", tests: "मॉक टेस्ट", bookmarks: "सहेजी गई सामग्री", alerts: "नौकरी सूचना",
  paidCourses: "पेड कोर्स", youtubeCourses: "YouTube कोर्स", testSeries: "टेस्ट सीरीज़", books: "किताबें", shorts: "शॉर्ट्स", jobAlerts: "नौकरी सूचना",
  notifications: "सूचनाएँ", settings: "सेटिंग्स", profile: "मेरी प्रोफ़ाइल", purchases: "खरीदारी", support: "सहायता", privacy: "गोपनीयता नीति", terms: "नियम और शर्तें",
  logout: "लॉग आउट", share: "ऐप शेयर करें", rate: "ऐप को रेट करें", exams: "सरकारी परीक्षाएँ", selectCategory: "श्रेणी चुनें", searchHere: "यहाँ खोजें",
  yourGoal: "आपका लक्ष्य", comingSoon: "जल्द आ रहा है", contentSoon: "सामग्री जल्द उपलब्ध होगी", startLearning: "पढ़ाई शुरू करें", explore: "देखें", viewAll: "सभी देखें",
  todayPlan: "आज की पढ़ाई", continueLearning: "पढ़ाई जारी रखें", subjectProgress: "विषयवार प्रगति", recentTests: "हाल के टेस्ट", savedQuestions: "सहेजे गए प्रश्न", examUpdates: "महत्वपूर्ण परीक्षा अपडेट",
  completeTopic: "पूरा हुआ चिह्नित करें", completed: "पूरा हुआ", save: "सहेजें", saved: "सहेजा गया", startTest: "टेस्ट शुरू करें", retry: "फिर कोशिश करें", submit: "टेस्ट जमा करें",
  next: "आगे", previous: "पीछे", clear: "उत्तर हटाएँ", review: "समीक्षा के लिए", results: "परिणाम", questions: "प्रश्न",
  back: "वापस", edit: "बदलें", delete: "हटाएँ", cancel: "रद्द करें", search: "खोजें", all: "सभी", active: "सक्रिय",
  signIn: "साइन इन", sendOtp: "OTP भेजें", verifyOtp: "OTP जाँचें", resendOtp: "OTP फिर भेजें", demo: "डेमो देखें", register: "रजिस्ट्रेशन पूरा करें",
  name: "पूरा नाम", email: "ईमेल पता", state: "अपना राज्य चुनें", goal: "परीक्षा का लक्ष्य चुनें", mobile: "मोबाइल नंबर",
  noAds: "बिना विज्ञापन, सिर्फ पढ़ाई।", studentSpace: "आपकी पढ़ाई की जगह", officialNote: "भर्ती की जानकारी हमेशा आधिकारिक RRB वेबसाइट पर जाँचें।",
};
export type TranslationKey = keyof typeof en;
export function translate(language: string, key: TranslationKey) { return language === "hi" ? hi[key] : en[key]; }
