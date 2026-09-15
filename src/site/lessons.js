/**
 * Lessons. Three levels, same as the nav:
 *   category  → /lessons/<slug>                 (IT Network, IT Support, ...)
 *   topic     → a section on the category page  (#<topic id>)
 *   lesson    → /lessons/<category>/<lesson>    (renders one HTML file)
 *
 * Each lesson is a self-contained HTML file. Put the file in
 * public/lesson-files/<category>/ and set `file` to its name — it is served
 * as-is, exactly like /hsct-logo.png. `file` can also be a full URL to a
 * page hosted elsewhere. A lesson with an empty `file` shows as "coming
 * soon"; a topic with no lessons shows an empty state. Nothing else to
 * wire: the nav, the directory, the cards and the lesson page all read
 * from here.
 *
 * `kind` decides the label and the button verb (see KINDS).
 * `minutes` is a rough time-to-finish shown on the card.
 * `added` (YYYY-MM-DD) orders the "newest" lists.
 * `tags` (optional) are extra words the search should find it by.
 */

export const KINDS = {
  game:    { label: 'Game',    verb: 'Play' },
  lab:     { label: 'Lab',     verb: 'Start the lab' },
  reading: { label: 'Reading', verb: 'Read' },
  quiz:    { label: 'Quiz',    verb: 'Take the quiz' },
};

export const CATEGORIES = [
  {
    slug: 'it-network',
    title: 'IT Network',
    tone: 'blue',
    blurb: 'How data gets from one machine to another — cables, Wi-Fi, addresses, and what to check when it stops.',
    topics: [
      { id: 'how-networks-work', title: 'How networks work', lessons: [] },
      { id: 'cabling-and-wifi', title: 'Cabling & Wi-Fi', lessons: [] },
      { id: 'connection-problems', title: 'Connection problems', lessons: [] },
    ],
  },
  {
    slug: 'it-essentials',
    title: 'IT Essentials',
    tone: 'maroon',
    blurb: 'What is inside the box and how it boots: parts, power, storage, and the operating system on top.',
    topics: [
      { id: 'inside-the-computer', title: 'Inside the computer', lessons: [] },
      { id: 'operating-systems', title: 'Operating systems', lessons: [] },
      { id: 'storage-and-backup', title: 'Storage & backup', lessons: [] },
    ],
  },
  {
    slug: 'it-support',
    title: 'IT Support',
    tone: 'blue',
    blurb: 'The help-desk job: read a ticket, question the user, test a theory, fix the real problem, write it down.',
    topics: [
      {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        lessons: [
          {
            slug: 'it-support-challenge',
            title: 'Help Desk: four broken computers, one shift',
            description: 'You are the new Level 1 technician and four tickets are waiting. Question the user, run diagnostics, watch the monitor, and fix what is actually wrong. Wrong parts cost you; hints cost more.',
            file: 'it-support-challenge.html',
            kind: 'game',
            minutes: 45,
            added: '2026-09-14',
            tags: ['help desk', 'tickets', 'diagnostics', 'POST', 'hardware', 'CompTIA'],
          },
          {
  slug: 'it-support-shift-2',
  title: 'Help Desk, Shift 2: it turns on, but…',
  description: 'Six tickets where every machine boots fine and every user is still stuck: Wi-Fi that is "connected," a printer that is "offline," a blue screen, a computer that crawls, a password that is "wrong," and a dead lab desk. Command prompt, Event Viewer, Task Manager, and a wiring closet.',
  file: 'it-support-shift-2.html',
  kind: 'game',
  minutes: 60,
  added: '2026-09-15',
  tags: ['help desk', 'DNS', 'ipconfig', 'ping', 'nslookup', 'DHCP', 'printer', 'offline', 'blue screen', 'BSOD', 'drivers', 'minidump', 'malware', 'PUP', 'Task Manager', 'keyboard layout', 'password', 'patch panel', 'wired', 'APIPA'],
},
        ],
      },
      { id: 'help-desk-skills', title: 'Help desk skills', lessons: [] },
      { id: 'security-basics', title: 'Security basics', lessons: [] },
    ],
  },
  {
    slug: 'workplace-challenge',
    title: 'Workplace Challenge',
    tone: 'maroon',
    blurb: 'Simulations of the habits that get people hired and kept: showing up, following the rules, owning your work.',
    topics: [
      {
        id: 'rules-of-the-room',
        title: 'Rules of the room',
        lessons: [
          {
            slug: 'room333-survive-the-week',
            title: 'Room 333: survive the week',
            description: 'Five days, eighteen decisions, every one covered by the class rules you signed. Reputation builds slowly and drops fast, and consequences carry forward. Keep your grade and your reputation up.',
            file: 'room333-survive-the-week.html',
            kind: 'game',
            minutes: 20,
            added: '2026-09-14',
            tags: ['class rules', 'attendance', 'reputation', 'citations', 'Mr. Cruz'],
          },
        ],
      },
      { id: 'working-with-a-team', title: 'Working with a team', lessons: [] },
      { id: 'communication', title: 'Communication', lessons: [] },
    ],
  },
  {
    slug: 'career-and-finance',
    title: 'Career & Finance',
    tone: 'blue',
    blurb: 'Tech jobs and the money that comes with them: what the roles are, what they pay, and what to do with a paycheck.',
    topics: [
      { id: 'tech-careers', title: 'Tech careers', lessons: [] },
      { id: 'resumes-and-interviews', title: 'Resumes & interviews', lessons: [] },
      { id: 'money-basics', title: 'Money basics', lessons: [] },
    ],
  },
  {
    slug: 'web-design',
    title: 'Web Design',
    tone: 'maroon',
    blurb: 'Pages that work on every screen: HTML for structure, CSS for layout, and enough JavaScript to make it move.',
    topics: [
      { id: 'html-and-css', title: 'HTML & CSS', lessons: [] },
      { id: 'layout-and-responsive', title: 'Layout & responsive', lessons: [] },
      { id: 'javascript-basics', title: 'JavaScript basics', lessons: [] },
    ],
  },
  {
    slug: 'computer-science',
    title: 'Computer Science',
    tone: 'blue',
    blurb: 'Breaking a problem down until a computer can do it: algorithms, Python, and how data is organized.',
    topics: [
      { id: 'thinking-like-a-computer', title: 'Thinking like a computer', 
        lessons: [
                  {
            slug: 'think-it-then-code-it',
            title: 'Think it, then code it',
            description: 'Five real situations — a bake sale count, locker labels, messy name badges, letter grades, a password checker. For each one you first write how you would handle it as a person, then write it in Python in the built-in editor and pass the tests. Variables, loops, strings, if/else.',
            file: 'think-it-then-code-it.html',
            kind: 'lab',
            minutes: 60,
            added: '2026-09-15',
            tags: ['Python', 'variables', 'loops', 'for', 'while', 'strings', 'if', 'else', 'input', 'print', 'range', 'split', 'logic', 'algorithm', 'editor', 'beginner'],
          },
      ] },
      { id: 'python', title: 'Python', lessons: [] },
      { id: 'data-structures', title: 'Data structures', lessons: [] },
    ],
  },
];

/* ── helpers ──────────────────────────────────────────────────────── */

export const getCategory = (slug) => CATEGORIES.find((c) => c.slug === slug) || null;

/** The URL the iframe loads. A bare file name lives under /lesson-files/<category>/. */
export const lessonSrc = (category, lesson) => {
  if (!lesson.file) return '';
  if (/^(https?:)?\/\//.test(lesson.file) || lesson.file.startsWith('/')) return lesson.file;
  return `/lesson-files/${category.slug}/${lesson.file}`;
};

export const lessonHref = (category, lesson) => `/lessons/${category.slug}/${lesson.slug}`;

/** Every lesson, flattened, with its category and topic attached. */
export const allLessons = () =>
  CATEGORIES.flatMap((category) =>
    category.topics.flatMap((topic) => topic.lessons.map((lesson) => ({ category, topic, lesson })))
  );

export const countLessons = (category) => category.topics.reduce((n, t) => n + t.lessons.filter((l) => l.file).length, 0);

/** Newest lessons first (only ones with a file). */
export const newestLessons = (n = 4) =>
  allLessons()
    .filter(({ lesson }) => lesson.file)
    .sort((a, b) => (b.lesson.added || '').localeCompare(a.lesson.added || ''))
    .slice(0, n);

/** Find one lesson by category + lesson slug; also returns its neighbors in the topic. */
export const findLesson = (categorySlug, lessonSlug) => {
  const category = getCategory(categorySlug);
  if (!category) return null;
  for (const topic of category.topics) {
    const i = topic.lessons.findIndex((l) => l.slug === lessonSlug);
    if (i >= 0) {
      return { category, topic, lesson: topic.lessons[i], prev: topic.lessons[i - 1] || null, next: topic.lessons[i + 1] || null };
    }
  }
  return null;
};
