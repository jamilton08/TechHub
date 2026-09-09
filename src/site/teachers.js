/**
 * Teacher pages. One entry per teacher; slug = the URL (/teachers/<slug>).
 * `classes` will eventually be filled by a Google Classroom sync; until
 * then it's edited here. A class with `syllabus: []` shows "coming soon".
 */

// Department-wide class contract. A teacher can override with their own
// `contract` array; otherwise this is shown.
export const DEFAULT_CONTRACT = [
  { title: 'Respect the room', text: 'People, equipment, and time. Headphones off when someone is talking, hands off other people\'s machines, and leave your station the way you found it.' },
  { title: 'Devices are tools', text: 'School laptops and lab computers are for the work in front of you. Personal phones stay away unless the lesson calls for them.' },
  { title: 'Show up and catch up', text: 'Be here on time. If you miss a day, the work is posted in Google Classroom — check it before you ask, then ask.' },
  { title: 'Your work is your work', text: 'Using references, docs, and AI to learn is fine. Turning in something you can\'t explain is not. Cite what you borrow.' },
  { title: 'Ask early', text: 'Stuck for more than ten minutes? Ask a neighbor, then ask the teacher. Struggling silently is the one thing that never works.' },
  { title: 'How to reach us', text: 'Google Classroom comments and school email. Expect a reply within one school day.' },
];

export const TEACHERS = [
  {
    slug: 'herman-cordero',
    name: 'Herman Cordero',
    role: 'Team lead',
    tone: 'maroon',
    email: '',
    bio: 'Leads the HSCT Technology Department. Ten years as an IT industry specialist before bringing that experience into the classroom.',
    classes: [],
  },
  {
    slug: 'jonathan-cruz',
    name: 'Jonathan Cruz',
    role: 'Deep technical projects · Data',
    tone: 'blue',
    email: '',
    bio: 'Manages the department\'s deep technical projects. Works on motion as input — cameras and wearables as controllers — and is the team\'s data expert. Teaches grades 11–12.',
    classes: [
      {
        id: 'ct-python',
        name: 'Computational Thinking with Python',
        grades: '11–12',
        period: '',
        classroomCode: '',
        description: 'How to break a problem down and make a computer do it. Python from zero to writing real programs.',
        syllabus: [
          { unit: 'Unit 1 — Thinking like a computer', weeks: '1–3', topics: 'Decomposition, patterns, algorithms on paper, first Python programs' },
          { unit: 'Unit 2 — Data and decisions', weeks: '4–7', topics: 'Variables, types, conditionals, loops, debugging' },
          { unit: 'Unit 3 — Functions and files', weeks: '8–11', topics: 'Functions, lists and dictionaries, reading and writing files' },
          { unit: 'Unit 4 — Projects', weeks: '12–18', topics: 'A project of your own, code review, presenting your work' },
        ],
      },
      {
        id: 'problem-solving',
        name: 'Problem Solving — Data Structures in Python',
        grades: '11–12',
        period: '',
        classroomCode: '',
        description: 'The second course: how data is organized and why that decides what a program can do fast.',
        syllabus: [
          { unit: 'Unit 1 — Lists, stacks, queues', weeks: '1–4', topics: 'Big-O intuition, arrays vs. linked lists, stacks and queues in practice' },
          { unit: 'Unit 2 — Dictionaries and sets', weeks: '5–8', topics: 'Hashing, lookups, counting and grouping real data' },
          { unit: 'Unit 3 — Trees and graphs', weeks: '9–13', topics: 'Recursion, trees, BFS/DFS, shortest paths' },
          { unit: 'Unit 4 — Capstone', weeks: '14–18', topics: 'A data-driven project from a real dataset' },
        ],
      },
    ],
  },
  {
    slug: 'julian-ocansey',
    name: 'Julian Ocansey',
    role: 'Software developer',
    tone: 'maroon',
    email: '',
    bio: 'Builds the software side of what the department ships and teaches students to do the same.',
    classes: [],
  },
  {
    slug: 'john-garces',
    name: 'John Garces',
    role: 'Technician',
    tone: 'blue',
    email: '',
    bio: 'Keeps the hardware, networks, and labs running so everything else can.',
    classes: [],
  },
];

export const getTeacher = (slug) => TEACHERS.find((t) => t.slug === slug) || null;
