/**
 * কুইজ গেমের বাংলা প্রশ্নব্যাংক
 * ৬টি ক্যাটাগরি × ১০টি প্রশ্ন
 */

export interface QuizQuestion {
  question: string
  options: string[]
  /** options অ্যারের সঠিক উত্তরের ইনডেক্স (০-৩) */
  answer: number
  category: QuizCategoryId
}

export type QuizCategoryId =
  | 'gk'
  | 'science'
  | 'history'
  | 'geography'
  | 'sports'
  | 'tech'
  | 'mixed'

export interface QuizCategory {
  id: QuizCategoryId
  name: string
  emoji: string
  /** Tailwind ক্লাস — কার্ডের বর্ডার/হাইলাইট */
  accent: string
  description: string
}

export const QUIZ_CATEGORIES: QuizCategory[] = [
  {
    id: 'gk',
    name: 'সাধারণ জ্ঞান',
    emoji: '🇧🇩',
    accent: 'border-amber-500/60 hover:border-amber-400',
    description: 'বাংলাদেশ ও দেশ-বিদেশ',
  },
  {
    id: 'science',
    name: 'বিজ্ঞান',
    emoji: '🔬',
    accent: 'border-emerald-500/60 hover:border-emerald-400',
    description: 'পদার্থ, প্রাণ ও মহাবিশ্ব',
  },
  {
    id: 'history',
    name: 'ইতিহাস',
    emoji: '🏛️',
    accent: 'border-rose-500/60 hover:border-rose-400',
    description: 'ঐতিহ্য ও অতীত ঘটনা',
  },
  {
    id: 'geography',
    name: 'ভূগোল',
    emoji: '🌍',
    accent: 'border-teal-500/60 hover:border-teal-400',
    description: 'পৃথিবী, নদী ও পাহাড়',
  },
  {
    id: 'sports',
    name: 'খেলাধুলা',
    emoji: '🏏',
    accent: 'border-orange-500/60 hover:border-orange-400',
    description: 'ক্রিকেট, ফুটবল ও আরও',
  },
  {
    id: 'tech',
    name: 'প্রযুক্তি',
    emoji: '💻',
    accent: 'border-violet-500/60 hover:border-violet-400',
    description: 'কম্পিউটার ও ইন্টারনেট',
  },
  {
    id: 'mixed',
    name: 'মিক্সড',
    emoji: '🎲',
    accent: 'border-zinc-400/60 hover:border-zinc-200',
    description: 'সব ক্যাটাগরি একসাথে',
  },
]

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ---------- সাধারণ জ্ঞান ----------
  { category: 'gk', question: 'বাংলাদেশের রাজধানী কোনটি?', options: ['চট্টগ্রাম', 'ঢাকা', 'খুলনা', 'সিলেট'], answer: 1 },
  { category: 'gk', question: 'বাংলাদেশের জাতীয় ফুল কোনটি?', options: ['গোলাপ', 'জবা', 'শাপলা', 'ডালিয়া'], answer: 2 },
  { category: 'gk', question: 'বাংলাদেশের মহান মুক্তিযুদ্ধ কোন সালে হয়েছিল?', options: ['১৯৫২ সালে', '১৯৬৯ সালে', '১৯৭১ সালে', '১৯৭৪ সালে'], answer: 2 },
  { category: 'gk', question: '"আমার সোনার বাংলা" জাতীয় সংগীতটি কার লেখা?', options: ['কাজী নজরুল ইসলাম', 'রবীন্দ্রনাথ ঠাকুর', 'জসীমউদ্দীন', 'সুকান্ত ভট্টাচার্য'], answer: 1 },
  { category: 'gk', question: 'বাংলাদেশের জাতীয় মাছ কোনটি?', options: ['রুই', 'কাতলা', 'ইলিশ', 'চিতল'], answer: 2 },
  { category: 'gk', question: 'বাংলাদেশে বর্তমানে কয়টি বিভাগ আছে?', options: ['৬টি', '৭টি', '৮টি', '৯টি'], answer: 2 },
  { category: 'gk', question: 'জাতিসংঘের সদস্যপদ বাংলাদেশ পায় কোন সালে?', options: ['১৯৭২ সালে', '১৯৭৩ সালে', '১৯৭৪ সালে', '১৯৭৫ সালে'], answer: 2 },
  { category: 'gk', question: 'বাংলাদেশের প্রথম রাষ্ট্রপতি কে ছিলেন?', options: ['শেখ মুজিবুর রহমান', 'জিয়াউর রহমান', 'মনসুর আলী', 'খন্দকার মোশতাক'], answer: 0 },
  { category: 'gk', question: 'বাংলাদেশের জাতীয় ফল কোনটি?', options: ['আম', 'কাঁঠাল', 'লিচু', 'কলা'], answer: 1 },
  { category: 'gk', question: 'বাংলাদেশের স্বাধীনতা দিবস কোনটি?', options: ['২১ ফেব্রুয়ারি', '১৬ ডিসেম্বর', '২৬ মার্চ', '১৭ মার্চ'], answer: 2 },

  // ---------- বিজ্ঞান ----------
  { category: 'science', question: 'পানির রাসায়নিক সংকেত কী?', options: ['CO₂', 'H₂O', 'O₂', 'NaCl'], answer: 1 },
  { category: 'science', question: 'মানবদেহের বৃহত্তম অঙ্গ কোনটি?', options: ['হৃদয়', 'যকৃত', 'ত্বক', 'মস্তিষ্ক'], answer: 2 },
  { category: 'science', question: 'কোন গ্রহকে "লাল গ্রহ" বলা হয়?', options: ['শুক্র', 'মঙ্গল', 'বৃহস্পতি', 'শনি'], answer: 1 },
  { category: 'science', question: 'উদ্ভিদ কোন প্রক্রিয়ায় খাদ্য তৈরি করে?', options: ['শ্বসন', 'সালোকসংশ্লেষণ', 'বাষ্পীভবন', 'পরাগায়ন'], answer: 1 },
  { category: 'science', question: 'সূর্যের আলো পৃথিবীতে পৌঁছাতে প্রায় কত সময় লাগে?', options: ['৮ সেকেন্ড', '৮ মিনিট', '৮ ঘণ্টা', '৮০ মিনিট'], answer: 1 },
  { category: 'science', question: 'সুস্থ মানবদেহের স্বাভাবিক তাপমাত্রা কত?', options: ['৩৬°C', '৩৭°C', '৩৮°C', '৩৯°C'], answer: 1 },
  { category: 'science', question: 'পৃথিবীর সবচেয়ে শক্ত প্রাকৃতিক পদার্থ কোনটি?', options: ['লোহা', 'গ্রাফাইট', 'হীরা', 'কোয়ার্টজ'], answer: 2 },
  { category: 'science', question: 'সমুদ্রপৃষ্ঠে পানি কত ডিগ্রিতে সিদ্ধ হয়?', options: ['৯০°C', '১০০°C', '১১০°C', '১২০°C'], answer: 1 },
  { category: 'science', question: 'প্রাপ্তবয়স্ক মানবদেহে প্রায় কতটি হাড় থাকে?', options: ['১০৬টি', '২০৬টি', '৩০৬টি', '৪০৬টি'], answer: 1 },
  { category: 'science', question: 'DNA-এর পূর্ণরূপ কী?', options: ['ডিঅক্সিরাইবোনিউক্লিক অ্যাসিড', 'ডাইনিউক্লিক অ্যাসিড', 'ডিরাইবোনিউক্লিক অ্যাসিড', 'ডাবল নিউক্লিক অ্যাসিড'], answer: 0 },

  // ---------- ইতিহাস ----------
  { category: 'history', question: 'পাহাড়পুর বৌদ্ধ বিহার কোন জেলায় অবস্থিত?', options: ['রাজশাহী', 'নওগাঁ', 'দিনাজপুর', 'বগুড়া'], answer: 1 },
  { category: 'history', question: 'ঐতিহাসিক ষাট গম্বুজ মসজিদ কোথায় অবস্থিত?', options: ['ঢাকায়', 'সোনারগাঁয়ে', 'বাগেরহাটে', 'চট্টগ্রামে'], answer: 2 },
  { category: 'history', question: 'লালবাগ কেল্লা কোন শহরে অবস্থিত?', options: ['চট্টগ্রাম', 'ঢাকা', 'রাজশাহী', 'খুলনা'], answer: 1 },
  { category: 'history', question: 'বিখ্যাত পিরামিড কোন দেশে অবস্থিত?', options: ['গ্রিস', 'মিশর', 'ইরাক', 'তুরস্ক'], answer: 1 },
  { category: 'history', question: 'পলাশির যুদ্ধ কোন সালে হয়েছিল?', options: ['১৭৫৭ সালে', '১৭৬৪ সালে', '১৭৫৫ সালে', '১৭৮০ সালে'], answer: 0 },
  { category: 'history', question: 'বাংলার শেষ স্বাধীন নবাব কে ছিলেন?', options: ['আলীবর্দী খান', 'সিরাজউদ্দৌলা', 'মীরজাফর', 'শায়েস্তা খান'], answer: 1 },
  { category: 'history', question: 'তাজমহল কোন দেশে অবস্থিত?', options: ['পাকিস্তান', 'ভারত', 'বাংলাদেশ', 'আফগানিস্তান'], answer: 1 },
  { category: 'history', question: 'বাংলাদেশের বিজয় দিবস কোনটি?', options: ['২৬ মার্চ', '১৬ ডিসেম্বর', '১৪ ডিসেম্বর', '৭ মার্চ'], answer: 1 },
  { category: 'history', question: 'প্রথম বিশ্বযুদ্ধ কোন সালে শুরু হয়েছিল?', options: ['১৯১২ সালে', '১৯১৪ সালে', '১৯১৬ সালে', '১৯১৮ সালে'], answer: 1 },
  { category: 'history', question: 'মহাত্মা গান্ধী কোন দেশের নেতা ছিলেন?', options: ['পাকিস্তান', 'ভারত', 'বাংলাদেশ', 'শ্রীলঙ্কা'], answer: 1 },

  // ---------- ভূগোল ----------
  { category: 'geography', question: 'পৃথিবীর বৃহত্তম মহাসাগর কোনটি?', options: ['আটলান্টিক মহাসাগর', 'ভারত মহাসাগর', 'প্রশান্ত মহাসাগর', 'উত্তর মহাসাগর'], answer: 2 },
  { category: 'geography', question: 'পৃথিবীর সর্বোচ্চ পর্বতশৃঙ্গ কোনটি?', options: ['K2', 'কাঞ্চনজঙ্ঘা', 'মাউন্ট এভারেস্ট', 'মাকালু'], answer: 2 },
  { category: 'geography', question: 'সুন্দরবন কোন ধরনের বন?', options: ['পাতাঝরা বন', 'ম্যানগ্রোভ বন', 'পাইন বন', 'বাঁশবন'], answer: 1 },
  { category: 'geography', question: 'পৃথিবীর বৃহত্তম মরুভূমি কোনটি?', options: ['গবি', 'থার', 'সাহারা', 'কালাহারি'], answer: 2 },
  { category: 'geography', question: 'কোন মহাদেশকে "কালো মহাদেশ" বলা হয়?', options: ['এশিয়া', 'আফ্রিকা', 'অস্ট্রেলিয়া', 'দক্ষিণ আমেরিকা'], answer: 1 },
  { category: 'geography', question: 'বাংলাদেশের বৃহত্তম দ্বীপ কোনটি?', options: ['সেন্ট মার্টিন', 'ভোলা', 'হাতিয়া', 'সন্দ্বীপ'], answer: 1 },
  { category: 'geography', question: 'পৃথিবীপৃষ্ঠের প্রায় কত শতাংশ পানি?', options: ['৫১%', '৬১%', '৭১%', '৮১%'], answer: 2 },
  { category: 'geography', question: 'বাংলাদেশের বৃহত্তম হ্রদ কোনটি?', options: ['চলন বিল', 'কাপ্তাই হ্রদ', 'হাকালুকি হাওর', 'টাঙ্গুয়ার হাওর'], answer: 1 },
  { category: 'geography', question: 'পৃথিবীর বৃহত্তম দ্বীপ কোনটি?', options: ['মাদাগাস্কার', 'বোর্নিও', 'গ্রিনল্যান্ড', 'সুমাত্রা'], answer: 2 },
  { category: 'geography', question: 'কক্সবাজার সমুদ্রসৈকত প্রায় কত দীর্ঘ?', options: ['৬০ কিলোমিটার', '৯০ কিলোমিটার', '১২০ কিলোমিটার', '২০০ কিলোমিটার'], answer: 2 },

  // ---------- খেলাধুলা ----------
  { category: 'sports', question: 'ক্রিকেটে এক ওভারে কত বল করা হয়?', options: ['৪ বল', '৫ বল', '৬ বল', '৮ বল'], answer: 2 },
  { category: 'sports', question: 'বাংলাদেশের জাতীয় খেলা কোনটি?', options: ['ফুটবল', 'ক্রিকেট', 'কাবাডি', 'হকি'], answer: 2 },
  { category: 'sports', question: 'বাংলাদেশ কত সালে টেস্ট স্ট্যাটাস পায়?', options: ['১৯৯৭ সালে', '১৯৯৯ সালে', '২০০০ সালে', '২০০২ সালে'], answer: 2 },
  { category: 'sports', question: 'ফিফা বিশ্বকাপ কত বছর পর পর হয়?', options: ['২ বছর', '৩ বছর', '৪ বছর', '৫ বছর'], answer: 2 },
  { category: 'sports', question: 'ফুটবল ম্যাচে মাঠে একটি দলের কতজন খেলোয়াড় থাকে?', options: ['৯ জন', '১০ জন', '১১ জন', '১২ জন'], answer: 2 },
  { category: 'sports', question: '২০২২ ফিফা বিশ্বকাপ কোন দেশে হয়েছিল?', options: ['রাশিয়া', 'কাতার', 'ব্রাজিল', 'ফ্রান্স'], answer: 1 },
  { category: 'sports', question: 'উইম্বলডন টেনিস টুর্নামেন্ট কোন দেশে হয়?', options: ['আমেরিকা', 'ফ্রান্স', 'ইংল্যান্ড', 'অস্ট্রেলিয়া'], answer: 2 },
  { category: 'sports', question: '"দ্য গ্রেটেস্ট" খ্যাত কিংবদন্তি বক্সার কে?', options: ['মাইক টাইসন', 'মোহাম্মদ আলী', 'ফ্লয়েড মেওয়েদার', 'ম্যানি প্যাকিয়াও'], answer: 1 },
  { category: 'sports', question: 'বাংলাদেশ কোন সালে প্রথম বিশ্বকাপ ক্রিকেট খেলে?', options: ['১৯৯৬ সালে', '১৯৯৯ সালে', '২০০৩ সালে', '২০০৭ সালে'], answer: 1 },
  { category: 'sports', question: 'ব্যাডমিন্টনে বর্তমান নিয়মে এক গেম জেততে কত পয়েন্ট লাগে?', options: ['১৫ পয়েন্ট', '২১ পয়েন্ট', '২৫ পয়েন্ট', '৩০ পয়েন্ট'], answer: 1 },

  // ---------- প্রযুক্তি ----------
  { category: 'tech', question: 'কম্পিউটারের "মস্তিষ্ক" বলা হয় কাকে?', options: ['RAM', 'CPU', 'HDD', 'GPU'], answer: 1 },
  { category: 'tech', question: 'WWW-এর পূর্ণরূপ কী?', options: ['World Wide Web', 'World Web Wide', 'Wide World Web', 'Web World Wide'], answer: 0 },
  { category: 'tech', question: 'Android অপারেটিং সিস্টেম কোন কোম্পানির?', options: ['Apple', 'Microsoft', 'Google', 'Samsung'], answer: 2 },
  { category: 'tech', question: 'RAM কী ধরনের মেমরি?', options: ['স্থায়ী মেমরি', 'অস্থায়ী মেমরি', 'চৌম্বকীয় মেমরি', 'অপটিক্যাল মেমরি'], answer: 1 },
  { category: 'tech', question: '১ কিলোবাইট (KB) = কত বাইট?', options: ['১০০ বাইট', '৫১২ বাইট', '১০২৪ বাইট', '২০৪৮ বাইট'], answer: 2 },
  { category: 'tech', question: 'নিচের কোনটি সার্চ ইঞ্জিন?', options: ['Facebook', 'Google', 'WhatsApp', 'Instagram'], answer: 1 },
  { category: 'tech', question: 'বাংলাদেশের প্রথম যোগাযোগ স্যাটেলাইটের নাম কী?', options: ['বঙ্গবন্ধু-১', 'রূপক্ষা-১', 'বাংলা-১', 'একুশ-১'], answer: 0 },
  { category: 'tech', question: 'HTML কী তৈরিতে ব্যবহৃত হয়?', options: ['ডেস্কটপ সফটওয়্যার', 'ওয়েবপেজ', 'গেম কনসোল', 'প্রিন্টার ড্রাইভার'], answer: 1 },
  { category: 'tech', question: 'কম্পিউটারের ভাইরাস ধরতে কী ব্যবহার করা হয়?', options: ['ইমেইল', 'অ্যান্টিভাইরাস', 'প্রিন্টার', 'স্ক্যানার'], answer: 1 },
  { category: 'tech', question: '"কৃত্রিম বুদ্ধিমত্তা"-এর ইংরেজি সংক্ষেপ কী?', options: ['AI', 'AR', 'VR', 'ML'], answer: 0 },
]

/** একটি ক্যাটাগরি থেকে র‍্যান্ডম ১০টি প্রশ্ন নেওয়া (অপশন শাফলসহ) */
export function pickQuizQuestions(category: QuizCategoryId, count = 10): QuizQuestion[] {
  const pool =
    category === 'mixed'
      ? QUIZ_QUESTIONS
      : QUIZ_QUESTIONS.filter((q) => q.category === category)

  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((q) => {
    // অপশন শাফল + সঠিক উত্তরের ইনডেক্স ট্র্যাক
    const paired = q.options.map((opt, i) => ({ opt, correct: i === q.answer }))
    const shuffledOptions = paired.sort(() => Math.random() - 0.5)
    return {
      ...q,
      options: shuffledOptions.map((p) => p.opt),
      answer: shuffledOptions.findIndex((p) => p.correct),
    }
  })
}
