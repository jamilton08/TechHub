/**
 * Resource pages reachable from the navbar dropdowns (/pages/<slug>).
 * Each page has sections (level 2 in the menu) with items (level 3).
 * An item with an empty href shows as "coming soon" — fill in the link
 * (a Google Form, a PDF, a Drive file) and it goes live.
 */
export const PAGES = {
  'school-forms': {
    title: 'School forms',
    intro: 'Forms students and families fill out for the tech department. Most open a Google Form; some are PDFs to print and return.',
    sections: [
      {
        id: 'students',
        title: 'For students',
        items: [
          { title: 'Device loan agreement', description: 'Sign out a school laptop for the year.', href: '' },
          { title: 'Lab safety agreement', description: 'Required before using tools and hardware in the lab.', href: '' },
          { title: 'Project proposal', description: 'Pitch an independent project for department support.', href: '' },
        ],
      },
      {
        id: 'families',
        title: 'For families',
        items: [
          { title: 'Photo & media release', description: 'Permission to show student work and photos on this site.', href: '' },
          { title: 'Field trip permission', description: 'Standard permission slip for department trips.', href: '' },
        ],
      },
    ],
  },
  'survey-center': {
    title: 'Survey center',
    intro: 'Short surveys the department runs during the year. Responses shape what we teach and what we build.',
    sections: [
      {
        id: 'students',
        title: 'Student surveys',
        items: [
          { title: 'Start-of-year survey', description: 'What you already know, what you want to learn, what you\'ve built.', href: '' },
          { title: 'Mid-year check-in', description: 'Ten questions on how the class is going.', href: '' },
          { title: 'Tech feedback', description: 'Tell us about the tools — what works, what\'s broken, what\'s missing.', href: '' },
        ],
      },
      {
        id: 'families',
        title: 'Family surveys',
        items: [
          { title: 'Parent / guardian survey', description: 'Home tech access and how we can communicate better.', href: '' },
        ],
      },
    ],
  },
  'guides': {
    title: 'How-to guides',
    intro: 'Quick answers for the things students ask most.',
    sections: [
      {
        id: 'accounts',
        title: 'Accounts & access',
        items: [
          { title: 'Signing in to Google Classroom', description: 'With your school account, on a school or personal device.', href: '' },
          { title: 'School Wi-Fi', description: 'Which network, and what to do when it drops.', href: '' },
        ],
      },
      {
        id: 'tools',
        title: 'Tools',
        items: [
          { title: 'Printing in the lab', description: 'Where the printers are and how to send a job.', href: '' },
          { title: 'Setting up Python at home', description: 'Same setup we use in class, on Mac and Windows.', href: '' },
        ],
      },
    ],
  },
};

export const getPage = (slug) => PAGES[slug] || null;
