/**
 * Quiz game question bank (English)
 * 9 categories x 10 questions + mixed mode + seeded daily picker
 */

import { mulberry32, seededShuffle } from '@/lib/daily'

export interface QuizQuestion {
  question: string
  options: string[]
  /** index of the correct option (0-3) */
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
  | 'movies'
  | 'bd'
  | 'math'
  | 'mixed'

export interface QuizCategory {
  id: QuizCategoryId
  name: string
  emoji: string
  /** Tailwind classes — card border/highlight */
  accent: string
  description: string
}

export const QUIZ_CATEGORIES: QuizCategory[] = [
  {
    id: 'gk',
    name: 'General',
    emoji: '🌐',
    accent: 'border-amber-500/60 hover:border-amber-400',
    description: 'World & everyday knowledge',
  },
  {
    id: 'science',
    name: 'Science',
    emoji: '🔬',
    accent: 'border-emerald-500/60 hover:border-emerald-400',
    description: 'Matter, life & the universe',
  },
  {
    id: 'history',
    name: 'History',
    emoji: '🏛️',
    accent: 'border-rose-500/60 hover:border-rose-400',
    description: 'Empires, wars & milestones',
  },
  {
    id: 'geography',
    name: 'Geography',
    emoji: '🌍',
    accent: 'border-teal-500/60 hover:border-teal-400',
    description: 'Earth, rivers & mountains',
  },
  {
    id: 'sports',
    name: 'Sports',
    emoji: '🏏',
    accent: 'border-orange-500/60 hover:border-orange-400',
    description: 'Cricket, football & more',
  },
  {
    id: 'tech',
    name: 'Technology',
    emoji: '💻',
    accent: 'border-violet-500/60 hover:border-violet-400',
    description: 'Computers & the internet',
  },
  {
    id: 'movies',
    name: 'Movies',
    emoji: '🎬',
    accent: 'border-rose-500/60 hover:border-rose-400',
    description: 'Films, superheroes & animation',
  },
  {
    id: 'bd',
    name: 'Bangladesh GK',
    emoji: '🇧🇩',
    accent: 'border-green-500/60 hover:border-green-400',
    description: 'Bangladesh history, culture & places',
  },
  {
    id: 'math',
    name: 'Math Blitz',
    emoji: '➗',
    accent: 'border-cyan-500/60 hover:border-cyan-400',
    description: 'Fast mental math challenges',
  },
  {
    id: 'mixed',
    name: 'Mixed',
    emoji: '🎲',
    accent: 'border-zinc-400/60 hover:border-zinc-200',
    description: 'Everything together',
  },
]

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ---------- General ----------
  { category: 'gk', question: 'What is the capital of Japan?', options: ['Osaka', 'Kyoto', 'Tokyo', 'Seoul'], answer: 2 },
  { category: 'gk', question: 'How many colors are in a rainbow?', options: ['5', '6', '7', '8'], answer: 2 },
  { category: 'gk', question: 'Which is the largest animal on Earth?', options: ['African elephant', 'Blue whale', 'Giraffe', 'Great white shark'], answer: 1 },
  { category: 'gk', question: 'How many minutes are in a full day?', options: ['1200', '1440', '1600', '2400'], answer: 1 },
  { category: 'gk', question: 'What do bees collect from flowers?', options: ['Pollen and nectar', 'Water only', 'Leaves', 'Seeds'], answer: 0 },
  { category: 'gk', question: 'Which language has the most native speakers?', options: ['English', 'Spanish', 'Mandarin Chinese', 'Hindi'], answer: 2 },
  { category: 'gk', question: 'Which metal is liquid at room temperature?', options: ['Mercury', 'Lead', 'Tin', 'Zinc'], answer: 0 },
  { category: 'gk', question: 'How many players are on the field per team in a soccer match?', options: ['9', '10', '11', '12'], answer: 2 },
  { category: 'gk', question: 'Which blood type is known as the universal donor?', options: ['A', 'B', 'AB', 'O negative'], answer: 3 },
  { category: 'gk', question: 'What is the national flower of Bangladesh?', options: ['Rose', 'Water lily (Shapla)', 'Sunflower', 'Lotus'], answer: 1 },

  // ---------- Science ----------
  { category: 'science', question: 'What is the chemical formula of water?', options: ['CO₂', 'H₂O', 'O₂', 'NaCl'], answer: 1 },
  { category: 'science', question: 'Which is the largest organ of the human body?', options: ['Heart', 'Liver', 'Skin', 'Brain'], answer: 2 },
  { category: 'science', question: 'Which planet is called the "Red Planet"?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], answer: 1 },
  { category: 'science', question: 'Plants make food through which process?', options: ['Respiration', 'Photosynthesis', 'Evaporation', 'Pollination'], answer: 1 },
  { category: 'science', question: 'How long does sunlight take to reach Earth?', options: ['8 seconds', '8 minutes', '8 hours', '80 minutes'], answer: 1 },
  { category: 'science', question: 'What is the normal human body temperature?', options: ['36°C', '37°C', '38°C', '39°C'], answer: 1 },
  { category: 'science', question: 'What is the hardest natural material on Earth?', options: ['Iron', 'Graphite', 'Diamond', 'Quartz'], answer: 2 },
  { category: 'science', question: 'At sea level, water boils at what temperature?', options: ['90°C', '100°C', '110°C', '120°C'], answer: 1 },
  { category: 'science', question: 'How many bones are in an adult human body?', options: ['106', '206', '306', '406'], answer: 1 },
  { category: 'science', question: 'What does DNA stand for?', options: ['Deoxyribonucleic acid', 'Dinucleic acid', 'Diribonucleic acid', 'Double nucleic acid'], answer: 0 },

  // ---------- History ----------
  { category: 'history', question: 'The Great Pyramids are located in which country?', options: ['Greece', 'Egypt', 'Iraq', 'Turkey'], answer: 1 },
  { category: 'history', question: 'Who was the first President of the United States?', options: ['Thomas Jefferson', 'George Washington', 'Abraham Lincoln', 'John Adams'], answer: 1 },
  { category: 'history', question: 'The Taj Mahal is located in which country?', options: ['Pakistan', 'India', 'Bangladesh', 'Afghanistan'], answer: 1 },
  { category: 'history', question: 'In which year did World War I begin?', options: ['1912', '1914', '1916', '1918'], answer: 1 },
  { category: 'history', question: 'Who was known as the leader of nonviolent Indian independence?', options: ['Nehru', 'Bose', 'Mahatma Gandhi', 'Patel'], answer: 2 },
  { category: 'history', question: 'In which year did Bangladesh gain independence?', options: ['1947', '1952', '1971', '1974'], answer: 2 },
  { category: 'history', question: 'The Berlin Wall fell in which year?', options: ['1985', '1989', '1991', '1993'], answer: 1 },
  { category: 'history', question: 'Who invented the printing press?', options: ['Leonardo da Vinci', 'Johannes Gutenberg', 'Galileo Galilei', 'Isaac Newton'], answer: 1 },
  { category: 'history', question: 'Which ancient civilization built Machu Picchu?', options: ['Aztec', 'Maya', 'Inca', 'Olmec'], answer: 2 },
  { category: 'history', question: 'The Sixty Dome Mosque (Shat Gambuj) is located in?', options: ['Dhaka', 'Sonargaon', 'Bagerhat', 'Chattogram'], answer: 2 },

  // ---------- Geography ----------
  { category: 'geography', question: 'Which is the largest ocean on Earth?', options: ['Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean', 'Arctic Ocean'], answer: 2 },
  { category: 'geography', question: 'Which is the highest mountain peak in the world?', options: ['K2', 'Kangchenjunga', 'Mount Everest', 'Makalu'], answer: 2 },
  { category: 'geography', question: 'What type of forest is the Sundarbans?', options: ['Deciduous forest', 'Mangrove forest', 'Pine forest', 'Bamboo forest'], answer: 1 },
  { category: 'geography', question: 'Which is the largest desert in the world?', options: ['Gobi', 'Thar', 'Sahara', 'Kalahari'], answer: 2 },
  { category: 'geography', question: 'Which continent is called the "Dark Continent"?', options: ['Asia', 'Africa', 'Australia', 'South America'], answer: 1 },
  { category: 'geography', question: 'What percentage of the Earth\'s surface is water?', options: ['51%', '61%', '71%', '81%'], answer: 2 },
  { category: 'geography', question: 'Which is the largest island in the world?', options: ['Madagascar', 'Borneo', 'Greenland', 'Sumatra'], answer: 2 },
  { category: 'geography', question: 'Which is the longest river in the world?', options: ['Amazon', 'Nile', 'Yangtze', 'Ganges'], answer: 1 },
  { category: 'geography', question: 'Cox\'s Bazar sea beach is famous for being?', options: ['The deepest sea point', 'The longest natural sea beach', 'A coral island', 'A volcano site'], answer: 1 },
  { category: 'geography', question: 'Which country has the most time zones?', options: ['USA', 'Russia', 'China', 'France'], answer: 3 },

  // ---------- Sports ----------
  { category: 'sports', question: 'How many balls are in one over in cricket?', options: ['4', '5', '6', '8'], answer: 2 },
  { category: 'sports', question: 'What is the national sport of Bangladesh?', options: ['Football', 'Cricket', 'Kabaddi', 'Hockey'], answer: 2 },
  { category: 'sports', question: 'How often is the FIFA World Cup held?', options: ['Every 2 years', 'Every 3 years', 'Every 4 years', 'Every 5 years'], answer: 2 },
  { category: 'sports', question: 'Which country hosted the 2022 FIFA World Cup?', options: ['Russia', 'Qatar', 'Brazil', 'France'], answer: 1 },
  { category: 'sports', question: 'Wimbledon is a famous tournament of which sport?', options: ['Golf', 'Cricket', 'Tennis', 'Badminton'], answer: 2 },
  { category: 'sports', question: 'Which boxer was known as "The Greatest"?', options: ['Mike Tyson', 'Muhammad Ali', 'Floyd Mayweather', 'Manny Pacquiao'], answer: 1 },
  { category: 'sports', question: 'How many points win a badminton game (current rules)?', options: ['15', '21', '25', '30'], answer: 1 },
  { category: 'sports', question: 'In which year did Bangladesh get Test cricket status?', options: ['1997', '1999', '2000', '2002'], answer: 2 },
  { category: 'sports', question: 'How many rings are on the Olympic flag?', options: ['4', '5', '6', '7'], answer: 1 },
  { category: 'sports', question: 'Usain Bolt is a legend of which sport?', options: ['Swimming', 'Sprinting', 'Long jump', 'Cycling'], answer: 1 },

  // ---------- Technology ----------
  { category: 'tech', question: 'What is called the "brain" of the computer?', options: ['RAM', 'CPU', 'HDD', 'GPU'], answer: 1 },
  { category: 'tech', question: 'What does WWW stand for?', options: ['World Wide Web', 'World Web Wide', 'Wide World Web', 'Web World Wide'], answer: 0 },
  { category: 'tech', question: 'Android OS is developed by which company?', options: ['Apple', 'Microsoft', 'Google', 'Samsung'], answer: 2 },
  { category: 'tech', question: 'RAM is what type of memory?', options: ['Permanent', 'Temporary (volatile)', 'Magnetic', 'Optical'], answer: 1 },
  { category: 'tech', question: '1 Kilobyte (KB) equals how many bytes?', options: ['100', '512', '1024', '2048'], answer: 2 },
  { category: 'tech', question: 'Which of the following is a search engine?', options: ['Facebook', 'Google', 'WhatsApp', 'Instagram'], answer: 1 },
  { category: 'tech', question: 'HTML is used to create what?', options: ['Desktop software', 'Web pages', 'Game consoles', 'Printer drivers'], answer: 1 },
  { category: 'tech', question: 'What is the short form of Artificial Intelligence?', options: ['AI', 'AR', 'VR', 'ML'], answer: 0 },
  { category: 'tech', question: 'What does "HTTP" stand for?', options: ['HyperText Transfer Protocol', 'High Transfer Text Protocol', 'Hyper Transfer Type Protocol', 'Home Text Transfer Protocol'], answer: 0 },
  { category: 'tech', question: 'Which company created the iPhone?', options: ['Samsung', 'Apple', 'Nokia', 'Sony'], answer: 1 },

  // ---------- Movies ----------
  { category: 'movies', question: 'Which movie features the song "My Heart Will Go On"?', options: ['Titanic', 'Avatar', 'The Lion King', 'Gladiator'], answer: 0 },
  { category: 'movies', question: 'What is the real name of Iron Man in the MCU?', options: ['Steve Rogers', 'Bruce Banner', 'Tony Stark', 'Thor Odinson'], answer: 2 },
  { category: 'movies', question: 'Which animated movie features a clownfish searching for his son?', options: ['Moana', 'Finding Nemo', 'Up', 'Ratatouille'], answer: 1 },
  { category: 'movies', question: 'Who directed the movie "Titanic"?', options: ['Steven Spielberg', 'Christopher Nolan', 'James Cameron', 'Ridley Scott'], answer: 2 },
  { category: 'movies', question: 'In which movie would you hear "May the Force be with you"?', options: ['Star Trek', 'Star Wars', 'Dune', 'The Matrix'], answer: 1 },
  { category: 'movies', question: 'Which movie features a lion cub named Simba?', options: ['Madagascar', 'The Jungle Book', 'The Lion King', 'Zootopia'], answer: 2 },
  { category: 'movies', question: 'What is the highest-grossing film of all time (as of 2024)?', options: ['Avengers: Endgame', 'Avatar', 'Titanic', 'Star Wars: The Force Awakens'], answer: 1 },
  { category: 'movies', question: 'Which superhero protects Gotham City?', options: ['Superman', 'Spider-Man', 'Batman', 'Iron Man'], answer: 2 },
  { category: 'movies', question: 'In "Finding Nemo", what kind of fish is Nemo?', options: ['Angelfish', 'Clownfish', 'Pufferfish', 'Swordfish'], answer: 1 },
  { category: 'movies', question: 'Which movie features the character Jack Sparrow?', options: ['Pirates of the Caribbean', 'Indiana Jones', 'The Mummy', 'King Kong'], answer: 0 },

  // ---------- Bangladesh GK ----------
  { category: 'bd', question: 'What is the capital of Bangladesh?', options: ['Chattogram', 'Dhaka', 'Khulna', 'Sylhet'], answer: 1 },
  { category: 'bd', question: 'Which is the national fruit of Bangladesh?', options: ['Mango', 'Jackfruit', 'Banana', 'Litchi'], answer: 1 },
  { category: 'bd', question: 'Which river is the longest in Bangladesh?', options: ['Padma', 'Meghna', 'Jamuna', 'Karnaphuli'], answer: 1 },
  { category: 'bd', question: 'What is the national animal of Bangladesh?', options: ['Tiger', 'Elephant', 'Deer', 'Peacock'], answer: 0 },
  { category: 'bd', question: 'Which sea is to the south of Bangladesh?', options: ['Arabian Sea', 'Bay of Bengal', 'Indian Ocean', 'Pacific Ocean'], answer: 1 },
  { category: 'bd', question: 'What is the national fish of Bangladesh?', options: ['Rui', 'Ilish (Hilsa)', 'Katla', 'Prawn'], answer: 1 },
  { category: 'bd', question: 'Which city is known as the port city of Bangladesh?', options: ['Dhaka', 'Sylhet', 'Chattogram', 'Rajshahi'], answer: 2 },
  { category: 'bd', question: 'In which year did the Language Movement take place?', options: ['1947', '1952', '1969', '1971'], answer: 1 },
  { category: 'bd', question: 'What is the national tree of Bangladesh?', options: ['Banyan', 'Mango tree', 'Mangrove', 'Palm'], answer: 1 },
  { category: 'bd', question: 'Which is the largest division of Bangladesh by area?', options: ['Dhaka', 'Chattogram', 'Rajshahi', 'Khulna'], answer: 1 },

  // ---------- Math Blitz ----------
  { category: 'math', question: 'What is 15% of 200?', options: ['15', '25', '30', '35'], answer: 2 },
  { category: 'math', question: 'What is 12 × 12?', options: ['124', '132', '144', '156'], answer: 2 },
  { category: 'math', question: 'What is the next number: 2, 4, 8, 16, ...?', options: ['24', '30', '32', '64'], answer: 2 },
  { category: 'math', question: 'What is 100 ÷ 4?', options: ['20', '25', '30', '40'], answer: 1 },
  { category: 'math', question: 'What is the value of π (pi) rounded to 2 decimals?', options: ['3.12', '3.14', '3.16', '3.18'], answer: 1 },
  { category: 'math', question: 'What is 7 + 8 × 2?', options: ['22', '30', '23', '15'], answer: 2 },
  { category: 'math', question: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], answer: 1 },
  { category: 'math', question: 'What is the square root of 144?', options: ['10', '11', '12', '14'], answer: 2 },
  { category: 'math', question: 'If a shirt costs 400 taka with a 25% discount, what do you pay?', options: ['300 taka', '320 taka', '350 taka', '375 taka'], answer: 0 },
  { category: 'math', question: 'What is 2⁵ (2 to the power 5)?', options: ['16', '25', '32', '64'], answer: 2 },
]

/** Pick random questions from a category (options are shuffled too). */
export function pickQuizQuestions(category: QuizCategoryId, count = 10): QuizQuestion[] {
  const pool =
    category === 'mixed' ? QUIZ_QUESTIONS : QUIZ_QUESTIONS.filter((q) => q.category === category)

  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((q) => {
    const paired = q.options.map((opt, i) => ({ opt, correct: i === q.answer }))
    const shuffledOptions = paired.sort(() => Math.random() - 0.5)
    return {
      ...q,
      options: shuffledOptions.map((p) => p.opt),
      answer: shuffledOptions.findIndex((p) => p.correct),
    }
  })
}

/**
 * DAILY CHALLENGE picker — fully deterministic per seed: every player on the
 * same date gets the exact same 10 questions AND option order.
 */
export function pickDailyQuizQuestions(seed: number, count = 10): QuizQuestion[] {
  const rng = mulberry32(seed)
  const pool = seededShuffle(QUIZ_QUESTIONS, rng).slice(0, Math.min(count, QUIZ_QUESTIONS.length))
  return pool.map((q) => {
    const paired = q.options.map((opt, i) => ({ opt, correct: i === q.answer }))
    const shuffledOptions = seededShuffle(paired, rng)
    return {
      ...q,
      options: shuffledOptions.map((p) => p.opt),
      answer: shuffledOptions.findIndex((p) => p.correct),
    }
  })
}
