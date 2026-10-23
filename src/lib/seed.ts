import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, banners, documents, examCategories, notifications, questions, quizzes, subjects, topics } from "@/db/schema";
import { APP_NAME, APP_SUBTITLE_HI, LEGACY_APP_NAME } from "@/lib/branding";

const examRows = [
  { id: "railway-group-d", name: "Railway Group D", groupName: "Railway Exams", description: "Your active preparation space", isActive: true, sortOrder: 1 },
  { id: "railway-ntpc", name: "Railway NTPC", groupName: "Railway Exams", description: "Coming soon", isActive: false, sortOrder: 2 },
  { id: "railway-alp", name: "Railway ALP", groupName: "Railway Exams", description: "Coming soon", isActive: false, sortOrder: 3 },
  { id: "ssc-mts", name: "SSC MTS", groupName: "SSC Exams", description: "Coming soon", isActive: false, sortOrder: 4 },
  { id: "ssc-chsl", name: "SSC CHSL", groupName: "SSC Exams", description: "Coming soon", isActive: false, sortOrder: 5 },
  { id: "ssc-cgl", name: "SSC CGL", groupName: "SSC Exams", description: "Coming soon", isActive: false, sortOrder: 6 },
  { id: "ibps-clerk", name: "IBPS Clerk", groupName: "Banking Exams", description: "Coming soon", isActive: false, sortOrder: 7 },
  { id: "ibps-po", name: "IBPS PO", groupName: "Banking Exams", description: "Coming soon", isActive: false, sortOrder: 8 },
  { id: "up-police", name: "UP Police", groupName: "Uttar Pradesh Exams", description: "Coming soon", isActive: false, sortOrder: 9 },
  { id: "up-si", name: "UP SI", groupName: "Uttar Pradesh Exams", description: "Coming soon", isActive: false, sortOrder: 10 },
  { id: "up-lekhpal", name: "UP Lekhpal", groupName: "Uttar Pradesh Exams", description: "Coming soon", isActive: false, sortOrder: 11 },
  { id: "other-exams", name: "Other exams", groupName: "Other Government Exams", description: "Coming soon", isActive: false, sortOrder: 12 },
];

const subjectRows = [
  { id: "maths", examId: "railway-group-d", name: "Mathematics", nameHi: "गणित", sortOrder: 1, isActive: true },
  { id: "reasoning", examId: "railway-group-d", name: "General Intelligence & Reasoning", nameHi: "तर्कशक्ति", sortOrder: 2, isActive: true },
  { id: "science", examId: "railway-group-d", name: "General Science", nameHi: "सामान्य विज्ञान", sortOrder: 3, isActive: true },
  { id: "awareness", examId: "railway-group-d", name: "General Awareness & Current Affairs", nameHi: "सामान्य जागरूकता", sortOrder: 4, isActive: true },
];

const topicRows = [
  ["number-system", "maths", "Number System", "संख्या पद्धति"], ["simplification", "maths", "Simplification", "सरलीकरण"],
  ["percentages", "maths", "Percentages", "प्रतिशत"], ["ratio", "maths", "Ratio & Proportion", "अनुपात और समानुपात"],
  ["profit-loss", "maths", "Profit & Loss", "लाभ और हानि"], ["time-work", "maths", "Time & Work", "समय और कार्य"],
  ["series", "reasoning", "Number & Letter Series", "संख्या और अक्षर श्रृंखला"], ["analogies", "reasoning", "Analogies", "समानता"],
  ["coding", "reasoning", "Coding–Decoding", "कूट लेखन"], ["directions", "reasoning", "Direction Sense", "दिशा ज्ञान"],
  ["classification", "reasoning", "Classification", "वर्गीकरण"], ["syllogism", "reasoning", "Syllogism", "न्यायवाक्य"],
  ["physics", "science", "Physics Basics", "भौतिक विज्ञान"], ["chemistry", "science", "Chemistry Basics", "रसायन विज्ञान"],
  ["biology", "science", "Biology Basics", "जीव विज्ञान"], ["electricity", "science", "Electricity", "विद्युत"],
  ["human-body", "science", "Human Body", "मानव शरीर"], ["environment", "science", "Environment", "पर्यावरण"],
  ["indian-history", "awareness", "Indian History", "भारतीय इतिहास"], ["geography", "awareness", "Geography", "भूगोल"],
  ["polity", "awareness", "Indian Polity", "भारतीय राजव्यवस्था"], ["economy", "awareness", "Economy Basics", "अर्थव्यवस्था"],
  ["current-affairs", "awareness", "Current Affairs", "समसामयिक घटनाएँ"], ["sports", "awareness", "Sports & Culture", "खेल और संस्कृति"],
].map(([id, subjectId, name, nameHi], index) => ({ id, subjectId, name, nameHi, description: "Practice and revise this topic at your own pace.", sortOrder: index + 1, isActive: true }));

type SeedQuestion = { id: string; subjectId: string; topicId: string; questionText: string; choices: string[]; correct: string; explanation: string; language?: string };
const practiceQuestions: SeedQuestion[] = [
  { id: "sample-q1", subjectId: "maths", topicId: "percentages", questionText: "What is 25% of 240? / 240 का 25% कितना है?", choices: ["40", "50", "60", "80"], correct: "C", explanation: "25% = 1/4, so 240 ÷ 4 = 60." },
  { id: "sample-q2", subjectId: "maths", topicId: "ratio", questionText: "If the ratio of A to B is 2:3 and A = 18, what is B?", choices: ["21", "24", "27", "30"], correct: "C", explanation: "One part is 18 ÷ 2 = 9. B is 3 × 9 = 27." },
  { id: "sample-q3", subjectId: "maths", topicId: "simplification", questionText: "Solve: 18 + 6 ÷ 3 × 2", choices: ["16", "20", "22", "24"], correct: "C", explanation: "Division and multiplication come before addition: 6 ÷ 3 × 2 = 4; 18 + 4 = 22." },
  { id: "sample-q4", subjectId: "reasoning", topicId: "series", questionText: "Find the next number: 3, 6, 12, 24, ?", choices: ["36", "42", "48", "54"], correct: "C", explanation: "Each number is multiplied by 2. 24 × 2 = 48." },
  { id: "sample-q5", subjectId: "reasoning", topicId: "analogies", questionText: "Book is to Reading as Pen is to _____.", choices: ["Writing", "Drawing", "Paper", "School"], correct: "A", explanation: "A book is used for reading; a pen is used for writing." },
  { id: "sample-q6", subjectId: "reasoning", topicId: "directions", questionText: "A person faces North and turns right. Which direction are they facing?", choices: ["West", "South", "East", "North"], correct: "C", explanation: "A right turn from North points East." },
  { id: "sample-q7", subjectId: "science", topicId: "physics", questionText: "What is the SI unit of force? / बल की SI इकाई क्या है?", choices: ["Joule", "Newton", "Watt", "Pascal"], correct: "B", explanation: "Force is measured in newtons (N)." },
  { id: "sample-q8", subjectId: "science", topicId: "biology", questionText: "Which organ pumps blood through the human body?", choices: ["Lungs", "Brain", "Heart", "Liver"], correct: "C", explanation: "The heart pumps blood through the circulatory system." },
  { id: "sample-q9", subjectId: "science", topicId: "chemistry", questionText: "What is the chemical symbol for water?", choices: ["O₂", "H₂O", "CO₂", "NaCl"], correct: "B", explanation: "A water molecule contains two hydrogen atoms and one oxygen atom: H₂O." },
  { id: "sample-q10", subjectId: "awareness", topicId: "polity", questionText: "How many fundamental duties are listed in the Constitution of India?", choices: ["9", "10", "11", "12"], correct: "C", explanation: "Article 51A currently lists 11 fundamental duties." },
  { id: "sample-q11", subjectId: "awareness", topicId: "geography", questionText: "Which is the largest Indian state by area?", choices: ["Maharashtra", "Rajasthan", "Madhya Pradesh", "Uttar Pradesh"], correct: "B", explanation: "Rajasthan is India's largest state by area." },
  { id: "sample-q12", subjectId: "awareness", topicId: "indian-history", questionText: "In which year did India become a republic?", choices: ["1947", "1949", "1950", "1952"], correct: "C", explanation: "The Constitution came into effect on 26 January 1950." },
];

const noteRows = [
  { id: "note-maths", title: "Mathematics: a simple starting plan", description: "Build a strong foundation, one concept at a time.", subjectId: "maths", body: "Start with the number system and simplification. Practise percentages and ratios with small examples before moving to timed questions.\n\nA useful daily routine: 15 minutes of concepts, 15 minutes of solved examples, and 10 minutes reviewing mistakes.\n\nTip: write down the method you used, not only the final answer. This is an original study note, not an official syllabus document." },
  { id: "note-reasoning", title: "Reasoning: spot the pattern", description: "A beginner-friendly approach to series and analogies.", subjectId: "reasoning", body: "For number series, first look for a constant difference. Then try multiplication, division, alternating terms, or squares.\n\nFor analogies, identify the relationship in the first pair before choosing an answer. Avoid guessing from familiar-looking words.\n\nReview the explanation after each question, including answers you got right by chance." },
  { id: "note-science", title: "General Science: revision checklist", description: "Small, regular revisions work better than cramming.", subjectId: "science", body: "Revise basic Physics, Chemistry and Biology using school-level concepts. Make short notes on units, everyday phenomena, the human body and the environment.\n\nRead a concept, explain it in your own words, then solve a few practice questions. Revisit difficult concepts after two days." },
  { id: "note-awareness", title: "General Awareness: study smart", description: "A practical way to organize static GK and current affairs.", subjectId: "awareness", body: "Separate static topics such as history, geography and polity from time-sensitive current affairs. Keep a dated notebook for news and always verify important exam announcements on the official Railway Recruitment Board website.\n\nThis note is study guidance only and is not an official recruitment notice." },
];

let pending: Promise<void> | undefined;
export function ensureSeed() {
  if (!pending) pending = seedDatabase().catch((error) => { pending = undefined; throw error; });
  return pending;
}

async function seedDatabase() {
  await db.insert(appSettings).values([
    { key: "appName", value: APP_NAME },
    { key: "appSubtitle", value: APP_SUBTITLE_HI },
  ]).onConflictDoNothing();
  const migratedName = await db.update(appSettings).set({ value: APP_NAME, updatedAt: new Date() })
    .where(and(eq(appSettings.key, "appName"), eq(appSettings.value, LEGACY_APP_NAME)))
    .returning({ key: appSettings.key });
  if (migratedName.length) {
    await db.update(appSettings).set({ value: "P", updatedAt: new Date() })
      .where(and(eq(appSettings.key, "logoText"), eq(appSettings.value, "E")));
  }
  const marker = "initialSeedComplete";
  const [seeded] = await db.select({ key: appSettings.key }).from(appSettings).where(eq(appSettings.key, marker)).limit(1);
  if (seeded) return;
  // Existing deployments already contain the starter data. Do not recreate
  // seeded records that an administrator intentionally deleted.
  const [existing] = await db.select({ id: examCategories.id }).from(examCategories).where(eq(examCategories.id, "railway-group-d")).limit(1);
  if (existing) {
    await db.insert(appSettings).values({ key: marker, value: "1" }).onConflictDoNothing();
    return;
  }
  await db.insert(examCategories).values(examRows).onConflictDoNothing();
  await db.insert(subjects).values(subjectRows).onConflictDoNothing();
  await db.insert(topics).values(topicRows).onConflictDoNothing();
  await db.insert(questions).values(practiceQuestions.map((q) => ({
    id: q.id, examId: "railway-group-d", subjectId: q.subjectId, topicId: q.topicId,
    questionText: q.questionText, options: q.choices.map((text, i) => ({ id: "ABCD"[i], text })),
    correctAnswers: [q.correct], explanation: q.explanation, difficulty: "easy", language: "bilingual",
    sourceType: "original-practice", isPublished: true,
  }))).onConflictDoNothing();
  await db.insert(quizzes).values([
    { id: "daily-starter", title: "Daily practice • 6 questions", description: "A quick mixed-subject session to build your routine. Original practice questions.", examId: "railway-group-d", kind: "daily", questionIds: ["sample-q1", "sample-q4", "sample-q7", "sample-q8", "sample-q10", "sample-q11"], durationSeconds: 600, scoringConfig: { correct: 1, incorrect: 0, unanswered: 0 }, isPublished: true },
    { id: "math-starter", title: "Mathematics foundation", description: "A short topic-wise practice set for beginners.", examId: "railway-group-d", kind: "practice", questionIds: ["sample-q1", "sample-q2", "sample-q3"], durationSeconds: 480, scoringConfig: { correct: 1, incorrect: 0, unanswered: 0 }, isPublished: true },
    { id: "mini-mock", title: "Group D starter mini mock", description: "A 12-question practice mock. This is not a full-length or previous-year paper.", examId: "railway-group-d", kind: "mock", questionIds: practiceQuestions.map((q) => q.id), durationSeconds: 900, scoringConfig: { correct: 1, incorrect: -0.33, unanswered: 0 }, isPublished: true },
  ]).onConflictDoNothing();
  await db.insert(documents).values(noteRows.map((note) => ({
    id: note.id, title: note.title, description: note.description, subjectId: note.subjectId,
    examId: "railway-group-d", topicId: null, documentType: "note", body: note.body,
    language: "en", year: null, sourceLabel: "Original study note", downloadAllowed: false, isPublished: true,
  }))).onConflictDoNothing();
  await db.insert(banners).values([
    { id: "group-d-start", title: "Your preparation starts here", subtitle: "Daily practice · Mock tests · Study notes", imageUrl: "/images/railway-study-banner.png", destinationType: "syllabus", destinationId: "", isPublished: true, sortOrder: 1 },
    { id: "daily-small-steps", title: "Small steps. Stronger every day.", subtitle: "Try a short practice quiz today", imageUrl: "", destinationType: "quizzes", destinationId: "", isPublished: true, sortOrder: 2 },
  ]).onConflictDoNothing();
  await db.insert(notifications).values([
    { id: "welcome-guidance", title: "Welcome to your study space", message: "Begin with the syllabus, then try a short original practice quiz. Your progress is saved as you go.", targetAudience: "all", destinationType: "syllabus", destinationId: "", isPublished: true, publishedAt: new Date() },
  ]).onConflictDoNothing();
  await db.insert(appSettings).values([
    { key: "appName", value: APP_NAME },
    { key: "supportEmail", value: "" },
    { key: "storeUrl", value: "" },
    { key: "logoText", value: "P" },
  ]).onConflictDoNothing();
  await db.insert(appSettings).values({ key: marker, value: "1" }).onConflictDoNothing();
}
