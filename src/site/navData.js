/**
 * The site navbar. Three levels:
 *   entry  → a top-level link OR a dropdown
 *   group  → a column inside the dropdown (can itself link somewhere)
 *   item   → a link inside the group
 * Add a group or item here and it appears in the menu; nothing else to wire.
 */
import { TEACHERS } from './teachers.js';
import { PAGES } from './pages.js';

const pageGroup = (slug) => ({
  label: PAGES[slug].title,
  href: `/pages/${slug}`,
  items: PAGES[slug].sections.flatMap((sec) =>
    sec.items.map((it) => ({ label: it.title, href: `/pages/${slug}#${sec.id}`, soon: !it.href }))
  ),
});

export const NAV = [
  { label: 'Widgets', href: '/#widgets' },
  {
    label: 'Teachers',
    groups: [
      {
        label: 'Faculty',
        href: '/#team',
        items: TEACHERS.map((t) => ({ label: t.name, sub: t.role, href: `/teachers/${t.slug}` })),
      },
      {
        label: 'On every teacher page',
        items: [
          { label: 'Class contract', href: '/teachers/jonathan-cruz#contract' },
          { label: 'Syllabus', href: '/teachers/jonathan-cruz#syllabus' },
          { label: 'Classes', href: '/teachers/jonathan-cruz#classes' },
        ],
      },
    ],
  },
  {
    label: 'Resources',
    groups: [pageGroup('school-forms'), pageGroup('survey-center'), pageGroup('guides')],
  },
  {
    label: 'Projects',
    groups: [
      { label: 'Live', href: '/#projects', items: [{ label: "Jonathan's Studio", sub: 'Slide editor · polls coming', href: '/studio' }] },
      {
        label: 'Coming soon',
        items: [
          { label: 'Herman Cordero', soon: true },
          { label: 'Julian Ocansey', soon: true },
          { label: 'John Garces', soon: true },
        ],
      },
    ],
  },
  { label: 'Mission', href: '/#mission' },
];
