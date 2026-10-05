import type { MathMeta } from './types/MathDocument';
import type { StrokeElement } from './types/ink';

/**
 * Types and Mock Data for exup Platform
 */

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  optionExplanations?: string[];
  followup?: Question;
  broadTopic: string;
  notesSnippet: string;
  illustration?: string;
  requiresDrawing?: boolean;
  section?: string;
  pageNumber?: number;
  questionNumber?: number;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  board: string;
  year: number;
  durationMinutes: number;
  questions: Question[];
  rulesAndGuidelines?: string;
}

export interface Student {
  id: string;
  name: string;
  school: string;
  streak: number;
  score: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'voice' | 'video' | 'file' | 'math' | 'math_canvas';
  createdAt: string;
  status?: 'pending' | 'sent' | 'delivered' | 'read';
  attachments?: Attachment[];
  mathMeta?: MathMeta;
  strokes?: StrokeElement[];
}

export interface Conversation {
  id: string;
  name?: string;
  isGroup: boolean;
  createdAt: string;
  lastMessage?: Message;
  participants?: Participant[];
}

export interface Participant {
  conversationId: string;
  userId: string;
  lastReadAt: string;
  user_name?: string;
  user_avatar?: string;
}

export interface MessageStatus {
  messageId: string;
  recipientId: string;
  status: number; // 1: Delivered, 2: Read
  updatedAt: string;
}

export interface Attachment {
  id: string;
  messageId: string;
  fileId: string; // Appwrite File ID
  fileType: string; // MIME type
  duration?: number; // Voice Only
  waveform?: number[]; // Voice Only
  localPath?: string; // For optimistic UI / local preview
}

export interface Textbook {
  id: string;
  title: string;
  author: string;
  publisher: string;
  price: number; // 0 for free
  coverIcon: string;
  sharesLeft?: number;
}

export const MOCK_TEXTBOOKS: Textbook[] = [
  { id: 'b1', title: 'Modern Biology', author: 'Dr. Kaguma', publisher: 'MK Publishers', price: 0, coverIcon: '🧬' },
  { id: 'b2', title: 'Advanced Physics', author: 'Prof. Batuma', publisher: 'Fontana Books', price: 15000, coverIcon: '⚡' },
  { id: 'b3', title: 'Chemistry Simplified', author: 'James O.', publisher: 'Lone Star', price: 12000, coverIcon: '🧪', sharesLeft: 3 },
  { id: 'b4', title: 'Mathematics for S4', author: 'Sarah K.', publisher: 'exup Press', price: 0, coverIcon: '📐' },
  { id: 'b5', title: 'History of East Africa', author: 'M. Kiwanuka', publisher: 'Longhorn', price: 8000, coverIcon: '🌍' },
  { id: 'b6', title: 'Literature in English', author: 'Jane N.', publisher: 'Fountain Publishers', price: 9500, coverIcon: '📚' },
  { id: 'b7', title: 'Agriculture Practical Guide', author: 'Daniel O.', publisher: 'MK Publishers', price: 0, coverIcon: '🌱' },
  { id: 'b8', title: 'Computer Studies', author: 'Tech Hub', publisher: 'exup Press', price: 10000, coverIcon: '💻' }
];

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  topics: number;
}

export const SUBJECT_CATALOGUE: Subject[] = [
  { id: 'bio', name: 'Biology', icon: '🧬', color: 'bg-olive/10 text-olive', topics: 12 },
  { id: 'phys', name: 'Physics', icon: '⚡', color: 'bg-accent/10 text-accent', topics: 8 },
  { id: 'chem', name: 'Chemistry', icon: '🧪', color: 'bg-sage/10 text-sage', topics: 15 },
  { id: 'math', name: 'Mathematics', icon: '📐', color: 'bg-blue-500/10 text-blue-500', topics: 20 },
  { id: 'hist', name: 'History', icon: '📜', color: 'bg-orange-500/10 text-orange-500', topics: 10 },
  { id: 'geog', name: 'Geography', icon: '🌍', color: 'bg-emerald-500/10 text-emerald-500', topics: 14 },
];

export interface SubjectLeader {
  subject: string;
  name: string;
  points: number;
}

export const MOCK_SUBJECT_LEADERS: SubjectLeader[] = [
  { subject: "Biology", name: "Sarah K.", points: 3450 },
  { subject: "Physics", name: "Moses B.", points: 2800 },
  { subject: "Chemistry", name: "James O.", points: 2550 }
];

export interface FeedPost {
  id: string;
  authorName: string;
  school: string;
  content: string;
  likes: number;
  replies: number;
  timestamp: string;
}

const q10: Question = {
  id: "q1_followup_10",
  text: "What part of the digestive system is primarily responsible for the absorption of water from indigestible food matter?",
  options: ["Stomach", "Small Intestine", "Large Intestine", "Rectum"],
  correctIndex: 2,
  explanation: "The large intestine absorbs water and forms solid feces.",
  broadTopic: "Enzymes & Digestion",
  notesSnippet: "The colon plays a key role in water reabsorption."
};

const q9: Question = {
  id: "q1_followup_9",
  text: "What enzyme in the stomach begins the digestion of proteins?",
  options: ["Lipase", "Pepsin", "Amylase", "Trypsin"],
  correctIndex: 1,
  explanation: "Pepsin is the chief digestive enzyme in the stomach, which breaks down proteins into polypeptides.",
  followup: q10,
  broadTopic: "Enzymes & Digestion",
  notesSnippet: "Pepsin works best in the highly acidic environment of the stomach."
};

const q8: Question = {
  id: "q1_followup_8",
  text: "Which organ produces bile?",
  options: ["Gallbladder", "Pancreas", "Liver", "Spleen"],
  correctIndex: 2,
  explanation: "Bile is produced by the liver and stored in the gallbladder.",
  followup: q9,
  broadTopic: "Enzymes & Digestion",
  notesSnippet: "Bile is continuously produced by the liver hepatocyte cells."
};

const q7: Question = {
  id: "q1_followup_7",
  text: "What is the function of bile in digestion?",
  options: ["Digest proteins", "Emulsify fats", "Break down starch", "Synthesize vitamins"],
  correctIndex: 1,
  explanation: "Bile emulsifies large fat droplets into smaller ones, increasing their surface area for lipase action.",
  followup: q8,
  broadTopic: "Enzymes & Digestion",
  notesSnippet: "Emulsification is a physical rather than a chemical change."
};

const q6: Question = {
  id: "q1_followup_6",
  text: "Which vessel within the villus absorbs fatty acids and glycerol?",
  options: ["Capillary", "Artery", "Vein", "Lacteal"],
  correctIndex: 3,
  explanation: "The lacteal is a lymphatic capillary that absorbs dietary fats in the villi of the small intestine.",
  followup: q7,
  broadTopic: "Enzymes & Digestion",
  notesSnippet: "Lacteals merge to form larger lymphatic vessels that transport absorbed fats."
};

const q5: Question = {
  id: "q1_followup_5",
  text: "What feature of the small intestine primarily increases its surface area for absorption?",
  options: ["Long length", "High pH", "Presence of villi and microvilli", "Thick muscular walls"],
  correctIndex: 2,
  explanation: "Villi and microvilli dramatically increase the surface area available for nutrient absorption.",
  followup: q6,
  broadTopic: "Enzymes & Digestion",
  notesSnippet: "Microvilli form the a 'brush border' that greatly expands absorptive capacity."
};

const q4: Question = {
  id: "q1_followup_4",
  text: "Where are the products of digestion absorbed into the bloodstream?",
  options: ["Stomach", "Liver", "Small Intestine", "Large Intestine"],
  correctIndex: 2,
  explanation: "The small intestine is the primary site of nutrient absorption into the blood.",
  followup: q5,
  broadTopic: "Enzymes & Digestion",
  notesSnippet: "Nutrients diffuse or are actively transported across the intestinal mucosa."
};

const q3: Question = {
  id: "q1_followup_3",
  text: "Which enzyme breaks down sucrose?",
  options: ["Lactase", "Maltase", "Sucrase", "Amylase"],
  correctIndex: 2,
  explanation: "Sucrase breaks down sucrose into glucose and fructose.",
  followup: q4,
  broadTopic: "Enzymes & Digestion",
  notesSnippet: "Sucrase is an enzyme found in the small intestine."
};

const q2: Question = {
  id: "q1_followup_2",
  text: "Which enzyme is responsible for breaking down lactose?",
  options: ["Lactase", "Maltase", "Sucrase", "Lipase"],
  correctIndex: 0,
  explanation: "Lactase is the enzyme that breaks down lactose into glucose and galactose.",
  followup: q3,
  broadTopic: "Enzymes & Digestion",
  notesSnippet: "Lactase deficiency leads to lactose intolerance."
};

const q1_followup: Question = {
  id: "q1_followup",
  text: "Now that you know how starch is broken down into maltose, what enzyme is responsible for breaking down maltose into glucose molecules?",
  options: ["Lactase", "Maltase", "Sucrase", "Lipase"],
  correctIndex: 1,
  explanation: "Maltase is the enzyme that hydrolyses maltose into two molecules of glucose.",
  optionExplanations: [
    "Incorrect. Lactase breaks down lactose into glucose and galactose.",
    "Correct. Maltase specifically targets the bonds in maltose to yield glucose.",
    "Incorrect. Sucrase breaks down sucrose into glucose and fructose.",
    "Incorrect. Lipase breaks down fats into fatty acids and glycerol."
  ],
  followup: q2,
  broadTopic: "Enzymes & Digestion",
  notesSnippet: "Maltase is located in the microvilli of the small intestine."
};

export const MOCK_EXAM_UCE_BIO: Exam = {
  id: "uce-bio-2023",
  title: "UCE Biology Paper 1",
  subject: "Biology",
  board: "UNEB",
  year: 2023,
  durationMinutes: 150,
  rulesAndGuidelines: "Answer all questions in Section A. Pick the correct option. Do not use correction fluid. Unnecessary alterations will lead to loss of marks.",
  questions: [
    {
      id: "q_2023_1",
      section: "Section A",
      pageNumber: 2,
      questionNumber: 1,
      text: "Which one of the following is a characteristic of all living organisms?",
      options: ["Photosynthesis", "Locomotion", "Respiration", "Phagocytosis"],
      correctIndex: 2,
      explanation: "Respiration is one of the fundamental characteristics of all living organisms (MRS GREN).",
      broadTopic: "Characteristics of Living Things",
      notesSnippet: "All living things respire to release energy.",
    },
    {
      id: "q_2023_2",
      section: "Section A",
      pageNumber: 2,
      questionNumber: 2,
      text: "Which of the following blood vessels contains blood with the lowest concentration of oxygen?",
      options: ["Pulmonary vein", "Aorta", "Renal artery", "Pulmonary artery"],
      correctIndex: 3,
      explanation: "The pulmonary artery carries deoxygenated blood from the heart to the lungs.",
      broadTopic: "Transport in Humans",
      notesSnippet: "The right ventricle pumps deoxygenated blood into the pulmonary artery.",
    },
    {
      id: "q_2023_3",
      section: "Section A",
      pageNumber: 2,
      questionNumber: 3,
      text: "During photosynthesis, the light-dependent stage takes place in the:",
      options: ["Stroma", "Grana", "Cytoplasm", "Mitochondria"],
      correctIndex: 1,
      explanation: "The light-dependent reactions take place in the thylakoid membranes (grana) of the chloroplast.",
      broadTopic: "Photosynthesis",
      notesSnippet: "Chlorophyll is packed into the thylakoid discs which form stacks called grana.",
    },
    {
      id: "q_2023_4",
      section: "Section A",
      pageNumber: 3,
      questionNumber: 4,
      text: "Which hormone is responsible for the rapid conversion of glycogen to glucose in emergencies?",
      options: ["Insulin", "Adrenaline", "Thyroxine", "Glucagon"],
      correctIndex: 1,
      explanation: "Adrenaline prepares the body for 'fight or flight' by rapidly converting glycogen to glucose.",
      broadTopic: "Coordination in Humans",
      notesSnippet: "Adrenaline is secreted by the adrenal glands during stress or emergencies.",
    },
    {
      id: "q_2023_5",
      section: "Section A",
      pageNumber: 3,
      questionNumber: 5,
      text: "A person with blood group AB can donate blood to a person with blood group:",
      options: ["A only", "B only", "O only", "AB only"],
      correctIndex: 3,
      explanation: "Blood group AB individuals have both A and B antigens, so they can only donate to other AB individuals.",
      broadTopic: "Genetics",
      notesSnippet: "Type AB is the universal recipient but can only donate to type AB.",
    },
    {
      id: "q_2023_6",
      section: "Section B",
      pageNumber: 4,
      questionNumber: 6,
      text: "Which of the following environmental factors mainly drives the transpiration stream?",
      options: ["Soil pH", "Humidity", "Light intensity", "Temperature gradients"],
      correctIndex: 1,
      explanation: "Humidity affects the concentration gradient between the leaf interior and the outside air.",
      broadTopic: "Water in Plants",
      notesSnippet: "Lower humidity increases the rate of evaporation from the stomata.",
    },
    {
      id: "q_2023_7",
      section: "Section B",
      pageNumber: 4,
      questionNumber: 7,
      text: "In a typical food chain, which organism occupies the first trophic level?",
      options: ["Primary consumer", "Producer", "Secondary consumer", "Decomposer"],
      correctIndex: 1,
      explanation: "Producers (autotrophs) are at the base of every food chain.",
      broadTopic: "Ecology",
      notesSnippet: "Energy enters the ecosystem through producers via photosynthesis.",
    },
    {
      id: "q_2023_8",
      section: "Section B",
      pageNumber: 5,
      questionNumber: 8,
      text: "What is the primary function of the myelin sheath in the nervous system?",
      options: ["Provide nutrients to the neurone", "Generate action potentials", "Increase the speed of impulse transmission", "Protect the brain from injury"],
      correctIndex: 2,
      explanation: "The myelin sheath electrically insulates the axon, allowing saltatory conduction which speeds up transmission.",
      broadTopic: "Coordination in Humans",
      notesSnippet: "Myelin is formed by Schwann cells in the peripheral nervous system.",
    }
  ]
};

export const MOCK_EXAM_IGCSE_BIO: Exam = {
  id: "igcse-bio-2024",
  title: "IGCSE Biology Paper 1",
  subject: "Biology",
  board: "CIE",
  year: 2024,
  durationMinutes: 45,
  questions: [
    {
      id: "iq1",
      text: "Which process is defined as the net movement of particles from a region of higher concentration to a region of lower concentration, down a concentration gradient?",
      options: ["Active Transport", "Osmosis", "Diffusion", "Translocation"],
      correctIndex: 2,
      explanation: "Diffusion is a passive process that doesn't require energy and moves particles down a gradient.",
      broadTopic: "Movement in and out of cells",
      notesSnippet: "Diffusion is essential for gas exchange in the lungs and nutrient absorption in the gut.",
    }
  ]
};

export const MOCK_EXAMS: Exam[] = [
  MOCK_EXAM_UCE_BIO,
  MOCK_EXAM_IGCSE_BIO,
  {
    ...MOCK_EXAM_UCE_BIO,
    id: "uce-phys-2023",
    title: "UCE Physics Paper 1",
    subject: "Physics",
    board: "UNEB",
    year: 2023,
    durationMinutes: 90,
  }
];

export const MOCK_FEED: FeedPost[] = [
  {
    id: "p1",
    authorName: "Sarah K.",
    school: "Gayaza High School",
    content: "Has anyone tried the 2024 Biology sample paper? Question 4 on inheritance is quite tricky!",
    likes: 24,
    replies: 5,
    timestamp: "2h ago"
  },
  {
    id: "p2",
    authorName: "Moses B.",
    school: "St. Mary's College Kisubi",
    content: "Quick tip for Physics: Remember the differences between mass and weight for Paper 1 tomorrow!",
    likes: 45,
    replies: 12,
    timestamp: "5h ago"
  }
];

export interface SchoolClass {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string;
  isJoined?: boolean;
  status: 'open' | 'request'; // open means anyone can join instantly, request means requires approval
}

export interface IndependentClass {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string;
  fee: number; // 0 for free
  isJoined?: boolean;
}

export interface School {
  name: string;
  students: number;
  active: number;
  region?: string;
  district?: string;
  classes: SchoolClass[];
}

export const MOCK_SCHOOLS: School[] = [
  { 
    name: "St. Mary's College Kisubi", 
    students: 1240, 
    active: 450,
    region: "Central",
    district: "Wakiso",
    classes: [
      { id: 'c1', name: 'S4 Physics Masterclass', teacherId: 't1', teacherName: 'Mr. Kato', status: 'request' },
      { id: 'c2', name: 'A-Level Chemistry', teacherId: 't2', teacherName: 'Dr. Lubega', status: 'open' }
    ]
  },
  { 
    name: "Gayaza High School", 
    students: 980, 
    active: 320,
    region: "Central",
    district: "Wakiso",
    classes: [
      { id: 'c3', name: 'S3 Biology Connect', teacherId: 't3', teacherName: 'Mrs. Nakazi', status: 'request' }
    ]
  },
  { 
    name: "King's College Budo", 
    students: 1100, 
    active: 400,
    region: "Central",
    district: "Wakiso",
    classes: [
      { id: 'c4', name: 'S6 Math Elite', teacherId: 't4', teacherName: 'Mr. Wasswa', status: 'request' }
    ]
  },
  { 
    name: "Namilyango College", 
    students: 1300, 
    active: 350,
    region: "Central",
    district: "Mukono",
    classes: [
      { id: 'c5', name: 'S5 Literature', teacherId: 't5', teacherName: 'Mr. Okello', status: 'open' }
    ]
  },
  { 
    name: "Mbarara High School", 
    students: 1050, 
    active: 280,
    region: "Western",
    district: "Mbarara",
    classes: [
      { id: 'c6', name: 'S4 Agriculture', teacherId: 't6', teacherName: 'Mr. Atwooki', status: 'request' }
    ]
  }
];

export const MOCK_INDEPENDENT_CLASSES: IndependentClass[] = [
  { id: 'ic1', name: 'UNEB Chemistry Masterclass', teacherId: 't5', teacherName: 'Prof. Batuma', fee: 50000 },
  { id: 'ic2', name: 'General Biology Revision', teacherId: 't6', teacherName: 'Sarah K.', fee: 0 },
  { id: 'ic3', name: 'Advanced Math Tactics', teacherId: 't7', teacherName: 'Dr. Malinga', fee: 25000 }
];
