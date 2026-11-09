/**
 * Lessons. Three levels, same as the nav:
 *   category  → /lessons/<slug>                 (IT Network, IT Support, ...)
 *   topic     → a section on the category page  (#<topic id>)
 *   lesson    → /lessons/<category>/<lesson>    (renders one HTML file)
 *
 * Since Nov 2026 the catalog lives in the backend (api.hsct.tech/api/lessons/)
 * and lesson files in object storage (lessons.hsct.tech), so a new lesson is an
 * upload on /teach, not a deploy. `loadCatalog()` in main.jsx fetches it before
 * the pages render and swaps it into CATEGORIES in place (the last good copy is
 * kept in this browser, so the site paints instantly on later visits). The list
 * below is the FALLBACK: what shows if the API can't be reached and nothing is
 * cached, and the seed for `scripts/export-catalog.mjs` → `import_lessons`.
 *
 * Each lesson is a self-contained HTML file. In the fallback, `file` is a name
 * under public/lesson-files/<category>/ (served as-is, like /hsct-logo.png) or
 * a full URL; from the API it is always a full URL. A lesson with an empty
 * `file` shows as "coming soon"; a topic with no lessons shows an empty state.
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

export const CATEGORIES = [   // fallback + seed; replaced in place by loadCatalog()
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
            {
        id: 'cabling-and-wifi',
        title: 'Cabling & Wi-Fi',
        lessons: [
          {
            slug: 'home-network-setup',
            title: 'Set up the Rivera home network',
            description: 'A family just moved in and the internet company left the modem on the floor. Cable the modem, router, office switch and devices (one cable runs to the office — use the switch), find the router at its address and change the factory password, then configure it through its admin page: Wi-Fi name and WPA password, the DHCP pool and what it must leave out, and a reservation so the printer is always at .50. Then four service calls — a 169.254 laptop, a printer that moved, a PC on the wrong network, a chewed cable — and five questions on IP addresses and ranges.',
            file: 'home-network-setup.html',
            kind: 'lab',
            minutes: 50,
            added: '2026-10-26',
            tags: ['home network', 'modem', 'router', 'switch', 'WAN', 'LAN', 'Wi-Fi', 'SSID', 'WPA2', 'WPA3', 'IP address', 'subnet mask', 'gateway', 'DHCP', 'DHCP pool', 'range', 'reservation', 'static IP', 'MAC address', 'printer', 'ipconfig', '169.254', 'APIPA', 'private address', 'admin page', '192.168.1.1', 'troubleshooting', 'link light', 'cable', 'simulation'],
          },
          {
            slug: 'home-network-setup-2',
            title: 'The Riveras bought a house',
            description: 'The harder sequel to Set up the Rivera home network. Two rooms with their own cable runs and a managed switch in each, six wired devices, a guest network, and a new subnet (192.168.10.x) so nothing can be copied from last time. Plan the address space in zones, add three reservations, then configure each switch: a name, a fixed management address, the gateway, loop protection. Five service calls with the evidence: a dead room, a broadcast storm, an IP address conflict, a laptop that can print but can\'t get online, and a party that empties the DHCP pool.',
            file: 'home-network-setup-2.html',
            kind: 'lab',
            minutes: 60,
            added: '2026-10-28',
            tags: ['home network', 'managed switch', 'switch', 'uplink', 'loop', 'broadcast storm', 'loop protection', 'router', 'WAN', 'LAN', 'guest network', 'guest isolation', 'WPA3', 'IP address', 'subnet', '192.168.10.1', 'DHCP', 'DHCP pool', 'lease', 'reservation', 'static IP', 'management IP', 'gateway', 'default gateway', 'IP conflict', 'duplicate IP', 'MAC address', 'NAS', 'camera', 'printer', 'ipconfig', '169.254', 'troubleshooting', 'simulation'],
          },
           {
            slug: 'manolo-house-network',
            title: 'OG Manolo\'s house: wire the whole thing',
            description: 'Part 3, and this time you walk the house. Make a character, ring Manolo\'s bell, and cable the closet (modem → router → the two wall jacks), then the office and the living room, each with its own switch. Find the router\'s page from the office PC, set up Wi-Fi with a guest network, the 192.168.10.x plan, the pool and three reservations, then plug your laptop into each managed switch and give it a name, a fixed address and loop protection. Put Manolo\'s tablet on the Wi-Fi. Day 2: five service calls, each in the room where it\'s happening, then six questions on the porch.',
            file: 'manolo-house-network.html',
            kind: 'game',
            minutes: 60,
            added: '2026-10-29',
            tags: ['home network', 'modem', 'router', 'managed switch', 'switch', 'wall jack', 'cable run', 'uplink', 'WAN', 'LAN', 'Wi-Fi', 'SSID', 'WPA3', 'guest network', 'guest isolation', 'IP address', 'subnet', '192.168.10.1', 'DHCP', 'DHCP pool', 'reservation', 'static IP', 'management IP', 'gateway', 'loop', 'broadcast storm', 'loop protection', 'IP conflict', 'MAC address', 'ipconfig', '169.254', 'troubleshooting', 'simulation', 'character', 'walk'],
          },
        ],
      },
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
          {
            slug: 'manolo-squishy-mafia',
            title: 'OG Manolo\'s house 4: the Squishy Mafia',
            description: 'A gray van has been across the street for three days, something tried the camera recorder\'s login 400 times last night, Junior "opened the cameras to his phone from anywhere," and the tablet keeps joining a second "Casa Manolo." Walk the house and the block, read the evidence, and name the five holes in Nena\'s notebook. Then take her car to Byte Depot (not the hardware store), buy the right gear under $350 — a PoE managed switch for the four cameras, a backup drive, cables — and drive it home. Cable the camera rack in the garage, give the switch a fixed address and a Cameras VLAN, re-open port 5 on the living room switch, and on the router: close Junior\'s port forwards, UPnP and remote admin, build the isolated cameras network, move the Wi-Fi to WPA3 with a new password. Harden the recorder, set up a nightly backup and verify it with SHA-256, and put the tablet on the real network instead of the evil twin.',
            file: 'manolo-squishy-mafia.html',
            kind: 'game',
            minutes: 75,
            added: '2026-11-02',
            tags: ['home network', 'security', 'port forward', 'UPnP', 'remote admin', 'firewall', 'default password', 'brute force', 'evil twin', 'BSSID', 'WPA3', 'WPS', 'VLAN', 'tagged', 'trunk', 'PoE', 'managed switch', 'cameras', 'NVR', 'firmware', 'backup', '3-2-1', 'SHA-256', 'hash', 'ransomware', 'isolation', 'segmentation', '192.168.20.1', 'DHCP', 'gateway', 'drive', 'car', 'shopping', 'budget', 'Manolo', 'Nena', 'Junior', 'Packet Run', 'Packet Trail', 'Seized Drive', 'simulation', 'character', 'walk'],
          },
          {
            slug: 'spaceverse-station-network',
            title: 'OG Manolo in the Spaceverse: bring the station back online',
            description: 'Part 5, in orbit, and a team lesson. Nena is the HSCT Spaceverse\'s network admin and she is a week away on Earth; the Space Ogre chewed through the fiber run to the Cargo Bay and Junior "helped" — a freezer on a manual address inside the DHCP pool, a loop in the Crew Quarters, a port forward to life support, guest isolation off. Read the evidence around the station and name the five problems in Nena\'s binder. Fly one of the team\'s four ships to Byte Orbital for a PoE managed switch, 200 m of multimode fiber and cables under $400. Cable the core rack (relay modem → router WAN → core switch → fiber to every module), fix the router (pool and a reservation, the Science VLAN, the firewall, WPA3 with guest isolation), cable the Observatory\'s sensor array and set up its switch, get the freezer out of the pool, kill Junior\'s loop. Then five service calls: 169.254, DNS, a wrong gateway, a dead WAN, a tablet too old for WPA3.',
            file: 'spaceverse-station-network.html',
            kind: 'game',
            minutes: 90,
            added: '2026-11-09',
            tags: ['team', 'teams', 'multiplayer', 'troubleshooting', 'service call', 'ipconfig', '169.254', 'APIPA', 'DHCP', 'DHCP pool', 'reservation', 'static IP', 'IP conflict', 'default gateway', 'DNS', 'ping', 'tracert', 'WAN', 'modem', 'router', 'core switch', 'fiber', 'multimode', 'OM3', 'LC', '100 m', 'copper', 'Cat 6', 'PoE', 'managed switch', 'VLAN', 'trunk', 'tagged', 'loop', 'broadcast storm', 'loop protection', 'port forward', 'UPnP', 'remote admin', 'firewall', 'isolation', 'WPA3', 'WPA2/WPA3', 'WPS', 'guest network', 'guest isolation', '10.42.10.1', 'Manolo', 'Nena', 'Junior', 'Space Ogre', 'ship', 'space', 'simulation', 'character', 'walk'],
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
      {
        id: 'working-with-a-team',
        title: 'Working with a team',
        lessons: [
          {
            slug: 'team-up-campus-trail',
            title: 'Team Up: the campus trail',
            description: 'Make a character and walk the campus. The bulletin board explains soft skills, group ethics and respect; then six forks on the trail each hold a situation a real team hits, and the path you walk is your answer. Wrong path, you are sent back to the start of that fork. At the Team Hall, put your team on the roster and give everyone a role: Programmer, Presenter, Project Manager, and say why.',
            file: '/lesson-files/career-and-finance/team-up-campus-trail.html',   // the file lives in the career-and-finance folder; absolute path works from any category
            kind: 'game',
            minutes: 40,
            added: '2026-10-29',
            tags: ['teamwork', 'team', 'soft skills', 'group ethics', 'respect', 'roles', 'programmer', 'presenter', 'project manager', 'roster', 'feedback', 'credit', 'communication', 'deadline', 'Workplace Challenge', 'simulation', 'walk', 'character'],
          },
          {
            slug: 'black-box-team-plan',
            title: 'Black Box: plan your team\'s game',
            description: 'The planning page for the team game. Four people, one game, one grade: a Python Arcade game where you touch objects, win or lose, and every change to the game\'s state is recorded in a log — the black box. Eight stops, filled in together before anyone codes: the team and its roles, the pitch and a level sketch, the objects table, what changes and what never does, win and lose as checks on state, the log record every object leaves and three questions you\'ll ask the log, the enemy\'s brain, and who does what by when. Autosaves in the browser; the Project Manager downloads the plan as a .json for Classroom and loads it back next class.',
            file: 'black-box-team-plan.html',
            kind: 'lab',
            minutes: 90,
            added: '2026-11-04',
            tags: ['team project', 'team', 'plan', 'planning', 'design doc', 'game design', 'games', 'Python Arcade', 'pygame', 'state', 'rules', 'objects', 'win', 'lose', 'log', 'black box', 'event log', 'replay', 'save file', 'JSON', 'queries', 'SQL', 'game AI', 'enemy', 'roles', 'programmer', 'presenter', 'project manager', 'Team Up', 'Save Point', 'Stat Check', 'Smart Moves', 'Workplace Challenge'],
          },
        ],
      },
      { id: 'communication', title: 'Communication', lessons: [] },
    ],
  },
    {
    slug: 'career-and-finance',
    title: 'Career & Finance',
    tone: 'blue',
    blurb: 'Tech jobs and the money that comes with them: what the roles are, what they pay, and what to do with a paycheck.',
    topics: [
      { id: 'tech-careers', title: 'Tech careers', lessons: [
        {
            slug: 'job-shadow-byte-works',
            title: 'Job Shadow: a day at Bronx Byte Works',
            description: 'A simulated work-based learning day. Make a character, walk into a small IT and software company on Fordham Road, and shadow its IT manager from sign-in to clock-out: a help desk ticket (an offline printer and a 169.254 address), a real bug in a developer\'s loop, an outage during a client call, lunch with the manager, an upset customer to explain things to without jargon, a team standup, and a debrief built from what you actually did. After each stop you write one section of the HSCT Work-Based Learning Experience Reflection. At the end you download it as a Word document: the school\'s worksheet, filled in, with a log of everything you did at every stop.',
            file: 'job-shadow-byte-works.html',
            kind: 'game',
            minutes: 70,
            added: '2026-11-04',
            tags: ['job shadow', 'work-based learning', 'WBL', 'reflection', 'worksheet', 'career', 'IT', 'help desk', 'developer', 'network', 'outage', 'customer', 'soft skills', 'communication', 'teamwork', 'problem solving', 'standup', 'strengths', 'career insight', 'simulation', 'character', 'walk', 'world', 'docx', 'Career Pathways'],
          },
      ] },
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
          {
            slug: 'pop-quiz-stat-check-smart-moves',
            title: 'Pop quiz: stat check and smart moves',
            description: 'A 25-minute timed quiz on Stat Check and Smart Moves: ten puzzles, three steps each. Run a fight through the damage and level-up rules, play detective with SELECT queries and a JOIN, catch the goblins that share one body and the free-potion bug, paint a danger map, out-think an if / elif chain, score every move, get a robot unstuck from a wall, and trace a castle guard through its states. A wrong answer earns a hint and a second try; a second miss walks you through it. It submits itself at 0:00.',
            file: 'pop-quiz-stat-check-smart-moves.html',
            kind: 'quiz',
            minutes: 25,
            added: '2026-10-09',
            tags: ['quiz', 'pop quiz', 'timed', 'puzzles', 'logic', 'Python', 'game design', 'database', 'SQL', 'SELECT', 'WHERE', 'ORDER BY', 'LIMIT', 'JOIN', 'damage', 'level up', 'XP', 'references', 'dict', 'copy', 'transaction', 'game AI', 'danger', 'if', 'elif', 'else', 'utility', 'score', 'local maximum', 'state machine', 'patrol', 'chase', 'search', 'flee', 'Stat Check', 'Smart Moves'],
          },
          {
            slug: 'frame-rate-lab',
            title: 'Frame Rate Lab: from one picture to smooth motion',
            description: 'A screen never shows movement: it shows one still picture after another, fast. Flip through twelve frames by hand, guess the frame rate by eye, then write real pygame — the Python Arcade starter — into a recorder that plays back every frame your program draws. Make a ball move, run the same code at 5, 15, 30 and 60 fps and watch its speed change, put a 60 fps recording through a pretend 30 Hz monitor, then fix the bug the way every real game does: delta time. Boss level: an animation of your own that runs the same at any frame rate, downloaded as a .py you can run in the Arcade.',
            file: 'frame-rate-lab.html',
            kind: 'lab',
            minutes: 60,
            added: '2026-10-28',
            tags: ['pygame', 'Python', 'game design', 'games', 'frame', 'frames', 'fps', 'frame rate', 'refresh rate', 'Hz', 'monitor', 'game loop', 'while loop', 'clock.tick', 'delta time', 'dt', 'speed', 'pixels per second', 'animation', 'motion', 'flipbook', 'draw.circle', 'draw.rect', 'display.flip', 'screen.fill', 'Python Arcade', 'simulation'],
          },
          {
            slug: 'build-the-final-boss',
            title: 'Build the Final Boss: stop SniperSpawn',
            description: 'SniperSpawn has hijacked the Arcade engine: 50 assignments a day, all auto-failed. Make a character and walk the campus to build the one thing that can stop him — a boss, one part per zone, out of what you already know: break his infinite loop at the gate, repair the boss\'s JSON stats in the Data Vault, write the SQL query and the move-picking rule in the Stat Lab, code the if / elif brain in the Tower, fix the shared-memory checkpoint at the Save Shrine, and make movement frame-rate-proof on the Field. Tech coins hide in the tall grass; kiosks sell three tiers of hints (the third is a scaffold); mentors explain for free. Then load your boss into the Arcade and watch your own think(), pick_move() and move() fight him, turn by turn.',
            file: 'build-the-final-boss.html',
            kind: 'game',
            minutes: 90,
            added: '2026-11-02',
            tags: ['boss', 'SniperSpawn', 'Python', 'while', 'infinite loop', 'JSON', 'types', 'string', 'number', 'boolean', 'null', 'array', 'SQL', 'SELECT', 'WHERE', 'ORDER BY', 'rows', 'dict', 'for', 'if', 'elif', 'else', 'state', 'copy', 'deepcopy', 'references', 'delta time', 'dt', 'fps', 'game AI', 'game design', 'character', 'walk', 'world', 'hints', 'coins', 'review', 'Data Vault', 'Stat Check', 'Smart Moves', 'Save Point', 'Frame Rate Lab', 'Think it then code it'],
          },
          {
            slug: 'spaceverse-distract-the-ogre',
            title: 'HSCT Spaceverse: distract the Space Ogre',
            description: 'A team world. The Space Ogre is bored, and a bored ogre eats airlocks — so your Black Box team builds the game it planned, in space, one part per station: objects and state in the Cargo Bay, win/lose on the Bridge, the black box (every change through change(), replay(start, LOG) rebuilds the ending) in the Vault, saves on the Cryo Deck, three log questions plus SQL in the Observatory, the enemy brain in the Drone Lab, the design doc and demo at the Comms Tower. Four ships per team, transporters to beam between them, Mr. Cruz and Mr. O at every station, star credits in the nebula dust for hints. Load the game at the Arcade Dock and let the Ogre play: if the log explains everything, he is distracted.',
            file: 'spaceverse-distract-the-ogre.html',
            kind: 'game',
            minutes: 120,
            added: '2026-11-09',
            tags: ['Black Box', 'team', 'teams', 'multiplayer', 'Python', 'dict', 'list', 'table', 'columns', 'state', 'rules', 'win', 'lose', 'log', 'black box', 'replay', 'change', 'JSON', 'json.dumps', 'json.loads', 'deepcopy', 'copy', 'SQL', 'SELECT', 'WHERE', 'ORDER BY', 'enemy', 'AI', 'sense think act', 'design doc', 'demo', 'game design', 'space', 'ship', 'world', 'hints', 'Mr. O', 'Space Ogre', 'project'],
          },
        ],
        
      },
      {
        id: 'data-structures',
        title: 'Data structures',
        lessons: [
          {
            slug: 'data-vault-json-database',
            title: 'Data Vault: from one value to a JSON database',
            description: 'The Room 333 Arcade\'s high-score machine got wiped, and you rebuild its memory in JSON, one level at a time. Sort the six kinds of value, build a player card from "key": value pairs and squash three broken ones, count array positions from 0, follow paths through nested data, then repair a database whose records don\'t match (and watch the leaderboard program crash until they do). Query and update it in Python, save it so it survives a power-off, and beat the boss: link collections by id, then design a database of your own.',
            file: 'data-vault-json-database.html',
            kind: 'lab',
            minutes: 60,
            added: '2026-10-14',
            tags: ['JSON', 'data structures', 'database', 'string', 'number', 'boolean', 'null', 'array', 'object', 'key', 'value', 'list', 'dict', 'index', 'nesting', 'path', 'record', 'field', 'table', 'schema', 'id', 'unique', 'json.loads', 'json.dumps', 'Python', 'query', 'save', 'load', 'files', 'link', 'join', 'foreign key', 'next id', 'validation', 'syntax', 'trailing comma', 'game design'],
          },
        ],
      },
    ],
  },
];

/* ── the live catalog ─────────────────────────────────────────────── */

const CACHE_KEY = 'hsct:catalog:v1';
let source = 'fallback';   // 'fallback' | 'cache' | 'api'
export const catalogSource = () => source;

/** Replace the catalog's contents in place, so every module that imported CATEGORIES sees the new one. */
export function setCatalog(categories, from = 'api') {
  if (!Array.isArray(categories) || !categories.length) return false;
  CATEGORIES.splice(0, CATEGORIES.length, ...categories);
  source = from;
  return true;
}

/**
 * Load the catalog from the API. Returns when the catalog is settled: the cached
 * copy applied at once and refreshed in the background, or the API awaited (up to
 * `timeout` ms) when nothing is cached. Never throws.
 */
export async function loadCatalog({ apiBase, timeout = 1800 } = {}) {
  if (!apiBase) return source;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { /* private mode */ }
  if (cached && setCatalog(cached, 'cache')) { refresh(apiBase); return source; }
  await Promise.race([refresh(apiBase), new Promise((r) => setTimeout(r, timeout))]);
  return source;
}
/** Fetch the catalog again now (after an upload on /teach, say). Resolves to the source in effect. */
export async function reloadCatalog(apiBase) { await refresh(apiBase); return source; }
async function refresh(apiBase) {
  try {
    const r = await fetch(`${apiBase}/lessons/`, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!r.ok) return;
    const data = await r.json();
    if (setCatalog(data.categories, 'api')) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(data.categories)); } catch { /* full or private */ } }
  } catch { /* offline, or no backend yet: the fallback or the cache stands */ }
}

/* ── helpers ──────────────────────────────────────────────────────── */

export const getCategory = (slug) => CATEGORIES.find((c) => c.slug === slug) || null;

/** The URL the iframe loads. A bare file name lives under /lesson-files/<category>/. */
export const lessonSrc = (category, lesson, query = '') => {
  if (!lesson.file) return '';
  const base = /^(https?:)?\/\//.test(lesson.file) || lesson.file.startsWith('/') ? lesson.file : `/lesson-files/${category.slug}/${lesson.file}`;
  return query ? `${base}${base.includes('?') ? '&' : '?'}${query}` : base;
};

/** The part of the page's query string a lesson should see: ?team=CODE or ?assignment=ID (teams, kit v1.2). */
export const lessonQuery = (search = typeof location !== 'undefined' ? location.search : '') => {
  const q = new URLSearchParams(search), out = new URLSearchParams();
  for (const k of ['team', 'assignment']) if (q.get(k)) out.set(k, q.get(k));
  return out.toString();
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