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
      { id: 'how-networks-work', title: 'How networks work',
         lessons: [
                  {
          slug: 'how-the-internet-works',
          title: 'How the internet works',
          description: 'Six stops with diagrams you can click and run: why every device needs an IP address, why data is cut into packets, how packets are routed hop by hop (and what happens when one is lost), how DNS turns names into numbers, what ports are for, and the whole journey of one click put in order.',
          file: 'how-the-internet-works.html',
          kind: 'lab',
          minutes: 40,
          added: '2026-09-15',
          tags: ['internet', 'IP address', 'IPv4', 'packets', 'routing', 'router', 'DNS', 'ports', 'TCP', 'UDP', 'NAT', 'public', 'private', 'layers', 'traceroute', 'TTL'],
          },
          {
            slug: 'set-up-the-room',
            title: 'Set up the room',
            description: 'Room 216 has a new router, a laptop, a printer, a wall jack and a sticky note with the plan. Plug the cables into the right ports, configure the router through its web page, the laptop through Windows, the printer through its front panel — then prove it works by writing six packets by hand: source, destination, protocol, ports.',
            file: 'set-up-the-room.html',
            kind: 'lab',
            minutes: 45,
            added: '2026-09-16',
            tags: ['IP address', 'subnet', 'subnet mask', 'gateway', 'DHCP', 'static IP', 'router', 'WAN', 'LAN', 'printer', 'ipconfig', 'ICMP', 'ping', 'TCP', 'UDP', 'ports', '9100', 'DNS', '53', 'packets', '169.254'],
          },
          {
            slug: 'pop-quiz-it-network',
            title: 'Pop quiz: addresses, packets, and who’s listening',
            description: 'A 15-minute timed quiz on How the internet works, Set up the room and Packet Run. Six quick checks, four packets written by hand for Room 333, and two broken networks to reason through: a room where someone moved the cables, and a score packet stuck in a routing loop. It submits itself at 0:00.',
            file: 'pop-quiz-it-network.html',
            kind: 'quiz',
            minutes: 15,
            added: '2026-09-25',
            tags: ['quiz', 'pop quiz', 'timed', 'IP address', 'private', 'NAT', 'packets', 'TCP', 'UDP', 'ICMP', 'ports', '53', '9100', 'DNS', 'DHCP', '169.254', 'WAN', 'LAN', 'static IP', 'routing table', 'TTL', 'Wi-Fi', 'switch', 'encryption', 'HTTPS'],
          },
         ] },
      { id: 'cabling-and-wifi', title: 'Cabling & Wi-Fi', lessons: [] },
      { id: 'connection-problems', title: 'Connection problems', lessons: [] },
      {
        id: 'network-security',
        title: 'Network security',
        lessons: [
          {
            slug: 'packet-run',
            title: 'Packet Run: get it there, keep it secret',
            description: 'Build a network with drag-and-drop pieces (laptops, phones, switches, Wi-Fi, routers, the Internet), teach the routers where to send things, then send packets through it while a hacker listens on open Wi-Fi or a wiretapped cable. Wrong address, wrong port, missing route or no lock: the packet gets lost or the hacker reads it. Fix three help-desk tickets, then share your network as a challenge for a classmate. No code.',
            file: 'packet-run.html',
            kind: 'game',
            minutes: 60,
            added: '2026-09-23',
            tags: ['packets', 'header', 'payload', 'IP address', 'DHCP', 'gateway', 'router', 'routing table', 'default route', 'switch', 'Wi-Fi', 'access point', 'TTL', 'ports', '80', '443', 'HTTP', 'HTTPS', 'TLS', 'encryption', 'sniffing', 'wiretap', 'hacker', 'open Wi-Fi', 'security'],
          },
          {
            slug: 'packet-trail',
            title: 'Packet Trail: where is my packet?',
            description: 'The follow-up to Packet Run: follow single packets through five networks, one decision at a time. Which address goes where, which router sends it on, why a packet stuck in a routing loop dies when its TTL runs out, which port the printer refuses, what NAT does to a home address, and exactly what a hacker on airport Wi-Fi — or a fake hotspot — gets to see. 25 questions with a hint and a second try on each, and after every answer you watch the packet take the real trip.',
            file: 'packet-trail.html',
            kind: 'quiz',
            minutes: 40,
            added: '2026-09-28',
            tags: ['packets', 'header', 'payload', 'IP address', 'router', 'routing table', 'default route', 'routing loop', 'TTL', 'lost packets', 'switch', 'Wi-Fi', 'ports', '53', '80', '443', '9100', 'DNS', 'HTTPS', 'encryption', 'hacker', 'airport', 'evil twin', 'hotspot', 'NAT', 'public', 'private', 'Packet Run', 'security'],
          },
          {
            slug: 'seized-drive-forensics',
            title: 'The Seized Drive: a digital forensics case',
            description: 'You caught the hacker — now prove it, the legal way. He stole patient records from the Northside Clinic, and you have his seized laptop and a signed warrant. Keep the chain of custody, prove your forensic copy is perfect with SHA-256 hashes, read the logs, catch the file whose hash gives it away, trace where 48 MB left the network (public or private address? WHOIS), put the events in order, and close the case with a findings report you can download. No hacking back, and the victims’ data is never revealed.',
            file: 'seized-drive-forensics.html',
            kind: 'lab',
            minutes: 50,
            added: '2026-09-30',
            tags: ['forensics', 'digital forensics', 'evidence', 'warrant', 'chain of custody', 'forensic copy', 'write blocker', 'hash', 'SHA-256', 'integrity', 'logs', 'access.log', 'timeline', 'IP address', 'public', 'private', 'WHOIS', '443', 'exfiltration', 'data breach', 'patient records', 'privacy', 'law', 'ethics', 'findings report', 'security'],
          },
        ],
      },
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
          {
          slug: 'it-support-shift-3',
          title: 'Help Desk, Shift 3: stuck at POST',
          description: 'Four machines that never reach Windows: a lab PC that says no bootable device, an office OptiPlex that forgets what year it is, a club rig demanding a BitLocker key, and a loaner laptop with a password nobody set. Work inside four different firmware utilities — boot order, CSM, Secure Boot, TPM, SATA mode, XMP, passwords — and open the case when the setting isn\'t the problem.',
          file: 'it-support-shift-3.html',
          kind: 'game',
          minutes: 60,
          added: '2026-09-16',
          tags: ['help desk', 'BIOS', 'UEFI', 'POST', 'boot order', 'CSM', 'Legacy', 'Secure Boot', 'TPM', 'BitLocker', 'CMOS', 'coin cell', 'SATA', 'AHCI', 'INACCESSIBLE_BOOT_DEVICE', 'XMP', 'firmware password', 'PXE'],
        },
        {
          slug: 'it-support-shift-4',
          title: 'Help Desk, Shift 4: new printer, empty room',
          description: 'No ticket to diagnose this time. Room 333 got a router, a laptop and a network printer in boxes. Cable them, power them, configure each through its own interface — the Windows desktop, the printer\'s LCD, the router\'s admin page in Edge — and prove it with a test page. Then the supervisor flips the power strip and checks whether the printer kept its address.',
          file: 'it-support-shift-4.html',
          kind: 'game',
          minutes: 45,
          added: '2026-10-05',
          tags: ['printer', 'router', 'WAN', 'LAN', 'DHCP', 'reservation', 'static IP', 'ipconfig', 'ping', '169.254', 'rogue DHCP', 'default password', 'SSID', 'Wi-Fi', 'Standard TCP/IP port', '9100', 'driver', 'test page', 'setup', 'simulation'],
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
      {
        id: 'resumes-and-interviews',
        title: 'Resumes & interviews',
        lessons: [
          {
            slug: 'about-me-github-profile',
            title: 'About me: your GitHub profile',
            description: 'Four short readings with checks — why an "About Me" earns you anything, the one naming trick that makes a README appear on your profile, what never goes on a public page, and the eight Markdown symbols that do all the work. Then a builder turns your answers into a finished README.md, refuses to let a phone number or an address through, and walks you into GitHub to publish it.',
            file: 'about-me-github-profile.html',
            kind: 'lab',
            minutes: 50,
            added: '2026-09-22',
            tags: ['GitHub', 'profile', 'README', 'about me', 'bio', 'Markdown', 'personal brand', 'portfolio', 'privacy', 'digital footprint', 'oversharing', 'resume', 'links', 'headings', 'commit', 'public repository'],
          },
          {
            slug: 'paid-experience-application',
            title: 'Paid experience application',
            description: 'Fill out the CTE paid work experience application the way the NYC Career Pathways portal asks for it — school, student, career clusters, parent/guardian — then brainstorm with a mind map and an experience chart and write a four-paragraph essay: “Why are you interested in a paid experience?” Sentence starters, an annotated sample essay, and a live checker help along the way. The result file carries the whole application and essay to Mr. Cruz.',
            file: 'paid-experience-application.html',
            kind: 'lab',
            minutes: 60,
            added: '2026-10-02',
            tags: ['application', 'paid internship', 'internship', 'work experience', 'work-based learning', 'Industry Scholars', 'Workplace Challenge', 'SWEF', 'CTE', 'Career Pathways', 'essay', 'personal statement', 'writing', 'mind map', 'brainstorm', 'experience chart', 'career clusters', 'OSIS', 'resume', 'parent contact'],
          },
        ],
      },
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
      {
        id: 'python',
        title: 'Python',
        lessons: [
          {
            slug: 'pop-quiz-think-it-save-it',
            title: 'Pop quiz: think it, then save it',
            description: 'A 15-minute timed quiz on Think it, then code it and Save Point. Six quick checks, four short programs to trace by hand, and two bug reports to reason through: a store discount that never gives 20% off, and a farming game with a free-money save glitch. It submits itself at 0:00.',
            file: 'pop-quiz-think-it-save-it.html',
            kind: 'quiz',
            minutes: 15,
            added: '2026-09-25',
            tags: ['quiz', 'pop quiz', 'timed', 'Python', 'variables', 'input', 'print', 'loops', 'for', 'while', 'range', 'strings', 'split', 'if', 'elif', 'else', 'logic', 'debugging', 'state', 'save file', 'JSON', 'json.dumps', 'json.loads', 'dict', 'references', 'game design'],
          },
        ],
      },
      {
        id: 'game-design',
        title: 'Game design',
        lessons: [
          {
            slug: 'save-point-build-a-game',
            title: 'Save Point: build a game that remembers',
            description: 'Build a dungeon game from drag-and-drop pieces, snap rule blocks onto them, and watch every rule turn into a Python function you can edit. Play it while the whole game shows up as one state dict, then save, quit, load, and hack a save file by hand. Fix two real save bugs in Python (a quick save that shares memory, and an infinite-coin glitch), write the rulebook, and take your game home as a .py file.',
            file: 'save-point-build-a-game.html',
            kind: 'lab',
            minutes: 60,
            added: '2026-09-23',
            tags: ['Python', 'game design', 'games', 'state', 'save file', 'save game', 'load', 'JSON', 'json.dumps', 'json.loads', 'dict', 'list', 'functions', 'def', 'if', 'f-string', 'files', 'open', 'copy', 'deepcopy', 'shallow copy', 'references', 'blocks', 'drag and drop', 'level editor', 'game loop', 'rules', 'serialization', 'undo', 'rewind', 'cheating'],
          },
          {
            slug: 'stat-check-game-database',
            title: 'Stat Check: every game is a database',
            description: 'The follow-up to Save Point: every game is really a database. Play a small RPG while watching every read and write it makes, then build the monster and stage tables yourself, write one rule function that works for every row, and query the game with SELECT, WHERE and JOIN. Fix two real bugs — goblins that share one body and a free potion — sketch the tables for a game of your own, and take your game home as a Python file and a SQL database.',
            file: 'stat-check-game-database.html',
            kind: 'lab',
            minutes: 60,
            added: '2026-09-28',
            tags: ['Python', 'game design', 'games', 'database', 'tables', 'rows', 'columns', 'SQL', 'query', 'SELECT', 'WHERE', 'JOIN', 'INSERT', 'UPDATE', 'state', 'save data', 'stats', 'RPG', 'monsters', 'stages', 'dict', 'list', 'functions', 'references', 'deepcopy', 'bugs', 'debugging', 'design doc', 'Save Point'],
          },
          {
            slug: 'smart-moves-game-ai',
            title: 'Smart Moves: build a game AI',
            description: 'Every enemy that ever chased you was a few lines of code answering two questions: what can I sense, and where should I go? Start where game AI started, then build a brain for a small robot — give danger a number, write if / elif / else rules, score every possible move and pick the best one — and code a castle guard that switches between patrol, chase, search and flee, then try to sneak past it. Decide how “intelligent” it really is, design an AI character of your own, and take the brain home as a Python file.',
            file: 'smart-moves-game-ai.html',
            kind: 'lab',
            minutes: 60,
            added: '2026-09-30',
            tags: ['Python', 'game AI', 'AI', 'artificial intelligence', 'game design', 'games', 'enemies', 'sense', 'think', 'act', 'if', 'elif', 'else', 'conditionals', 'danger', 'scoring', 'utility', 'best move', 'state machine', 'states', 'patrol', 'chase', 'flee', 'guard', 'Pac-Man', 'Turing', 'robot', 'functions'],
          },
        ],
      },
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